/**
 * AI-XLSX-SOURCE-01 — an .xlsx workbook joins the one existing analysis path.
 *
 * The workbook reader runs for real, on synthetic TEST ONLY workbooks built in
 * memory. What these tests hold in place is the engine side: a workbook becomes
 * one more ExtractedSource — in the same dedupe, the same character caps, the
 * same reading clock, the same product relevance guard and the same single
 * provider call as a TXT or PDF source — and the original bytes never reach a
 * provider.
 *
 * Every Directus call is a mock and the PDF reader is a stand-in. The provider
 * is a capturing registry or the real DeepSeek adapter with global fetch
 * stubbed: 0 real provider calls.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '../server/utils/aiProviderRegistryDefault'
import type { AiProviderRegistry } from '../server/utils/aiProviderRegistry'
import { PRODUCT_MODEL_RELEVANCE_GUARD, type AiGenerationInput } from '../server/utils/aiTargetContract'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import { extractTextFromFile } from '../server/utils/aiTextExtraction'
import type { PdfTextReadResult } from '../server/utils/documentExtractorClient'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { createOfficeExtractionGate, officeExtractionGate, type OfficeExtractionGate } from '../server/utils/officeExtractionGate'
import { MAX_XLSX_PROCESSING_MS, XLSX_LIMITS } from '../server/utils/xlsxExtraction'
import { aiSourceFormatFor } from '../utils/aiSourceFormats'
import { buildTextPdf, TEST_ONLY_MARK } from './helpers/testOnlyPdf'
import { tableXlsx, type CellInput } from './helpers/testOnlyXlsx'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MB = 1024 * 1024
const PRODUCT_NAME = '[TEST ONLY — NOT FOR PUBLICATION] LT-180C Free-Fall Metal Detector'
const IDENTITY_PATH = '/items/products/3?fields=name_en,product_code'
const VALID_PROPOSAL = { groups: [{ group: 'Mechanical', items: [{ parameter: 'Aperture', value: '180 mm' }] }] }

const NOTHING_READ = 'None of the selected files could be read as text. Nothing was sent to the AI provider.'
const TOO_COMPLEX = 'This file is too complex to analyze safely. Save the relevant part as a smaller file.'
const MALFORMED = 'This file is damaged or is not a valid document.'
const TOO_LARGE = 'This file is too large to analyze, or its size could not be confirmed.'
const COULD_NOT_READ = 'This file could not be read.'
const BUSY = 'The document reader is busy. Try again in a moment.'
const NO_ROWS = 'No data rows were found in this spreadsheet.'

const SPEC_ROWS: CellInput[][] = [
  ['Model', 'Aperture', 'Voltage', 'Power'],
  ['LT180C', '180 mm', '220 V', '0.45 kW'],
  ['LT200C', '200 mm', '380 V', '0.55 kW'],
  ['LT300C', '300 mm', '380 V', '0.75 kW'],
]
const SPEC_TEXT = [
  'Sheet: Specifications',
  'Columns: Model | Aperture | Voltage | Power',
  'LT180C | 180 mm | 220 V | 0.45 kW',
  'LT200C | 200 mm | 380 V | 0.55 kW',
  'LT300C | 300 mm | 380 V | 0.75 kW',
].join('\n')

interface Row {
  id: number
  uuid: string
  filename: string
  type: string
  bytes: Uint8Array
  /** What Directus reports as the file's size, when that is not its real size. */
  filesize?: number
}

