/**
 * PWS-AI-DUP-GUARD-01 — content dedupe, analysis reuse, and Apply idempotency.
 *
 * The guards that already existed stop the easy cases; these tests are about
 * the ones they cannot see. Two files carrying the same text under different
 * ids look like two sources to id-level dedupe. An identical analysis run a
 * minute later is a fresh request by every existing measure, and a second
 * bill. And a disabled Apply button cannot help a request that already left
 * the browser.
 *
 * Every provider is a mock and every Directus call is a mock. No real network
 * call is made and no API cost is incurred.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import {
  buildAnalysisFingerprint,
  digestSourceText,
  lookupAnalysis,
  rememberAnalysis,
  claimApply,
  settleApply,
  releaseApply,
  resetProposalGuard,
  SUCCESS_REUSE_TTL_MS,
  PROPOSAL_APPLY_TTL_MS,
  MAX_CACHED_ANALYSES,
  MAX_TRACKED_PROPOSALS,
} from '../server/utils/aiProposalReplayGuard'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import type { AiProviderRegistry } from '../server/utils/aiProviderRegistry'

const VALID_PROPOSAL = {
  groups: [{ group: 'Detection performance', items: [{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }] }],
}

const SMALL_SIZE = 2048

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** A ReadableStream of the given bytes — the engine streams assets, so fixtures have to as well. */
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

interface MockFetchOptions {
  productsFilesRows: Array<Record<string, unknown>>
  assetBytesByUuid: Record<string, Uint8Array>
  productName?: string
}

/** A Directus stand-in answering exactly the endpoints the engine calls. */
function mockFetch(options: MockFetchOptions): FetchFn {
  return (async <T>(path: string): Promise<T> => {
    if (path.startsWith('/items/products?filter[id]')) return { data: [{ id: 1 }] } as T
    if (path.startsWith('/items/products_files?')) return { data: options.productsFilesRows } as T
    if (path.startsWith('/items/products/')) return { data: { name_en: options.productName ?? 'LT-180C' } } as T
    if (path.startsWith('/assets/')) {
      const uuid = path.slice('/assets/'.length)
      const bytes = options.assetBytesByUuid[uuid]
      if (!bytes) throw new Error('asset fetch failed')
      return streamOf(bytes) as T
    }
    throw new Error(`Unexpected fetch path in test: ${path}`)
  }) as FetchFn
}

function mockRegistry(generateStructured: ReturnType<typeof vi.fn>): AiProviderRegistry {
  return {
    getProvider: () => ({ isConfigured: () => true, generateStructured: async () => ({ ok: true as const, output: VALID_PROPOSAL }) }),
    listConfiguredProviders: () => [
      { id: 'deepseek', label: 'DeepSeek', configured: true },
      { id: 'openai', label: 'OpenAI', configured: false },
    ],
    getDefaultProvider: () => 'deepseek',
    generateStructured,
  } as unknown as AiProviderRegistry
}

/** A row whose file serves `text`, addressed by a distinct Directus id. */
function row(id: number, uuid: string, filename: string) {
  return { id, directus_files_id: { id: uuid, filename_download: filename, type: 'text/plain', filesize: SMALL_SIZE } }
}

beforeEach(() => {
  resetProposalGuard()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetProposalGuard()
})

// ── B. Content-level dedupe ──

