/**
 * AI-XLSX-SOURCE-01 — an .xlsx workbook, read into bounded structured text.
 *
 * The workbook is streamed through `ooxmlReader.ts`: nothing is loaded whole,
 * and every limit below is enforced while parsing, never by trimming a finished
 * result. A workbook that goes over a limit is refused as a whole. The reader
 * never hands over "the first part" of a workbook, because a sheet or a row it
 * dropped could hold a value that contradicts one it kept.
 *
 * What reaches the text is what a reviewer sees in Excel. Hidden and very hidden
 * sheets, hidden rows and hidden columns never leave this module — they often
 * hold costs, internal notes or lookup tables. A number under a simple format is
 * written with the decimals that format shows, so 0.45 under `0.0` is 0.5, as on
 * screen (AI-XLSX-SOURCE-01-R1). A formula contributes the value Excel last saved
 * for it, never the formula itself, and nothing is ever recalculated. Each row
 * stays a row under its column headers, so a model's values stay attached to
 * that model.
 *
 * When the current product has a code, a sheet that names that exact code — in
 * a column header, or in a cell of a data row — is narrowed to the columns or
 * the rows that name it (`productCodeMatch.ts`), together with the columns that
 * describe each row. That only shrinks the context; the D-025 relevance guard in
 * the prompt still decides what may be extracted. A sheet that does not name the
 * code is kept whole, because a single-model workbook often has no model column
 * at all — and so is every sheet when the product has no code, or a code without
 * both a letter and a digit.
 *
 * No external link, embedded object, drawing or macro part is ever opened, and a
 * macro-enabled, template or binary workbook is refused.
 */

import {
  OOXML_LIMITS,
  OoxmlFailure,
  isSafeEntryName,
  localName,
  openOoxmlPackage,
  type OoxmlLimits,
  type OoxmlPackage,
} from './ooxmlReader'
import { cellNamesProductCode, isFilterableProductCode, normalizeProductCode } from './productCodeMatch'

export type XlsxFailureCode =
  | 'too_large'
  | 'malformed'
  | 'encrypted'
  | 'unsupported'
  | 'timeout'
  | 'too_complex'
  | 'too_many_sheets'
  | 'too_many_rows'
  | 'too_many_cells'
  | 'no_relevant_rows'

export type XlsxExtractionResult =
  | { ok: true, text: string }
  | { ok: false, code: XlsxFailureCode }

const MB = 1024 * 1024

export interface XlsxLimits extends OoxmlLimits {
  /** The largest workbook file read at all. */
  maxBytes: number
  maxWorkbookSheets: number
  maxVisibleSheets: number
  maxRowsPerSheet: number
  maxRowsTotal: number
  maxColumnsUsed: number
  maxNonEmptyCellsScanned: number
  maxOutputCells: number
  maxSharedStrings: number
  maxSharedStringChars: number
  maxKeptCellChars: number
  maxMergedRanges: number
  maxMergeArea: number
  maxOutputChars: number
  maxSharedStringsXmlBytes: number
  maxWorksheetXmlBytes: number
  maxStylesXmlBytes: number
  maxMetadataXmlBytes: number
}

export const XLSX_LIMITS: Readonly<XlsxLimits> = Object.freeze({
  ...OOXML_LIMITS,
  maxBytes: 10 * MB,
  maxWorkbookSheets: 50,
  maxVisibleSheets: 10,
  maxRowsPerSheet: 5_000,
  maxRowsTotal: 20_000,
  maxColumnsUsed: 100,
  maxNonEmptyCellsScanned: 200_000,
  maxOutputCells: 20_000,
  maxSharedStrings: 100_000,
  maxSharedStringChars: 4_000_000,
  maxKeptCellChars: 500,
  maxMergedRanges: 1_000,
  maxMergeArea: 10_000,
  maxOutputChars: 20_000,
  maxSharedStringsXmlBytes: 16 * MB,
  maxWorksheetXmlBytes: 32 * MB,
  maxStylesXmlBytes: 16 * MB,
  maxMetadataXmlBytes: 4 * MB,
})

/** One workbook is never read for longer than this, however much of the reading budget is left. */
export const MAX_XLSX_PROCESSING_MS = 8_000

/** Ceilings with no business meaning: they only stop a hostile file from growing a table without end. */
const MAX_CONTENT_TYPE_ENTRIES = 10_000
const MAX_RELATIONSHIPS = 10_000
const MAX_NUMBER_FORMATS = 1_000
const MAX_CELL_FORMATS = 65_536
const MAX_COLUMN_RANGES = 1_024
const MAX_EXCEL_COLUMN = 16_384
const MAX_EXCEL_ROW = 1_048_576

const WORKBOOK_MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'

/** Content types of workbooks V1 does not read — macro-enabled, template, add-in, binary — and of a VBA project. */
const REFUSED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/vnd.ms-excel.sheet.macroenabled.main+xml',
  'application/vnd.ms-excel.template.macroenabled.main+xml',
  'application/vnd.ms-excel.addin.macroenabled.main+xml',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml',
  'application/vnd.ms-excel.sheet.binary.macroenabled.main',
  'application/vnd.ms-office.vbaproject',
])

const XLSX_FAILURE_CODES: ReadonlySet<string> = new Set<XlsxFailureCode>([
  'too_large', 'malformed', 'encrypted', 'unsupported', 'timeout', 'too_complex',
  'too_many_sheets', 'too_many_rows', 'too_many_cells', 'no_relevant_rows',
])

