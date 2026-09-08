/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — repeatable automated coverage of the AI
 * endpoints' boundaries, replacing "we checked it in a browser once" notes.
 *
 * These tests execute the REAL global admin-auth middleware and the REAL
 * route handlers against a mock H3 event. Nothing about the auth model is
 * bypassed or reimplemented here: the only things supplied are the Nitro
 * auto-imports vitest does not provide (`defineEventHandler`,
 * `useRuntimeConfig`, `$fetch`), which is what lets the actual shipped
 * middleware run in-process. No network call and no Directus instance are
 * involved, and no AI provider is ever constructed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import type { AiProviderRegistry, AiProviderSummary, AiStructuredProvider } from '../server/utils/aiProviderRegistry'

const GENERATE_PATH = '/api/admin/products/3/ai/specification-proposal/generate'
const APPLY_PATH = '/api/admin/products/3/ai/specification-proposal/apply'

interface MockEventOptions {
  url: string
  method?: string
  cookies?: Record<string, string>
  headers?: Record<string, string>
  routerParams?: Record<string, string>
  body?: unknown
}

/** A mock H3 event with enough of the real shape for h3's own helpers to work on it. */
function mockEvent(opts: MockEventOptions) {
  const cookieHeader = Object.entries(opts.cookies ?? {}).map(([k, v]) => `${k}=${v}`).join('; ')
  const redirects: Array<{ location: string, status: number }> = []
  const event = {
    // h3's own helpers read `event.path` / `event.method` alongside `node.req`.
    path: opts.url,
    method: opts.method ?? 'GET',
    node: {
      req: {
        url: opts.url,
        method: opts.method ?? 'GET',
        headers: {
          host: 'localhost:3000',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(opts.headers ?? {}),
        },
      },
      res: {
        setHeader: (name: string, value: string) => {
          if (name.toLowerCase() === 'location') redirects.push({ location: String(value), status: 302 })
        },
        getHeader: () => undefined,
        end: () => {},
        writableEnded: false,
        statusCode: 200,
      },
    },
    context: { params: opts.routerParams ?? {} } as Record<string, unknown>,
    _requestBody: opts.body,
    redirects,
  }
  return event as unknown as Parameters<typeof import('h3').getRequestURL>[0] & typeof event
}

let fetchCalls: Array<{ url: string, options?: Record<string, unknown> }> = []

function installNitroGlobals(fetchImpl: (url: string, options?: Record<string, unknown>) => Promise<unknown>) {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useRuntimeConfig', () => ({
    directusUrl: 'http://directus.test',
    directusToken: 'server-token',
    aiDefaultProvider: 'deepseek',
    openaiApiKey: '',
    openaiModel: '',
    deepseekApiKey: '',
    deepseekModel: '',
  }))
  vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: Record<string, unknown>) => {
    fetchCalls.push({ url, options })
    return fetchImpl(url, options)
  }))
}

async function statusCodeOf(run: () => Promise<unknown>): Promise<number | 'no-error'> {
  try {
    await run()
    return 'no-error'
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1
  }
}

beforeEach(() => {
  fetchCalls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── 1. Auth on the deep AI paths ──

describe('global admin-auth middleware — the deep /api/admin/products/:id/ai/** paths', () => {
  it('rejects an unauthenticated request with 401 (no cookies at all)', async () => {
    installNitroGlobals(async () => ({}))
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

    for (const url of [GENERATE_PATH, APPLY_PATH]) {
      const status = await statusCodeOf(() => middleware(mockEvent({ url, method: 'POST' })))
      expect(status).toBe(401)
    }
    // Never reached Directus at all on the unauthenticated path.
    expect(fetchCalls).toHaveLength(0)
  })

  it('rejects an authenticated NON-administrator with 403', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/users/me')) return { data: { id: 'u1', role: { name: 'nuxt-server' } } }
      return {}
    })
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

    for (const url of [GENERATE_PATH, APPLY_PATH]) {
      const status = await statusCodeOf(() => middleware(
        mockEvent({ url, method: 'POST', cookies: { admin_at: 'a-real-but-non-admin-token' } }),
      ))
      expect(status).toBe(403)
    }
  })

  it('lets an Administrator through and records the verified token on the event context', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/users/me')) return { data: { id: 'admin-1', role: { name: 'Administrator' } } }
      return {}
    })
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

    const event = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      cookies: { admin_at: 'admin-token' },
      headers: { origin: 'http://localhost:3000' },
    })
    await expect(middleware(event)).resolves.toBeUndefined()
    expect((event.context as { adminToken?: string }).adminToken).toBe('admin-token')
  })

  it('still enforces CSRF on these paths — a POST with no Origin header is refused', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/users/me')) return { data: { id: 'admin-1', role: { name: 'Administrator' } } }
      return {}
    })
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

    const status = await statusCodeOf(() => middleware(
      mockEvent({ url: APPLY_PATH, method: 'POST', cookies: { admin_at: 'admin-token' } }),
    ))
    expect(status).toBe(403)
  })

  it('the AI paths are not covered by the auth-endpoint exemption', async () => {
    installNitroGlobals(async () => ({}))
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

    // The one exempt prefix returns without throwing, even with no cookie…
    await expect(middleware(mockEvent({ url: '/api/admin/auth/login', method: 'POST' }))).resolves.toBeUndefined()
    // …while the AI paths do not share that exemption.
    expect(await statusCodeOf(() => middleware(mockEvent({ url: GENERATE_PATH, method: 'POST' })))).toBe(401)
  })
})

// ── 2. Cross-product isolation ──

