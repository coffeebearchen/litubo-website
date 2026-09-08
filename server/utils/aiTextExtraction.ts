import * as XLSX from 'xlsx'
// @ts-expect-error — pdf-parse@1.1.4 ships this legacy pdf.js UMD build with
// no type declarations; it is imported directly (see the long comment below).
import PDFJS from 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js'

/**
 * PWS-AI-ENGINE-01 — server-only, text-only source extraction.
 *
 * First-version scope, strictly enforced by `isSupportedTextSourceMime()`:
 * PDFs with extractable text, XLSX/XLS, CSV/TSV, and TXT. Everything else —
 * images, scanned/no-text PDFs, Word, video, archives, and any other format
 * — is refused, never faked. No OCR, no vision, no external file API is
 * used anywhere in this module.
 *
 * File bytes and extracted text exist only for the lifetime of one request:
 * this module returns plain strings to its caller and keeps no cache, no
 * disk write, and no database write of its own.
 *
 * PDF parsing imports the bundled legacy `pdfjs-dist` build straight out of
 * `pdf-parse@1.1.4`'s package (a real, static, literal path — statically
 * analyzable by Vite/Rollup) instead of calling `pdf-parse`'s own thin
 * wrapper function. That wrapper resolves its own dependency with
 * `require(`./pdf.js/${version}/build/pdf.js`)` — a template-string
 * specifier neither esbuild's dep pre-bundler nor Nitro's/Vite's dev SSR
 * transform can statically resolve. Under this project's actual Windows dev
 * server it produced two different crashes across several mitigation
 * attempts (a Node ESM-loader rejection of an absolute Windows path passed
 * to `import()`, and later a silently exited Nitro worker thread) — all
 * tried and rejected before landing here; see this task's final report for
 * the full trail. Importing the same underlying legacy build directly, with
 * a literal path, sidesteps the dynamic `require()` entirely and was
 * verified working end-to-end in this project's real dev server. The
 * parsing logic below (disable the browser worker, load the document, walk
 * its pages, concatenate `getTextContent()` output) mirrors exactly what
 * `pdf-parse`'s own wrapper does — nothing new is added or changed in how a
 * PDF is read.
 */

interface PDFJSLegacy {
  version: string
  disableWorker: boolean
  getDocument: (data: Buffer) => Promise<{
    numPages: number
    getPage: (n: number) => Promise<{ getTextContent: (opts?: Record<string, unknown>) => Promise<{ items: Array<{ str: string, transform: number[] }> }> }>
    destroy: () => void
  }>
}

/** At most this many source files may be analyzed in a single Generate call. */
export const MAX_FILES_PER_REQUEST = 5

/** A single file larger than this is refused before any extraction is attempted. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB

/** Hard ceiling on the combined extracted text sent to any provider in one call. */
export const MAX_TOTAL_EXTRACTED_CHARS = 60_000

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

export function isSupportedTextSourceMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

function friendlyFileType(mimeType: string): string {
  const mime = mimeType.toLowerCase()
  if (mime === 'application/pdf') return 'PDF'
  if (mime.includes('spreadsheet') || mime.includes('ms-excel')) return 'Spreadsheet'
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

export type ExtractionResult =
  | { ok: true, source: ExtractedSource }
  | { ok: false, reason: string }

/** Mirrors `pdf-parse@1.1.4`'s own per-page text join: same-line items are concatenated, a new line otherwise. */
function joinPageText(items: Array<{ str: string, transform: number[] }>): string {
  let lastY: number | undefined
  let text = ''
  for (const item of items) {
    if (lastY === item.transform[5] || lastY === undefined) text += item.str
    else text += '\n' + item.str
    lastY = item.transform[5]
  }
  return text
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = PDFJS as PDFJSLegacy
  pdfjs.disableWorker = true
  const doc = await pdfjs.getDocument(buffer)
  try {
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
      text += '\n\n' + joinPageText(content.items)
    }
    return text
  } finally {
    doc.destroy()
  }
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  return workbook.SheetNames
    .map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
    .filter(text => text.trim().length > 0)
    .join('\n\n')
}

/**
 * Extracts plain text from one already-downloaded file's bytes. Never
 * throws — any failure (corrupt file, encrypted PDF, unreadable workbook,
 * etc.) becomes a short, safe `{ ok: false, reason }` result naming only the
 * problem category, never an internal error message, stack trace, or any
 * fragment of the file's own content.
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
  if (!isSupportedTextSourceMime(mimeType)) {
    return { ok: false, reason: 'This file type is not supported for text-source analysis yet.' }
  }

  const mime = mimeType!.toLowerCase().split(';')[0].trim()
  const buffer = Buffer.from(bytes)

  let text = ''
  try {
    if (mime === 'application/pdf') {
      text = await extractPdfText(buffer)
    } else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel') {
      text = extractSpreadsheetText(buffer)
    } else {
      // text/csv, text/tab-separated-values, text/plain
      text = buffer.toString('utf-8')
    }
  } catch {
    return { ok: false, reason: 'This file could not be read.' }
  }

  text = text.trim()
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
 */
export function capTotalCharacters(sources: ExtractedSource[], maxTotal: number): ExtractedSource[] {
  if (sources.length === 0) return []
  const perSource = Math.floor(maxTotal / sources.length)
  return sources.map(s => ({ ...s, text: s.text.slice(0, perSource) }))
}
