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
import { Readable } from 'node:stream'
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
  /** A real Node readable stream used as the request body, so byte-level body limits are exercised for real. */
  requestStream?: Readable
}

/** A mock H3 event with enough of the real shape for h3's own helpers to work on it. */
function mockEvent(opts: MockEventOptions) {
  const cookieHeader = Object.entries(opts.cookies ?? {}).map(([k, v]) => `${k}=${v}`).join('; ')
  const redirects: Array<{ location: string, status: number }> = []
  // When a body stream is supplied, the request object IS that stream, with the
  // IncomingMessage fields the handlers read layered on top — so `on('data')`,
  // `destroy()` and backpressure all behave like a real request.
  const req = Object.assign(opts.requestStream ?? new Readable({ read() { this.push(null) } }), {
    url: opts.url,
    method: opts.method ?? 'GET',
    headers: {
      host: 'localhost:3000',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(opts.headers ?? {}),
    },
  })
  const event = {
    // h3's own helpers read `event.path` / `event.method` alongside `node.req`.
    path: opts.url,
    method: opts.method ?? 'GET',
    node: {
      req,
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

// ── 3b. Provider status endpoint ──

const PROVIDERS_PATH = '/api/admin/ai/providers'

describe('/api/admin/ai/providers — auth, safe fields only, and no caching', () => {
  it('is refused for an unauthenticated caller (401)', async () => {
    installNitroGlobals(async () => ({}))
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    expect(await statusCodeOf(() => middleware(mockEvent({ url: PROVIDERS_PATH })))).toBe(401)
    expect(fetchCalls).toHaveLength(0)
  })

  it('is refused for an authenticated non-administrator (403)', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/users/me')) return { data: { id: 'u1', role: { name: 'nuxt-server' } } }
      return {}
    })
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    const status = await statusCodeOf(() => middleware(
      mockEvent({ url: PROVIDERS_PATH, cookies: { admin_at: 'non-admin' } }),
    ))
    expect(status).toBe(403)
  })

  it('returns only id/label/configured/isDefault — never a key, model name, or raw config', async () => {
    installNitroGlobals(async () => ({}))
    vi.stubGlobal('useRuntimeConfig', () => ({
      aiDefaultProvider: 'deepseek',
      openaiApiKey: 'sk-SUPER-SECRET-OPENAI-KEY',
      openaiModel: 'gpt-secret-model-name',
      deepseekApiKey: 'ds-SUPER-SECRET-DEEPSEEK-KEY',
      deepseekModel: 'deepseek-secret-model-name',
    }))
    const handler = (await import('../server/api/admin/ai/providers.get')).default as unknown as (e: unknown) => unknown

    const event = mockEvent({ url: PROVIDERS_PATH })
    const result = await handler(event) as Array<Record<string, unknown>>

    expect(Array.isArray(result)).toBe(true)
    for (const provider of result) {
      expect(Object.keys(provider).sort()).toEqual(['configured', 'id', 'isDefault', 'label'])
    }
    // Configured is reported truthfully from the presence of a key…
    expect(result.find(p => p.id === 'deepseek')?.configured).toBe(true)
    // …but no secret or model name appears anywhere in the payload.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('SUPER-SECRET')
    expect(serialized).not.toContain('secret-model-name')
    expect(serialized).not.toContain('sk-')
    expect(serialized).not.toContain('apiKey')
  })

  it('sets Cache-Control: private, no-store so provider status is never cached or persisted', async () => {
    installNitroGlobals(async () => ({}))
    const handler = (await import('../server/api/admin/ai/providers.get')).default as unknown as (e: unknown) => unknown

    const headers: Record<string, string> = {}
    const event = mockEvent({ url: PROVIDERS_PATH })
    ;(event.node.res as unknown as { setHeader: (n: string, v: string) => void }).setHeader = (name, value) => {
      headers[name.toLowerCase()] = String(value)
    }

    await handler(event)
    expect(headers['cache-control']).toBe('private, no-store')
  })
})


// ── 3c. The AI-safe source DTO ──

const SOURCES_PATH = '/api/admin/products/3/ai/sources'

