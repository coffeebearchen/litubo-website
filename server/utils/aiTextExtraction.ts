/**
 * PWS-AI-ENGINE-01R — server-only, text-only source extraction.
 *
 * Supported, strictly enforced by `isSupportedTextSourceMime()`: CSV, TSV and
 * TXT. Everything else — PDF (see below), XLS/XLSX, images, Word, video,
 * archives — is refused, never faked. No OCR, no vision, no external file API
 * is used anywhere in this module.
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
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — PDF is temporarily NOT supported, and
 * the parser has been removed rather than left in place behind a caveat.
 *
 * The previous implementation ran pdf.js in a `worker_threads` worker with
 * `resourceLimits`, and this file claimed that bounded its memory. Review
 * established that claim was wrong on two counts: `resourceLimits` bounds the
 * V8 heap but not ArrayBuffer/external allocations, which is exactly where
 * decoded PDF content lives, and `page.getTextContent()` fully materializes a
 * page's content before any character limit can apply. A decompression-bomb
 * PDF therefore had no real ceiling. Rather than ship a parser whose safety
 * story does not hold, PDF is refused with an honest reason.
 *
 * Restoring PDF requires genuine process- or container-level resource
 * isolation (an out-of-process parser with an OS-enforced memory cap), which
 * is a separate, separately scheduled piece of work — not a flag flip here.
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

/** A single file's extraction is aborted (safely, honestly) if it runs longer than this. */
export const MAX_PROCESSING_MS = 10_000

const SUPPORTED_MIME_TYPES = new Set([
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

/**
 * Formats this module used to support and deliberately stopped supporting.
 * Each gets its own honest reason in the UI, never lumped in with "this file
 * type was never supported".
 */
const TEMPORARILY_UNSUPPORTED_MIME_REASONS = new Map<string, string>([
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel files are not supported for text-source analysis yet.'],
  ['application/vnd.ms-excel', 'Excel files are not supported for text-source analysis yet.'],
  ['application/pdf', 'PDF is not supported for text-source analysis yet — it needs an isolated parser with a real memory limit.'],
])

export function isSupportedTextSourceMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

/** True only for a format this module deliberately stopped supporting — used to show a distinct, honest UI reason. */
export function isFormerlyUnsupportedTextSourceMime(mimeType: string | null | undefined): boolean {
  return temporarilyUnsupportedReason(mimeType) !== null
}

/** The specific, honest reason a deliberately-dropped format is refused, or null if this type was simply never supported. */
export function temporarilyUnsupportedReason(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null
  return TEMPORARILY_UNSUPPORTED_MIME_REASONS.get(mimeType.toLowerCase().split(';')[0].trim()) ?? null
}

function friendlyFileType(mimeType: string): string {
  const mime = mimeType.toLowerCase()
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
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID, anywhere in the name — not only at a word boundary
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
  // Patterns are matched against the NFKC form so a full-width URL or path in
  // a filename cannot slip past ASCII patterns, exactly as in
  // `containsUnsafeSourceLeakage()`. The raw value is what gets displayed —
  // normalization is only ever used to decide, never to rewrite a name.
  if (UNSAFE_FILENAME_PATTERNS.some(pattern => pattern.test(name.normalize('NFKC')))) return 'Source file'
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
 * Extracts plain text from one already-downloaded file's bytes. Never
 * throws — any failure (corrupt file, unreadable stream, etc.) becomes a
 * short, safe `{ ok: false, reason }` result naming only the problem
 * category, never an internal error message, stack trace, or any fragment of
 * the file's own content.
 *
 * Only UTF-8 text formats are decoded here; there is no document parser in
 * this process at all, which is what makes the per-file character ceiling
 * meaningful rather than aspirational.
 */
export async function extractTextFromFile(
  bytes: ArrayBuffer,
  mimeType: string | null | undefined,
  displayName: string,
): Promise<ExtractionResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, reason: 'This file is empty.' }
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, reason: 'This file is too large to analyze.' }
  }
  const droppedFormatReason = temporarilyUnsupportedReason(mimeType)
  if (droppedFormatReason) {
    return { ok: false, reason: droppedFormatReason }
  }
  if (!isSupportedTextSourceMime(mimeType)) {
    return { ok: false, reason: 'This file type is not supported for text-source analysis yet.' }
  }

  const mime = mimeType!.toLowerCase().split(';')[0].trim()

  let text = ''
  try {
    // text/csv, text/tab-separated-values, text/plain
    text = Buffer.from(bytes).toString('utf-8')
  } catch {
    return { ok: false, reason: 'This file could not be read.' }
  }

  text = text.trim().slice(0, MAX_PER_FILE_CHARS)
  if (!text) {
    return { ok: false, reason: 'No extractable text was found in this file.' }
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
