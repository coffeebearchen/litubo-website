/**
 * AI-DOCX-SOURCE-01 — a .docx Word document, read into bounded structured text.
 *
 * The package is streamed through `ooxmlReader.ts`, the same bounded reader the
 * workbook reader uses: nothing is loaded whole, the bytes actually inflated are
 * counted, a DOCTYPE is refused, and every limit below is enforced while parsing.
 * A document over a limit is refused as a whole, never cut, because the part a
 * cut would drop could hold a value that contradicts the part it kept.
 *
 * What reaches the text is the document as it reads once every tracked change is
 * accepted: inserted and moved-to text is kept, deleted and moved-from text is
 * not, hidden text is not, and a field contributes the result it shows — never
 * its instruction, which can name a file path. Only four parts are ever opened:
 * the content types, the main document part, that part's relationships (to find
 * its styles) and its styles (to name its headings and hidden styles). Headers,
 * footers, comments, footnotes, endnotes, embedded objects, media and custom XML
 * are never opened, and no relationship is ever followed: a hyperlink contributes
 * the words it shows, not where it points.
 *
 * Headings, paragraphs and tables keep their structure, so a value stays next to
 * the parameter and the model it belongs to:
 *
 *   # LT180C
 *   Aperture: 180 mm
 *   Table:
 *   Parameter | Value
 *   Voltage | 220 V
 *
 * Nothing here narrows a document to one product. A Word heading may name one
 * model, a series or "all models", so the whole bounded text goes to the D-025
 * relevance guard in the prompt, which decides what belongs to the current product.
 *
 * A macro-enabled or template document, a VBA project, and content shown from
 * another file (`altChunk`, `subDoc`) are refused as unsupported: that content is
 * visible in Word but not readable here, and it is never silently left out.
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
import { resolvePartTarget } from './xlsxExtraction'

export type DocxFailureCode =
  | 'too_large'
  | 'malformed'
  | 'encrypted'
  | 'unsupported'
  | 'timeout'
  | 'too_complex'
  | 'no_text'

export type DocxExtractionResult =
  | { ok: true, text: string }
  | { ok: false, code: DocxFailureCode }

const MB = 1024 * 1024

export interface DocxLimits extends OoxmlLimits {
  /** The largest document file read at all. */
  maxBytes: number
  maxDocumentXmlBytes: number
  maxStylesXmlBytes: number
  /** `[Content_Types].xml` and the main part's relationships. */
  maxMetadataXmlBytes: number
  /** Every paragraph counts: in the body, in a table cell and in a text box. */
  maxParagraphs: number
  /** Every table counts, nested tables included. */
  maxTables: number
  maxRowsPerTable: number
  /** Cells across all tables. A cell spanning several grid columns counts once per column. */
  maxTableCellsTotal: number
  /** A table directly in the body is depth 1; a table inside one of its cells is depth 2. */
  maxTableNesting: number
  maxOutputChars: number
}

export const DOCX_LIMITS: Readonly<DocxLimits> = Object.freeze({
  ...OOXML_LIMITS,
  maxBytes: 10 * MB,
  maxDocumentXmlBytes: 32 * MB,
  maxStylesXmlBytes: 4 * MB,
  maxMetadataXmlBytes: 4 * MB,
  maxParagraphs: 5_000,
  maxTables: 100,
  maxRowsPerTable: 1_000,
  maxTableCellsTotal: 20_000,
  maxTableNesting: 2,
  maxOutputChars: 20_000,
})

/** One document is never read for longer than this, however much of the reading budget is left. */
export const MAX_DOCX_PROCESSING_MS = 5_000

/** Ceilings with no business meaning: they only stop a hostile file from growing a table without end. */
const MAX_CONTENT_TYPE_ENTRIES = 10_000
const MAX_RELATIONSHIPS = 10_000
const MAX_STYLES = 10_000
/** How far a style's `basedOn` chain is followed. */
const MAX_STYLE_CHAIN = 20
/** Word tables have at most 63 columns, so a larger span or skipped-column count is not a real table. */
const MAX_GRID_SPAN = 64

const DOCUMENT_MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'

/** Content types of documents V1 does not read — macro-enabled, template — and of a VBA project. */
const REFUSED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/vnd.ms-word.document.macroenabled.main+xml',
  'application/vnd.ms-word.template.macroenabledtemplate.main+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
  'application/vnd.ms-office.vbaproject',
  'application/vnd.ms-word.vbadata+xml',
])

