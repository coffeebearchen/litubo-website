/**
 * AI-PDF-SOURCE-01 — the document-extractor security-isolation sidecar.
 *
 * Its whole job: untrusted PDF bytes in, bounded plain text or one fixed
 * failure code out. It knows nothing about products, media, Directus, AI
 * providers or customers. It holds no secrets, stores nothing, and never sees a
 * file name: the request body is the only input it has.
 *
 * Why a separate container instead of a library inside Nuxt: an in-process PDF
 * parser could not be given a real memory ceiling (V8 `resourceLimits` does not
 * bound ArrayBuffer/external memory, and a page's text is materialised before
 * any character cap applies), and a Promise timeout does not stop a parse that
 * is still running. Here the parser is Poppler, run as a child process under an
 * OS address-space limit (`prlimit --as`), killed with SIGKILL at one whole-task
 * deadline, inside a memory-, CPU- and PID-limited read-only container.
 *
 * Node built-ins only: this service has no package.json and no dependencies.
 * `server.mjs` is the entry point; everything here is exported so it can be
 * tested without Docker.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** V1 limits. Fixed in code — nothing in a request or the environment can raise them. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_PDF_PAGES = 50
export const MAX_TEXT_CHARS = 20_000
/** One deadline for the whole task: body, queue wait, pdfinfo and pdftotext together. */
export const TASK_DEADLINE_MS = 15_000
/** RLIMIT_AS for every pdfinfo / pdftotext process. */
export const CHILD_ADDRESS_SPACE_BYTES = 384 * 1024 * 1024
/** One PDF is parsed at a time; at most three more wait. A fifth concurrent request is told `busy`. */
export const MAX_ACTIVE_TASKS = 1
export const MAX_QUEUED_TASKS = 3
/**
 * Poppler accepts a `%PDF-` header anywhere in the first 1024 bytes (some
 * producers put junk before it), so a byte-0-only check would refuse PDFs
 * Poppler itself reads. The search never looks past this window.
 */
export const PDF_HEADER_SEARCH_BYTES = 1024

/** The only failure codes an extraction request can produce. */
export const PDF_FAILURE_CODES = Object.freeze([
  'too_large', 'too_many_pages', 'encrypted', 'no_text', 'timeout', 'malformed', 'unsafe_parse', 'busy',
])

const PDF_HEADER = Buffer.from('%PDF-', 'latin1')
/** pdfinfo prints a handful of lines; a document whose metadata runs past this is not normal. */
const PDFINFO_OUTPUT_LIMIT_CHARS = 64 * 1024
/**
 * pdftotext output is kept only up to this many characters, then the process is
 * stopped. It is larger than MAX_TEXT_CHARS because normalisation removes
 * trailing spaces and blank lines, so the raw run must be longer than the text
 * that is finally kept.
 */