describe('identical source content is only sent to the provider once', () => {
  const SHARED_TEXT = 'Detection sensitivity (Fe): 0.8 mm\nProtection class: IP54'

  it('two files with different ids but identical text produce one prompt source', async () => {
    const generate = vi.fn(async (_providerId: unknown, _target: unknown, _input: unknown) => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [row(1, 'uuid-a', 'LT180C-spec.txt'), row(2, 'uuid-b', 'LT180C-spec-copy.txt')],
      assetBytesByUuid: { 'uuid-a': textBytes(SHARED_TEXT), 'uuid-b': textBytes(SHARED_TEXT) },
    })

    const result = await runProposalEngine(fetch, mockRegistry(generate), specificationsTarget, {
      productId: 1, providerId: 'deepseek', mediaIds: [1, 2],
    })

    expect(result.ok).toBe(true)
    // The prompt carries one source, not two copies of the same document.
    const input = generate.mock.calls[0][2] as unknown as { extractedSourceTexts: Array<{ text: string }> }
    expect(input.extractedSourceTexts).toHaveLength(1)

    expect(result.fileResults).toEqual([
      { displayName: 'LT180C-spec.txt', status: 'read' },
      { displayName: 'LT180C-spec-copy.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' },
    ])
  })

  it('three files where A equals B sends A and C only', async () => {
    const generate = vi.fn(async (_providerId: unknown, _target: unknown, _input: unknown) => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [row(1, 'uuid-a', 'a.txt'), row(2, 'uuid-b', 'b.txt'), row(3, 'uuid-c', 'c.txt')],
      assetBytesByUuid: {
        'uuid-a': textBytes(SHARED_TEXT),
        'uuid-b': textBytes(SHARED_TEXT),
        'uuid-c': textBytes('Rated power: 0.45 kW'),
      },
    })

    await runProposalEngine(fetch, mockRegistry(generate), specificationsTarget, {
      productId: 1, providerId: 'deepseek', mediaIds: [1, 2, 3],
    })

    const input = generate.mock.calls[0][2] as unknown as { extractedSourceTexts: Array<{ displayName: string, text: string }> }
    expect(input.extractedSourceTexts).toHaveLength(2)
    // Prompt labels stay contiguous — the skipped duplicate leaves no gap.
    expect(input.extractedSourceTexts.map(s => s.displayName)).toEqual(['Source 1', 'Source 2'])
  })

  it('a duplicate is reported as a duplicate, never as an error', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [row(1, 'uuid-a', 'a.txt'), row(2, 'uuid-b', 'b.txt')],
      assetBytesByUuid: { 'uuid-a': textBytes(SHARED_TEXT), 'uuid-b': textBytes(SHARED_TEXT) },
    })

    const result = await runProposalEngine(fetch, mockRegistry(generate), specificationsTarget, {
      productId: 1, providerId: 'deepseek', mediaIds: [1, 2],
    })

    const duplicate = result.fileResults.find(f => f.status === 'duplicate')!
    expect(duplicate.status).not.toBe('unreadable')
    expect(duplicate.status).not.toBe('unsupported')
    expect(result.ok).toBe(true)
  })

  it('neither the digest nor the source text reaches the browser payload', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [row(1, 'uuid-a', 'a.txt'), row(2, 'uuid-b', 'b.txt')],
      assetBytesByUuid: { 'uuid-a': textBytes(SHARED_TEXT), 'uuid-b': textBytes(SHARED_TEXT) },
    })

    const result = await runProposalEngine(fetch, mockRegistry(generate), specificationsTarget, {
      productId: 1, providerId: 'deepseek', mediaIds: [1, 2],
    })

    const serializedFileResults = JSON.stringify(result.fileResults)
    expect(serializedFileResults).not.toContain(digestSourceText(SHARED_TEXT))
    expect(serializedFileResults).not.toContain('Detection sensitivity')
    expect(serializedFileResults).not.toMatch(/[0-9a-f]{64}/)
  })
})

// ── C. Analysis fingerprint ──

