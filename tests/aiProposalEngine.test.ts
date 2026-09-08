/**
 * PWS-AI-ENGINE-01R — reusable server-side AI Proposal Engine. Every test
 * here injects a mock `fetch` (mimicking Directus responses) and a mock
 * `AiProviderRegistry` — no real network call, no real Directus, and no
 * real OpenAI/DeepSeek call happens anywhere in this file. Uses the real
 * `specificationsTarget` as the Target under test (its own contract is
 * covered separately in `aiTargetContract.test.ts` with an unrelated
 * second Target).
 */

import { describe, it, expect, vi } from 'vitest'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import type { AiProviderRegistry, AiProviderSummary, AiStructuredProvider } from '../server/utils/aiProviderRegistry'
import { specificationsTarget, type SpecificationProposal } from '../server/utils/aiTargets/specificationsTarget'

const VALID_PROPOSAL: SpecificationProposal = {
  groups: [{ group: 'Detection performance', items: [{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }] }],
}

/**
 * `generateStructured` is intentionally typed as `unknown` here (not
 * `AiProviderRegistry['generateStructured']`) — that generic method type
 * cannot structurally match a concrete `vi.fn(async () => ...)` mock
 * without a cast at every call site. It is cast back to the real type once,
 * below, since every test in this file only ever passes a same-shaped mock.
 */
function mockRegistry(overrides: { generateStructured?: unknown } = {}): AiProviderRegistry {
  const summaries: AiProviderSummary[] = [
    { id: 'deepseek', label: 'DeepSeek', configured: true },
    { id: 'openai', label: 'OpenAI', configured: false },
  ]
  const generateStructured = (overrides.generateStructured
    ?? vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))) as AiProviderRegistry['generateStructured']
  return {
    getProvider: () => ({ isConfigured: () => true, generateStructured: async () => ({ ok: true as const, output: VALID_PROPOSAL }) }) as AiStructuredProvider,
    listConfiguredProviders: () => summaries,
    getDefaultProvider: () => 'deepseek',
    generateStructured,
  }
}

/** Builds a mock Directus `fetch` that answers the exact endpoints the engine calls. */
function mockFetch(opts: {
  productExists?: boolean
  productsFilesRows?: Array<{ id: number, directus_files_id: { id: string, filename_download: string | null, type: string | null, filesize?: number | null } | null }>
  assetBytesByUuid?: Record<string, ArrayBuffer | 'throw'>
  productName?: string
} = {}): FetchFn {
  const productExists = opts.productExists ?? true
  const rows = opts.productsFilesRows ?? []
  const assets = opts.assetBytesByUuid ?? {}

  return (async <T>(path: string): Promise<T> => {
    if (path.startsWith('/items/products?filter[id]')) {
      return { data: productExists ? [{ id: 1 }] : [] } as T
    }
    if (path.startsWith('/items/products_files?')) {
      return { data: rows } as T
    }
    if (path.startsWith('/items/products/')) {
      return { data: { name_en: opts.productName ?? 'LT-180C Free-Fall Metal Detector' } } as T
    }
    if (path.startsWith('/assets/')) {
      const uuid = path.slice('/assets/'.length)
      const entry = assets[uuid]
      if (entry === 'throw' || entry === undefined) throw new Error('asset fetch failed')
      return entry as T
    }
    throw new Error(`Unexpected fetch path in test: ${path}`)
  }) as FetchFn
}

function textBytes(s: string): ArrayBuffer {
  return Buffer.from(s, 'utf-8').buffer as ArrayBuffer
}

const SMALL_SIZE = 100 // well under MAX_FILE_BYTES

