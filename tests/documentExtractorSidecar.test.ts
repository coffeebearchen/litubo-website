/**
 * AI-PDF-SOURCE-01 — the document-extractor sidecar, tested without Docker.
 *
 * The HTTP surface, the limits, the queue and the failure mapping run against
 * the real server code, with Poppler replaced by scripted outcomes. Process
 * control — a real kill at the deadline, a real stop at the output limit,
 * incremental UTF-8 decoding — runs against real child processes (Node itself,
 * because this host has no Poppler). Real pdfinfo / pdftotext, prlimit and the
 * container limits are tested against the running container in
 * `tests/documentExtractorIntegration.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { request as httpRequest, type ClientRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  CHILD_ADDRESS_SPACE_BYTES,
  MAX_ACTIVE_TASKS,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MAX_QUEUED_TASKS,
  MAX_TEXT_CHARS,
  TASK_DEADLINE_MS,
  createAdmissionQueue,
  createExtractorServer,
  extractPdfText,
  limitedCommand,
  normalizeExtractedText,
  parsePdfInfo,
  runBounded,
} from '../document-extractor/extractor.mjs'

type Outcome = Record<string, unknown>
interface ToolOptions { deadline: number, signal?: AbortSignal, maxStdoutChars: number }
interface ToolCall { tool: string, args: string[], options: ToolOptions }
type ScriptEntry = Outcome | ((call: ToolCall) => Outcome | Promise<Outcome>)
type Script = Partial<Record<'pdfinfo' | 'pdftotext', ScriptEntry>>
type ServerOptions = NonNullable<Parameters<typeof createExtractorServer>[0]>

const PDF_BODY = Buffer.from('%PDF-1.7\n%TEST ONLY — NOT FOR PUBLICATION\n', 'utf-8')

function exited(stdout: string, extra: Outcome = {}): Outcome {
  return { kind: 'exited', code: 0, signal: null, stdout, stderr: '', truncated: false, ...extra }
}
const INFO_ONE_PAGE = exited('Pages:           1\nEncrypted:       no\n')

function scriptedTools(script: Script = {}) {
  const calls: ToolCall[] = []
  const runTool = vi.fn(async (tool: string, args: string[], options: ToolOptions) => {
    const call = { tool, args, options }
    calls.push(call)
    const entry = script[tool as 'pdfinfo' | 'pdftotext'] ?? (tool === 'pdfinfo' ? INFO_ONE_PAGE : exited('Aperture: 180 mm\n'))
    return typeof entry === 'function' ? entry(call) : entry
  })
  return { runTool, calls }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function startServer(options: Partial<ServerOptions> = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'extractor-test-'))
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

async function postPdf(base: string, body: Uint8Array = PDF_BODY, headers: Record<string, string> = { 'Content-Type': 'application/pdf' }, path = '/extract/pdf') {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: body as unknown as BodyInit })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

/** A raw HTTP/1.1 request, for the cases fetch will not produce. Resolves with whatever answer arrives. */
function rawRequest(base: string, headers: Record<string, string>, send: (req: ClientRequest) => void) {
  return new Promise<{ status: number, body: string }>((resolveRequest) => {
    const url = new URL('/extract/pdf', base)
    let answered = false
    const req = httpRequest({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers }, (res) => {
      answered = true
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
      })
      res.on('end', () => resolveRequest({ status: res.statusCode ?? 0, body }))
      res.on('error', () => resolveRequest({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', () => {
      if (!answered) resolveRequest({ status: 0, body: '' })
    })
    send(req)
  })
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

// ── HTTP surface ──

describe('the HTTP surface is two routes and nothing else', () => {
  it('GET /healthz answers exactly {"ok":true} — no version, path, host or environment detail, and no CORS header', async () => {
    const { base } = await startServer()
    const response = await fetch(`${base}/healthz`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('HEAD /healthz is allowed; POST to it is 405', async () => {
    const { base } = await startServer()
    expect((await fetch(`${base}/healthz`, { method: 'HEAD' })).status).toBe(200)
    const post = await fetch(`${base}/healthz`, { method: 'POST', body: 'x' })
    expect(post.status).toBe(405)
    expect(post.headers.get('allow')).toBe('GET, HEAD')
  })

  it('GET /extract/pdf is 405 with Allow: POST', async () => {
    const { base } = await startServer()
    const response = await fetch(`${base}/extract/pdf`)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(await response.json()).toEqual({ ok: false, code: 'method_not_allowed' })
  })

  it.each(['/', '/upload', '/list', '/admin', '/debug', '/extract', '/extract/docx', '/etc/passwd', '/healthz/x'])('%s is 404', async (path) => {
    const { base } = await startServer()
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: PDF_BODY })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ ok: false, code: 'not_found' })
  })

  it('a request that is not application/pdf is refused (415) and never reaches a tool', async () => {
    const { runTool } = scriptedTools()
    const { base } = await startServer({ runTool })
    expect(await postPdf(base, PDF_BODY, { 'Content-Type': 'text/plain' })).toEqual({ status: 415, body: { ok: false, code: 'unsupported' } })
    expect(runTool).not.toHaveBeenCalled()
  })

  it('nothing in the request — a query string, a header, a would-be file name — becomes part of a path or a command', async () => {
    const { runTool, calls } = scriptedTools()
    const { base, tmpDir } = await startServer({ runTool })
    const result = await postPdf(base, PDF_BODY, {
      'Content-Type': 'application/pdf',
      'X-Filename': '../../etc/passwd; rm -rf /',
      'Content-Disposition': 'attachment; filename="../../evil.pdf"',
    }, '/extract/pdf?path=/etc/passwd&filename=evil.pdf&command=rm')

    expect(result.status).toBe(200)
    expect(calls.map(call => call.tool)).toEqual(['pdfinfo', 'pdftotext'])
    for (const call of calls) {
      const file = call.args.find(arg => arg.endsWith('.pdf'))!
      expect(file.startsWith(tmpDir)).toBe(true)
      expect(file.slice(tmpDir.length + 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/)
      expect(call.args.join(' ')).not.toMatch(/passwd|evil|rm -rf|command/)
    }
  })
})

// ── Body limits ──

describe('the body is limited by the sidecar itself, whatever the caller did', () => {
  it('the production ceiling is 20 MB', () => {
    expect(MAX_PDF_BYTES).toBe(20 * 1024 * 1024)
  })

  it('a declared Content-Length over the ceiling is refused (413) before any body is read', async () => {
    const { runTool } = scriptedTools()
    const { base } = await startServer({ runTool, maxPdfBytes: 1024 })
    const result = await rawRequest(base, { 'Content-Type': 'application/pdf', 'Content-Length': '2048' }, req => req.flushHeaders())
    expect(result.status).toBe(413)
    expect(JSON.parse(result.body)).toEqual({ ok: false, code: 'too_large' })
    expect(runTool).not.toHaveBeenCalled()
  })

  /**
   * Reading stops the moment the ceiling is passed and the refusal is written
   * at once. A client that is still sending can see the connection close before
   * it reads that answer — the socket is not kept open to drain an oversized
   * upload — so either outcome is accepted. What must never happen is reading
   * on, writing a file or running a tool.
   */
  it('a body with no declared length is cut off as soon as it passes the ceiling: 413 or a closed connection, never read on or run', async () => {
    const { runTool } = scriptedTools()
    const { base, tmpDir } = await startServer({ runTool, maxPdfBytes: 64 * 1024 })
    const chunk = Buffer.alloc(8 * 1024, 0x41)
    const result = await rawRequest(base, { 'Content-Type': 'application/pdf' }, (req) => {
      let sent = 0
      const pump = () => {
        if (req.destroyed || sent >= 1024 * 1024) {
          if (!req.destroyed) req.end()
          return
        }
        sent += chunk.length
        req.write(chunk)
        setTimeout(pump, 1)
      }
      pump()
    })
    expect([413, 0]).toContain(result.status)
    if (result.status === 413) expect(JSON.parse(result.body)).toEqual({ ok: false, code: 'too_large' })
    expect(runTool).not.toHaveBeenCalled()
    expect(readdirSync(tmpDir)).toEqual([])
    expect((await fetch(`${base}/healthz`)).status).toBe(200)
  })
})

// ── PDF header ──

describe('the PDF header is checked before anything is written or run', () => {
  it('bytes without a %PDF- header are malformed and never reach the disk or a tool', async () => {
    const { runTool } = scriptedTools()
    const { base, tmpDir } = await startServer({ runTool })
    expect(await postPdf(base, Buffer.from('Model: LT180C\nAperture: 180 mm'))).toEqual({ status: 422, body: { ok: false, code: 'malformed' } })
    expect(runTool).not.toHaveBeenCalled()
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it('a header after leading junk inside the first 1024 bytes is still a PDF, as it is to Poppler', async () => {
    const { runTool } = scriptedTools()
    const { base } = await startServer({ runTool })
    const result = await postPdf(base, Buffer.concat([Buffer.alloc(1000, 0x20), PDF_BODY]))
    expect(result.status).toBe(200)
    expect(runTool).toHaveBeenCalledTimes(2)
  })
})

// ── pdfinfo output and text normalization ──

describe('pdfinfo output is trusted only when it is unambiguous', () => {
  it('reads the page count and the encryption flag', () => {
    expect(parsePdfInfo('Title:           x\nPages:           12\nEncrypted:       no\nPage size:       612 x 792 pts (letter)\n')).toEqual({ pages: 12, encrypted: false })
    expect(parsePdfInfo('Pages:           1\nEncrypted:       yes (print:no copy:no change:no addNotes:no algorithm:RC4)\n')).toEqual({ pages: 1, encrypted: true })
  })

  it('a document title that smuggles in a second "Pages:" or "Encrypted:" line makes the output untrustworthy', () => {
    expect(parsePdfInfo('Title:           x\nPages:           1\nPages:           999\nEncrypted:       no\n')).toBeNull()
    expect(parsePdfInfo('Title:           x\nEncrypted:       no\nPages:           1\nEncrypted:       no\n')).toBeNull()
  })

  it('missing or malformed fields are never guessed', () => {
    expect(parsePdfInfo('')).toBeNull()
    expect(parsePdfInfo('Pages:           many\nEncrypted:       no\n')).toBeNull()
    expect(parsePdfInfo('Pages:           3\n')).toBeNull()
  })
})

describe('extracted text is normalized before it leaves the sidecar', () => {
  it('a page break becomes a blank line — no form feed, and no invented page marker', () => {
    expect(normalizeExtractedText('Page one text\n\fPage two text\n\f')).toBe('Page one text\n\nPage two text')
  })

  it('CRLF and CR become LF', () => {
    expect(normalizeExtractedText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('control characters other than tab and newline become spaces', () => {
    expect(normalizeExtractedText('A BC\tDE')).toBe('A B C\tD E')
  })

  it('trailing spaces go; spacing inside a line — where -layout puts table columns — stays', () => {
    expect(normalizeExtractedText('Aperture        180 mm      \nVoltage         220 V   ')).toBe('Aperture        180 mm\nVoltage         220 V')
  })

  it('runs of blank lines collapse to one', () => {
    expect(normalizeExtractedText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('Chinese and other Unicode text is kept as it is', () => {
    expect(normalizeExtractedText('孔径：180 毫米\nTempérature 0–40 °C')).toBe('孔径：180 毫米\nTempérature 0–40 °C')
  })

  it('the text is capped at 20,000 characters from the start, without splitting a surrogate pair', () => {
    expect(MAX_TEXT_CHARS).toBe(20_000)
    expect(normalizeExtractedText('x'.repeat(25_000))).toHaveLength(20_000)
    expect(normalizeExtractedText(`${'x'.repeat(19_999)}😀tail`)).toBe('x'.repeat(19_999))
  })

  it('whitespace and form feeds alone normalize to nothing', () => {
    expect(normalizeExtractedText(' \f\n \t\f ')).toBe('')
  })
})

// ── Poppler outcome → fixed code ──

describe('extractPdfText — a Poppler outcome becomes one fixed code', () => {
  async function run(script: Script) {
    const { runTool, calls } = scriptedTools(script)
    const deadline = Date.now() + 1_000
    const result = await extractPdfText('/tmp/0d8c.pdf', { deadline, signal: undefined, runTool })
    return { result, calls, deadline }
  }

  it('a normal PDF: pdfinfo, then pdftotext with layout, UTF-8, LF line ends and the page ceiling, on one shared deadline', async () => {
    const { result, calls, deadline } = await run({ pdftotext: exited('Model: LT180C\f') })
    expect(result).toEqual({ text: 'Model: LT180C' })
    expect(calls.map(call => [call.tool, call.args])).toEqual([
      ['pdfinfo', ['/tmp/0d8c.pdf']],
      ['pdftotext', ['-layout', '-enc', 'UTF-8', '-eol', 'unix', '-l', '50', '/tmp/0d8c.pdf', '-']],
    ])
    expect(calls.map(call => call.options.deadline)).toEqual([deadline, deadline])
  })

  it('50 pages is allowed; 51 is refused whole before any text is extracted — never cut to the first 50', async () => {
    expect(MAX_PDF_PAGES).toBe(50)
    expect((await run({ pdfinfo: exited('Pages:           50\nEncrypted:       no\n') })).result).toEqual({ text: 'Aperture: 180 mm' })
    const refused = await run({ pdfinfo: exited('Pages:           51\nEncrypted:       no\n') })
    expect(refused.result).toEqual({ code: 'too_many_pages' })
    expect(refused.calls.map(call => call.tool)).toEqual(['pdfinfo'])
  })

  it('an encrypted PDF is refused before any text is extracted', async () => {
    const refused = await run({ pdfinfo: exited('Pages:           1\nEncrypted:       yes (print:no copy:no)\n') })
    expect(refused.result).toEqual({ code: 'encrypted' })
    expect(refused.calls.map(call => call.tool)).toEqual(['pdfinfo'])
  })

  it.each([
    ['Incorrect password', { code: 1, stderr: 'Command Line Error: Incorrect password\n' }, 'encrypted'],
    ['a permissions error', { code: 3, stderr: 'Permission Error: copying not allowed\n' }, 'encrypted'],
    ['a damaged file', { code: 1, stderr: 'Syntax Error: Couldn\'t find trailer dictionary\n' }, 'malformed'],
    ['another error', { code: 99, stderr: 'Internal Error\n' }, 'unsafe_parse'],
    ['a crash', { code: null, signal: 'SIGSEGV' }, 'unsafe_parse'],
    ['a kill by the kernel', { code: null, signal: 'SIGKILL' }, 'unsafe_parse'],
  ])('pdfinfo failing with %s → %s, and nothing of its message is kept', async (_label, outcome, code) => {
    const { result, calls } = await run({ pdfinfo: exited('', outcome) })
    expect(result).toEqual({ code })
    expect(calls.map(call => call.tool)).toEqual(['pdfinfo'])
  })

  it('pdfinfo output past its own limit, a missing tool, a title injection and zero pages are all refused', async () => {
    expect((await run({ pdfinfo: exited('Pages: 1', { truncated: true }) })).result).toEqual({ code: 'unsafe_parse' })
    expect((await run({ pdfinfo: { kind: 'spawn_error' } })).result).toEqual({ code: 'unsafe_parse' })
    expect((await run({ pdfinfo: exited('Pages:           1\nPages:           2\nEncrypted:       no\n') })).result).toEqual({ code: 'malformed' })
    expect((await run({ pdfinfo: exited('Pages:           0\nEncrypted:       no\n') })).result).toEqual({ code: 'malformed' })
  })

  it('pdftotext stopped at the output limit is a normal result — the character cap working, not a crash', async () => {
    expect((await run({ pdftotext: exited('Aperture: 180 mm\n'.repeat(10), { code: 0, signal: null, truncated: true }) })).result)
      .toEqual({ text: 'Aperture: 180 mm\n'.repeat(10).trim() })
  })

  it('pdftotext at the deadline is timeout; a text layer with nothing in it is no_text', async () => {
    expect((await run({ pdftotext: { kind: 'deadline' } })).result).toEqual({ code: 'timeout' })
    expect((await run({ pdftotext: exited(' \f \n\f') })).result).toEqual({ code: 'no_text' })
  })
})

// ── HTTP answers, statuses, cleanup ──

describe('POST /extract/pdf — answers, statuses and cleanup', () => {
  it('success is 200 {ok:true,text}, and the temporary file is gone afterwards', async () => {
    const { runTool } = scriptedTools({ pdftotext: exited('Model: LT180C\nAperture: 180 mm\n\f') })
    const { base, tmpDir } = await startServer({ runTool })
    expect(await postPdf(base)).toEqual({ status: 200, body: { ok: true, text: 'Model: LT180C\nAperture: 180 mm' } })
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it.each([
    ['51 pages', { pdfinfo: exited('Pages:           51\nEncrypted:       no\n') }, 422, 'too_many_pages'],
    ['encrypted', { pdfinfo: exited('Pages:           1\nEncrypted:       yes (print:no)\n') }, 422, 'encrypted'],
    ['damaged', { pdfinfo: exited('', { code: 1, stderr: 'Syntax Error: xref at /tmp/secret-path.pdf' }) }, 422, 'malformed'],
    ['no text layer', { pdftotext: exited(' \f ') }, 422, 'no_text'],
    ['deadline', { pdftotext: { kind: 'deadline' } }, 504, 'timeout'],
    ['tool missing', { pdfinfo: { kind: 'spawn_error' } }, 422, 'unsafe_parse'],
  ] as Array<[string, Script, number, string]>)('%s → %i %s: no stderr, path or exit code in the answer, no file left behind', async (_label, script, status, code) => {
    const { runTool } = scriptedTools(script)
    const { base, tmpDir } = await startServer({ runTool })
    const result = await postPdf(base)
    expect(result).toEqual({ status, body: { ok: false, code } })
    expect(JSON.stringify(result.body)).not.toMatch(/Syntax|secret-path|\/tmp|exit|stderr|stack/)
    expect(readdirSync(tmpDir)).toEqual([])
  })
})

// ── Queue ──

describe('one PDF at a time, three waiting, the next one told busy', () => {
  it('the production limits: 1 running, 3 queued, one 15 s deadline for the whole task', () => {
    expect(MAX_ACTIVE_TASKS).toBe(1)
    expect(MAX_QUEUED_TASKS).toBe(3)
    expect(TASK_DEADLINE_MS).toBe(15_000)
  })

  it('queue tickets: admission, order, leaving the line when aborted, release', async () => {
    const queue = createAdmissionQueue({ maxActive: 1, maxQueued: 3 })
    const tickets = [queue.admit(), queue.admit(), queue.admit(), queue.admit()]
    expect(tickets.every(Boolean)).toBe(true)
    expect(queue.admit()).toBeNull()

    expect(await tickets[0]!.start()).toBe(true)
    const second = tickets[1]!.start()
    const controller = new AbortController()
    const third = tickets[2]!.start(controller.signal)
    controller.abort()
    expect(await third).toBe(false)
    tickets[2]!.release()

    tickets[0]!.release()
    expect(await second).toBe(true)
    expect(queue.stats()).toEqual({ running: 1, admitted: 2, waiting: 0 })
    tickets[1]!.release()
    tickets[3]!.release()
    expect(queue.stats()).toEqual({ running: 0, admitted: 0, waiting: 0 })
    expect(queue.admit()).not.toBeNull()
  })

  it('with one extraction running and three waiting, a fifth request is told busy at once; the four then finish', async () => {
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    const { runTool } = scriptedTools({ pdftotext: async () => {
      await gate
      return exited('Aperture: 180 mm')
    } })
    const { base, queueStats } = await startServer({ runTool })
    const firstFour = [1, 2, 3, 4].map(() => postPdf(base))
    await vi.waitFor(() => expect(queueStats().admitted).toBe(4))

    expect(await postPdf(base)).toEqual({ status: 503, body: { ok: false, code: 'busy' } })

    release()
    expect((await Promise.all(firstFour)).map(result => result.status)).toEqual([200, 200, 200, 200])
    await vi.waitFor(() => expect(queueStats()).toEqual({ running: 0, admitted: 0, waiting: 0 }))
  })
})

// ── Deadline and disconnect ──

describe('one whole-task deadline, and a caller that gives up stops the work', () => {
  it('a task that outlives the deadline is answered timeout, and its tool is told to stop', async () => {
    let toolSignal: AbortSignal | undefined
    const { runTool } = scriptedTools({ pdftotext: call => new Promise<Outcome>((done) => {
      toolSignal = call.options.signal
      call.options.signal?.addEventListener('abort', () => done({ kind: 'aborted' }))
    }) })
    const { base } = await startServer({ runTool, taskDeadlineMs: 300 })
    const started = Date.now()
    expect(await postPdf(base)).toEqual({ status: 504, body: { ok: false, code: 'timeout' } })
    expect(toolSignal?.aborted).toBe(true)
    expect(Date.now() - started).toBeLessThan(5_000)
  })

  it('a request still waiting in the queue when its deadline passes is told busy and never runs', async () => {
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    const { runTool, calls } = scriptedTools({ pdftotext: async () => {
      await gate
      return exited('x')
    } })
    const { base } = await startServer({ runTool, taskDeadlineMs: 400 })
    const first = postPdf(base)
    await vi.waitFor(() => expect(calls.some(call => call.tool === 'pdftotext')).toBe(true))

    expect(await postPdf(base)).toEqual({ status: 503, body: { ok: false, code: 'busy' } })
    expect(calls.filter(call => call.tool === 'pdfinfo')).toHaveLength(1)

    release()
    await first
  })

  it('when the client disconnects mid-extraction, the tool is told to stop and the slot is freed', async () => {
    let toolSignal: AbortSignal | undefined
    const { runTool } = scriptedTools({ pdftotext: call => new Promise<Outcome>((done) => {
      toolSignal = call.options.signal
      call.options.signal?.addEventListener('abort', () => done({ kind: 'aborted' }))
    }) })
    const { base, queueStats } = await startServer({ runTool })
    const controller = new AbortController()
    const request = fetch(`${base}/extract/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: PDF_BODY, signal: controller.signal }).catch(error => error)
    await vi.waitFor(() => expect(toolSignal).toBeDefined())

    controller.abort()
    await request
    await vi.waitFor(() => expect(toolSignal?.aborted).toBe(true))
    await vi.waitFor(() => expect(queueStats()).toEqual({ running: 0, admitted: 0, waiting: 0 }))
  })
})

// ── Logs ──

describe('logs carry an outcome and a duration — never the document', () => {
  it('no text, name, header or body in any log entry', async () => {
    const MARKER = 'CONFIDENTIAL-LT180C-MARKER'
    const { runTool } = scriptedTools({ pdftotext: exited(`${MARKER} Aperture: 180 mm`) })
    const { base, log } = await startServer({ runTool })
    await postPdf(base, Buffer.from(`%PDF-1.7\n${MARKER}\n`), { 'Content-Type': 'application/pdf', 'X-Filename': `${MARKER}.pdf` })
    await postPdf(base, Buffer.from(`not a pdf ${MARKER}`))

    const entries = log.mock.calls.map(call => call[0] as Record<string, unknown>)
    expect(entries.map(entry => entry.result)).toEqual(['ok', 'malformed'])
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['event', 'ms', 'result'])
      expect(JSON.stringify(entry)).not.toContain(MARKER)
    }
  })
})

// ── Real child processes ──

describe('runBounded — every stop is a real kill of a real process', () => {
  const node = process.execPath
  // These children are Node itself on this host, which needs the host environment; the container's minimal default is checked below.
  const hostEnv = process.env as unknown as NonNullable<Parameters<typeof runBounded>[0]['env']>

  it('at the deadline the child is killed, not abandoned — it is no longer running afterwards', async () => {
    const started = Date.now()
    const result = await runBounded({ command: node, args: ['-e', 'setInterval(() => {}, 1000)'], deadline: Date.now() + 500, signal: undefined, maxStdoutChars: 1_000, env: hostEnv })
    expect(result.kind).toBe('deadline')
    expect(Date.now() - started).toBeLessThan(10_000)
    expect(alive(result.pid as number)).toBe(false)
  })

  it('when the caller aborts, the child is killed the same way', async () => {
    const controller = new AbortController()
    const promise = runBounded({ command: node, args: ['-e', 'setInterval(() => {}, 1000)'], deadline: Date.now() + 30_000, signal: controller.signal, maxStdoutChars: 1_000, env: hostEnv })
    setTimeout(() => controller.abort(), 300)
    const result = await promise
    expect(result.kind).toBe('aborted')
    expect(alive(result.pid as number)).toBe(false)
  })

  it('once enough output has been read the child is stopped, and what is kept stays bounded', async () => {
    const endlessWriter = 'const s = "x".repeat(65536); (function w() { while (process.stdout.write(s)); process.stdout.once("drain", w) })()'
    const result = await runBounded({ command: node, args: ['-e', endlessWriter], deadline: Date.now() + 30_000, signal: undefined, maxStdoutChars: 100_000, env: hostEnv })
    expect(result).toMatchObject({ kind: 'exited', truncated: true })
    expect((result.stdout as string).length).toBeGreaterThanOrEqual(100_000)
    expect((result.stdout as string).length).toBeLessThan(100_000 + 1024 * 1024)
    expect(alive(result.pid as number)).toBe(false)
  })

  it('a UTF-8 character split across two output chunks arrives intact', async () => {
    const splitWriter = 'process.stdout.write(Buffer.from([0xE6])); setTimeout(() => process.stdout.write(Buffer.from([0xB5, 0x8B, 0xE8, 0xAF, 0x95])), 100)'
    const result = await runBounded({ command: node, args: ['-e', splitWriter], deadline: Date.now() + 10_000, signal: undefined, maxStdoutChars: 1_000, env: hostEnv })
    expect(result).toMatchObject({ kind: 'exited', code: 0, stdout: '测试', truncated: false })
  })

  it('a command that cannot start is spawn_error', async () => {
    const result = await runBounded({ command: join(tmpdir(), 'no-such-extractor-binary'), args: [], deadline: Date.now() + 5_000, signal: undefined, maxStdoutChars: 10, env: hostEnv })
    expect(result.kind).toBe('spawn_error')
  })

  it('runs an argument array with no shell, and gives the child a minimal environment by default', async () => {
    const spawnProcess = vi.fn((_command: string, _args: string[], _options: { shell: boolean, env: Record<string, string> }) => {
      throw new Error('stop before starting anything')
    })
    const result = await runBounded({ command: 'prlimit', args: ['--as=1', '--', 'pdftotext', 'a b; rm -rf /', '-'], deadline: Date.now() + 1_000, signal: undefined, maxStdoutChars: 10, spawnProcess: spawnProcess as never })
    expect(result.kind).toBe('spawn_error')
    const [command, args, options] = spawnProcess.mock.calls[0]
    expect(command).toBe('prlimit')
    expect(args).toEqual(['--as=1', '--', 'pdftotext', 'a b; rm -rf /', '-'])
    expect(options.shell).toBe(false)
    expect(Object.keys(options.env).sort()).toEqual(['LANG', 'PATH'])
  })

  it('every Poppler tool runs under prlimit with a 384 MB address-space limit and no core dump', () => {
    expect(CHILD_ADDRESS_SPACE_BYTES).toBe(384 * 1024 * 1024)
    expect(limitedCommand('pdftotext', ['-layout', 'x.pdf', '-'])).toEqual({
      command: 'prlimit',
      args: ['--as=402653184', '--core=0', '--', 'pdftotext', '-layout', 'x.pdf', '-'],
    })
  })
})

// ── Source-level guarantees ──

describe('the sidecar source stays small and closed', () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), 'document-extractor', file), 'utf8')
  const FILES = ['extractor.mjs', 'server.mjs', 'gateway.mjs']

  it('imports Node built-ins only', () => {
    for (const file of FILES) {
      for (const [, specifier] of read(file).matchAll(/from '([^']+)'/g)) {
        expect(specifier.startsWith('node:') || specifier === './extractor.mjs', `${file}: ${specifier}`).toBe(true)
      }
    }
  })

  it('starts child processes with spawn only — no exec, no synchronous variant, never a shell', () => {
    expect(read('extractor.mjs').match(/import \{([^}]*)\} from 'node:child_process'/)?.[1].trim()).toBe('spawn')
    for (const file of FILES) {
      const code = read(file)
      expect(code).not.toMatch(/shell:\s*true/)
      expect(code).not.toMatch(/execSync|spawnSync|execFileSync|child_process'\s*\)\.exec/)
      if (file !== 'extractor.mjs') expect(code).not.toContain('node:child_process')
    }
  })

  it('reads nothing from its environment and sends no CORS header', () => {
    for (const file of FILES) {
      expect(read(file)).not.toMatch(/process\.env/)
      expect(read(file)).not.toMatch(/Access-Control-Allow/i)
    }
  })

  it('the gateway forwards to one fixed address and never reads what it forwards', () => {
    const gateway = read('gateway.mjs')
    expect(gateway).toContain('host: \'document-extractor\', port: 8787')
    expect(gateway).not.toMatch(/\.on\('data'/)
    expect(gateway).not.toMatch(/console\.log\((?!JSON\.stringify\(\{ event: 'gateway_listening')/)
  })
})
