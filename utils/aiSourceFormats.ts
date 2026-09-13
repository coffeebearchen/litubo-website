/**
 * AI-SOURCE-CONTRACT-01 — the one list of source formats the AI workflow knows
 * about, and what each of them can do today.
 *
 * "Which files can AI read?" used to be answered in four places: the server's
 * extraction step, its list of formats dropped on purpose, a browser mirror of
 * both, and the Media picker's AI-readable mark — held together only by tests
 * that compared them. Every one of those now asks this file instead.
 *
 * Two different facts live here, and they are kept apart on purpose:
 *
 *   - `mediaUploadSupported` — the Media Library upload route stores this format
 *     today. It describes that route and is pinned to
 *     `server/api/admin/media/upload.post.ts` by test; it never grants upload
 *     permission.
 *   - `aiReadableNow` — AI Source Intake can turn this format into text today.
 *
 * Images are why they differ: they can be uploaded and linked, but not yet
 * analyzed. (PDF was the first such format; AI-PDF-SOURCE-01 made text-layer
 * PDFs readable.)
 *
 * A planned format is listed so that its label, its size contract and its
 * honest refusal already exist — but it stays unreadable until its own
 * implementation module has passed acceptance and sets `aiReadableNow`. Legacy
 * DOC and XLS are not part of V1 and are deliberately absent: to this contract
 * they are simply unsupported.
 *
 * Pure data and pure functions — no server-only module, no Vue, no Directus, no
 * provider — so the browser and the server read the very same definitions.
 */

export type AiSourceFormatKey = 'text' | 'pdf' | 'docx' | 'xlsx' | 'image'

export interface AiSourceFileType {
  /** Lowercase MIME type without parameters, as stored on the file. */
  mime: string
  /**
   * The type shown on a source card. For a readable format it is also the file
   * type the provider prompt names, so changing a readable label changes the
   * prompt.
   */
  label: string
  /** Short format name for "Supported formats: …" copy. */
  shortName: string
}

export interface AiSourceFormat {
  key: AiSourceFormatKey
  types: readonly AiSourceFileType[]
  /** The largest file this format's reading path downloads — enforced for a readable format, a contract for a planned one. */
  maxBytes: number
  /** The Media Library upload route stores this format today. */
  mediaUploadSupported: boolean
  /** AI Source Intake can analyze this format today. Set only by the format's own implementation module. */
  aiReadableNow: boolean
}

const MB = 1024 * 1024

