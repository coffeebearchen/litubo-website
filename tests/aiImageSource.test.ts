/**
 * AI-IMAGE-OCR-SOURCE-01 — an image joins the one existing analysis path.
 *
 * The image reader is a stand-in for the document-extractor (its real behaviour
 * is tested in `documentExtractorImage*.test.ts`); everything on the Nuxt side
 * is real: the format contract, the signature check, the three-image limit, the
 * reading clock, the character shares, dedupe, the relevance guard and the one
 * provider call. Every Directus call is a mock; the provider is a capturing
 * registry or the real DeepSeek adapter with global fetch stubbed: 0 real
 * provider calls.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { runProposalEngine } from '../server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '../server/utils/aiProviderRegistryDefault'
import type { AiProviderRegistry } from '../server/utils/aiProviderRegistry'
import { PRODUCT_MODEL_RELEVANCE_GUARD, PROMPT_CONTRACT_VERSION, type AiGenerationInput } from '../server/utils/aiTargetContract'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import {
  MAX_IMAGE_READ_MS,
  MAX_IMAGES_PER_ANALYSIS,
  OCR_TRANSCRIPTION_HEADER,
  extractTextFromFile,
  type SourceReaders,
} from '../server/utils/aiTextExtraction'
import type { ImageTextReadResult, ImageTextReader } from '../server/utils/documentExtractorClient'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { aiSourceFormatFor, isAiSourceReadableNow, sourceFailureMessage } from '../utils/aiSourceFormats'
import { MAX_IMAGES_PER_ANALYSIS as CLIENT_MAX_IMAGES } from '../utils/aiProposal'
import { buildTextPdf, TEST_ONLY_MARK } from './helpers/testOnlyPdf'
import { tableXlsx } from './helpers/testOnlyXlsx'
import { DOCX_MIME, docx, para } from './helpers/testOnlyDocx'
import { fixture } from './helpers/testOnlyImage'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MB = 1024 * 1024
const PRODUCT_NAME = '[TEST ONLY — NOT FOR PUBLICATION] LT-180C Free-Fall Metal Detector'
const VALID_PROPOSAL = { groups: [{ group: 'Electrical', items: [{ parameter: 'Voltage', value: '220 V' }] }] }

const NOTHING_READ = 'None of the selected files could be read as text. Nothing was sent to the AI provider.'
const IMAGE_LIMIT = 'Select up to 3 images per analysis.'
const MALFORMED = 'This file is damaged or is not a valid document.'
const TOO_COMPLEX = 'This file is too complex to analyze safely. Save the relevant part as a smaller file.'
const IMAGE_NO_TEXT = 'No readable text was found in this image. Images are read for their visible text only.'
const UNAVAILABLE = 'The document reader is unavailable right now. Other sources can still be analyzed.'

const PNG = fixture('TEST-ONLY-nameplate-en.png')
const JPEG = fixture('TEST-ONLY-nameplate-en.jpg')
const WEBP = fixture('TEST-ONLY-nameplate-en.webp')
const NAMEPLATE_OCR = `${TEST_ONLY_MARK}\nLT-180C\nVoltage 220 V\nFrequency 50 Hz\nPower 0.45 kW`

interface Row {
  id: number
  uuid: string
  filename: string
  type: string
  bytes: Uint8Array
  filesize?: number
}

const text = (value: string) => new TextEncoder().encode(value)
const toArrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const imageRow = (id: number, bytes: Uint8Array = PNG, type = 'image/png'): Row => ({ id, uuid: `uuid-image-${id}`, filename: `TEST-ONLY-image-${id}.${type.split('/')[1]}`, type, bytes })
const DOCX_ROW: Row = { id: 20, uuid: 'uuid-docx', filename: 'LT180C manual.docx', type: DOCX_MIME, bytes: docx([para('Aperture: 180 mm')]) }
const TXT_ROW: Row = { id: 21, uuid: 'uuid-txt', filename: 'LT180C notes.txt', type: 'text/plain', bytes: text('Weight: 45 kg') }
const PDF_ROW: Row = { id: 22, uuid: 'uuid-pdf', filename: 'LT180C datasheet.pdf', type: 'application/pdf', bytes: new Uint8Array(buildTextPdf([[TEST_ONLY_MARK, 'Model: LT180C']])) }
const XLSX_ROW: Row = { id: 23, uuid: 'uuid-xlsx', filename: 'LT series parameters.xlsx', type: XLSX, bytes: tableXlsx([['Model', 'Belt width'], ['LT180C', '300 mm']]) }

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

/** A stand-in image reader: the nameplate transcription unless told otherwise. */
function imageReader(answer: (bytes: Uint8Array) => ImageTextReadResult = () => ({ ok: true, text: NAMEPLATE_OCR })) {
  return vi.fn<ImageTextReader>(async bytes => answer(bytes))
}

