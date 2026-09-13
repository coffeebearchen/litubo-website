/**
 * AI-XLSX-SOURCE-01 — synthetic TEST ONLY workbooks, built in memory for tests.
 *
 * Nothing outside `tests/` imports this file, and production code never builds
 * ZIP archives. It writes a minimal ZIP container (stored or deflated entries, a
 * correct central directory) and just enough SpreadsheetML for the production
 * reader to parse, so no binary fixture is committed. It can also write archives
 * no real Excel would — duplicate names, traversal names, false sizes, an
 * encryption flag — because the point is to exercise the reader's refusals.
 *
 * Every generated workbook carries the TEST ONLY mark in its document properties.
 */

import { crc32, deflateRawSync } from 'node:zlib'

export const TEST_ONLY_MARK = 'TEST ONLY — NOT FOR PUBLICATION'

export interface ZipEntrySpec {
  name: string
  data: string | Uint8Array
  /** Deflated unless `store` is asked for. */
  method?: 'deflate' | 'store'
  /** Writes this uncompressed size into both headers instead of the real one. */
  declaredSize?: number
  /** Sets the encryption flag without encrypting anything. */
  encryptedFlag?: boolean
}

export function buildZip(entries: readonly ZipEntrySpec[]): Uint8Array {
  const parts: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : Buffer.from(entry.data)
    const method = entry.method === 'store' ? 0 : 8
    const body = method === 8 ? deflateRawSync(data) : data
    const size = entry.declaredSize ?? data.length
    const flags = 0x0800 | (entry.encryptedFlag ? 0x0001 : 0)
    const checksum = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034B50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, name, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014B50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, name)

    offset += local.length + name.length + body.length
  }
  const centralDirectory = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...parts, centralDirectory, end]))
}

export type CellType = 's' | 'n' | 'str' | 'inlineStr' | 'b' | 'e' | 'd'

export interface CellSpec {
  value?: string | number | boolean
  type?: CellType
  formula?: string
  style?: number
}

export type CellInput = string | number | boolean | null | CellSpec

export interface SheetSpec {
  name: string
  state?: 'visible' | 'hidden' | 'veryHidden'
  /** Row by row, from `startRow`; `null` leaves a cell empty. */
  rows?: CellInput[][]
  startRow?: number
  hiddenRows?: number[]
  /** Inclusive column ranges, 1-based. */
  hiddenColumns?: Array<[number, number]>
  merges?: string[]
  /** Replaces the generated worksheet XML entirely. */
  xml?: string
}

export interface WorkbookSpec {
  sheets: SheetSpec[]
  date1904?: boolean
  /** Custom number formats (by convention `id` ≥ 164). */
  numberFormats?: Array<{ id: number, code: string }>
  /** The `numFmtId` of each cell style index. Style 0 is General unless set. */
  cellFormats?: number[]
  /** Text as inline strings instead of shared strings. */
  inlineStrings?: boolean
  /** Replaces the workbook part's content type. */
  workbookContentType?: string
  /** Replaces the generated shared strings part. */
  sharedStringsXml?: string
  extraEntries?: ZipEntrySpec[]
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const WORKBOOK_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function columnName(column: number): string {
  let name = ''
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26)) name = String.fromCharCode(65 + ((rest - 1) % 26)) + name
  return name
}

class SharedStrings {
  private readonly index = new Map<string, number>()
  readonly values: string[] = []

  indexOf(value: string): number {
    let position = this.index.get(value)
    if (position === undefined) {
      position = this.values.length
      this.index.set(value, position)
      this.values.push(value)
    }
    return position
  }