/** A Directus row exactly as the general media endpoint would return it — everything below must be withheld. */
const RAW_DIRECTUS_ROWS = [
  {
    id: 11,
    enabled: true,
    file_role: 'datasheet',
    directus_files_id: {
      filename_download: 'LT-180C Datasheet.txt',
      type: 'text/plain',
    },
  },
  {
    id: 12,
    enabled: true,
    file_role: null,
    directus_files_id: {
      filename_download: 'C:\\Users\\admin\\secret\\a1b2c3d4-e5f6-7890-abcd-ef1234567890.txt',
      type: 'text/plain',
    },
  },
  {
    id: 13,
    enabled: false,
    file_role: 'manual',
    directus_files_id: { filename_download: 'disabled.txt', type: 'text/plain' },
  },
  {
    id: 14,
    enabled: true,
    file_role: null,
    directus_files_id: { filename_download: 'photo.jpg', type: 'image/jpeg' },
  },
  {
    id: 15,
    enabled: true,
    file_role: null,
    directus_files_id: { filename_download: 'datasheet.pdf', type: 'application/pdf' },
  },
]

async function loadSources() {
  installNitroGlobals(async (url: string) => {
    if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
    if (url.includes('/items/products_files')) return { data: RAW_DIRECTUS_ROWS }
    return { data: null }
  })
  const handler = (await import('../server/api/admin/products/[id]/ai/sources.get')).default as unknown as (e: unknown) => Promise<Array<Record<string, unknown>>>
  const event = mockEvent({ url: SOURCES_PATH, routerParams: { id: '3' } })
  event.context.adminToken = 'admin-token'
  event.context.adminUserId = 'admin-1'
  return { result: await handler(event), event }
}

describe('/api/admin/products/:id/ai/sources — the browser receives no Directus metadata at all', () => {
  it('returns only the safe DTO fields', async () => {
    const { result } = await loadSources()
    for (const source of result) {
      expect(Object.keys(source).sort()).toEqual(
        ['analyzable', 'displayName', 'roleLabel', 'sourceRef', 'typeLabel', 'unavailableReason'],
      )
    }
  })

  it('the serialized response contains no UUID, no raw filename, no path, no caption, no alt, no field names from Directus', async () => {
    const { result } = await loadSources()
    const serialized = JSON.stringify(result)

    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(serialized).not.toContain('directus_files_id')
    expect(serialized).not.toContain('filename_download')
    expect(serialized).not.toContain('caption')
    expect(serialized).not.toContain('alt_en')
    expect(serialized).not.toContain('Users')
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('/assets/')
  })

  it('a hostile filename collapses to the generic label, a normal one is shown as-is', async () => {
    const { result } = await loadSources()
    expect(result[0].displayName).toBe('LT-180C Datasheet.txt')
    expect(result[1].displayName).toBe('Source file')
  })

  it('decides analyzability server-side, with the specific reason for each refusal', async () => {
    const { result } = await loadSources()
    expect(result[0]).toMatchObject({ analyzable: true, unavailableReason: null })
    expect(result[2]).toMatchObject({ analyzable: false })
    expect(String(result[2].unavailableReason)).toContain('disabled for this product')
    expect(result[3]).toMatchObject({ analyzable: false })
    expect(String(result[3].unavailableReason)).toContain('Not available for text-source analysis yet')
    expect(result[4]).toMatchObject({ analyzable: false })
    expect(String(result[4].unavailableReason)).toContain('PDF is not supported')
  })

  it('is not cached — provider and source context must not outlive the session', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products_files')) return { data: [] }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/sources.get')).default as unknown as (e: unknown) => Promise<unknown>

    const headers: Record<string, string> = {}
    const event = mockEvent({ url: SOURCES_PATH, routerParams: { id: '3' } })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'
    ;(event.node.res as unknown as { setHeader: (n: string, v: string) => void }).setHeader = (name, value) => {
      headers[name.toLowerCase()] = String(value)
    }

    await handler(event)
    expect(headers['cache-control']).toBe('private, no-store')
  })

  it('the refs it mints only work for the admin and product they were minted for', async () => {
    const { result } = await loadSources()
    const ref = String(result[0].sourceRef)

    const { resolveSourceRef } = await import('../server/utils/aiSourceRef')
    expect(resolveSourceRef(ref, { productId: 3, adminUserId: 'admin-1' })).toBe(11)
    expect(resolveSourceRef(ref, { productId: 4, adminUserId: 'admin-1' })).toBeNull()
    expect(resolveSourceRef(ref, { productId: 3, adminUserId: 'someone-else' })).toBeNull()
  })

  it('is refused for an unauthenticated caller by the global middleware', async () => {
    installNitroGlobals(async () => ({}))
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    expect(await statusCodeOf(() => middleware(mockEvent({ url: SOURCES_PATH })))).toBe(401)
  })
})