function readers(image?: ImageTextReader): SourceReaders {
  return { pdf: async () => ({ ok: true, text: 'Model: LT180C\nWeight: 45 kg' }), ...(image ? { image } : {}) }
}

function analyze(fetch: FetchFn, registry: AiProviderRegistry, mediaIds: number[], sourceReaders: SourceReaders) {
  return runProposalEngine(fetch, registry, specificationsTarget, { productId: 3, providerId: 'deepseek', mediaIds }, undefined, sourceReaders)
}

const inputOf = (generate: ReturnType<typeof capturingRegistry>['generate']) => generate.mock.calls[0]![2] as AiGenerationInput

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('images in the shared contract', () => {
  it('JPG, PNG and WebP are AI-readable, labelled Image, 20 MB each; the browser and server share one image limit of 3', () => {
    for (const mime of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) {
      expect(isAiSourceReadableNow(mime)).toBe(true)
      expect(aiSourceFormatFor(mime)?.maxBytes).toBe(20 * MB)
    }
    for (const mime of ['image/gif', 'image/svg+xml', 'image/tiff', 'image/bmp', 'image/heic', 'image/avif']) {
      expect(isAiSourceReadableNow(mime)).toBe(false)
    }
    expect(MAX_IMAGES_PER_ANALYSIS).toBe(3)
    expect(CLIENT_MAX_IMAGES).toBe(MAX_IMAGES_PER_ANALYSIS)
    expect(MAX_IMAGE_READ_MS).toBe(20_000)
    expect(sourceFailureMessage('no_text', 'image/png')).toBe(IMAGE_NO_TEXT)
  })
})