describe('the analysis fingerprint identifies the work, not the clicks', () => {
  const base = { productId: 3, targetId: 'specifications', providerId: 'deepseek', productName: 'LT-180C' }

  it('the same sources in a different order produce the same fingerprint', () => {
    const a = buildAnalysisFingerprint({ ...base, sourceDigests: ['aaa', 'bbb', 'ccc'] })
    const b = buildAnalysisFingerprint({ ...base, sourceDigests: ['ccc', 'aaa', 'bbb'] })
    expect(a).toBe(b)
  })

  it('changed source content produces a different fingerprint', () => {
    const before = buildAnalysisFingerprint({ ...base, sourceDigests: ['aaa', 'bbb'] })
    const after = buildAnalysisFingerprint({ ...base, sourceDigests: ['aaa-v2', 'bbb'] })
    expect(after).not.toBe(before)
  })

  it.each([
    ['product', { productId: 4 }],
    ['target', { targetId: 'something-else' }],
    ['provider', { providerId: 'openai' }],
    ['product name', { productName: 'A different product' }],
  ])('a different %s produces a different fingerprint', (_label, override) => {
    const a = buildAnalysisFingerprint({ ...base, sourceDigests: ['aaa'] })
    const b = buildAnalysisFingerprint({ ...base, ...override, sourceDigests: ['aaa'] })
    expect(b).not.toBe(a)
  })

  it('the fingerprint is a plain digest — no filename, id or source text in it', () => {
    const fp = buildAnalysisFingerprint({ ...base, sourceDigests: ['aaa'] })
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ── D. Short-term reuse of a validated analysis ──

describe('an identical analysis is served from cache instead of billed again', () => {
  const SOURCES = { productsFilesRows: [row(1, 'uuid-a', 'a.txt')], assetBytesByUuid: { 'uuid-a': textBytes('Rated power: 0.45 kW') } }
  const SCOPE = { adminUserId: 'admin-1', productId: 1, targetId: 'specifications', providerId: 'deepseek' }

  /** The reuse hooks the Generate endpoint installs, in miniature. */
  function hooks() {
    let ref: string | null = null
    return {
      hooks: {
        lookup: (fingerprint: string) => {
          const hit = lookupAnalysis<typeof VALID_PROPOSAL>({ ...SCOPE, fingerprint })
          if (!hit) return null
          ref = hit.proposalRef
          return hit.output
        },
        store: () => {},
      },
      remember: (fingerprint: string, output: unknown) => rememberAnalysis({ ...SCOPE, fingerprint }, output),
      reusedRef: () => ref,
    }
  }

  it('the first request calls the provider once; an identical second one does not call it again', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const registry = mockRegistry(generate)
    const h = hooks()

    const first = await runProposalEngine(mockFetch(SOURCES), registry, specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)
    expect(first.ok && first.reused).toBe(false)
    expect(generate).toHaveBeenCalledTimes(1)
    if (first.ok) h.remember(first.fingerprint, first.output)

    const second = await runProposalEngine(mockFetch(SOURCES), registry, specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)

    expect(generate).toHaveBeenCalledTimes(1)
    expect(second.ok && second.reused).toBe(true)
    if (second.ok && first.ok) {
      expect(second.output).toEqual(first.output)
      expect(second.fingerprint).toBe(first.fingerprint)
    }
  })

  it('a cache hit returns the ORIGINAL proposalRef, so it cannot bypass the Apply guard', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const h = hooks()

    const first = await runProposalEngine(mockFetch(SOURCES), mockRegistry(generate), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)
    const originalRef = first.ok ? h.remember(first.fingerprint, first.output) : ''

    await runProposalEngine(mockFetch(SOURCES), mockRegistry(generate), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)

    expect(h.reusedRef()).toBe(originalRef)
  })

  it('an already-applied analysis stays already-applied on the next cache hit', async () => {
    const ref = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-applied' }, VALID_PROPOSAL)
    expect(claimApply(ref, { adminUserId: 'admin-1', productId: 1 }).ok).toBe(true)
    settleApply(ref, { ok: true, appliedCount: 3, totalCount: 3, partial: false, message: 'done' })

    const hit = lookupAnalysis({ ...SCOPE, fingerprint: 'fp-applied' })!
    expect(hit.proposalRef).toBe(ref)
    expect(hit.alreadyApplied).toBe(true)
  })

  it('an expired analysis is gone, and a new provider call is allowed', () => {
    const now = Date.now()
    rememberAnalysis({ ...SCOPE, fingerprint: 'fp-ttl' }, VALID_PROPOSAL, now)

    expect(lookupAnalysis({ ...SCOPE, fingerprint: 'fp-ttl' }, now + SUCCESS_REUSE_TTL_MS - 1000)).not.toBeNull()
    expect(lookupAnalysis({ ...SCOPE, fingerprint: 'fp-ttl' }, now + SUCCESS_REUSE_TTL_MS + 1000)).toBeNull()
  })

  it('a failed generation is never cached as a success', async () => {
    const generate = vi.fn(async () => ({ ok: false as const, error: 'The AI provider could not generate a proposal right now.' }))
    const h = hooks()

    const result = await runProposalEngine(mockFetch(SOURCES), mockRegistry(generate), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)
    expect(result.ok).toBe(false)

    // Nothing was remembered, so the next attempt is free to call the provider.
    const generate2 = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const retry = await runProposalEngine(mockFetch(SOURCES), mockRegistry(generate2), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] }, h.hooks)
    expect(generate2).toHaveBeenCalledTimes(1)
    expect(retry.ok && retry.reused).toBe(false)
  })

  it('another administrator does not get this administrator’s cached analysis', () => {
    rememberAnalysis({ ...SCOPE, fingerprint: 'fp-scoped' }, VALID_PROPOSAL)
    expect(lookupAnalysis({ ...SCOPE, adminUserId: 'someone-else', fingerprint: 'fp-scoped' })).toBeNull()
    expect(lookupAnalysis({ ...SCOPE, productId: 99, fingerprint: 'fp-scoped' })).toBeNull()
    expect(lookupAnalysis({ ...SCOPE, targetId: 'other-target', fingerprint: 'fp-scoped' })).toBeNull()
    expect(lookupAnalysis({ ...SCOPE, providerId: 'openai', fingerprint: 'fp-scoped' })).toBeNull()
  })

  it('the cache is bounded — it cannot grow without limit', () => {
    for (let i = 0; i < MAX_CACHED_ANALYSES + 25; i++) {
      rememberAnalysis({ ...SCOPE, fingerprint: `fp-bulk-${i}` }, VALID_PROPOSAL, Date.now() + i)
    }
    // The most recent entries survive; the ceiling holds.
    expect(lookupAnalysis({ ...SCOPE, fingerprint: `fp-bulk-${MAX_CACHED_ANALYSES + 24}` })).not.toBeNull()
    expect(lookupAnalysis({ ...SCOPE, fingerprint: 'fp-bulk-0' })).toBeNull()
  })
})

