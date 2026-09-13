/**
 * AI-PDF-SOURCE-01 — the Nuxt server's only way to read a PDF.
 *
 * Nuxt never parses a PDF itself. It sends the bytes to the document-extractor
 * sidecar (a separate, resource-limited container; see `document-extractor/`)
 * and accepts exactly two answers back: bounded text, or one of a fixed set of
 * failure codes. Anything else the sidecar could send — an unknown code, text
 * over the cap, a malformed body, a redirect, a response that is too large, no
 * answer at all — means "the reader is unavailable", and nothing from it goes
 * any further. The sidecar is ours, but it handles untrusted documents, so its
 * answers are validated like any other input.
 *
 * Server-only. No Vue component calls the sidecar, and the browser has no reason
 * to know it exists.
 */

import type { SourceFailureCode } from '../../utils/aiSourceFormats'

/** Poppler accepts a `%PDF-` header anywhere in the first 1024 bytes. The search never looks further. */
export const PDF_HEADER_SEARCH_BYTES = 1024

/** The most text a PDF may contribute — the same per-file ceiling every source has. */
export const MAX_PDF_TEXT_CHARS = 20_000

/** 20,000 characters of JSON-escaped text fits comfortably; a larger response is not one the sidecar sends. */
export const MAX_EXTRACTOR_RESPONSE_BYTES = 256 * 1024

/** The failure codes the sidecar is allowed to report. Each one has a fixed sentence in the shared contract. */
export const PDF_READER_FAILURE_CODES = [
  'too_large',
  'too_many_pages',
  'encrypted',
  'no_text',
  'timeout',
  'malformed',
  'unsafe_parse',
  'busy',
] as const satisfies readonly SourceFailureCode[]

export type PdfReaderFailureCode = typeof PDF_READER_FAILURE_CODES[number] | 'unavailable'

export type PdfTextReadResult =
  | { ok: true, text: string }
  | { ok: false, code: PdfReaderFailureCode }

/** Reads one PDF. `timeoutMs` is the most time this read may take; the request is aborted when it runs out. */
export type PdfTextReader = (pdfBytes: Uint8Array, options: { timeoutMs: number }) => Promise<PdfTextReadResult>

const UNAVAILABLE: PdfTextReadResult = { ok: false, code: 'unavailable' }
const PDF_HEADER = Buffer.from('%PDF-', 'latin1')

/** True when `%PDF-` starts within the first PDF_HEADER_SEARCH_BYTES bytes. The content type and file name are never enough. */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const window = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, PDF_HEADER_SEARCH_BYTES))
  return window.indexOf(PDF_HEADER) !== -1
}

/**
 * The extraction endpoint for a configured base URL, or null when there is no
 * usable one. Only http(s) is accepted, and a URL carrying credentials is
 * refused rather than sent.
 */
export function extractorEndpoint(baseUrl: string | null | undefined): URL | null {
  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') return null
  try {
    const base = baseUrl.trim()
    const url = new URL('extract/pdf', base.endsWith('/') ? base : `${base}/`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    url.search = ''
    url.hash = ''
    return url
  }
  catch {
    return null
  }
}

/** Settles with the promise, or rejects as soon as `signal` aborts — aborting does not always settle a pending read on its own. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

/** Reads the response body, giving up (null) as soon as it passes `maxBytes`. */
async function readBoundedBody(response: Response, controller: AbortController, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    controller.abort()
    return null
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await untilAborted(reader.read(), controller.signal)
    if (done) break
    if (!value) continue
    received += value.byteLength
    if (received > maxBytes) {
      controller.abort()
      void reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, received).toString('utf8')
}

/** Only the two agreed shapes pass. Everything else is "unavailable", and its content goes nowhere. */
function interpretResponse(status: number, bodyText: string, maxTextChars: number): PdfTextReadResult {
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  }
  catch {
    return UNAVAILABLE
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return UNAVAILABLE
  const record = body as Record<string, unknown>

  if (record.ok === true) {
    if (status !== 200 || typeof record.text !== 'string') return UNAVAILABLE
    if (record.text.length > maxTextChars) return UNAVAILABLE
    if (record.text.trim() === '') return { ok: false, code: 'no_text' }
    return { ok: true, text: record.text }
  }

  if (record.ok === false && typeof record.code === 'string' && status >= 400) {
    const code = PDF_READER_FAILURE_CODES.find(known => known === record.code)
    if (code) return { ok: false, code }
  }
  return UNAVAILABLE
}

/**
 * Builds the PDF reader for one configured sidecar URL.
 *
 * The request carries the PDF bytes and nothing else: no file name, no product,
 * no Media UUID. It is aborted when `timeoutMs` runs out — the sidecar has its
 * own, independent hard deadline too — and it never follows a redirect, so the
 * document cannot be sent anywhere but the configured address.
 */
export function createPdfTextReader(options: {
  baseUrl: string | null | undefined
  fetchImpl?: typeof fetch
  maxTextChars?: number
}): PdfTextReader {
  const endpoint = extractorEndpoint(options.baseUrl)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const maxTextChars = options.maxTextChars ?? MAX_PDF_TEXT_CHARS

  return async (pdfBytes, { timeoutMs }) => {
    if (!endpoint) return UNAVAILABLE
    if (!(timeoutMs > 0)) return { ok: false, code: 'timeout' }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfBytes as unknown as BodyInit,
        redirect: 'error',
        signal: controller.signal,
      })
      const bodyText = await readBoundedBody(response, controller, MAX_EXTRACTOR_RESPONSE_BYTES)
      if (bodyText === null) return UNAVAILABLE
      return interpretResponse(response.status, bodyText, maxTextChars)
    }
    catch {
      return timedOut ? { ok: false, code: 'timeout' } : UNAVAILABLE
    }
    finally {
      clearTimeout(timer)
    }
  }
}