const PDFTOTEXT_OUTPUT_LIMIT_CHARS = MAX_TEXT_CHARS * 4
/** stderr is read only to classify a failure; it is never returned or logged. */
const STDERR_KEEP_CHARS = 4 * 1024
/** Children get a minimal environment — nothing inherited from the service. */
const CHILD_ENV = Object.freeze({ PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C.UTF-8' })

const STATUS_BY_CODE = Object.freeze({
  too_large: 413,
  too_many_pages: 422,
  encrypted: 422,
  no_text: 422,
  malformed: 422,
  unsafe_parse: 422,
  timeout: 504,
  busy: 503,
  unsupported: 415,
  not_found: 404,
  method_not_allowed: 405,
})

/** True when `%PDF-` starts within the first PDF_HEADER_SEARCH_BYTES bytes. Never scans the whole body. */
export function hasPdfHeader(bytes) {
  const window = bytes.subarray(0, Math.min(bytes.length, PDF_HEADER_SEARCH_BYTES))
  return Buffer.from(window.buffer, window.byteOffset, window.byteLength).indexOf(PDF_HEADER) !== -1
}

/**
 * Reads the page count and encryption flag from pdfinfo output.
 *
 * pdfinfo prints the document's own Title/Author/Subject strings before these
 * lines, and a crafted title can contain a newline followed by a fake
 * `Pages: 1`. So each field must appear exactly once; a second copy means the
 * output cannot be trusted and the document is refused (null).
 */
export function parsePdfInfo(stdout) {
  const lines = String(stdout).split('\n').map(line => line.replace(/\r$/, ''))
  const pageLines = lines.filter(line => line.startsWith('Pages:'))
  const encryptedLines = lines.filter(line => line.startsWith('Encrypted:'))
  if (pageLines.length !== 1 || encryptedLines.length !== 1) return null
  const pages = /^Pages:\s+(\d{1,9})\s*$/.exec(pageLines[0])
  const encrypted = /^Encrypted:\s+(yes|no)\b/.exec(encryptedLines[0])
  if (!pages || !encrypted) return null
  return { pages: Number(pages[1]), encrypted: encrypted[1] === 'yes' }
}

/**
 * Turns pdftotext output into the text that is returned.
 *
 * Page breaks become a blank line: there is no page-locator contract, so no
 * page marker is invented and no form feed is passed on. Control characters
 * other than tab and newline become spaces. Trailing spaces are dropped (they
 * carry no layout and cost characters); spaces inside a line are kept, because
 * that is where `-layout` puts table columns. The result is capped the same way
 * a TXT source is — the start of the document is kept — without splitting a
 * surrogate pair.
 */
export function normalizeExtractedText(raw, maxChars = MAX_TEXT_CHARS) {
  let text = String(raw)
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/(?![\t\n])\p{Cc}/gu, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (text.length > maxChars) {
    text = text.slice(0, maxChars)
    const last = text.charCodeAt(text.length - 1)
    if (last >= 0xD800 && last <= 0xDBFF) text = text.slice(0, -1)
    text = text.trimEnd()
  }
  return text
}

/** `prlimit` sets RLIMIT_AS (and no core dump) for itself, then execs the tool — the limited process IS the tool. */
export function limitedCommand(tool, toolArgs, addressSpaceBytes = CHILD_ADDRESS_SPACE_BYTES) {
  return {
    command: 'prlimit',
    args: [`--as=${addressSpaceBytes}`, '--core=0', '--', tool, ...toolArgs],
  }
}

/**
 * Runs one child process with an argument array (never a shell), collecting
 * stdout only up to `maxStdoutChars`.
 *
 * Every stop is a real SIGKILL of the child, not an abandoned promise: at the
 * deadline, when `signal` aborts, and when enough output has been read. The
 * promise settles only after the child has exited and its pipes have closed.
 * stdout is decoded incrementally, so a multi-byte UTF-8 character split across
 * two chunks is never corrupted.
 */
export function runBounded({
  command,
  args,
  deadline,
  signal,
  maxStdoutChars,
  env = CHILD_ENV,
  spawnProcess = spawn,
}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawnProcess(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true, env })
    }
    catch {
      resolve({ kind: 'spawn_error' })
      return
    }

    const decoder = new TextDecoder('utf-8')
    let stdout = ''
    let stderr = ''
    let stopReason = null
    let settled = false

    const stop = (reason) => {
      if (stopReason) return
      stopReason = reason
      child.kill('SIGKILL')
    }
    const onAbort = () => stop('aborted')
    const timer = setTimeout(() => stop('deadline'), Math.max(0, deadline - Date.now()))
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    const settle = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }

    child.stdout.on('data', (chunk) => {
      if (stopReason) return
      stdout += decoder.decode(chunk, { stream: true })
      if (stdout.length >= maxStdoutChars) stop('output_limit')
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < STDERR_KEEP_CHARS) stderr += chunk.toString('latin1').slice(0, STDERR_KEEP_CHARS - stderr.length)
    })
    child.on('error', () => {
      // A process that never started has no pid and may never emit 'close'.
      if (child.pid === undefined) settle({ kind: 'spawn_error' })
    })
    child.on('close', (code, exitSignal) => {
      if (stopReason === 'deadline') return settle({ kind: 'deadline', pid: child.pid })
      if (stopReason === 'aborted') return settle({ kind: 'aborted', pid: child.pid })
      if (stopReason === 'output_limit') {
        return settle({ kind: 'exited', code: 0, signal: null, stdout, stderr, truncated: true, pid: child.pid })
      }
      stdout += decoder.decode()
      settle({ kind: 'exited', code, signal: exitSignal, stdout, stderr, truncated: false, pid: child.pid })
    })
  })
}