// ── E. Apply idempotency, at the guard level ──

describe('a proposal can only be written once', () => {
  const SCOPE = { adminUserId: 'admin-1', productId: 3, targetId: 'specifications', providerId: 'deepseek', fingerprint: 'fp-apply' }
  const BINDING = { adminUserId: 'admin-1', productId: 3 }
  const SUCCESS = { ok: true, appliedCount: 4, totalCount: 4, partial: false, message: 'Applied 4 accepted changes to Draft.' }

  it('the first claim succeeds and the second is refused as already applied', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)

    expect(claimApply(ref, BINDING).ok).toBe(true)
    settleApply(ref, SUCCESS)

    const replay = claimApply(ref, BINDING)
    expect(replay.ok).toBe(false)
    if (!replay.ok && replay.reason === 'terminal') {
      expect(replay.state).toBe('applied')
      // The recorded outcome is replayed rather than the write being re-run.
      expect(replay.appliedResult).toEqual(SUCCESS)
    } else {
      throw new Error('expected a terminal refusal')
    }
  })

  it('a concurrent second claim is refused while the first is still running', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)

    expect(claimApply(ref, BINDING).ok).toBe(true)
    const concurrent = claimApply(ref, BINDING)
    expect(concurrent.ok).toBe(false)
    if (!concurrent.ok) expect(concurrent.reason).toBe('in-progress')
  })

  it('a client that never saw the response and resends gets the recorded result, not a second write', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    claimApply(ref, BINDING)
    settleApply(ref, SUCCESS)

    // The browser lost the response and tried again with the same reference.
    for (let attempt = 0; attempt < 3; attempt++) {
      const retry = claimApply(ref, BINDING)
      expect(retry.ok).toBe(false)
      if (!retry.ok && retry.reason === 'terminal') expect(retry.appliedResult).toEqual(SUCCESS)
    }
  })

  it('a partial write is terminal — replaying it would re-add what already landed', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    claimApply(ref, BINDING)
    const partial = { ok: false, appliedCount: 2, totalCount: 4, partial: true, message: 'Applied 2 of 4 accepted changes before a save error.' }
    settleApply(ref, partial)

    const replay = claimApply(ref, BINDING)
    expect(replay.ok).toBe(false)
    if (!replay.ok && replay.reason === 'terminal') {
      expect(replay.state).toBe('partial')
      expect(replay.appliedResult).toEqual(partial)
    } else {
      throw new Error('expected a terminal refusal')
    }
  })

  it('a run that provably wrote nothing returns the reference to ready', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    claimApply(ref, BINDING)
    settleApply(ref, { ok: false, appliedCount: 0, totalCount: 3, partial: false, message: 'No changes could be saved. Nothing was written to this product.' })

    // The reviewer can correct the request and try again.
    expect(claimApply(ref, BINDING).ok).toBe(true)
  })

  it('a zero-write preflight refusal releases the claim', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    claimApply(ref, BINDING)
    releaseApply(ref)
    expect(claimApply(ref, BINDING).ok).toBe(true)
  })

  it.each([
    ['another product', { adminUserId: 'admin-1', productId: 4 }],
    ['another administrator', { adminUserId: 'admin-2', productId: 3 }],
  ])('a reference presented for %s is refused', (_label, binding) => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    const claim = claimApply(ref, binding)
    expect(claim.ok).toBe(false)
    if (!claim.ok) expect(claim.reason).toBe('unknown')
    // ...and the real owner can still use it.
    expect(claimApply(ref, BINDING).ok).toBe(true)
  })

  it('an expired, unknown, empty or non-string reference is refused', () => {
    const now = Date.now()
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL, now)

    // PWS-AI-DUP-GUARD-01-MIN-01 — expiry here means the APPLY deadline, not
    // the much shorter reuse one.
    expect(claimApply(ref, BINDING, now + PROPOSAL_APPLY_TTL_MS + 1000).ok).toBe(false)
    expect(claimApply('never-minted', BINDING).ok).toBe(false)
    expect(claimApply('', BINDING).ok).toBe(false)
    expect(claimApply(undefined, BINDING).ok).toBe(false)
    expect(claimApply(42, BINDING).ok).toBe(false)
  })

  it('the reference carries nothing derivable about the product or the analysis', () => {
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL)
    // Only meaningful multi-character values are asserted: a single digit would
    // appear in random base64url text by chance and prove nothing.
    expect(ref).not.toContain('admin-1')
    expect(ref).not.toContain('fp-apply')
    expect(ref).not.toContain('specifications')
    expect(ref).not.toContain('deepseek')
    expect(ref.length).toBeGreaterThan(32)

    // Two references minted for different scopes share nothing.
    const other = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-apply-2' }, VALID_PROPOSAL)
    expect(other).not.toBe(ref)
  })
})