const text = (value: string) => new TextEncoder().encode(value)
const toArrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const XLSX_ROW: Row = { id: 1, uuid: 'uuid-xlsx', filename: 'LT series parameters.xlsx', type: XLSX, bytes: tableXlsx(SPEC_ROWS) }
const TXT_ROW: Row = { id: 2, uuid: 'uuid-txt', filename: 'LT180C notes.txt', type: 'text/plain', bytes: text('Power: 0.45 kW') }
const PDF_ROW: Row = { id: 3, uuid: 'uuid-pdf', filename: 'LT180C datasheet.pdf', type: 'application/pdf', bytes: new Uint8Array(buildTextPdf([[TEST_ONLY_MARK, 'Model: LT180C']])) }

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
          directus_files_id: { id: row.uuid, filename_download: row.filename, type: row.type, filesize: row.filesize ?? row.bytes.byteLength },
        })),
      } as T
    }
    if (path.startsWith('/items/products/')) return { data: product } as T
    if (path.startsWith('/assets/')) {
      const row = rows.find(candidate => path === `/assets/${candidate.uuid}`)
      if (!row) throw new Error('asset fetch failed')
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(row.bytes)
          controller.close()
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

type PdfReader = (bytes: Uint8Array, options: { timeoutMs: number }) => Promise<PdfTextReadResult>

function analyze(fetch: FetchFn, registry: AiProviderRegistry, mediaIds: number[], pdf?: PdfReader) {
  return runProposalEngine(fetch, registry, specificationsTarget, { productId: 3, providerId: 'deepseek', mediaIds }, undefined, pdf ? { pdf } : undefined)
}

const inputOf = (generate: ReturnType<typeof capturingRegistry>['generate']) => generate.mock.calls[0]![2] as AiGenerationInput

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a workbook in the one analysis path', () => {
  it('a workbook and a TXT file reach one provider request, as Source 1 (Spreadsheet) and Source 2 (Text)', async () => {
    const { fetch } = directus([XLSX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries).toEqual([{ displayName: 'Source 1', fileType: 'Spreadsheet' }, { displayName: 'Source 2', fileType: 'Text' }])
    expect(inputOf(generate).extractedSourceTexts).toEqual([
      { displayName: 'Source 1', text: SPEC_TEXT },
      { displayName: 'Source 2', text: 'Power: 0.45 kW' },
    ])
    expect(result.fileResults).toEqual([
      { displayName: 'LT series parameters.xlsx', status: 'read' },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('a PDF, a workbook and a TXT file: one provider call, one merged proposal', async () => {
    const { fetch } = directus([PDF_ROW, XLSX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const read = vi.fn<PdfReader>(async () => ({ ok: true, text: 'Model: LT180C\nWeight: 45 kg' }))
    const result = await analyze(fetch, registry, [3, 1, 2], read)

    expect(generate).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries.map(summary => summary.fileType)).toEqual(['PDF', 'Spreadsheet', 'Text'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toEqual(VALID_PROPOSAL)
    expect(result.fileResults.map(outcome => outcome.status)).toEqual(['read', 'read', 'read'])
  })
})

describe('the relevance guard, and exact product-code narrowing before it', () => {
  it('with a product code, the workbook is narrowed to the exact model and still sent under the guard, in one call', async () => {
    const { fetch, calls } = directus([XLSX_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1])

    expect(generate).toHaveBeenCalledTimes(1)
    const target = generate.mock.calls[0]![1] as typeof specificationsTarget
    expect(target.systemInstructions).toContain(PRODUCT_MODEL_RELEVANCE_GUARD)
    const prompt = specificationsTarget.buildUserInput(inputOf(generate))
    expect(prompt.startsWith(`Current product:\nProduct: ${PRODUCT_NAME}\n`)).toBe(true)
    expect(prompt).toContain('Product code: LT-180C\n')
    expect(prompt).toContain('Filtered to exact product code: LT-180C')
    expect(prompt).toContain('LT180C | 180 mm | 220 V | 0.45 kW')
    expect(prompt).not.toMatch(/LT200C|LT300C|200 mm|300 mm|0\.55 kW|0\.75 kW/)
    expect(calls.filter(call => call.path === IDENTITY_PATH)).toHaveLength(1)
  })

  it('without a product code nothing is narrowed: every model reaches the guard, which decides', async () => {
    const { fetch, calls } = directus([XLSX_ROW])
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1])

    const prompt = specificationsTarget.buildUserInput(inputOf(generate))
    expect(prompt).not.toContain('Product code:')
    expect(prompt).not.toContain('Filtered to exact product code')
    expect(prompt).toContain(SPEC_TEXT)
    expect(calls.filter(call => call.path === IDENTITY_PATH)).toHaveLength(1)
  })

  it('reads the product identity once per analysis, however many workbooks ask for the code', async () => {
    const second: Row = { ...XLSX_ROW, id: 4, uuid: 'uuid-xlsx-2', filename: 'second.xlsx', bytes: tableXlsx([['Model', 'Weight'], ['LT180C', '45 kg']]) }
    const { fetch, calls } = directus([XLSX_ROW, second, TXT_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1, 4, 2])

    expect(generate).toHaveBeenCalledTimes(1)
    expect(calls.filter(call => call.path.startsWith('/items/products/'))).toEqual([{ path: IDENTITY_PATH, options: undefined }])
  })
})

describe('dedupe, partial failure and all failed', () => {
  it('a TXT file carrying exactly the workbook\'s structured text is analyzed once', async () => {
    const { fetch } = directus([XLSX_ROW, { ...TXT_ROW, bytes: text(SPEC_TEXT) }])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: SPEC_TEXT }])
    expect(result.fileResults[1]).toEqual({ displayName: 'LT180C notes.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' })
  })

  it('a workbook too complex to read is reported, and the TXT file still goes to the provider in one call', async () => {
    const complex: Row = { ...XLSX_ROW, bytes: tableXlsx([['Model', 'Note'], ['LT180C', 'n'.repeat(501)]]) }
    const { fetch } = directus([complex, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: 'Power: 0.45 kW' }])
    expect(result.fileResults).toEqual([
      { displayName: 'LT series parameters.xlsx', status: 'unreadable', reason: TOO_COMPLEX },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('when every selected workbook fails, the provider is never called and each reason is the fixed sentence', async () => {
    const rows: Row[] = [
      { id: 1, uuid: 'u-malformed', filename: 'renamed.xlsx', type: XLSX, bytes: text('not a workbook') },
      { id: 2, uuid: 'u-large', filename: 'huge.xlsx', type: XLSX, bytes: tableXlsx(SPEC_ROWS), filesize: 10 * MB + 1 },
      { id: 3, uuid: 'u-complex', filename: 'complex.xlsx', type: XLSX, bytes: tableXlsx([['Model', 'Note'], ['LT180C', 'n'.repeat(501)]]) },
      { id: 4, uuid: 'u-empty', filename: 'header-only.xlsx', type: XLSX, bytes: tableXlsx([['Model', 'Aperture']]) },
    ]
    const { fetch, calls } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2, 3, 4])

    expect(generate).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(NOTHING_READ)
    expect(result.fileResults.map(outcome => outcome.reason)).toEqual([MALFORMED, TOO_LARGE, TOO_COMPLEX, NO_ROWS])
    // The oversized workbook was refused on its trusted size, before a single byte was downloaded.
    expect(calls.map(call => call.path)).not.toContain('/assets/u-large')
    expect(JSON.stringify(result)).not.toMatch(/stack|Sheet:|xl\/|\.xml|Content_Types/)
  })

  it('a workbook whose download runs past 10 MB is stopped and never parsed, whatever size Directus reported', async () => {
    const { fetch } = directus([{ ...XLSX_ROW, bytes: new Uint8Array(10 * MB + 1), filesize: 1_024 }, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    // Parsed, these zero bytes would have been reported as damaged; they were never read at all.
    expect(result.fileResults[0]).toEqual({ displayName: 'LT series parameters.xlsx', status: 'unreadable', reason: COULD_NOT_READ })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(aiSourceFormatFor(XLSX)?.maxBytes).toBe(10 * MB)
    expect(XLSX_LIMITS.maxBytes).toBe(aiSourceFormatFor(XLSX)?.maxBytes)
  })
})

describe('a workbook and the combined character cap', () => {
  /** About 12,500 characters of structured text: inside a three-source share (20,000), over a five-source share (12,000). */
  const LONG_ROWS: CellInput[][] = [['Model', 'Description'], ...Array.from({ length: 125 }, (_, index) => [`LT${100 + index}C`, 'd'.repeat(90)])]
  const notes = ['A', 'B', 'C', 'D'].map((letter, index): Row => ({
    id: 10 + index, uuid: `uuid-note-${letter}`, filename: `note-${letter}.txt`, type: 'text/plain', bytes: text(`Note ${letter}`),
  }))

  it('gets its share of the combined cap, and is refused rather than cut when it does not fit', async () => {
    const workbook: Row = { ...XLSX_ROW, bytes: tableXlsx(LONG_ROWS) }
    const direct = await extractTextFromFile(toArrayBuffer(workbook.bytes), XLSX, 'Source 1')
    const full = direct.ok ? direct.source.text : ''
    expect(full.length).toBeGreaterThan(12_000)
    expect(full.length).toBeLessThan(15_000)

    const three = directus([workbook, notes[0]!, notes[1]!])
    const threeProvider = capturingRegistry()
    await analyze(three.fetch, threeProvider.registry, [1, 10, 11])
    expect(inputOf(threeProvider.generate).extractedSourceTexts[0]).toEqual({ displayName: 'Source 1', text: full })

    const five = directus([workbook, ...notes])
    const fiveProvider = capturingRegistry()
    const result = await analyze(five.fetch, fiveProvider.registry, [1, 10, 11, 12, 13])
    expect(result.fileResults[0]).toEqual({ displayName: 'LT series parameters.xlsx', status: 'unreadable', reason: TOO_COMPLEX })
    expect(inputOf(fiveProvider.generate).extractedSourceTexts.map(source => source.text)).toEqual(['Note A', 'Note B', 'Note C', 'Note D'])
  })

  it('refuses a workbook whose text is over the share it was given', async () => {
    expect(await extractTextFromFile(toArrayBuffer(XLSX_ROW.bytes), XLSX, 'Source 1', { maxChars: 100 })).toEqual({ ok: false, code: 'too_complex' })
  })
})

describe('a workbook spends the reading clock, including time spent queuing', () => {
  it('a workbook waiting for a busy Office reader gives up at its own 8-second deadline, and the other sources are still analyzed', async () => {
    vi.useFakeTimers({ now: 0 })
    let release!: () => void
    const held = officeExtractionGate.run(() => new Promise<void>((done) => {
      release = done
    }), { deadline: 3_600_000 })
    const { fetch } = directus([XLSX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()

    const promise = analyze(fetch, registry, [1, 2])
    await vi.advanceTimersByTimeAsync(MAX_XLSX_PROCESSING_MS + 1)
    const result = await promise
    release()
    await held

    expect(result.fileResults).toEqual([
      { displayName: 'LT series parameters.xlsx', status: 'unreadable', reason: BUSY },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
    expect(generate).toHaveBeenCalledTimes(1)
    expect(officeExtractionGate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('never starts parsing once the time it may wait has run out', async () => {
    const gate = createOfficeExtractionGate()
    let release!: () => void
    const held = gate.run(() => new Promise<void>((done) => {
      release = done
    }), { deadline: Date.now() + 60_000 })
    const started = Date.now()

    const result = await extractTextFromFile(toArrayBuffer(XLSX_ROW.bytes), XLSX, 'Source 1', { timeoutMs: 50, officeGate: gate })
    expect(result).toEqual({ ok: false, code: 'busy' })
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(gate.stats()).toEqual({ active: 1, queued: 0 })
    release()
    await held
  })

  it('gives a workbook at most 8 seconds, or less when the reading budget has less left', async () => {
    const deadlines: number[] = []
    const recording: OfficeExtractionGate = {
      async run<T>(task: () => Promise<T>, { deadline }: { deadline: number }) {
        deadlines.push(deadline - Date.now())
        return { ok: true as const, value: await task() }
      },
      stats: () => ({ active: 0, queued: 0 }),
    }
    const bytes = toArrayBuffer(XLSX_ROW.bytes)
    expect((await extractTextFromFile(bytes, XLSX, 'Source 1', { timeoutMs: 60_000, officeGate: recording })).ok).toBe(true)
    expect((await extractTextFromFile(bytes, XLSX, 'Source 1', { timeoutMs: 2_000, officeGate: recording })).ok).toBe(true)
    expect(MAX_XLSX_PROCESSING_MS).toBe(8_000)
    expect(deadlines[0]).toBeGreaterThan(7_000)
    expect(deadlines[0]).toBeLessThanOrEqual(8_000)
    expect(deadlines[1]).toBeGreaterThan(1_000)
    expect(deadlines[1]).toBeLessThanOrEqual(2_000)
    expect(await extractTextFromFile(bytes, XLSX, 'Source 1', { timeoutMs: 0, officeGate: recording })).toEqual({ ok: false, code: 'timeout' })
    expect(deadlines).toHaveLength(2)
  })

  it('asks for the product code only when a workbook is read, and a code it cannot get leaves the workbook unread', async () => {
    const bytes = toArrayBuffer(XLSX_ROW.bytes)
    const narrowed = await extractTextFromFile(bytes, XLSX, 'Source 1', { productCode: async () => 'LT-180C' })
    expect(narrowed.ok && narrowed.source.text).toBe('Sheet: Specifications\nFiltered to exact product code: LT-180C\nColumns: Model | Aperture | Voltage | Power\nLT180C | 180 mm | 220 V | 0.45 kW')

    const gate = { run: vi.fn(), stats: () => ({ active: 0, queued: 0 }) } as unknown as OfficeExtractionGate
    const failing = async (): Promise<string | null> => {
      throw new Error('the product could not be read')
    }
    expect(await extractTextFromFile(bytes, XLSX, 'Source 1', { productCode: failing, officeGate: gate })).toEqual({ ok: false, code: 'unreadable' })
    expect(gate.run).not.toHaveBeenCalled()

    const productCode = vi.fn(async () => 'LT-180C')
    expect((await extractTextFromFile(toArrayBuffer(text('Aperture: 180 mm')), 'text/plain', 'Source 1', { productCode })).ok).toBe(true)
    expect(productCode).not.toHaveBeenCalled()
  })
})

describe('the original workbook never reaches the provider, and nothing is written', () => {
  const deepseek = () => createDefaultAiProviderRegistry({
    defaultProvider: 'deepseek',
    openai: { apiKey: '', model: '' },
    deepseek: { apiKey: 'test-only-not-a-key', model: 'test-only-model' },
  })

  it('with the real DeepSeek adapter: one request, carrying structured text only — no ZIP bytes, base64, data URL, Media URL, raw XML or formula', async () => {
    const workbook = tableXlsx([
      ['Model', 'Aperture', 'Linked price'],
      ['LT180C', '180 mm', { value: 120, formula: '\'[C:\\private\\pricing.xlsx]Sheet1\'!$A$1' }],
    ])
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: Record<string, unknown>) => {
      requests.push(String(init.body))
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(VALID_PROPOSAL) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { fetch } = directus([{ ...XLSX_ROW, bytes: workbook }])
    const result = await analyze(fetch, deepseek(), [1])

    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(1)
    const body = requests[0]!
    expect(body).toContain('LT180C | 180 mm | 120')
    expect(body).not.toContain('PK\\u0003\\u0004')
    expect(body).not.toContain(Buffer.from(workbook).toString('base64').slice(0, 48))
    expect(body).not.toMatch(/data:application\/vnd|\/assets\/|uuid-xlsx|LT series parameters\.xlsx|<worksheet|<sheetData|sharedStrings|Content_Types|<si>/)
    expect(body).not.toMatch(/pricing|private|\$A\$1|Sheet1'!/)
  })

  it('a provider failure during a workbook analysis is one request — no retry, no fallback to another provider', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requests.push(String(url))
      return new Response('{}', { status: 503 })
    }))
    const { fetch } = directus([XLSX_ROW, TXT_ROW])
    const result = await analyze(fetch, deepseek(), [1, 2])

    expect(result.ok).toBe(false)
    expect(requests).toHaveLength(1)
  })

  it('analyzing a workbook writes nothing: every Directus call is a read, through products_files only', async () => {
    const { fetch, calls } = directus([XLSX_ROW, TXT_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry } = capturingRegistry()
    await analyze(fetch, registry, [1, 2])

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call.options?.method ?? 'GET').toBe('GET')
    expect([...new Set(calls.map(call => call.path.split('?')[0]))].sort()).toEqual([
      '/assets/uuid-txt', '/assets/uuid-xlsx', '/items/products', '/items/products/3', '/items/products_files',
    ])
  })
})