/** A Poppler tool that exited on its own with a failure. Only a fixed code leaves this function. */
function classifyToolFailure(outcome) {
  if (outcome.signal) return 'unsafe_parse'
  // Poppler exit codes: 1 = error opening the PDF, 3 = PDF permissions.
  if (outcome.code === 3) return 'encrypted'
  if (outcome.code === 1) return /incorrect password/i.test(outcome.stderr) ? 'encrypted' : 'malformed'
  return 'unsafe_parse'
}

/**
 * The whole extraction for one PDF already written to `filePath`.
 *
 * pdfinfo runs first so a document can be refused before any text is
 * extracted: an encrypted document, or one with more than MAX_PDF_PAGES pages.
 * A long document is refused rather than cut to its first pages, because a
 * later page may hold the value that contradicts an earlier one. `-l` on
 * pdftotext is defence in depth only — pdfinfo has already refused anything
 * longer.
 */
export async function extractPdfText(filePath, { deadline, signal, runTool }) {
  const info = await runTool('pdfinfo', [filePath], {
    deadline, signal, maxStdoutChars: PDFINFO_OUTPUT_LIMIT_CHARS,
  })
  if (info.kind === 'deadline') return { code: 'timeout' }
  if (info.kind === 'aborted') return { code: 'aborted' }
  if (info.kind !== 'exited' || info.truncated) return { code: 'unsafe_parse' }
  if (info.code !== 0 || info.signal) return { code: classifyToolFailure(info) }

  const parsed = parsePdfInfo(info.stdout)
  if (!parsed || parsed.pages < 1) return { code: 'malformed' }
  if (parsed.encrypted) return { code: 'encrypted' }
  if (parsed.pages > MAX_PDF_PAGES) return { code: 'too_many_pages' }

  const extracted = await runTool(
    'pdftotext',
    ['-layout', '-enc', 'UTF-8', '-eol', 'unix', '-l', String(MAX_PDF_PAGES), filePath, '-'],
    { deadline, signal, maxStdoutChars: PDFTOTEXT_OUTPUT_LIMIT_CHARS },
  )
  if (extracted.kind === 'deadline') return { code: 'timeout' }
  if (extracted.kind === 'aborted') return { code: 'aborted' }
  if (extracted.kind !== 'exited') return { code: 'unsafe_parse' }
  // Stopping pdftotext once enough text has been read is the character cap
  // doing its job, not a parser failure.
  if (!extracted.truncated && (extracted.code !== 0 || extracted.signal)) return { code: classifyToolFailure(extracted) }

  const text = normalizeExtractedText(extracted.stdout)
  return text ? { text } : { code: 'no_text' }
}

/**
 * Admission control: MAX_ACTIVE_TASKS running, MAX_QUEUED_TASKS waiting.
 * A ticket holds its place from admission until release, so a request that is
 * still uploading its body already counts as queued.
 */
