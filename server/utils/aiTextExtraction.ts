/**
 * PWS-AI-ENGINE-01R — server-only source extraction.
 *
 * AI-SOURCE-CONTRACT-01 — this module no longer decides which formats it reads.
 * `utils/aiSourceFormats.ts` is the one format contract the server and the
 * browser share: a file is read here only when that contract marks its format
 * readable, and every refusal is reported as a failure code rather than a
 * sentence of this module's own. Today the readable formats are TXT, CSV, TSV,
 * text-layer PDF and .xlsx workbooks. No OCR, no vision, and no external file
 * API is used anywhere in this module.
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
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — PDF was disabled, and the in-process
 * parser was removed rather than left in place behind a caveat (history below).
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
 * AI-PDF-SOURCE-01 — that isolation now exists, and text-layer PDFs are read
 * again. There is still no PDF parser in this process: this module checks the
 * PDF header and hands the bytes to the document-extractor sidecar through an
 * injected reader (`documentExtractorClient.ts`), which runs Poppler under
 * process and container resource limits. No reader configured → `unavailable`.
 *
 * AI-XLSX-SOURCE-01 — .xlsx workbooks are read again, inside this process but
 * never loaded whole: `xlsxExtraction.ts` streams the package through a bounded
 * OOXML reader (`yauzl` for the ZIP, `saxes` for the XML) that counts the bytes
 * it actually inflates and enforces every sheet, row, cell and character limit
 * while parsing. One Office document is parsed at a time
 * (`officeExtractionGate.ts`), and a workbook over a limit is refused, never
 * cut. Legacy .xls and macro-enabled .xlsm remain unsupported.
 *
 * AI-DOCX-SOURCE-01 — .docx documents are read the same way: `docxExtraction.ts`
 * streams the main document part through the same bounded OOXML reader, under
 * the same Office gate, into headings, paragraphs and tables as the document
 * reads with tracked changes accepted. A document is never narrowed to a product
 * model here; the relevance guard in the prompt decides. Legacy .doc and
 * macro-enabled .docm remain unsupported.
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
import { extractDocxText, MAX_DOCX_PROCESSING_MS } from './docxExtraction'
import { hasPdfHeader, type PdfTextReader, type PdfTextReadResult } from './documentExtractorClient'
import { officeExtractionGate, type OfficeExtractionGate } from './officeExtractionGate'
import { extractXlsxText, MAX_XLSX_PROCESSING_MS } from './xlsxExtraction'

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

/** Readers for formats that are never decoded in this process. */
export interface SourceReaders {
  /** Text-layer PDFs, read by the document-extractor sidecar. Without one, a PDF reports `unavailable`. */
  pdf?: PdfTextReader
}

export interface ExtractionOptions {
  readers?: SourceReaders
  /** How long reading this file may still take: what is left of the analysis's reading budget. */
  timeoutMs?: number
  /**
   * The current product's code, asked for only when a workbook is read, so an
   * analysis without one never needs it. Null when the product has no code.
   */
  productCode?: () => Promise<string | null>
  /** The most characters an Office document's text may have — at most MAX_PER_FILE_CHARS. A longer text is refused, never cut. */
  maxChars?: number
  /** The Office parse queue. Tests inject their own; everything else shares the process-wide gate. */
  officeGate?: OfficeExtractionGate
}

/** One PDF is never read for longer than this, however much of the reading budget is left. */
export const MAX_PDF_READ_MS = 15_000

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
 * UTF-8 text is decoded here, and an .xlsx workbook is streamed through the
 * bounded workbook reader, which enforces its limits while parsing. No PDF
 * parser runs in this process: a PDF goes to `options.readers.pdf`.
 */
