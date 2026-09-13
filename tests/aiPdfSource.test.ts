/**
 * AI-PDF-SOURCE-01 — a PDF joins the one existing analysis path.
 *
 * The PDF reader here is a stand-in for the document-extractor sidecar (the real
 * one is tested against the running container in
 * `tests/documentExtractorIntegration.test.ts`), except where the real client is
 * pointed at a closed port to prove the "sidecar down" path. What these tests
 * hold in place is the engine side: a PDF becomes one more ExtractedSource, in
 * the same dedupe, the same character caps, the same reading clock, the same
 * product relevance guard and the same single provider call as a TXT file — and
 * the original bytes never reach a provider.
 *
 * Every Directus call is a mock. The provider is a capturing registry or the
 * real DeepSeek adapter with global fetch stubbed: 0 real provider calls.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type AddressInfo } from 'node:net'
import { runProposalEngine, MAX_TOTAL_EXTRACTION_MS } from '../server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '../server/utils/aiProviderRegistryDefault'
import type { AiProviderRegistry } from '../server/utils/aiProviderRegistry'
import { PRODUCT_MODEL_RELEVANCE_GUARD, type AiGenerationInput } from '../server/utils/aiTargetContract'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import { MAX_PER_FILE_CHARS, MAX_TOTAL_EXTRACTED_CHARS } from '../server/utils/aiTextExtraction'
import { createPdfTextReader, type PdfTextReadResult } from '../server/utils/documentExtractorClient'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { buildTextPdf, TEST_ONLY_MARK } from './helpers/testOnlyPdf'

const PRODUCT_NAME = '[TEST ONLY — NOT FOR PUBLICATION] LT-180C Free-Fall Metal Detector'
const VALID_PROPOSAL = { groups: [{ group: 'Mechanical', items: [{ parameter: 'Aperture', value: '180 mm' }] }] }
const UNAVAILABLE = 'The document reader is unavailable right now. Other sources can still be analyzed.'
const PDF_NO_TEXT = 'No extractable text was found in this PDF. Scanned PDFs are not supported yet.'
const COULD_NOT_READ = 'This file could not be read.'
const TOOK_TOO_LONG = 'This file took too long to read and was stopped.'
const TIME_LIMIT_REASON = 'Not read: the time limit for reading sources was reached.'

interface Row {
  id: number
  uuid: string
  filename: string
  type: string
  bytes: Uint8Array | 'stall'
  delayMs?: number
}

const text = (value: string) => new TextEncoder().encode(value)
const pdfBytes = (lines: string[]) => new Uint8Array(buildTextPdf([lines]))

const PDF_ROW: Row = { id: 1, uuid: 'uuid-pdf', filename: 'LT180C datasheet.pdf', type: 'application/pdf', bytes: pdfBytes([TEST_ONLY_MARK, 'Model: LT180C', 'Aperture: 180 mm']) }
const TXT_ROW: Row = { id: 2, uuid: 'uuid-txt', filename: 'LT180C notes.txt', type: 'text/plain', bytes: text('Power: 0.45 kW') }

/** A Directus stand-in answering the engine's endpoints, recording every call. */
function directus(rows: Row[], product: Record<string, unknown> = { name_en: PRODUCT_NAME, product_code: null }) {
  const calls: Array<{ path: string, options?: Record<string, unknown> }> = []
  const fetch = (async <T>(path: string, options?: Record<string, unknown>): Promise<T> => {
    calls.push({ path, options })
    if (path.startsWith('/items/products?filter[id]')) return { data: [{ id: 3 }] } as T
    if (path.startsWith('/items/products_files?')) {
      return {
        data: rows.map(row => ({
          id: row.id,
          directus_files_id: { id: row.uuid, filename_download: row.filename, type: row.type, filesize: row.bytes === 'stall' ? 1024 : row.bytes.byteLength },
        })),
      } as T
    }
    if (path.startsWith('/items/products/')) return { data: product } as T
    if (path.startsWith('/assets/')) {
      const row = rows.find(candidate => path === `/assets/${candidate.uuid}`)
      if (!row) throw new Error('asset fetch failed')
      if (row.bytes === 'stall') return new ReadableStream<Uint8Array>({ start() {} }) as T
      const bytes = row.bytes
      return new ReadableStream<Uint8Array>({
        start(controller) {
          const deliver = () => {
            controller.enqueue(bytes)
            controller.close()
          }
          if (row.delayMs) setTimeout(deliver, row.delayMs)
          else deliver()
        },
      }) as T
    }
    throw new Error(`Unexpected fetch path in test: ${path}`)
  }) as FetchFn
  return { fetch, calls }
}

