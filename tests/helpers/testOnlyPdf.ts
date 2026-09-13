/**
 * AI-PDF-SOURCE-01 — synthetic TEST ONLY PDFs, built in memory for tests.
 *
 * Nothing outside `tests/` imports this file. It writes just enough PDF
 * structure for Poppler to open a document — pages, a standard font, an image,
 * an encryption dictionary — so the real `pdfinfo` / `pdftotext` in the
 * document-extractor container can be exercised without committing binary
 * fixtures. It is not a production PDF generator.
 */

import { createHash, randomBytes } from 'node:crypto'

export const TEST_ONLY_MARK = 'TEST ONLY — NOT FOR PUBLICATION'

type PdfObject = string | Buffer

/** Assembles numbered objects (object 1 must be the catalog) into a PDF with a correct xref table. */
function assemble(objects: PdfObject[], trailerExtra = ''): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  const offsets: number[] = []
  let length = parts[0].length

  objects.forEach((object, index) => {
    offsets.push(length)
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
      typeof object === 'string' ? Buffer.from(object, 'latin1') : object,
      Buffer.from('\nendobj\n', 'latin1'),
    ])
    parts.push(chunk)
    length += chunk.length
  })

  const xrefOffset = length
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n')
  parts.push(Buffer.from(xref, 'latin1'))
  return Buffer.concat(parts)
}

function stream(dictionary: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ])
}

/** A PDF literal string in WinAnsiEncoding: ASCII, plus the em dash used by the TEST ONLY mark. */
function winAnsiLiteral(text: string): string {
  let out = '('
  for (const char of text) {
    if (char === '\\' || char === '(' || char === ')') out += `\\${char}`
    else if (char === '—') out += '\\227'
    else if (char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) < 0x7F) out += char
    else throw new Error(`winAnsiLiteral: unsupported character U+${char.charCodeAt(0).toString(16)}`)
  }
  return `${out})`
}

interface PageSpec {
  /** Lines drawn with Helvetica, top to bottom. */
  lines?: string[]
  /** Lines drawn with a Type0 font whose ToUnicode map covers any Unicode text. */
  unicodeLines?: string[]
  /** Draw an 8×8 grey image instead of (or as well as) text — a page with no text layer. */
  image?: boolean
}

export interface TestPdfOptions {
  /** Adds an /Encrypt dictionary. `password-required`: no password opens it. `owner-only`: opens with an empty user password. */
  encryption?: 'password-required' | 'owner-only'
}