function refuse(code: XlsxFailureCode): never {
  throw new OoxmlFailure<XlsxFailureCode>(code)
}

export interface XlsxExtractionOptions {
  /** Epoch milliseconds after which reading stops with `timeout`. */
  deadline: number
  now?: () => number
  /** The current product's code, exactly as stored. Null or blank means no product-code filter. */
  productCode?: string | null
  /** The most characters the text may have. A longer result is refused, never cut. */
  maxChars?: number
  /** Lower ceilings, for tests. */
  limits?: Partial<XlsxLimits>
}

/** Reads one workbook. Never throws: every problem becomes one fixed code. */
export async function extractXlsxText(bytes: Uint8Array, options: XlsxExtractionOptions): Promise<XlsxExtractionResult> {
  const limits: XlsxLimits = { ...XLSX_LIMITS, ...options.limits }
  if (bytes.byteLength > limits.maxBytes) return { ok: false, code: 'too_large' }
  const now = options.now ?? Date.now
  let pkg: OoxmlPackage | undefined
  try {
    pkg = await openOoxmlPackage(bytes, { deadline: options.deadline, now, limits })
    const text = await readWorkbook(pkg, {
      limits,
      now,
      deadline: options.deadline,
      productCode: typeof options.productCode === 'string' ? options.productCode : null,
      maxChars: Math.min(limits.maxOutputChars, options.maxChars ?? limits.maxOutputChars),
    })
    return { ok: true, text }
  }
  catch (error) {
    const code = error instanceof OoxmlFailure ? String(error.code) : 'malformed'
    return { ok: false, code: XLSX_FAILURE_CODES.has(code) ? code as XlsxFailureCode : 'malformed' }
  }
  finally {
    pkg?.close()
  }
}

interface ReadContext {
  limits: XlsxLimits
  now: () => number
  deadline: number
  productCode: string | null
  maxChars: number
}

function checkDeadline(ctx: ReadContext): void {
  if (ctx.now() > ctx.deadline) refuse('timeout')
}