// ── E (endpoint level). The real Apply handler refuses a replay with zero writes ──

describe('apply.post.ts — a replayed request performs no additional writes', () => {
  const APPLY_PATH = '/api/admin/products/3/ai/specification-proposal/apply'
  let fetchCalls: Array<{ url: string, options?: Record<string, unknown> }> = []

  function mockEvent(body: unknown) {
    const req = Object.assign(Readable.from([JSON.stringify(body)]), {
      url: APPLY_PATH,
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    const event = {
      path: APPLY_PATH,
      method: 'POST',
      node: { req, res: { setHeader: () => {}, getHeader: () => undefined, end: () => {}, writableEnded: false, statusCode: 200 } },
      context: { params: { id: '3' }, adminToken: 'admin-token', adminUserId: 'admin-1' } as Record<string, unknown>,
    }
    return event as unknown as Parameters<typeof import('h3').getRequestURL>[0] & typeof event
  }

  function installGlobals() {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useRuntimeConfig', () => ({ directusUrl: 'http://directus.test', directusToken: 'server-token' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: Record<string, unknown>) => {
      fetchCalls.push({ url, options })
      const method = String(options?.method ?? 'GET').toUpperCase()
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products/3?fields=status')) return { data: { status: 'draft' } }
      if (url.includes('/items/product_spec_groups?filter')) return { data: [{ id: 5, title_en: 'Detection performance' }] }
      if (url.includes('/items/product_spec_items/')) return { data: { id: 11, value_en: 'old', note_en: null, spec_group_id: { id: 5, product_id: 3 } } }
      if (method === 'POST') return { data: { id: 900 } }
      return { data: null }
    }))
  }

  const writes = () => fetchCalls.filter(c =>
    ['POST', 'PATCH', 'DELETE'].includes(String((c.options as { method?: string } | undefined)?.method ?? 'GET').toUpperCase()),
  )

  beforeEach(() => {
    fetchCalls = []
    installGlobals()
  })

  it('writes once for the first request and nothing at all for an identical replay', async () => {
    const ref = rememberAnalysis(
      { adminUserId: 'admin-1', productId: 3, targetId: 'specifications', providerId: 'deepseek', fingerprint: 'fp-endpoint' },
      VALID_PROPOSAL,
    )
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/apply.post')).default as (e: unknown) => Promise<unknown>
    const body = { proposalRef: ref, changes: [{ action: 'update', specItemId: 11, value: '0.9 mm' }] }

    const first = await handler(mockEvent(body)) as { ok: boolean, appliedCount: number }
    expect(first).toMatchObject({ ok: true, appliedCount: 1 })
    const writesAfterFirst = writes().length
    expect(writesAfterFirst).toBe(1)

    // The same request arrives again — a double click, a second tab, or a
    // retry after a lost response.
    const replay = await handler(mockEvent(body)) as { ok: boolean, appliedCount: number }

    expect(writes().length).toBe(writesAfterFirst)
    expect(replay).toMatchObject({ ok: true, appliedCount: 1 })
  })

  it('a reference that was never minted is refused before any write', async () => {
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/apply.post')).default as (e: unknown) => Promise<unknown>
    const body = { proposalRef: 'not-a-real-reference', changes: [{ action: 'update', specItemId: 11, value: 'x' }] }

    let statusCode: number | undefined
    try {
      await handler(mockEvent(body))
    } catch (err) {
      statusCode = (err as { statusCode?: number }).statusCode
    }

    expect(statusCode).toBe(409)
    expect(writes()).toEqual([])
  })

  it('a reference belonging to another product is refused with zero writes', async () => {
    const ref = rememberAnalysis(
      { adminUserId: 'admin-1', productId: 99, targetId: 'specifications', providerId: 'deepseek', fingerprint: 'fp-other-product' },
      VALID_PROPOSAL,
    )
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/apply.post')).default as (e: unknown) => Promise<unknown>

    let statusCode: number | undefined
    try {
      await handler(mockEvent({ proposalRef: ref, changes: [{ action: 'update', specItemId: 11, value: 'x' }] }))
    } catch (err) {
      statusCode = (err as { statusCode?: number }).statusCode
    }

    expect(statusCode).toBe(409)
    expect(writes()).toEqual([])
  })

  it('a preflight refusal writes nothing and leaves the reference usable', async () => {
    const ref = rememberAnalysis(
      { adminUserId: 'admin-1', productId: 3, targetId: 'specifications', providerId: 'deepseek', fingerprint: 'fp-preflight' },
      VALID_PROPOSAL,
    )
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/apply.post')).default as (e: unknown) => Promise<unknown>

    // An item that belongs to another product: refused during preflight.
    vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: Record<string, unknown>) => {
      fetchCalls.push({ url, options })
      if (url.includes('/items/products?filter[id]')) return { data: [{ id: 3 }] }
      if (url.includes('/items/products/3?fields=status')) return { data: { status: 'draft' } }
      if (url.includes('/items/product_spec_items/')) return { data: { id: 77, value_en: 'x', note_en: null, spec_group_id: { id: 8, product_id: 4 } } }
      return { data: null }
    }))

    await expect(handler(mockEvent({ proposalRef: ref, changes: [{ action: 'update', specItemId: 77, value: 'x' }] }))).rejects.toBeDefined()
    expect(writes()).toEqual([])

    // Still claimable: nothing was written, so the reviewer may correct and retry.
    expect(claimApply(ref, { adminUserId: 'admin-1', productId: 3 }).ok).toBe(true)
  })
})

