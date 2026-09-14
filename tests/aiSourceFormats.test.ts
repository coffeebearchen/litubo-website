/**
 * AI-SOURCE-CONTRACT-01 — the shared AI source format contract.
 *
 * One list answers "which files can AI read?" for the server and the browser
 * alike. These tests pin what that list says today, that Media Library storage
 * and AI readability stay two separate facts, that every source failure is
 * worded once and safely, and that no AI code keeps a MIME list of its own
 * beside the contract.
 *
 * AI-XLSX-SOURCE-01 — standard .xlsx workbooks joined the readable formats once
 * their bounded reader passed its own tests.
 *
 * AI-DOCX-SOURCE-01 — standard .docx documents joined them the same way.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_SOURCE_FORMATS,
  AI_READABLE_FORMATS_LABEL,
  MEDIA_ONLY_FORMATS_LABEL,
  aiSourceFormatFor,
  aiSourceFormatRefusal,
  aiSourceTypeLabel,
  isAiSourceReadableNow,
  sourceFailureMessage,
  type SourceFailureCode,
} from '../utils/aiSourceFormats'
import { extractTextFromFile } from '../server/utils/aiTextExtraction'
import { tableXlsx } from './helpers/testOnlyXlsx'
import { docx, para } from './helpers/testOnlyDocx'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const TXT = 'text/plain'
const CSV = 'text/csv'
const TSV = 'text/tab-separated-values'
const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

describe('A. what AI Source Intake can analyze today', () => {
  it.each([TXT, CSV, TSV, PDF, XLSX, DOCX])('%s is AI-readable', (mime) => {
    expect(isAiSourceReadableNow(mime)).toBe(true)
    expect(aiSourceFormatRefusal(mime)).toBeNull()
  })

  it.each(IMAGES)('%s is a planned format — listed, but NOT readable yet', (mime) => {
    expect(aiSourceFormatFor(mime)).not.toBeNull()
    expect(isAiSourceReadableNow(mime)).toBe(false)
    expect(aiSourceFormatRefusal(mime)).toBe('not_enabled')
  })

  it.each([
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-excel.sheet.macroenabled.12', 'video/mp4',
    'application/vnd.ms-word.document.macroenabled.12', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/zip', 'text/html', 'image/gif', 'application/octet-stream', '',
  ])('%s is outside the contract, so it is simply unsupported', (mime) => {
    expect(aiSourceFormatFor(mime)).toBeNull()
    expect(isAiSourceReadableNow(mime)).toBe(false)
    expect(aiSourceFormatRefusal(mime)).toBe('unsupported')
  })

  it('a missing content type is never readable', () => {
    expect(isAiSourceReadableNow(null)).toBe(false)
    expect(isAiSourceReadableNow(undefined)).toBe(false)
    expect(aiSourceFormatRefusal(null)).toBe('unsupported')
  })

  it('ignores letter case and a charset parameter, the way stored content types arrive', () => {
    expect(isAiSourceReadableNow('TEXT/PLAIN')).toBe(true)
    expect(isAiSourceReadableNow('text/csv; charset=utf-8')).toBe(true)
    expect(isAiSourceReadableNow(XLSX.toUpperCase())).toBe(true)
    expect(aiSourceFormatRefusal('Application/PDF')).toBeNull()
    expect(aiSourceFormatRefusal('IMAGE/PNG')).toBe('not_enabled')
  })

  /** AI-PDF-SOURCE-01, AI-XLSX-SOURCE-01 and AI-DOCX-SOURCE-01 — each format joined text once its own reader passed acceptance. No other format has. */
  it('exactly four format families are readable: text, text-layer PDF, .docx documents and .xlsx workbooks', () => {
    expect(AI_SOURCE_FORMATS.filter(f => f.aiReadableNow).map(f => f.key)).toEqual(['text', 'pdf', 'docx', 'xlsx'])
  })

  it('the "Supported formats" copy lists exactly the readable formats', () => {
    expect(AI_READABLE_FORMATS_LABEL).toBe('CSV, DOCX, PDF, TSV, TXT, XLSX')
  })

  it('the "can be linked, but not analyzed" copy lists exactly the stored-but-unreadable formats', () => {
    expect(MEDIA_ONLY_FORMATS_LABEL).toBe('JPG, PNG, WebP')
  })
})