/** Content shown in place from another file. Its text is not in this part, so the document cannot be read as it appears. */
const IMPORTED_CONTENT: ReadonlySet<string> = new Set(['altChunk', 'subDoc'])

/**
 * Subtrees that are never the document as it now reads: deleted and moved-away
 * text, field instructions, the record of earlier formatting (which would
 * otherwise hide or unhide a run by its old properties), content-control
 * properties, and embedded binary data.
 */
const SKIPPED_ELEMENTS: ReadonlySet<string> = new Set([
  'del', 'moveFrom', 'delText', 'instrText', 'delInstrText',
  'rPrChange', 'pPrChange', 'tblPrChange', 'trPrChange', 'tcPrChange', 'sectPrChange', 'tblGridChange', 'numberingChange',
  'sdtPr', 'sdtEndPr', 'fldData', 'binData',
])

/** Run properties that hide text in Word. */
const HIDDEN_PROPERTIES: ReadonlySet<string> = new Set(['vanish', 'webHidden', 'specVanish'])

const DOCX_FAILURE_CODES: ReadonlySet<string> = new Set<DocxFailureCode>([
  'too_large', 'malformed', 'encrypted', 'unsupported', 'timeout', 'too_complex', 'no_text',
])

function refuse(code: DocxFailureCode): never {
  throw new OoxmlFailure<DocxFailureCode>(code)
}

export interface DocxExtractionOptions {
  /** Epoch milliseconds after which reading stops with `timeout`. */
  deadline: number
  now?: () => number
  /** The most characters the text may have. A longer result is refused, never cut. */
  maxChars?: number
  /** Lower ceilings, for tests. */
  limits?: Partial<DocxLimits>
}

/** Reads one document. Never throws: every problem becomes one fixed code. */
export async function extractDocxText(bytes: Uint8Array, options: DocxExtractionOptions): Promise<DocxExtractionResult> {
  const limits: DocxLimits = { ...DOCX_LIMITS, ...options.limits }
  if (bytes.byteLength > limits.maxBytes) return { ok: false, code: 'too_large' }
  const now = options.now ?? Date.now
  let pkg: OoxmlPackage | undefined
  try {
    pkg = await openOoxmlPackage(bytes, { deadline: options.deadline, now, limits })
    const text = await readDocument(pkg, {
      limits,
      now,
      deadline: options.deadline,
      maxChars: Math.min(limits.maxOutputChars, options.maxChars ?? limits.maxOutputChars),
    })
    return { ok: true, text }
  }
  catch (error) {
    const code = error instanceof OoxmlFailure ? String(error.code) : 'malformed'
    return { ok: false, code: DOCX_FAILURE_CODES.has(code) ? code as DocxFailureCode : 'malformed' }
  }
  finally {
    pkg?.close()
  }
}

interface ReadContext {
  limits: DocxLimits
  now: () => number
  deadline: number
  maxChars: number
}

function checkDeadline(ctx: ReadContext): void {
  if (ctx.now() > ctx.deadline) refuse('timeout')
}

/** An attribute by its local name, whatever namespace prefix the file gave it (`w:val` in practice). */
function attribute(attributes: Readonly<Record<string, string>>, name: string): string | undefined {
  for (const [key, value] of Object.entries(attributes)) {
    if (localName(key) === name) return value
  }
  return undefined
}

/** An on/off property: present means on, unless its value says off. */
function isOn(value: string | undefined): boolean {
  return value === undefined || !['0', 'false', 'off'].includes(value.trim().toLowerCase())
}

// ── Package structure ────────────────────────────────────────────────────────

function directoryOf(part: string): string {
  const slash = part.lastIndexOf('/')
  return slash === -1 ? '' : part.slice(0, slash)
}

function relationshipsPartFor(part: string): string {
  const directory = directoryOf(part)
  const file = part.slice(part.lastIndexOf('/') + 1)
  return directory ? `${directory}/_rels/${file}.rels` : `_rels/${file}.rels`
}