function mockRegistry(generateStructured: unknown): AiProviderRegistry {
  const summaries: AiProviderSummary[] = [
    { id: 'deepseek', label: 'DeepSeek', configured: true },
    { id: 'openai', label: 'OpenAI', configured: false },
  ]
  return {
    getProvider: () => ({ isConfigured: () => true, generateStructured: async () => ({ ok: true as const, output: {} }) }) as unknown as AiStructuredProvider,
    listConfiguredProviders: () => summaries,
    getDefaultProvider: () => 'deepseek',
    generateStructured: generateStructured as AiProviderRegistry['generateStructured'],
  }
}

describe('cross-product isolation — product A may not reach product B\'s files', () => {
  it('downloads no asset, calls no provider, and returns a generic unavailable result', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: { groups: [] } }))
    const paths: string[] = []

    // Directus is asked for product A's files; product B's row simply is not
    // in the response, exactly as the real product-scoped filter behaves.
    const fetch = (async <T>(path: string): Promise<T> => {
      paths.push(path)
      if (path.startsWith('/items/products?filter[id]')) return { data: [{ id: 1 }] } as T
      if (path.startsWith('/items/products_files?')) return { data: [] } as T
      if (path.startsWith('/items/products/')) return { data: { name_en: 'Product A' } } as T
      throw new Error(`Unexpected fetch path: ${path}`)
    }) as FetchFn

    const result = await runProposalEngine(fetch, mockRegistry(generate), specificationsTarget, {
      productId: 1,
      providerId: 'deepseek',
      mediaIds: [4242], // a products_files row belonging to product B
    })

    expect(result.ok).toBe(false)
    expect(result.fileResults).toEqual([
      { displayName: 'Selected file', status: 'unreadable', reason: 'One of the selected files could not be used for this product.' },
    ])
    expect(paths.some(p => p.startsWith('/assets/'))).toBe(false)
    expect(generate).not.toHaveBeenCalled()

    // No id, uuid, filename, path or ownership hint anywhere in the response.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('4242')
    expect(serialized).not.toContain('products_files')
    expect(serialized.toLowerCase()).not.toContain('belong')
    expect(serialized.toLowerCase()).not.toContain('product b')
  })

  it('the request is scoped to the calling product in the query itself, not filtered afterwards', async () => {
    const paths: string[] = []
    const fetch = (async <T>(path: string): Promise<T> => {
      paths.push(path)
      if (path.startsWith('/items/products?filter[id]')) return { data: [{ id: 7 }] } as T
      if (path.startsWith('/items/products_files?')) return { data: [] } as T
      if (path.startsWith('/items/products/')) return { data: { name_en: 'Product' } } as T
      throw new Error(`Unexpected fetch path: ${path}`)
    }) as FetchFn

    await runProposalEngine(fetch, mockRegistry(vi.fn()), specificationsTarget, {
      productId: 7, providerId: 'deepseek', mediaIds: [1],
    })

    const filesQuery = paths.find(p => p.startsWith('/items/products_files?'))!
    expect(filesQuery).toContain('filter[products_id][_eq]=7')
    expect(filesQuery).toContain('filter[enabled][_eq]=true')
  })
})

// ── 3. Apply is inert for every body ──

describe('apply.post.ts — 503 for every request, with no write path reachable', () => {
  const bodies = [
    undefined,
    {},
    { changes: [] },
    { changes: [{ action: 'add', group: 'G', parameter: 'P', value: 'V' }] },
    { changes: Array.from({ length: 100 }, (_, i) => ({ action: 'update', specItemId: i + 1, value: 'x' })) },
    { changes: 'not-even-an-array' },
  ]

  it.each(bodies.map((b, i) => [i, b] as const))('body variant %i returns 503 and issues no write request', async (_i, body) => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products')) return { data: [{ id: 3 }] }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/apply.post')).default as (e: unknown) => Promise<unknown>

    const event = mockEvent({
      url: APPLY_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      body,
      headers: { origin: 'http://localhost:3000' },
    })
    event.context.adminToken = 'admin-token'

    expect(await statusCodeOf(() => handler(event))).toBe(503)

    // Not one non-GET request reached Directus — no writer, no adminFetch write.
    const writes = fetchCalls.filter(c => {
      const method = String((c.options?.method as string | undefined) ?? 'GET').toUpperCase()
      return method !== 'GET'
    })
    expect(writes).toEqual([])
  })

  it('the handler source contains no write call at all — a future refactor cannot silently re-enable writing', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/admin/products/[id]/ai/specification-proposal/apply.post.ts'),
      'utf8',
    )
    expect(source).not.toContain('applyAcceptedSpecificationChanges')
    expect(source).not.toContain('productSpecWriter')
    expect(source).not.toMatch(/method:\s*'(POST|PATCH|DELETE)'/)
    expect(source).toContain('statusCode: 503')
  })
})

// ── 4. Generate refuses an oversized body before parsing it ──

describe('generate.post.ts — oversized request bodies are refused before readBody', () => {
  it('a declared Content-Length over the limit returns 413 without parsing or fetching anything', async () => {
    installNitroGlobals(async () => ({}))
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<unknown>

    const event = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { 'origin': 'http://localhost:3000', 'content-length': String(5 * 1024 * 1024) },
    })
    event.context.adminToken = 'admin-token'

    expect(await statusCodeOf(() => handler(event))).toBe(413)
    expect(fetchCalls).toHaveLength(0)
  })

  it('the guard is applied before readBody in the handler source', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/admin/products/[id]/ai/specification-proposal/generate.post.ts'),
      'utf8',
    )
    const guardAt = source.indexOf('MAX_GENERATE_BODY_BYTES')
    const readBodyAt = source.indexOf('await readBody(event)')
    expect(guardAt).toBeGreaterThan(-1)
    expect(readBodyAt).toBeGreaterThan(guardAt)
  })
})
