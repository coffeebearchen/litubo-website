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
 * AI-IMAGE-OCR-SOURCE-01 — it is also the only way to read the text in a JPG,
 * PNG or WebP image. The image goes to the same sidecar, which transcribes its
 * visible text locally with Tesseract; no image ever goes to an AI provider or
 * to any OCR or vision service. The same two-answer rule applies.
 *
 * Server-only. No Vue component calls the sidecar, and the browser has no reason
 * to know it exists.
 */

import type { SourceFailureCode } from '../../utils/aiSourceFormats'

/** Poppler accepts a `%PDF-` header anywhere in the first 1024 bytes. The search never looks further. */
export const PDF_HEADER_SEARCH_BYTES = 1024

/** The most text a PDF may contribute — the same per-file ceiling every source has. */
export const MAX_PDF_TEXT_CHARS = 20_000

/** The most transcription one image may contribute. The sidecar refuses a longer one rather than cutting it. */
export const MAX_IMAGE_OCR_TEXT_CHARS = 8_000

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

/** The failure codes the sidecar may report for an image. */
export const IMAGE_READER_FAILURE_CODES = [
  'too_large',
  'too_complex',
  'malformed',
  'no_text',
  'timeout',
  'unsafe_parse',
  'busy',
] as const satisfies readonly SourceFailureCode[]

export type PdfReaderFailureCode = typeof PDF_READER_FAILURE_CODES[number] | 'unavailable'
export type ImageReaderFailureCode = typeof IMAGE_READER_FAILURE_CODES[number] | 'unavailable'

export type PdfTextReadResult =
  | { ok: true, text: string }
  | { ok: false, code: PdfReaderFailureCode }

export type ImageTextReadResult =
  | { ok: true, text: string }
  | { ok: false, code: ImageReaderFailureCode }

/** Reads one PDF. `timeoutMs` is the most time this read may take; the request is aborted when it runs out. */
export type PdfTextReader = (pdfBytes: Uint8Array, options: { timeoutMs: number }) => Promise<PdfTextReadResult>

/** Reads the visible text of one image. `mimeType` is its stored content type; the bytes must really be that format. */
export type ImageTextReader = (imageBytes: Uint8Array, options: { timeoutMs: number, mimeType: string | null | undefined }) => Promise<ImageTextReadResult>

type ImageType = 'jpeg' | 'png' | 'webp'

const UNAVAILABLE = { ok: false, code: 'unavailable' } as const
const PDF_HEADER = Buffer.from('%PDF-', 'latin1')

/** Stored content types of the images the sidecar reads. `image/jpg` is a common spelling of JPEG. */
const IMAGE_TYPE_BY_CONTENT_TYPE: Readonly<Record<string, ImageType>> = Object.freeze({
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
})

/** The one content type each image format is sent to the sidecar as. */
const REQUEST_CONTENT_TYPE: Readonly<Record<ImageType, string>> = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
})

/** True when `%PDF-` starts within the first PDF_HEADER_SEARCH_BYTES bytes. The content type and file name are never enough. */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const window = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, PDF_HEADER_SEARCH_BYTES))
  return window.indexOf(PDF_HEADER) !== -1
}

/** The real format of image bytes, from their signature — the same check the sidecar makes. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (offset: number, values: number[]) => bytes.byteLength >= offset + values.length && values.every((value, index) => bytes[offset + index] === value)
  if (at(0, [0xFF, 0xD8, 0xFF])) return 'jpeg'
  if (at(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png'
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'webp'
  return null
}

function declaredImageType(mimeType: string | null | undefined): ImageType | null {
  return IMAGE_TYPE_BY_CONTENT_TYPE[(mimeType ?? '').toLowerCase().split(';')[0]!.trim()] ?? null
}

/** True when the bytes really are the image format their stored content type says. A mismatch is never re-guessed. */
export function imageMatchesDeclaredType(bytes: Uint8Array, mimeType: string | null | undefined): boolean {
  const declared = declaredImageType(mimeType)
  return declared !== null && detectImageType(bytes) === declared
}

