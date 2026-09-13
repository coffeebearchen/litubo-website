/**
 * AI-SOURCE-CONTRACT-01 — the shared AI source format contract.
 *
 * One list answers "which files can AI read?" for the server and the browser
 * alike. These tests pin what that list says today, that Media Library storage
 * and AI readability stay two separate facts, that every source failure is
 * worded once and safely, and that no AI code keeps a MIME list of its own
 * beside the contract.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_SOURCE_FORMATS,
  AI_READABLE_FORMATS_LABEL,
  aiSourceFormatFor,
  aiSourceFormatRefusal,
  aiSourceTypeLabel,
  isAiSourceReadableNow,
  sourceFailureMessage,
  type SourceFailureCode,
} from '../utils/aiSourceFormats'
import { extractTextFromFile } from '../server/utils/aiTextExtraction'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const TXT = 'text/plain'
const CSV = 'text/csv'
const TSV = 'text/tab-separated-values'
const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

describe('A. what AI Source Intake can analyze today', () => {
  it.each([TXT, CSV, TSV])('%s is AI-readable', (mime) => {
    expect(isAiSourceReadableNow(mime)).toBe(true)
    expect(aiSourceFormatRefusal(mime)).toBeNull()
  })

  it.each([PDF, DOCX, XLSX, ...IMAGES])('%s is a planned format — listed, but NOT readable yet', (mime) => {
    expect(aiSourceFormatFor(mime)).not.toBeNull()
    expect(isAiSourceReadableNow(mime)).toBe(false)
    expect(aiSourceFormatRefusal(mime)).toBe('not_enabled')
  })

  it.each([
    'application/msword', 'application/vnd.ms-excel', 'video/mp4', 'application/zip',
    'text/html', 'image/gif', 'application/octet-stream', '',
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
    expect(aiSourceFormatRefusal('Application/PDF')).toBe('not_enabled')
  })

  it('exactly one format family is readable, and it is text', () => {
    expect(AI_SOURCE_FORMATS.filter(f => f.aiReadableNow).map(f => f.key)).toEqual(['text'])
  })

  it('the "Supported formats" copy lists exactly the readable formats', () => {
    expect(AI_READABLE_FORMATS_LABEL).toBe('CSV, TSV, TXT')
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
  })

  it('labels a source card for every other format without ever going blank', () => {
    expect(aiSourceTypeLabel(PDF)).toBe('PDF')
    expect(aiSourceTypeLabel(DOCX)).toBe('Word')
    expect(aiSourceTypeLabel(XLSX)).toBe('Excel')
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

  it.each(TABLE)('server extraction and isAiSourceReadableNow agree on %s', async (mime) => {
    const bytes = new TextEncoder().encode('Aperture: 180 mm').buffer as ArrayBuffer
    const result = await extractTextFromFile(bytes, mime, 'Source 1')
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

  it('PDF: the Media Library can store it, AI cannot analyze it yet', () => {
    expect(isAllowedUpload('datasheet.pdf', PDF)).toBe(true)
    expect(aiSourceFormatFor(PDF)?.mediaUploadSupported).toBe(true)
    expect(isAiSourceReadableNow(PDF)).toBe(false)
  })

  it('Images: the Media Library can store them, AI cannot analyze them yet', () => {
    for (const [filename, mime] of [['nameplate.jpg', 'image/jpeg'], ['screenshot.png', 'image/png'], ['photo.webp', 'image/webp']]) {
      expect(isAllowedUpload(filename, mime)).toBe(true)
      expect(isAiSourceReadableNow(mime)).toBe(false)
    }
  })

  it('DOCX and XLSX: still not uploadable, and not analyzable — their own modules change that', () => {
    expect(isAllowedUpload('manual.docx', DOCX)).toBe(false)
    expect(isAllowedUpload('parameters.xlsx', XLSX)).toBe(false)
    expect(isAiSourceReadableNow(DOCX)).toBe(false)
    expect(isAiSourceReadableNow(XLSX)).toBe(false)
  })
})

describe('D. every source failure is worded once, safely', () => {
  const ALL_CODES: SourceFailureCode[] = [
    'not_associated', 'disabled', 'not_enabled', 'unsupported', 'too_large', 'empty', 'unreadable',
    'no_text', 'time_budget_exhausted', 'timeout', 'malformed', 'encrypted', 'too_complex',
    'too_many_pages', 'too_many_sheets', 'too_many_rows', 'too_many_cells', 'too_many_pixels',
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
  ] as const)('%s → "%s"', (code, message) => {
    expect(sourceFailureMessage(code)).toBe(message)
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
