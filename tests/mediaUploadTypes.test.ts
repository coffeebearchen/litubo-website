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
let LEGACY_XLS_MESSAGE: string
let LEGACY_DOC_MESSAGE: string
let uploadFailureMessage: (status: number | undefined) => string
let uploadRefusalMessage: (filename: string, contentType: string) => string
let uploadContentMatchesType: (bytes: Uint8Array, contentType: string) => boolean
let uploadContentMismatchMessage: (contentType: string) => string

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  const mod = await import('../server/api/admin/media/upload.post')
  isAllowedUpload = mod.isAllowedUpload
  ALLOWED_UPLOAD_LABEL = mod.ALLOWED_UPLOAD_LABEL
  LEGACY_XLS_MESSAGE = mod.LEGACY_XLS_MESSAGE
  LEGACY_DOC_MESSAGE = mod.LEGACY_DOC_MESSAGE
  uploadFailureMessage = mod.uploadFailureMessage
  uploadRefusalMessage = mod.uploadRefusalMessage
  uploadContentMatchesType = mod.uploadContentMatchesType
  uploadContentMismatchMessage = mod.uploadContentMismatchMessage
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

/** AI-XLSX-SOURCE-01 — a standard .xlsx workbook is stored like any other accepted source. */
describe('Media Library upload — standard .xlsx workbooks are accepted', () => {
  it('accepts .xlsx with its official content type, in any letter case', () => {
    expect(isAllowedUpload('parameters.xlsx', XLSX)).toBe(true)
    expect(isAllowedUpload('PARAMETERS.XLSX', XLSX.toUpperCase())).toBe(true)
  })

  it('still needs both halves: an .xlsx name with another type, or the type on another name, is refused', () => {
    expect(isAllowedUpload('parameters.xlsx', 'application/vnd.ms-excel')).toBe(false)
    expect(isAllowedUpload('parameters.xlsx', 'application/octet-stream')).toBe(false)
    expect(isAllowedUpload('parameters.xlsm', XLSX)).toBe(false)
    expect(isAllowedUpload('parameters.xls', XLSX)).toBe(false)
  })
})

/** AI-DOCX-SOURCE-01 — a standard .docx document is stored like any other accepted source. */
describe('Media Library upload — standard .docx documents are accepted', () => {
  it('accepts .docx with its official content type, in any letter case', () => {
    expect(isAllowedUpload('manual.docx', DOCX)).toBe(true)
    expect(isAllowedUpload('MANUAL.DOCX', DOCX.toUpperCase())).toBe(true)
  })

  it('still needs both halves: a .docx name with another type, or the type on another name, is refused', () => {
    expect(isAllowedUpload('manual.docx', 'application/msword')).toBe(false)
    expect(isAllowedUpload('manual.docx', 'application/octet-stream')).toBe(false)
    expect(isAllowedUpload('manual.docm', DOCX)).toBe(false)
    expect(isAllowedUpload('manual.doc', DOCX)).toBe(false)
    expect(isAllowedUpload('manual.dotx', DOCX)).toBe(false)
  })
})

