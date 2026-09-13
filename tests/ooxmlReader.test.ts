/**
 * AI-XLSX-SOURCE-01 — the bounded OOXML package reader (`ooxmlReader.ts`).
 *
 * Every archive here is synthetic, built in memory by the TEST ONLY helper, so
 * no binary fixture is committed. Where a production-sized input would only be
 * slow, a lower limit is injected; the production constants are asserted on
 * their own.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MAX_TOTAL_DECOMPRESSED_BYTES,
  MAX_XML_DEPTH,
  MAX_XML_TOKEN_CHARS,
  MAX_ZIP_ENTRIES,
  OOXML_LIMITS,
  OoxmlFailure,
  isSafeEntryName,
  localName,
  openOoxmlPackage,
  type OoxmlLimits,
  type XmlEvents,
} from '../server/utils/ooxmlReader'
import { TEST_ONLY_MARK, buildZip, type ZipEntrySpec } from './helpers/testOnlyXlsx'

const KB = 1024
const MB = 1024 * KB
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

const inAMinute = () => Date.now() + 60_000

interface ReadOptions {
  maxBytes?: number
  limits?: Partial<OoxmlLimits>
  deadline?: number
  now?: () => number
  events?: XmlEvents
}

/** The code a refusal carries. Fails the test when nothing was refused. */
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(OoxmlFailure)
    // The message is the code itself: nothing from the file travels with a refusal.
    expect((error as Error).message).toBe((error as OoxmlFailure<string>).code)
    return (error as OoxmlFailure<string>).code
  }
  throw new Error('expected the reader to refuse')
}

/** Opens `entries` as a package and streams one part, returning the events it produced. */
async function readPart(entries: readonly ZipEntrySpec[], partName: string, options: ReadOptions = {}): Promise<string[]> {
  const pkg = await openOoxmlPackage(buildZip(entries), {
    deadline: options.deadline ?? inAMinute(),
    now: options.now,
    limits: options.limits,
  })
  const seen: string[] = []
  try {
    await pkg.readXml(partName, options.maxBytes ?? MB, options.events ?? {
      open: (name, attributes) => seen.push(Object.keys(attributes).length ? `<${name} ${JSON.stringify(attributes)}>` : `<${name}>`),
      close: name => seen.push(`</${name}>`),
      text: text => seen.push(text),
    })
  }
  finally {
    pkg.close()
  }
  return seen
}

const part = (name: string, data: string, extra: Partial<ZipEntrySpec> = {}): ZipEntrySpec => ({ name, data, ...extra })
const marker = part('docProps/core.xml', `${XML}<title>${TEST_ONLY_MARK}</title>`)

describe('ooxmlReader — production limits', () => {
  it('pins the V1 package limits', () => {
    expect(MAX_ZIP_ENTRIES).toBe(1_000)
    expect(MAX_TOTAL_DECOMPRESSED_BYTES).toBe(64 * MB)
    expect(MAX_XML_DEPTH).toBe(128)
    expect(MAX_XML_TOKEN_CHARS).toBe(MB)
    expect(OOXML_LIMITS).toEqual({ maxEntries: 1_000, maxTotalDecompressedBytes: 64 * MB, maxXmlDepth: 128, maxXmlTokenChars: MB })
    expect(Object.isFrozen(OOXML_LIMITS)).toBe(true)
  })
})