function capturingRegistry() {
  const generate = vi.fn(async (_providerId: unknown, _target: unknown, _input: unknown) => ({ ok: true as const, output: VALID_PROPOSAL }))
  const registry = {
    getProvider: () => {
      throw new Error('the engine dispatches through generateStructured only')
    },
    listConfiguredProviders: () => [
      { id: 'deepseek', label: 'DeepSeek', configured: true },
      { id: 'openai', label: 'OpenAI', configured: false },
    ],
    getDefaultProvider: () => 'deepseek',
    generateStructured: generate,
  } as unknown as AiProviderRegistry
  return { registry, generate }
}

function pdfReader(respond: (bytes: Uint8Array, options: { timeoutMs: number }) => PdfTextReadResult | Promise<PdfTextReadResult>) {
  return vi.fn(async (bytes: Uint8Array, options: { timeoutMs: number }) => respond(bytes, options))
}

function analyze(fetch: FetchFn, registry: AiProviderRegistry, mediaIds: number[], pdf?: ReturnType<typeof pdfReader> | ReturnType<typeof createPdfTextReader>) {
  return runProposalEngine(fetch, registry, specificationsTarget, { productId: 3, providerId: 'deepseek', mediaIds }, undefined, pdf ? { pdf } : undefined)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a PDF and a TXT file: one analysis, one provider call, one proposal', () => {
  it('both sources reach the same single provider request, as Source 1 (PDF) and Source 2 (Text)', async () => {
    const { fetch } = directus([PDF_ROW, TXT_ROW])
    const read = pdfReader(() => ({ ok: true, text: 'Model: LT180C\nAperture: 180 mm' }))
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2], read)

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    const input = generate.mock.calls[0][2] as AiGenerationInput
    expect(input.sourceFileSummaries).toEqual([{ displayName: 'Source 1', fileType: 'PDF' }, { displayName: 'Source 2', fileType: 'Text' }])
    expect(input.extractedSourceTexts).toEqual([
      { displayName: 'Source 1', text: 'Model: LT180C\nAperture: 180 mm' },
      { displayName: 'Source 2', text: 'Power: 0.45 kW' },
    ])
    expect(result.fileResults).toEqual([
      { displayName: 'LT180C datasheet.pdf', status: 'read' },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
    expect(read).toHaveBeenCalledTimes(1)
    expect(Buffer.from(read.mock.calls[0][0]).equals(Buffer.from(PDF_ROW.bytes as Uint8Array))).toBe(true)
  })

  it('a PDF with no text layer is reported as such; the TXT file still goes to the provider, in one call', async () => {
    const { fetch } = directus([{ ...PDF_ROW, filename: 'scan.pdf' }, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2], pdfReader(() => ({ ok: false, code: 'no_text' })))

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect((generate.mock.calls[0][2] as AiGenerationInput).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: 'Power: 0.45 kW' }])
    expect(result.fileResults).toEqual([
      { displayName: 'scan.pdf', status: 'unreadable', reason: PDF_NO_TEXT },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('when every selected PDF fails, the provider is never called and each reason is the fixed sentence', async () => {
    const rows: Row[] = ['no-text', 'too-long', 'down'].map((kind, index) => ({
      id: index + 1, uuid: `uuid-${kind}`, filename: `${kind}.pdf`, type: 'application/pdf', bytes: pdfBytes([`CASE ${kind}`]),
    }))
    const read = pdfReader((bytes) => {
      const content = Buffer.from(bytes).toString('latin1')
      if (content.includes('CASE no-text')) return { ok: false, code: 'no_text' }
      if (content.includes('CASE too-long')) return { ok: false, code: 'too_many_pages' }
      return { ok: false, code: 'unavailable' }
    })
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2, 3], read)

    expect(generate).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('None of the selected files could be read as text. Nothing was sent to the AI provider.')
    expect(result.fileResults.map(outcome => outcome.reason)).toEqual([PDF_NO_TEXT, 'This document has too many pages to analyze.', UNAVAILABLE])
    expect(JSON.stringify(result)).not.toMatch(/stderr|Syntax|\/tmp|stack|8787/)
  })

  it('with the document-extractor down (the real client, a closed port), the PDF is unavailable and the TXT file is still analyzed', async () => {
    const probe = createServer()
    await new Promise<void>(done => probe.listen(0, '127.0.0.1', () => done()))
    const { port } = probe.address() as AddressInfo
    await new Promise<void>(done => probe.close(() => done()))

    const { fetch } = directus([PDF_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2], createPdfTextReader({ baseUrl: `http://127.0.0.1:${port}` }))

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(result.fileResults).toEqual([
      { displayName: 'LT180C datasheet.pdf', status: 'unreadable', reason: UNAVAILABLE },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('bytes labelled application/pdf that are not a PDF are malformed, and never sent to the reader', async () => {
    const { fetch } = directus([{ ...PDF_ROW, bytes: text('Model: LT180C') }, TXT_ROW])
    const read = pdfReader(() => ({ ok: true, text: 'never used' }))
    const { registry } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2], read)
    expect(read).not.toHaveBeenCalled()
    expect(result.fileResults[0]).toEqual({ displayName: 'LT180C datasheet.pdf', status: 'unreadable', reason: 'This file is damaged or is not a valid document.' })
  })
})

describe('the product relevance guard covers PDF text like any other source', () => {
  const MULTI_MODEL = [TEST_ONLY_MARK, 'LT180C', 'Aperture 180 mm', 'Voltage 220 V', '', 'LT200C', 'Aperture 200 mm', 'Voltage 380 V'].join('\n')

  it('multi-model PDF text arrives whole, under the current-product block and the relevance guard — no code line when there is no code', async () => {
    const { fetch } = directus([PDF_ROW])
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1], pdfReader(() => ({ ok: true, text: MULTI_MODEL })))

    expect(generate).toHaveBeenCalledTimes(1)
    const target = generate.mock.calls[0][1] as typeof specificationsTarget
    const input = generate.mock.calls[0][2] as AiGenerationInput
    expect(target.systemInstructions).toContain(PRODUCT_MODEL_RELEVANCE_GUARD)
    const prompt = specificationsTarget.buildUserInput(input)
    expect(prompt.startsWith(`Current product:\nProduct: ${PRODUCT_NAME}\n`)).toBe(true)
    expect(prompt).not.toContain('Product code:')
    // The reader filters nothing by model: attribution is the guard's job, inside the one provider call.
    expect(prompt).toContain('LT200C')
    expect(prompt).toContain('Voltage 380 V')
  })

  it('with a product code, the code is named from the product record only — model_or_series is never read', async () => {
    const { fetch, calls } = directus([PDF_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C', model_or_series: 'LT series' })
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1], pdfReader(() => ({ ok: true, text: MULTI_MODEL })))

    const prompt = specificationsTarget.buildUserInput(generate.mock.calls[0][2] as AiGenerationInput)
    expect(prompt).toContain('Product code: LT-180C\n')
    expect(prompt).not.toContain('LT series')
    expect(calls.map(call => call.path)).toContain('/items/products/3?fields=name_en,product_code')
  })
})