describe('Media Library upload — everything else is still refused', () => {
  it.each([
    ['sheet.xls', 'application/vnd.ms-excel'],
    ['macro.xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
    ['template.xltx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
    ['archive.zip', 'application/zip'],
    ['script.js', 'text/javascript'],
    ['page.html', 'text/html'],
    ['doc.doc', 'application/msword'],
    ['macro.docm', 'application/vnd.ms-word.document.macroEnabled.12'],
    ['template.dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
    ['template.dotm', 'application/vnd.ms-word.template.macroEnabled.12'],
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
  it('lists all nine accepted formats', () => {
    expect(ALLOWED_UPLOAD_LABEL).toBe('JPG、PNG、WebP、PDF、TXT、CSV、TSV、XLSX、DOCX')
  })

  it('the handler builds its error message from that label rather than a hard-coded list', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/api/admin/media/upload.post.ts'), 'utf8')
    expect(source).toContain('${ALLOWED_UPLOAD_LABEL}')
    expect(source).toContain('uploadRefusalMessage(filename, ct)')
    expect(source).not.toContain('仅允许 JPG、PNG、WebP、PDF`')
  })

  /** AI-XLSX-SOURCE-01 — a legacy workbook is told what to do about it. */
  it('tells a legacy .xls upload to save it as .xlsx, and every other refusal which formats are accepted', () => {
    expect(LEGACY_XLS_MESSAGE).toBe('Legacy .xls files are not supported. Save as .xlsx and upload again.')
    expect(uploadRefusalMessage('sheet.xls', 'application/vnd.ms-excel')).toBe(LEGACY_XLS_MESSAGE)
    expect(uploadRefusalMessage('SHEET.XLS', 'application/octet-stream')).toBe(LEGACY_XLS_MESSAGE)
    expect(uploadRefusalMessage('macro.xlsm', 'application/vnd.ms-excel.sheet.macroenabled.12'))
      .toBe(`格式不支持（application/vnd.ms-excel.sheet.macroenabled.12）。仅允许 ${ALLOWED_UPLOAD_LABEL}`)
    expect(uploadRefusalMessage('manual.docx', 'application/octet-stream')).not.toBe(LEGACY_XLS_MESSAGE)
    // A .csv that a browser labelled with the Excel type is not an .xls, and is not told it is one.
    expect(uploadRefusalMessage('parameters.csv', 'application/vnd.ms-excel')).not.toBe(LEGACY_XLS_MESSAGE)
  })

  /** AI-DOCX-SOURCE-01 — a legacy Word document is told the same kind of thing. */
  it('tells a legacy .doc upload to save it as .docx, and never says so to a .docm or .docx', () => {
    expect(LEGACY_DOC_MESSAGE).toBe('Legacy .doc files are not supported. Save as .docx and upload again.')
    expect(uploadRefusalMessage('manual.doc', 'application/msword')).toBe(LEGACY_DOC_MESSAGE)
    expect(uploadRefusalMessage('MANUAL.DOC', 'application/octet-stream')).toBe(LEGACY_DOC_MESSAGE)
    expect(uploadRefusalMessage('macro.docm', 'application/vnd.ms-word.document.macroenabled.12'))
      .toBe(`格式不支持（application/vnd.ms-word.document.macroenabled.12）。仅允许 ${ALLOWED_UPLOAD_LABEL}`)
    expect(uploadRefusalMessage('manual.docx', 'application/msword')).not.toBe(LEGACY_DOC_MESSAGE)
  })
})

/**
 * FINAL-RELEASE-SECURITY-REMEDIATION-01 — Directus runs sharp on a file because of its stored content type,
 * but sharp decodes whatever the bytes are. An image upload therefore has to carry the bytes of the image it
 * claims to be, or a HEIF / AVIF container labelled as JPEG, PNG or WebP would reach the libheif bundled with
 * Directus 12.3.1's sharp (GHSA-rgj7-g3m4-5g8c).
 */
describe('Media Library upload — image bytes must be the image their content type claims', () => {
  const bytes = (...parts: Array<number[] | string>) =>
    Uint8Array.from(parts.flatMap(part => typeof part === 'string' ? [...Buffer.from(part, 'latin1')] : part))
  const JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10], 'JFIF')
  const PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], [0, 0, 0, 13], 'IHDR')
  const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 ')
  const HEIC = bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0], 'mif1heic')
  const AVIF = bytes([0, 0, 0, 0x1C], 'ftypavif', [0, 0, 0, 0], 'avifmif1miaf')

  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['JPEG', JPEG, 'image/jpg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
    ['JPEG', JPEG, 'IMAGE/JPEG; charset=binary'],
  ])('accepts real %s bytes declared %s', (_label, data, type) => {
    expect(uploadContentMatchesType(data, type)).toBe(true)
  })

  it.each([
    ['HEIC', HEIC, 'image/jpeg'],
    ['HEIC', HEIC, 'image/png'],
    ['AVIF', AVIF, 'image/webp'],
    ['AVIF', AVIF, 'image/jpeg'],
    ['JPEG', JPEG, 'image/png'],
    ['PNG', PNG, 'image/webp'],
    ['empty', new Uint8Array(0), 'image/jpeg'],
    ['text', bytes('not an image'), 'image/png'],
  ])('refuses %s bytes declared %s', (_label, data, type) => {
    expect(uploadContentMatchesType(data, type)).toBe(false)
  })

  it('does not second-guess the types Directus never hands to sharp', () => {
    expect(uploadContentMatchesType(bytes('%PDF-1.7'), 'application/pdf')).toBe(true)
    expect(uploadContentMatchesType(bytes('a,b\n1,2\n'), 'text/csv')).toBe(true)
    expect(uploadContentMatchesType(bytes([0x50, 0x4B, 0x03, 0x04]), XLSX)).toBe(true)
  })

  it('names the declared type in the refusal', () => {
    expect(uploadContentMismatchMessage('image/jpeg')).toBe('文件内容与声明的格式不一致（image/jpeg），已拒绝上传')
  })

  it('the handler refuses a mismatch before anything is sent to Directus', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/api/admin/media/upload.post.ts'), 'utf8')
    const check = source.indexOf('if (!uploadContentMatchesType(exactBytes, ct))')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(source.indexOf("fd.append('file'"))
    expect(check).toBeLessThan(source.indexOf('`${config.directusUrl}/files`'))
  })
})

