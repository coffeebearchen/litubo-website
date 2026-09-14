/**
 * AI-IMAGE-OCR-SOURCE-01 — the image route of the document-extractor sidecar,
 * tested without Docker.
 *
 * The HTTP surface, the format and dimension checks, the preparation steps, the
 * TSV reading, the limits, cleanup and the queue shared with PDF run against the
 * real server code, with libvips and Tesseract replaced by scripted outcomes.
 * Real libvips, Tesseract, prlimit and the container are tested in
 * `tests/documentExtractorImageIntegration.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_FAILURE_CODES,
  IMAGE_LIMITS,
  IMAGE_TASK_DEADLINE_MS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_WIDTH,
  MAX_OCR_RAW_OUTPUT_CHARS,
  MAX_OCR_TEXT_CHARS,
  OCR_LANGUAGES,
  OCR_MAX_LONG_EDGE,
  OCR_MIN_WORD_CONFIDENCE,
  OCR_PAGE_SEGMENTATION_MODE,
  createExtractorServer,
  detectImageType,
  ocrTextFromTsv,
  parseVipsHeader,
} from '../document-extractor/extractor.mjs'
import { brokenImage, fixture, solidPng, tesseractTsv } from './helpers/testOnlyImage'

type Outcome = Record<string, unknown>
interface ToolOptions { deadline: number, signal?: AbortSignal, maxStdoutChars: number, env?: Record<string, string> }
interface ToolCall { tool: string, args: string[], options: ToolOptions }
type Handler = (call: ToolCall) => Outcome | Promise<Outcome>
type ServerOptions = NonNullable<Parameters<typeof createExtractorServer>[0]>

const PNG = fixture('TEST-ONLY-nameplate-en.png')
const JPEG = fixture('TEST-ONLY-nameplate-en.jpg')
const WEBP = fixture('TEST-ONLY-nameplate-en.webp')
const PDF_BODY = Buffer.from('%PDF-1.7\n%TEST ONLY — NOT FOR PUBLICATION\n', 'utf-8')

const NAMEPLATE_TSV = tesseractTsv([
  [['TEST', 96], ['ONLY', 90], ['—', 90], ['NOT', 96], ['FOR', 96], ['PUBLICATION', 96]],
  [['LT-180C', 91]],
  [['Voltage', 96], ['220', 93], ['V', 92]],
])

function exited(stdout: string, extra: Outcome = {}): Outcome {
  return { kind: 'exited', code: 0, signal: null, stdout, stderr: '', truncated: false, ...extra }
}

/** The file a tool call reads or writes, without libvips' `[strip]` option suffix. */
const pathOf = (arg: string) => arg.replace(/\[[^\]]*\]$/, '')

/**
 * Scripted libvips and Tesseract. By default an ordinary 1400 × 520 RGB PNG is
 * read, scaled, and transcribed as the nameplate; `writeFiles` makes each vips
 * operation create its output file, as the real one does, so cleanup is visible.
 */
function scriptedImageTools(overrides: Partial<Record<'header' | 'scaledHeader' | 'thumbnail' | 'flatten' | 'tesseract' | 'pdftotext', Handler>> = {}, { writeFiles = false } = {}) {
  const calls: ToolCall[] = []
  /** Rasters written by `vips thumbnail`; a vipsheader call on any other path is reading an uploaded original. */
  const scaledPaths = new Set<string>()
  const runTool = vi.fn(async (tool: string, args: string[], options: ToolOptions) => {
    const call = { tool, args, options }
    calls.push(call)
    if (tool === 'vipsheader') {
      const original = !scaledPaths.has(args[0]!)
      const handler = original ? overrides.header : overrides.scaledHeader
      // The original is opened with its own format's loader; the scaled raster is always a PNG.
      const loader = original && args[0]!.endsWith('.jpg') ? 'jpegload' : original && args[0]!.endsWith('.webp') ? 'webpload' : 'pngload'
      return handler ? handler(call) : exited(`${args[0]}: 1400x520 uchar, 3 bands, srgb, ${loader}\n`)
    }
    if (tool === 'vips') {
      if (args[0] === 'thumbnail') scaledPaths.add(pathOf(args[2]!))
      if (writeFiles) writeFileSync(pathOf(args[2]!), 'raster')
      const handler = args[0] === 'thumbnail' ? overrides.thumbnail : overrides.flatten
      return handler ? handler(call) : exited('')
    }
    if (tool === 'tesseract') return overrides.tesseract ? overrides.tesseract(call) : exited(NAMEPLATE_TSV)
    if (tool === 'pdfinfo') return exited('Pages:           1\nEncrypted:       no\n')
    if (tool === 'pdftotext') return overrides.pdftotext ? overrides.pdftotext(call) : exited('Aperture: 180 mm\n')
    return { kind: 'spawn_error' }
  })
  return { runTool, calls }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function startServer(options: Partial<ServerOptions> = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'extractor-image-test-'))
  const log = vi.fn()
  const server = createExtractorServer({ tmpDir, log, ...options } as ServerOptions)
  await new Promise<void>(done => server.listen(0, '127.0.0.1', () => done()))
  cleanups.push(() => {
    server.closeAllConnections()
    server.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })
  const { port } = server.address() as AddressInfo
  const queueStats = () => (server as unknown as { extractorQueue: { stats(): Record<string, number> } }).extractorQueue.stats()
  return { base: `http://127.0.0.1:${port}`, tmpDir, log, queueStats }
}