describe('an image in the one analysis path', () => {
  it('an image, a Word document and a TXT file reach one provider call; the image arrives as a labelled OCR transcription', async () => {
    const { fetch } = directus([imageRow(1), DOCX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const read = imageReader()
    const result = await analyze(fetch, registry, [1, 20, 21], readers(read))

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries).toEqual([
      { displayName: 'Source 1', fileType: 'Image' },
      { displayName: 'Source 2', fileType: 'Word' },
      { displayName: 'Source 3', fileType: 'Text' },
    ])
    expect(inputOf(generate).extractedSourceTexts[0]).toEqual({ displayName: 'Source 1', text: `${OCR_TRANSCRIPTION_HEADER}\n${NAMEPLATE_OCR}` })
  })

  it('image, Word, PDF, workbook and TXT together: five sources, one provider call, one merged proposal', async () => {
    const { fetch } = directus([imageRow(1), DOCX_ROW, PDF_ROW, XLSX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 20, 22, 23, 21], readers(imageReader()))

    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries.map(summary => summary.fileType)).toEqual(['Image', 'Word', 'PDF', 'Spreadsheet', 'Text'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toEqual(VALID_PROPOSAL)
  })

  it('the reader is given the stored type and at most 20 seconds of the reading budget', async () => {
    const read = imageReader()
    const result = await extractTextFromFile(toArrayBuffer(JPEG), 'image/jpg', 'Source 1', { readers: readers(read), timeoutMs: 60_000 })
    expect(result.ok).toBe(true)
    expect(read.mock.calls[0]![1]).toEqual({ timeoutMs: 20_000, mimeType: 'image/jpg' })
    await extractTextFromFile(toArrayBuffer(WEBP), 'image/webp', 'Source 1', { readers: readers(read), timeoutMs: 1_500 })
    expect(read.mock.calls[1]![1]).toEqual({ timeoutMs: 1_500, mimeType: 'image/webp' })
  })
})

describe('at most three images per analysis — decided by the server', () => {
  it('three images are analyzed', async () => {
    const rows = [imageRow(1), imageRow(2, JPEG, 'image/jpeg'), imageRow(3, WEBP, 'image/webp')]
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const read = imageReader(bytes => ({ ok: true, text: `Image of ${bytes.byteLength} bytes: LT-180C` }))
    const result = await analyze(fetch, registry, [1, 2, 3], readers(read))
    expect(result.ok).toBe(true)
    expect(read).toHaveBeenCalledTimes(3)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('four images: the analysis does not start — nothing downloaded, no OCR, no provider call', async () => {
    const rows = [1, 2, 3, 4].map(id => imageRow(id))
    const { fetch, calls } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const read = imageReader()
    const result = await analyze(fetch, registry, [1, 2, 3, 4], readers(read))
    expect(result).toEqual({ ok: false, error: IMAGE_LIMIT, fileResults: [] })
    expect(calls.some(call => call.path.startsWith('/assets/'))).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })

  it('three images and two documents is five sources and allowed', async () => {
    const { fetch } = directus([imageRow(1), imageRow(2), imageRow(3), DOCX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const read = imageReader(bytes => ({ ok: true, text: `Transcription ${bytes[20]}${Math.random()}` }))
    const result = await analyze(fetch, registry, [1, 2, 3, 20, 21], readers(read))
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('four images and one document is refused, though it is also five sources', async () => {
    const { fetch } = directus([imageRow(1), imageRow(2), imageRow(3), imageRow(4), TXT_ROW])
    const { registry, generate } = capturingRegistry()
    expect(await analyze(fetch, registry, [1, 2, 3, 4, 21], readers(imageReader()))).toEqual({ ok: false, error: IMAGE_LIMIT, fileResults: [] })
    expect(generate).not.toHaveBeenCalled()
  })
})

describe('partial failure, all failed, and fixed reasons', () => {
  it('an image with no text is reported; the Word document and the TXT file still reach one provider call', async () => {
    const { fetch } = directus([imageRow(1), DOCX_ROW, TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 20, 21], readers(imageReader(() => ({ ok: false, code: 'no_text' }))))
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(inputOf(generate).sourceFileSummaries.map(summary => summary.fileType)).toEqual(['Word', 'Text'])
    expect(result.fileResults[0]).toEqual({ displayName: 'TEST-ONLY-image-1.png', status: 'unreadable', reason: IMAGE_NO_TEXT })
  })

  it('when every selected image fails, the provider is never called, and no reason carries anything internal', async () => {
    const rows = [
      imageRow(1, PNG, 'image/jpeg'), // PNG bytes stored as JPEG
      imageRow(2),
      imageRow(3, WEBP, 'image/webp'),
    ]
    const { fetch } = directus(rows)
    const { registry, generate } = capturingRegistry()
    const read = imageReader(bytes => (bytes.byteLength === WEBP.byteLength ? { ok: false, code: 'too_complex' } : { ok: false, code: 'no_text' }))
    const result = await analyze(fetch, registry, [1, 2, 3], readers(read))
    expect(generate).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(NOTHING_READ)
    expect(result.fileResults.map(outcome => outcome.reason)).toEqual([MALFORMED, IMAGE_NO_TEXT, TOO_COMPLEX])
    // The mismatched file never reached the reader.
    expect(read).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(result)).not.toMatch(/stack|tmp|tesseract|vips|stderr|uuid-image/)
  })

  it('without a configured reader an image is unavailable, and other sources are still analyzed', async () => {
    const { fetch } = directus([imageRow(1), TXT_ROW])
    const { registry, generate } = capturingRegistry()
    const result = await analyze(fetch, registry, [1, 21], readers())
    expect(result.fileResults[0]).toEqual({ displayName: 'TEST-ONLY-image-1.png', status: 'unreadable', reason: UNAVAILABLE })
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('an image over 20 MB by trusted size is refused before download', async () => {
    const { fetch, calls } = directus([{ ...imageRow(1), filesize: 20 * MB + 1 }, TXT_ROW])
    const { registry } = capturingRegistry()
    const read = imageReader()
    const result = await analyze(fetch, registry, [1, 21], readers(read))
    expect(result.fileResults[0]?.reason).toBe('This file is too large to analyze, or its size could not be confirmed.')
    expect(calls.map(call => call.path)).not.toContain('/assets/uuid-image-1')
    expect(read).not.toHaveBeenCalled()
  })

  it('a transcription of 8,000 characters is used; one of 8,001 is refused, never cut', async () => {
    const at = (length: number) => extractTextFromFile(toArrayBuffer(PNG), 'image/png', 'Source 1', { readers: readers(imageReader(() => ({ ok: true, text: 'x'.repeat(length) }))) })
    const exact = await at(8_000)
    expect(exact.ok && exact.source.text).toBe(`${OCR_TRANSCRIPTION_HEADER}\n${'x'.repeat(8_000)}`)
    expect(await at(8_001)).toEqual({ ok: false, code: 'too_complex' })
  })

  it('a transcription that does not fit its share of five sources is refused, never cut', async () => {
    const result = await extractTextFromFile(toArrayBuffer(PNG), 'image/png', 'Source 1', { readers: readers(imageReader(() => ({ ok: true, text: 'x'.repeat(8_000) }))), maxChars: 5_000 })
    expect(result).toEqual({ ok: false, code: 'too_complex' })
  })
})

describe('OCR text and product attribution', () => {
  it('both models on one image are kept; the current product, its code and the guard go with them into one call', async () => {
    const { fetch } = directus([imageRow(1, fixture('TEST-ONLY-multi-model.png'))], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1], readers(imageReader(() => ({ ok: true, text: `${TEST_ONLY_MARK}\nLT180C 220 V\nLT200C 380 V` }))))

    expect(generate).toHaveBeenCalledTimes(1)
    const target = generate.mock.calls[0]![1] as typeof specificationsTarget
    expect(target.systemInstructions).toContain(PRODUCT_MODEL_RELEVANCE_GUARD)
    const prompt = specificationsTarget.buildUserInput(inputOf(generate))
    expect(prompt.startsWith(`Current product:\nProduct: ${PRODUCT_NAME}\nProduct code: LT-180C\n`)).toBe(true)
    expect(prompt).toContain('LT180C 220 V\nLT200C 380 V')
    expect(prompt).not.toContain('Filtered to exact product code')
  })

  it('[?] regression: the shared prompt contract still forbids inferring from [?], unchanged at version 2', () => {
    expect(PRODUCT_MODEL_RELEVANCE_GUARD).toContain('Text marked [?] could not be read reliably. Never infer a value from text marked [?].')
    expect(PROMPT_CONTRACT_VERSION).toBe(2)
    expect(OCR_TRANSCRIPTION_HEADER).toBe('OCR transcription — low-confidence text is marked [?].')
    expect(OCR_TRANSCRIPTION_HEADER).not.toMatch(/verified|confirmed|accurate/i)
  })

  it('a low-confidence transcription reaches the provider with its [?] marks intact', async () => {
    const { fetch } = directus([imageRow(1)])
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1], readers(imageReader(() => ({ ok: true, text: 'Model [?]\nVoltage 220 V' }))))
    expect(specificationsTarget.buildUserInput(inputOf(generate))).toContain(`${OCR_TRANSCRIPTION_HEADER}\nModel [?]\nVoltage 220 V`)
  })

  it('the file name is only a display name: an image called LT180C.jpg says nothing about its content', async () => {
    const { fetch } = directus([{ ...imageRow(1), filename: 'LT180C.png' }])
    const { registry, generate } = capturingRegistry()
    await analyze(fetch, registry, [1], readers(imageReader(() => ({ ok: true, text: 'Belt 300 mm' }))))
    expect(JSON.stringify(inputOf(generate))).not.toContain('LT180C.png')
  })
})

describe('the original image never reaches the provider, and nothing is written', () => {
  const deepseek = () => createDefaultAiProviderRegistry({
    defaultProvider: 'deepseek',
    openai: { apiKey: '', model: '' },
    deepseek: { apiKey: 'test-only-not-a-key', model: 'test-only-model' },
  })

  it('with the real DeepSeek adapter: one request, carrying the transcription only — no bytes, base64, data URI, URL, EXIF or TSV', async () => {
    const orientation = fixture('TEST-ONLY-orientation-6.jpg')
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: Record<string, unknown>) => {
      requests.push(String(init.body))
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(VALID_PROPOSAL) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { fetch } = directus([imageRow(1, orientation, 'image/jpeg')])
    const result = await analyze(fetch, deepseek(), [1], readers(imageReader(() => ({ ok: true, text: `${TEST_ONLY_MARK}\nLT-180C\nAperture 180 mm` }))))

    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(1)
    const body = requests[0]!
    const input = (JSON.parse(body) as { input: string }).input
    expect(input.slice(input.indexOf('--- Source: Source 1 ---'))).toBe(`--- Source: Source 1 ---\n${OCR_TRANSCRIPTION_HEADER}\n${TEST_ONLY_MARK}\nLT-180C\nAperture 180 mm`)
    expect(body).not.toContain(Buffer.from(orientation).toString('base64').slice(0, 48))
    expect(body).not.toMatch(/data:image|\/assets\/|uuid-image|TEST-ONLY-image-1|GPS SECRET|Artist Secret|Exif|level\\tpage_num|\\tconf\\t|bounding|left\\ttop/)
  })

  it('analyzing images writes nothing: every Directus call is a read', async () => {
    const { fetch, calls } = directus([imageRow(1), TXT_ROW], { name_en: PRODUCT_NAME, product_code: 'LT-180C' })
    const { registry } = capturingRegistry()
    await analyze(fetch, registry, [1, 21], readers(imageReader()))
    for (const call of calls) expect(call.options?.method ?? 'GET').toBe('GET')
    expect([...new Set(calls.map(call => call.path.split('?')[0]))].sort()).toEqual([
      '/assets/uuid-image-1', '/assets/uuid-txt', '/items/products', '/items/products/3', '/items/products_files',
    ])
  })
})