describe('runProposalEngine — product and provider validation', () => {
  it('fails safely when the product does not exist', async () => {
    const result = await runProposalEngine(
      mockFetch({ productExists: false }), mockRegistry(), specificationsTarget,
      { productId: 999, providerId: 'deepseek', mediaIds: [1] },
    )
    expect(result).toEqual({ ok: false, error: 'Product not found.', fileResults: [] })
  })

  it('rejects an unknown/invalid provider id without calling the registry\'s generate function', async () => {
    const generate = vi.fn()
    const result = await runProposalEngine(
      mockFetch(), mockRegistry({ generateStructured: generate }), specificationsTarget,
      { productId: 1, providerId: 'anthropic', mediaIds: [1] },
    )
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.', fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('fails closed when the requested provider is not configured, even if the id is valid', async () => {
    const generate = vi.fn()
    const result = await runProposalEngine(
      mockFetch(), mockRegistry({ generateStructured: generate }), specificationsTarget,
      { productId: 1, providerId: 'openai', mediaIds: [1] }, // openai is configured:false in mockRegistry()
    )
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.', fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('rejects an empty or missing mediaIds selection', async () => {
    const r1 = await runProposalEngine(mockFetch(), mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [] })
    expect(r1).toEqual({ ok: false, error: 'Select at least one source file to analyze.', fileResults: [] })
    const r2 = await runProposalEngine(mockFetch(), mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: 'not-an-array' })
    expect(r2).toEqual({ ok: false, error: 'Select at least one source file to analyze.', fileResults: [] })
  })

  it('enforces the max-files-per-request cap', async () => {
    const result = await runProposalEngine(
      mockFetch(), mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1, 2, 3, 4, 5, 6] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('at most')
  })
})

describe('runProposalEngine — current product / selected source re-verification', () => {
  it('a mediaId that does not resolve to a row of this product is reported unreadable, and never echoes the requested id back', async () => {
    const fetch = mockFetch({ productsFilesRows: [] }) // nothing belongs to this product
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [42] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fileResults).toEqual([
        { displayName: 'Selected file', status: 'unreadable', reason: 'One of the selected files could not be used for this product.' },
      ])
      // The literal requested id must never appear anywhere in the response.
      expect(JSON.stringify(result)).not.toContain('42')
    }
  })

  it('a disabled products_files row (enabled=false) is treated the same as "not associated" — the filter excludes it server-side', async () => {
    // The mock fetch always answers filter[enabled][_eq]=true queries with whatever rows were configured;
    // a real disabled row would simply never appear in `productsFilesRows` for such a query.
    const fetch = mockFetch({ productsFilesRows: [] })
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [7] })
    expect(result.ok).toBe(false)
  })

  it('never trusts a raw file UUID from the caller — only products_files.id values are ever looked up, filtered to enabled=true', async () => {
    const calledPaths: string[] = []
    const inner = mockFetch({
      productsFilesRows: [{ id: 7, directus_files_id: { id: 'uuid-1', filename_download: 'notes.txt', type: 'text/plain', filesize: SMALL_SIZE } }],
      assetBytesByUuid: { 'uuid-1': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const fetch: FetchFn = (path, options) => { calledPaths.push(path); return inner(path, options) }
    await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [7] })
    const productsFilesCall = calledPaths.find(p => p.startsWith('/items/products_files?'))
    expect(productsFilesCall).toContain('filter[products_id][_eq]=1')
    expect(productsFilesCall).toContain('filter[id][_in]=7')
    expect(productsFilesCall).toContain('filter[enabled][_eq]=true')
  })
})

describe('runProposalEngine — trusted-metadata size pre-check happens before any download', () => {
  it('a file whose known size exceeds the limit is refused without ever calling /assets/', async () => {
    const calledPaths: string[] = []
    const inner = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-huge', filename_download: 'huge.txt', type: 'text/plain', filesize: 50 * 1024 * 1024 } }],
    })
    const fetch: FetchFn = (path, options) => { calledPaths.push(path); return inner(path, options) }
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fileResults[0].status).toBe('unreadable')
      expect(result.fileResults[0].reason).toContain('too large')
    }
    expect(calledPaths.some(p => p.startsWith('/assets/'))).toBe(false)
  })

  it('a file with unknown size (filesize null) is refused without ever calling /assets/', async () => {
    const calledPaths: string[] = []
    const inner = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-unknown', filename_download: 'mystery.txt', type: 'text/plain', filesize: null } }],
    })
    const fetch: FetchFn = (path, options) => { calledPaths.push(path); return inner(path, options) }
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    expect(calledPaths.some(p => p.startsWith('/assets/'))).toBe(false)
  })
})