function isTrue(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

// ── Package structure ────────────────────────────────────────────────────────

interface Relationship {
  /** The last segment of the relationship type: `worksheet`, `sharedstrings`, `styles`, … */
  kind: string
  target: string
  external: boolean
}

/**
 * A relationship target resolved against the directory of the part that owns
 * it. `..` may climb inside the package but never above it, and the result must
 * itself be a safe part name.
 */
export function resolvePartTarget(baseDirectory: string, target: string): string | null {
  if (!target) return null
  const combined = target.startsWith('/') ? target.slice(1) : (baseDirectory ? `${baseDirectory}/${target}` : target)
  const segments: string[] = []
  for (const segment of combined.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  const part = segments.join('/')
  return part && isSafeEntryName(part) ? part : null
}

function directoryOf(part: string): string {
  const slash = part.lastIndexOf('/')
  return slash === -1 ? '' : part.slice(0, slash)
}

function relationshipsPartFor(part: string): string {
  const directory = directoryOf(part)
  const file = part.slice(part.lastIndexOf('/') + 1)
  return directory ? `${directory}/_rels/${file}.rels` : `_rels/${file}.rels`
}

/** The one standard workbook part, found through [Content_Types].xml. Any macro, template or binary content refuses the file. */
async function findWorkbookPart(pkg: OoxmlPackage, ctx: ReadContext): Promise<string> {
  if (!pkg.has('[Content_Types].xml')) refuse('malformed')
  const workbookParts: string[] = []
  let entries = 0
  let refused = false
  await pkg.readXml('[Content_Types].xml', ctx.limits.maxMetadataXmlBytes, {
    open(name, attributes) {
      if (name !== 'Override' && name !== 'Default') return
      entries += 1
      if (entries > MAX_CONTENT_TYPE_ENTRIES) refuse('too_complex')
      const contentType = (attributes.ContentType ?? '').trim().toLowerCase()
      if (REFUSED_CONTENT_TYPES.has(contentType)) refused = true
      if (name === 'Override' && contentType === WORKBOOK_MAIN_TYPE) workbookParts.push(attributes.PartName ?? '')
    },
  })
  if (refused) refuse('unsupported')
  if (workbookParts.length !== 1) refuse('malformed')
  const part = workbookParts[0]!.replace(/^\//, '')
  if (!isSafeEntryName(part) || !pkg.has(part)) refuse('malformed')
  return part
}

async function readRelationships(pkg: OoxmlPackage, part: string, ctx: ReadContext): Promise<Map<string, Relationship>> {
  const relationships = new Map<string, Relationship>()
  if (!pkg.has(part)) return relationships
  await pkg.readXml(part, ctx.limits.maxMetadataXmlBytes, {
    open(name, attributes) {
      if (name !== 'Relationship') return
      if (relationships.size >= MAX_RELATIONSHIPS) refuse('too_complex')
      const id = attributes.Id
      // Two relationships with one id would let two readers resolve a sheet differently.
      if (!id || relationships.has(id)) refuse('malformed')
      const type = attributes.Type ?? ''
      relationships.set(id, {
        kind: type.slice(type.lastIndexOf('/') + 1).toLowerCase(),
        target: attributes.Target ?? '',
        external: (attributes.TargetMode ?? '').toLowerCase() === 'external',
      })
    },
  })
  return relationships
}

/** The single part a workbook relationship of `kind` points at, or null when there is none. Two of one kind is ambiguous. */
function partOfKind(relationships: Map<string, Relationship>, kind: string, baseDirectory: string, pkg: OoxmlPackage): string | null {
  const matches = [...relationships.values()].filter(relationship => relationship.kind === kind)
  if (matches.length === 0) return null
  if (matches.length > 1 || matches[0]!.external) refuse('malformed')
  const part = resolvePartTarget(baseDirectory, matches[0]!.target)
  if (!part || !pkg.has(part)) refuse('malformed')
  return part
}

interface WorkbookSheet {
  name: string
  relationshipId: string
  visible: boolean
}

/** The id attribute from the relationships namespace, whatever prefix the file gave it (`r:id` in practice). */
function relationshipIdOf(attributes: Readonly<Record<string, string>>): string | undefined {
  for (const [key, value] of Object.entries(attributes)) {
    if (key.includes(':') && localName(key) === 'id') return value
  }
  return undefined
}

async function readWorkbookPart(pkg: OoxmlPackage, part: string, ctx: ReadContext): Promise<{ sheets: WorkbookSheet[], date1904: boolean }> {
  const sheets: WorkbookSheet[] = []
  let date1904 = false
  let inSheets = false
  await pkg.readXml(part, ctx.limits.maxMetadataXmlBytes, {
    open(name, attributes) {
      if (name === 'workbookPr') {
        date1904 = isTrue(attributes.date1904)
      }
      else if (name === 'sheets') {
        inSheets = true
      }
      else if (name === 'sheet' && inSheets) {
        if (sheets.length >= ctx.limits.maxWorkbookSheets) refuse('too_many_sheets')
        const relationshipId = relationshipIdOf(attributes)
        if (!relationshipId) refuse('malformed')
        // Anything other than an explicit or implied "visible" is treated as hidden.
        sheets.push({ name: attributes.name ?? '', relationshipId, visible: (attributes.state ?? 'visible') === 'visible' })
      }
    },
    close(name) {
      if (name === 'sheets') inSheets = false
    },
  })
  if (sheets.length === 0) refuse('malformed')
  return { sheets, date1904 }
}

/** Shared strings as plain text. Rich-text runs are joined; phonetic guides (`rPh`) are left out, as Excel shows them. */
async function readSharedStrings(pkg: OoxmlPackage, part: string, ctx: ReadContext): Promise<string[]> {
  const strings: string[] = []
  let current: string | null = null
  let phonetic = 0
  let inText = false
  let totalChars = 0
  await pkg.readXml(part, ctx.limits.maxSharedStringsXmlBytes, {
    open(name) {
      if (name === 'si') {
        if (strings.length >= ctx.limits.maxSharedStrings) refuse('too_complex')
        current = ''
      }
      else if (name === 'rPh') {
        phonetic += 1
      }
      else if (name === 't' && current !== null && phonetic === 0) {
        inText = true
      }
    },
    close(name) {
      if (name === 'si') {
        strings.push(current ?? '')
        current = null
      }
      else if (name === 'rPh') {
        phonetic -= 1
      }
      else if (name === 't') {
        inText = false
      }
    },
    text(value) {
      if (!inText || current === null) return
      totalChars += value.length
      if (totalChars > ctx.limits.maxSharedStringChars) refuse('too_complex')
      current += value
    },
  })
  return strings
}

interface StyleTables {
  /** `numFmtId` of each cell style, by style index. */
  cellFormats: number[]
  /** Format codes the workbook defines, by `numFmtId`. */
  customFormats: Map<number, string>
}

async function readStyles(pkg: OoxmlPackage, part: string, ctx: ReadContext): Promise<StyleTables> {
  const cellFormats: number[] = []
  const customFormats = new Map<number, string>()
  let inNumberFormats = false
  let inCellFormats = false
  await pkg.readXml(part, ctx.limits.maxStylesXmlBytes, {
    open(name, attributes) {
      if (name === 'numFmts') {
        inNumberFormats = true
      }
      else if (name === 'cellXfs') {
        inCellFormats = true
      }
      else if (name === 'numFmt' && inNumberFormats) {
        if (customFormats.size >= MAX_NUMBER_FORMATS) refuse('too_complex')
        const id = Number(attributes.numFmtId)
        if (Number.isInteger(id) && id >= 0) customFormats.set(id, attributes.formatCode ?? '')
      }
      else if (name === 'xf' && inCellFormats) {
        if (cellFormats.length >= MAX_CELL_FORMATS) refuse('too_complex')
        const id = Number(attributes.numFmtId ?? 0)
        cellFormats.push(Number.isInteger(id) && id >= 0 ? id : 0)
      }
    },
    close(name) {
      if (name === 'numFmts') inNumberFormats = false
      else if (name === 'cellXfs') inCellFormats = false
    },
  })
  return { cellFormats, customFormats }
}

// ── Number formats ───────────────────────────────────────────────────────────

/**
 * How many decimals a number format shows: every `0` place, and a `#` place only
 * when its digit is not a trailing zero — `0.0#` shows one or two.
 */
export interface DecimalPlaces {
  min: number
  max: number
}

export type NumberFormatKind =
  | { kind: 'general' }
  | { kind: 'hidden' }
  | { kind: 'number', decimals: DecimalPlaces }
  | { kind: 'percent', decimals: DecimalPlaces }
  | { kind: 'unit', suffix: string, decimals: DecimalPlaces }
  | { kind: 'datetime', date: boolean, time: boolean }
  /** A built-in East Asian date or time format, whose exact pattern depends on the locale. */
  | { kind: 'localeDatetime' }

/** Built-in number formats and the decimals each shows: `0`, `0.00`, `#,##0`, `#,##0.00`, and the last two with negatives in parentheses (37–40). */
const BUILT_IN_NUMBER = new Map([[1, 0], [2, 2], [3, 0], [4, 2], [37, 0], [38, 0], [39, 2], [40, 2]])
/** `0%` and `0.00%`. */
const BUILT_IN_PERCENT = new Map([[9, 0], [10, 2]])
const BUILT_IN_DATE = new Set([14, 15, 16, 17])
const BUILT_IN_TIME = new Set([18, 19, 20, 21, 45])
const BUILT_IN_DATE_TIME = new Set([22])
/** Date or time formats in every East Asian locale, each locale with its own pattern (年/月/日, 時/分, eras). */
const BUILT_IN_LOCALE_DATE_TIME = new Set([27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58])

const fixedDecimals = (places: number): DecimalPlaces => ({ min: places, max: places })

/**
 * How a number stored under a format is written out. Only unambiguous cases are
 * interpreted: a plain number, a percentage and a number followed by one quoted
 * unit — each written with the decimals its format shows, as Excel shows it —
 * and plain date or time patterns. Everything else is the stored number itself:
 * no attempt is made to reproduce Excel's formatting engine.
 */
export function classifyNumberFormat(numFmtId: number, formatCode: string | undefined): NumberFormatKind {
  if (formatCode !== undefined) return classifyFormatCode(formatCode)
  const number = BUILT_IN_NUMBER.get(numFmtId)
  if (number !== undefined) return { kind: 'number', decimals: fixedDecimals(number) }
  const percent = BUILT_IN_PERCENT.get(numFmtId)
  if (percent !== undefined) return { kind: 'percent', decimals: fixedDecimals(percent) }
  if (BUILT_IN_DATE.has(numFmtId)) return { kind: 'datetime', date: true, time: false }
  if (BUILT_IN_TIME.has(numFmtId)) return { kind: 'datetime', date: false, time: true }
  if (BUILT_IN_DATE_TIME.has(numFmtId)) return { kind: 'datetime', date: true, time: true }
  if (BUILT_IN_LOCALE_DATE_TIME.has(numFmtId)) return { kind: 'localeDatetime' }
  return { kind: 'general' }
}

/** Colour and locale tags change how a value looks, never what it is. */
const DISPLAY_TAGS = /\[(?:black|blue|cyan|green|magenta|red|white|yellow|color\s?\d{1,2}|\$-[0-9a-f]{1,8})\]/gi
/**
 * `0`, `#,##0.00`, `0.0#` — with the decimal places captured. At most 30 are read,
 * the most Excel's number dialog offers, so a hostile format code cannot make
 * each cell's text grow without end; a longer run is left as the stored number.
 */
const NUMBER_PLACEHOLDER = '(?:#,##)?0(?:\\.([0#]{1,30}))?'
const NUMBER_CODE = new RegExp(`^${NUMBER_PLACEHOLDER}$`)
const PERCENT_CODE = new RegExp(`^${NUMBER_PLACEHOLDER}%$`)
const UNIT_CODE = new RegExp(`^${NUMBER_PLACEHOLDER}"([^"]{1,24})"$`)

/** The part of a format code that applies to positive numbers, and how many `;`-separated sections the code has. */
function positiveSection(formatCode: string): { section: string, sections: number } {
  let quoted = false
  let escaped = false
  let end = -1
  let sections = 1
  for (let index = 0; index < formatCode.length; index += 1) {
    const char = formatCode[index]
    if (escaped) {
      escaped = false
    }
    else if (char === '\\' && !quoted) {
      escaped = true
    }
    else if (char === '"') {
      quoted = !quoted
    }
    else if (char === ';' && !quoted) {
      if (end === -1) end = index
      sections += 1
    }
  }
  return { section: end === -1 ? formatCode : formatCode.slice(0, end), sections }
}

/**
 * A custom format code, judged by its positive section. Negative and zero
 * sections only change how a sign or a zero looks, so they are not read.
 */
export function classifyFormatCode(formatCode: string): NumberFormatKind {
  const { section, sections } = positiveSection(formatCode.trim())
  const code = section.replace(DISPLAY_TAGS, '').trim()
  // An empty positive section shows nothing for a number: ";;;" is a common way to hide a value.
  if (sections > 1 && code === '') return { kind: 'hidden' }
  if (code === '' || code.toLowerCase() === 'general') return { kind: 'general' }
  const number = NUMBER_CODE.exec(code)
  if (number) return { kind: 'number', decimals: decimalPlacesOf(number[1]) }
  const percent = PERCENT_CODE.exec(code)
  if (percent) return { kind: 'percent', decimals: decimalPlacesOf(percent[1]) }
  const unit = UNIT_CODE.exec(code)
  if (unit) return { kind: 'unit', suffix: unit[2]!, decimals: decimalPlacesOf(unit[1]) }
  const pattern = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/am\/pm|a\/p|上午\/下午/gi, '')
  // Anything left in brackets — a condition, a numeral system, elapsed time ([h]:mm) — is not a plain date.
  if (/^[ymdhs\s\-/.:,]+$/i.test(pattern) && /[ydhs]/i.test(pattern)) {
    return { kind: 'datetime', date: /[yd]/i.test(pattern), time: /[hs]/i.test(pattern) }
  }
  return { kind: 'general' }
}

/** A stored number without binary floating-point noise: 0.45000000000000001 → "0.45". Excel keeps 15 significant digits. */
export function stableNumber(value: number): string {
  const rounded = Number.parseFloat(value.toPrecision(15))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

const DAY_MS = 86_400_000

/**
 * An Excel date serial as `YYYY-MM-DD`, `HH:MM:SS` or both, or null when the
 * serial is not a real date. The 1900 system counts a 1900-02-29 that never
 * existed (serial 60), so later serials are one day ahead; the 1904 system
 * starts at 1904-01-01.
 */
export function excelSerialToText(serial: number, date1904: boolean, parts: { date: boolean, time: boolean }): string | null {
  if (!Number.isFinite(serial) || serial < 0) return null
  let days = Math.floor(serial)
  let seconds = Math.round((serial - days) * 86_400)
  if (seconds === 86_400) {
    days += 1
    seconds = 0
  }
  let epoch: number
  if (date1904) {
    epoch = Date.UTC(1904, 0, 1) + days * DAY_MS
  }
  else {
    if (parts.date && (days === 0 || days === 60)) return null
    epoch = Date.UTC(1899, 11, 31) + (days < 60 ? days : days - 1) * DAY_MS
  }
  const at = new Date(epoch + seconds * 1000)
  if (Number.isNaN(at.getTime()) || at.getUTCFullYear() > 9999) return null
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  const date = `${pad(at.getUTCFullYear(), 4)}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`
  const time = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`
  if (parts.date && parts.time) return `${date} ${time}`
  return parts.date ? date : time
}

/** `0.0#` shows one decimal at least and two at most; a `#` with a `0` after it is shown like a `0`. */
function decimalPlacesOf(placeholders: string | undefined): DecimalPlaces {
  return placeholders ? { min: placeholders.lastIndexOf('0') + 1, max: placeholders.length } : fixedDecimals(0)
}

/** A run of decimal digits plus one: `"0999"` → `"1000"`, `""` → `"1"`. */
function incrementDigits(digits: string): string {
  const places = [...digits]
  for (let index = places.length - 1; index >= 0; index -= 1) {
    if (places[index] !== '9') {
      places[index] = String(Number(places[index]) + 1)
      return places.join('')
    }
    places[index] = '0'
  }
  return `1${places.join('')}`
}

/**
 * A number as a simple format shows it: rounded half away from zero to
 * `decimals.max` places, then trailing zeros dropped down to `decimals.min`.
 * Rounding works on the 15 significant digits Excel keeps, never on the binary
 * value — the double nearest 0.35 is 0.34999…, yet Excel shows 0.4 under `0.0`,
 * and so does this. `shift` moves the decimal point right, for a percentage.
 * No thousands separator is written and the decimal mark is always `.`: both
 * come from the reader's locale, not from the workbook. A negative number keeps
 * its sign even when it rounds to zero, as in Excel.
 */
function formatDecimalPlaces(value: number, decimals: DecimalPlaces, shift = 0): string {
  const [mantissa = '0', exponent = '0'] = Math.abs(value).toExponential(14).split('e')
  const significant = mantissa.replace('.', '')
  // Digits in front of the rounding position: none, or fewer, when the value is below the last place shown.
  const kept = 1 + Number(exponent) + shift + decimals.max
  let digits = kept > 0 ? significant.slice(0, kept).padEnd(kept, '0') : ''
  if (kept >= 0 && (significant[kept] ?? '0') >= '5') digits = incrementDigits(digits)
  digits = digits.padStart(decimals.max + 1, '0')
  const integer = digits.slice(0, digits.length - decimals.max).replace(/^0+(?=\d)/, '')
  let fraction = digits.slice(digits.length - decimals.max)
  while (fraction.length > decimals.min && fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  return `${value < 0 ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`
}

export function formatCellNumber(raw: string, format: NumberFormatKind, date1904: boolean): string {
  const trimmed = raw.trim()
  const value = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(value)) return trimmed
  switch (format.kind) {
    case 'hidden':
      return ''
    case 'number':
      return formatDecimalPlaces(value, format.decimals)
    case 'percent':
      return `${formatDecimalPlaces(value, format.decimals, 2)}%`
    case 'unit':
      return `${formatDecimalPlaces(value, format.decimals)}${format.suffix}`
    case 'datetime':
      return excelSerialToText(value, date1904, format) ?? stableNumber(value)
    case 'localeDatetime': {
      // The locale's pattern is unknown, so the serial decides: a date, a time of day, or both.
      const parts = { date: value >= 1, time: !Number.isInteger(value) }
      if (!parts.date && !parts.time) return stableNumber(value)
      return excelSerialToText(value, date1904, parts) ?? stableNumber(value)
    }
    default:
      return stableNumber(value)
  }
}

function styleFormatter(styles: StyleTables): (style: number) => NumberFormatKind {
  const cache = new Map<number, NumberFormatKind>()
  return (style) => {
    let kind = cache.get(style)
    if (!kind) {
      const numFmtId = styles.cellFormats[style] ?? 0
      kind = classifyNumberFormat(numFmtId, styles.customFormats.get(numFmtId))
      cache.set(style, kind)
    }
    return kind
  }
}

// ── Cell references ──────────────────────────────────────────────────────────

/** `B12` → `{ row: 12, column: 2 }`, or null for anything that is not a cell inside Excel's grid. */
export function parseCellReference(reference: string): { row: number, column: number } | null {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(reference)
  if (!match) return null
  let column = 0
  for (const letter of match[1]!) column = column * 26 + (letter.charCodeAt(0) - 64)
  const row = Number(match[2])
  if (column > MAX_EXCEL_COLUMN || row > MAX_EXCEL_ROW) return null
  return { row, column }
}

export interface CellRange {
  top: number
  left: number
  bottom: number
  right: number
}

export function parseCellRange(reference: string): CellRange | null {
  const ends = reference.split(':')
  if (ends.length > 2) return null
  const start = parseCellReference(ends[0] ?? '')
  const end = parseCellReference(ends[1] ?? ends[0] ?? '')
  if (!start || !end) return null
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.column, end.column),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.column, end.column),
  }
}

/** 1 → `A`, 27 → `AA`. */
export function columnLetters(column: number): string {
  let letters = ''
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters
  }
  return letters
}

