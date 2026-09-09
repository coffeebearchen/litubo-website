/**
 * PWS-AI-BETA-01R1 — the Media Library upload whitelist.
 *
 * The first single-product AI Beta exposed a functional gap: AI Source Intake
 * accepts TXT / CSV / TSV, but the Media Library — the only sanctioned upload
 * route — accepted only images and PDF. There was therefore no supported way
 * to put an analysable text source onto a product at all.
 *
 * These tests assert the shipped rule directly (`isAllowedUpload` is exported
 * from the handler) rather than restating it, so the test cannot silently
 * disagree with the endpoint. The existing image and PDF behaviour is asserted
 * alongside the new types, because this change must not widen or narrow it.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The handler module calls `defineEventHandler` at module scope — a Nitro
 * auto-import vitest does not provide — so it is stubbed before the dynamic
 * import below. Nothing about the rule under test is stubbed or reimplemented.
 */
let isAllowedUpload: (filename: string, contentType: string) => boolean
let ALLOWED_UPLOAD_LABEL: string

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  const mod = await import('../server/api/admin/media/upload.post')
  isAllowedUpload = mod.isAllowedUpload
  ALLOWED_UPLOAD_LABEL = mod.ALLOWED_UPLOAD_LABEL
})

describe('Media Library upload — AI text sources are accepted', () => {
  it.each([
    ['specs.txt', 'text/plain'],
    ['parameters.csv', 'text/csv'],
    ['parameters.tsv', 'text/tab-separated-values'],
  ])('accepts %s (%s)', (filename, type) => {
    expect(isAllowedUpload(filename, type)).toBe(true)
  })

  it('accepts a text source whose content type carries a charset parameter', () => {
    expect(isAllowedUpload('specs.txt', 'text/plain; charset=utf-8')).toBe(true)
    expect(isAllowedUpload('specs.csv', 'TEXT/CSV; charset=UTF-8')).toBe(true)
  })

  it('accepts the extensions case-insensitively', () => {
    expect(isAllowedUpload('SPECS.TXT', 'text/plain')).toBe(true)
    expect(isAllowedUpload('SPECS.CSV', 'text/csv')).toBe(true)
    expect(isAllowedUpload('SPECS.TSV', 'text/tab-separated-values')).toBe(true)
  })
})

describe('Media Library upload — existing image and PDF behaviour is unchanged', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.jpg', 'image/jpg'],
    ['diagram.png', 'image/png'],
    ['banner.webp', 'image/webp'],
    ['datasheet.pdf', 'application/pdf'],
  ])('still accepts %s (%s)', (filename, type) => {
    expect(isAllowedUpload(filename, type)).toBe(true)
  })
})

describe('Media Library upload — everything else is still refused', () => {
  it.each([
    ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['sheet.xls', 'application/vnd.ms-excel'],
    ['archive.zip', 'application/zip'],
    ['script.js', 'text/javascript'],
    ['page.html', 'text/html'],
    ['doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['video.mp4', 'video/mp4'],
    ['unknown.bin', 'application/octet-stream'],
  ])('refuses %s (%s)', (filename, type) => {
    expect(isAllowedUpload(filename, type)).toBe(false)
  })

  /**
   * Both halves of the rule still have to agree. A permitted extension with a
   * disallowed type, or a permitted type on a disallowed extension, is refused
   * — so renaming a file or spoofing its content type is not enough on its own.
   */
  it('refuses a mismatch between extension and content type', () => {
    expect(isAllowedUpload('payload.exe', 'text/plain')).toBe(false)
    expect(isAllowedUpload('specs.txt', 'application/x-msdownload')).toBe(false)
    expect(isAllowedUpload('specs', 'text/plain')).toBe(false)
    expect(isAllowedUpload('archive.zip', 'text/csv')).toBe(false)
  })
})

describe('the refusal message names exactly what is accepted', () => {
  it('lists all seven accepted formats and no longer claims only four', () => {
    expect(ALLOWED_UPLOAD_LABEL).toBe('JPG、PNG、WebP、PDF、TXT、CSV、TSV')
  })

  it('the handler builds its error message from that label rather than a hard-coded list', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/api/admin/media/upload.post.ts'), 'utf8')
    expect(source).toContain('${ALLOWED_UPLOAD_LABEL}')
    expect(source).not.toContain('仅允许 JPG、PNG、WebP、PDF`')
  })
})

describe('the Media Library file input offers the same set the server accepts', () => {
  it('accept lists every new extension and MIME type, and keeps the existing ones', () => {
    const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')
    const accept = source.match(/accept="([^"]+)"/)?.[1] ?? ''

    for (const token of ['.txt', '.csv', '.tsv', 'text/plain', 'text/csv', 'text/tab-separated-values']) {
      expect(accept).toContain(token)
    }
    for (const token of ['.jpg', '.jpeg', '.png', '.webp', '.pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(accept).toContain(token)
    }
  })
})
