/**
 * AI-DOCX-SOURCE-01 — synthetic TEST ONLY Word documents, built in memory for tests.
 *
 * Nothing outside `tests/` imports this file, and production code never builds
 * ZIP archives. It reuses the workbook helper's ZIP writer and writes just enough
 * WordprocessingML for the production reader to parse, so no binary fixture is
 * committed. A test can replace or add any part, because the point is also to
 * exercise the reader's refusals.
 *
 * Every generated document carries the TEST ONLY mark in its document properties.
 */

import { buildZip, escapeXml, TEST_ONLY_MARK, type ZipEntrySpec } from './testOnlyXlsx'

export { TEST_ONLY_MARK }

export const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const NAMESPACES = `xmlns:w="${NS_W}" xmlns:r="${NS_RELATIONSHIPS}"`
  + ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
  + ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
  + ' xmlns:v="urn:schemas-microsoft-com:vml"'
  + ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const DOCUMENT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** A paragraph style entry for `stylesXml`. */
export function styleXml(id: string, name: string, options: { type?: string, basedOn?: string, hidden?: boolean, isDefault?: boolean } = {}): string {
  const type = options.type ?? 'paragraph'
  return `<w:style w:type="${type}" w:styleId="${escapeXml(id)}"${options.isDefault ? ' w:default="1"' : ''}>`
    + `<w:name w:val="${escapeXml(name)}"/>`
    + (options.basedOn ? `<w:basedOn w:val="${escapeXml(options.basedOn)}"/>` : '')
    + (options.hidden === undefined ? '' : `<w:rPr><w:vanish${options.hidden ? '' : ' w:val="0"'}/></w:rPr>`)
    + '</w:style>'
}

/** Normal plus the built-in headings 1–6, as Word writes them, and any extra style entries. */
export function stylesXml(extra = '', defaults = ''): string {
  return `${XML_HEADER}<w:styles ${NAMESPACES}>`
    + `<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/>${defaults}</w:rPr></w:rPrDefault></w:docDefaults>`
    + styleXml('Normal', 'Normal', { isDefault: true })
    + [1, 2, 3, 4, 5, 6].map(level => styleXml(`Heading${level}`, `heading ${level}`, { basedOn: 'Normal' })).join('')
    + extra
    + '</w:styles>'
}

export function documentXml(body: string): string {
  return `${XML_HEADER}<w:document ${NAMESPACES}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
}

export interface DocxSpec {
  /** The body's inner XML. */
  body?: string
  /** Replaces the whole main document part. */
  documentXml?: string
  /** The styles part; `null` leaves the part and its relationship out. */
  styles?: string | null
  /** Replaces the main document part's content type. */
  documentContentType?: string
  /** Extra `<Relationship/>` elements for the main document part. */
  documentRelationships?: string
  /** Extra `<Override/>` or `<Default/>` elements for [Content_Types].xml. */
  contentTypes?: string
  extraEntries?: ZipEntrySpec[]
  /** Leaves the main document part out while [Content_Types].xml still names it. */
  omitDocumentPart?: boolean
}

/** The package's entries, in the order Word writes them, so a test can alter or reorder them before zipping. */
export function docxEntries(spec: DocxSpec): ZipEntrySpec[] {
  const styles = spec.styles === undefined ? stylesXml() : spec.styles
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + `<Override PartName="/word/document.xml" ContentType="${spec.documentContentType ?? DOCUMENT_CONTENT_TYPE}"/>`
    + (styles === null ? '' : '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>')
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + (spec.contentTypes ?? '')
    + '</Types>'
  const documentRelationships = `${XML_HEADER}<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">`
    + (styles === null ? '' : `<Relationship Id="rIdStyles" Type="${NS_RELATIONSHIPS}/styles" Target="styles.xml"/>`)
    + (spec.documentRelationships ?? '')
    + '</Relationships>'

  return [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: `${XML_HEADER}<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}"><Relationship Id="rId1" Type="${NS_RELATIONSHIPS}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${TEST_ONLY_MARK}</dc:title></cp:coreProperties>` },
    ...(spec.omitDocumentPart ? [] : [{ name: 'word/document.xml', data: spec.documentXml ?? documentXml(spec.body ?? '') }]),
    { name: 'word/_rels/document.xml.rels', data: documentRelationships },
    ...(styles === null ? [] : [{ name: 'word/styles.xml', data: styles }]),
    ...(spec.extraEntries ?? []),
  ]
}

export function buildDocx(spec: DocxSpec): Uint8Array {
  return buildZip(docxEntries(spec))
}

/** A document whose body is these blocks, the shape most tests need. */
export function docx(blocks: string[], spec: Omit<DocxSpec, 'body'> = {}): Uint8Array {
  return buildDocx({ ...spec, body: blocks.join('') })
}

// ── Body builders ────────────────────────────────────────────────────────────

/** One run. `properties` is the inner XML of its `w:rPr`. */
export function run(text: string, properties = ''): string {
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

/** A paragraph of plain text, optionally in a paragraph style. */
export function para(text: string, style?: string): string {
  return paraXml(text ? run(text) : '', style)
}

/** A paragraph from its inner XML (runs, insertions, fields …). */
export function paraXml(inner: string, style?: string): string {
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${escapeXml(style)}"/></w:pPr>` : ''}${inner}</w:p>`
}

export function heading(level: number, text: string): string {
  return para(text, `Heading${level}`)
}

/** A cell from plain text, several paragraphs, or raw inner XML (`{ xml }`). */
export type CellInput = string | string[] | { xml: string, properties?: string }

export function cell(input: CellInput): string {
  if (typeof input === 'object' && !Array.isArray(input)) {
    return `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/>${input.properties ?? ''}</w:tcPr>${input.xml}</w:tc>`
  }
  const paragraphs = (Array.isArray(input) ? input : [input]).map(text => para(text)).join('')
  return `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>${paragraphs}</w:tc>`
}

/** A table; `rowProperties` gives a row its `w:trPr` inner XML. */
export function table(rows: CellInput[][], rowProperties: Record<number, string> = {}): string {
  const body = rows.map((cells, index) => {
    const properties = rowProperties[index] ? `<w:trPr>${rowProperties[index]}</w:trPr>` : ''
    return `<w:tr>${properties}${cells.map(cell).join('')}</w:tr>`
  }).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid/>${body}</w:tbl>`
}