// ── Worksheets ───────────────────────────────────────────────────────────────

interface SheetCell {
  column: number
  text: string
}

interface SheetRow {
  index: number
  cells: SheetCell[]
}

interface SheetGrid {
  /** Visible rows with at least one visible value, in row order. */
  rows: SheetRow[]
  merges: CellRange[]
  hiddenColumns: Uint8Array
}

interface SheetInputs {
  sharedStrings: readonly string[]
  formatForStyle: (style: number) => NumberFormatKind
  date1904: boolean
  totals: { rows: number, cellsScanned: number }
}

interface OpenRow {
  index: number
  hidden: boolean
  hasValue: boolean
  cells: SheetCell[]
}

interface OpenCell {
  column: number
  type: string
  style: number
  formula: boolean
  value: string
  inline: string
}

/** Cached results Excel stores for a formula that failed. None of them is a product fact. */
const FORMULA_ERRORS: ReadonlySet<string> = new Set([
  '#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA',
  '#SPILL!', '#CALC!', '#FIELD!', '#BLOCKED!', '#CONNECT!', '#BUSY!', '#UNKNOWN!', '#EXTERNAL!', '#PYTHON!',
])

function cellDisplayText(cell: OpenCell, raw: string, inputs: SheetInputs): string {
  const format = inputs.formatForStyle(cell.style)
  if (format.kind === 'hidden') return ''
  let text: string
  switch (cell.type) {
    case 's': {
      const index = Number(raw)
      if (!Number.isInteger(index) || index < 0 || index >= inputs.sharedStrings.length) refuse('malformed')
      text = inputs.sharedStrings[index] ?? ''
      break
    }
    case 'inlineStr':
    case 'str':
    case 'd':
      text = raw
      break
    case 'b':
      text = raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : ''
      break
    case 'e':
      return ''
    default:
      text = formatCellNumber(raw, format, inputs.date1904)
  }
  if (cell.formula && FORMULA_ERRORS.has(text.trim().toUpperCase())) return ''
  return text
}