export async function extractTextFromFile(
  bytes: ArrayBuffer,
  mimeType: string | null | undefined,
  displayName: string,
  options: ExtractionOptions = {},
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
  if (format.key === 'pdf') {
    return readPdfSource(new Uint8Array(bytes), mimeType, displayName, options)
  }
  if (format.key === 'xlsx') {
    return readXlsxSource(new Uint8Array(bytes), mimeType, displayName, options)
  }
  if (format.key === 'docx') {
    return readDocxSource(new Uint8Array(bytes), mimeType, displayName, options)
  }
  // Text, PDF, XLSX and DOCX are the only formats with a reader. A format marked
  // readable before its own reader exists is still refused: its bytes are never
  // decoded as text.
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
 * AI-PDF-SOURCE-01 — one PDF, read outside this process.
 *
 * The declared content type is a claim, so the PDF header is checked before
 * the bytes go anywhere. The reader gets at most MAX_PDF_READ_MS, or less when
 * the analysis has less reading time left. Whatever comes back is either a
 * fixed failure code or text, and the text is held to the same per-file
 * ceiling as any other source. Nothing here retries, and nothing falls back to
 * another reader.
 */
async function readPdfSource(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
  displayName: string,
  options: ExtractionOptions,
): Promise<ExtractionResult> {
  if (!hasPdfHeader(bytes)) return { ok: false, code: 'malformed' }
  const reader = options.readers?.pdf
  if (!reader) return { ok: false, code: 'unavailable' }

  const timeoutMs = Math.min(MAX_PDF_READ_MS, options.timeoutMs ?? MAX_PDF_READ_MS)
  let result: PdfTextReadResult
  try {
    result = await reader(bytes, { timeoutMs })
  }
  catch {
    return { ok: false, code: 'unavailable' }
  }
  if (!result.ok) return { ok: false, code: result.code }

  const text = result.text.trim().slice(0, MAX_PER_FILE_CHARS)
  if (!text) return { ok: false, code: 'no_text' }
  return {
    ok: true,
    source: { displayName, fileType: aiSourceTypeLabel(mimeType), text },
  }
}

/**
 * AI-XLSX-SOURCE-01 — one workbook, read in this process by the bounded reader.
 *
 * It gets at most MAX_XLSX_PROCESSING_MS, or less when the analysis has less
 * reading time left, and time spent waiting for the Office gate comes out of
 * that same deadline. The product code is asked for first, so a sheet can be
 * narrowed to this product's exact rows. The text is never cut: a workbook
 * whose text would not fit `maxChars` is refused. Nothing here retries.
 */
async function readXlsxSource(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
  displayName: string,
  options: ExtractionOptions,
): Promise<ExtractionResult> {
  const timeoutMs = Math.min(MAX_XLSX_PROCESSING_MS, options.timeoutMs ?? MAX_XLSX_PROCESSING_MS)
  if (timeoutMs <= 0) return { ok: false, code: 'timeout' }
  const deadline = Date.now() + timeoutMs
  const maxChars = Math.min(MAX_PER_FILE_CHARS, options.maxChars ?? MAX_PER_FILE_CHARS)

  let productCode: string | null
  try {
    productCode = options.productCode ? await options.productCode() : null
  }
  catch {
    return { ok: false, code: 'unreadable' }
  }

  const gate = options.officeGate ?? officeExtractionGate
  const outcome = await gate
    .run(() => extractXlsxText(bytes, { deadline, productCode, maxChars }), { deadline })
    .catch(() => null)
  if (!outcome) return { ok: false, code: 'unreadable' }
  if (!outcome.ok) return { ok: false, code: outcome.code }
  const result = outcome.value
  if (!result.ok) return { ok: false, code: result.code }
  // The reader already refuses anything longer; checked again here, and refused rather than cut.
  if (result.text.length > maxChars) return { ok: false, code: 'too_complex' }
  return {
    ok: true,
    source: { displayName, fileType: aiSourceTypeLabel(mimeType), text: result.text },
  }
}

/**
 * AI-DOCX-SOURCE-01 — one Word document, read in this process by the bounded reader.
 *
 * It gets at most MAX_DOCX_PROCESSING_MS, or less when the analysis has less
 * reading time left, and waits for the same Office gate as a workbook, spending
 * that same deadline while it waits. No product code is asked for: a document is
 * never narrowed to one model here. The text is never cut: a document whose text
 * would not fit `maxChars` is refused. Nothing here retries.
 */
async function readDocxSource(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
  displayName: string,
  options: ExtractionOptions,
): Promise<ExtractionResult> {
  const timeoutMs = Math.min(MAX_DOCX_PROCESSING_MS, options.timeoutMs ?? MAX_DOCX_PROCESSING_MS)
  if (timeoutMs <= 0) return { ok: false, code: 'timeout' }
  const deadline = Date.now() + timeoutMs
  const maxChars = Math.min(MAX_PER_FILE_CHARS, options.maxChars ?? MAX_PER_FILE_CHARS)

  const gate = options.officeGate ?? officeExtractionGate
  const outcome = await gate
    .run(() => extractDocxText(bytes, { deadline, maxChars }), { deadline })
    .catch(() => null)
  if (!outcome) return { ok: false, code: 'unreadable' }
  if (!outcome.ok) return { ok: false, code: outcome.code }
  const result = outcome.value
  if (!result.ok) return { ok: false, code: result.code }
  // The reader already refuses anything longer; checked again here, and refused rather than cut.
  if (result.text.length > maxChars) return { ok: false, code: 'too_complex' }
  return {
    ok: true,
    source: { displayName, fileType: aiSourceTypeLabel(mimeType), text: result.text },
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
