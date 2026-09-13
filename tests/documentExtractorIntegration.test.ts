/**
 * AI-PDF-SOURCE-01 — the real document-extractor, running in Docker.
 *
 * Skipped unless DOCUMENT_EXTRACTOR_TEST_URL is set, so CI (which has no Docker)
 * is unaffected. Run locally against the Compose services:
 *
 *   docker compose up -d document-extractor-gateway
 *   DOCUMENT_EXTRACTOR_TEST_URL=http://127.0.0.1:8787
 *   DOCUMENT_EXTRACTOR_TEST_CONTAINER=litubo-cms-document-extractor-1
 *   npx vitest run tests/documentExtractorIntegration.test.ts
 *
 * Requests go from this host process to 127.0.0.1:8787 — the path a
 * host-process Nuxt uses — through the real client and the gateway, to real
 * pdfinfo / pdftotext. Every PDF is synthetic TEST ONLY content generated in
 * memory. No AI provider is involved. The container checks use `docker exec` to
 * run the service's own process-control code inside the container.
 */

import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { request as httpRequest, type ClientRequest } from 'node:http'
import { createPdfTextReader } from '../server/utils/documentExtractorClient'
import { buildImageOnlyPdf, buildPagedPdf, buildTestPdf, buildTextPdf, TEST_ONLY_MARK } from './helpers/testOnlyPdf'

const BASE_URL = process.env.DOCUMENT_EXTRACTOR_TEST_URL ?? ''
const CONTAINER = process.env.DOCUMENT_EXTRACTOR_TEST_CONTAINER ?? ''

const read = createPdfTextReader({ baseUrl: BASE_URL })
const extract = (pdf: Uint8Array) => read(pdf, { timeoutMs: 15_000 })

async function postRaw(body: Uint8Array, contentType = 'application/pdf') {
  const response = await fetch(new URL('/extract/pdf', BASE_URL), { method: 'POST', headers: { 'Content-Type': contentType }, body: body as unknown as BodyInit })
  return { status: response.status, text: await response.text() }
}