describe('runProposalEngine — honest per-file outcomes', () => {
  it('an unsupported file type is reported, never silently included or faked as readable', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg', filesize: SMALL_SIZE } }],
    })
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fileResults).toEqual([
        { displayName: 'photo.jpg', status: 'unsupported', reason: 'Not available for text-source analysis yet.' },
      ])
    }
  })

  it('an Excel file gets its own distinct "not supported yet" reason, not the generic one', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-xls', filename_download: 'sheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filesize: SMALL_SIZE } }],
    })
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fileResults[0].reason).toBe('Excel files are not supported for text-source analysis yet.')
  })

  it('a file that cannot be downloaded is reported unreadable, never throws out of the engine', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-1', filename_download: 'broken.txt', type: 'text/plain', filesize: SMALL_SIZE } }],
      assetBytesByUuid: { 'uuid-1': 'throw' },
    })
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fileResults[0]).toEqual({ displayName: 'broken.txt', status: 'unreadable', reason: 'This file could not be read.' })
  })

  it('when no selected file is readable, the provider is never called', async () => {
    const generate = vi.fn()
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg', filesize: SMALL_SIZE } }],
    })
    const result = await runProposalEngine(fetch, mockRegistry({ generateStructured: generate }), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('None of the selected files could be read as text. Nothing was sent to the AI provider.')
    expect(generate).not.toHaveBeenCalled()
  })

  it('a mix of one readable and one unsupported file still analyzes the readable one and reports both outcomes', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [
        { id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain', filesize: SMALL_SIZE } },
        { id: 2, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg', filesize: SMALL_SIZE } },
      ],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const result = await runProposalEngine(fetch, mockRegistry({ generateStructured: generate }), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1, 2] })
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    if (result.ok) {
      expect(result.fileResults).toEqual(expect.arrayContaining([
        { displayName: 'notes.txt', status: 'read' },
        { displayName: 'photo.jpg', status: 'unsupported', reason: 'Not available for text-source analysis yet.' },
      ]))
    }
  })
})

describe('runProposalEngine — single dispatch, structured validation, no leakage', () => {
  it('calls generateStructured exactly once for a successful analysis, with the Target passed through unchanged', async () => {
    const generate = vi.fn(async (_providerId: unknown, _target: unknown, _input: unknown) => ({ ok: true as const, output: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain', filesize: SMALL_SIZE } }],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const result = await runProposalEngine(fetch, mockRegistry({ generateStructured: generate }), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(generate).toHaveBeenCalledTimes(1)
    // mockRegistry({generateStructured}) overrides the REGISTRY-level function, whose signature is (providerId, target, input).
    expect(generate.mock.calls[0][0]).toBe('deepseek')
    expect(generate.mock.calls[0][1]).toBe(specificationsTarget)
    expect(result).toEqual({
      ok: true,
      output: VALID_PROPOSAL,
      fileResults: [{ displayName: 'notes.txt', status: 'read' }],
    })
  })

  it('propagates a malformed-structure failure from the registry as a safe, short error', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain', filesize: SMALL_SIZE } }],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const registry = mockRegistry({
      generateStructured: async () => ({ ok: false, error: 'The AI provider returned a response that could not be safely used.' }),
    })
    const result = await runProposalEngine(fetch, registry, specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result).toEqual({
      ok: false,
      error: 'The AI provider returned a response that could not be safely used.',
      fileResults: [{ displayName: 'notes.txt', status: 'read' }],
    })
  })

  it('never includes a UUID, path, download URL, or raw extracted text anywhere in a successful result', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'super-secret-uuid-1234', filename_download: 'notes.txt', type: 'text/plain', filesize: SMALL_SIZE } }],
      assetBytesByUuid: { 'super-secret-uuid-1234': textBytes('THE RAW CONFIDENTIAL DATASHEET TEXT') },
    })
    const result = await runProposalEngine(fetch, mockRegistry(), specificationsTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('super-secret-uuid-1234')
    expect(serialized).not.toContain('THE RAW CONFIDENTIAL DATASHEET TEXT')
    expect(serialized).not.toContain('/assets/')
  })
})
