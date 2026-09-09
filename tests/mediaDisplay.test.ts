/**
 * ML-CLOUD-03 — the fallback a card shows when it cannot show a picture.
 *
 * The visual rule this protects is that a broken thumbnail must render the
 * SAME stable block a non-image renders, rather than a broken-image glyph with
 * alt text spilling over the filename. That means the mapping has to answer
 * for every format the library accepts — and for the ones it does not, since a
 * file uploaded before a rule changed still has to draw.
 */

import { describe, it, expect } from 'vitest'
import { fileKind, summariseUpload, systemFolderLabel } from '../utils/mediaDisplay'

describe('the label shown when there is no thumbnail', () => {
  it.each([
    ['application/pdf', 'PDF'],
    ['image/jpeg', 'IMAGE'],
    ['image/png', 'IMAGE'],
    ['image/webp', 'IMAGE'],
    ['text/csv', 'CSV'],
    ['text/tab-separated-values', 'TSV'],
    ['text/plain', 'TXT'],
  ])('%s → %s', (type, expected) => {
    expect(fileKind(type)).toBe(expected)
  })

  it('reads a content type that carries a charset parameter', () => {
    expect(fileKind('text/csv; charset=utf-8')).toBe('CSV')
    expect(fileKind('text/plain;charset=UTF-8')).toBe('TXT')
  })

  it('is case-insensitive, because stored types are not normalised', () => {
    expect(fileKind('IMAGE/JPEG')).toBe('IMAGE')
    expect(fileKind('Application/PDF')).toBe('PDF')
  })

  /** A card with an unknown or missing type still has to draw something. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['a format the library does not accept', 'application/vnd.ms-excel'],
    ['nonsense', 'not-a-mime-type'],
  ])('falls back to FILE for %s', (_label, type) => {
    expect(fileKind(type)).toBe('FILE')
  })

  it('distinguishes TSV from plain text, which share a prefix', () => {
    expect(fileKind('text/tab-separated-values')).toBe('TSV')
    expect(fileKind('text/plain')).toBe('TXT')
  })
})

describe('reporting how an upload batch went', () => {
  const ok = (filename: string) => ({ filename, ok: true })
  const bad = (filename: string, message: string) => ({ filename, ok: false, message })

  it('says nothing happened for an empty batch', () => {
    expect(summariseUpload([])).toBe('Nothing to upload')
  })

  it('reports a clean batch as a success', () => {
    expect(summariseUpload([ok('a.pdf'), ok('b.pdf')])).toBe('2 file(s) uploaded successfully')
  })

  it('reports a batch that entirely failed as a failure', () => {
    expect(summariseUpload([bad('a.exe', 'Unsupported format')])).toBe('1 file(s) failed to upload')
  })

  /**
   * The case the old single-message banner got wrong in both directions:
   * "Upload failed" hid four files that landed, "success" hid the one that
   * did not.
   */
  it('reports a partly failed batch as both numbers', () => {
    const results = [ok('a.pdf'), ok('b.pdf'), ok('c.pdf'), ok('d.pdf'), bad('e.exe', 'Unsupported format')]
    expect(summariseUpload(results)).toBe('4 uploaded, 1 failed')
  })
})

/**
 * ML-CLOUD-UI-CLEANUP-01 — system folders are stored as governance slugs, and
 * governance matches on the stored name by exact path. The label is a display
 * transform only, so it has to be a pure function of the name with no aliases
 * that could drift away from what is actually stored.
 */
describe('how a system folder name is displayed', () => {
  it.each([
    ['products', 'Products'],
    ['resources', 'Resources'],
    ['metal-detection', 'Metal Detection'],
    ['technical-docs', 'Technical Docs'],
    ['case-studies', 'Case Studies'],
  ])('%s → %s', (stored, shown) => {
    expect(systemFolderLabel(stored)).toBe(shown)
  })

  it('leaves an already-capitalised name alone', () => {
    expect(systemFolderLabel('Products')).toBe('Products')
  })

  /**
   * `xray` becomes "Xray", not "X-ray". Inventing a nicer label would mean
   * keeping an alias table in step with folder names nobody remembers it
   * depends on — the moment they disagree, the screen lies about the folder.
   */
  it('does not invent a prettier name than the folder actually has', () => {
    expect(systemFolderLabel('xray')).toBe('Xray')
  })

  it('collapses repeated separators rather than emitting blanks', () => {
    expect(systemFolderLabel('a--b')).toBe('A B')
    expect(systemFolderLabel('  spaced  out  ')).toBe('Spaced Out')
  })

  it('survives an empty name', () => {
    expect(systemFolderLabel('')).toBe('')
  })
})
