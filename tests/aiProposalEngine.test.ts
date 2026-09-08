/**
 * PWS-AI-ENGINE-01 — reusable server-side AI Proposal Engine. Every test
 * here injects a mock `fetch` (mimicking Directus responses) and a mock
 * `AiProviderRegistry` — no real network call, no real Directus, and no
 * real OpenAI/DeepSeek call happens anywhere in this file.
 */

import { describe, it, expect, vi } from 'vitest'
import { runSpecificationProposalEngine } from '../server/utils/aiProposalEngine'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import type { AiProviderRegistry, AiProviderSummary } from '../server/utils/aiProviderRegistry'

const VALID_PROPOSAL = {
  groups: [{ group: 'Detection performance', items: [{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }] }],
}

function mockRegistry(overrides: Partial<AiProviderRegistry> = {}): AiProviderRegistry {
  const summaries: AiProviderSummary[] = [
    { id: 'deepseek', label: 'DeepSeek', configured: true },
    { id: 'openai', label: 'OpenAI', configured: false },
  ]
  return {
    getProvider: () => ({ isConfigured: () => true, generateSpecificationProposal: async () => ({ ok: true as const, proposal: VALID_PROPOSAL }) }),
    listConfiguredProviders: () => summaries,
    getDefaultProvider: () => 'deepseek',
    generateSpecificationProposal: vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL })),
    ...overrides,
  }
}