export function createAdmissionQueue({ maxActive = MAX_ACTIVE_TASKS, maxQueued = MAX_QUEUED_TASKS } = {}) {
  let running = 0
  let admitted = 0
  const waiters = []

  const pump = () => {
    while (running < maxActive && waiters.length > 0) {
      running++
      waiters.shift().grant()
    }
  }

  return {
    stats: () => ({ running, admitted, waiting: waiters.length }),
    admit() {
      if (admitted >= maxActive + maxQueued) return null
      admitted++
      let state = 'admitted'
      return {
        /** Resolves true once this ticket may run, false if `signal` aborted first. */
        start(signal) {
          if (state !== 'admitted') return Promise.resolve(false)
          if (signal?.aborted) return Promise.resolve(false)
          if (running < maxActive) {
            running++
            state = 'running'
            return Promise.resolve(true)
          }
          state = 'waiting'
          return new Promise((resolve) => {
            const waiter = {
              grant: () => {
                signal?.removeEventListener('abort', onAbort)
                state = 'running'
                resolve(true)
              },
            }
            const onAbort = () => {
              const index = waiters.indexOf(waiter)
              if (index !== -1) waiters.splice(index, 1)
              resolve(false)
            }
            signal?.addEventListener('abort', onAbort, { once: true })
            waiters.push(waiter)
          })
        },
        release() {
          if (state === 'released') return
          if (state === 'running') running--
          if (state === 'waiting') {
            // An aborted waiter has already left the line; nothing else to undo.
          }
          state = 'released'
          admitted--
          pump()
        },
      }
    },
  }
}

function sendJson(res, status, payload, headers = {}) {
  if (res.headersSent || res.destroyed) return
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(body)
}

function sendFailure(res, code, headers) {
  sendJson(res, STATUS_BY_CODE[code] ?? 422, { ok: false, code }, headers)
}

/**
 * Refuses without reading the body. Reading is paused and the answer is written
 * normally with `Connection: close`: destroying the socket instead would make a
 * client that is still sending see a reset connection rather than the refusal.
 */
function refuse(req, res, code, headers = {}) {
  req.pause()
  sendFailure(res, code, { Connection: 'close', ...headers })
}

/** Reads the body, keeping at most `maxBytes`; never buffers past the limit. `keep: false` discards it. */
function readBody(req, { maxBytes, deadline, signal, keep = true }) {
  return new Promise((resolve) => {
    const chunks = []
    let received = 0
    let done = false

    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      resolve(result)
    }
    const onData = (chunk) => {
      received += chunk.length
      if (received > maxBytes) {
        req.pause()
        finish({ ok: false, reason: 'too_large' })
        return
      }
      if (keep) chunks.push(chunk)
    }
    const onEnd = () => finish({ ok: true, body: keep ? Buffer.concat(chunks, received) : null })
    const onError = () => finish({ ok: false, reason: 'error' })
    const onAbort = () => finish({ ok: false, reason: 'aborted' })
    const timer = setTimeout(() => finish({ ok: false, reason: 'deadline' }), Math.max(0, deadline - Date.now()))

    signal.addEventListener('abort', onAbort, { once: true })
    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
  })
}

/** Log entries carry an event name, a result code and a duration — never a body, text, name or identifier. */
function defaultLog(entry) {
  console.log(JSON.stringify(entry))
}