/** A raw request whose headers and body pace are under the test's control. */
function openRequest(headers: Record<string, string>) {
  const url = new URL('/extract/pdf', BASE_URL)
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

function dockerExec(args: string[], timeoutMs = 60_000): Promise<{ code: number, stdout: string, stderr: string }> {
  return new Promise((done) => {
    execFile('docker', ['exec', CONTAINER, ...args], { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      done({ code: error ? 1 : 0, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

/** Runs an ES module script inside the container, with the service's own code importable from /app. */
const inContainer = (script: string) => dockerExec(['node', '--input-type=module', '-e', script])

const pause = (ms: number) => new Promise(done => setTimeout(done, ms))

describe.skipIf(!BASE_URL)('real document-extractor over HTTP — real pdfinfo and pdftotext', () => {
  it('healthz answers {"ok":true} and nothing else', async () => {
    const response = await fetch(new URL('/healthz', BASE_URL))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
  })

  it('a text-layer PDF comes back as its text: UTF-8 intact, page break as a blank line, no form feed, no page marker', async () => {
    const result = await extract(buildTextPdf([
      [TEST_ONLY_MARK, '', 'Model: LT180C', 'Aperture: 180 mm', 'Power: 0.45 kW', 'Voltage: AC 220 V, 50 Hz'],
      ['Second sheet — TEST ONLY'],
    ]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('TEST ONLY — NOT FOR PUBLICATION')
    expect(result.text).toContain('Model: LT180C\nAperture: 180 mm\nPower: 0.45 kW\nVoltage: AC 220 V, 50 Hz')
    expect(result.text).toContain('50 Hz\n\nSecond sheet — TEST ONLY')
    expect(result.text).not.toContain('\f')
    expect(result.text).not.toMatch(/\bPage \d|\[PAGE/)
  })

  it('Chinese and other Unicode text survives the whole path', async () => {
    const result = await extract(buildTestPdf([{ lines: [TEST_ONLY_MARK], unicodeLines: ['测试专用 — 不得发布', '孔径：180 毫米', 'Température 0–40 °C'] }]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('测试专用 — 不得发布')
    expect(result.text).toContain('孔径：180 毫米')
    expect(result.text).toMatch(/Température\s+0–40\s+°C/)
  })

  it('a multi-model datasheet comes back whole — attribution is the prompt guard\'s job, not the reader\'s', async () => {
    const result = await extract(buildTextPdf([[TEST_ONLY_MARK, '', 'LT180C', 'Aperture 180 mm', 'Voltage 220 V', '', 'LT200C', 'Aperture 200 mm', 'Voltage 380 V']]))
    expect(result.ok && result.text).toContain('LT180C\nAperture 180 mm\nVoltage 220 V')
    expect(result.ok && result.text).toContain('LT200C\nAperture 200 mm\nVoltage 380 V')
  })

  it('a table keeps its column spacing (-layout)', async () => {
    const result = await extract(buildTextPdf([[TEST_ONLY_MARK, 'Parameter            LT180C        LT200C', 'Aperture             180 mm        200 mm']]))
    expect(result.ok && result.text).toMatch(/Aperture\s{2,}180 mm\s{2,}200 mm/)
  })

  it('50 pages are read; 51 pages are refused whole, never cut to the first 50', async () => {
    const fifty = await extract(buildPagedPdf(50))
    expect(fifty.ok && fifty.text).toContain('Page 50 of 50')
    expect(await extract(buildPagedPdf(51))).toEqual({ ok: false, code: 'too_many_pages' })
  })

  it('an image-only PDF — no text layer, like a scan — is no_text; there is no OCR', async () => {
    expect(await extract(buildImageOnlyPdf())).toEqual({ ok: false, code: 'no_text' })
  })

  it('a password-protected PDF and a permission-restricted (owner-password) PDF are both encrypted', async () => {
    expect(await extract(buildTextPdf([[TEST_ONLY_MARK, 'Secret: 1']], { encryption: 'password-required' }))).toEqual({ ok: false, code: 'encrypted' })
    expect(await extract(buildTextPdf([[TEST_ONLY_MARK, 'Secret: 1']], { encryption: 'owner-only' }))).toEqual({ ok: false, code: 'encrypted' })
  })

  it('a truncated PDF and random bytes behind a PDF header are malformed — no Poppler message, path or stack in the answer', async () => {
    const valid = buildTextPdf([[TEST_ONLY_MARK, 'Aperture: 180 mm']])
    for (const broken of [valid.subarray(0, Math.floor(valid.length / 2)), Buffer.concat([Buffer.from('%PDF-1.7\n'), randomBytes(4_000)])]) {
      expect(await postRaw(broken)).toEqual({ status: 422, text: '{"ok":false,"code":"malformed"}' })
    }
  })

  it('bytes that are not a PDF, and a request that is not application/pdf, are refused by the sidecar itself', async () => {
    expect(await postRaw(Buffer.from('Model: LT180C\nAperture: 180 mm'))).toEqual({ status: 422, text: '{"ok":false,"code":"malformed"}' })
    expect(await postRaw(buildTextPdf([[TEST_ONLY_MARK]]), 'text/plain')).toEqual({ status: 415, text: '{"ok":false,"code":"unsupported"}' })
  })

  it('a declared body over 20 MB is refused (413) by the sidecar without the Nuxt pre-check and without reading it', async () => {
    const { req, answer } = openRequest({ 'Content-Type': 'application/pdf', 'Content-Length': String(20 * 1024 * 1024 + 1) })
    req.flushHeaders()
    const result = await answer
    req.destroy()
    expect(result).toEqual({ status: 413, body: '{"ok":false,"code":"too_large"}' })
  })

  it('a streamed body that passes 20 MB with no declared length is cut off, never extracted', async () => {
    const { req, answer } = openRequest({ 'Content-Type': 'application/pdf' })
    const chunk = Buffer.alloc(1024 * 1024)
    chunk.write('%PDF-1.7\n')
    let sent = 0
    const pump = () => {
      if (req.destroyed || sent > 24 * 1024 * 1024) {
        if (!req.destroyed) req.end()
        return
      }
      sent += chunk.length
      if (req.write(chunk)) setImmediate(pump)
      else req.once('drain', pump)
    }
    pump()
    const result = await answer
    req.destroy()
    // The refusal is written before the connection closes; a client still mid-upload may see the close first.
    expect([413, 0]).toContain(result.status)
    if (result.status === 413) expect(result.body).toBe('{"ok":false,"code":"too_large"}')
    expect((await fetch(new URL('/healthz', BASE_URL))).status).toBe(200)
  })

  it('with four requests admitted, a fifth is told busy at once', async () => {
    const held = [1, 2, 3, 4].map(() => {
      const request = openRequest({ 'Content-Type': 'application/pdf', 'Content-Length': '100000' })
      request.req.write('%PDF-1.7\n')
      return request
    })
    try {
      await pause(500)
      expect(await postRaw(buildTextPdf([[TEST_ONLY_MARK]]))).toEqual({ status: 503, text: '{"ok":false,"code":"busy"}' })
    }
    finally {
      for (const { req } of held) req.destroy()
    }
    await pause(500)
    const after = await extract(buildTextPdf([[TEST_ONLY_MARK, 'After the queue emptied']]))
    expect(after.ok && after.text).toContain('After the queue emptied')
  })
})

describe.skipIf(!BASE_URL || !CONTAINER)('the running container enforces the process and container limits (docker exec)', () => {
  it('every Poppler process runs under RLIMIT_AS = 384 MB and no core dump — read from the limited process itself', async () => {
    const out = await inContainer(`
      import { runBounded, limitedCommand } from '/app/extractor.mjs'
      const result = await runBounded({ ...limitedCommand('cat', ['/proc/self/limits']), deadline: Date.now() + 5000, maxStdoutChars: 100000 })
      console.log(JSON.stringify(result))
    `)
    const result = JSON.parse(out.stdout) as { kind: string, stdout: string }
    expect(result.kind).toBe('exited')
    expect(result.stdout).toMatch(/Max address space\s+402653184\s+402653184\s+bytes/)
    expect(result.stdout).toMatch(/Max core file size\s+0\s+0\s+bytes/)
  })

  it('under that limit a 512 MB allocation is refused by the kernel while 16 MB succeeds — the host is never stressed', async () => {
    const out = await inContainer(`
      import { runBounded, limitedCommand } from '/app/extractor.mjs'
      const dd = size => runBounded({ ...limitedCommand('dd', ['if=/dev/zero', 'of=/dev/null', 'bs=' + size, 'count=1']), deadline: Date.now() + 10000, maxStdoutChars: 1000 })
      console.log(JSON.stringify({ big: await dd('512M'), small: await dd('16M') }))
    `)
    const { big, small } = JSON.parse(out.stdout) as { big: { kind: string, code: number, stderr: string }, small: { kind: string, code: number } }
    expect(big.kind).toBe('exited')
    expect(big.code).not.toBe(0)
    expect(big.stderr).toMatch(/memory exhausted/i)
    expect(small).toMatchObject({ kind: 'exited', code: 0 })
  })

  it('at the deadline the process is killed for real — it is gone from /proc afterwards', async () => {
    const out = await inContainer(`
      import { existsSync } from 'node:fs'
      import { runBounded, limitedCommand } from '/app/extractor.mjs'
      const started = Date.now()
      const result = await runBounded({ ...limitedCommand('sleep', ['30']), deadline: Date.now() + 500, maxStdoutChars: 10 })
      console.log(JSON.stringify({ kind: result.kind, ms: Date.now() - started, alive: existsSync('/proc/' + result.pid) }))
    `)
    const result = JSON.parse(out.stdout) as { kind: string, ms: number, alive: boolean }
    expect(result).toMatchObject({ kind: 'deadline', alive: false })
    expect(result.ms).toBeLessThan(5_000)
  })

  it('runs as uid 1000 on a read-only root filesystem; only the tmpfs /tmp is writable, and nothing is left in it', async () => {
    expect((await dockerExec(['id', '-u'])).stdout.trim()).toBe('1000')
    expect((await dockerExec(['sh', '-c', 'touch /app/probe 2>&1; true'])).stdout).toMatch(/Read-only file system/)
    expect((await dockerExec(['sh', '-c', 'touch /tmp/probe && rm /tmp/probe && echo writable'])).stdout.trim()).toBe('writable')
    expect((await dockerExec(['sh', '-c', 'ls -A /tmp'])).stdout.trim()).toBe('')
  })

  it('has no route out: no Internet, no DNS, no Directus', async () => {
    const out = await inContainer(`
      import { connect } from 'node:net'
      import { lookup } from 'node:dns/promises'
      const tcp = (host, port) => new Promise(done => {
        const socket = connect({ host, port })
        socket.setTimeout(3000)
        socket.on('connect', () => { socket.destroy(); done('open') })
        socket.on('timeout', () => { socket.destroy(); done('blocked') })
        socket.on('error', () => done('blocked'))
      })
      const dns = await lookup('example.com').then(() => 'resolved', () => 'blocked')
      console.log(JSON.stringify({ internet: await tcp('1.1.1.1', 443), dns, directus: await tcp('host.docker.internal', 8055) }))
    `)
    expect(JSON.parse(out.stdout)).toEqual({ internet: 'blocked', dns: 'blocked', directus: 'blocked' })
  })
})
