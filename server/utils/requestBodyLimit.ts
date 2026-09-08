import { createError, getHeader, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — byte-limited request body reading.
 *
 * The previous guard trusted the declared `Content-Length` and then called
 * `readBody()`, which has three holes: a request can omit the header entirely
 * (`Transfer-Encoding: chunked`, and HTTP/2 where `Content-Length` is
 * optional), it can declare a small length and send far more, and it can
 * declare a non-numeric value. In all three the body was fully buffered and
 * parsed before anything checked its real size.
 *
 * This reads the raw request stream itself, counting actual bytes as they
 * arrive and stopping the moment the limit is passed — so the oversized
 * remainder is never buffered and never parsed. The declared length is still
 * checked first, purely as a cheap early-out for honest clients.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — response first, close after. An earlier
 * version called `req.destroy()` on overflow, which aborts the connection
 * before the handler can write anything: a real HTTP/1.1 client saw
 * ECONNRESET rather than the 413 this code intended to send. Reading is
 * paused instead, the 413 is written normally, and `Connection: close` tells
 * the client not to reuse a connection whose request body was never fully
 * read.
 *
 * Honest limitation: a `Content-Length` that is not a valid number is
 * rejected by Node's HTTP parser itself, before any route or middleware runs,
 * so such a request is answered with a 400 by the server and never reaches
 * this function. Only a *numerically valid* declared length, an understated
 * one, or an absent one (chunked / HTTP2) is handled here.
 */

export type BodyReadResult =
  | { ok: true, raw: string }
  | { ok: false, reason: 'too-large' | 'unreadable' }

/** Marks the connection non-reusable, so the refusal is delivered and then the socket closes cleanly. */
function closeAfterResponse(event: H3Event): void {
  try {
    setResponseHeader(event, 'Connection', 'close')
  } catch {
    // A response already committed elsewhere is not this helper's problem.
  }
}

/** Reads the raw body, stopping as soon as `maxBytes` is exceeded. Never buffers more than the limit. */
export function readRawBodyWithByteLimit(event: H3Event, maxBytes: number): Promise<BodyReadResult> {
  const declared = Number(getHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.resolve({ ok: false, reason: 'too-large' })
  }

  const req = event.node.req as NodeJS.ReadableStream & { destroy?: (error?: Error) => void }
  if (!req || typeof req.on !== 'function') {
    return Promise.resolve({ ok: false, reason: 'unreadable' })
  }

  return new Promise<BodyReadResult>((resolve) => {
    const chunks: Buffer[] = []
    let received = 0
    let settled = false

    const finish = (result: BodyReadResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      received += buf.length
      if (received > maxBytes) {
        // Stop accumulating and stop reading, but do NOT destroy the socket
        // here. Destroying it mid-request makes a real HTTP/1.1 client see
        // ECONNRESET instead of the 413 the route is about to write, which
        // turns a clear refusal into an opaque network failure. Pausing is
        // enough to stop consuming the body; the response is written first and
        // the connection closed after it (see `closeAfterResponse` below).
        req.pause?.()
        finish({ ok: false, reason: 'too-large' })
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => finish({ ok: true, raw: Buffer.concat(chunks).toString('utf8') }))
    req.on('error', () => finish({ ok: false, reason: 'unreadable' }))
    req.on('aborted', () => finish({ ok: false, reason: 'unreadable' }))
  })
}

/**
 * Reads and JSON-parses a request body under a hard byte ceiling. Throws 413
 * for an oversized body — whether the size was declared honestly, declared
 * falsely, or not declared at all — and 400 for a body that is not valid JSON.
 * The parse only ever sees bytes that already passed the limit.
 */
export async function readJsonBodyWithByteLimit<T = unknown>(event: H3Event, maxBytes: number): Promise<T> {
  const result = await readRawBodyWithByteLimit(event, maxBytes)
  if (!result.ok) {
    if (result.reason === 'too-large') {
      // The remainder of the body is deliberately never read, so this
      // connection cannot be reused for a following request.
      closeAfterResponse(event)
      throw createError({ statusCode: 413, message: 'Request body is too large.' })
    }
    throw createError({ statusCode: 400, message: 'Request body could not be read.' })
  }
  if (!result.raw.trim()) return undefined as T
  try {
    return JSON.parse(result.raw) as T
  } catch {
    throw createError({ statusCode: 400, message: 'Request body is not valid JSON.' })
  }
}
