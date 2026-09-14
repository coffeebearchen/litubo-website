/**
 * AI-DOCX-SOURCE-01 — a .docx document joins the one existing analysis path.
 *
 * The Word reader runs for real, on synthetic TEST ONLY documents built in
 * memory. What these tests hold in place is the engine side: a document becomes
 * one more ExtractedSource — in the same dedupe, the same character shares, the
 * same reading clock, the same Office gate as a workbook, the same product
 * relevance guard and the same single provider call as every other source — and
 * the original bytes never reach a provider.
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
import { DOCX_LIMITS, MAX_DOCX_PROCESSING_MS } from '../server/utils/docxExtraction'
import type { PdfTextReadResult } from '../server/utils/documentExtractorClient'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { createOfficeExtractionGate, officeExtractionGate, type OfficeExtractionGate } from '../server/utils/officeExtractionGate'
import { aiSourceFormatFor } from '../utils/aiSourceFormats'
import { buildTextPdf, TEST_ONLY_MARK } from './helpers/testOnlyPdf'
import { tableXlsx } from './helpers/testOnlyXlsx'
import { DOCX_MIME, buildDocx, docx, heading, para, paraXml, run, table } from './helpers/testOnlyDocx'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MB = 1024 * 1024
const PRODUCT_NAME = '[TEST ONLY — NOT FOR PUBLICATION] LT-180C Free-Fall Metal Detector'
const IDENTITY_PATH = '/items/products/3?fields=name_en,product_code'
const VALID_PROPOSAL = { groups: [{ group: 'Mechanical', items: [{ parameter: 'Aperture', value: '180 mm' }] }] }

const NOTHING_READ = 'None of the selected files could be read as text. Nothing was sent to the AI provider.'
const TOO_COMPLEX = 'This file is too complex to analyze safely. Save the relevant part as a smaller file.'
const MALFORMED = 'This file is damaged or is not a valid document.'
const ENCRYPTED = 'This file is password-protected and cannot be read.'
const UNSUPPORTED = 'This file type is not supported for source analysis.'
const NO_TEXT = 'No extractable text was found in this file.'
const TOO_LARGE = 'This file is too large to analyze, or its size could not be confirmed.'
const COULD_NOT_READ = 'This file could not be read.'
const BUSY = 'The document reader is busy. Try again in a moment.'

const SPEC_DOCX = docx([
  heading(1, 'LT180C'),
  para('Aperture: 180 mm'),
  para('Power: 0.45 kW'),
  table([['Parameter', 'Value'], ['Voltage', '220 V']]),
])
const SPEC_TEXT = '# LT180C\nAperture: 180 mm\nPower: 0.45 kW\nTable:\nParameter | Value\nVoltage | 220 V'

const MULTI_MODEL_DOCX = docx([
  heading(1, 'LT180C'), para('Aperture 180 mm'), para('Voltage 220 V'),
  heading(1, 'LT200C'), para('Aperture 200 mm'), para('Voltage 380 V'),
])

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

const DOCX_ROW: Row = { id: 1, uuid: 'uuid-docx', filename: 'LT180C manual.docx', type: DOCX_MIME, bytes: SPEC_DOCX }
const TXT_ROW: Row = { id: 2, uuid: 'uuid-txt', filename: 'LT180C notes.txt', type: 'text/plain', bytes: text('Weight: 45 kg') }
const PDF_ROW: Row = { id: 3, uuid: 'uuid-pdf', filename: 'LT180C datasheet.pdf', type: 'application/pdf', bytes: new Uint8Array(buildTextPdf([[TEST_ONLY_MARK, 'Model: LT180C']])) }
const XLSX_ROW: Row = { id: 4, uuid: 'uuid-xlsx', filename: 'LT series parameters.xlsx', type: XLSX, bytes: tableXlsx([['Model', 'Belt width'], ['LT180C', '300 mm']]) }

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

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise<void>(done => setImmediate(done))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a Word document in the one analysis path', () => {
  it('a document and a TXT file reach one provider request, as Source 1 (Word) and Source 2 (Text)', async () => {
    const { fetch } = directus([DOCX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries).toEqual([{ displayName: 'Source 1', fileType: 'Word' }, { displayName: 'Source 2', fileType: 'Text' }])
    expect(inputOf(generate).extractedSourceTexts).toEqual([
      { displayName: 'Source 1', text: SPEC_TEXT },
      { displayName: 'Source 2', text: 'Weight: 45 kg' },
    ])
    expect(result.fileResults).toEqual([
      { displayName: 'LT180C manual.docx', status: 'read' },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('a Word document, a PDF, a workbook and a TXT file: one provider call, one merged proposal', async () => {
    const { fetch } = directus([DOCX_ROW, PDF_ROW, XLSX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const read = vi.fn<PdfReader>(async () => ({ ok: true, text: 'Model: LT180C\nWeight: 45 kg' }))
    const result = await analyze(fetch, registry, [1, 3, 4, 2], read)

    expect(generate).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries.map(summary => summary.fileType)).toEqual(['Word', 'PDF', 'Spreadsheet', 'Text'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toEqual(VALID_PROPOSAL)
    expect(result.fileResults.map(outcome => outcome.status)).toEqual(['read', 'read', 'read', 'read'])
  })
})

describe('a multi-model document and the relevance guard', () => {
  it('with a product code, every model section still reaches the provider — the D-025 guard decides, in one call', async () => {
    const { fetch, calls } = directus([{ ...DOCX_ROW, bytes: MULTI_MODEL_DOCX }], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1])

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    const target = generate.mock.calls[0]![1] as typeof specificationsTarget
    expect(target.systemInstructions).toContain(PRODUCT_MODEL_RELEVANCE_GUARD)
    const prompt = specificationsTarget.buildUserInput(inputOf(generate))
    expect(prompt.startsWith(`Current product:\nProduct: ${PRODUCT_NAME}\n`)).toBe(true)
    expect(prompt).toContain('Product code: LT-180C\n')
    expect(prompt).toContain('# LT180C\nAperture 180 mm\nVoltage 220 V\n# LT200C\nAperture 200 mm\nVoltage 380 V')
    // Nothing narrowed the document the way an exact-code workbook sheet is narrowed.
    expect(prompt).not.toContain('Filtered to exact product code')
    expect(calls.filter(call => call.path === IDENTITY_PATH)).toHaveLength(1)
  })

  it('without a product code no code line is written, and the whole document still goes to the guard', async () => {
    const { fetch } = directus([{ ...DOCX_ROW, bytes: MULTI_MODEL_DOCX }])
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1])

    const prompt = specificationsTarget.buildUserInput(inputOf(generate))
    expect(prompt).not.toMatch(/Product code:/)
    expect(prompt).toContain('# LT200C')
  })

  it('never asks for the product code to read a document', async () => {
    const productCode = vi.fn(async () => 'LT-180C')
    const result = await extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 1', { productCode })
    expect(result).toEqual({ ok: true, source: { displayName: 'Source 1', fileType: 'Word', text: SPEC_TEXT } })
    expect(productCode).not.toHaveBeenCalled()
  })
})

describe('dedupe, partial failure and all failed', () => {
  it('a TXT file carrying exactly the document\'s structured text is analyzed once', async () => {
    const { fetch } = directus([DOCX_ROW, { ...TXT_ROW, bytes: text(SPEC_TEXT) }])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: SPEC_TEXT }])
    expect(result.fileResults[1]).toEqual({ displayName: 'LT180C notes.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' })
  })

  it('a document too complex to read is reported, and the TXT file still goes to the provider in one call', async () => {
    const complex: Row = { ...DOCX_ROW, bytes: docx([para('x'.repeat(20_001))]) }
    const { fetch } = directus([complex, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).extractedSourceTexts).toEqual([{ displayName: 'Source 1', text: 'Weight: 45 kg' }])
    expect(result.fileResults).toEqual([
      { displayName: 'LT180C manual.docx', status: 'unreadable', reason: TOO_COMPLEX },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
  })

  it('when every selected document fails, the provider is never called and each reason is the fixed sentence', async () => {
    const cfb = new Uint8Array(4096)
    cfb.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
    const rows: Row[] = [
      { id: 1, uuid: 'u-malformed', filename: 'renamed.docx', type: DOCX_MIME, bytes: text('not a document') },
      { id: 2, uuid: 'u-encrypted', filename: 'locked.docx', type: DOCX_MIME, bytes: cfb },
      { id: 3, uuid: 'u-macro', filename: 'macro.docx', type: DOCX_MIME, bytes: buildDocx({ body: para('Aperture 180 mm'), documentContentType: 'application/vnd.ms-word.document.macroEnabled.main+xml' }) },
      { id: 4, uuid: 'u-complex', filename: 'complex.docx', type: DOCX_MIME, bytes: docx([para('x'.repeat(20_001))]) },
      { id: 5, uuid: 'u-empty', filename: 'empty.docx', type: DOCX_MIME, bytes: docx([para('')]) },
    ]
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2, 3, 4, 5])

    expect(generate).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(NOTHING_READ)
    expect(result.fileResults.map(outcome => outcome.reason)).toEqual([MALFORMED, ENCRYPTED, UNSUPPORTED, TOO_COMPLEX, NO_TEXT])
    expect(JSON.stringify(result)).not.toMatch(/stack|word\/|\.xml|Content_Types|<w:/)
  })

  it('an oversized or imported-content document is refused too, and with nothing readable the provider is never called', async () => {
    const rows: Row[] = [
      { id: 1, uuid: 'u-large', filename: 'huge.docx', type: DOCX_MIME, bytes: SPEC_DOCX, filesize: 10 * MB + 1 },
      { id: 2, uuid: 'u-chunk', filename: 'chunk.docx', type: DOCX_MIME, bytes: docx([para('Aperture 180 mm'), '<w:altChunk r:id="rIdChunk"/>']) },
    ]
    const { fetch, calls } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(generate).not.toHaveBeenCalled()
    expect(result.fileResults.map(outcome => outcome.reason)).toEqual([TOO_LARGE, UNSUPPORTED])
    // The oversized document was refused on its trusted size, before a single byte was downloaded.
    expect(calls.map(call => call.path)).not.toContain('/assets/u-large')
  })

  it('a document whose download runs past 10 MB is stopped and never parsed, whatever size Directus reported', async () => {
    const { fetch } = directus([{ ...DOCX_ROW, bytes: new Uint8Array(10 * MB + 1), filesize: 1_024 }, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 2])

    expect(result.fileResults[0]).toEqual({ displayName: 'LT180C manual.docx', status: 'unreadable', reason: COULD_NOT_READ })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(aiSourceFormatFor(DOCX_MIME)?.maxBytes).toBe(10 * MB)
    expect(DOCX_LIMITS.maxBytes).toBe(aiSourceFormatFor(DOCX_MIME)?.maxBytes)
  })
})

describe('a document and the combined character cap', () => {
  /** About 12,500 characters: inside a four-source share (15,000), over a five-source share (12,000). */
  const MEDIUM = docx(Array.from({ length: 125 }, (_, index) => para(`Line ${String(index).padStart(3, '0')}: ${'d'.repeat(89)}`)))
  /** About 16,000 characters: inside a three-source share (20,000), over a four-source share (15,000). */
  const LARGE = docx(Array.from({ length: 160 }, (_, index) => para(`Line ${String(index).padStart(3, '0')}: ${'e'.repeat(89)}`)))
  const notes = ['A', 'B', 'C', 'D'].map((letter, index): Row => ({
    id: 10 + index, uuid: `uuid-note-${letter}`, filename: `note-${letter}.txt`, type: 'text/plain', bytes: text(`Note ${letter}`),
  }))

  const fullText = async (bytes: Uint8Array) => {
    const direct = await extractTextFromFile(toArrayBuffer(bytes), DOCX_MIME, 'Source 1')
    return direct.ok ? direct.source.text : ''
  }

  it('gets 20,000 with up to three sources and 15,000 with four, and is refused rather than cut when it does not fit', async () => {
    const large = await fullText(LARGE)
    expect(large.length).toBeGreaterThan(15_000)
    expect(large.length).toBeLessThan(20_000)

    const three = directus([{ ...DOCX_ROW, bytes: LARGE }, notes[0]!, notes[1]!])
    const threeProvider = capturingRegistry()
    await analyze(three.fetch, threeProvider.registry, [1, 10, 11])
    expect(inputOf(threeProvider.generate).extractedSourceTexts[0]).toEqual({ displayName: 'Source 1', text: large })

    const four = directus([{ ...DOCX_ROW, bytes: LARGE }, notes[0]!, notes[1]!, notes[2]!])
    const fourProvider = capturingRegistry()
    const result = await analyze(four.fetch, fourProvider.registry, [1, 10, 11, 12])
    expect(result.fileResults[0]).toEqual({ displayName: 'LT180C manual.docx', status: 'unreadable', reason: TOO_COMPLEX })
    expect(inputOf(fourProvider.generate).extractedSourceTexts.map(source => source.text)).toEqual(['Note A', 'Note B', 'Note C'])
  })

  it('gets 15,000 with four sources and 12,000 with five', async () => {
    const medium = await fullText(MEDIUM)
    expect(medium.length).toBeGreaterThan(12_000)
    expect(medium.length).toBeLessThan(15_000)

    const four = directus([{ ...DOCX_ROW, bytes: MEDIUM }, notes[0]!, notes[1]!, notes[2]!])
    const fourProvider = capturingRegistry()
    await analyze(four.fetch, fourProvider.registry, [1, 10, 11, 12])
    expect(inputOf(fourProvider.generate).extractedSourceTexts[0]).toEqual({ displayName: 'Source 1', text: medium })

    const five = directus([{ ...DOCX_ROW, bytes: MEDIUM }, ...notes])
    const fiveProvider = capturingRegistry()
    const result = await analyze(five.fetch, fiveProvider.registry, [1, 10, 11, 12, 13])
    expect(result.fileResults[0]).toEqual({ displayName: 'LT180C manual.docx', status: 'unreadable', reason: TOO_COMPLEX })
    expect(inputOf(fiveProvider.generate).extractedSourceTexts.map(source => source.text)).toEqual(['Note A', 'Note B', 'Note C', 'Note D'])
  })

  it('refuses a document whose text is over the share it was given', async () => {
    expect(await extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 1', { maxChars: 20 })).toEqual({ ok: false, code: 'too_complex' })
  })
})