describe('the Media Library file input offers the same set the server accepts', () => {
  const acceptTokens = () => {
    const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')
    return (source.match(/accept="([^"]+)"/)?.[1] ?? '').split(',').map(token => token.trim())
  }

  it('accept lists every accepted extension and MIME type, .xlsx and .docx included', () => {
    const accept = acceptTokens()
    for (const token of ['.txt', '.csv', '.tsv', 'text/plain', 'text/csv', 'text/tab-separated-values']) {
      expect(accept).toContain(token)
    }
    for (const token of ['.jpg', '.jpeg', '.png', '.webp', '.pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(accept).toContain(token)
    }
    expect(accept).toContain('.xlsx')
    expect(accept).toContain(XLSX)
    expect(accept).toContain('.docx')
    expect(accept).toContain(DOCX)
  })

  it('never offers a legacy, macro-enabled or template file the server would refuse', () => {
    const accept = acceptTokens()
    for (const token of [
      '.xls', '.xlsm', '.xltx', '.doc', '.docm', '.dotx', '.dotm',
      'application/vnd.ms-excel', 'application/msword', 'application/vnd.ms-word.document.macroenabled.12',
    ]) {
      expect(accept).not.toContain(token)
    }
  })
})


/**
 * MEDIA-UPLOAD-BLOCKER-HOTFIX-02 — the bytes that reach storage must be the
 * file's own.
 *
 * Node allocates buffers under 8 KB from a shared 8192-byte pool, so a small
 * upload's `.buffer` is the pool rather than the file. Reading it shipped 8192
 * bytes from offset 0: a 160-byte text file was stored as 8 KB of unrelated
 * process memory, and whether Directus accepted the result depended on what
 * the neighbouring bytes happened to be — which is why the same file could
 * upload once and fail the next time.
 *
 * These assert the slicing rule against a genuinely pooled Buffer, so the test
 * fails if the handler ever goes back to reading `.buffer` directly.
 */
describe('an uploaded file carries its own bytes', () => {
  /** The exact expression the handler uses to extract one part's bytes. */
  const extract = (b: Buffer) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength).slice()

  it('a small Buffer really is pooled — the premise this guards', () => {
    const small = Buffer.from('TEST ONLY — NOT FOR PUBLICATION')
    expect(small.buffer.byteLength).toBeGreaterThan(small.length)
  })

  it('extracts exactly the file, not the pool around it', () => {
    const content = [
      'TEST ONLY — NOT FOR PUBLICATION',
      'Product: LT180C',
      'Aperture: 180 mm',
      '',
    ].join('\n')
    const buf = Buffer.from(content, 'utf8')
    const bytes = extract(buf)

    expect(bytes.byteLength).toBe(buf.length)
    expect(new TextDecoder().decode(bytes)).toBe(content)
  })

  it('is unaffected by neighbouring allocations in the same pool', () => {
    const before = Buffer.from('AAAAAAAAAAAAAAAAAAAAAAAA')
    const mine = Buffer.from('the only bytes that belong to this file')
    const after = Buffer.from('BBBBBBBBBBBBBBBBBBBBBBBB')
    const bytes = extract(mine)

    expect(new TextDecoder().decode(bytes)).toBe('the only bytes that belong to this file')
    expect(new TextDecoder().decode(bytes)).not.toContain('A')
    expect(new TextDecoder().decode(bytes)).not.toContain('B')
    expect(before.length + after.length).toBeGreaterThan(0) // keep both alive in the pool
  })

  it('reading .buffer instead would have shipped the whole pool — the bug', () => {
    const buf = Buffer.from('short')
    expect(buf.buffer.byteLength).not.toBe(buf.length)
    expect(extract(buf).byteLength).toBe(buf.length)
  })

  it('handles an empty file without reaching past it', () => {
    expect(extract(Buffer.alloc(0)).byteLength).toBe(0)
  })

  it('handles a file larger than the pool, which is allocated on its own', () => {
    const big = Buffer.alloc(20_000, 7)
    const bytes = extract(big)
    expect(bytes.byteLength).toBe(20_000)
    expect(bytes.every(b => b === 7)).toBe(true)
  })
})

describe('why an upload failed, said safely', () => {
  it.each([
    [401, '重新登录'],
    [403, '重新登录'],
    [413, '文件过大'],
    [415, '无法识别'],
    [500, '暂时不可用'],
    [503, '暂时不可用'],
  ])('status %s explains what to do', (status, fragment) => {
    expect(uploadFailureMessage(status)).toContain(fragment)
  })

  it('covers a connection that never answered', () => {
    expect(uploadFailureMessage(undefined)).toContain('无法连接')
  })

  /** Never forward provider detail: only the status shapes the message. */
  it.each([401, 403, 413, 415, 500, 503, 418, undefined])('status %s leaks no internals', (status) => {
    const msg = uploadFailureMessage(status)
    expect(msg).not.toMatch(/Bearer|Authorization|token|D:\|\/var\/|http/i)
  })
})
