/**
 * PWS-AI-ENGINE-01R — server-only source extraction.
 *
 * AI-SOURCE-CONTRACT-01 — this module no longer decides which formats it reads.
 * `utils/aiSourceFormats.ts` is the one format contract the server and the
 * browser share: a file is read here only when that contract marks its format
 * readable, and every refusal is reported as a failure code rather than a
 * sentence of this module's own. Today the readable formats are TXT, CSV and
 * TSV. No OCR, no vision, and no external file API is used anywhere in this
 * module.
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

import {
  aiSourceFormatFor,
  aiSourceFormatRefusal,
  aiSourceTypeLabel,
  type SourceFailureCode,
} from '../../utils/aiSourceFormats'

/** At most this many source files may be analyzed in a single Generate call. */
export const MAX_FILES_PER_REQUEST = 5

/** Hard ceiling on the combined extracted text sent to any provider in one call. */
export const MAX_TOTAL_EXTRACTED_CHARS = 60_000

/** Hard ceiling on the text extracted from any single file — enforced while parsing, not after. */
export const MAX_PER_FILE_CHARS = 20_000

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
]

/**
 * Zero-width, format, control and bidirectional-override characters.
 * `\p{Cf}` covers U+200B, U+2060, U+00AD, U+FEFF and the bidi overrides
 * (U+202A–U+202E, U+2066–U+2069); `\p{Cc}` covers C0/C1 controls. Checked on
 * both the raw and the NFKC form — see the sanitizer below.
 */
const INVISIBLE_CHARACTER_PATTERN = /[\p{Cf}\p{Cc}]/u

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the display-name rule, applied identically
 * on the server and mirrored in `utils/aiProposal.ts`.
 *
 * Invisible characters are checked BEFORE and AFTER NFKC. Before, because
 * normalization is exactly what would remove them and hide the attempt; after,
 * because NFKC can also *produce* a format character from a compatibility
 * sequence, so a name that looked clean beforehand can carry one afterwards.
 * `\p{Cf}` covers zero-width characters (U+200B, U+2060, U+FEFF), the soft
 * hyphen, and the bidirectional overrides (U+202A-202E, U+2066-2069);
 * `\p{Cc}` covers C0/C1 control characters.
 *
 * A normal human filename is returned unchanged; anything carrying a URL, a
 * UUID, a path separator, an invisible character, or an anomalous length
 * collapses to one generic label rather than being echoed even in part.
 */
export function sanitizeDisplayNameForBrowser(rawName: string | null | undefined): string {
  const name = (rawName ?? '').trim()
  if (!name) return 'Untitled file'
  if (name.length > MAX_SAFE_DISPLAY_NAME_LENGTH) return 'Source file'
  if (INVISIBLE_CHARACTER_PATTERN.test(name)) return 'Source file'

  const normalized = name.normalize('NFKC')
  if (INVISIBLE_CHARACTER_PATTERN.test(normalized)) return 'Source file'
  if (UNSAFE_FILENAME_PATTERNS.some(pattern => pattern.test(normalized))) return 'Source file'

  return name
}

/**
 * AI-SOURCE-CONTRACT-01 — a refusal is a code. The sentence a person sees is
 * chosen once, by `sourceFailureMessage()` in the shared contract.
 */
export type ExtractionResult =
  | { ok: true, source: ExtractedSource }
  | { ok: false, code: SourceFailureCode }

/**
 * Trusted, server-known file size check — must run BEFORE any byte of the
 * file is downloaded. `knownSizeBytes` must come from Directus' own file
 * metadata (`directus_files.filesize`), never from a client-supplied value;
 * `maxBytes` is that file's own format limit from the shared contract.
 * An unknown size (`null`/`undefined`) is rejected conservatively rather
 * than allowed through on the hope it turns out small — this project must
 * never download a full file just to find out it was too large.
 */
export function isFileSizeSafeToDownload(knownSizeBytes: number | null | undefined, maxBytes: number): boolean {
  if (typeof knownSizeBytes !== 'number' || !Number.isFinite(knownSizeBytes) || knownSizeBytes < 0) return false
  return knownSizeBytes <= maxBytes
}

/**
 * Extracts plain text from one already-downloaded file's bytes. Never
 * throws — any failure (corrupt file, unreadable stream, etc.) becomes a
 * failure code naming only the problem category, never an internal error
 * message, stack trace, or any fragment of the file's own content.
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
    return { ok: false, code: 'empty' }
  }
  const refusal = aiSourceFormatRefusal(mimeType)
  if (refusal) {
    return { ok: false, code: refusal }
  }
  // A format the contract does not refuse is always one of its entries.
  const format = aiSourceFormatFor(mimeType)!
  if (bytes.byteLength > format.maxBytes) {
    return { ok: false, code: 'too_large' }
  }
  // Text is the only format with a reader here. A format marked readable before
  // its own reader exists is still refused: its bytes are never decoded as text.
  if (format.key !== 'text') {
    return { ok: false, code: 'not_enabled' }
  }

  let text = ''
  try {
    text = Buffer.from(bytes).toString('utf-8')
  } catch {
    return { ok: false, code: 'unreadable' }
  }

  text = text.trim().slice(0, MAX_PER_FILE_CHARS)
  if (!text) {
    return { ok: false, code: 'no_text' }
  }

  return {
    ok: true,
    source: { displayName, fileType: aiSourceTypeLabel(mimeType), text },
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