describe('one Office gate for Word and Excel', () => {
  /** A gate that also records how many Office parses were ever running at once. */
  function observedGate() {
    const inner = createOfficeExtractionGate()
    let running = 0
    let peak = 0
    const gate: OfficeExtractionGate = {
      run: (task, options) => inner.run(async () => {
        running += 1
        peak = Math.max(peak, running)
        try {
          return await task()
        }
        finally {
          running -= 1
        }
      }, options),
      stats: () => inner.stats(),
    }
    return { gate, peak: () => peak }
  }

  it('Word and Excel parses started together never overlap: they share one queue', async () => {
    const { gate, peak } = observedGate()
    const workbook = toArrayBuffer(XLSX_ROW.bytes)
    const document = toArrayBuffer(SPEC_DOCX)
    const results = await Promise.all([
      extractTextFromFile(workbook, XLSX, 'Source 1', { officeGate: gate }),
      extractTextFromFile(document, DOCX_MIME, 'Source 2', { officeGate: gate }),
      extractTextFromFile(workbook, XLSX, 'Source 3', { officeGate: gate }),
      extractTextFromFile(document, DOCX_MIME, 'Source 4', { officeGate: gate }),
    ])
    expect(results.map(result => result.ok)).toEqual([true, true, true, true])
    expect(peak()).toBe(1)
    expect(gate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('while a workbook holds the slot, a document waits in the same queue and is parsed only after it', async () => {
    const gate = createOfficeExtractionGate()
    const workbook = deferred()
    const order: string[] = []
    const held = gate.run(async () => {
      await workbook.promise
      order.push('workbook done')
    }, { deadline: Date.now() + 60_000 })

    const reading = extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 1', { officeGate: gate }).then((result) => {
      order.push('document done')
      return result
    })
    await flush()
    expect(gate.stats()).toEqual({ active: 1, queued: 1 })
    expect(order).toEqual([])

    workbook.resolve()
    await held
    expect((await reading).ok).toBe(true)
    expect(order).toEqual(['workbook done', 'document done'])
  })

  it('one active, three waiting across both formats, and a fifth Office document is told busy at once', async () => {
    const gate = createOfficeExtractionGate()
    const hold = deferred()
    const held = gate.run(() => hold.promise, { deadline: Date.now() + 60_000 })
    const waiting = [
      extractTextFromFile(toArrayBuffer(XLSX_ROW.bytes), XLSX, 'Source 1', { officeGate: gate }),
      extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 2', { officeGate: gate }),
      extractTextFromFile(toArrayBuffer(XLSX_ROW.bytes), XLSX, 'Source 3', { officeGate: gate }),
    ]
    await flush()
    expect(gate.stats()).toEqual({ active: 1, queued: 3 })

    expect(await extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 5', { officeGate: gate })).toEqual({ ok: false, code: 'busy' })

    hold.resolve()
    await held
    expect((await Promise.all(waiting)).map(result => result.ok)).toEqual([true, true, true])
    expect(gate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('by default a document waits for the very gate a workbook uses', async () => {
    const hold = deferred()
    const held = officeExtractionGate.run(() => hold.promise, { deadline: Date.now() + 60_000 })
    const started = Date.now()
    expect(await extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 1', { timeoutMs: 50 })).toEqual({ ok: false, code: 'busy' })
    expect(Date.now() - started).toBeLessThan(2_000)
    hold.resolve()
    await held
    expect(officeExtractionGate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('a document waiting for a busy Office reader gives up at its own 5-second deadline, and the other sources are still analyzed', async () => {
    vi.useFakeTimers({ now: 0 })
    let release!: () => void
    const held = officeExtractionGate.run(() => new Promise<void>((done) => {
      release = done
    }), { deadline: 3_600_000 })
    const { fetch } = directus([DOCX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()

    const promise = analyze(fetch, registry, [1, 2])
    await vi.advanceTimersByTimeAsync(MAX_DOCX_PROCESSING_MS + 1)
    const result = await promise
    release()
    await held

    expect(result.fileResults).toEqual([
      { displayName: 'LT180C manual.docx', status: 'unreadable', reason: BUSY },
      { displayName: 'LT180C notes.txt', status: 'read' },
    ])
    expect(generate).toHaveBeenCalledTimes(1)
    expect(officeExtractionGate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('never starts parsing once the time it may wait has run out, and gives a document at most 5 seconds', async () => {
    const gate = createOfficeExtractionGate()
    const hold = deferred()
    const held = gate.run(() => hold.promise, { deadline: Date.now() + 60_000 })
    expect(await extractTextFromFile(toArrayBuffer(SPEC_DOCX), DOCX_MIME, 'Source 1', { timeoutMs: 50, officeGate: gate })).toEqual({ ok: false, code: 'busy' })
    expect(gate.stats()).toEqual({ active: 1, queued: 0 })
    hold.resolve()
    await held

    const deadlines: number[] = []
    const recording: OfficeExtractionGate = {
      async run<T>(task: () => Promise<T>, { deadline }: { deadline: number }) {
        deadlines.push(deadline - Date.now())
        return { ok: true as const, value: await task() }
      },
      stats: () => ({ active: 0, queued: 0 }),
    }
    const bytes = toArrayBuffer(SPEC_DOCX)
    expect((await extractTextFromFile(bytes, DOCX_MIME, 'Source 1', { timeoutMs: 60_000, officeGate: recording })).ok).toBe(true)
    expect((await extractTextFromFile(bytes, DOCX_MIME, 'Source 1', { timeoutMs: 2_000, officeGate: recording })).ok).toBe(true)
    expect(await extractTextFromFile(bytes, DOCX_MIME, 'Source 1', { timeoutMs: 0, officeGate: recording })).toEqual({ ok: false, code: 'timeout' })
    expect(MAX_DOCX_PROCESSING_MS).toBe(5_000)
    expect(deadlines).toHaveLength(2)
    expect(deadlines[0]).toBeGreaterThan(4_000)
    expect(deadlines[0]).toBeLessThanOrEqual(5_000)
    expect(deadlines[1]).toBeGreaterThan(1_000)
    expect(deadlines[1]).toBeLessThanOrEqual(2_000)
  })
})

describe('the original document never reaches the provider, and nothing is written', () => {
  const deepseek = () => createDefaultAiProviderRegistry({
    defaultProvider: 'deepseek',
    openai: { apiKey: '', model: '' },
    deepseek: { apiKey: 'test-only-not-a-key', model: 'test-only-model' },
  })

  it('with the real DeepSeek adapter: one request, carrying visible structured text only', async () => {
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    const document = buildDocx({
      body: [
        heading(1, 'LT180C'),
        paraXml(`${run('Voltage ')}<w:del w:id="1" w:author="TEST ONLY"><w:r><w:delText>380 V</w:delText></w:r></w:del><w:ins w:id="2" w:author="TEST ONLY">${run('220 V')}</w:ins>`),
        paraXml(run('Aperture 180 mm') + run(' Internal cost 123', '<w:vanish/>')),
        paraXml(`<w:commentRangeStart w:id="0"/>${run('Weight 45 kg')}<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`),
        paraXml('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> INCLUDETEXT "C:\\private.docx" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + run('Belt 300 mm') + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'),
        paraXml(`<w:hyperlink r:id="rIdLink">${run('LITUBO technical page')}</w:hyperlink>`),
      ].join(''),
      documentRelationships: `<Relationship Id="rIdLink" Type="${REL}/hyperlink" Target="https://example.invalid/technical" TargetMode="External"/>`
        + `<Relationship Id="rIdComments" Type="${REL}/comments" Target="comments.xml"/>`,
      extraEntries: [{ name: 'word/comments.xml', data: '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0"><w:p><w:r><w:t>maybe use 380V</w:t></w:r></w:p></w:comment></w:comments>' }],
    })
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: Record<string, unknown>) => {
      requests.push(String(init.body))
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(VALID_PROPOSAL) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { fetch } = directus([{ ...DOCX_ROW, bytes: document }])
    const result = await analyze(fetch, deepseek(), [1])

    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(1)
    const body = requests[0]!
    const input = (JSON.parse(body) as { input: string }).input
    // The source section is exactly the visible document: the new value only, no hidden text, comment, field path or link target.
    expect(input.slice(input.indexOf('--- Source: Source 1 ---'))).toBe(
      '--- Source: Source 1 ---\n# LT180C\nVoltage 220 V\nAperture 180 mm\nWeight 45 kg\nBelt 300 mm\nLITUBO technical page',
    )
    expect(body).not.toContain('PK\\u0003\\u0004')
    expect(body).not.toContain(Buffer.from(document).toString('base64').slice(0, 48))
    expect(body).not.toMatch(/data:application\/vnd|\/assets\/|uuid-docx|LT180C manual\.docx|<w:|document\.xml|Content_Types|word\//)
    expect(body).not.toMatch(/Internal cost|maybe use|INCLUDETEXT|private\.docx|example\.invalid/)
  })

  it('a provider failure during a document analysis is one request — no retry, no fallback to another provider', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requests.push(String(url))
      return new Response('{}', { status: 503 })
    }))
    const { fetch } = directus([DOCX_ROW, TXT_ROW])
    const result = await analyze(fetch, deepseek(), [1, 2])

    expect(result.ok).toBe(false)
    expect(requests).toHaveLength(1)
  })

  it('analyzing a document writes nothing: every Directus call is a read, through products_files only', async () => {
    const { fetch, calls } = directus([DOCX_ROW, TXT_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry } = capturingRegistry()
    await analyze(fetch, registry, [1, 2])

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call.options?.method ?? 'GET').toBe('GET')
    expect([...new Set(calls.map(call => call.path.split('?')[0]))].sort()).toEqual([
      '/assets/uuid-docx', '/assets/uuid-txt', '/items/products', '/items/products/3', '/items/products_files',
    ])
  })
})