describe('ooxmlReader — reading parts', () => {
  it('streams a deflated or a stored part as events named by local name', async () => {
    const xml = `${XML}<x:root xmlns:x="urn:test" xmlns:r="urn:rel"><x:row r:id="rId1">A &amp; B</x:row><x:row><![CDATA[<kept as text>]]></x:row></x:root>`
    for (const method of ['deflate', 'store'] as const) {
      expect(await readPart([marker, part('xl/data.xml', xml, { method })], 'xl/data.xml')).toEqual([
        '<root {"xmlns:x":"urn:test","xmlns:r":"urn:rel"}>',
        '<row {"r:id":"rId1"}>', 'A & B', '</row>',
        '<row>', '<kept as text>', '</row>',
        '</root>',
      ])
    }
  })

  it('finds a part wherever the archive stores it, comparing names without regard to case', async () => {
    const entries = [part('XL/Data.XML', `${XML}<a>late</a>`), marker]
    const pkg = await openOoxmlPackage(buildZip(entries), { deadline: inAMinute() })
    try {
      expect(pkg.has('xl/data.xml')).toBe(true)
      expect(pkg.has('xl/other.xml')).toBe(false)
    }
    finally {
      pkg.close()
    }
    expect(await readPart(entries, 'xl/data.xml')).toEqual(['<a>', 'late', '</a>'])
    expect(localName('x:row')).toBe('row')
    expect(localName('row')).toBe('row')
  })

  it('refuses to read a part the package does not hold', async () => {
    expect(await refusal(() => readPart([marker], 'xl/workbook.xml'))).toBe('malformed')
  })

  it('passes a refusal thrown by a handler through intact, and turns anything else into malformed', async () => {
    const entries = [marker, part('xl/data.xml', `${XML}<a><b/></a>`)]
    const refuseOnB: XmlEvents = {
      open: (name) => {
        if (name === 'b') throw new OoxmlFailure('too_many_rows')
      },
    }
    const crash: XmlEvents = {
      open: () => {
        throw new Error('C:\\private\\path in an internal message')
      },
    }
    expect(await refusal(() => readPart(entries, 'xl/data.xml', { events: refuseOnB }))).toBe('too_many_rows')
    expect(await refusal(() => readPart(entries, 'xl/data.xml', { events: crash }))).toBe('malformed')
  })
})

describe('ooxmlReader — actual decompressed bytes', () => {
  const ROW = '<row><c>0</c></row>'
  /** About 8 MB of XML that deflates to a few kilobytes. */
  const bombXml = () => `${XML}<root>${ROW.repeat(420_000)}</root>`

  it('stops inflating a high-ratio part (ZIP bomb) as soon as its actual output passes the limit', async () => {
    const xml = bombXml()
    const zip = buildZip([marker, part('xl/worksheets/sheet1.xml', xml)])
    expect(xml.length / zip.byteLength).toBeGreaterThan(100)

    let rows = 0
    const pkg = await openOoxmlPackage(zip, { deadline: inAMinute() })
    try {
      const code = await refusal(() => pkg.readXml('xl/worksheets/sheet1.xml', 256 * KB, {
        open: (name) => {
          if (name === 'row') rows += 1
        },
      }))
      expect(code).toBe('too_complex')
    }
    finally {
      pkg.close()
    }
    // Only what arrived before the limit was ever parsed: the limit plus at most one inflate chunk.
    expect(rows).toBeGreaterThan(0)
    expect(rows * ROW.length).toBeLessThanOrEqual(256 * KB + 64 * KB)
  })

  it('counts every part read against one package-wide total', async () => {
    const block = `${XML}<root>${'x'.repeat(150 * KB)}</root>`
    const pkg = await openOoxmlPackage(buildZip([marker, part('xl/a.xml', block), part('xl/b.xml', block)]), {
      deadline: inAMinute(),
      limits: { maxTotalDecompressedBytes: 250 * KB },
    })
    try {
      await pkg.readXml('xl/a.xml', MB, {})
      expect(await refusal(() => pkg.readXml('xl/b.xml', MB, {}))).toBe('too_complex')
    }
    finally {
      pkg.close()
    }
  })

  it('never trusts a declared size: a huge one still stops at the actual byte limit', async () => {
    const entries = [marker, part('xl/worksheets/sheet1.xml', bombXml(), { declaredSize: 0xFFFF_FFF0 })]
    expect(await refusal(() => readPart(entries, 'xl/worksheets/sheet1.xml', { maxBytes: 256 * KB }))).toBe('too_complex')
  })

  it('refuses a part whose actual output is larger than its declared size', async () => {
    const entries = [marker, part('xl/data.xml', `${XML}<root>${'<r/>'.repeat(10_000)}</root>`, { declaredSize: 100 })]
    expect(await refusal(() => readPart(entries, 'xl/data.xml'))).toBe('malformed')
  })

  it('refuses a part whose actual output is smaller than its declared size', async () => {
    const entries = [marker, part('xl/data.xml', `${XML}<root/>`, { declaredSize: 50 * KB })]
    expect(await refusal(() => readPart(entries, 'xl/data.xml'))).toBe('malformed')
  })
})