describe('the contract itself', () => {
  it('lists the five V1 format families, every MIME type exactly once and stored normalized', () => {
    expect(AI_SOURCE_FORMATS.map(f => f.key)).toEqual(['text', 'pdf', 'docx', 'xlsx', 'image'])
    const mimes = AI_SOURCE_FORMATS.flatMap(f => f.types.map(t => t.mime))
    expect(new Set(mimes).size).toBe(mimes.length)
    for (const mime of mimes) expect(mime).toBe(mime.toLowerCase().split(';')[0].trim())
  })

  it('gives every format a positive size contract', () => {
    for (const format of AI_SOURCE_FORMATS) expect(format.maxBytes, format.key).toBeGreaterThan(0)
  })

  it('keeps the file types a readable source is named by in the prompt exactly as they were', () => {
    expect(aiSourceTypeLabel(TXT)).toBe('Text')
    expect(aiSourceTypeLabel(CSV)).toBe('CSV')
    expect(aiSourceTypeLabel(TSV)).toBe('TSV')
    expect(aiSourceTypeLabel(PDF)).toBe('PDF')
    expect(aiSourceTypeLabel(XLSX)).toBe('Spreadsheet')
    expect(aiSourceTypeLabel(DOCX)).toBe('Word')
  })

  it('labels a source card for every other format without ever going blank', () => {
    expect(aiSourceTypeLabel('image/png')).toBe('Image')
    expect(aiSourceTypeLabel('image/gif')).toBe('Image')
    expect(aiSourceTypeLabel('video/mp4')).toBe('Video')
    expect(aiSourceTypeLabel('application/zip')).toBe('File')
    expect(aiSourceTypeLabel(null)).toBe('Unknown')
  })
})