export const AI_SOURCE_FORMATS: readonly AiSourceFormat[] = [
  {
    // Read today, by UTF-8 decoding inside the server process.
    key: 'text',
    types: [
      { mime: 'text/plain', label: 'Text', shortName: 'TXT' },
      { mime: 'text/csv', label: 'CSV', shortName: 'CSV' },
      { mime: 'text/tab-separated-values', label: 'TSV', shortName: 'TSV' },
    ],
    maxBytes: 8 * MB,
    mediaUploadSupported: true,
    aiReadableNow: true,
  },
  {
    // Read today: text-layer PDFs only, by the isolated document-extractor
    // sidecar, never inside the Nuxt process (AI-PDF-SOURCE-01). No OCR — a
    // scanned PDF has no text layer and reports no_text.
    key: 'pdf',
    types: [{ mime: 'application/pdf', label: 'PDF', shortName: 'PDF' }],
    maxBytes: 20 * MB,
    mediaUploadSupported: true,
    aiReadableNow: true,
  },
  {
    // Planned: paragraphs, headings and tables, read by a bounded streaming reader (AI-DOCX-SOURCE-01).
    key: 'docx',
    types: [{ mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word', shortName: 'DOCX' }],
    maxBytes: 10 * MB,
    mediaUploadSupported: false,
    aiReadableNow: false,
  },
  {
    // Standard .xlsx workbooks, read by a bounded in-process OOXML reader
    // (AI-XLSX-SOURCE-01): visible cells only, a formula's cached value only,
    // nothing loaded whole. Legacy .xls and macro-enabled .xlsm are not this format.
    key: 'xlsx',
    types: [{ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Spreadsheet', shortName: 'XLSX' }],
    maxBytes: 10 * MB,
    mediaUploadSupported: true,
    aiReadableNow: true,
  },
  {
    // Planned: local OCR, so only extracted text ever reaches a provider (AI-IMAGE-OCR-SOURCE-01).
    key: 'image',
    types: [
      { mime: 'image/jpeg', label: 'Image', shortName: 'JPG' },
      { mime: 'image/jpg', label: 'Image', shortName: 'JPG' },
      { mime: 'image/png', label: 'Image', shortName: 'PNG' },
      { mime: 'image/webp', label: 'Image', shortName: 'WebP' },
    ],
    maxBytes: 20 * MB,
    mediaUploadSupported: true,
    aiReadableNow: false,
  },
]

function normalizeMimeType(mimeType: string | null | undefined): string {
  return (mimeType ?? '').toLowerCase().split(';')[0].trim()
}

function fileTypeFor(mimeType: string | null | undefined): { format: AiSourceFormat, type: AiSourceFileType } | null {
  const mime = normalizeMimeType(mimeType)
  if (!mime) return null
  for (const format of AI_SOURCE_FORMATS) {
    const type = format.types.find(t => t.mime === mime)
    if (type) return { format, type }
  }
  return null
}

/** The contract entry for a stored file's MIME type — case-insensitive, parameters ignored — or null for a format outside the contract. */
export function aiSourceFormatFor(mimeType: string | null | undefined): AiSourceFormat | null {
  return fileTypeFor(mimeType)?.format ?? null
}

/** The one answer to "can AI Source Intake analyze this file today?", for the server and the browser alike. */
export function isAiSourceReadableNow(mimeType: string | null | undefined): boolean {
  return aiSourceFormatFor(mimeType)?.aiReadableNow === true
}

/**
 * Why a file's format keeps it out of analysis, or null when it can be read:
 * `not_enabled` for a planned format that is not readable yet, `unsupported`
 * for anything the contract does not list.
 */
export function aiSourceFormatRefusal(mimeType: string | null | undefined): 'not_enabled' | 'unsupported' | null {
  const format = aiSourceFormatFor(mimeType)
  if (!format) return 'unsupported'
  return format.aiReadableNow ? null : 'not_enabled'
}

/** The type label a source card shows. Never blank: a format outside the contract falls back to its plain family name. */
export function aiSourceTypeLabel(mimeType: string | null | undefined): string {
  const mime = normalizeMimeType(mimeType)
  if (!mime) return 'Unknown'
  const known = fileTypeFor(mime)
  if (known) return known.type.label
  if (mime.startsWith('image/')) return 'Image'
  if (mime.startsWith('video/')) return 'Video'
  return 'File'
}

/** "CSV, PDF, TSV, TXT, XLSX" — the formats that can be analyzed today, for help copy. Derived, so it can never advertise a format the server refuses. */
export const AI_READABLE_FORMATS_LABEL = [...new Set(
  AI_SOURCE_FORMATS.filter(f => f.aiReadableNow).flatMap(f => f.types.map(t => t.shortName)),
)].sort().join(', ')

/** "JPG, PNG, WebP" — formats the Media Library stores but AI cannot analyze yet, for help copy. Derived the same way. */
export const MEDIA_ONLY_FORMATS_LABEL = [...new Set(
  AI_SOURCE_FORMATS.filter(f => f.mediaUploadSupported && !f.aiReadableNow).flatMap(f => f.types.map(t => t.shortName)),
)].sort().join(', ')

/**
 * Why one selected source did not reach the analysis.
 *
 * A reader reports a code, never a sentence. The sentence a person sees is
 * chosen once, below, so a PDF reader, a spreadsheet reader and an image reader
 * cannot each invent their own wording — or pass an internal error message,
 * a path or a fragment of the file through to the screen.
 *
 * The last group is not produced by anything yet. It is here so the format
 * modules that will need those failures inherit one reviewed wording.
 */
export type SourceFailureCode =
  // Produced today
  | 'not_associated'
  | 'disabled'
  | 'not_enabled'
  | 'unsupported'
  | 'too_large'
  | 'empty'
  | 'unreadable'
  | 'no_text'
  | 'time_budget_exhausted'
  // Produced by the PDF reader (AI-PDF-SOURCE-01)
  | 'timeout'
  | 'malformed'
  | 'encrypted'
  | 'too_many_pages'
  | 'unavailable'
  | 'busy'
  | 'unsafe_parse'
  // Produced by the workbook reader (AI-XLSX-SOURCE-01), besides the codes above
  | 'too_complex'
  | 'too_many_sheets'
  | 'too_many_rows'
  | 'too_many_cells'
  | 'no_relevant_rows'
  // Reserved for later format modules
  | 'too_many_pixels'
  | 'ocr_unavailable'

const SOURCE_FAILURE_MESSAGES: Record<Exclude<SourceFailureCode, 'not_enabled'>, string> = {
  not_associated: 'One of the selected files could not be used for this product.',
  disabled: 'This file is disabled for this product, so it cannot be analyzed. Enable it in Media & resources first.',
  unsupported: 'This file type is not supported for source analysis.',
  too_large: 'This file is too large to analyze, or its size could not be confirmed.',
  empty: 'This file is empty.',
  unreadable: 'This file could not be read.',
  no_text: 'No extractable text was found in this file.',
  time_budget_exhausted: 'Not read: the time limit for reading sources was reached.',
  timeout: 'This file took too long to read and was stopped.',
  malformed: 'This file is damaged or is not a valid document.',
  encrypted: 'This file is password-protected and cannot be read.',
  too_complex: 'This file is too complex to analyze safely. Save the relevant part as a smaller file.',
  too_many_pages: 'This document has too many pages to analyze.',
  too_many_sheets: 'This workbook has too many sheets to analyze.',
  too_many_rows: 'This spreadsheet has too many rows to analyze. Save the relevant sheet as a smaller file.',
  too_many_cells: 'This spreadsheet has too many cells to analyze.',
  too_many_pixels: 'This image is too large to analyze.',
  unavailable: 'The document reader is unavailable right now. Other sources can still be analyzed.',
  ocr_unavailable: 'Image text reading is unavailable right now. Other sources can still be analyzed.',
  busy: 'The document reader is busy. Try again in a moment.',
  unsafe_parse: 'This file could not be safely read.',
  no_relevant_rows: 'No data rows were found in this spreadsheet.',
}

/** The honest refusal for each planned format while it cannot be read yet. */
const NOT_ENABLED_MESSAGES: Record<Exclude<AiSourceFormatKey, 'text'>, string> = {
  pdf: 'PDF is not supported for source analysis yet.',
  docx: 'Word documents are not supported for source analysis yet.',
  xlsx: 'Excel files are not supported for source analysis yet.',
  image: 'Images are not supported for source analysis yet.',
}

/**
 * AI-PDF-SOURCE-01 — a PDF with no text layer is almost always a scan, and V1
 * reads no scans (no OCR). Saying so tells the reader what to do about it.
 */
const PDF_NO_TEXT_MESSAGE = 'No extractable text was found in this PDF. Scanned PDFs are not supported yet.'

/**
 * The fixed sentence for one failure code. `not_enabled` names the format it is
 * about, so it takes the file's MIME type; with no planned format to name, it
 * falls back to the generic unsupported sentence. `no_text` for a PDF points at
 * the likely cause, a scan.
 */
export function sourceFailureMessage(code: SourceFailureCode, mimeType?: string | null): string {
  if (code === 'no_text' && aiSourceFormatFor(mimeType)?.key === 'pdf') return PDF_NO_TEXT_MESSAGE
  if (code === 'not_enabled') {
    const key = aiSourceFormatFor(mimeType)?.key
    return key && key !== 'text' ? NOT_ENABLED_MESSAGES[key] : SOURCE_FAILURE_MESSAGES.unsupported
  }
  return SOURCE_FAILURE_MESSAGES[code]
}