  xml(): string {
    const items = this.values.map(value => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join('')
    return `${XML_HEADER}<sst xmlns="${NS_MAIN}" count="${this.values.length}" uniqueCount="${this.values.length}">${items}</sst>`
  }
}

function cellXml(reference: string, input: CellInput, strings: SharedStrings, inline: boolean): string {
  if (input === null) return ''
  const spec: CellSpec = typeof input === 'object' ? input : { value: input }
  const style = spec.style ? ` s="${spec.style}"` : ''
  const formula = spec.formula === undefined ? '' : `<f>${escapeXml(spec.formula)}</f>`
  if (spec.value === undefined) return `<c r="${reference}"${style}>${formula}</c>`
  const type = spec.type ?? (typeof spec.value === 'number' ? 'n' : typeof spec.value === 'boolean' ? 'b' : inline ? 'inlineStr' : 's')
  switch (type) {
    case 'n':
      return `<c r="${reference}"${style}>${formula}<v>${spec.value}</v></c>`
    case 'b':
      return `<c r="${reference}"${style} t="b">${formula}<v>${spec.value === true ? 1 : 0}</v></c>`
    case 's':
      return `<c r="${reference}"${style} t="s">${formula}<v>${strings.indexOf(String(spec.value))}</v></c>`
    case 'inlineStr':
      return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(spec.value))}</t></is></c>`
    default:
      return `<c r="${reference}"${style} t="${type}">${formula}<v>${escapeXml(String(spec.value))}</v></c>`
  }
}

export function worksheetXml(sheet: SheetSpec, strings = new SharedStrings(), inline = false): string {
  if (sheet.xml !== undefined) return sheet.xml
  const columns = (sheet.hiddenColumns ?? [])
    .map(([min, max]) => `<col min="${min}" max="${max}" width="9" hidden="1" customWidth="1"/>`)
    .join('')
  const start = sheet.startRow ?? 1
  const rows = (sheet.rows ?? []).map((cells, offset) => {
    const index = start + offset
    const hidden = sheet.hiddenRows?.includes(index) ? ' hidden="1"' : ''
    const body = cells.map((input, column) => cellXml(`${columnName(column + 1)}${index}`, input, strings, inline)).join('')
    return `<row r="${index}"${hidden}>${body}</row>`
  }).join('')
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(reference => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>`
    : ''
  return `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">${columns ? `<cols>${columns}</cols>` : ''}<sheetData>${rows}</sheetData>${merges}</worksheet>`
}

function stylesXml(spec: WorkbookSpec): string {
  const numberFormats = spec.numberFormats ?? []
  const formats = numberFormats.length
    ? `<numFmts count="${numberFormats.length}">${numberFormats.map(f => `<numFmt numFmtId="${f.id}" formatCode="${escapeXml(f.code)}"/>`).join('')}</numFmts>`
    : ''
  const cellFormats = spec.cellFormats?.length ? spec.cellFormats : [0]
  return `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}">${formats}`
    + '<fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>'
    // A cell *style* format that says "percent" must not leak into cell formats.
    + '<cellStyleXfs count="1"><xf numFmtId="9"/></cellStyleXfs>'
    + `<cellXfs count="${cellFormats.length}">${cellFormats.map(id => `<xf numFmtId="${id}" applyNumberFormat="1"/>`).join('')}</cellXfs>`
    + '</styleSheet>'
}

/** The package's entries, in the order Excel writes them, so a test can alter or reorder them before zipping. */
export function workbookEntries(spec: WorkbookSpec): ZipEntrySpec[] {
  const strings = new SharedStrings()
  const inline = spec.inlineStrings === true
  const sheets = spec.sheets.map((sheet, index) => ({ sheet, part: `worksheets/sheet${index + 1}.xml`, id: `rId${index + 1}` }))
  const sheetParts = sheets.map(({ sheet, part }) => ({ name: `xl/${part}`, data: worksheetXml(sheet, strings, inline) }))
  const sharedStringsId = `rId${sheets.length + 1}`
  const stylesId = `rId${sheets.length + 2}`

  const workbook = `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">`
    + (spec.date1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>')
    + `<sheets>${sheets.map(({ sheet, id }, index) =>
      `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}"${sheet.state && sheet.state !== 'visible' ? ` state="${sheet.state}"` : ''} r:id="${id}"/>`).join('')}</sheets>`
    + '</workbook>'
  const workbookRelationships = `${XML_HEADER}<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">`
    + sheets.map(({ part, id }) => `<Relationship Id="${id}" Type="${NS_RELATIONSHIPS}/worksheet" Target="${part}"/>`).join('')
    + `<Relationship Id="${sharedStringsId}" Type="${NS_RELATIONSHIPS}/sharedStrings" Target="sharedStrings.xml"/>`
    + `<Relationship Id="${stylesId}" Type="${NS_RELATIONSHIPS}/styles" Target="styles.xml"/>`
    + '</Relationships>'
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + `<Override PartName="/xl/workbook.xml" ContentType="${spec.workbookContentType ?? WORKBOOK_CONTENT_TYPE}"/>`
    + sheets.map(({ part }) => `<Override PartName="/xl/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '</Types>'

  return [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: `${XML_HEADER}<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${NS_RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${TEST_ONLY_MARK}</dc:title></cp:coreProperties>` },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelationships },
    ...sheetParts,
    { name: 'xl/sharedStrings.xml', data: spec.sharedStringsXml ?? strings.xml() },
    { name: 'xl/styles.xml', data: stylesXml(spec) },
    ...(spec.extraEntries ?? []),
  ]
}

export function buildXlsx(spec: WorkbookSpec): Uint8Array {
  return buildZip(workbookEntries(spec))
}

/** A one-sheet workbook from a plain table, the shape most tests need. */
export function tableXlsx(rows: CellInput[][], name = 'Specifications'): Uint8Array {
  return buildXlsx({ sheets: [{ name, rows }] })
}
