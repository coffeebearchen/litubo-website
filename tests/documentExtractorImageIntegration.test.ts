/**
 * AI-IMAGE-OCR-SOURCE-01 — the real document-extractor reading images, in Docker.
 *
 * Skipped unless DOCUMENT_EXTRACTOR_TEST_URL is set, so CI (which has no Docker)
 * is unaffected. Run locally against the Compose services:
 *
 *   docker compose up -d document-extractor-gateway
 *   DOCUMENT_EXTRACTOR_TEST_URL=http://127.0.0.1:8787
 *   DOCUMENT_EXTRACTOR_TEST_CONTAINER=litubo-cms-document-extractor-1
 *   npx vitest run tests/documentExtractorImageIntegration.test.ts
 *
 * Requests go from this host process through the real client and the gateway to
 * real libvips and Tesseract. Every image is a synthetic TEST ONLY raster from
 * `tests/fixtures/image-ocr/`, or a textless one built in memory. No AI provider
 * is involved.
 */

import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { request as httpRequest, type ClientRequest } from 'node:http'
import { createImageTextReader, createPdfTextReader } from '../server/utils/documentExtractorClient'
import { brokenImage, fixture, headerOnlyPng, solidPng, TEST_ONLY_MARK } from './helpers/testOnlyImage'
import { buildTextPdf } from './helpers/testOnlyPdf'

const BASE_URL = process.env.DOCUMENT_EXTRACTOR_TEST_URL ?? ''
const CONTAINER = process.env.DOCUMENT_EXTRACTOR_TEST_CONTAINER ?? ''

const readImage = createImageTextReader({ baseUrl: BASE_URL })
const ocr = (bytes: Uint8Array, mimeType: string) => readImage(bytes, { timeoutMs: 20_000, mimeType })
const readPdf = createPdfTextReader({ baseUrl: BASE_URL })

async function postRaw(body: Uint8Array, contentType: string) {
  const response = await fetch(new URL('/extract/image', BASE_URL), { method: 'POST', headers: { 'Content-Type': contentType }, body: body as unknown as BodyInit })
  return { status: response.status, text: await response.text() }
}

function openRequest(path: string, headers: Record<string, string>) {
  const url = new URL(path, BASE_URL)
  let resolveAnswer!: (answer: { status: number, body: string }) => void
  const answer = new Promise<{ status: number, body: string }>((done) => {
    resolveAnswer = done
  })
  let answered = false
  const req: ClientRequest = httpRequest({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers }, (res) => {
    answered = true
    let body = ''
    res.setEncoding('utf8')
    res.on('data', (chunk: string) => {
      body += chunk
    })
    res.on('end', () => resolveAnswer({ status: res.statusCode ?? 0, body }))
    res.on('error', () => resolveAnswer({ status: res.statusCode ?? 0, body }))
  })
  req.on('error', () => {
    if (!answered) resolveAnswer({ status: 0, body: '' })
  })
  return { req, answer }
}

function dockerExec(args: string[], input?: Uint8Array, timeoutMs = 60_000): Promise<{ code: number, stdout: string, stderr: string }> {
  return new Promise((done) => {
    const child = execFile('docker', ['exec', ...(input ? ['-i'] : []), CONTAINER, ...args], { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error ? 1 : 0, stdout: String(stdout), stderr: String(stderr) })
    })
    if (input) child.stdin?.end(Buffer.from(input))
  })
}

const pause = (ms: number) => new Promise(done => setTimeout(done, ms))

/** Case- and spacing-tolerant: OCR may put a space where the fixture had none, but every character must be there. */
const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase()
const expectTokens = (text: string, tokens: string[]) => {
  for (const token of tokens) expect(squash(text), token).toContain(squash(token))
}