/** Builds a PDF with one page per spec. */
export function buildTestPdf(pages: PageSpec[], options: TestPdfOptions = {}): Buffer {
  const objects: PdfObject[] = []
  const add = (object: PdfObject) => {
    objects.push(object)
    return objects.length
  }

  add('') // 1: catalog, filled in below
  add('') // 2: page tree, filled in below
  const helvetica = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  const allUnicode = [...new Set(pages.flatMap(page => page.unicodeLines ?? []).join(''))]
  let unicodeFont = 0
  const cidOf = new Map<string, number>()
  if (allUnicode.length > 0) {
    allUnicode.forEach((char, index) => cidOf.set(char, index + 1))
    const bfchars = allUnicode.map((char, index) => {
      const utf16 = Buffer.from(char, 'utf16le').swap16().toString('hex').toUpperCase()
      return `<${(index + 1).toString(16).padStart(4, '0').toUpperCase()}> <${utf16}>`
    })
    const cmap = [
      '/CIDInit /ProcSet findresource begin',
      '12 dict begin',
      'begincmap',
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
      '/CMapName /Adobe-Identity-UCS def',
      '/CMapType 2 def',
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      `${bfchars.length} beginbfchar`,
      ...bfchars,
      'endbfchar',
      'endcmap',
      'CMapName currentdict /CMap defineresource pop',
      'end',
      'end',
    ].join('\n')
    const toUnicode = add(stream('', Buffer.from(cmap, 'latin1')))
    const descriptor = add('<< /Type /FontDescriptor /FontName /TestOnlyUnicode /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>')
    const descendant = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /TestOnlyUnicode /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /CIDToGIDMap /Identity >>`)
    unicodeFont = add(`<< /Type /Font /Subtype /Type0 /BaseFont /TestOnlyUnicode /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${toUnicode} 0 R >>`)
  }

  let image = 0
  if (pages.some(page => page.image)) {
    image = add(stream('/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8', Buffer.alloc(64, 0x80)))
  }

  const pageRefs: number[] = []
  for (const page of pages) {
    const ops: string[] = []
    if (page.lines?.length) {
      ops.push('BT /F1 11 Tf 72 740 Td 14 TL')
      for (const line of page.lines) ops.push(`${winAnsiLiteral(line)} Tj T*`)
      ops.push('ET')
    }
    if (page.unicodeLines?.length) {
      ops.push('BT /F2 12 Tf 72 400 Td 16 TL')
      for (const line of page.unicodeLines) {
        const hex = [...line].map(char => cidOf.get(char)!.toString(16).padStart(4, '0')).join('')
        ops.push(`<${hex}> Tj T*`)
      }
      ops.push('ET')
    }
    if (page.image) ops.push('q 200 0 0 200 100 300 cm /Im1 Do Q')

    const contents = add(stream('', Buffer.from(ops.join('\n'), 'latin1')))
    const fonts = `/F1 ${helvetica} 0 R${unicodeFont ? ` /F2 ${unicodeFont} 0 R` : ''}`
    const xobjects = image ? ` /XObject << /Im1 ${image} 0 R >>` : ''
    pageRefs.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << ${fonts} >>${xobjects} >> /Contents ${contents} 0 R >>`))
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map(ref => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`

  if (!options.encryption) return assemble(objects)

  const id = randomBytes(16)
  const { owner, user } = options.encryption === 'owner-only'
    ? standardSecurityEntries(id)
    : { owner: randomBytes(32), user: randomBytes(32) }
  const encrypt = add(`<< /Filter /Standard /V 2 /R 3 /Length 128 /P -3904 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> >>`)
  return assemble(objects, `/Encrypt ${encrypt} 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] `)
}

/** A text-layer PDF: one page per entry, each entry a list of lines. */
export function buildTextPdf(pageLines: string[][], options: TestPdfOptions = {}): Buffer {
  return buildTestPdf(pageLines.map(lines => ({ lines })), options)
}

/** `count` pages, each carrying its own page number and the TEST ONLY mark. */
export function buildPagedPdf(count: number): Buffer {
  return buildTextPdf(Array.from({ length: count }, (_, index) => [TEST_ONLY_MARK, `Page ${index + 1} of ${count}`]))
}

/** A valid PDF whose only page is an image: nothing for pdftotext to extract, like a scan. */
export function buildImageOnlyPdf(): Buffer {
  return buildTestPdf([{ image: true }])
}

// ── PDF Standard Security Handler, revision 3 (RC4, 128-bit), empty user password ──

const PASSWORD_PADDING = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex')
const TEST_OWNER_PASSWORD = 'test-only-owner'
const PERMISSIONS = -3904

function md5(...parts: Buffer[]): Buffer {
  const hash = createHash('md5')
  for (const part of parts) hash.update(part)
  return hash.digest()
}

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xFF
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  let i = 0
  j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xFF
    j = (j + s[i]) & 0xFF
    ;[s[i], s[j]] = [s[j], s[i]]
    out[k] = data[k] ^ s[(s[i] + s[j]) & 0xFF]
  }
  return out
}

function rc4Rounds(key: Buffer, data: Buffer): Buffer {
  let result = rc4(key, data)
  for (let round = 1; round <= 19; round++) {
    result = rc4(Buffer.from(key.map(byte => byte ^ round)), result)
  }
  return result
}

function pad(password: string): Buffer {
  return Buffer.concat([Buffer.from(password, 'latin1'), PASSWORD_PADDING]).subarray(0, 32)
}

/** /O and /U values for an owner password and an empty user password (PDF 1.7 algorithms 3, 2 and 5). */
function standardSecurityEntries(id: Buffer): { owner: Buffer, user: Buffer } {
  let ownerKey = md5(pad(TEST_OWNER_PASSWORD))
  for (let round = 0; round < 50; round++) ownerKey = md5(ownerKey)
  const owner = rc4Rounds(ownerKey.subarray(0, 16), pad(''))

  const permissions = Buffer.alloc(4)
  permissions.writeInt32LE(PERMISSIONS)
  let key = md5(pad(''), owner, permissions, id)
  for (let round = 0; round < 50; round++) key = md5(key.subarray(0, 16))
  const fileKey = key.subarray(0, 16)

  const user = Buffer.concat([rc4Rounds(fileKey, md5(PASSWORD_PADDING, id)), Buffer.alloc(16)])
  return { owner, user }
}
