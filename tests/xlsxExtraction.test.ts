/**
 * AI-XLSX-SOURCE-01 — an .xlsx workbook read into bounded structured text (`xlsxExtraction.ts`).
 *
 * Every workbook is synthetic: built in memory by the TEST ONLY helper, marked
 * TEST ONLY in its document properties, and never uploaded anywhere. Limits are
 * lowered only where a production-sized input would merely be slow; the
 * production values are asserted on their own.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MAX_XLSX_PROCESSING_MS,
  XLSX_LIMITS,
  classifyFormatCode,
  classifyNumberFormat,
  columnLetters,
  excelSerialToText,
  extractXlsxText,
  parseCellRange,
  parseCellReference,
  resolvePartTarget,
  stableNumber,
  type XlsxExtractionOptions,
  type XlsxExtractionResult,
} from '../server/utils/xlsxExtraction'
import {
  TEST_ONLY_MARK,
  WORKBOOK_CONTENT_TYPE,
  buildXlsx,
  buildZip,
  tableXlsx,
  workbookEntries,
  type CellInput,
  type SheetSpec,
  type WorkbookSpec,
} from './helpers/testOnlyXlsx'

const MB = 1024 * 1024
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

const inAMinute = () => Date.now() + 60_000

function extract(bytes: Uint8Array, options: Partial<XlsxExtractionOptions> = {}): Promise<XlsxExtractionResult> {
  return extractXlsxText(bytes, { deadline: inAMinute(), ...options })
}

async function textOf(bytes: Uint8Array, options: Partial<XlsxExtractionOptions> = {}): Promise<string> {
  const result = await extract(bytes, options)
  if (!result.ok) throw new Error(`expected text, got ${result.code}`)
  return result.text
}

async function codeOf(bytes: Uint8Array, options: Partial<XlsxExtractionOptions> = {}): Promise<string> {
  const result = await extract(bytes, options)
  if (result.ok) throw new Error('expected a refusal')
  // A refusal is a code and nothing else: no message, no path, nothing from the file.
  expect(Object.keys(result).sort()).toEqual(['code', 'ok'])
  return result.code
}

const sheetXml = (body: string) => `${XML}<worksheet xmlns="${NS}">${body}</worksheet>`

/** The generated package with one part's XML changed — for structures no real Excel writes. */
function withPart(spec: WorkbookSpec, name: string, change: (xml: string) => string): Uint8Array {
  return buildZip(workbookEntries(spec).map(entry => (entry.name === name ? { ...entry, data: change(String(entry.data)) } : entry)))
}

const SPEC_ROWS: CellInput[][] = [
  ['Model', 'Aperture', 'Voltage', 'Power'],
  ['LT180C', '180 mm', '220 V', '0.45 kW'],
  ['LT200C', '200 mm', '380 V', '0.55 kW'],
  ['LT300C', '300 mm', '380 V', '0.75 kW'],
]