// ── 3d. AI product context: least privilege ──

const CONTEXT_PATH = '/api/admin/products/3/ai/context'

/** A product row as the GENERAL endpoint would return it — everything beyond four fields must be withheld. */
const RAW_PRODUCT_ROW = {
  id: 3,
  name_en: 'LT-180C Free-Fall Metal Detector',
  product_code: 'LT-180C',
  status: 'draft',
  hero_image: 'aaaabbbb-cccc-dddd-eeee-ffff00001111',
  review_notes: 'INTERNAL: pricing not agreed, do not publish',
  seo_title: 'Buy LT-180C',
  seo_description: 'internal seo draft',
  summary_en: 'highlights that do not belong on this screen',
}

describe('/api/admin/products/:id/ai/context — the AI screens get four fields, not the product record', () => {
  async function loadContext() {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products/3')) return { data: RAW_PRODUCT_ROW }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/context.get')).default as unknown as (e: unknown) => Promise<Record<string, unknown>>
    const event = mockEvent({ url: CONTEXT_PATH, routerParams: { id: '3' } })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'
    return { result: await handler(event), event }
  }

  it('returns only productId, productName, productCode, lifecycleStatus and thumbnailUrl', async () => {
    const { result } = await loadContext()
    expect(Object.keys(result).sort()).toEqual(
      ['lifecycleStatus', 'productCode', 'productId', 'productName', 'thumbnailUrl'],
    )
  })

  it('never returns the hero UUID, review notes, SEO fields, highlights, or an assets URL', async () => {
    const { result } = await loadContext()
    const serialized = JSON.stringify(result)

    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(serialized).not.toContain('hero_image')
    expect(serialized).not.toContain('review_notes')
    expect(serialized).not.toContain('INTERNAL')
    expect(serialized).not.toContain('seo_')
    expect(serialized).not.toContain('summary_en')
    expect(serialized).not.toContain('/assets/')
  })

  it('the thumbnail is addressed by the product route, never by a file id', async () => {
    const { result } = await loadContext()
    expect(result.thumbnailUrl).toBe('/api/admin/products/3/ai/hero')
  })

  it('asks Directus for only those columns — a wider response cannot leak what was never selected', async () => {
    await loadContext()
    const productQuery = fetchCalls.map(c => c.url).find(u => u.includes('/items/products/3'))!
    expect(productQuery).toContain('fields=name_en,product_code,status,hero_image')
    expect(productQuery).not.toContain('review_notes')
  })

  it('is not cached, and is refused for an unauthenticated caller', async () => {
    const headers: Record<string, string> = {}
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products/3')) return { data: RAW_PRODUCT_ROW }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/context.get')).default as unknown as (e: unknown) => Promise<unknown>
    const event = mockEvent({ url: CONTEXT_PATH, routerParams: { id: '3' } })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'
    ;(event.node.res as unknown as { setHeader: (n: string, v: string) => void }).setHeader = (n, v) => {
      headers[n.toLowerCase()] = String(v)
    }
    await handler(event)
    expect(headers['cache-control']).toBe('private, no-store')

    installNitroGlobals(async () => ({}))
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    expect(await statusCodeOf(() => middleware(mockEvent({ url: CONTEXT_PATH })))).toBe(401)
  })
})

// ── 3e. Full authenticated chain: sources -> sourceRef -> Generate ──