describe('the same fingerprint, dedupe and character caps as every other source', () => {
  it('the same PDF text gives the same fingerprint, whatever its Directus id, file name or bytes', async () => {
    const fingerprintOf = async (row: Row) => {
      const { fetch } = directus([row])
      const { registry } = capturingRegistry()
      const result = await analyze(fetch, registry, [row.id], pdfReader(() => ({ ok: true, text: 'Aperture: 180 mm' })))
      return result.ok ? result.fingerprint : null
    }
    const first = await fingerprintOf({ id: 1, uuid: 'uuid-a', filename: 'a.pdf', type: 'application/pdf', bytes: pdfBytes(['Aperture: 180 mm']) })
    const second = await fingerprintOf({ id: 9, uuid: 'uuid-b', filename: 'renamed copy.pdf', type: 'application/pdf', bytes: pdfBytes(['Aperture: 180 mm', 'rev 2']) })
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(second).toBe(first)
  })

  it('a PDF whose text is identical to a TXT file is analyzed once — content decides, not the format', async () => {
    const { fetch } = directus([PDF_ROW, { ...TXT_ROW, bytes: text('Aperture: 180 mm') }])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2], pdfReader(() => ({ ok: true, text: 'Aperture: 180 mm' })))

    expect(generate).toHaveBeenCalledTimes(1)
    expect((generate.mock.calls[0][2] as AiGenerationInput).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: 'Aperture: 180 mm' }])
    expect(result.fileResults).toEqual([
      { displayName: 'LT180C datasheet.pdf', status: 'read' },
      { displayName: 'LT180C notes.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' },
    ])
  })

  it('PDF text counts against the same 20,000-per-source and 60,000-total ceilings', async () => {
    const rows: Row[] = [1, 2, 3].map(index => ({ id: index, uuid: `uuid-${index}`, filename: `part-${index}.pdf`, type: 'application/pdf', bytes: pdfBytes([`Document ${index}`]) }))
    rows.push({ id: 4, uuid: 'uuid-4', filename: 'long.txt', type: 'text/plain', bytes: text('T'.repeat(30_000)) })
    const read = pdfReader((bytes) => {
      const index = /Document (\d)/.exec(Buffer.from(bytes).toString('latin1'))![1]
      return { ok: true, text: index.repeat(MAX_PER_FILE_CHARS) }
    })
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1, 2, 3, 4], read)

    const lengths = (generate.mock.calls[0][2] as AiGenerationInput).extractedSourceTexts.map(source => source.text.length)
    expect(lengths).toEqual([15_000, 15_000, 15_000, 15_000])
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBeLessThanOrEqual(MAX_TOTAL_EXTRACTED_CHARS)
  })
})

