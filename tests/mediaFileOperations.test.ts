import { describe, it, expect } from 'vitest'
import {
  normalizeFilename,
  normalizeForCompare,
  extensionOf,
  findFilenameClash,
  findPossibleDuplicates,
  MAX_FILENAME_LENGTH,
} from '../server/utils/mediaFilename'

// ── ML-CLOUD-02: File Rename ─────────────────────────────────────────────────

describe('reading a filename extension', () => {
  it.each([
    ['datasheet.pdf', '.pdf'],
    ['PHOTO.JPG', '.jpg'],
    ['archive.tar.gz', '.gz'],
    ['no-extension', ''],
    ['.hidden', ''],
    ['trailing.', ''],
    [null, ''],
  ])('%s → "%s"', (input, expected) => {
    expect(extensionOf(input)).toBe(expected)
  })
})

describe('renaming a file', () => {
  it('trims and keeps the trimmed value', () => {
    expect(normalizeFilename('  manual.pdf  ', 'old.pdf')).toEqual({ ok: true, name: 'manual.pdf' })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['forward slash', 'a/b.pdf'],
    ['backslash', 'a\\b.pdf'],
    ['not a string', 42],
  ])('rejects %s', (_label, value) => {
    expect(normalizeFilename(value, 'old.pdf').ok).toBe(false)
  })

  /**
   * The extension is not the operator's to change: the stored bytes and the
   * MIME type do not move, so a .pdf renamed to .txt would download as a file
   * that lies about itself.
   */
  it('puts the original extension back when the new name drops it', () => {
    expect(normalizeFilename('LT-180C manual', 'old.pdf')).toEqual({ ok: true, name: 'LT-180C manual.pdf' })
  })

  it('puts the original extension back when the new name changes it', () => {
    expect(normalizeFilename('manual.txt', 'old.pdf')).toEqual({ ok: true, name: 'manual.txt.pdf' })
  })

  it('does not double the extension when it is already correct', () => {
    expect(normalizeFilename('manual.pdf', 'old.pdf')).toEqual({ ok: true, name: 'manual.pdf' })
  })

  it('matches the extension case-insensitively', () => {
    expect(normalizeFilename('photo.JPG', 'old.jpg')).toEqual({ ok: true, name: 'photo.JPG' })
  })

  it('leaves a name alone when the original had no extension', () => {
    expect(normalizeFilename('readme', 'LICENSE')).toEqual({ ok: true, name: 'readme' })
  })

  it('rejects a name past the length cap, counting the extension it will add', () => {
    const base = 'x'.repeat(MAX_FILENAME_LENGTH - 4)
    expect(normalizeFilename(base, 'old.pdf')).toEqual({ ok: true, name: `${base}.pdf` })
    expect(normalizeFilename(`${base}x`, 'old.pdf').ok).toBe(false)
  })
})

describe('refusing a rename that collides in the same folder', () => {
  const folder = [
    { id: 'a', filename_download: 'manual.pdf', filesize: 100 },
    { id: 'b', filename_download: 'photo.jpg', filesize: 200 },
    { id: 'c', filename_download: null, filesize: 300 },
  ]

  it('finds a clash regardless of case', () => {
    expect(findFilenameClash(folder, 'MANUAL.pdf', 'b')?.id).toBe('a')
  })

  it('does not treat the file itself as a clash', () => {
    expect(findFilenameClash(folder, 'manual.pdf', 'a')).toBeNull()
  })

  it('allows a name nothing else uses', () => {
    expect(findFilenameClash(folder, 'datasheet.pdf', 'a')).toBeNull()
  })

  it('ignores rows with no filename rather than matching them together', () => {
    expect(findFilenameClash(folder, '', 'a')).toBeNull()
  })
})

// ── ML-CLOUD-02: Duplicate warning ───────────────────────────────────────────

/**
 * Directus stores no content digest (confirmed read-only against the live
 * schema), and this module may not add one. So the warning compares what it
 * actually has — name and size in the destination folder — and says "possible".
 */
