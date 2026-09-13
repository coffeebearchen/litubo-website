/**
 * AI-PDF-SOURCE-01 — the Nuxt server's PDF reader client.
 *
 * The transport is stubbed in every test: no sidecar, no network. What these
 * tests hold in place is that only two answers ever leave the client — bounded
 * text, or one of the agreed failure codes — whatever the sidecar, or anything
 * else listening on its address, sends back.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createPdfTextReader,
  extractorEndpoint,
  hasPdfHeader,
  MAX_EXTRACTOR_RESPONSE_BYTES,
  MAX_PDF_TEXT_CHARS,
  PDF_HEADER_SEARCH_BYTES,
  PDF_READER_FAILURE_CODES,
} from '../server/utils/documentExtractorClient'
import { MAX_PER_FILE_CHARS } from '../server/utils/aiTextExtraction'
import * as sidecar from '../document-extractor/extractor.mjs'

const BASE_URL = 'http://127.0.0.1:8787'
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n%TEST ONLY — NOT FOR PUBLICATION\n')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function readerReturning(response: Response, maxTextChars?: number) {
  const fetchImpl = vi.fn(async () => response)
  return createPdfTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch, maxTextChars })
}

function withHeaderAt(offset: number): Uint8Array {
  const bytes = new Uint8Array(offset + 64).fill(0x20)
  bytes.set(new TextEncoder().encode('%PDF-1.7'), offset)
  return bytes
}

describe('the PDF header check — a content type or a file name is never enough', () => {
  it.each([
    ['at byte 0', withHeaderAt(0), true],
    ['after 300 bytes of leading junk, as some producers write', withHeaderAt(300), true],
    ['starting at the last position the 1024-byte window can hold', withHeaderAt(PDF_HEADER_SEARCH_BYTES - 5), true],
    ['starting one byte too late for the window', withHeaderAt(PDF_HEADER_SEARCH_BYTES - 4), false],
    ['absent', new TextEncoder().encode('Model: LT180C\nAperture: 180 mm'), false],
    ['empty', new Uint8Array(0), false],
  ])('%s', (_label, bytes, expected) => {
    expect(hasPdfHeader(bytes)).toBe(expected)
  })

  it('never scans past the window, however large the input', () => {
    const bytes = new Uint8Array(5 * 1024 * 1024)
    bytes.set(new TextEncoder().encode('%PDF-'), 4 * 1024 * 1024)
    expect(hasPdfHeader(bytes)).toBe(false)
  })

  it('agrees with the sidecar\'s own check at every offset around the window edge', () => {
    for (const offset of [0, 1, 300, 1018, 1019, 1020, 1023, 2000]) {
      const bytes = withHeaderAt(offset)
      expect(hasPdfHeader(bytes), `offset ${offset}`).toBe(sidecar.hasPdfHeader(Buffer.from(bytes)))
    }
  })
})

describe('the client and the sidecar agree on the contract between them', () => {
  it('the same header window, the same text ceiling as every other source, and the same failure codes', () => {
    expect(PDF_HEADER_SEARCH_BYTES).toBe(sidecar.PDF_HEADER_SEARCH_BYTES)
    expect(MAX_PDF_TEXT_CHARS).toBe(sidecar.MAX_TEXT_CHARS)
    expect(MAX_PDF_TEXT_CHARS).toBe(MAX_PER_FILE_CHARS)
    expect([...PDF_READER_FAILURE_CODES].sort()).toEqual([...sidecar.PDF_FAILURE_CODES].sort())
  })
})

describe('the configured sidecar address', () => {
  it.each([
    ['http://127.0.0.1:8787', 'http://127.0.0.1:8787/extract/pdf'],
    ['http://127.0.0.1:8787/', 'http://127.0.0.1:8787/extract/pdf'],
    ['http://document-extractor:8787', 'http://document-extractor:8787/extract/pdf'],
    ['  http://127.0.0.1:8787  ', 'http://127.0.0.1:8787/extract/pdf'],
    ['http://127.0.0.1:8787/?x=1#y', 'http://127.0.0.1:8787/extract/pdf'],
  ])('%s → %s', (base, expected) => {
    expect(extractorEndpoint(base)?.toString()).toBe(expected)
  })

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
    ['not a URL', 'not a url'],
    ['ftp', 'ftp://127.0.0.1/'],
    ['javascript', 'javascript:alert(1)'],
    ['credentials in the URL', 'http://user:secret@127.0.0.1:8787'],
  ])('refuses %s', (_label, base) => {
    expect(extractorEndpoint(base as string | null | undefined)).toBeNull()
  })

  it('with no usable address a PDF is unavailable, and nothing is sent anywhere', async () => {
    const fetchImpl = vi.fn()
    const read = createPdfTextReader({ baseUrl: '', fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await read(PDF_BYTES, { timeoutMs: 1_000 })).toEqual({ ok: false, code: 'unavailable' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('what is sent to the sidecar', () => {
  it('one POST of the PDF bytes, as application/pdf, never following a redirect, and nothing naming a file, a product or a Media asset', async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse(200, { ok: true, text: 'Aperture: 180 mm' }))
    const read = createPdfTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch })
    await read(PDF_BYTES, { timeoutMs: 1_000 })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [input, init] = fetchImpl.mock.calls[0]
    expect(String(input)).toBe('http://127.0.0.1:8787/extract/pdf')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/pdf' })
    expect(init?.body).toBe(PDF_BYTES)
    expect(init?.redirect).toBe('error')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(Object.keys(init ?? {}).sort()).toEqual(['body', 'headers', 'method', 'redirect', 'signal'])
  })
})

describe('only the two agreed answers come back', () => {
  it('text', async () => {
    const read = readerReturning(jsonResponse(200, { ok: true, text: 'Model: LT180C\nAperture: 180 mm' }))
    expect(await read(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: true, text: 'Model: LT180C\nAperture: 180 mm' })
  })

  it.each([...PDF_READER_FAILURE_CODES])('the failure code %s', async (code) => {
    const read = readerReturning(jsonResponse(code === 'busy' ? 503 : 422, { ok: false, code }))
    expect(await read(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code })
  })

  it.each([
    ['an unknown code', () => jsonResponse(422, { ok: false, code: 'stack_trace' })],
    ['a failure dressed as a success status', () => jsonResponse(200, { ok: false, code: 'no_text' })],
    ['a success with an error status', () => jsonResponse(422, { ok: true, text: 'x' })],
    ['text that is not a string', () => jsonResponse(200, { ok: true, text: 42 })],
    ['no ok field', () => jsonResponse(200, { text: 'x' })],
    ['an array', () => jsonResponse(200, [{ ok: true, text: 'x' }])],
    ['null', () => jsonResponse(200, null)],
    ['an HTML error page', () => new Response('<html>502 Bad Gateway</html>', { status: 502 })],
    ['an empty body', () => new Response('', { status: 200 })],
  ])('%s is "unavailable"', async (_label, makeResponse) => {
    const read = readerReturning(makeResponse())
    expect(await read(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code: 'unavailable' })
  })

  it('text over the ceiling is refused whole — never cut down and passed on', async () => {
    const read = readerReturning(jsonResponse(200, { ok: true, text: 'x'.repeat(MAX_PDF_TEXT_CHARS + 1) }))
    expect(await read(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code: 'unavailable' })
  })

  it('whitespace-only text is no_text', async () => {
    const read = readerReturning(jsonResponse(200, { ok: true, text: ' \n\t ' }))
    expect(await read(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code: 'no_text' })
  })

  it('extra fields — stderr, a path, a stack, an exit code — never leave the client', async () => {
    const failure = await readerReturning(jsonResponse(422, {
      ok: false, code: 'malformed', stderr: 'Syntax Error: Couldn\'t read xref table', path: '/tmp/3f2c.pdf', stack: 'Error: at parse',
    }))(PDF_BYTES, { timeoutMs: 2_000 })
    expect(failure).toEqual({ ok: false, code: 'malformed' })
    expect(JSON.stringify(failure)).not.toMatch(/stderr|Syntax|\/tmp|stack/)

    const success = await readerReturning(jsonResponse(200, { ok: true, text: 'Aperture: 180 mm', stderr: 'warning', exitCode: 0 }))(PDF_BYTES, { timeoutMs: 2_000 })
    expect(success).toEqual({ ok: true, text: 'Aperture: 180 mm' })
  })

  it('a response declaring more than the size ceiling is refused before its body is read', async () => {
    const response = new Response('{}', { status: 200, headers: { 'Content-Length': String(MAX_EXTRACTOR_RESPONSE_BYTES + 1) } })
    expect(await readerReturning(response)(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code: 'unavailable' })
  })

  it('a response body that keeps coming past the ceiling is abandoned mid-stream', async () => {
    let pulls = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(new Uint8Array(64 * 1024).fill(0x61))
      },
    })
    expect(await readerReturning(new Response(endless, { status: 200 }))(PDF_BYTES, { timeoutMs: 2_000 })).toEqual({ ok: false, code: 'unavailable' })
    // 256 KB in 64 KB chunks: it stops within a handful of pulls instead of draining an endless stream.
    expect(pulls).toBeLessThan(10)
  })

  it('a transport failure — refused connection, DNS, a redirect under redirect: "error" — is unavailable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const read = createPdfTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await read(PDF_BYTES, { timeoutMs: 1_000 })).toEqual({ ok: false, code: 'unavailable' })
  })
})

describe('the read is aborted when its time runs out — the request itself, not just the wait', () => {
  it('a sidecar that never answers: the request signal fires and the result is timeout', async () => {
    let signal: AbortSignal | undefined
    const fetchImpl = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const read = createPdfTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch })
    const started = Date.now()
    expect(await read(PDF_BYTES, { timeoutMs: 50 })).toEqual({ ok: false, code: 'timeout' })
    expect(signal?.aborted).toBe(true)
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('a body that stalls after the headers still ends at the deadline, even when the stream ignores the abort', async () => {
    const stalled = new ReadableStream<Uint8Array>({ start() {} })
    const read = readerReturning(new Response(stalled, { status: 200 }))
    expect(await read(PDF_BYTES, { timeoutMs: 50 })).toEqual({ ok: false, code: 'timeout' })
  })

  it('with no time left, nothing is sent', async () => {
    const fetchImpl = vi.fn()
    const read = createPdfTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await read(PDF_BYTES, { timeoutMs: 0 })).toEqual({ ok: false, code: 'timeout' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
