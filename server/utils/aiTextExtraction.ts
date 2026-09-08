import { extractPdfTextInWorker } from './pdfExtractionWorker'

/**
 * PWS-AI-ENGINE-01R — server-only, text-only source extraction.
 *
 * Supported this round, strictly enforced by `isSupportedTextSourceMime()`:
 * PDFs with extractable text, CSV, TSV, and TXT. XLS/XLSX are explicitly
 * NOT supported this round (see the note below) — everything else (images,
 * scanned/no-text PDFs, Word, video, archives, and any other format) is
 * refused, never faked. No OCR, no vision, no external file API is used
 * anywhere in this module.
 *
 * XLS/XLSX removed: PWS-AI-ENGINE-01's `xlsx` (SheetJS) dependency could not
 * be safely required on Windows `nuxt dev` (its `.mjs` entry crashed every
 * SSR route with a Node ESM-loader error). `exceljs`'s streaming reader —
 * the only alternative that could enforce sheet/row/cell limits *during*
 * parsing rather than after a full in-memory load, as this task requires —
 * was evaluated directly against a real, freshly-generated `.xlsx` file and
 * threw (`Cannot read properties of undefined (reading 'sheets')`) due to a
 * real, upstream ordering bug in its streaming ZIP-entry parser, not a
 * configuration mistake on this project's part. Per this task's explicit
 * instruction to honestly drop a format rather than ship a fake or unsafely
 * bounded parser, XLS/XLSX is left unsupported until a safe, streaming-
 * capable replacement is found.
 *
 * PDF parsing uses `unpdf` (github.com/unjs/unpdf), a serverless/edge-safe
 * wrapper around `pdfjs-dist` with zero regular dependencies and a real
 * `exports` map for both ESM and CJS resolution. It was chosen specifically
 * because it does not perform the dynamic, template-string `require()` (or
 * an unprefixed absolute-path `import()`) that made `pdf-parse`'s bundled
 * legacy `pdfjs-dist` build crash every route of this project's real
 * Windows `nuxt dev` server — verified fixed by starting a clean dev server
 * and loading `/`, an authenticated admin page, and both AI Workspace routes
 * (see this task's final report for the exact commands and results).
 *
 * PWS-AI-ENGINE-01R2-SAFETY-02 — the PDF parse itself no longer runs in this
 * process: it is delegated to a terminable worker thread (see
 * `pdfExtractionWorker.ts`), so `MAX_PROCESSING_MS` is enforced by really
 * stopping the parse rather than by abandoning a promise that keeps running.
 *
 * File bytes and extracted text exist only for the lifetime of one request:
 * this module returns plain strings to its caller and keeps no cache, no
 * disk write, and no database write of its own.
 */

/** At most this many source files may be analyzed in a single Generate call. */
export const MAX_FILES_PER_REQUEST = 5

/** A single file larger than this is refused before any download is attempted. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB

/** Hard ceiling on the combined extracted text sent to any provider in one call. */
export const MAX_TOTAL_EXTRACTED_CHARS = 60_000

/** Hard ceiling on the text extracted from any single file — enforced while parsing, not after. */
export const MAX_PER_FILE_CHARS = 20_000

/** A PDF is only ever read up to this many pages — later pages are never opened. */
export const MAX_PDF_PAGES = 30

/** A single file's extraction is aborted (safely, honestly) if it runs longer than this. */
export const MAX_PROCESSING_MS = 10_000

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

/** MIME types this module used to support in PWS-AI-ENGINE-01 but no longer does — shown a distinct, honest reason, never lumped in with "never supported". */
const FORMERLY_SUPPORTED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
])

export function isSupportedTextSourceMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

/** True only for a format this module deliberately stopped supporting — used to show a distinct, honest UI reason. */
export function isFormerlyUnsupportedTextSourceMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return FORMERLY_SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

function friendlyFileType(mimeType: string): string {
  const mime = mimeType.toLowerCase()
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'text/csv') return 'CSV'
  if (mime === 'text/tab-separated-values') return 'TSV'
  if (mime === 'text/plain') return 'Text'
  return 'File'
}

export interface ExtractedSource {
  displayName: string
  fileType: string
  text: string
}

/** A filename this long is treated as anomalous regardless of content — a legitimate human filename is never this long. */
const MAX_SAFE_DISPLAY_NAME_LENGTH = 120

const UNSAFE_FILENAME_PATTERNS: RegExp[] = [
  /https?:\/\//i, // URL
  /\bwww\./i, // bare www. URL
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID
  /[/\\]/, // any path separator — a real filename never legitimately contains one
  // eslint-disable-next-line no-control-regex
  /[\x00-\x1F\x7F]/, // control characters, including newlines/tabs a delimiter-injection or prompt-injection attempt would need
]

