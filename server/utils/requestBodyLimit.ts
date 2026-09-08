import { createError, getHeader } from 'h3'
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
 * arrive and destroying the connection the moment the limit is passed — so
 * the oversized remainder is never received, never buffered, and never
 * parsed. The declared length is still checked first, purely as a cheap
 * early-out for honest clients.
 */

export type BodyReadResult =
  | { ok: true, raw: string }
  | { ok: false, reason: 'too-large' | 'unreadable' }

/** Reads the raw body, aborting as soon as `maxBytes` is exceeded. Never buffers more than the limit. */
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
        // Stop the transfer instead of reading the rest to find out how big it was.
        req.destroy?.()
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