async function post(base: string, body: Uint8Array, contentType: string, path = '/extract/image') {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': contentType }, body: body as unknown as BodyInit })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

// ── Production limits ──

describe('image V1 limits are fixed in code', () => {
  it('20 MB, 12,000 × 12,000, 50 MP, a 3,000 px long edge, 20 s, 8,000 characters, a 4 MB raw cap, confidence 40, eng+chi_sim, PSM 3', () => {
    expect(MAX_IMAGE_BYTES).toBe(20 * 1024 * 1024)
    expect(MAX_IMAGE_WIDTH).toBe(12_000)
    expect(MAX_IMAGE_HEIGHT).toBe(12_000)
    expect(MAX_IMAGE_PIXELS).toBe(50_000_000)
    expect(OCR_MAX_LONG_EDGE).toBe(3_000)
    expect(IMAGE_TASK_DEADLINE_MS).toBe(20_000)
    expect(MAX_OCR_TEXT_CHARS).toBe(8_000)
    expect(MAX_OCR_RAW_OUTPUT_CHARS).toBe(4 * 1024 * 1024)
    expect(OCR_MIN_WORD_CONFIDENCE).toBe(40)
    expect(OCR_LANGUAGES).toBe('eng+chi_sim')
    expect(OCR_PAGE_SEGMENTATION_MODE).toBe(3)
    expect(IMAGE_LIMITS).toEqual({
      maxWidth: 12_000, maxHeight: 12_000, maxPixels: 50_000_000, maxOcrChars: 8_000, maxRawOutputChars: 4 * 1024 * 1024, minWordConfidence: 40,
    })
    expect(IMAGE_FAILURE_CODES).toEqual(['too_large', 'too_complex', 'malformed', 'no_text', 'timeout', 'unsafe_parse', 'busy'])
    expect(IMAGE_CONTENT_TYPES).toEqual({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' })
  })
})

// ── Format checks ──

describe('the real format is read from the bytes, never taken from the request', () => {
  it('recognizes JPEG, PNG and WebP by signature, and nothing else', () => {
    expect(detectImageType(Buffer.from(JPEG))).toBe('jpeg')
    expect(detectImageType(Buffer.from(PNG))).toBe('png')
    expect(detectImageType(Buffer.from(WEBP))).toBe('webp')
    for (const other of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>LT-180C</text></svg>'),
      Buffer.from('GIF89a\x01\x00\x01\x00'),
      Buffer.from([0x49, 0x49, 0x2A, 0x00]), // TIFF
      Buffer.from([0x42, 0x4D, 0x00, 0x00]), // BMP
      Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt '),
      Buffer.from('%PDF-1.7'),
      Buffer.alloc(0),
    ]) expect(detectImageType(other)).toBeNull()
  })

  it.each([
    ['PNG bytes declared as JPEG', PNG, 'image/jpeg'],
    ['JPEG bytes declared as PNG', JPEG, 'image/png'],
    ['WebP bytes declared as PNG', WEBP, 'image/png'],
    ['an SVG declared as PNG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><text>LT-180C</text></svg>'), 'image/png'],
    ['a GIF declared as PNG', new TextEncoder().encode('GIF89a\x01\x00\x01\x00\x00\x00\x00'), 'image/png'],
    ['random bytes declared as WebP', new Uint8Array(512).fill(7), 'image/webp'],
  ])('%s is malformed and never written or run', async (_label, body, contentType) => {
    const { runTool } = scriptedImageTools()
    const { base, tmpDir } = await startServer({ runTool })
    expect(await post(base, body, contentType)).toEqual({ status: 422, body: { ok: false, code: 'malformed' } })
    expect(runTool).not.toHaveBeenCalled()
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it.each(['image/gif', 'image/svg+xml', 'image/tiff', 'image/bmp', 'image/heic', 'image/avif', 'image/jpg', 'application/pdf', 'application/octet-stream'])('%s is not a content type the image route takes (415)', async (contentType) => {
    const { runTool } = scriptedImageTools()
    const { base } = await startServer({ runTool })
    expect(await post(base, PNG, contentType)).toEqual({ status: 415, body: { ok: false, code: 'unsupported' } })
    expect(runTool).not.toHaveBeenCalled()
  })

  it('only POST is allowed; the PDF route still takes only PDF', async () => {
    const { runTool } = scriptedImageTools()
    const { base } = await startServer({ runTool })
    const get = await fetch(`${base}/extract/image`)
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
    expect(await post(base, PNG, 'image/png', '/extract/pdf')).toEqual({ status: 415, body: { ok: false, code: 'unsupported' } })
    expect(await post(base, PDF_BODY, 'application/pdf', '/extract/image')).toEqual({ status: 415, body: { ok: false, code: 'unsupported' } })
  })

  it('a declared Content-Length over 20 MB is refused (413) before any body is read', async () => {
    const { runTool } = scriptedImageTools()
    const { base } = await startServer({ runTool, maxImageBytes: 1024 })
    expect(await post(base, PNG, 'image/png')).toEqual({ status: 413, body: { ok: false, code: 'too_large' } })
    expect(runTool).not.toHaveBeenCalled()
  })

  it('an image must open with the one libvips loader its format allows', async () => {
    for (const loader of ['magickload', 'svgload', 'jpegload', 'pdfload', 'heifload']) {
      const { runTool, calls } = scriptedImageTools({ header: call => exited(`${call.args[0]}: 1400x520 uchar, 3 bands, srgb, ${loader}\n`) })
      const { base } = await startServer({ runTool })
      expect(await post(base, PNG, 'image/png'), loader).toEqual({ status: 422, body: { ok: false, code: 'malformed' } })
      expect(calls.map(call => call.tool)).toEqual(['vipsheader'])
    }
  })

  it('a header vipsheader cannot read, or cannot be trusted, is malformed; nothing else runs', async () => {
    for (const header of [
      exited('', { code: 1, stderr: 'VipsForeignLoad: "/tmp/secret.png" is not a known file format' }),
      exited('/tmp/x.png: 1400x520 uchar, 3 bands, srgb, pngload\n/tmp/x.png: 1x1 uchar, 3 bands, srgb, pngload\n'),
      exited('/tmp/x.png: many pixels\n'),
      exited('/tmp/x.png: 0x520 uchar, 3 bands, srgb, pngload\n'),
    ]) {
      const { runTool, calls } = scriptedImageTools({ header: () => header })
      const { base } = await startServer({ runTool })
      const result = await post(base, PNG, 'image/png')
      expect(result).toEqual({ status: 422, body: { ok: false, code: 'malformed' } })
      expect(JSON.stringify(result)).not.toMatch(/secret|VipsForeign|tmp/)
      expect(calls.map(call => call.tool)).toEqual(['vipsheader'])
    }
  })
})

// ── Dimensions ──

describe('dimensions and pixels are checked from the header, before a pixel is decoded', () => {
  it('reads vipsheader\'s one-line summary', () => {
    expect(parseVipsHeader('/tmp/a.png: 1400x520 uchar, 3 bands, srgb, pngload\n')).toEqual({ width: 1400, height: 520, bands: 3, loader: 'pngload' })
    expect(parseVipsHeader('/tmp/a.png: 1200x420 uchar, 4 bands, srgb, pngload')).toEqual({ width: 1200, height: 420, bands: 4, loader: 'pngload' })
    expect(parseVipsHeader('/tmp/a.jpg: 800x600 uchar, 1 band, b-w, jpegload')).toEqual({ width: 800, height: 600, bands: 1, loader: 'jpegload' })
    expect(parseVipsHeader('')).toBeNull()
    expect(parseVipsHeader('garbage')).toBeNull()
  })

  it.each([
    ['12,000 wide', 12_000, 100, 200, 'ok'],
    ['12,001 wide', 12_001, 100, 422, 'too_complex'],
    ['12,000 high', 100, 12_000, 200, 'ok'],
    ['12,001 high', 100, 12_001, 422, 'too_complex'],
    ['49,999,041 pixels (7,071²)', 7_071, 7_071, 200, 'ok'],
    ['50,013,184 pixels (7,072²)', 7_072, 7_072, 422, 'too_complex'],
    ['12,000 × 4,167 = 50,004,000 pixels, each edge within limit', 12_000, 4_167, 422, 'too_complex'],
    ['a 100,000 × 100,000 bomb', 100_000, 100_000, 422, 'too_complex'],
  ])('%s → %s', async (_label, width, height, status, result) => {
    const { runTool, calls } = scriptedImageTools({ header: call => exited(`${call.args[0]}: ${width}x${height} uchar, 3 bands, srgb, pngload\n`) })
    const { base } = await startServer({ runTool })
    const answer = await post(base, PNG, 'image/png')
    expect(answer.status).toBe(status)
    if (result === 'too_complex') {
      expect(answer.body).toEqual({ ok: false, code: 'too_complex' })
      expect(calls.map(call => call.tool)).toEqual(['vipsheader'])
    }
    else {
      expect(calls.map(call => call.tool)).toContain('tesseract')
    }
  })
})

// ── Preparation and OCR ──

describe('one deterministic pipeline: header, upright and scaled down, flattened only with alpha, one OCR pass', () => {
  it('runs exactly these commands, with the service\'s own file names and a restricted environment', async () => {
    const { runTool, calls } = scriptedImageTools()
    const { base, tmpDir } = await startServer({ runTool })
    expect(await post(base, PNG, 'image/png')).toEqual({ status: 200, body: { ok: true, text: 'TEST ONLY — NOT FOR PUBLICATION\nLT-180C\nVoltage 220 V' } })

    const [header, thumbnail, scaledHeader, tesseract] = calls
    expect(calls.map(call => call.tool)).toEqual(['vipsheader', 'vips', 'vipsheader', 'tesseract'])
    const original = header!.args[0]!
    expect(original.startsWith(tmpDir)).toBe(true)
    expect(original.slice(tmpDir.length + 1)).toMatch(/^[0-9a-f-]{36}\.png$/)
    const scaled = pathOf(thumbnail!.args[2]!)
    expect(thumbnail!.args).toEqual(['thumbnail', original, `${scaled}[strip]`, '3000', '--height', '3000', '--size', 'down', '--fail-on', 'truncated'])
    expect(scaled.slice(tmpDir.length + 1)).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(scaledHeader!.args).toEqual([scaled])
    expect(tesseract!.args).toEqual([scaled, 'stdout', '-l', 'eng+chi_sim', '--psm', '3', '--oem', '1', 'tsv'])
    expect(tesseract!.options.maxStdoutChars).toBe(4 * 1024 * 1024)

    for (const call of calls.filter(c => c.tool.startsWith('vips'))) {
      expect(call.options.env).toMatchObject({ VIPS_CONCURRENCY: '1', VIPS_BLOCK_UNTRUSTED: '1', MALLOC_ARENA_MAX: '1' })
    }
    expect(tesseract!.options.env).toMatchObject({ OMP_THREAD_LIMIT: '1', MALLOC_ARENA_MAX: '1' })
    for (const call of calls) {
      expect(Object.keys(call.options.env ?? {}).every(key => ['PATH', 'LANG', 'VIPS_CONCURRENCY', 'VIPS_BLOCK_UNTRUSTED', 'MALLOC_ARENA_MAX', 'OMP_THREAD_LIMIT'].includes(key))).toBe(true)
    }
    expect(new Set(calls.map(call => call.options.deadline)).size).toBe(1)
  })

  it.each([
    ['a JPEG', JPEG, 'image/jpeg', 'jpegload', '.jpg'],
    ['a WebP', WEBP, 'image/webp', 'webpload', '.webp'],
  ])('%s is read with its own loader and file extension', async (_label, body, contentType, loader, extension) => {
    const { runTool, calls } = scriptedImageTools({ header: call => exited(`${call.args[0]}: 1400x520 uchar, 3 bands, srgb, ${loader}\n`) })
    const { base } = await startServer({ runTool })
    expect((await post(base, body, contentType)).status).toBe(200)
    expect(calls[0]!.args[0]!.endsWith(extension)).toBe(true)
  })

  it('flattens onto white only when the scaled image has an alpha band', async () => {
    for (const [bands, flattened] of [[1, false], [2, true], [3, false], [4, true]] as const) {
      const { runTool, calls } = scriptedImageTools({ scaledHeader: call => exited(`${call.args[0]}: 1200x420 uchar, ${bands} bands, srgb, pngload\n`) })
      const { base } = await startServer({ runTool })
      expect((await post(base, PNG, 'image/png')).status).toBe(200)
      const flatten = calls.find(call => call.tool === 'vips' && call.args[0] === 'flatten')
      expect(Boolean(flatten), `${bands} bands`).toBe(flattened)
      const ocr = calls.find(call => call.tool === 'tesseract')!
      if (flatten) {
        expect(flatten.args.slice(3)).toEqual(['--background', '255'])
        expect(flatten.args[2]!.endsWith('[strip]')).toBe(true)
        expect(ocr.args[0]).toBe(pathOf(flatten.args[2]!))
      }
      else {
        expect(ocr.args[0]).toBe(pathOf(calls[1]!.args[2]!))
      }
    }
  })

  it('a scaled image whose long edge is still over 3,000 px is never read', async () => {
    const { runTool, calls } = scriptedImageTools({ scaledHeader: call => exited(`${call.args[0]}: 3001x1071 uchar, 3 bands, srgb, pngload\n`) })
    const { base } = await startServer({ runTool })
    expect(await post(base, PNG, 'image/png')).toEqual({ status: 422, body: { ok: false, code: 'unsafe_parse' } })
    expect(calls.map(call => call.tool)).not.toContain('tesseract')
  })

  it.each([
    ['pixels that do not decode', { thumbnail: () => exited('', { code: 1, stderr: 'jpegload: /tmp/secret.jpg: Corrupt JPEG data' }) }, 422, 'malformed'],
    ['a crash while decoding', { thumbnail: () => exited('', { code: null, signal: 'SIGSEGV' }) }, 422, 'unsafe_parse'],
    ['libvips missing', { thumbnail: () => ({ kind: 'spawn_error' }) }, 422, 'unsafe_parse'],
    ['Tesseract failing', { tesseract: () => exited('', { code: 1, stderr: 'Error, could not create TSV output file: /tmp/secret' }) }, 422, 'unsafe_parse'],
    ['Tesseract killed by the kernel', { tesseract: () => exited('', { code: null, signal: 'SIGKILL' }) }, 422, 'unsafe_parse'],
    ['output that is not Tesseract TSV', { tesseract: () => exited('LT-180C Voltage 220 V\n') }, 422, 'unsafe_parse'],
    ['raw output past the 4 MB cap', { tesseract: () => exited('level\t', { truncated: true }) }, 422, 'too_complex'],
    ['the deadline during OCR', { tesseract: () => ({ kind: 'deadline' }) }, 504, 'timeout'],
  ] as Array<[string, Partial<Record<'thumbnail' | 'tesseract', Handler>>, number, string]>)('%s → %i %s, with no stderr, path or command in the answer', async (_label, overrides, status, code) => {
    const { runTool } = scriptedImageTools(overrides)
    const { base } = await startServer({ runTool })
    const result = await post(base, PNG, 'image/png')
    expect(result).toEqual({ status, body: { ok: false, code } })
    expect(JSON.stringify(result)).not.toMatch(/secret|Corrupt|tmp|tesseract|stderr|SIG/)
  })
})

// ── TSV → transcription ──

describe('the transcription: lines kept, uncertain words marked [?], nothing guessed', () => {
  it('keeps each line, joins its words, and marks every word under confidence 40 as [?]', () => {
    const tsv = tesseractTsv([
      [['Model', 88], ['LT-18OC', 22]],
      [['Voltage', 96], ['220', 93], ['V', 92]],
      [['Frequency', 39.9], ['50', 40], ['Hz', 95]],
    ])
    expect(ocrTextFromTsv(tsv)).toEqual({ text: 'Model [?]\nVoltage 220 V\n[?] 50 Hz', meaningful: true })
  })

  it('never lets a guessed low-confidence token through', () => {
    const result = ocrTextFromTsv(tesseractTsv([[['Power', 90], ['0.55', 12], ['kW', 90]]]))
    expect(result?.text).toBe('Power [?] kW')
    expect(result?.text).not.toContain('0.55')
  })

  it('neighbouring uncertain words share one [?], and a line of nothing but [?] is left out', () => {
    expect(ocrTextFromTsv(tesseractTsv([
      [['LT180C', 91], ['x', 10], ['y', 5], ['380', 95]],
      [['#', 3], ['%', 2]],
      [['Belt', 94]],
    ]))?.text).toBe('LT180C [?] 380\nBelt')
  })

  it('writes Chinese without spaces between characters, and with spaces between other words', () => {
    expect(ocrTextFromTsv(tesseractTsv([[['测试', 95], ['资料', 96]], [['电压', 95], ['220V', 89]]]))?.text).toBe('测试资料\n电压 220V')
  })

  it('blanks, punctuation alone, or nothing but uncertain words are no text at all', () => {
    expect(ocrTextFromTsv(tesseractTsv([]))).toEqual({ text: '', meaningful: false })
    expect(ocrTextFromTsv(tesseractTsv([[[' ', 95]], [['—', 90], ['|', 85]]]))?.meaningful).toBe(false)
    expect(ocrTextFromTsv(tesseractTsv([[['LT180C', 20]], [['220', 30]]]))?.meaningful).toBe(false)
  })

  it('control and format characters in a word become spaces', () => {
    expect(ocrTextFromTsv(tesseractTsv([[['LT​180C', 90], ['220V', 90]]]))?.text).toBe('LT 180C 220 V')
  })

  it('output without Tesseract\'s TSV header, or with a short row, is not trusted', () => {
    expect(ocrTextFromTsv('LT-180C\nVoltage 220 V')).toBeNull()
    expect(ocrTextFromTsv(`${tesseractTsv([]).split('\n')[0]}\n5\t1\t1\n`)).toBeNull()
  })

  it('an image with no readable text is no_text (422)', async () => {
    const { runTool } = scriptedImageTools({ tesseract: () => exited(tesseractTsv([[[' ', 95]], [['[', 12]]])) })
    const { base } = await startServer({ runTool })
    expect(await post(base, solidPng(64, 64), 'image/png')).toEqual({ status: 422, body: { ok: false, code: 'no_text' } })
  })

  it('8,000 characters of transcription are returned; 8,001 are refused whole, never cut', async () => {
    const at = async (length: number) => {
      const { runTool } = scriptedImageTools({ tesseract: () => exited(tesseractTsv([[['x'.repeat(length), 90]]])) })
      const { base } = await startServer({ runTool })
      return post(base, PNG, 'image/png')
    }
    const exact = await at(8_000)
    expect(exact.status).toBe(200)
    expect(String(exact.body.text)).toHaveLength(8_000)
    expect(await at(8_001)).toEqual({ status: 422, body: { ok: false, code: 'too_complex' } })
  })
})

// ── Temp files ──

describe('every temporary file is deleted, whatever happened', () => {
  it.each([
    ['success', {}],
    ['pixels that do not decode', { thumbnail: () => exited('', { code: 1 }) }],
    ['an OCR error', { tesseract: () => exited('', { code: 1 }) }],
    ['no text', { tesseract: () => exited(tesseractTsv([])) }],
    ['a raw output overflow', { tesseract: () => exited('level', { truncated: true }) }],
    ['the deadline during OCR', { tesseract: () => ({ kind: 'deadline' }) }],
  ] as Array<[string, Partial<Record<'thumbnail' | 'tesseract', Handler>>]>)('%s: original, scaled and flattened rasters are gone', async (_label, overrides) => {
    const { runTool, calls } = scriptedImageTools({
      scaledHeader: call => exited(`${call.args[0]}: 1200x420 uchar, 4 bands, srgb, pngload\n`),
      ...overrides,
    }, { writeFiles: true })
    const { base, tmpDir } = await startServer({ runTool })
    await post(base, PNG, 'image/png')
    expect(calls.length).toBeGreaterThan(1)
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it('a whole-task deadline stops the running step and still cleans up', async () => {
    let toolSignal: AbortSignal | undefined
    const { runTool } = scriptedImageTools({
      tesseract: call => new Promise<Outcome>((done) => {
        toolSignal = call.options.signal
        call.options.signal?.addEventListener('abort', () => done({ kind: 'aborted' }))
      }),
    }, { writeFiles: true })
    const { base, tmpDir } = await startServer({ runTool, imageTaskDeadlineMs: 300 })
    const started = Date.now()
    expect(await post(base, PNG, 'image/png')).toEqual({ status: 504, body: { ok: false, code: 'timeout' } })
    expect(toolSignal?.aborted).toBe(true)
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(readdirSync(tmpDir)).toEqual([])
  })
})

// ── Shared queue ──

describe('PDF and image requests share one queue: one native task at a time', () => {
  it('while a PDF is being extracted, images wait in the same line; with four admitted the fifth is busy; nothing runs in parallel', async () => {
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    let running = 0
    let peak = 0
    const track = async (work: () => Promise<Outcome>) => {
      running += 1
      peak = Math.max(peak, running)
      try {
        return await work()
      }
      finally {
        running -= 1
      }
    }
    const { runTool, calls } = scriptedImageTools({
      pdftotext: () => track(async () => {
        await gate
        return exited('Aperture: 180 mm')
      }),
      tesseract: () => track(async () => exited(NAMEPLATE_TSV)),
    })
    const { base, queueStats } = await startServer({ runTool })

    const pdf = post(base, PDF_BODY, 'application/pdf', '/extract/pdf')
    await vi.waitFor(() => expect(calls.some(call => call.tool === 'pdftotext')).toBe(true))
    const images = [post(base, PNG, 'image/png'), post(base, JPEG, 'image/jpeg'), post(base, WEBP, 'image/webp')]
    await vi.waitFor(() => expect(queueStats().admitted).toBe(4))
    expect(calls.some(call => call.tool === 'vipsheader')).toBe(false)

    expect(await post(base, PNG, 'image/png')).toEqual({ status: 503, body: { ok: false, code: 'busy' } })
    expect(await post(base, PDF_BODY, 'application/pdf', '/extract/pdf')).toEqual({ status: 503, body: { ok: false, code: 'busy' } })

    release()
    expect((await pdf).status).toBe(200)
    expect((await Promise.all(images)).map(result => result.status)).toEqual([200, 200, 200])
    expect(peak).toBe(1)
    await vi.waitFor(() => expect(queueStats()).toEqual({ running: 0, admitted: 0, waiting: 0 }))
  })

  it('while an image is being read, a PDF waits in the same line', async () => {
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    const { runTool, calls } = scriptedImageTools({
      tesseract: async () => {
        await gate
        return exited(NAMEPLATE_TSV)
      },
    })
    const { base, queueStats } = await startServer({ runTool })
    const image = post(base, PNG, 'image/png')
    await vi.waitFor(() => expect(calls.some(call => call.tool === 'tesseract')).toBe(true))
    const pdf = post(base, PDF_BODY, 'application/pdf', '/extract/pdf')
    await vi.waitFor(() => expect(queueStats()).toMatchObject({ running: 1, admitted: 2, waiting: 1 }))
    expect(calls.some(call => call.tool === 'pdfinfo')).toBe(false)
    release()
    expect((await image).status).toBe(200)
    expect((await pdf).status).toBe(200)
  })
})

// ── Logs and source ──

describe('logs and source stay closed', () => {
  it('an image log entry carries an event, an outcome and a duration — never text', async () => {
    const { runTool } = scriptedImageTools()
    const { base, log } = await startServer({ runTool })
    await post(base, PNG, 'image/png')
    await post(base, brokenImage('png'), 'image/jpeg')
    const entries = log.mock.calls.map(call => call[0] as Record<string, unknown>)
    expect(entries).toEqual([
      { event: 'extract_image', result: 'ok', ms: expect.any(Number) },
      { event: 'extract_image', result: 'malformed', ms: expect.any(Number) },
    ])
    expect(JSON.stringify(entries)).not.toMatch(/LT-180C|Voltage/)
  })

  it('the image pipeline names no external service, no vision and no OCR API', () => {
    const source = readFileSync(resolve(process.cwd(), 'document-extractor/extractor.mjs'), 'utf8')
    expect(source).not.toMatch(/https?:\/\/(?!extractor\.invalid)/)
    expect(source).not.toMatch(/vision|textract|openai|deepseek|baidu|tencent|aliyun|azure/i)
    expect(source).toContain('VIPS_BLOCK_UNTRUSTED')
  })
})