/** Builds a mock Directus `fetch` that answers the exact endpoints the engine calls. */
function mockFetch(opts: {
  productExists?: boolean
  productsFilesRows?: Array<{ id: number, directus_files_id: { id: string, filename_download: string | null, type: string | null } | null }>
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

describe('runSpecificationProposalEngine — product and provider validation', () => {
  it('fails safely when the product does not exist', async () => {
    const result = await runSpecificationProposalEngine(
      mockFetch({ productExists: false }), mockRegistry(),
      { productId: 999, providerId: 'deepseek', mediaIds: [1] },
    )
    expect(result).toEqual({ ok: false, error: 'Product not found.', fileResults: [] })
  })

  it('rejects an unknown/invalid provider id without calling the registry\'s generate function', async () => {
    const generate = vi.fn()
    const result = await runSpecificationProposalEngine(
      mockFetch(), mockRegistry({ generateSpecificationProposal: generate }),
      { productId: 1, providerId: 'anthropic', mediaIds: [1] },
    )
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.', fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('fails closed when the requested provider is not configured, even if the id is valid', async () => {
    const generate = vi.fn()
    const result = await runSpecificationProposalEngine(
      mockFetch(), mockRegistry({ generateSpecificationProposal: generate }),
      { productId: 1, providerId: 'openai', mediaIds: [1] }, // openai is configured:false in mockRegistry()
    )
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.', fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('rejects an empty or missing mediaIds selection', async () => {
    const r1 = await runSpecificationProposalEngine(mockFetch(), mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [] })
    expect(r1).toEqual({ ok: false, error: 'Select at least one source file to analyze.', fileResults: [] })
    const r2 = await runSpecificationProposalEngine(mockFetch(), mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: 'not-an-array' })
    expect(r2).toEqual({ ok: false, error: 'Select at least one source file to analyze.', fileResults: [] })
  })

  it('enforces the max-files-per-request cap', async () => {
    const result = await runSpecificationProposalEngine(
      mockFetch(), mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [1, 2, 3, 4, 5, 6] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('at most')
  })
})

describe('runSpecificationProposalEngine — current product / selected source re-verification', () => {
  it('a mediaId that does not resolve to a row of this product is reported unreadable, never silently dropped', async () => {
    const fetch = mockFetch({ productsFilesRows: [] }) // nothing belongs to this product
    const result = await runSpecificationProposalEngine(fetch, mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [42] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fileResults).toEqual([
        { displayName: 'Selection #42', status: 'unreadable', reason: 'This file is not associated with this product.' },
      ])
    }
  })

  it('never trusts a raw file UUID from the caller — only products_files.id values are ever looked up', async () => {
    const calledPaths: string[] = []
    const inner = mockFetch({
      productsFilesRows: [{ id: 7, directus_files_id: { id: 'uuid-1', filename_download: 'notes.txt', type: 'text/plain' } }],
      assetBytesByUuid: { 'uuid-1': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const fetch: FetchFn = (path, options) => { calledPaths.push(path); return inner(path, options) }
    await runSpecificationProposalEngine(fetch, mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [7] })
    const productsFilesCall = calledPaths.find(p => p.startsWith('/items/products_files?'))
    expect(productsFilesCall).toContain('filter[products_id][_eq]=1')
    expect(productsFilesCall).toContain('filter[id][_in]=7')
  })
})

describe('runSpecificationProposalEngine — honest per-file outcomes', () => {
  it('an unsupported file type is reported, never silently included or faked as readable', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg' } }],
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fileResults).toEqual([
        { displayName: 'photo.jpg', status: 'unsupported', reason: 'Not available for text-source analysis yet.' },
      ])
    }
  })

  it('a file that cannot be downloaded is reported unreadable, never throws out of the engine', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-1', filename_download: 'broken.pdf', type: 'application/pdf' } }],
      assetBytesByUuid: { 'uuid-1': 'throw' },
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fileResults[0]).toEqual({ displayName: 'broken.pdf', status: 'unreadable', reason: 'This file could not be read.' })
  })

  it('when no selected file is readable, the provider is never called', async () => {
    const generate = vi.fn()
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg' } }],
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry({ generateSpecificationProposal: generate }), { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('None of the selected files could be read as text. Nothing was sent to the AI provider.')
    expect(generate).not.toHaveBeenCalled()
  })

  it('a mix of one readable and one unsupported file still analyzes the readable one and reports both outcomes', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [
        { id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain' } },
        { id: 2, directus_files_id: { id: 'uuid-img', filename_download: 'photo.jpg', type: 'image/jpeg' } },
      ],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry({ generateSpecificationProposal: generate }), { productId: 1, providerId: 'deepseek', mediaIds: [1, 2] })
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

describe('runSpecificationProposalEngine — single dispatch, structured validation, no leakage', () => {
  it('calls generateSpecificationProposal exactly once for a successful analysis', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain' } }],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry({ generateSpecificationProposal: generate }), { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      proposal: VALID_PROPOSAL,
      fileResults: [{ displayName: 'notes.txt', status: 'read' }],
    })
  })

  it('propagates a malformed-structure failure from the registry as a safe, short error', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-txt', filename_download: 'notes.txt', type: 'text/plain' } }],
      assetBytesByUuid: { 'uuid-txt': textBytes('Detection sensitivity (Fe): 0.8 mm') },
    })
    const registry = mockRegistry({
      generateSpecificationProposal: async () => ({ ok: false, error: 'The AI provider returned a response that could not be safely used.' }),
    })
    const result = await runSpecificationProposalEngine(fetch, registry, { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    expect(result).toEqual({
      ok: false,
      error: 'The AI provider returned a response that could not be safely used.',
      fileResults: [{ displayName: 'notes.txt', status: 'read' }],
    })
  })

  it('never includes a UUID, path, download URL, or raw extracted text anywhere in a successful result', async () => {
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'super-secret-uuid-1234', filename_download: 'notes.txt', type: 'text/plain' } }],
      assetBytesByUuid: { 'super-secret-uuid-1234': textBytes('THE RAW CONFIDENTIAL DATASHEET TEXT') },
    })
    const result = await runSpecificationProposalEngine(fetch, mockRegistry(), { productId: 1, providerId: 'deepseek', mediaIds: [1] })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('super-secret-uuid-1234')
    expect(serialized).not.toContain('THE RAW CONFIDENTIAL DATASHEET TEXT')
    expect(serialized).not.toContain('/assets/')
  })
})