describe('the whole chain — list sources, then generate with the refs it minted', () => {
  const CHAIN_ROWS = [
    { id: 21, enabled: true, file_role: 'datasheet', directus_files_id: { filename_download: 'specs.txt', type: 'text/plain' } },
    { id: 22, enabled: true, file_role: null, directus_files_id: { filename_download: 'photo.jpg', type: 'image/jpeg' } },
  ]

  function chainFetch(url: string) {
    if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
    if (url.includes('/items/products_files?filter[products_id][_eq]=3')) return { data: CHAIN_ROWS }
    if (url.includes('/items/products/3')) return { data: { name_en: 'Test product' } }
    return { data: null }
  }

  it('a ref from ai/sources is accepted by Generate for the same admin and product, with no id or UUID anywhere', async () => {
    const { resetGenerateSlots } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()

    // 1. List the sources as an authenticated administrator.
    installNitroGlobals(async (url: string) => chainFetch(url))
    const sourcesHandler = (await import('../server/api/admin/products/[id]/ai/sources.get')).default as unknown as (e: unknown) => Promise<Array<Record<string, unknown>>>
    const sourcesEvent = mockEvent({ url: SOURCES_PATH, routerParams: { id: '3' } })
    sourcesEvent.context.adminToken = 'admin-token'
    sourcesEvent.context.adminUserId = 'admin-1'
    const sources = await sourcesHandler(sourcesEvent)

    const analyzable = sources.find(s => s.analyzable)!
    expect(analyzable.displayName).toBe('specs.txt')

    // 2. Generate with that ref. No provider key is configured, so this fails
    //    closed at the provider check — which still proves the ref resolved and
    //    the request reached the engine.
    const generateHandler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<{ ok: boolean, error?: string }>
    const generateEvent = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { origin: 'http://localhost:3000' },
      requestStream: Readable.from([JSON.stringify({ providerId: 'deepseek', sourceRefs: [analyzable.sourceRef] })]),
    })
    generateEvent.context.adminToken = 'admin-token'
    generateEvent.context.adminUserId = 'admin-1'

    const result = await generateHandler(generateEvent)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('AI provider is not configured.')
    // Not the ref-rejection message: the ref really did resolve.
    expect(result.error).not.toContain('no longer valid')

    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(serialized).not.toContain('filename_download')
  })

  it('the same ref is refused for a DIFFERENT administrator', async () => {
    const { resetGenerateSlots } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()

    installNitroGlobals(async (url: string) => chainFetch(url))
    const sourcesHandler = (await import('../server/api/admin/products/[id]/ai/sources.get')).default as unknown as (e: unknown) => Promise<Array<Record<string, unknown>>>
    const sourcesEvent = mockEvent({ url: SOURCES_PATH, routerParams: { id: '3' } })
    sourcesEvent.context.adminToken = 'admin-token'
    sourcesEvent.context.adminUserId = 'admin-1'
    const sources = await sourcesHandler(sourcesEvent)
    const ref = sources.find(s => s.analyzable)!.sourceRef

    const generateHandler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<{ ok: boolean, error?: string }>
    const generateEvent = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { origin: 'http://localhost:3000' },
      requestStream: Readable.from([JSON.stringify({ providerId: 'deepseek', sourceRefs: [ref] })]),
    })
    generateEvent.context.adminToken = 'admin-token'
    generateEvent.context.adminUserId = 'a-different-admin'

    const result = await generateHandler(generateEvent)
    expect(result.error).toContain('no longer valid')
  })
})

// ── 3f. Generate cost control ──