async function handleExtract(req, res, ctx) {
  const startedAt = Date.now()
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/pdf') {
    refuse(req, res, 'unsupported')
    return
  }
  const declaredLength = req.headers['content-length']
  if (declaredLength !== undefined && Number(declaredLength) > ctx.maxPdfBytes) {
    refuse(req, res, 'too_large')
    ctx.log({ event: 'extract', result: 'too_large', ms: Date.now() - startedAt })
    return
  }

  const deadline = startedAt + ctx.taskDeadlineMs
  const task = new AbortController()
  let deadlineReached = false
  let clientGone = false
  const deadlineTimer = setTimeout(() => {
    deadlineReached = true
    task.abort()
  }, ctx.taskDeadlineMs)
  res.on('close', () => {
    if (!res.writableFinished) {
      clientGone = true
      task.abort()
    }
  })

  const ticket = ctx.queue.admit()
  let tempPath = null
  let result

  try {
    result = await (async () => {
      if (!ticket) {
        // Read and discard the body so the client receives the answer instead of a reset connection.
        const drained = await readBody(req, { maxBytes: ctx.maxPdfBytes, deadline, signal: task.signal, keep: false })
        return drained.ok || drained.reason === 'deadline' ? { code: 'busy' } : { code: drained.reason === 'too_large' ? 'too_large' : 'aborted' }
      }

      const body = await readBody(req, { maxBytes: ctx.maxPdfBytes, deadline, signal: task.signal })
      if (!body.ok) {
        if (body.reason === 'too_large') return { code: 'too_large' }
        if (body.reason === 'deadline' || deadlineReached) return { code: 'timeout' }
        return { code: 'aborted' }
      }
      if (!hasPdfHeader(body.body)) return { code: 'malformed' }

      const started = await ticket.start(task.signal)
      if (!started) return { code: deadlineReached ? 'busy' : 'aborted' }

      // The service chooses the temporary name. Nothing from the request is ever part of a path.
      tempPath = join(ctx.tmpDir, `${randomUUID()}.pdf`)
      await writeFile(tempPath, body.body, { mode: 0o600, flag: 'wx' })

      const extracted = await extractPdfText(tempPath, { deadline, signal: task.signal, runTool: ctx.runTool })
      if (extracted.code === 'aborted' && deadlineReached) return { code: 'timeout' }
      return extracted
    })()
  }
  catch {
    result = { code: 'unsafe_parse' }
  }
  finally {
    clearTimeout(deadlineTimer)
    if (tempPath) await rm(tempPath, { force: true }).catch(() => {})
    ticket?.release()
  }

  const outcome = result.text !== undefined ? 'ok' : result.code
  ctx.log({ event: 'extract', result: clientGone ? 'client_closed' : outcome, ms: Date.now() - startedAt })
  if (clientGone || result.code === 'aborted') {
    if (!res.headersSent) res.destroy()
    return
  }
  if (result.text !== undefined) {
    sendJson(res, 200, { ok: true, text: result.text })
    return
  }
  if (result.code === 'too_large') {
    refuse(req, res, 'too_large')
    return
  }
  sendFailure(res, result.code)
}

/**
 * The HTTP surface: `GET /healthz` and `POST /extract/pdf`, nothing else.
 * No upload, list, admin or debug route exists, and no CORS header is sent —
 * a browser has no reason to reach this service.
 */
export function createExtractorServer({
  runTool = (tool, toolArgs, options) => runBounded({ ...limitedCommand(tool, toolArgs), ...options }),
  tmpDir = tmpdir(),
  taskDeadlineMs = TASK_DEADLINE_MS,
  maxPdfBytes = MAX_PDF_BYTES,
  maxActive = MAX_ACTIVE_TASKS,
  maxQueued = MAX_QUEUED_TASKS,
  log = defaultLog,
} = {}) {
  const ctx = {
    runTool,
    tmpDir,
    taskDeadlineMs,
    maxPdfBytes,
    log,
    queue: createAdmissionQueue({ maxActive, maxQueued }),
  }

  const server = createServer((req, res) => {
    let pathname
    try {
      pathname = new URL(req.url ?? '/', 'http://extractor.invalid').pathname
    }
    catch {
      refuse(req, res, 'not_found')
      return
    }

    if (pathname === '/healthz') {
      if (req.method === 'GET' || req.method === 'HEAD') sendJson(res, 200, { ok: true })
      else refuse(req, res, 'method_not_allowed', { Allow: 'GET, HEAD' })
      return
    }
    if (pathname === '/extract/pdf') {
      if (req.method !== 'POST') {
        refuse(req, res, 'method_not_allowed', { Allow: 'POST' })
        return
      }
      handleExtract(req, res, ctx).catch(() => {
        if (!res.headersSent) sendFailure(res, 'unsafe_parse')
      })
      return
    }
    refuse(req, res, 'not_found')
  })

  server.headersTimeout = 10_000
  server.requestTimeout = taskDeadlineMs + 5_000
  server.keepAliveTimeout = 5_000
  server.maxConnections = 32
  server.extractorQueue = ctx.queue
  return server
}