/**
 * One worksheet, streamed. Only visible, non-empty cells are kept, stored by
 * row with no grid allocated, so a sheet whose only cell is XFD1048576 costs one
 * cell. Formula text is never captured; a formula without a cached value is an
 * empty cell.
 */
async function readWorksheet(pkg: OoxmlPackage, part: string, inputs: SheetInputs, ctx: ReadContext): Promise<SheetGrid> {
  const { limits } = ctx
  const hiddenColumns = new Uint8Array(MAX_EXCEL_COLUMN + 1)
  const rows: SheetRow[] = []
  const merges: CellRange[] = []
  const usedColumns = new Set<number>()
  let columnRanges = 0
  let rowsInSheet = 0
  let inSheetData = false
  let row: OpenRow | null = null
  let cell: OpenCell | null = null
  let previousRow = 0
  let previousColumn = 0
  let capturing: 'value' | 'inline' | null = null
  let phonetic = 0

  const finishCell = (current: OpenCell, owner: OpenRow) => {
    const raw = current.type === 'inlineStr' ? current.inline : current.value
    if (raw === '') return
    inputs.totals.cellsScanned += 1
    if (inputs.totals.cellsScanned > limits.maxNonEmptyCellsScanned) refuse('too_many_cells')
    owner.hasValue = true
    if (owner.hidden || hiddenColumns[current.column] === 1) return
    const text = cellDisplayText(current, raw, inputs)
    if (text === '') return
    usedColumns.add(current.column)
    if (usedColumns.size > limits.maxColumnsUsed) refuse('too_many_cells')
    owner.cells.push({ column: current.column, text })
  }

  const finishRow = (current: OpenRow) => {
    if (current.hasValue) {
      rowsInSheet += 1
      inputs.totals.rows += 1
      if (rowsInSheet > limits.maxRowsPerSheet || inputs.totals.rows > limits.maxRowsTotal) refuse('too_many_rows')
    }
    if (current.cells.length > 0) rows.push({ index: current.index, cells: current.cells })
  }

  await pkg.readXml(part, limits.maxWorksheetXmlBytes, {
    open(name, attributes) {
      switch (name) {
        case 'col': {
          if (inSheetData) return
          const min = Number(attributes.min)
          const max = Number(attributes.max)
          if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > MAX_EXCEL_COLUMN) refuse('malformed')
          columnRanges += 1
          if (columnRanges > MAX_COLUMN_RANGES) refuse('too_complex')
          if (isTrue(attributes.hidden) || (attributes.width !== undefined && Number(attributes.width) === 0)) {
            hiddenColumns.fill(1, min, max + 1)
          }
          return
        }
        case 'sheetData':
          inSheetData = true
          return
        case 'row': {
          if (!inSheetData) return
          const index = attributes.r === undefined ? previousRow + 1 : Number(attributes.r)
          if (!Number.isInteger(index) || index <= previousRow || index > MAX_EXCEL_ROW) refuse('malformed')
          previousRow = index
          previousColumn = 0
          row = {
            index,
            hidden: isTrue(attributes.hidden) || (isTrue(attributes.customHeight) && Number(attributes.ht) === 0),
            hasValue: false,
            cells: [],
          }
          return
        }
        case 'c': {
          if (!row) return
          const position = attributes.r === undefined
            ? { row: row.index, column: previousColumn + 1 }
            : parseCellReference(attributes.r)
          if (!position || position.row !== row.index || position.column <= previousColumn || position.column > MAX_EXCEL_COLUMN) {
            refuse('malformed')
          }
          previousColumn = position.column
          cell = { column: position.column, type: attributes.t ?? 'n', style: Number(attributes.s ?? 0) || 0, formula: false, value: '', inline: '' }
          return
        }
        case 'f':
          if (cell) cell.formula = true
          return
        case 'v':
          if (cell) capturing = 'value'
          return
        case 'rPh':
          phonetic += 1
          return
        case 't':
          if (cell && phonetic === 0) capturing = 'inline'
          return
        case 'mergeCell': {
          if (merges.length >= limits.maxMergedRanges) refuse('too_complex')
          const range = parseCellRange(attributes.ref ?? '')
          if (!range) refuse('malformed')
          if ((range.bottom - range.top + 1) * (range.right - range.left + 1) > limits.maxMergeArea) refuse('too_complex')
          merges.push(range)
        }
      }
    },
    close(name) {
      switch (name) {
        case 'v':
        case 't':
          capturing = null
          return
        case 'rPh':
          phonetic -= 1
          return
        case 'c':
          if (cell && row) finishCell(cell, row)
          cell = null
          return
        case 'row':
          if (row) finishRow(row)
          row = null
          return
        case 'sheetData':
          inSheetData = false
      }
    },
    text(value) {
      if (!cell || !capturing) return
      if (capturing === 'value') cell.value += value
      else cell.inline += value
    },
  })
  return { rows, merges, hiddenColumns }
}

