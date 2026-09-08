/**
 * PWS-AI-ENGINE-01R — text-only source extraction. These tests exercise the
 * real `unpdf` library against a real, freshly-generated, minimal PDF with
 * genuinely extractable text (not just a corrupt-input negative test) — no
 * network, no Directus, no mock provider involved. This is the "resource
 * can actually be read on the server" proof the preflight required, and the
 * exact library/approach that was separately verified not to crash this
 * project's real Windows `nuxt dev` server (see this task's final report).
 */

import { describe, it, expect } from 'vitest'
import {
  extractTextFromFile,
  isSupportedTextSourceMime,
  isFormerlyUnsupportedTextSourceMime,
  isFileSizeSafeToDownload,
  capTotalCharacters,
  MAX_FILES_PER_REQUEST,
  MAX_FILE_BYTES,
  MAX_TOTAL_EXTRACTED_CHARS,
  MAX_PER_FILE_CHARS,
  MAX_PDF_PAGES,
  MAX_PROCESSING_MS,
} from '../server/utils/aiTextExtraction'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

/** A minimal, real, valid single-page PDF (PDF 1.4, no compression) containing genuinely extractable text — built by hand, not borrowed from a fixture file, so this test has no hidden external dependency. */
function buildRealTestPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 712 Td (${text}) Tj ET`
  const objects: string[] = []
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n')
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  objects.push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

describe('isSupportedTextSourceMime — first-version allowlist', () => {
  it('accepts exactly PDF, CSV, TSV, TXT', () => {
    expect(isSupportedTextSourceMime('application/pdf')).toBe(true)
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

describe('isFormerlyUnsupportedTextSourceMime — XLS/XLSX honestly dropped, not lumped in with "never supported"', () => {
  it('flags exactly the two Excel MIME types', () => {
    expect(isFormerlyUnsupportedTextSourceMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true)
    expect(isFormerlyUnsupportedTextSourceMime('application/vnd.ms-excel')).toBe(true)
    expect(isFormerlyUnsupportedTextSourceMime('application/pdf')).toBe(false)
    expect(isFormerlyUnsupportedTextSourceMime('image/jpeg')).toBe(false)
  })

  it('extractTextFromFile gives Excel a distinct reason from a generically unsupported type', async () => {
    const bytes = toArrayBuffer(Buffer.from('not a real xlsx'))
    const excelResult = await extractTextFromFile(bytes, 'application/vnd.ms-excel', 'sheet.xls')
    const imageResult = await extractTextFromFile(bytes, 'image/jpeg', 'photo.jpg')
    expect(excelResult).toEqual({ ok: false, reason: 'Excel files are not supported for text-source analysis yet.' })
    expect(imageResult).toEqual({ ok: false, reason: 'This file type is not supported for text-source analysis yet.' })
    expect(excelResult).not.toEqual(imageResult)
  })
})

describe('isFileSizeSafeToDownload — trusted-metadata pre-check, before any download', () => {
  it('accepts a known size at or under the limit', () => {
    expect(isFileSizeSafeToDownload(1000)).toBe(true)
    expect(isFileSizeSafeToDownload(MAX_FILE_BYTES)).toBe(true)
  })

  it('rejects a known size over the limit', () => {
    expect(isFileSizeSafeToDownload(MAX_FILE_BYTES + 1)).toBe(false)
  })

  it('rejects conservatively when size is unknown — never assumes small', () => {
    expect(isFileSizeSafeToDownload(null)).toBe(false)
    expect(isFileSizeSafeToDownload(undefined)).toBe(false)
    expect(isFileSizeSafeToDownload(Number.NaN)).toBe(false)
    expect(isFileSizeSafeToDownload(-1)).toBe(false)
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

describe('extractTextFromFile — PDF (real extraction via unpdf against a real, valid PDF, no mocking)', () => {
  it('extracts genuine text from a real single-page PDF', async () => {
    const pdfBuffer = buildRealTestPdf('Detection sensitivity \\(Fe\\): 0.8 mm')
    const result = await extractTextFromFile(toArrayBuffer(pdfBuffer), 'application/pdf', 'datasheet.pdf')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source.text).toContain('Detection sensitivity (Fe): 0.8 mm')
      expect(result.source.fileType).toBe('PDF')
    }
  })

  it('a corrupt/non-PDF byte stream claiming to be application/pdf fails safely, never throws', async () => {
    const bytes = toArrayBuffer(Buffer.from('not actually a pdf file'))
    const result = await extractTextFromFile(bytes, 'application/pdf', 'fake.pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('This file could not be read.')
  })
})

describe('extractTextFromFile — unsupported and oversized inputs never fake success', () => {
  it('refuses an image outright, before ever touching the bytes', async () => {
    const result = await extractTextFromFile(toArrayBuffer(Buffer.from([0xff, 0xd8, 0xff])), 'image/jpeg', 'photo.jpg')
    expect(result).toEqual({ ok: false, reason: 'This file type is not supported for text-source analysis yet.' })
  })

  it('a file larger than MAX_FILE_BYTES is refused before extraction is attempted', async () => {
    const bytes = toArrayBuffer(Buffer.alloc(MAX_FILE_BYTES + 1, 'a'))
    const result = await extractTextFromFile(bytes, 'text/plain', 'huge.txt')
    expect(result).toEqual({ ok: false, reason: 'This file is too large to analyze.' })
  })
})

describe('extractTextFromFile — per-file character cap is enforced during extraction', () => {
  it('a TXT file longer than MAX_PER_FILE_CHARS is capped, never returned in full', async () => {
    const longText = 'x'.repeat(MAX_PER_FILE_CHARS + 5000)
    const bytes = toArrayBuffer(Buffer.from(longText, 'utf-8'))
    const result = await extractTextFromFile(bytes, 'text/plain', 'long.txt')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.source.text.length).toBeLessThanOrEqual(MAX_PER_FILE_CHARS)
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

describe('PWS-AI-ENGINE-01R explicit, tested limits exist', () => {
  it('all limits are finite, positive numbers', () => {
    expect(MAX_FILES_PER_REQUEST).toBeGreaterThan(0)
    expect(MAX_FILE_BYTES).toBeGreaterThan(0)
    expect(MAX_TOTAL_EXTRACTED_CHARS).toBeGreaterThan(0)
    expect(MAX_PER_FILE_CHARS).toBeGreaterThan(0)
    expect(MAX_PDF_PAGES).toBeGreaterThan(0)
    expect(MAX_PROCESSING_MS).toBeGreaterThan(0)
  })
})