describe('B. the server reads exactly what the shared contract marks readable', () => {
  const TABLE: Array<string | null> = [
    TXT, CSV, TSV, 'TEXT/CSV', 'text/plain; charset=utf-8',
    PDF, DOCX, XLSX, ...IMAGES,
    'application/vnd.ms-excel', 'application/msword', 'text/html', null,
  ]

  /** A PDF is read through the document-extractor's reader, so the table gives it a PDF header and a stand-in reader. */
  const PDF_READER = { pdf: async () => ({ ok: true as const, text: 'Aperture: 180 mm' }) }

  /** Real content for each format: a PDF header for a PDF, a TEST ONLY workbook or document for .xlsx and .docx, plain text otherwise. */
  const contentFor = (mime: string | null): ArrayBuffer => {
    const key = aiSourceFormatFor(mime)?.key
    const bytes = key === 'xlsx'
      ? tableXlsx([['Parameter', 'Value'], ['Aperture', '180 mm']])
      : key === 'docx'
        ? docx([para('Aperture: 180 mm')])
        : new TextEncoder().encode(key === 'pdf' ? '%PDF-1.7\nAperture: 180 mm' : 'Aperture: 180 mm')
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }

  it.each(TABLE)('server extraction and isAiSourceReadableNow agree on %s', async (mime) => {
    const result = await extractTextFromFile(contentFor(mime), mime, 'Source 1', { readers: PDF_READER })
    expect(result.ok).toBe(isAiSourceReadableNow(mime))
  })

  /**
   * The drift this module removes: a MIME list in the engine, another beside it,
   * a browser mirror of both, and a picker badge. None of the AI files may grow
   * one back — every format decision goes through the contract.
   */
  it('no AI file keeps a MIME list of its own beside the contract', () => {
    const AI_FILES = [
      'server/utils/aiTextExtraction.ts',
      'server/utils/aiProposalEngine.ts',
      'server/api/admin/products/[id]/ai/sources.get.ts',
      'utils/aiProposal.ts',
      'components/admin/workspace/WorkspaceAiSourceIntake.vue',
      'components/admin/workspace/WorkspaceAiProposalReview.vue',
      'components/admin/workspace/WorkspaceMediaResources.vue',
    ]
    for (const file of AI_FILES) {
      const code = repoFile(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/['"`](?:text|application|image|video)\/[\w.+-]+/)
    }
  })
})

describe('C. Media Library storage and AI readability are separate facts', () => {
  /**
   * The real upload rule, not a restatement of it. The handler module calls
   * `defineEventHandler` at module scope, a Nitro auto-import vitest does not
   * provide, so that one global is stubbed before the import.
   */
  let isAllowedUpload: (filename: string, contentType: string) => boolean

  beforeAll(async () => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    isAllowedUpload = (await import('../server/api/admin/media/upload.post')).isAllowedUpload
  })

  const SAMPLE_FILENAME: Record<string, string> = {
    [TXT]: 'specs.txt',
    [CSV]: 'specs.csv',
    [TSV]: 'specs.tsv',
    [PDF]: 'datasheet.pdf',
    [DOCX]: 'manual.docx',
    [XLSX]: 'parameters.xlsx',
    'image/jpeg': 'nameplate.jpg',
    'image/jpg': 'nameplate.jpg',
    'image/png': 'screenshot.png',
    'image/webp': 'photo.webp',
  }

  it('every MIME type in the contract has a sample here, so none can skip the upload check', () => {
    for (const format of AI_SOURCE_FORMATS) {
      for (const type of format.types) expect(SAMPLE_FILENAME[type.mime], type.mime).toBeDefined()
    }
  })

  it.each(AI_SOURCE_FORMATS.flatMap(f => f.types.map(t => [t.mime, f.mediaUploadSupported] as const)))(
    '%s — mediaUploadSupported matches the real upload rule',
    (mime, supported) => {
      expect(isAllowedUpload(SAMPLE_FILENAME[mime], mime)).toBe(supported)
    },
  )

  it('PDF: the Media Library stores it, and AI Source Intake can analyze it (AI-PDF-SOURCE-01)', () => {
    expect(isAllowedUpload('datasheet.pdf', PDF)).toBe(true)
    expect(aiSourceFormatFor(PDF)?.mediaUploadSupported).toBe(true)
    expect(isAiSourceReadableNow(PDF)).toBe(true)
    expect(aiSourceFormatFor(PDF)?.maxBytes).toBe(20 * 1024 * 1024)
  })

  it('XLSX: the Media Library stores it, and AI Source Intake can analyze it (AI-XLSX-SOURCE-01)', () => {
    expect(isAllowedUpload('parameters.xlsx', XLSX)).toBe(true)
    expect(aiSourceFormatFor(XLSX)?.mediaUploadSupported).toBe(true)
    expect(isAiSourceReadableNow(XLSX)).toBe(true)
    expect(aiSourceFormatFor(XLSX)?.maxBytes).toBe(10 * 1024 * 1024)
  })

  it('Images: the Media Library can store them, AI cannot analyze them yet', () => {
    for (const [filename, mime] of [['nameplate.jpg', 'image/jpeg'], ['screenshot.png', 'image/png'], ['photo.webp', 'image/webp']]) {
      expect(isAllowedUpload(filename, mime)).toBe(true)
      expect(isAiSourceReadableNow(mime)).toBe(false)
    }
  })

  it('DOCX: the Media Library stores it, and AI Source Intake can analyze it (AI-DOCX-SOURCE-01)', () => {
    expect(isAllowedUpload('manual.docx', DOCX)).toBe(true)
    expect(aiSourceFormatFor(DOCX)?.mediaUploadSupported).toBe(true)
    expect(isAiSourceReadableNow(DOCX)).toBe(true)
    expect(aiSourceFormatFor(DOCX)?.maxBytes).toBe(10 * 1024 * 1024)
  })

  it('legacy .doc, macro-enabled .docm and the .dotx / .dotm templates are neither stored nor analyzed', () => {
    expect(isAllowedUpload('manual.doc', 'application/msword')).toBe(false)
    expect(isAllowedUpload('macro.docm', 'application/vnd.ms-word.document.macroEnabled.12')).toBe(false)
    expect(isAllowedUpload('template.dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template')).toBe(false)
    expect(isAllowedUpload('template.dotm', 'application/vnd.ms-word.template.macroEnabled.12')).toBe(false)
    expect(aiSourceFormatFor('application/msword')).toBeNull()
    expect(aiSourceFormatFor('application/vnd.ms-word.document.macroEnabled.12')).toBeNull()
  })

  it('legacy .xls and macro-enabled .xlsm are neither stored nor analyzed', () => {
    expect(isAllowedUpload('sheet.xls', 'application/vnd.ms-excel')).toBe(false)
    expect(isAllowedUpload('macro.xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12')).toBe(false)
    expect(aiSourceFormatFor('application/vnd.ms-excel')).toBeNull()
    expect(aiSourceFormatFor('application/vnd.ms-excel.sheet.macroEnabled.12')).toBeNull()
  })
})

describe('D. every source failure is worded once, safely', () => {
  const ALL_CODES: SourceFailureCode[] = [
    'not_associated', 'disabled', 'not_enabled', 'unsupported', 'too_large', 'empty', 'unreadable',
    'no_text', 'time_budget_exhausted', 'timeout', 'malformed', 'encrypted', 'too_complex',
    'too_many_pages', 'too_many_sheets', 'too_many_rows', 'too_many_cells', 'no_relevant_rows', 'too_many_pixels',
    'unavailable', 'ocr_unavailable', 'busy', 'unsafe_parse',
  ]

  it.each([
    ['empty', 'This file is empty.'],
    ['too_large', 'This file is too large to analyze, or its size could not be confirmed.'],
    ['unsupported', 'This file type is not supported for source analysis.'],
    ['no_text', 'No extractable text was found in this file.'],
    ['unreadable', 'This file could not be read.'],
    ['timeout', 'This file took too long to read and was stopped.'],
    ['time_budget_exhausted', 'Not read: the time limit for reading sources was reached.'],
    ['not_associated', 'One of the selected files could not be used for this product.'],
    ['too_complex', 'This file is too complex to analyze safely. Save the relevant part as a smaller file.'],
    ['too_many_sheets', 'This workbook has too many sheets to analyze.'],
    ['too_many_rows', 'This spreadsheet has too many rows to analyze. Save the relevant sheet as a smaller file.'],
    ['too_many_cells', 'This spreadsheet has too many cells to analyze.'],
    ['no_relevant_rows', 'No data rows were found in this spreadsheet.'],
  ] as const)('%s → "%s"', (code, message) => {
    expect(sourceFailureMessage(code)).toBe(message)
  })

  it('no_text for a PDF names the likely cause — a scan — while every other format keeps the generic sentence', () => {
    expect(sourceFailureMessage('no_text', PDF)).toBe('No extractable text was found in this PDF. Scanned PDFs are not supported yet.')
    expect(sourceFailureMessage('no_text', TXT)).toBe('No extractable text was found in this file.')
    expect(sourceFailureMessage('no_text')).toBe('No extractable text was found in this file.')
  })

  it.each([
    [PDF, 'PDF is not supported for source analysis yet.'],
    [DOCX, 'Word documents are not supported for source analysis yet.'],
    [XLSX, 'Excel files are not supported for source analysis yet.'],
    ['image/png', 'Images are not supported for source analysis yet.'],
  ])('not_enabled names the format of %s', (mime, message) => {
    expect(sourceFailureMessage('not_enabled', mime)).toBe(message)
  })

  it('not_enabled with no planned format to name falls back to the generic sentence', () => {
    expect(sourceFailureMessage('not_enabled', 'video/mp4')).toBe(sourceFailureMessage('unsupported'))
    expect(sourceFailureMessage('not_enabled')).toBe(sourceFailureMessage('unsupported'))
  })

  it.each(ALL_CODES)('%s is a fixed English sentence that carries nothing internal', (code) => {
    const message = sourceFailureMessage(code, PDF)
    expect(message.trim().length).toBeGreaterThan(0)
    expect(message).toBe(sourceFailureMessage(code, PDF))
    // No URL, path, UUID, credential, stack or process detail…
    expect(message).not.toMatch(/https?:|www\.|[a-z]:[\\/]|\/(?:var|tmp|app|usr|home|directus)\b|\\|[0-9a-f]{8}-[0-9a-f]{4}-|token|secret|stack|stderr|exit code|errno|ENOENT|Error:/i)
    // …and English-first.
    expect(message).not.toMatch(/[一-鿿]/)
  })
})

describe('E. a PDF is never refused with the Excel sentence', () => {
  it('the PDF refusal names PDF, and only PDF', () => {
    const message = sourceFailureMessage('not_enabled', PDF)
    expect(message).toContain('PDF')
    expect(message).not.toContain('Excel')
  })
})