/**
 * PWS-AI-ENGINE-01R2-SAFETY-01 — the ONLY place a Directus `filename_download`
 * value is turned into something safe to hand back to the browser. A normal,
 * human-typed filename ("Datasheet.pdf") is returned unchanged; anything
 * carrying a URL, a UUID, a path separator, a control character (including a
 * newline — a delimiter-injection vector), or an anomalous length collapses
 * to the single generic label `'Source file'` — never partially echoed, and
 * never used to distinguish *which* rule tripped (that itself could leak
 * information about the rejected value).
 */
export function sanitizeDisplayNameForBrowser(rawName: string | null | undefined): string {
  const name = (rawName ?? '').trim()
  if (!name) return 'Untitled file'
  if (name.length > MAX_SAFE_DISPLAY_NAME_LENGTH) return 'Source file'
  if (UNSAFE_FILENAME_PATTERNS.some(pattern => pattern.test(name))) return 'Source file'
  return name
}

export type ExtractionResult =
  | { ok: true, source: ExtractedSource }
  | { ok: false, reason: string }

/**
 * Trusted, server-known file size check — must run BEFORE any byte of the
 * file is downloaded. `knownSizeBytes` must come from Directus' own file
 * metadata (`directus_files.filesize`), never from a client-supplied value.
 * An unknown size (`null`/`undefined`) is rejected conservatively rather
 * than allowed through on the hope it turns out small — this project must
 * never download a full file just to find out it was too large.
 */
export function isFileSizeSafeToDownload(knownSizeBytes: number | null | undefined): boolean {
  if (typeof knownSizeBytes !== 'number' || !Number.isFinite(knownSizeBytes) || knownSizeBytes < 0) return false
  return knownSizeBytes <= MAX_FILE_BYTES
}

/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — PDF parsing runs in a terminable worker
 * thread (`pdfExtractionWorker.ts`), not in this process. `MAX_PROCESSING_MS`
 * is enforced by actually terminating that thread, so a pathological PDF
 * cannot keep burning the server's JavaScript thread after the caller has
 * given up. Page and character limits are re-applied inside the worker
 * itself, not only here.
 */
async function extractPdfText(bytes: ArrayBuffer, moduleEntry?: string): Promise<string> {
  const outcome = await extractPdfTextInWorker(bytes, {
    timeoutMs: MAX_PROCESSING_MS,
    maxPages: MAX_PDF_PAGES,
    maxChars: MAX_PER_FILE_CHARS,
    maxBytes: MAX_FILE_BYTES,
    moduleEntry,
  })
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.text
}

/**
 * Extracts plain text from one already-downloaded file's bytes. Never
 * throws — any failure (corrupt file, encrypted PDF, unreadable stream,
 * etc.) becomes a short, safe `{ ok: false, reason }` result naming only the
 * problem category, never an internal error message, stack trace, or any
 * fragment of the file's own content.
 */
export async function extractTextFromFile(
  bytes: ArrayBuffer,
  mimeType: string | null | undefined,
  displayName: string,
  /** Test-only: the module the PDF worker imports `getDocumentProxy` from. Production always uses the real `unpdf`. */
  pdfModuleEntry?: string,
): Promise<ExtractionResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, reason: 'This file is empty.' }
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, reason: 'This file is too large to analyze.' }
  }
  if (isFormerlyUnsupportedTextSourceMime(mimeType)) {
    return { ok: false, reason: 'Excel files are not supported for text-source analysis yet.' }
  }
  if (!isSupportedTextSourceMime(mimeType)) {
    return { ok: false, reason: 'This file type is not supported for text-source analysis yet.' }
  }

  const mime = mimeType!.toLowerCase().split(';')[0].trim()

  let text = ''
  try {
    if (mime === 'application/pdf') {
      text = await extractPdfText(bytes, pdfModuleEntry)
    } else {
      // text/csv, text/tab-separated-values, text/plain
      text = Buffer.from(bytes).toString('utf-8')
    }
  } catch {
    return { ok: false, reason: 'This file could not be read.' }
  }

  text = text.trim().slice(0, MAX_PER_FILE_CHARS)
  if (!text) {
    return { ok: false, reason: 'No extractable text was found in this file (it may be a scanned or image-only document).' }
  }

  return {
    ok: true,
    source: { displayName, fileType: friendlyFileType(mime), text },
  }
}

/**
 * Caps the combined text across all readable sources to
 * `MAX_TOTAL_EXTRACTED_CHARS`, giving each source an equal share of the
 * budget rather than silently dropping later files. Pure function — no I/O.
 * (Each source has already been independently capped to `MAX_PER_FILE_CHARS`
 * during its own extraction — this is the second, combined-total cap.)
 */
export function capTotalCharacters(sources: ExtractedSource[], maxTotal: number): ExtractedSource[] {
  if (sources.length === 0) return []
  const perSource = Math.floor(maxTotal / sources.length)
  return sources.map(s => ({ ...s, text: s.text.slice(0, perSource) }))
}