describe('generate.post.ts — cost control before any provider call', () => {
  /**
   * The limiter is claimed only AFTER the request validates, so an invalid
   * request never consumes a slot or trips a cooldown — it costs nothing.
   * These tests therefore use a genuinely valid ref, minted the same way the
   * browser gets one.
   */
  async function mintRef(adminUserId: string, productId = 3): Promise<string> {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: productId }] }
      if (url.includes('/items/products_files')) {
        return { data: [{ id: 31, enabled: true, file_role: null, directus_files_id: { filename_download: 'specs.txt', type: 'text/plain' } }] }
      }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/sources.get')).default as unknown as (e: unknown) => Promise<Array<Record<string, unknown>>>
    const event = mockEvent({ url: `/api/admin/products/${productId}/ai/sources`, routerParams: { id: String(productId) } })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = adminUserId
    const sources = await handler(event)
    return String(sources[0].sourceRef)
  }

  async function generateOnce(adminUserId: string, productId = '3', sourceRef?: string) {
    const ref = sourceRef ?? await mintRef(adminUserId, Number(productId))
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: Number(productId) }] }
      if (url.includes('/items/products_files')) return { data: [] }
      if (url.includes('/items/products/')) return { data: { name_en: 'Test product' } }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<unknown>
    const event = mockEvent({
      url: `/api/admin/products/${productId}/ai/specification-proposal/generate`,
      method: 'POST',
      routerParams: { id: productId },
      headers: { origin: 'http://localhost:3000' },
      requestStream: Readable.from([JSON.stringify({ providerId: 'deepseek', sourceRefs: [ref] })]),
    })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = adminUserId
    return { handler, event }
  }

  it('a second generation during the cooldown is refused with 429 and a Retry-After', async () => {
    const { resetGenerateSlots, claimGenerateSlot, releaseGenerateSlot } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()

    // Simulate a generation that has just completed for this admin+product.
    claimGenerateSlot('admin-1', 3)
    releaseGenerateSlot('admin-1', 3)

    const headers: Record<string, string> = {}
    const { handler, event } = await generateOnce('admin-1')
    ;(event.node.res as unknown as { setHeader: (n: string, v: string) => void }).setHeader = (n, v) => {
      headers[n.toLowerCase()] = String(v)
    }

    expect(await statusCodeOf(() => handler(event))).toBe(429)
    expect(Number(headers['retry-after'])).toBeGreaterThan(0)
    resetGenerateSlots()
  })

  it('a generation already in flight blocks a second one for the same admin and product', async () => {
    const { resetGenerateSlots, claimGenerateSlot } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()
    claimGenerateSlot('admin-1', 3) // still running

    const { handler, event } = await generateOnce('admin-1')
    expect(await statusCodeOf(() => handler(event))).toBe(429)
    resetGenerateSlots()
  })

  it('one administrator cooldown does not affect a different administrator', async () => {
    const { resetGenerateSlots, claimGenerateSlot, releaseGenerateSlot } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()
    claimGenerateSlot('admin-1', 3)
    releaseGenerateSlot('admin-1', 3)

    const { handler, event } = await generateOnce('admin-2')
    // Not 429: this administrator has no cooldown of their own. The request
    // proceeds and fails closed at the provider check instead.
    const result = await handler(event) as { ok: boolean, error?: string }
    expect(result.error).toBe('AI provider is not configured.')
    resetGenerateSlots()
  })

  it('sets Cache-Control: private, no-store on the generate response', async () => {
    const { resetGenerateSlots } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()

    const headers: Record<string, string> = {}
    const { handler, event } = await generateOnce('admin-3')
    ;(event.node.res as unknown as { setHeader: (n: string, v: string) => void }).setHeader = (n, v) => {
      headers[n.toLowerCase()] = String(v)
    }
    await handler(event)
    expect(headers['cache-control']).toBe('private, no-store')
    resetGenerateSlots()
  })
})

// ── 4. Generate refuses an oversized body before parsing it ──