describe('xlsxExtraction — V1 limits', () => {
  it('pins every production limit', () => {
    expect(XLSX_LIMITS).toEqual({
      maxEntries: 1_000,
      maxTotalDecompressedBytes: 64 * MB,
      maxXmlDepth: 128,
      maxXmlTokenChars: MB,
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
    expect(Object.isFrozen(XLSX_LIMITS)).toBe(true)
    expect(MAX_XLSX_PROCESSING_MS).toBe(8_000)
  })

  it('marks every generated workbook TEST ONLY', () => {
    const core = workbookEntries({ sheets: [{ name: 'Specifications', rows: SPEC_ROWS }] }).find(entry => entry.name === 'docProps/core.xml')
    expect(String(core?.data)).toContain(TEST_ONLY_MARK)
  })
})

describe('xlsxExtraction — structured text', () => {
  it('keeps the sheet, the column headers and each row as a row', async () => {
    expect(await textOf(tableXlsx(SPEC_ROWS))).toBe([
      'Sheet: Specifications',
      'Columns: Model | Aperture | Voltage | Power',
      'LT180C | 180 mm | 220 V | 0.45 kW',
      'LT200C | 200 mm | 380 V | 0.55 kW',
      'LT300C | 300 mm | 380 V | 0.75 kW',
    ].join('\n'))
  })

  it('writes each visible sheet as its own block', async () => {
    const bytes = buildXlsx({
      sheets: [
        { name: 'Specifications', rows: [['Model', 'Aperture'], ['LT180C', '180 mm']] },
        { name: 'Options', rows: [['Option', 'Class'], ['Reject bin', 'Standard']] },
      ],
    })
    expect(await textOf(bytes)).toBe([
      'Sheet: Specifications', 'Columns: Model | Aperture', 'LT180C | 180 mm',
      '',
      'Sheet: Options', 'Columns: Option | Class', 'Reject bin | Standard',
    ].join('\n'))
  })

  it('reads shared, rich, inline, boolean and formula-string cells as plain text, leaving phonetic guides out', async () => {
    const bytes = buildXlsx({
      sheets: [{
        name: 'Rich',
        xml: sheetXml('<sheetData>'
          + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
          + '<row r="2"><c r="A2" t="inlineStr"><is><r><t>LT</t></r><r><t>180C</t></r><rPh sb="0" eb="2"><t>ignored reading</t></rPh></is></c>'
          + '<c r="B2" t="b"><v>1</v></c><c r="C2" t="str"><f>A2</f><v>LT180C</v></c></row>'
          + '</sheetData>'),
      }],
      sharedStringsXml: `${XML}<sst xmlns="${NS}" count="2" uniqueCount="2"><si><t>Model</t></si>`
        + '<si><r><rPr><b/></rPr><t>Aper</t></r><r><t xml:space="preserve">ture</t></r><rPh sb="0" eb="4"><t>アパーチャ</t></rPh></si></sst>',
    })
    const text = await textOf(bytes)
    expect(text).toBe('Sheet: Rich\nColumns: Model | Aperture | Column C\nLT180C | TRUE | LT180C')
    expect(text).not.toMatch(/ignored|アパーチャ|rPr|</)
  })

  it('names an empty header cell by its column instead of guessing a meaning', async () => {
    expect(await textOf(tableXlsx([['Model', null, 'Voltage'], ['LT180C', '180 mm', '220 V']])))
      .toBe('Sheet: Specifications\nColumns: Model | Column B | Voltage\nLT180C | 180 mm | 220 V')
  })

  it('keeps a value on one line and escapes a "|" so it cannot fake a column', async () => {
    expect(await textOf(tableXlsx([['Model', 'Note'], ['LT180C', 'Line one\nLine two | not a column']])))
      .toBe('Sheet: Specifications\nColumns: Model | Note\nLT180C | Line one Line two \\| not a column')
  })

  it('skips empty rows and leaves out columns with no value', async () => {
    const bytes = buildXlsx({ sheets: [{ name: 'Sparse rows', rows: [['Model', null, 'Voltage'], [null, null, null], ['LT180C', null, '220 V']] }] })
    expect(await textOf(bytes)).toBe('Sheet: Sparse rows\nColumns: Model | Voltage\nLT180C | 220 V')
  })

  it('keeps Chinese and technical symbols intact', async () => {
    const bytes = tableXlsx([['型号', '工作温度', '电阻', '精度'], ['LT180C', '0–40 °C', '10 Ω', '±0.1 g']], '规格参数')
    expect(await textOf(bytes)).toBe('Sheet: 规格参数\nColumns: 型号 | 工作温度 | 电阻 | 精度\nLT180C | 0–40 °C | 10 Ω | ±0.1 g')
  })

  it('does not depend on the order entries are stored in the archive', async () => {
    const spec: WorkbookSpec = { sheets: [{ name: 'Specifications', rows: SPEC_ROWS }] }
    expect(await textOf(buildZip([...workbookEntries(spec)].reverse()))).toBe(await textOf(buildXlsx(spec)))
  })

  it('handles a sparse sheet whose only far cell is XFD1048576 without allocating a grid', async () => {
    const xml = sheetXml('<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Model</t></is></c></row>'
      + '<row r="1048576"><c r="XFD1048576" t="inlineStr"><is><t>LT180C</t></is></c></row></sheetData>')
    const started = Date.now()
    expect(await textOf(buildXlsx({ sheets: [{ name: 'Sparse', xml }] }))).toBe('Sheet: Sparse\nColumns: Model | Column XFD\n | LT180C')
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it.each([
    ['a cell outside the grid', '<sheetData><row r="1"><c r="XFE1"><v>1</v></c></row></sheetData>'],
    ['a row outside the grid', '<sheetData><row r="1048577"><c r="A1048577"><v>1</v></c></row></sheetData>'],
    ['rows out of order', '<sheetData><row r="2"><c r="A2"><v>1</v></c></row><row r="1"><c r="A1"><v>1</v></c></row></sheetData>'],
    ['a cell in the wrong row', '<sheetData><row r="1"><c r="A2"><v>1</v></c></row></sheetData>'],
    ['a shared string that does not exist', '<sheetData><row r="1"><c r="A1" t="s"><v>99</v></c></row></sheetData>'],
  ])('refuses %s as malformed', async (_label, body) => {
    expect(await codeOf(buildXlsx({ sheets: [{ name: 'Broken', xml: sheetXml(body) }] }))).toBe('malformed')
  })
})

describe('xlsxExtraction — hidden data never leaves the reader', () => {
  it('leaves hidden and very hidden sheets out entirely', async () => {
    const bytes = buildXlsx({
      sheets: [
        { name: 'Specifications', rows: [['Model', 'Aperture'], ['LT180C', '180 mm']] },
        { name: 'Internal Cost', state: 'hidden', rows: [['Item', 'Value'], ['Aperture', '999 mm'], ['Price', 12_345], ['Cost', 6_789]] },
        { name: 'Lookup', state: 'veryHidden', rows: [['Key', 'Value'], ['k1', 'very hidden value']] },
      ],
    })
    const text = await textOf(bytes)
    expect(text).toBe('Sheet: Specifications\nColumns: Model | Aperture\nLT180C | 180 mm')
    expect(text).not.toMatch(/Internal|999|Price|Cost|12345|6789|Lookup|very hidden/)
  })

  it('leaves hidden rows and hidden columns out', async () => {
    const bytes = buildXlsx({
      sheets: [{
        name: 'Specifications',
        rows: [
          ['Model', 'Aperture', 'Internal cost', 'Voltage'],
          ['LT180C', '180 mm', 'secret cost', '220 V'],
          ['LT180C', 'hidden row value', 'x', 'y'],
        ],
        hiddenRows: [3],
        hiddenColumns: [[3, 3]],
      }],
    })
    const text = await textOf(bytes)
    expect(text).toBe('Sheet: Specifications\nColumns: Model | Aperture | Voltage\nLT180C | 180 mm | 220 V')
    expect(text).not.toMatch(/Internal|secret|hidden row/)
  })

  it('treats a zero-height row and a zero-width column as hidden', async () => {
    const xml = sheetXml('<cols><col min="2" max="2" width="0" customWidth="1"/></cols><sheetData>'
      + '<row r="1"><c r="A1" t="inlineStr"><is><t>Model</t></is></c><c r="B1" t="inlineStr"><is><t>Cost</t></is></c></row>'
      + '<row r="2" ht="0" customHeight="1"><c r="A2" t="inlineStr"><is><t>zero-height row</t></is></c></row>'
      + '<row r="3"><c r="A3" t="inlineStr"><is><t>LT180C</t></is></c><c r="B3"><v>999</v></c></row>'
      + '</sheetData>')
    expect(await textOf(buildXlsx({ sheets: [{ name: 'Specifications', xml }] }))).toBe('Sheet: Specifications\nColumns: Model\nLT180C')
  })

  it('writes nothing for a value whose number format hides it (;;;)', async () => {
    const bytes = buildXlsx({
      numberFormats: [{ id: 164, code: ';;;' }],
      cellFormats: [0, 164],
      sheets: [{ name: 'Specifications', rows: [['Model', 'Aperture', 'Cost'], ['LT180C', '180 mm', { value: 999, style: 1 }]] }],
    })
    const text = await textOf(bytes)
    expect(text).toContain('LT180C | 180 mm')
    expect(text).not.toContain('999')
  })
})

describe('xlsxExtraction — formulas', () => {
  it('uses only the cached value: never the formula, an external path, an uncached result or an error', async () => {
    const bytes = tableXlsx([
      ['Parameter', 'Value'],
      ['Power factor', { value: 0.45, formula: 'ROUND(B9*0.9,2)' }],
      ['Linked price', { value: 120, formula: '\'[C:\\private\\pricing.xlsx]Sheet1\'!$A$1' }],
      ['Uncached', { formula: 'SUM(B2:B3)' }],
      ['Broken reference', { value: '#REF!', type: 'e', formula: '#REF!+1' }],
      ['Not available', { value: '#N/A', type: 'str', formula: 'NA()' }],
    ])
    const text = await textOf(bytes)
    expect(text).toContain('Power factor | 0.45')
    expect(text).toContain('Linked price | 120')
    expect(text).not.toMatch(/ROUND|SUM|NA\(\)|C:\\|private|pricing|\.xlsx|#REF!|#N\/A|\[/)
  })
})

describe('xlsxExtraction — numbers', () => {
  const FORMATS = [0, 9, 10, 164, 165, 166, 167, 168, 14, 22, 20, 31, 32, 11]
  const style = (numFmtId: number) => FORMATS.indexOf(numFmtId)

  const numbersWorkbook = () => buildXlsx({
    numberFormats: [
      { id: 164, code: '0" mm"' },
      { id: 165, code: '0.0" kW"' },
      { id: 166, code: '0.0%' },
      { id: 167, code: '[>=1000]#,##0,"K";0' },
      { id: 168, code: 'yyyy"年"m"月"d"日"' },
    ],
    cellFormats: FORMATS,
    sheets: [{
      name: 'Numbers',
      rows: [
        ['Case', 'Value'],
        ['float noise', { value: '0.45000000000000001', type: 'n' }],
        ['float sum', { value: '0.30000000000000004', type: 'n' }],
        ['negative zero', { value: '-0', type: 'n' }],
        ['percent', { value: 0.45, style: style(9) }],
        ['percent decimals', { value: 0.456, style: style(10) }],
        ['unit mm', { value: 180, style: style(164) }],
        ['unit kW', { value: 0.5, style: style(165) }],
        ['custom percent', { value: 0.456, style: style(166) }],
        ['conditional format', { value: 1500, style: style(167) }],
        ['CJK date format', { value: 45_000, style: style(168) }],
        ['date', { value: 45_000, style: style(14) }],
        ['date and time', { value: 45_000.5, style: style(22) }],
        ['time', { value: 0.75, style: style(20) }],
        ['East Asian built-in date', { value: 45_000, style: style(31) }],
        ['East Asian built-in time', { value: 0.5, style: style(32) }],
        ['scientific', { value: 12_345, style: style(11) }],
        ['general is not a date', 45_000],
      ],
    }],
  })

  it('writes stable numbers, explicit percentages, simple units and unambiguous dates — and the raw value otherwise', async () => {
    expect(await textOf(numbersWorkbook())).toBe([
      'Sheet: Numbers',
      'Columns: Case | Value',
      'float noise | 0.45',
      'float sum | 0.3',
      'negative zero | 0',
      'percent | 45%',
      'percent decimals | 45.6%',
      'unit mm | 180 mm',
      'unit kW | 0.5 kW',
      'custom percent | 45.6%',
      'conditional format | 1500',
      'CJK date format | 2023-03-15',
      'date | 2023-03-15',
      'date and time | 2023-03-15 12:00:00',
      'time | 18:00:00',
      'East Asian built-in date | 2023-03-15',
      'East Asian built-in time | 12:00:00',
      'scientific | 12345',
      'general is not a date | 45000',
    ].join('\n'))
  })

  it('reads dates in the 1904 date system', async () => {
    const bytes = buildXlsx({
      date1904: true,
      cellFormats: [0, 14],
      sheets: [{ name: 'Dates', rows: [['Case', 'Value'], ['epoch', { value: 0, style: 1 }], ['day', { value: 43_538, style: 1 }]] }],
    })
    expect(await textOf(bytes)).toBe('Sheet: Dates\nColumns: Case | Value\nepoch | 1904-01-01\nday | 2023-03-15')
  })

  it.each([
    [45_000, false, 'date', '2023-03-15'],
    [1, false, 'date', '1900-01-01'],
    [59, false, 'date', '1900-02-28'],
    [60, false, 'date', null],
    [61, false, 'date', '1900-03-01'],
    [0, false, 'date', null],
    [2_958_465, false, 'date', '9999-12-31'],
    [2_958_466, false, 'date', null],
    [-1, false, 'date', null],
    [0, true, 'date', '1904-01-01'],
    [43_538, true, 'date', '2023-03-15'],
    [45_000.5, false, 'both', '2023-03-15 12:00:00'],
    [0.75, false, 'time', '18:00:00'],
    [0.999_999_999, false, 'time', '00:00:00'],
  ] as const)('serial %s (1904: %s, %s) → %s', (serial, date1904, parts, expected) => {
    const wanted = { date: parts !== 'time', time: parts !== 'date' }
    expect(excelSerialToText(serial, date1904, wanted)).toBe(expected)
  })

  it.each([
    [';;;', 'hidden'], [';;', 'hidden'], [';;;@', 'hidden'],
    ['', 'general'], ['General', 'general'], ['@', 'general'],
    ['0%', 'percent'], ['0.00%', 'percent'], ['#,##0.0%', 'percent'], ['[Red]0.0%', 'percent'], ['0.0%;[Red]-0.0%', 'percent'],
    ['0" mm"', 'unit: mm'], ['#,##0.00" kW"', 'unit: kW'], ['0"℃"', 'unit:℃'],
    ['0.00E+00', 'general'], ['# ?/?', 'general'], ['"$"#,##0', 'general'], ['0,"K"', 'general'], ['[>=1000]0', 'general'],
    ['yyyy-mm-dd', 'date'], ['yyyy"年"m"月"d"日"', 'date'], ['[$-804]yyyy/m/d', 'date'],
    ['h:mm AM/PM', 'time'], ['上午/下午h"时"mm"分"', 'time'], ['yyyy-mm-dd hh:mm:ss', 'date+time'],
    ['[h]:mm:ss', 'general'], ['mm:ss.0', 'general'], ['m', 'general'],
  ])('format code %j is %s', (code, expected) => {
    const kind = classifyFormatCode(code)
    const described = kind.kind === 'unit'
      ? `unit:${kind.suffix}`
      : kind.kind === 'datetime'
        ? [kind.date && 'date', kind.time && 'time'].filter(Boolean).join('+')
        : kind.kind
    expect(described).toBe(expected)
  })

  it('knows the built-in formats by id and lets a workbook-defined code override one', () => {
    expect(classifyNumberFormat(9, undefined)).toEqual({ kind: 'percent' })
    expect(classifyNumberFormat(14, undefined)).toEqual({ kind: 'datetime', date: true, time: false })
    expect(classifyNumberFormat(57, undefined)).toEqual({ kind: 'localeDatetime' })
    expect(classifyNumberFormat(0, undefined)).toEqual({ kind: 'general' })
    expect(classifyNumberFormat(14, '0.0%')).toEqual({ kind: 'percent' })
    expect(stableNumber(0.1 + 0.2)).toBe('0.3')
    expect(stableNumber(-0)).toBe('0')
  })
})

describe('xlsxExtraction — cell references and part targets', () => {
  it('parses references inside the Excel grid only', () => {
    expect(parseCellReference('A1')).toEqual({ row: 1, column: 1 })
    expect(parseCellReference('XFD1048576')).toEqual({ row: 1_048_576, column: 16_384 })
    for (const reference of ['XFE1', 'A0', 'A1048577', 'a1', '$A$1', '']) expect(parseCellReference(reference)).toBeNull()
    expect(parseCellRange('B2:A1')).toEqual({ top: 1, left: 1, bottom: 2, right: 2 })
    expect(parseCellRange('C3')).toEqual({ top: 3, left: 3, bottom: 3, right: 3 })
    expect(parseCellRange('A1:B2:C3')).toBeNull()
    expect([1, 26, 27, 16_384].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'XFD'])
  })

  it('resolves a relationship target inside the package and never above it', () => {
    expect(resolvePartTarget('xl', 'worksheets/sheet1.xml')).toBe('xl/worksheets/sheet1.xml')
    expect(resolvePartTarget('xl', '/xl/worksheets/sheet1.xml')).toBe('xl/worksheets/sheet1.xml')
    expect(resolvePartTarget('xl/worksheets', '../sharedStrings.xml')).toBe('xl/sharedStrings.xml')
    expect(resolvePartTarget('xl', '../../evil.xml')).toBeNull()
    expect(resolvePartTarget('xl', '')).toBeNull()
  })
})

describe('xlsxExtraction — merged cells', () => {
  const MERGED_ROWS: CellInput[][] = [
    ['Model', 'Parameter', 'Value'],
    ['LT180C', 'Aperture', '180 mm'],
    [null, 'Voltage', '220 V'],
    ['LT200C', 'Aperture', '200 mm'],
    [null, 'Voltage', '380 V'],
  ]

  it('gives every row a vertically merged model cell covers that model — from the merge, not from the row above', async () => {
    const bytes = buildXlsx({ sheets: [{ name: 'Specifications', rows: MERGED_ROWS, merges: ['A2:A3', 'A4:A5'] }] })
    expect(await textOf(bytes)).toBe([
      'Sheet: Specifications',
      'Columns: Model | Parameter | Value',
      'LT180C | Aperture | 180 mm',
      'LT180C | Voltage | 220 V',
      'LT200C | Aperture | 200 mm',
      'LT200C | Voltage | 380 V',
    ].join('\n'))
    expect(await textOf(bytes, { productCode: 'LT-180C' })).toBe([
      'Sheet: Specifications',
      'Filtered to exact product code: LT-180C',
      'Columns: Model | Parameter | Value',
      'LT180C | Aperture | 180 mm',
      'LT180C | Voltage | 220 V',
    ].join('\n'))
  })

  it('never hands a blank model cell to the row above without a merge', async () => {
    const text = await textOf(buildXlsx({ sheets: [{ name: 'Specifications', rows: MERGED_ROWS }] }), { productCode: 'LT-180C' })
    expect(text).toBe('Sheet: Specifications\nFiltered to exact product code: LT-180C\nColumns: Model | Parameter | Value\nLT180C | Aperture | 180 mm')
    expect(text).not.toContain('220 V')
  })

  it('writes a merged header under every column it covers', async () => {
    const bytes = buildXlsx({ sheets: [{ name: 'Specifications', rows: [['Model', 'Size', null], ['LT180C', 180, 200]], merges: ['B1:C1'] }] })
    expect(await textOf(bytes)).toBe('Sheet: Specifications\nColumns: Model | Size | Size\nLT180C | 180 | 200')
  })

  it('accepts a merge of 10,000 cells and refuses one of 10,001', async () => {
    const rows: CellInput[][] = [['Model', 'Note'], ['LT180C', 'ok']]
    expect((await extract(buildXlsx({ sheets: [{ name: 'S', rows, merges: ['C1:CX100'] }] }))).ok).toBe(true)
    expect(await codeOf(buildXlsx({ sheets: [{ name: 'S', rows, merges: ['C1:BW137'] }] }))).toBe('too_complex')
  })

  it('accepts 1,000 merged ranges and refuses 1,001', async () => {
    const rows: CellInput[][] = [['Model', 'Note'], ['LT180C', 'ok']]
    const merges = (count: number) => Array.from({ length: count }, (_, index) => `D${index + 1}:E${index + 1}`)
    expect((await extract(buildXlsx({ sheets: [{ name: 'S', rows, merges: merges(1_000) }] }))).ok).toBe(true)
    expect(await codeOf(buildXlsx({ sheets: [{ name: 'S', rows, merges: merges(1_001) }] }))).toBe('too_complex')
  })
})

describe('xlsxExtraction — exact product-code narrowing', () => {
  it('keeps only the header and the exact model row of a row-oriented multi-model sheet', async () => {
    const text = await textOf(tableXlsx(SPEC_ROWS), { productCode: 'LT-180C' })
    expect(text).toBe([
      'Sheet: Specifications',
      'Filtered to exact product code: LT-180C',
      'Columns: Model | Aperture | Voltage | Power',
      'LT180C | 180 mm | 220 V | 0.45 kW',
    ].join('\n'))
    expect(text).not.toMatch(/200 mm|300 mm|0\.55|0\.75|LT200C|LT300C/)
  })

  it('matches the code however the sheet spaces or punctuates it', async () => {
    const rows: CellInput[][] = [['Model', 'Row'], ['LT180C', 'a'], ['LT-180C', 'b'], ['LT 180 C', 'c'], ['LT_180_C', 'd'], ['LT200C', 'other']]
    const text = await textOf(tableXlsx(rows), { productCode: 'LT180C' })
    expect(text.split('\n').slice(3)).toEqual(['LT180C | a', 'LT-180C | b', 'LT 180 C | c', 'LT_180_C | d'])
  })

  it('never takes a similar code for the product\'s own', async () => {
    const rows: CellInput[][] = [['Model', 'Row'], ['LT180', 'a'], ['LT180C-S', 'b'], ['LT180D', 'c'], ['XLT180C', 'd'], ['LT180C', 'exact']]
    const text = await textOf(tableXlsx(rows), { productCode: 'LT180C' })
    expect(text.split('\n').slice(3)).toEqual(['LT180C | exact'])
  })

  it('finds the code in a cell that names several models', async () => {
    const rows: CellInput[][] = [['Model', 'Frame'], ['LT180C / LT200C', 'Shared frame'], ['LT300C', 'Other frame']]
    expect((await textOf(tableXlsx(rows), { productCode: 'LT-180C' })).split('\n').slice(3)).toEqual(['LT180C / LT200C | Shared frame'])
  })

  it('keeps the label column and the product\'s column of a column-oriented sheet', async () => {
    const rows: CellInput[][] = [['Parameter', 'LT180C', 'LT200C'], ['Aperture', 180, 200], ['Voltage', 220, 380]]
    const text = await textOf(tableXlsx(rows), { productCode: 'LT180C' })
    expect(text).toBe('Sheet: Specifications\nFiltered to exact product code: LT180C\nColumns: Parameter | LT180C\nAperture | 180\nVoltage | 220')
    expect(text).not.toMatch(/LT200C|200|380/)
  })

  it('does not narrow a sheet by a title cell that has no label column to its left', async () => {
    const rows: CellInput[][] = [['LT180C'], ['Parameter', 'Value'], ['Aperture', '180 mm']]
    const text = await textOf(tableXlsx(rows), { productCode: 'LT180C' })
    expect(text).toBe('Sheet: Specifications\nColumns: LT180C | Column B\nParameter | Value\nAperture | 180 mm')
  })

  it('keeps the whole sheet when the product\'s column holds no value', async () => {
    const rows: CellInput[][] = [['Parameter', 'LT180C', 'LT200C'], ['Aperture', null, 200]]
    expect(await textOf(tableXlsx(rows), { productCode: 'LT180C' })).toBe('Sheet: Specifications\nColumns: Parameter | LT180C | LT200C\nAperture |  | 200')
  })

  it('does not narrow at all without a product code', async () => {
    const full = await textOf(tableXlsx(SPEC_ROWS))
    for (const productCode of [null, undefined, '', '   ']) {
      expect(await textOf(tableXlsx(SPEC_ROWS), { productCode })).toBe(full)
    }
  })

  it('keeps a sheet that never names the code whole — it is not "no relevant rows"', async () => {
    const rows: CellInput[][] = [['Parameter', 'Value'], ['Aperture', '180 mm']]
    expect(await textOf(tableXlsx(rows), { productCode: 'LT-180C' })).toBe('Sheet: Specifications\nColumns: Parameter | Value\nAperture | 180 mm')
  })

  it('does not narrow by a code without both a letter and a digit, which could equal an ordinary value', async () => {
    const rows: CellInput[][] = [['Model', 'Aperture'], ['LT180C', 'x'], ['LT200C', 180]]
    expect(await textOf(tableXlsx(rows), { productCode: '180' })).toBe('Sheet: Specifications\nColumns: Model | Aperture\nLT180C | x\nLT200C | 180')
  })

  it('can bring a large multi-model sheet within the character limit', async () => {
    const rows: CellInput[][] = [['Model', 'Description']]
    for (let index = 0; index < 300; index += 1) rows.push([`LT${200 + index}C`, `Other model ${'x'.repeat(80)}`])
    rows.push(['LT180C', 'This product'])
    expect(await codeOf(tableXlsx(rows))).toBe('too_complex')
    expect(await textOf(tableXlsx(rows), { productCode: 'LT-180C' }))
      .toBe('Sheet: Specifications\nFiltered to exact product code: LT-180C\nColumns: Model | Description\nLT180C | This product')
  })

  it('refuses a workbook still over 20,000 characters after narrowing, instead of cutting it', async () => {
    const rows: CellInput[][] = [['Model', 'Description']]
    for (let index = 0; index < 300; index += 1) rows.push(['LT180C', `Configuration ${index} ${'x'.repeat(80)}`])
    expect(await codeOf(tableXlsx(rows), { productCode: 'LT-180C' })).toBe('too_complex')
  })
})

describe('xlsxExtraction — no relevant rows', () => {
  it('reports a workbook whose visible sheets have a header and no data row', async () => {
    expect(await codeOf(tableXlsx([['Model', 'Aperture']]))).toBe('no_relevant_rows')
    expect(await codeOf(buildXlsx({ sheets: [{ name: 'Empty', rows: [] }] }))).toBe('no_relevant_rows')
    const onlyHiddenData = buildXlsx({
      sheets: [{ name: 'Visible', rows: [['Model']] }, { name: 'Hidden', state: 'hidden', rows: [['Model'], ['LT180C']] }],
    })
    expect(await codeOf(onlyHiddenData)).toBe('no_relevant_rows')
  })
})

describe('xlsxExtraction — sheet, row, column and cell limits', () => {
  const sheets = (visible: number, hidden = 0): SheetSpec[] => [
    ...Array.from({ length: visible }, (_, index) => ({ name: `Visible ${index + 1}`, rows: [['Model'], [`LT${index}C`]] })),
    ...Array.from({ length: hidden }, (_, index) => ({ name: `Hidden ${index + 1}`, state: 'hidden' as const, rows: [['x'], ['y']] })),
  ]

  it('reads 10 visible sheets and refuses 11 rather than reading the first 10', async () => {
    expect((await extract(buildXlsx({ sheets: sheets(10) }))).ok).toBe(true)
    expect(await codeOf(buildXlsx({ sheets: sheets(11) }))).toBe('too_many_sheets')
  })

  it('accepts 50 sheets in a workbook and refuses 51, hidden ones included', async () => {
    expect((await extract(buildXlsx({ sheets: sheets(1, 49) }))).ok).toBe(true)
    expect(await codeOf(buildXlsx({ sheets: sheets(1, 50) }))).toBe('too_many_sheets')
  })

  it('reads 5,000 rows in a sheet and refuses 5,001, through the real parser', async () => {
    const rows = (count: number): CellInput[][] => Array.from({ length: count }, (_, index) => [`Row ${index}`, index])
    const roomy = { limits: { maxOutputChars: 10_000_000, maxOutputCells: 10_000_000 } }
    expect((await extract(tableXlsx(rows(5_000)), roomy)).ok).toBe(true)
    expect(await codeOf(tableXlsx(rows(5_001)), roomy)).toBe('too_many_rows')
  })

  it('counts rows across sheets, and counts hidden rows too', async () => {
    const two = (first: number, second: number) => buildXlsx({
      sheets: [
        { name: 'A', rows: Array.from({ length: first }, (_, index) => [`a${index}`]) },
        { name: 'B', rows: Array.from({ length: second }, (_, index) => [`b${index}`]) },
      ],
    })
    expect((await extract(two(3, 2), { limits: { maxRowsTotal: 5 } })).ok).toBe(true)
    expect(await codeOf(two(3, 3), { limits: { maxRowsTotal: 5 } })).toBe('too_many_rows')
    const withHidden = buildXlsx({ sheets: [{ name: 'A', rows: [['Model'], ['a'], ['b'], ['hidden']], hiddenRows: [4] }] })
    expect(await codeOf(withHidden, { limits: { maxRowsPerSheet: 3 } })).toBe('too_many_rows')
  })

  it('reads 100 used columns and refuses 101', async () => {
    const table = (width: number): CellInput[][] => [
      Array.from({ length: width }, (_, index) => `H${index + 1}`),
      Array.from({ length: width }, (_, index) => index),
    ]
    expect((await extract(tableXlsx(table(100)))).ok).toBe(true)
    expect(await codeOf(tableXlsx(table(101)))).toBe('too_many_cells')
  })

  it('counts every non-empty cell scanned — hidden ones included — and refuses past the limit', async () => {
    const bytes = buildXlsx({ sheets: [{ name: 'S', rows: [['A', 'B', 'C', 'D'], ['1', '2', '3', '4']], hiddenColumns: [[4, 4]] }] })
    expect((await extract(bytes, { limits: { maxNonEmptyCellsScanned: 8 } })).ok).toBe(true)
    expect(await codeOf(bytes, { limits: { maxNonEmptyCellsScanned: 7 } })).toBe('too_many_cells')
  })

  it('refuses more output cells than the limit', async () => {
    const bytes = tableXlsx([['A', 'B', 'C'], ['1', '2', '3']])
    expect((await extract(bytes, { limits: { maxOutputCells: 6 } })).ok).toBe(true)
    expect(await codeOf(bytes, { limits: { maxOutputCells: 5 } })).toBe('too_many_cells')
  })

  it('keeps a 500-character cell and refuses a 501-character one instead of cutting it', async () => {
    expect((await extract(tableXlsx([['Model', 'Note'], ['LT180C', 'n'.repeat(500)]]))).ok).toBe(true)
    expect(await codeOf(tableXlsx([['Model', 'Note'], ['LT180C', 'n'.repeat(501)]]))).toBe('too_complex')
  })

  it('accepts text of exactly the character limit and refuses one character more', async () => {
    const bytes = buildXlsx({ sheets: [{ name: 'One', rows: [['A', 'B'], ['1', '2']] }, { name: 'Two', rows: [['C'], ['3']] }] })
    const text = await textOf(bytes)
    expect(await textOf(bytes, { maxChars: text.length })).toBe(text)
    expect(await codeOf(bytes, { maxChars: text.length - 1 })).toBe('too_complex')
  })

  it('fails the whole workbook when one visible sheet is over a limit, but never reads a hidden one', async () => {
    const big: SheetSpec = { name: 'Big', rows: [['Model'], ['a'], ['b'], ['c']] }
    const small: SheetSpec = { name: 'Small', rows: [['Model'], ['LT180C']] }
    expect(await codeOf(buildXlsx({ sheets: [small, big] }), { limits: { maxRowsPerSheet: 3 } })).toBe('too_many_rows')
    expect((await extract(buildXlsx({ sheets: [small, { ...big, state: 'hidden' }] }), { limits: { maxRowsPerSheet: 3 } })).ok).toBe(true)
  })
})

describe('xlsxExtraction — shared strings and actual XML size', () => {
  it('refuses more shared strings, or more shared-string characters, than the limit', async () => {
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxSharedStrings: 3 } })).toBe('too_complex')
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxSharedStringChars: 10 } })).toBe('too_complex')
  })

  it('refuses a shared strings part, a worksheet or a package whose actual inflated XML is over its limit', async () => {
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxSharedStringsXmlBytes: 200 } })).toBe('too_complex')
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxWorksheetXmlBytes: 200 } })).toBe('too_complex')
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxTotalDecompressedBytes: 600 } })).toBe('too_complex')
  })

  it('refuses a file over 10 MB before reading any of it', async () => {
    expect(await codeOf(new Uint8Array(10 * MB + 1))).toBe('too_large')
    expect(await codeOf(new Uint8Array(10 * MB))).toBe('malformed')
    expect(await codeOf(tableXlsx(SPEC_ROWS), { limits: { maxBytes: 100 } })).toBe('too_large')
  })
})