// ── Structured text ──────────────────────────────────────────────────────────

/** Control, format and line-separator characters become spaces, and runs of space collapse: one value, one line. */
function flattenText(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** `|` separates columns, so one inside a value is escaped and can never fake a column. */
function escapeColumns(value: string): string {
  return value.replace(/\|/g, '\\|')
}

/** At most `max` characters, never splitting a surrogate pair. */
function firstCharacters(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('')
}

interface RenderState {
  /** The normalized code a sheet may be narrowed to, or '' when nothing is narrowed. */
  normalizedCode: string
  displayCode: string
  outputCells: number
  outputChars: number
}

interface RowEntry {
  row: SheetRow
  /** The merges whose anchor has a visible value and whose rows include this one. */
  merges: CellRange[]
}

/**
 * One visible sheet as text, or null when it has no data row:
 *
 *   Sheet: Specifications
 *   Filtered to exact product code: LT-180C
 *   Columns: Model | Aperture | Voltage
 *   LT180C | 180 mm | 220 V
 *
 * A cell covered by a merge shows the merge's value, looked up lazily from the
 * merge's anchor — never by copying the value of the row above. Every ceiling on
 * what is written out refuses the workbook; nothing is cut.
 *
 * With a product code, a sheet is narrowed in one of two ways, and only when the
 * narrowing still keeps a data row:
 *
 *   - column-oriented — the header names the code, and a visible column left of
 *     the first column it names holds a value: every such column (a parameter,
 *     a unit, a range — kept by position, never by what its header says) and
 *     every column headed by the code are kept, for the rows with a value under
 *     the code. Right of the first match, a column is kept only when its header
 *     names the code, so another model's column or a note between models is not;
 *   - row-oriented — otherwise, the data rows with a cell naming the code.
 *
 * A sheet that does not name the code is kept whole.
 */
function renderSheet(name: string, grid: SheetGrid, state: RenderState, ctx: ReadContext): string | null {
  if (grid.rows.length === 0) return null
  const { limits } = ctx
  const values = new Map<number, Map<number, string>>()
  for (const row of grid.rows) values.set(row.index, new Map(row.cells.map(cell => [cell.column, cell.text])))
  const own = (row: number, column: number) => values.get(row)?.get(column)
  const anchoredMerges = grid.merges.filter(merge => own(merge.top, merge.left) !== undefined)

  const entries: RowEntry[] = grid.rows.map(row => ({
    row,
    merges: anchoredMerges.filter(merge => merge.top <= row.index && row.index <= merge.bottom),
  }))
  const valueAt = (entry: RowEntry, column: number): string => {
    const direct = own(entry.row.index, column)
    if (direct !== undefined) return direct
    if (grid.hiddenColumns[column] === 1) return ''
    const merge = entry.merges.find(candidate => candidate.left <= column && column <= candidate.right)
    return merge ? (own(merge.top, merge.left) ?? '') : ''
  }
  const columnsOf = (entry: RowEntry): Set<number> => {
    const columns = new Set(entry.row.cells.map(cell => cell.column))
    for (const merge of entry.merges) {
      for (let column = merge.left; column <= merge.right; column += 1) {
        if (grid.hiddenColumns[column] === 1) continue
        columns.add(column)
        if (columns.size > limits.maxColumnsUsed) refuse('too_many_cells')
      }
    }
    return columns
  }
  const usedColumns = (rows: RowEntry[]): number[] => {
    const columns = new Set<number>()
    for (const entry of rows) {
      for (const column of columnsOf(entry)) {
        if (valueAt(entry, column) !== '') columns.add(column)
      }
      if (columns.size > limits.maxColumnsUsed) refuse('too_many_cells')
    }
    return [...columns].sort((a, b) => a - b)
  }

  const [header, ...data] = entries as [RowEntry, ...RowEntry[]]
  const namesCode = (entry: RowEntry, column: number) => cellNamesProductCode(valueAt(entry, column), state.normalizedCode)
  let kept = data
  let columns: number[] | null = null
  let filtered = false
  if (state.normalizedCode) {
    const matched = [...columnsOf(header)].filter(column => namesCode(header, column)).sort((a, b) => a - b)
    const underMatched = data.filter(entry => matched.some(column => valueAt(entry, column) !== ''))
    // Every visible column left of the first match describes each row — a parameter, a unit, a range — by position alone.
    const descriptors = underMatched.length > 0 ? usedColumns([header, ...underMatched]).filter(column => column < matched[0]!) : []
    if (descriptors.length > 0) {
      // Column-oriented: the descriptor columns, then every column headed by this exact code, and no other.
      kept = underMatched
      columns = [...descriptors, ...matched]
      filtered = true
    }
    else {
      // Row-oriented: every data row with a cell naming this exact code.
      const matchingRows = data.filter(entry => [...columnsOf(entry)].some(column => namesCode(entry, column)))
      if (matchingRows.length > 0) {
        kept = matchingRows
        filtered = true
      }
    }
  }
  const keptColumns = columns ?? usedColumns([header, ...kept])
  const body = kept.filter(entry => keptColumns.some(column => valueAt(entry, column) !== ''))
  if (body.length === 0) return null

  const lines: string[] = []
  const write = (line: string) => {
    // Exactly what joining adds: nothing before the first line, a blank line between sheets, a newline within one.
    const separator = state.outputChars === 0 ? 0 : (lines.length === 0 ? 2 : 1)
    state.outputChars += separator + line.length
    if (state.outputChars > ctx.maxChars) refuse('too_complex')
    lines.push(line)
  }
  const renderRow = (entry: RowEntry, isHeader: boolean) => keptColumns.map((column) => {
    const text = flattenText(valueAt(entry, column))
    if (text.length > limits.maxKeptCellChars) refuse('too_complex')
    if (text) {
      state.outputCells += 1
      if (state.outputCells > limits.maxOutputCells) refuse('too_many_cells')
    }
    return isHeader && !text ? `Column ${columnLetters(column)}` : escapeColumns(text)
  }).join(' | ')

  write(`Sheet: ${escapeColumns(firstCharacters(flattenText(name), 100)) || 'Untitled sheet'}`)
  if (filtered) write(`Filtered to exact product code: ${state.displayCode}`)
  write(`Columns: ${renderRow(header, true)}`)
  for (const entry of body) {
    checkDeadline(ctx)
    write(renderRow(entry, false))
  }
  return lines.join('\n')
}

async function readWorkbook(pkg: OoxmlPackage, ctx: ReadContext): Promise<string> {
  const workbookPart = await findWorkbookPart(pkg, ctx)
  const baseDirectory = directoryOf(workbookPart)
  const relationships = await readRelationships(pkg, relationshipsPartFor(workbookPart), ctx)
  if ([...relationships.values()].some(relationship => relationship.kind === 'xlmacrosheet' || relationship.kind === 'xlintlmacrosheet')) {
    refuse('unsupported')
  }
  const workbook = await readWorkbookPart(pkg, workbookPart, ctx)
  const visibleSheets = workbook.sheets.filter(sheet => sheet.visible)
  if (visibleSheets.length > ctx.limits.maxVisibleSheets) refuse('too_many_sheets')

  const sharedStringsPart = partOfKind(relationships, 'sharedstrings', baseDirectory, pkg)
  const stylesPart = partOfKind(relationships, 'styles', baseDirectory, pkg)
  const sharedStrings = sharedStringsPart ? await readSharedStrings(pkg, sharedStringsPart, ctx) : []
  const styles = stylesPart ? await readStyles(pkg, stylesPart, ctx) : { cellFormats: [], customFormats: new Map<number, string>() }

  const inputs: SheetInputs = {
    sharedStrings,
    formatForStyle: styleFormatter(styles),
    date1904: workbook.date1904,
    totals: { rows: 0, cellsScanned: 0 },
  }
  // Only a code with both a letter and a digit narrows anything; see isFilterableProductCode.
  const normalizedCode = ctx.productCode ? normalizeProductCode(ctx.productCode) : ''
  const state: RenderState = {
    normalizedCode: isFilterableProductCode(normalizedCode) ? normalizedCode : '',
    displayCode: escapeColumns(firstCharacters(flattenText(ctx.productCode ?? ''), 100)),
    outputCells: 0,
    outputChars: 0,
  }

  const blocks: string[] = []
  for (const sheet of visibleSheets) {
    checkDeadline(ctx)
    const relationship = relationships.get(sheet.relationshipId)
    if (!relationship || relationship.external) refuse('malformed')
    // A chart or dialog sheet holds no cell values.
    if (relationship.kind === 'chartsheet' || relationship.kind === 'dialogsheet') continue
    if (relationship.kind !== 'worksheet') refuse('malformed')
    const part = resolvePartTarget(baseDirectory, relationship.target)
    if (!part || !pkg.has(part)) refuse('malformed')
    const grid = await readWorksheet(pkg, part, inputs, ctx)
    const block = renderSheet(sheet.name, grid, state, ctx)
    if (block) blocks.push(block)
  }
  if (blocks.length === 0) refuse('no_relevant_rows')
  return blocks.join('\n\n')
}