/**
 * An extraction endpoint for a configured base URL, or null when there is no
 * usable one. Only http(s) is accepted, and a URL carrying credentials is
 * refused rather than sent.
 */
export function extractorEndpoint(baseUrl: string | null | undefined, path: 'extract/pdf' | 'extract/image' = 'extract/pdf'): URL | null {
  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') return null
  try {
    const base = baseUrl.trim()
    const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
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

type ReadResult<C extends string> = { ok: true, text: string } | { ok: false, code: C | 'unavailable' }

/** Only the two agreed shapes pass. Everything else is "unavailable", and its content goes nowhere. */
function interpretResponse<C extends string>(status: number, bodyText: string, maxTextChars: number, codes: readonly C[]): ReadResult<C> {
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
    if (record.text.trim() === '') return { ok: false, code: 'no_text' as C }
    return { ok: true, text: record.text }
  }

  if (record.ok === false && typeof record.code === 'string' && status >= 400) {
    const code = codes.find(known => known === record.code)
    if (code) return { ok: false, code }
  }
  return UNAVAILABLE
}

/**
 * One request to the sidecar. It carries the bytes and one content type and
 * nothing else: no file name, no product, no Media UUID. It is aborted when
 * `timeoutMs` runs out — the sidecar has its own, independent hard deadline too —
 * and it never follows a redirect, so the bytes cannot be sent anywhere but the
 * configured address.
 */
async function postToExtractor<C extends string>(request: {
  endpoint: URL
  contentType: string
  bytes: Uint8Array
  timeoutMs: number
  fetchImpl: typeof fetch
  maxTextChars: number
  codes: readonly C[]
}): Promise<ReadResult<C>> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, request.timeoutMs)

  try {
    const response = await request.fetchImpl(request.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': request.contentType },
      body: request.bytes as unknown as BodyInit,
      redirect: 'error',
      signal: controller.signal,
    })
    const bodyText = await readBoundedBody(response, controller, MAX_EXTRACTOR_RESPONSE_BYTES)
    if (bodyText === null) return UNAVAILABLE
    return interpretResponse(response.status, bodyText, request.maxTextChars, request.codes)
  }
  catch {
    return timedOut ? { ok: false, code: 'timeout' as C } : UNAVAILABLE
  }
  finally {
    clearTimeout(timer)
  }
}

/** Builds the PDF reader for one configured sidecar URL. */
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
    return postToExtractor({
      endpoint, contentType: 'application/pdf', bytes: pdfBytes, timeoutMs, fetchImpl, maxTextChars, codes: PDF_READER_FAILURE_CODES,
    })
  }
}

/**
 * AI-IMAGE-OCR-SOURCE-01 — builds the image OCR reader for one configured
 * sidecar URL. The request declares the image's real format; bytes that are not
 * the format their stored content type says are refused here, before they are
 * sent, and again by the sidecar.
 */
export function createImageTextReader(options: {
  baseUrl: string | null | undefined
  fetchImpl?: typeof fetch
  maxTextChars?: number
}): ImageTextReader {
  const endpoint = extractorEndpoint(options.baseUrl, 'extract/image')
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const maxTextChars = options.maxTextChars ?? MAX_IMAGE_OCR_TEXT_CHARS

  return async (imageBytes, { timeoutMs, mimeType }) => {
    if (!endpoint) return UNAVAILABLE
    const type = declaredImageType(mimeType)
    if (!type || detectImageType(imageBytes) !== type) return { ok: false, code: 'malformed' }
    if (!(timeoutMs > 0)) return { ok: false, code: 'timeout' }
    return postToExtractor({
      endpoint, contentType: REQUEST_CONTENT_TYPE[type], bytes: imageBytes, timeoutMs, fetchImpl, maxTextChars, codes: IMAGE_READER_FAILURE_CODES,
    })
  }
}