describe('generate.post.ts — oversized request bodies are refused on real bytes, before any JSON parsing', () => {
  /**
   * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — the old guard trusted `Content-Length`
   * and then called `readBody()`. Each case below is a way past that guard,
   * and each must now end in 413 with nothing parsed.
   */
  async function runGenerate(opts: { headers?: Record<string, string>, bodyChunks: Array<string | Buffer> }) {
    installNitroGlobals(async () => ({}))
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<unknown>

    const stream = Readable.from(opts.bodyChunks)
    const event = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { origin: 'http://localhost:3000', ...(opts.headers ?? {}) },
      requestStream: stream,
    })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'
    return statusCodeOf(() => handler(event))
  }

  // Kept in lockstep with the handler by the parity test at the end of this block.
  const MAX_GENERATE_BODY_BYTES = 4 * 1024
  const OVERSIZED = 'x'.repeat(MAX_GENERATE_BODY_BYTES + 1024)

  it('an honestly declared oversized Content-Length is refused', async () => {
    const status = await runGenerate({
      headers: { 'content-length': String(5 * 1024 * 1024) },
      bodyChunks: ['{}'],
    })
    expect(status).toBe(413)
    expect(fetchCalls).toHaveLength(0)
  })

  it('a MISSING Content-Length (chunked / HTTP2) with an oversized body is still refused', async () => {
    const status = await runGenerate({ bodyChunks: [OVERSIZED] })
    expect(status).toBe(413)
    expect(fetchCalls).toHaveLength(0)
  })

  it('a FORGED Content-Length that understates a huge body is refused on the real bytes', async () => {
    const status = await runGenerate({
      headers: { 'content-length': '12' }, // lie
      bodyChunks: [OVERSIZED],
    })
    expect(status).toBe(413)
    expect(fetchCalls).toHaveLength(0)
  })

  it('an INVALID, non-numeric Content-Length with an oversized body is refused', async () => {
    const status = await runGenerate({
      headers: { 'content-length': 'not-a-number' },
      bodyChunks: [OVERSIZED],
    })
    expect(status).toBe(413)
    expect(fetchCalls).toHaveLength(0)
  })

  it('stops reading as soon as the ceiling is passed — the rest of the body is never consumed', async () => {
    installNitroGlobals(async () => ({}))
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<unknown>

    const CHUNK = 1024
    let chunksProduced = 0
    const stream = new Readable({
      read() {
        chunksProduced += 1
        if (chunksProduced > 500) {
          this.push(null) // safety net: a broken reader fails the test instead of hanging
          return
        }
        this.push('y'.repeat(CHUNK))
      },
    })

    const event = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { origin: 'http://localhost:3000' },
      requestStream: stream,
    })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'

    expect(await statusCodeOf(() => handler(event))).toBe(413)
    // Only enough chunks to cross the ceiling, not the whole (endless) body.
    expect(chunksProduced).toBeLessThan(100) // far short of the 500-chunk safety net: reading really stopped
  })

  it('a normal small body is read and acted on as usual', async () => {
    installNitroGlobals(async (url: string) => {
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products_files')) return { data: [] }
      if (url.includes('/items/products/')) return { data: { name_en: 'Test product' } }
      return { data: null }
    })
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as (e: unknown) => Promise<{ ok: boolean, error?: string }>

    const event = mockEvent({
      url: GENERATE_PATH,
      method: 'POST',
      routerParams: { id: '3' },
      headers: { origin: 'http://localhost:3000' },
      // A body carrying refs this server never minted: it parses fine (the
      // point of this test) and is then refused on its merits, not its size.
      requestStream: Readable.from([JSON.stringify({ providerId: 'deepseek', sourceRefs: ['not-a-real-ref'] })]),
    })
    event.context.adminToken = 'admin-token'
    event.context.adminUserId = 'admin-1'

    const result = await handler(event)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('This selection is no longer valid. Reload the page and choose the files again.')
  })

  it('a body that is not valid JSON is refused as a bad request, never parsed into undefined behaviour', async () => {
    const status = await runGenerate({ bodyChunks: ['{ this is not json'] })
    expect(status).toBe(400)
  })

  it('the limit this suite exercises is the one the handler actually enforces', async () => {
    installNitroGlobals(async () => ({}))
    const mod = await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')
    expect(mod.MAX_GENERATE_BODY_BYTES).toBe(MAX_GENERATE_BODY_BYTES)
  })

  it('the handler never calls readBody — the byte-limited reader is the only body path', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/admin/products/[id]/ai/specification-proposal/generate.post.ts'),
      'utf8',
    )
    const code = source.split('\n').filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/\breadBody\s*\(/)
    expect(code).toContain('readJsonBodyWithByteLimit')
  })
})