describe('warning about possible duplicate uploads', () => {
  const existing = [
    { id: 'e1', filename_download: 'datasheet.pdf', filesize: 2048 },
    { id: 'e2', filename_download: 'photo.jpg', filesize: 900 },
    { id: 'e3', filename_download: null, filesize: 900 },
  ]

  it('flags a file with the same name and the same size', () => {
    const matches = findPossibleDuplicates([{ filename: 'datasheet.pdf', size: 2048 }], existing)
    expect(matches).toHaveLength(1)
    expect(matches[0].existing[0].id).toBe('e1')
  })

  it('matches the name case-insensitively', () => {
    expect(findPossibleDuplicates([{ filename: 'DATASHEET.PDF', size: 2048 }], existing)).toHaveLength(1)
  })

  it('does not flag the same name at a different size', () => {
    expect(findPossibleDuplicates([{ filename: 'datasheet.pdf', size: 4096 }], existing)).toHaveLength(0)
  })

  it('does not flag the same size under a different name', () => {
    expect(findPossibleDuplicates([{ filename: 'other.pdf', size: 2048 }], existing)).toHaveLength(0)
  })

  it('flags only the duplicates and leaves the rest of the batch alone', () => {
    const matches = findPossibleDuplicates([
      { filename: 'datasheet.pdf', size: 2048 },
      { filename: 'brand-new.pdf', size: 111 },
      { filename: 'photo.jpg', size: 900 },
    ], existing)
    expect(matches.map(m => m.filename)).toEqual(['datasheet.pdf', 'photo.jpg'])
  })

  it('returns nothing when the folder is empty', () => {
    expect(findPossibleDuplicates([{ filename: 'anything.pdf', size: 1 }], [])).toHaveLength(0)
  })

  it('never matches a stored file that has no filename', () => {
    expect(findPossibleDuplicates([{ filename: '', size: 900 }], existing)).toHaveLength(0)
  })

  /**
   * Directus serialises `filesize` (a bigint) as a string. A strict comparison
   * against the browser's numeric `File.size` never matches, so the warning
   * would be silently switched off against the real API while every unit test
   * using numeric fixtures still passed. Found against live data.
   */
  it('matches a size Directus sent as a string', () => {
    const fromDirectus = [{ id: 's1', filename_download: 'notes.txt', filesize: '8192' }]
    const matches = findPossibleDuplicates([{ filename: 'notes.txt', size: 8192 }], fromDirectus)
    expect(matches).toHaveLength(1)
    expect(matches[0].existing[0].filesize).toBe(8192)
  })

  it('still rejects a string size that differs', () => {
    const fromDirectus = [{ id: 's1', filename_download: 'notes.txt', filesize: '4096' }]
    expect(findPossibleDuplicates([{ filename: 'notes.txt', size: 8192 }], fromDirectus)).toHaveLength(0)
  })

  it('never matches a file whose size is unknown', () => {
    const noSize = [{ id: 's1', filename_download: 'notes.txt', filesize: null }]
    expect(findPossibleDuplicates([{ filename: 'notes.txt', size: 0 }], noSize)).toHaveLength(0)
  })

  it('reports every existing file that matches, not just the first', () => {
    const twins = [
      { id: 'x', filename_download: 'twin.txt', filesize: 10 },
      { id: 'y', filename_download: 'TWIN.txt', filesize: 10 },
    ]
    const matches = findPossibleDuplicates([{ filename: 'twin.txt', size: 10 }], twins)
    expect(matches[0].existing.map(f => f.id)).toEqual(['x', 'y'])
  })
})

describe('how two filenames are compared', () => {
  it.each([
    ['  Manual.PDF ', 'manual.pdf'],
    ['photo.jpg', 'photo.jpg'],
    [null, ''],
    [undefined, ''],
  ])('%s → "%s"', (input, expected) => {
    expect(normalizeForCompare(input)).toBe(expected)
  })
})