describe('ooxmlReader — archive structure', () => {
  const tiny = (index: number) => part(`xl/p${index}.xml`, '<a/>', { method: 'store' })

  it('opens an archive of exactly 1,000 entries and refuses 1,001 before reading any part', async () => {
    const others = Array.from({ length: 999 }, (_, index) => tiny(index))
    const pkg = await openOoxmlPackage(buildZip([marker, ...others]), { deadline: inAMinute() })
    expect(pkg.has('xl/p998.xml')).toBe(true)
    pkg.close()
    expect(await refusal(() => openOoxmlPackage(buildZip([marker, ...others, tiny(999)]), { deadline: inAMinute() }))).toBe('too_complex')
  })

  it.each([
    ['a parent-directory segment', '../evil.xml'],
    ['a nested parent-directory segment', 'xl/../../evil.xml'],
    ['an absolute path', '/xl/evil.xml'],
    ['a drive letter', 'C:/xl/evil.xml'],
    ['a backslash', 'xl\\..\\evil.xml'],
    ['a NUL character', 'xl/evil\u0000.xml'],
    ['full-width dots that normalize to ..', 'xl/\uFF0E\uFF0E/evil.xml'],
    ['full-width solidi that normalize to /../', 'xl\uFF0F..\uFF0Fevil.xml'],
    ['an empty segment', 'xl//evil.xml'],
    ['a current-directory segment', './evil.xml'],
  ])('refuses an entry name with %s, without reading it', async (_label, name) => {
    expect(await refusal(() => openOoxmlPackage(buildZip([marker, part(name, '<a/>')]), { deadline: inAMinute() }))).toBe('malformed')
  })

  it('accepts ordinary part names and nothing unusual', () => {
    for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/media/']) {
      expect(isSafeEntryName(name)).toBe(true)
    }
    expect(isSafeEntryName('')).toBe(false)
    expect(isSafeEntryName('a'.repeat(1_025))).toBe(false)
  })

  it('refuses two copies of one part rather than letting either win', async () => {
    const first = part('xl/workbook.xml', `${XML}<workbook>first</workbook>`)
    const second = part('xl/workbook.xml', `${XML}<workbook>second</workbook>`)
    const differentCase = part('XL/Workbook.xml', `${XML}<workbook>second</workbook>`)
    expect(await refusal(() => openOoxmlPackage(buildZip([marker, first, second]), { deadline: inAMinute() }))).toBe('malformed')
    expect(await refusal(() => openOoxmlPackage(buildZip([marker, first, differentCase]), { deadline: inAMinute() }))).toBe('malformed')
  })

  it('reports an OLE compound file — how Office stores an encrypted workbook — as encrypted', async () => {
    const compoundFile = new Uint8Array(1_024)
    compoundFile.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
    expect(await refusal(() => openOoxmlPackage(compoundFile, { deadline: inAMinute() }))).toBe('encrypted')
  })

  it('reports an entry flagged as encrypted as encrypted, without reading it', async () => {
    const entries = [marker, part('xl/workbook.xml', `${XML}<workbook/>`, { encryptedFlag: true })]
    expect(await refusal(() => readPart(entries, 'xl/workbook.xml'))).toBe('encrypted')
  })

  it.each([
    ['empty bytes', new Uint8Array(0)],
    ['random bytes', Uint8Array.from({ length: 2_048 }, (_, index) => (index * 7_919 + 13) % 251)],
    ['a ZIP signature followed by garbage', Uint8Array.from([0x50, 0x4B, 0x03, 0x04, ...Array.from({ length: 200 }, (_, index) => index)])],
    ['a truncated archive', buildZip([marker, part('xl/workbook.xml', `${XML}<workbook/>`)]).slice(0, 60)],
  ])('refuses %s as malformed', async (_label, bytes) => {
    expect(await refusal(() => openOoxmlPackage(bytes, { deadline: inAMinute() }))).toBe('malformed')
  })
})