describe('PDF reading spends the analysis reading clock', () => {
  it('a PDF read gets no more than the stage has left, and one that runs into the end of the stage is reported as such', async () => {
    vi.useFakeTimers({ now: 0 })
    const rows: Row[] = [
      { id: 1, uuid: 'u1', filename: 'stall-1.txt', type: 'text/plain', bytes: 'stall' },
      { id: 2, uuid: 'u2', filename: 'stall-2.txt', type: 'text/plain', bytes: 'stall' },
      { id: 3, uuid: 'u3', filename: 'slow.txt', type: 'text/plain', bytes: text('Aperture: 180 mm'), delayMs: 5_000 },
      { id: 4, uuid: 'u4', filename: 'first.pdf', type: 'application/pdf', bytes: pdfBytes(['First']) },
      { id: 5, uuid: 'u5', filename: 'second.pdf', type: 'application/pdf', bytes: pdfBytes(['Second']) },
    ]
    // A reader that uses all the time it is given — like a sidecar that never answers.
    const read = pdfReader((_bytes, { timeoutMs }) => new Promise<PdfTextReadResult>((done) => {
      setTimeout(() => done({ ok: false, code: 'timeout' }), timeoutMs)
    }))
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()

    const promise = analyze(fetch, registry, [1, 2, 3, 4, 5], read)
    await vi.advanceTimersByTimeAsync(MAX_TOTAL_EXTRACTION_MS + 1_000)
    vi.useRealTimers()
    const result = await promise

    // Stalls end at 15 s and 30 s; slow.txt arrives at 35 s; first.pdf gets its full 15 s (to 50 s);
    // second.pdf gets only the 10 s left, and runs into the end of the stage at 60 s.
    expect(read.mock.calls.map(call => call[1].timeoutMs)).toEqual([15_000, 10_000])
    expect(result.fileResults).toEqual([
      { displayName: 'stall-1.txt', status: 'unreadable', reason: COULD_NOT_READ },
      { displayName: 'stall-2.txt', status: 'unreadable', reason: COULD_NOT_READ },
      { displayName: 'slow.txt', status: 'read' },
      { displayName: 'first.pdf', status: 'unreadable', reason: TOOK_TOO_LONG },
      { displayName: 'second.pdf', status: 'unreadable', reason: TIME_LIMIT_REASON },
    ])
    expect(generate).toHaveBeenCalledTimes(1)
    expect((generate.mock.calls[0][2] as AiGenerationInput).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: 'Aperture: 180 mm' }])
  }, 20_000)
})

