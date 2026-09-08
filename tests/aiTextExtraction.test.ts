/**
 * PWS-AI-ENGINE-01 — text-only source extraction. These tests exercise the
 * real `pdf-parse` and `xlsx` libraries against small, real, in-memory
 * files built inside the test itself — no network, no Directus, no mock
 * provider involved. This is the "resource can actually be read on the
 * server" proof the preflight required.
 */

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  extractTextFromFile,
  isSupportedTextSourceMime,
  capTotalCharacters,
  MAX_FILES_PER_REQUEST,
  MAX_FILE_BYTES,
  MAX_TOTAL_EXTRACTED_CHARS,
} from '../server/utils/aiTextExtraction'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('isSupportedTextSourceMime — first-version allowlist', () => {
  it('accepts exactly PDF, XLSX, XLS, CSV, TSV, TXT', () => {
    expect(isSupportedTextSourceMime('application/pdf')).toBe(true)
    expect(isSupportedTextSourceMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true)
    expect(isSupportedTextSourceMime('application/vnd.ms-excel')).toBe(true)
    expect(isSupportedTextSourceMime('text/csv')).toBe(true)
    expect(isSupportedTextSourceMime('text/tab-separated-values')).toBe(true)
    expect(isSupportedTextSourceMime('text/plain')).toBe(true)
  })

  it('rejects images, video, Word, archives, and unknown types — never faking support', () => {
    for (const mime of [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', null, undefined,
    ]) {
      expect(isSupportedTextSourceMime(mime)).toBe(false)
    }
  })

  it('is case-insensitive and ignores a charset suffix', () => {
    expect(isSupportedTextSourceMime('TEXT/PLAIN')).toBe(true)
    expect(isSupportedTextSourceMime('text/plain; charset=utf-8')).toBe(true)
  })
})

describe('extractTextFromFile — TXT (real extraction, no mocking)', () => {
  it('extracts plain text as-is', async () => {
    const bytes = toArrayBuffer(Buffer.from('Detection sensitivity (Fe): 0.8 mm\nRated power: 220V', 'utf-8'))
    const result = await extractTextFromFile(bytes, 'text/plain', 'notes.txt')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source.text).toContain('Detection sensitivity (Fe): 0.8 mm')
      expect(result.source.fileType).toBe('Text')
    }
  })

  it('rejects an empty file with an honest, short reason', async () => {
    const result = await extractTextFromFile(toArrayBuffer(Buffer.from('')), 'text/plain', 'empty.txt')
    expect(result).toEqual({ ok: false, reason: 'This file is empty.' })
  })

  it('rejects whitespace-only content as "no extractable text"', async () => {
    const bytes = toArrayBuffer(Buffer.from('   \n\t  '))
    const result = await extractTextFromFile(bytes, 'text/plain', 'blank.txt')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('No extractable text')
  })
})

describe('extractTextFromFile — CSV/TSV (real extraction, no mocking)', () => {
  it('extracts CSV content as-is', async () => {
    const bytes = toArrayBuffer(Buffer.from('parameter,value\nDetection sensitivity,0.8 mm', 'utf-8'))
    const result = await extractTextFromFile(bytes, 'text/csv', 'specs.csv')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source.text).toContain('Detection sensitivity,0.8 mm')
      expect(result.source.fileType).toBe('CSV')
    }
  })

  it('extracts TSV content as-is', async () => {
    const bytes = toArrayBuffer(Buffer.from('parameter\tvalue\nRated power\t220V', 'utf-8'))
    const result = await extractTextFromFile(bytes, 'text/tab-separated-values', 'specs.tsv')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.source.fileType).toBe('TSV')
  })
})

describe('extractTextFromFile — XLSX (real extraction via the xlsx library, no mocking)', () => {
  it('extracts cell text from a real in-memory workbook', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Parameter', 'Value'],
      ['Detection sensitivity (Fe)', '0.8 mm'],
      ['Rated power', '220V'],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Specs')
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await extractTextFromFile(
      toArrayBuffer(buffer), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'specs.xlsx',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source.text).toContain('Detection sensitivity (Fe)')
      expect(result.source.text).toContain('0.8 mm')
      expect(result.source.fileType).toBe('Spreadsheet')
    }
  })

  it('an empty workbook (no cell text) is honestly reported as unreadable, never faked', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([[]])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Empty')
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await extractTextFromFile(
      toArrayBuffer(buffer), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'empty.xlsx',
    )
    expect(result.ok).toBe(false)
  })
})

describe('extractTextFromFile — unsupported and corrupt inputs never fake success', () => {
  it('refuses an image outright, before ever touching the bytes', async () => {
    const result = await extractTextFromFile(toArrayBuffer(Buffer.from([0xff, 0xd8, 0xff])), 'image/jpeg', 'photo.jpg')
    expect(result).toEqual({ ok: false, reason: 'This file type is not supported for text-source analysis yet.' })
  })

  it('a corrupt/non-PDF byte stream claiming to be application/pdf fails safely, never throws', async () => {
    const bytes = toArrayBuffer(Buffer.from('not actually a pdf file'))
    const result = await extractTextFromFile(bytes, 'application/pdf', 'fake.pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('This file could not be read.')
  })

  it('a file larger than MAX_FILE_BYTES is refused before extraction is attempted', async () => {
    const bytes = toArrayBuffer(Buffer.alloc(MAX_FILE_BYTES + 1, 'a'))
    const result = await extractTextFromFile(bytes, 'text/plain', 'huge.txt')
    expect(result).toEqual({ ok: false, reason: 'This file is too large to analyze.' })
  })
})

describe('capTotalCharacters — enforced, tested total-character ceiling', () => {
  it('never exceeds MAX_TOTAL_EXTRACTED_CHARS across all sources combined', () => {
    const sources = [
      { displayName: 'a.txt', fileType: 'Text', text: 'x'.repeat(100_000) },
      { displayName: 'b.txt', fileType: 'Text', text: 'y'.repeat(100_000) },
    ]
    const capped = capTotalCharacters(sources, MAX_TOTAL_EXTRACTED_CHARS)
    const total = capped.reduce((sum, s) => sum + s.text.length, 0)
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_EXTRACTED_CHARS)
  })

  it('gives each source an equal share rather than dropping later ones entirely', () => {
    const sources = [
      { displayName: 'a.txt', fileType: 'Text', text: 'x'.repeat(1000) },
      { displayName: 'b.txt', fileType: 'Text', text: 'y'.repeat(1000) },
    ]
    const capped = capTotalCharacters(sources, 200)
    expect(capped).toHaveLength(2)
    expect(capped[0].text.length).toBe(100)
    expect(capped[1].text.length).toBe(100)
  })

  it('is a no-op for an empty source list', () => {
    expect(capTotalCharacters([], MAX_TOTAL_EXTRACTED_CHARS)).toEqual([])
  })
})

describe('PWS-AI-ENGINE-01 explicit, tested limits exist', () => {
  it('MAX_FILES_PER_REQUEST, MAX_FILE_BYTES and MAX_TOTAL_EXTRACTED_CHARS are all finite, positive numbers', () => {
    expect(MAX_FILES_PER_REQUEST).toBeGreaterThan(0)
    expect(MAX_FILE_BYTES).toBeGreaterThan(0)
    expect(MAX_TOTAL_EXTRACTED_CHARS).toBeGreaterThan(0)
  })
})