describe('ooxmlReader — XML safety', () => {
  const read = (xml: string, options: ReadOptions = {}) => readPart([marker, part('xl/workbook.xml', xml)], 'xl/workbook.xml', options)

  it('refuses a DOCTYPE declaring an external entity (XXE), without resolving it', async () => {
    const seen: string[] = []
    const xml = `${XML}<!DOCTYPE workbook [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><workbook>&xxe;</workbook>`
    expect(await refusal(() => read(xml, { events: { text: text => seen.push(text) } }))).toBe('malformed')
    expect(seen.join('')).not.toMatch(/root:|passwd/)
  })

  it('refuses nested entity expansion (billion laughs), without expanding anything', async () => {
    const entities = [
      '<!ENTITY lol "lol">',
      ...Array.from({ length: 9 }, (_, index) => `<!ENTITY lol${index + 1} "${`&lol${index || ''};`.repeat(10)}">`),
    ].join('')
    const seen: string[] = []
    const xml = `${XML}<!DOCTYPE lolz [${entities}]><lolz>&lol9;</lolz>`
    expect(await refusal(() => read(xml, { events: { text: text => seen.push(text) } }))).toBe('malformed')
    expect(seen.join('').length).toBeLessThan(100)
  })

  it.each([
    ['an undefined entity', `${XML}<workbook>&undefined;</workbook>`],
    ['mismatched tags', `${XML}<workbook><sheets></workbook>`],
    ['an unclosed root', `${XML}<workbook>`],
    ['no root element', XML],
    ['text that is not XML', 'not xml at all'],
  ])('refuses %s as malformed', async (_label, xml) => {
    expect(await refusal(() => read(xml))).toBe('malformed')
  })

  it('accepts elements nested 128 deep and refuses 129', async () => {
    const nested = (depth: number) => `${XML}${'<d>'.repeat(depth)}${'</d>'.repeat(depth)}`
    expect(await read(nested(128))).toHaveLength(256)
    expect(await refusal(() => read(nested(129)))).toBe('too_complex')
  })

  it('accepts a text token of exactly 1 MB and refuses one character more', async () => {
    const xml = (length: number) => `${XML}<workbook>${'x'.repeat(length)}</workbook>`
    const seen = await read(xml(MAX_XML_TOKEN_CHARS), { maxBytes: 2 * MB })
    expect(seen[1]).toHaveLength(MAX_XML_TOKEN_CHARS)
    expect(await refusal(() => read(xml(MAX_XML_TOKEN_CHARS + 1), { maxBytes: 2 * MB }))).toBe('too_complex')
  })

  it.each([
    ['an attribute value', `${XML}<workbook name="${'v'.repeat(1_001)}"/>`],
    ['a comment', `${XML}<workbook><!--${'c'.repeat(1_001)}--></workbook>`],
    ['an element name', `${XML}<${'n'.repeat(1_001)}/>`],
    ['a CDATA section', `${XML}<workbook><![CDATA[${'d'.repeat(1_001)}]]></workbook>`],
  ])('refuses %s longer than the token limit', async (_label, xml) => {
    expect(await refusal(() => read(xml, { limits: { maxXmlTokenChars: 1_000 } }))).toBe('too_complex')
  })

  it('stops a token that is still growing, before it is ever delivered', async () => {
    const seen: string[] = []
    const xml = `${XML}<workbook>${'x'.repeat(50_000)}</workbook>`
    const options: ReadOptions = { limits: { maxXmlTokenChars: 1_000 }, events: { text: text => seen.push(text) } }
    expect(await refusal(() => read(xml, options))).toBe('too_complex')
    expect(seen).toEqual([])
  })
})

describe('ooxmlReader — deadline', () => {
  const small = [marker, part('xl/workbook.xml', `${XML}<workbook><a/></workbook>`)]

  it('refuses to start once the deadline has passed', async () => {
    expect(await refusal(() => openOoxmlPackage(buildZip(small), { deadline: Date.now() - 1 }))).toBe('timeout')
  })

  it('stops between archive entries when the clock passes the deadline', async () => {
    let calls = 0
    const now = () => (calls++ === 0 ? 0 : 2_000)
    expect(await refusal(() => openOoxmlPackage(buildZip(small), { deadline: 1_000, now }))).toBe('timeout')
  })

  it('stops mid-part, at the next chunk it parses, when the clock passes the deadline', async () => {
    const entries = [marker, part('xl/workbook.xml', `${XML}<workbook>${'<a/>'.repeat(100_000)}</workbook>`)]
    let late = false
    let opened = 0
    const code = await refusal(() => readPart(entries, 'xl/workbook.xml', {
      deadline: 1_000,
      now: () => (late ? 2_000 : 0),
      events: {
        open: () => {
          opened += 1
          late = true
        },
      },
    }))
    expect(code).toBe('timeout')
    // The clock moved on the very first element; parsing stopped long before the part ended.
    expect(opened).toBeLessThan(100_000 / 4)
  })
})

describe('ooxmlReader — source boundaries', () => {
  const source = readFileSync(resolve(process.cwd(), 'server/utils/ooxmlReader.ts'), 'utf8')

  it('imports only yauzl, saxes and a stream type', () => {
    const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1])
    expect(imports).toEqual(['yauzl', 'saxes', 'node:stream'])
  })

  it('never touches the filesystem, a child process, or dynamically built code', () => {
    expect(source).not.toMatch(/node:fs|from 'fs'|child_process|writeFile|createWriteStream|\beval\(|new Function|DOMParser/)
  })
})