describe.skipIf(!BASE_URL)('real document-extractor over HTTP — real libvips and Tesseract', () => {
  it('healthz still answers {"ok":true}', async () => {
    const response = await fetch(new URL('/healthz', BASE_URL))
    expect(await response.text()).toBe('{"ok":true}')
  })

  it.each([
    ['PNG', 'TEST-ONLY-nameplate-en.png', 'image/png'],
    ['JPEG', 'TEST-ONLY-nameplate-en.jpg', 'image/jpeg'],
    ['WebP', 'TEST-ONLY-nameplate-en.webp', 'image/webp'],
  ] as const)('English nameplate as %s: the key tokens are transcribed, line by line', async (_format, name, mimeType) => {
    const result = await ocr(fixture(name), mimeType)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectTokens(result.text, ['TEST ONLY', 'NOT FOR PUBLICATION', 'LT-180C', 'Voltage 220 V', 'Frequency 50 Hz', 'Power 0.45 kW'])
    expect(result.text.split('\n').length).toBeGreaterThanOrEqual(5)
    expect(result.text).toMatch(/Voltage\s*220\s*V/)
  })

  it('a transparent PNG is flattened onto white and read', async () => {
    const result = await ocr(fixture('TEST-ONLY-alpha.png'), 'image/png')
    expect(result.ok && result.text).toBeTruthy()
    if (result.ok) expectTokens(result.text, ['LT-200C', 'Voltage 380 V', 'Power 0.55 kW'])
  })

  it('Simplified Chinese is transcribed with the installed chi_sim model', async () => {
    const result = await ocr(fixture('TEST-ONLY-chinese.png'), 'image/png')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectTokens(result.text, ['测试资料', '电压220V', '功率0.45kW'])
  })

  it('an image stored sideways with EXIF orientation 6 is turned upright before OCR, and its metadata text never appears', async () => {
    const result = await ocr(fixture('TEST-ONLY-orientation-6.jpg'), 'image/jpeg')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectTokens(result.text, ['LT-180C', 'Aperture 180 mm'])
    expect(result.text).not.toMatch(/GPS|SECRET|Artist|Software/i)
  })

  it('an image wider than 3,000 px is scaled down and still read', async () => {
    const result = await ocr(fixture('TEST-ONLY-large-4200.png'), 'image/png')
    expect(result.ok && result.text).toBeTruthy()
    if (result.ok) expectTokens(result.text, ['LT-300C', 'Belt 300 mm'])
  })

  it('both models on one image come back whole — attribution is the prompt guard\'s job', async () => {
    const result = await ocr(fixture('TEST-ONLY-multi-model.png'), 'image/png')
    expect(result.ok).toBe(true)
    if (result.ok) expectTokens(result.text, ['LT180C 220 V', 'LT200C 380 V'])
  })

  it('a blank page — an image with no text, like an ordinary photo of nothing readable — is no_text', async () => {
    expect(await ocr(solidPng(800, 600), 'image/png')).toEqual({ ok: false, code: 'no_text' })
    expect(await ocr(solidPng(640, 480, [40, 90, 160]), 'image/png')).toEqual({ ok: false, code: 'no_text' })
  })

  it('a few bytes declaring 100,000 × 100,000 px, or one column over 12,000, are too_complex before decoding; 12,000 passes the check', async () => {
    const started = Date.now()
    expect(await postRaw(headerOnlyPng(100_000, 100_000), 'image/png')).toEqual({ status: 422, text: '{"ok":false,"code":"too_complex"}' })
    expect(await postRaw(headerOnlyPng(12_001, 1), 'image/png')).toEqual({ status: 422, text: '{"ok":false,"code":"too_complex"}' })
    expect(await postRaw(headerOnlyPng(7_072, 7_072), 'image/png')).toEqual({ status: 422, text: '{"ok":false,"code":"too_complex"}' })
    expect(Date.now() - started).toBeLessThan(10_000)
    // Within every limit, the check passes and decoding is tried — and these pixels are not there.
    expect(await postRaw(headerOnlyPng(12_000, 1), 'image/png')).toEqual({ status: 422, text: '{"ok":false,"code":"malformed"}' })
  })

  it.each([
    ['random bytes as PNG', new Uint8Array(4096).fill(0x41), 'image/png'],
    ['a truncated PNG', fixture('TEST-ONLY-nameplate-en.png').subarray(0, 200), 'image/png'],
    ['a JPEG signature over noise', brokenImage('jpeg'), 'image/jpeg'],
    ['a PNG signature over noise', brokenImage('png'), 'image/png'],
    ['a WebP signature over noise', brokenImage('webp'), 'image/webp'],
    ['JPEG bytes declared as PNG', fixture('TEST-ONLY-nameplate-en.jpg'), 'image/png'],
    ['an SVG declared as PNG', new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><text>${TEST_ONLY_MARK}</text></svg>`), 'image/png'],
  ])('%s is malformed, with nothing internal in the answer', async (_label, body, contentType) => {
    expect(await postRaw(body, contentType)).toEqual({ status: 422, text: '{"ok":false,"code":"malformed"}' })
  })

  it('GIF, SVG and TIFF content types are refused (415) before any tool runs', async () => {
    for (const contentType of ['image/gif', 'image/svg+xml', 'image/tiff']) {
      expect(await postRaw(fixture('TEST-ONLY-nameplate-en.png'), contentType)).toEqual({ status: 415, text: '{"ok":false,"code":"unsupported"}' })
    }
  })

  it('a declared body over 20 MB is refused (413) without reading it', async () => {
    const { req, answer } = openRequest('/extract/image', { 'Content-Type': 'image/png', 'Content-Length': String(20 * 1024 * 1024 + 1) })
    req.flushHeaders()
    const result = await answer
    req.destroy()
    expect(result).toEqual({ status: 413, body: '{"ok":false,"code":"too_large"}' })
  })

  it('PDF and image requests share one queue: with three PDFs and one image admitted, a fifth image is busy', async () => {
    const held = [
      openRequest('/extract/pdf', { 'Content-Type': 'application/pdf', 'Content-Length': '100000' }),
      openRequest('/extract/pdf', { 'Content-Type': 'application/pdf', 'Content-Length': '100000' }),
      openRequest('/extract/pdf', { 'Content-Type': 'application/pdf', 'Content-Length': '100000' }),
      openRequest('/extract/image', { 'Content-Type': 'image/png', 'Content-Length': '100000' }),
    ]
    held.forEach(({ req }, index) => req.write(index < 3 ? '%PDF-1.7\n' : Buffer.from([0x89, 0x50, 0x4E, 0x47])))
    try {
      await pause(500)
      expect(await postRaw(fixture('TEST-ONLY-nameplate-en.png'), 'image/png')).toEqual({ status: 503, text: '{"ok":false,"code":"busy"}' })
    }
    finally {
      for (const { req } of held) req.destroy()
    }
    await pause(500)
    const after = await ocr(fixture('TEST-ONLY-multi-model.png'), 'image/png')
    expect(after.ok).toBe(true)
  })

  it('PDF extraction still works after images, on the same service', async () => {
    const result = await readPdf(buildTextPdf([[TEST_ONLY_MARK, 'Model: LT180C', 'Aperture: 180 mm']]), { timeoutMs: 15_000 })
    expect(result.ok && result.text).toContain('Model: LT180C\nAperture: 180 mm')
  })
})

describe.skipIf(!BASE_URL || !CONTAINER)('the running container: OCR tools, limits and cleanup (docker exec)', () => {
  it('Tesseract has the eng and chi_sim models, and libvips 8.14 is present', async () => {
    const langs = await dockerExec(['tesseract', '--list-langs'])
    expect(langs.stdout).toMatch(/^eng$/m)
    expect(langs.stdout).toMatch(/^chi_sim$/m)
    expect((await dockerExec(['vips', '--version'])).stdout).toMatch(/^vips-8\.14\./)
  })

  it('vips and tesseract run under RLIMIT_AS = 384 MB with no core dump — read from the limited process itself', async () => {
    const out = await dockerExec(['node', '--input-type=module', '-e', `
      import { runBounded, limitedCommand } from '/app/extractor.mjs'
      const limits = await runBounded({ ...limitedCommand('cat', ['/proc/self/limits']), deadline: Date.now() + 5000, maxStdoutChars: 100000 })
      console.log(JSON.stringify(limits))
    `])
    const result = JSON.parse(out.stdout) as { stdout: string }
    expect(result.stdout).toMatch(/Max address space\s+402653184\s+402653184\s+bytes/)
    expect(result.stdout).toMatch(/Max core file size\s+0\s+0\s+bytes/)
  })

  it('the raster Tesseract reads from a 4,200 px image has a long edge of 3,000 px, and a small image is never scaled up', async () => {
    const script = (type: string) => `
      import { randomUUID } from 'node:crypto'
      import { writeFile, rm } from 'node:fs/promises'
      import { runBounded, limitedCommand, extractImageText } from '/app/extractor.mjs'
      const chunks = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      const path = '/tmp/' + randomUUID() + '.png'
      await writeFile(path, Buffer.concat(chunks))
      const deadline = Date.now() + 20000
      const raster = []
      const runTool = async (tool, args, options) => {
        const result = await runBounded({ ...limitedCommand(tool, args), ...options })
        if (tool === 'tesseract') {
          const header = await runBounded({ ...limitedCommand('vipsheader', [args[0]]), deadline, maxStdoutChars: 4096 })
          raster.push(header.stdout.replace(/^[^:]*: /, '').trim())
        }
        return result
      }
      const result = await extractImageText(path, { type: '${type}', deadline, runTool, tmpDir: '/tmp' })
      await rm(path, { force: true })
      console.log(JSON.stringify({ ok: result.text !== undefined, raster }))
    `
    const large = JSON.parse((await dockerExec(['node', '--input-type=module', '-e', script('png')], fixture('TEST-ONLY-large-4200.png'))).stdout) as { ok: boolean, raster: string[] }
    expect(large.ok).toBe(true)
    expect(large.raster[0]).toMatch(/^3000x1071 /)
    const small = JSON.parse((await dockerExec(['node', '--input-type=module', '-e', script('png')], fixture('TEST-ONLY-multi-model.png'))).stdout) as { ok: boolean, raster: string[] }
    expect(small.raster[0]).toMatch(/^1200x420 /)
    const oriented = JSON.parse((await dockerExec(['node', '--input-type=module', '-e', script('jpeg')], fixture('TEST-ONLY-orientation-6.jpg'))).stdout) as { ok: boolean, raster: string[] }
    // Stored 420 × 1200; read upright as 1200 × 420.
    expect(oriented.raster[0]).toMatch(/^1200x420 /)
  })

  it('libvips refuses its untrusted loaders in the service environment', async () => {
    const out = await dockerExec(['sh', '-c', 'printf \'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>\' > /tmp/probe.svg; VIPS_BLOCK_UNTRUSTED=1 prlimit --as=402653184 -- vips copy /tmp/probe.svg /tmp/probe.png; echo "exit=$?"; rm -f /tmp/probe.svg /tmp/probe.png'])
    expect(out.stdout).toMatch(/exit=[1-9]/)
  })

  it('nothing is left in /tmp after all of the above', async () => {
    await pause(500)
    expect((await dockerExec(['sh', '-c', 'ls -A /tmp'])).stdout.trim()).toBe('')
  })
})
