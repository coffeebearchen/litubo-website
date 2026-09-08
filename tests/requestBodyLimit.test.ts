/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — the request body limit, exercised over a
 * REAL HTTP/1.1 connection.
 *
 * The unit-level tests elsewhere drive the reader with an in-process stream,
 * which cannot show what a network client actually receives. That mattered:
 * the earlier implementation called `req.destroy()` on overflow, so a real
 * client got ECONNRESET instead of the 413 the code intended to send. These
 * tests start an actual `http` server, speak to it with real requests, and
 * assert on the status line the client really sees.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readRawBodyWithByteLimit } from '../server/utils/requestBodyLimit'

const LIMIT = 1024

let server: Server | undefined

afterEach(async () => {
  if (server) {
    await new Promise<void>(resolve => server!.close(() => resolve()))
    server = undefined
  }
})

/**
 * Starts a server that applies the real byte limit and answers exactly as the
 * production handler does: 413 with `Connection: close` when the body is too
 * large, 200 otherwise.
 */
async function startLimitedServer(): Promise<number> {
  server = createServer(async (req, res) => {
    const event = { node: { req, res } } as unknown as Parameters<typeof readRawBodyWithByteLimit>[0]
    const result = await readRawBodyWithByteLimit(event, LIMIT)
    if (!result.ok && result.reason === 'too-large') {
      res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' })
      res.end(JSON.stringify({ statusCode: 413, message: 'Request body is too large.' }))
      return
    }
    if (!result.ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ statusCode: 400 }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, received: result.raw.length }))
  })

  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  return (server!.address() as AddressInfo).port
}

interface ClientOutcome {
  status?: number
  body?: string
  error?: string
}

/** Sends a request and reports what the client saw — including a transport error such as ECONNRESET. */
function send(port: number, opts: { headers?: Record<string, string>, chunks: string[] }): Promise<ClientOutcome> {
  return new Promise<ClientOutcome>((resolve) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path: '/', method: 'POST', headers: opts.headers ?? {} },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += String(c) })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      },
    )
    req.on('error', (err: NodeJS.ErrnoException) => resolve({ error: err.code ?? err.message }))
    for (const chunk of opts.chunks) req.write(chunk)
    req.end()
  })
}

describe('request body limit over real HTTP/1.1', () => {
  it('a chunked (no Content-Length) oversized body gets a real 413, not a connection reset', async () => {
    const port = await startLimitedServer()

    // No content-length header -> Node uses Transfer-Encoding: chunked.
    const outcome = await send(port, { chunks: ['x'.repeat(LIMIT * 4)] })

    expect(outcome.error).toBeUndefined() // the decisive assertion: no ECONNRESET
    expect(outcome.status).toBe(413)
    expect(outcome.body).toContain('Request body is too large.')
  }, 20_000)

  it('a chunked body sent in many small pieces is also refused with 413', async () => {
    const port = await startLimitedServer()
    const chunks = Array.from({ length: 40 }, () => 'y'.repeat(100))

    const outcome = await send(port, { chunks })

    expect(outcome.error).toBeUndefined()
    expect(outcome.status).toBe(413)
  }, 20_000)

  it('an honestly declared oversized Content-Length gets a 413 as well', async () => {
    const port = await startLimitedServer()
    const body = 'z'.repeat(LIMIT * 3)

    const outcome = await send(port, {
      headers: { 'content-length': String(Buffer.byteLength(body)) },
      chunks: [body],
    })

    expect(outcome.error).toBeUndefined()
    expect(outcome.status).toBe(413)
  }, 20_000)

  it('a body within the limit is accepted normally', async () => {
    const port = await startLimitedServer()
    const body = JSON.stringify({ providerId: 'deepseek', sourceRefs: ['a'] })

    const outcome = await send(port, {
      headers: { 'content-type': 'application/json' },
      chunks: [body],
    })

    expect(outcome.status).toBe(200)
    expect(outcome.body).toContain('"ok":true')
  }, 20_000)

  /**
   * Documented honestly rather than asserted as a 413: an invalid
   * `Content-Length` is rejected by Node's own HTTP parser before any route,
   * middleware or body reader runs, so the client sees the server's 400 and
   * this code never executes. Claiming "invalid Content-Length returns 413"
   * would be false.
   */
  it('an invalid Content-Length is rejected by the HTTP parser itself, before this code runs', async () => {
    const port = await startLimitedServer()

    const outcome = await send(port, {
      headers: { 'content-length': 'not-a-number' },
      chunks: ['{}'],
    })

    // Either a 400 from the parser or a transport-level rejection — never a
    // silently accepted request, and never our 413.
    expect(outcome.status === 400 || outcome.error !== undefined).toBe(true)
    expect(outcome.status).not.toBe(200)
  }, 20_000)
})