describe('the original PDF never reaches the provider, and nothing is written', () => {
  const deepseek = () => createDefaultAiProviderRegistry({
    defaultProvider: 'deepseek',
    openai: { apiKey: '', model: '' },
    deepseek: { apiKey: 'test-only-not-a-key', model: 'test-only-model' },
  })

  it('with the real DeepSeek adapter: exactly one request, carrying extracted text only — no PDF bytes, base64, data URL, Media URL or file name', async () => {
    const pdf = pdfBytes([TEST_ONLY_MARK, 'Model: LT180C', 'BINARY-SENTINEL-7F3A'])
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: Record<string, unknown>) => {
      requests.push(String(init.body))
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(VALID_PROPOSAL) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { fetch } = directus([{ ...PDF_ROW, bytes: pdf }])
    const result = await analyze(fetch, deepseek(), [1], pdfReader(() => ({ ok: true, text: 'Model: LT180C\nAperture: 180 mm' })))

    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(1)
    const body = requests[0]
    expect(body).toContain('Aperture: 180 mm')
    expect(body).not.toContain('%PDF')
    expect(body).not.toContain('BINARY-SENTINEL-7F3A')
    expect(body).not.toContain(Buffer.from(pdf).toString('base64').slice(0, 48))
    expect(body).not.toMatch(/data:application\/pdf|\/assets\/|uuid-pdf|LT180C datasheet\.pdf/)
  })

  it('a provider failure during a PDF analysis is one request — no retry, no fallback to another provider', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requests.push(String(url))
      return new Response('{}', { status: 503 })
    }))
    const { fetch } = directus([PDF_ROW, TXT_ROW])
    const result = await analyze(fetch, deepseek(), [1, 2], pdfReader(() => ({ ok: true, text: 'Aperture: 180 mm' })))

    expect(result.ok).toBe(false)
    expect(requests).toHaveLength(1)
  })

  it('analyzing a PDF writes nothing: every Directus call is a read', async () => {
    const { fetch, calls } = directus([PDF_ROW, TXT_ROW])
    const { registry } = capturingRegistry()
    await analyze(fetch, registry, [1, 2], pdfReader(() => ({ ok: true, text: 'Aperture: 180 mm' })))

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call.options?.method ?? 'GET').toBe('GET')
    expect(calls.map(call => call.path.split('?')[0])).toEqual(expect.arrayContaining(['/items/products', '/items/products_files', '/assets/uuid-pdf', '/assets/uuid-txt']))
  })
})