describe('xlsxExtraction — deadline', () => {
  it('refuses to start once the deadline has passed', async () => {
    expect(await codeOf(tableXlsx(SPEC_ROWS), { deadline: Date.now() - 1 })).toBe('timeout')
  })

  it('checks the deadline while rows are written, not only once reading is done', async () => {
    const bytes = tableXlsx(SPEC_ROWS)
    let calls = 0
    await textOf(bytes, {
      deadline: 1_000,
      now: () => {
        calls += 1
        return 0
      },
    })
    let seen = 0
    // The clock passes the deadline only at its very last reading: the check for the last row.
    expect(await codeOf(bytes, { deadline: 1_000, now: () => (++seen >= calls ? 2_000 : 0) })).toBe('timeout')
  })
})

describe('xlsxExtraction — package refusals', () => {
  const spec: WorkbookSpec = { sheets: [{ name: 'Specifications', rows: SPEC_ROWS }] }

  it.each([
    ['a macro-enabled workbook', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml'],
    ['a template', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml'],
    ['a macro-enabled template', 'application/vnd.ms-excel.template.macroEnabled.main+xml'],
    ['an add-in', 'application/vnd.ms-excel.addin.macroEnabled.main+xml'],
  ])('refuses %s disguised as .xlsx as unsupported', async (_label, contentType) => {
    expect(await codeOf(buildXlsx({ ...spec, workbookContentType: contentType }))).toBe('unsupported')
  })

  it('refuses a package with a VBA project or binary workbook content as unsupported, without reading it', async () => {
    const withDefault = (contentType: string) => withPart(spec, '[Content_Types].xml', xml =>
      xml.replace('</Types>', `<Default Extension="bin" ContentType="${contentType}"/></Types>`))
    expect(await codeOf(withDefault('application/vnd.ms-office.vbaProject'))).toBe('unsupported')
    expect(await codeOf(withDefault('application/vnd.ms-excel.sheet.binary.macroEnabled.main'))).toBe('unsupported')
  })

  it('refuses a workbook with an Excel 4.0 macro sheet as unsupported', async () => {
    const bytes = withPart(spec, 'xl/_rels/workbook.xml.rels', xml => xml.replace('</Relationships>',
      '<Relationship Id="rId99" Type="http://schemas.microsoft.com/office/2006/relationships/xlMacrosheet" Target="macrosheets/sheet1.xml"/></Relationships>'))
    expect(await codeOf(bytes)).toBe('unsupported')
  })

  it('reports an OLE compound file (an encrypted workbook) as encrypted', async () => {
    const compoundFile = new Uint8Array(4_096)
    compoundFile.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
    expect(await codeOf(compoundFile)).toBe('encrypted')
  })

  it('refuses a ZIP that is not a workbook, and a workbook whose structure is broken, as malformed', async () => {
    expect(await codeOf(buildZip([{ name: 'readme.txt', data: TEST_ONLY_MARK }]))).toBe('malformed')
    expect(await codeOf(buildZip(workbookEntries(spec).filter(entry => entry.name !== 'xl/workbook.xml')))).toBe('malformed')
    expect(await codeOf(withPart(spec, '[Content_Types].xml', xml =>
      xml.replace('</Types>', `<Override PartName="/xl/workbook2.xml" ContentType="${WORKBOOK_CONTENT_TYPE}"/></Types>`)))).toBe('malformed')
    expect(await codeOf(withPart(spec, 'xl/_rels/workbook.xml.rels', xml => xml.replace('Id="rId2"', 'Id="rId1"')))).toBe('malformed')
  })

  it('refuses a duplicate workbook part and a traversal entry name as malformed', async () => {
    expect(await codeOf(buildXlsx({ ...spec, extraEntries: [{ name: 'xl/workbook.xml', data: `${XML}<workbook/>` }] }))).toBe('malformed')
    expect(await codeOf(buildXlsx({ ...spec, extraEntries: [{ name: '../evil.xml', data: '<a/>' }] }))).toBe('malformed')
  })

  it('never follows a relationship out of the package or to an external target', async () => {
    const retarget = (target: string) => withPart(spec, 'xl/_rels/workbook.xml.rels', xml =>
      xml.replace('Target="worksheets/sheet1.xml"', target))
    expect(await codeOf(retarget('Target="../../worksheets/sheet1.xml"'))).toBe('malformed')
    expect(await codeOf(retarget('Target="https://example.invalid/sheet1.xml" TargetMode="External"'))).toBe('malformed')
  })

  it('refuses a worksheet with a DOCTYPE as malformed, without expanding its entities', async () => {
    const xml = `${XML}<!DOCTYPE worksheet [<!ENTITY cost "999 mm">]><worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&cost;</t></is></c></row></sheetData></worksheet>`
    expect(await codeOf(buildXlsx({ sheets: [{ name: 'S', xml }] }))).toBe('malformed')
  })

  it('skips a visible chart sheet, which holds no cells', async () => {
    const two: WorkbookSpec = { sheets: [{ name: 'Specifications', rows: SPEC_ROWS }, { name: 'Chart', rows: [['ignored']] }] }
    const bytes = withPart(two, 'xl/_rels/workbook.xml.rels', xml =>
      xml.replace('relationships/worksheet" Target="worksheets/sheet2.xml"', 'relationships/chartsheet" Target="worksheets/sheet2.xml"'))
    expect(await textOf(bytes)).toBe(await textOf(tableXlsx(SPEC_ROWS)))
  })
})

describe('xlsxExtraction — source boundaries', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('builds on the bounded package reader and the exact-match rule, and nothing else', () => {
    const imports = [...read('server/utils/xlsxExtraction.ts').matchAll(/from '([^']+)'/g)].map(match => match[1])
    expect([...new Set(imports)].sort()).toEqual(['./ooxmlReader', './productCodeMatch'])
  })

  it('never loads a workbook through SheetJS, ExcelJS, a DOM parser or dynamic code', () => {
    for (const path of ['server/utils/xlsxExtraction.ts', 'server/utils/ooxmlReader.ts', 'server/utils/aiTextExtraction.ts']) {
      expect(read(path)).not.toMatch(/from '(?:xlsx|exceljs)'|require\('(?:xlsx|exceljs)'\)|DOMParser|\beval\(|new Function|child_process|writeFile/)
    }
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
    for (const name of ['xlsx', 'exceljs', 'yazl', 'archiver']) {
      expect(pkg.dependencies?.[name]).toBeUndefined()
      expect(pkg.devDependencies?.[name]).toBeUndefined()
    }
  })

  it('keeps the TEST ONLY workbook builder out of every production directory', () => {
    const offenders: string[] = []
    for (const directory of ['server', 'utils', 'components', 'pages', 'composables', 'layouts', 'middleware', 'plugins', 'types']) {
      let names: string[]
      try {
        names = readdirSync(resolve(process.cwd(), directory), { recursive: true }) as string[]
      }
      catch {
        continue
      }
      for (const name of names.filter(entry => /\.(?:ts|vue|mjs|js)$/.test(entry))) {
        const path = join(directory, name)
        if (/testOnlyXlsx|tests\/helpers/.test(read(path))) offenders.push(path)
      }
    }
    expect(offenders).toEqual([])
  })
})