// ── PWS-AI-DUP-GUARD-01-MIN-01: reuse lifetime and review lifetime are separate ──

/**
 * These two deadlines answer different questions. Reuse is about not paying
 * for the same model call twice. Applying is about a person: they analyse a
 * product, work down thirty proposed parameters, check the conflicts against
 * the real specifications, get interrupted, come back. Sharing one deadline
 * meant their finished review stopped being applicable while it was still on
 * screen — every decision made, and the server had quietly forgotten the
 * reference it needed.
 */
describe('a reviewed proposal outlives the analysis reuse cache', () => {
  const SCOPE = { adminUserId: 'admin-1', productId: 3, targetId: 'specifications', providerId: 'deepseek', fingerprint: 'fp-lifetimes' }
  const BINDING = { adminUserId: 'admin-1', productId: 3 }

  it('eleven minutes after Analyze the reuse cache is cold, but the proposal still applies', () => {
    const t0 = Date.now()
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL, t0)

    const elevenMinutes = t0 + 11 * 60 * 1000
    expect(elevenMinutes - t0).toBeGreaterThan(SUCCESS_REUSE_TTL_MS)

    // The analysis is no longer reusable — a fresh request would pay again.
    expect(lookupAnalysis(SCOPE, elevenMinutes)).toBeNull()

    // ...but the review the person just finished is still applicable.
    expect(claimApply(ref, BINDING, elevenMinutes).ok).toBe(true)
  })

  it('the proposal expires on its own, much later, deadline', () => {
    const t0 = Date.now()
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL, t0)

    expect(PROPOSAL_APPLY_TTL_MS).toBeGreaterThan(SUCCESS_REUSE_TTL_MS)
    // Just inside: still applicable.
    expect(claimApply(ref, BINDING, t0 + PROPOSAL_APPLY_TTL_MS - 60_000).ok).toBe(true)

    const later = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-lifetimes-2' }, VALID_PROPOSAL, t0)
    // Just outside: refused.
    expect(claimApply(later, BINDING, t0 + PROPOSAL_APPLY_TTL_MS + 1000).ok).toBe(false)
  })

  it('filling the reuse cache evicts old analyses but never a pending proposal', () => {
    const t0 = Date.now()
    const pendingRef = rememberAnalysis(SCOPE, VALID_PROPOSAL, t0)

    // Push far past the reuse ceiling with newer analyses.
    for (let i = 0; i < MAX_CACHED_ANALYSES + 20; i++) {
      rememberAnalysis({ ...SCOPE, fingerprint: `fp-flood-${i}` }, VALID_PROPOSAL, t0 + i + 1)
    }

    // The first analysis is gone from the reuse cache, as intended...
    expect(lookupAnalysis(SCOPE, t0 + 1000)).toBeNull()
    // ...and its proposal is untouched, so the reviewer can still apply.
    expect(claimApply(pendingRef, BINDING, t0 + 1000).ok).toBe(true)
  })

  it('an applied proposal still replays with zero additional writes long after the reuse window', () => {
    const t0 = Date.now()
    const ref = rememberAnalysis(SCOPE, VALID_PROPOSAL, t0)
    const success = { ok: true, appliedCount: 5, totalCount: 5, partial: false, message: 'Applied 5 accepted changes to Draft.' }

    expect(claimApply(ref, BINDING, t0).ok).toBe(true)
    settleApply(ref, success, t0)

    const wellPastReuse = t0 + 90 * 60 * 1000
    const replay = claimApply(ref, BINDING, wellPastReuse)
    expect(replay.ok).toBe(false)
    if (!replay.ok && replay.reason === 'terminal') {
      expect(replay.state).toBe('applied')
      expect(replay.appliedResult).toEqual(success)
    } else {
      throw new Error('expected a terminal refusal')
    }
  })

  it('a partial proposal stays terminal long after the reuse window', () => {
    const t0 = Date.now()
    const ref = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-partial-late' }, VALID_PROPOSAL, t0)
    const partial = { ok: false, appliedCount: 2, totalCount: 4, partial: true, message: 'Applied 2 of 4 accepted changes before a save error.' }

    claimApply(ref, BINDING, t0)
    settleApply(ref, partial, t0)

    const wellPastReuse = t0 + 90 * 60 * 1000
    const replay = claimApply(ref, BINDING, wellPastReuse)
    expect(replay.ok).toBe(false)
    if (!replay.ok && replay.reason === 'terminal') {
      expect(replay.state).toBe('partial')
      expect(replay.appliedResult).toEqual(partial)
    } else {
      throw new Error('expected a terminal refusal')
    }
  })

  it('tracked proposals are still bounded — the fix does not trade a leak for a bug', () => {
    const t0 = Date.now()
    const first = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-bound-first' }, VALID_PROPOSAL, t0)

    for (let i = 0; i < MAX_TRACKED_PROPOSALS + 10; i++) {
      rememberAnalysis({ ...SCOPE, fingerprint: `fp-bound-${i}` }, VALID_PROPOSAL, t0 + i + 1)
    }

    // The oldest is evicted by the memory backstop; the newest survive.
    expect(claimApply(first, BINDING, t0 + 1000).ok).toBe(false)
    const newest = rememberAnalysis({ ...SCOPE, fingerprint: 'fp-bound-newest' }, VALID_PROPOSAL, t0 + MAX_TRACKED_PROPOSALS + 100)
    expect(claimApply(newest, BINDING, t0 + MAX_TRACKED_PROPOSALS + 200).ok).toBe(true)
  })
})
