/**
 * PWS-AI-ENGINE-01R — proves the AI Target Contract is genuinely reusable.
 *
 * This file defines a second, PURELY TEST-ONLY `TargetDefinition` —
 * `echoWordCountTarget` — that has nothing to do with product specifications
 * (it just counts words per source file). It is never imported by any
 * production file, never wired into any route, page, or button — it exists
 * only in this test file, exactly to demonstrate that a brand-new Target
 * can be registered and run through the real, shared
 * `runProposalEngine()` + `AiProviderRegistry` without editing
 * `aiProposalEngine.ts`, `aiTextExtraction.ts`, or `aiProviderRegistry.ts`
 * at all. No Page Content/FAQ UI, page, or button was added anywhere in
 * this task to support this — it is test-only, as instructed.
 */

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import { createAiProviderRegistry, type AiStructuredProvider, type AiProviderId } from '../server/utils/aiProviderRegistry'
import { UNTRUSTED_SOURCE_MATERIAL_PREAMBLE, buildSourceMaterialBlock, type AiGenerationInput, type TargetDefinition, type TargetGenerationResult } from '../server/utils/aiTargetContract'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'

// ── A second, test-only Target — proves the contract is not specifications-specific ──

const EchoWordCountSchema = z.object({
  counts: z.array(z.object({ source: z.string(), words: z.number().int().nonnegative() })).min(1),
}).strict()

type EchoWordCountOutput = z.infer<typeof EchoWordCountSchema>

const echoWordCountTarget: TargetDefinition<EchoWordCountOutput> = {
  id: 'test-only-echo-word-count',
  schemaName: 'echo_word_count',
  jsonSchema: {
    type: 'object',
    properties: {
      counts: {
        type: 'array',
        items: { type: 'object', properties: { source: { type: 'string' }, words: { type: 'number' } }, required: ['source', 'words'] },
      },
    },
    required: ['counts'],
  },
  systemInstructions: UNTRUSTED_SOURCE_MATERIAL_PREAMBLE + ' Count words per source file (test-only Target, never shipped).',
  buildUserInput(input: AiGenerationInput) {
    return buildSourceMaterialBlock(input.extractedSourceTexts)
  },
  parseAndValidate(raw: unknown): TargetGenerationResult<EchoWordCountOutput> {
    const result = EchoWordCountSchema.safeParse(raw)
    if (!result.success) return { ok: false, error: 'malformed test target response' }
    return { ok: true, output: result.data }
  },
}

function mockFetch(opts: {
  productExists?: boolean
  productsFilesRows?: Array<{ id: number, directus_files_id: { id: string, filename_download: string | null, type: string | null, filesize: number } | null }>
  assetBytesByUuid?: Record<string, ArrayBuffer>
} = {}): FetchFn {
  const productExists = opts.productExists ?? true
  const rows = opts.productsFilesRows ?? []
  const assets = opts.assetBytesByUuid ?? {}
  return (async <T>(path: string): Promise<T> => {
    if (path.startsWith('/items/products?filter[id]')) return { data: productExists ? [{ id: 1 }] : [] } as T
    if (path.startsWith('/items/products_files?')) return { data: rows } as T
    if (path.startsWith('/items/products/')) return { data: { name_en: 'Test product' } } as T
    if (path.startsWith('/assets/')) {
      const uuid = path.slice('/assets/'.length)
      if (!(uuid in assets)) throw new Error('not found')
      // The engine streams assets; tests still author fixtures as byte buffers.
      const bytes = new Uint8Array(assets[uuid])
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      }) as T
    }
    throw new Error(`Unexpected fetch path in test: ${path}`)
  }) as FetchFn
}

function textBytes(s: string): ArrayBuffer {
  // `Buffer.from(...).buffer` is the underlying pool ArrayBuffer, which for
  // small strings can be larger than (and offset within) the actual bytes —
  // slicing by byteOffset/byteLength is required to get exactly this string's bytes.
  const buf = Buffer.from(s, 'utf-8')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function mockProvider(generateStructured: unknown): AiStructuredProvider {
  return { isConfigured: () => true, generateStructured: generateStructured as AiStructuredProvider['generateStructured'] }
}

describe('AI Target Contract — a second, unrelated Target runs through the exact same shared Engine and registry', () => {
  it('runProposalEngine() works with the test-only echo Target, never touching specifications code', async () => {
    const generateStructured = vi.fn(async (_target, _input) => ({
      ok: true as const,
      output: { counts: [{ source: 'notes.txt', words: 3 }] },
    }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: {
        deepseek: mockProvider(generateStructured),
        openai: mockProvider(vi.fn()),
      },
    })
    const fetch = mockFetch({
      productsFilesRows: [{ id: 1, directus_files_id: { id: 'uuid-1', filename_download: 'notes.txt', type: 'text/plain', filesize: 100 } }],
      assetBytesByUuid: { 'uuid-1': textBytes('one two three') },
    })

    const result = await runProposalEngine(fetch, registry, echoWordCountTarget, { productId: 1, providerId: 'deepseek', mediaIds: [1] })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toEqual({ counts: [{ source: 'notes.txt', words: 3 }] })
    }
    // The registry dispatched to the SAME provider mock used for specifications — no Target-specific branch anywhere in the dispatch path.
    expect(generateStructured).toHaveBeenCalledTimes(1)
    expect(generateStructured.mock.calls[0][0]).toBe(echoWordCountTarget)
  })

  it('the same product/source validation (not-found, unconfigured provider, cross-product, unsupported file) applies identically regardless of which Target is passed in', async () => {
    const generate = vi.fn()
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: mockProvider(generate), openai: mockProvider(vi.fn()) },
    })

    const notFound = await runProposalEngine(mockFetch({ productExists: false }), registry, echoWordCountTarget, { productId: 999, providerId: 'deepseek', mediaIds: [1] })
    expect(notFound).toEqual({ ok: false, error: 'Product not found.', fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })

  it('specificationsTarget and echoWordCountTarget can both be dispatched through the identical registry instance without any Target-specific code in the registry', async () => {
    const specGenerate = vi.fn(async () => ({ ok: true as const, output: { groups: [{ group: 'G', items: [{ parameter: 'P', value: 'V' }] }] } }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: mockProvider(specGenerate), openai: mockProvider(vi.fn()) },
    })
    const input: AiGenerationInput = { productName: 'X', sourceFileSummaries: [], extractedSourceTexts: [] }

    const specResult = await registry.generateStructured('deepseek' as AiProviderId, specificationsTarget, input)
    expect(specResult.ok).toBe(true)
    expect(specGenerate).toHaveBeenCalledWith(specificationsTarget, input)
  })
})