/** The one main document part, found through [Content_Types].xml. Macro, template or VBA content refuses the file. */
async function findDocumentPart(pkg: OoxmlPackage, ctx: ReadContext): Promise<string> {
  if (!pkg.has('[Content_Types].xml')) refuse('malformed')
  const documentParts: string[] = []
  let entries = 0
  let refused = false
  await pkg.readXml('[Content_Types].xml', ctx.limits.maxMetadataXmlBytes, {
    open(name, attributes) {
      if (name !== 'Override' && name !== 'Default') return
      entries += 1
      if (entries > MAX_CONTENT_TYPE_ENTRIES) refuse('too_complex')
      const contentType = (attributes.ContentType ?? '').trim().toLowerCase()
      if (REFUSED_CONTENT_TYPES.has(contentType)) refused = true
      if (name === 'Override' && contentType === DOCUMENT_MAIN_TYPE) documentParts.push(attributes.PartName ?? '')
    },
  })
  if (refused || pkg.has('word/vbaProject.bin')) refuse('unsupported')
  if (documentParts.length !== 1) refuse('malformed')
  const part = documentParts[0]!.replace(/^\//, '')
  if (!isSafeEntryName(part) || !pkg.has(part)) refuse('malformed')
  return part
}

/**
 * The document's styles part, through its relationships, or null when it has
 * none. A VBA project relationship refuses the file. Relationships are only
 * read, never followed: a styles relationship that points outside the package
 * is damage, not a location to visit.
 */
async function findStylesPart(pkg: OoxmlPackage, documentPart: string, ctx: ReadContext): Promise<string | null> {
  const relationshipsPart = relationshipsPartFor(documentPart)
  if (!pkg.has(relationshipsPart)) return null
  const ids = new Set<string>()
  const styles: Array<{ target: string, external: boolean }> = []
  let macro = false
  await pkg.readXml(relationshipsPart, ctx.limits.maxMetadataXmlBytes, {
    open(name, attributes) {
      if (name !== 'Relationship') return
      if (ids.size >= MAX_RELATIONSHIPS) refuse('too_complex')
      const id = attributes.Id
      // Two relationships with one id would let two readers resolve a part differently.
      if (!id || ids.has(id)) refuse('malformed')
      ids.add(id)
      const type = attributes.Type ?? ''
      const kind = type.slice(type.lastIndexOf('/') + 1).toLowerCase()
      if (kind === 'vbaproject') macro = true
      if (kind === 'styles') styles.push({ target: attributes.Target ?? '', external: (attributes.TargetMode ?? '').toLowerCase() === 'external' })
    },
  })
  if (macro) refuse('unsupported')
  if (styles.length === 0) return null
  if (styles.length > 1 || styles[0]!.external) refuse('malformed')
  const part = resolvePartTarget(directoryOf(documentPart), styles[0]!.target)
  if (!part || !pkg.has(part)) refuse('malformed')
  return part
}

// ── Styles ───────────────────────────────────────────────────────────────────

interface StyleEntry {
  type: string
  name: string
  basedOn: string | null
  /** Whether the style's own run properties hide text; undefined when it does not say. */
  hidden: boolean | undefined
}

interface Styles {
  byId: Map<string, StyleEntry>
  /** The paragraph style a paragraph without `pStyle` has. */
  defaultParagraphStyle: string | null
  /** Whether the document's default run properties hide text. */
  defaultHidden: boolean
}

const NO_STYLES: Styles = { byId: new Map(), defaultParagraphStyle: null, defaultHidden: false }

/**
 * Only what the text needs from the styles: each style's name, what it is based
 * on, and whether it hides text. Fonts, sizes, colours and bold are never read,
 * so a heading is never guessed from how a paragraph looks.
 */
async function readStyles(pkg: OoxmlPackage, part: string, ctx: ReadContext): Promise<Styles> {
  const byId = new Map<string, StyleEntry>()
  let defaultParagraphStyle: string | null = null
  let defaultHidden = false
  const stack: string[] = []
  let current: (StyleEntry & { id: string }) | null = null
  await pkg.readXml(part, ctx.limits.maxStylesXmlBytes, {
    open(name, attributes) {
      const parent = stack[stack.length - 1]
      const grandparent = stack[stack.length - 2]
      stack.push(name)
      if (name === 'style' && parent === 'styles') {
        if (byId.size >= MAX_STYLES) refuse('too_complex')
        const type = attribute(attributes, 'type') ?? 'paragraph'
        current = { id: attribute(attributes, 'styleId') ?? '', type, name: '', basedOn: null, hidden: undefined }
        const isDefault = attribute(attributes, 'default')
        if (type === 'paragraph' && isDefault !== undefined && isOn(isDefault) && defaultParagraphStyle === null) {
          defaultParagraphStyle = current.id
        }
      }
      else if (current && parent === 'style') {
        if (name === 'name') current.name = attribute(attributes, 'val') ?? ''
        else if (name === 'basedOn') current.basedOn = attribute(attributes, 'val') ?? null
      }
      else if (HIDDEN_PROPERTIES.has(name) && parent === 'rPr') {
        if (current && grandparent === 'style') current.hidden = isOn(attribute(attributes, 'val'))
        else if (grandparent === 'rPrDefault') defaultHidden = isOn(attribute(attributes, 'val'))
      }
    },
    close(name) {
      stack.pop()
      if (name !== 'style' || !current || stack[stack.length - 1] !== 'styles') return
      const { id, ...entry } = current
      current = null
      if (!id) return
      // Two definitions of one style would let two readers disagree about whether its text is hidden.
      if (byId.has(id)) refuse('malformed')
      byId.set(id, entry)
    },
  })
  return { byId, defaultParagraphStyle, defaultHidden }
}

/** The styles a style inherits from, itself first, as long as they are of `type`. */
function* styleChain(styles: Styles, styleId: string | null, type: string): Generator<StyleEntry> {
  let id = styleId
  for (let step = 0; id && step < MAX_STYLE_CHAIN; step += 1) {
    const style = styles.byId.get(id)
    if (!style || style.type !== type) return
    yield style
    id = style.basedOn
  }
}

/**
 * 1–6 for a paragraph style that is a built-in heading ("heading 1" … "heading 9",
 * deeper levels shown as 6) or is based on one; 0 for anything else.
 */
function headingLevelOf(styles: Styles, styleId: string | null): number {
  for (const style of styleChain(styles, styleId, 'paragraph')) {
    const match = /^heading\s*([1-9])$/i.exec(style.name.trim())
    if (match) return Math.min(6, Number(match[1]))
  }
  return 0
}

function hiddenByStyle(styles: Styles, styleId: string | null, type: string): boolean | undefined {
  for (const style of styleChain(styles, styleId, type)) {
    if (style.hidden !== undefined) return style.hidden
  }
  return undefined
}

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * One canonical form for text as it is gathered: control, format and separator
 * characters and tabs become spaces, spaces collapse, and a line break swallows
 * the spaces around it. A buffer's length is then its final length, give or take
 * its two ends, so a limit can be checked while the text grows.
 */
function canonical(piece: string): string {
  return piece
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, character => (character === '\n' ? '\n' : ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n\s*/g, '\n')
}

function joinText(buffer: string, piece: string): string {
  let next = canonical(piece)
  if (!next) return buffer
  const last = buffer.at(-1)
  if ((last === ' ' || last === '\n') && next[0] === ' ') next = next.slice(1)
  if (last === '\n' && next[0] === '\n') next = next.slice(1)
  if (last === ' ' && next[0] === '\n') buffer = buffer.slice(0, -1)
  return buffer + next
}

/** The non-empty lines of a paragraph. */
function linesOf(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(Boolean)
}

/** `|` separates cells, so one inside a value is escaped and can never fake a cell. */
function escapeCells(value: string): string {
  return value.replace(/\|/g, '\\|')
}

// ── Main document ────────────────────────────────────────────────────────────

interface ParagraphState {
  text: string
  styleId: string | null
}

interface RunState {
  text: string
  /** Set by the run's own `vanish` / `webHidden` / `specVanish`; undefined when the run does not say. */
  hidden: boolean | undefined
  styleId: string | null
}

interface CellState {
  /** One entry per non-empty paragraph, or per nested table. */
  parts: string[]
  span: number
  /** Removed by a tracked cell deletion. */
  deleted: boolean
}

interface TableState {
  rows: string[][]
  rowCount: number
  row: string[] | null
  /** Removed by a tracked row deletion. */
  rowDeleted: boolean
  gridBefore: number
  cell: CellState | null
}

function spanValue(value: string | undefined, minimum: number): number {
  const count = Number(value)
  if (!Number.isInteger(count) || count < minimum) return minimum
  if (count > MAX_GRID_SPAN) refuse('too_complex')
  return count
}

async function readDocument(pkg: OoxmlPackage, ctx: ReadContext): Promise<string> {
  const documentPart = await findDocumentPart(pkg, ctx)
  const stylesPart = await findStylesPart(pkg, documentPart, ctx)
  const styles = stylesPart ? await readStyles(pkg, stylesPart, ctx) : NO_STYLES
  const { limits } = ctx

  const lines: string[] = []
  let outputChars = 0
  const write = (line: string) => {
    outputChars += (lines.length === 0 ? 0 : 1) + line.length
    if (outputChars > ctx.maxChars) refuse('too_complex')
    lines.push(line)
  }
  /** A buffer longer than this can only produce a line longer than the whole text may be. */
  const holdable = (text: string) => {
    if (text.length > ctx.maxChars + 2) refuse('too_complex')
    return text
  }

  const stack: string[] = []
  /** The depth of the element whose subtree is being skipped, or 0. */
  let skipFrom = 0
  const alternates: Array<{ taken: boolean }> = []
  const paragraphs: ParagraphState[] = []
  const runs: RunState[] = []
  const tables: TableState[] = []
  let textRun: { value: string, preserve: boolean } | null = null
  let paragraphCount = 0
  let tableCount = 0
  let cellCount = 0
  /** Cell text already held for the outermost open table. Written out, that table can only be longer. */
  let pendingTableChars = 0

  const countCells = (count: number) => {
    cellCount += count
    if (cellCount > limits.maxTableCellsTotal) refuse('too_complex')
  }

  const finishParagraph = (paragraph: ParagraphState) => {
    const pieces = linesOf(paragraph.text)
    if (pieces.length === 0) return
    const cell = tables.at(-1)?.cell
    if (cell) {
      if (cell.deleted) return
      const value = pieces.join(' / ')
      pendingTableChars += value.length
      if (outputChars + pendingTableChars > ctx.maxChars) refuse('too_complex')
      cell.parts.push(value)
      return
    }
    const level = headingLevelOf(styles, paragraph.styleId ?? styles.defaultParagraphStyle)
    if (level > 0) write(`${'#'.repeat(level)} ${pieces.join(' ')}`)
    else for (const piece of pieces) write(piece)
  }

  const finishTable = (table: TableState) => {
    const parent = tables.at(-1)
    if (parent?.cell) {
      // A nested table stays inside its cell: its rows, one after another.
      if (parent.cell.deleted) return
      const rows = table.rows.map(row => row.filter(Boolean).join(' ; ')).filter(Boolean)
      if (rows.length > 0) parent.cell.parts.push(rows.join(' / '))
      return
    }
    if (tables.length === 0) pendingTableChars = 0
    if (table.rows.length === 0) return
    write('Table:')
    for (const row of table.rows) {
      checkDeadline(ctx)
      write(row.map(escapeCells).join(' | '))
    }
  }

  await pkg.readXml(documentPart, limits.maxDocumentXmlBytes, {
    open(name, attributes) {
      const parent = stack[stack.length - 1]
      const grandparent = stack[stack.length - 2]
      stack.push(name)
      if (skipFrom) return
      if (stack.length === 1) {
        if (name !== 'document') refuse('malformed')
        return
      }
      if (IMPORTED_CONTENT.has(name)) refuse('unsupported')
      if (name === 'del' && parent === 'trPr') {
        const table = tables.at(-1)
        if (table?.row) table.rowDeleted = true
      }
      if (SKIPPED_ELEMENTS.has(name)) {
        skipFrom = stack.length
        return
      }

      switch (name) {
        case 'AlternateContent':
          alternates.push({ taken: false })
          return
        case 'Choice':
        case 'Fallback': {
          // One branch of the alternatives, never two: the first Choice, or the Fallback when there is none.
          const alternate = parent === 'AlternateContent' ? alternates.at(-1) : undefined
          if (!alternate) return
          if (alternate.taken) skipFrom = stack.length
          else alternate.taken = true
          return
        }
        case 'p':
          paragraphCount += 1
          if (paragraphCount > limits.maxParagraphs) refuse('too_complex')
          checkDeadline(ctx)
          paragraphs.push({ text: '', styleId: null })
          return
        case 'pStyle':
          if (parent === 'pPr' && grandparent === 'p') {
            const paragraph = paragraphs.at(-1)
            if (paragraph) paragraph.styleId = attribute(attributes, 'val') ?? null
          }
          return
        case 'r':
          runs.push({ text: '', hidden: undefined, styleId: null })
          return
        case 'rStyle':
          if (parent === 'rPr' && grandparent === 'r') {
            const run = runs.at(-1)
            if (run) run.styleId = attribute(attributes, 'val') ?? null
          }
          return
        case 't':
          if (parent === 'r' && runs.length > 0) textRun = { value: '', preserve: attribute(attributes, 'space') === 'preserve' }
          return
        case 'tab':
        case 'ptab':
        case 'br':
        case 'cr':
        case 'noBreakHyphen': {
          const run = runs.at(-1)
          if (parent !== 'r' || !run) return
          const piece = name === 'br' || name === 'cr' ? '\n' : name === 'noBreakHyphen' ? '-' : ' '
          run.text = holdable(joinText(run.text, piece))
          return
        }
        case 'tbl':
          tableCount += 1
          if (tableCount > limits.maxTables || tables.length + 1 > limits.maxTableNesting) refuse('too_complex')
          tables.push({ rows: [], rowCount: 0, row: null, rowDeleted: false, gridBefore: 0, cell: null })
          return
        case 'tr': {
          const table = tables.at(-1)
          if (!table) return
          table.rowCount += 1
          if (table.rowCount > limits.maxRowsPerTable) refuse('too_complex')
          checkDeadline(ctx)
          table.row = []
          table.rowDeleted = false
          table.gridBefore = 0
          return
        }
        case 'gridBefore': {
          const table = tables.at(-1)
          if (parent === 'trPr' && table?.row) table.gridBefore = spanValue(attribute(attributes, 'val'), 0)
          return
        }
        case 'tc': {
          const table = tables.at(-1)
          if (!table?.row) return
          if (table.rowDeleted) {
            skipFrom = stack.length
            return
          }
          countCells(1)
          if (table.row.length === 0 && table.gridBefore > 0) {
            countCells(table.gridBefore)
            for (let column = 0; column < table.gridBefore; column += 1) table.row.push('')
          }
          table.cell = { parts: [], span: 1, deleted: false }
          return
        }
        case 'gridSpan': {
          const cell = tables.at(-1)?.cell
          if (parent === 'tcPr' && cell) {
            cell.span = spanValue(attribute(attributes, 'val'), 1)
            countCells(cell.span - 1)
          }
          return
        }
        case 'cellDel': {
          const cell = tables.at(-1)?.cell
          if (parent === 'tcPr' && cell) cell.deleted = true
          return
        }
        default:
          if (HIDDEN_PROPERTIES.has(name) && parent === 'rPr' && grandparent === 'r') {
            const run = runs.at(-1)
            if (run) run.hidden = isOn(attribute(attributes, 'val'))
          }
      }
    },

    close(name) {
      const depth = stack.length
      stack.pop()
      if (skipFrom) {
        if (depth === skipFrom) skipFrom = 0
        return
      }
      switch (name) {
        case 'AlternateContent':
          alternates.pop()
          return
        case 't': {
          const run = runs.at(-1)
          if (textRun && run) run.text = holdable(joinText(run.text, textRun.preserve ? textRun.value : textRun.value.trim()))
          textRun = null
          return
        }
        case 'r': {
          const run = runs.pop()
          const paragraph = paragraphs.at(-1)
          if (!run || !paragraph) return
          const hidden = run.hidden
            ?? hiddenByStyle(styles, run.styleId, 'character')
            ?? hiddenByStyle(styles, paragraph.styleId ?? styles.defaultParagraphStyle, 'paragraph')
            ?? styles.defaultHidden
          if (!hidden) paragraph.text = holdable(joinText(paragraph.text, run.text))
          return
        }
        case 'p': {
          const paragraph = paragraphs.pop()
          if (paragraph) finishParagraph(paragraph)
          return
        }
        case 'tc': {
          const table = tables.at(-1)
          const cell = table?.cell
          if (!table?.row || !cell) return
          table.cell = null
          if (cell.deleted) return
          table.row.push(cell.parts.join(' / '))
          for (let column = 1; column < cell.span; column += 1) table.row.push('')
          return
        }
        case 'tr': {
          const table = tables.at(-1)
          if (!table?.row) return
          if (!table.rowDeleted && table.row.some(Boolean)) table.rows.push(table.row)
          table.row = null
          return
        }
        case 'tbl': {
          const table = tables.pop()
          if (table) finishTable(table)
        }
      }
    },

    text(value) {
      if (skipFrom || !textRun) return
      textRun.value += value
      if (textRun.value.length > limits.maxXmlTokenChars) refuse('too_complex')
    },
  })

  if (lines.length === 0) refuse('no_text')
  return lines.join('\n')
}
