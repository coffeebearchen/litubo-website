/**
 * AI-DOCX-SOURCE-01 — the bounded Word reader (`docxExtraction.ts`).
 *
 * Every document is a synthetic TEST ONLY package built in memory, read by the
 * real reader over the real `yauzl` / `saxes` stack. Where a limit would need a
 * very large file, the limit is lowered for the test and the production value is
 * asserted separately; everything else runs against the production limits.
 *
 * The OOXML reader is wrapped only to record which parts are opened, so the tests
 * can prove that headers, footers, comments, notes and embedded parts never are.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCX_LIMITS, MAX_DOCX_PROCESSING_MS, extractDocxText, type DocxLimits } from '../server/utils/docxExtraction'
import { MAX_TOTAL_DECOMPRESSED_BYTES, MAX_XML_DEPTH, MAX_XML_TOKEN_CHARS, MAX_ZIP_ENTRIES } from '../server/utils/ooxmlReader'
import { buildZip, tableXlsx, type ZipEntrySpec } from './helpers/testOnlyXlsx'
import {
  NS_W,
  TEST_ONLY_MARK,
  buildDocx,
  docx,
  docxEntries,
  documentXml,
  heading,
  para,
  paraXml,
  run,
  styleXml,
  stylesXml,
  table,
} from './helpers/testOnlyDocx'

const partsRead = vi.hoisted(() => [] as string[])

// Hoisted above the imports by vitest: the reader under test gets this wrapped OOXML package.
vi.mock('../server/utils/ooxmlReader', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/utils/ooxmlReader')>()
  return {
    ...original,
    openOoxmlPackage: async (...args: Parameters<typeof original.openOoxmlPackage>) => {
      const pkg = await original.openOoxmlPackage(...args)
      return {
        ...pkg,
        readXml: (part: string, maxBytes: number, events: Parameters<typeof pkg.readXml>[2]) => {
          partsRead.push(part)
          return pkg.readXml(part, maxBytes, events)
        },
      }
    },
  }
})

const KB = 1024
const MB = 1024 * KB
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const W = `xmlns:w="${NS_W}"`

interface ReadOptions {
  maxChars?: number
  limits?: Partial<DocxLimits>
  now?: () => number
  deadline?: number
}

function read(bytes: Uint8Array, options: ReadOptions = {}) {
  return extractDocxText(bytes, { ...options, deadline: options.deadline ?? Date.now() + 60_000 })
}

async function textOf(bytes: Uint8Array, options?: ReadOptions): Promise<string> {
  const result = await read(bytes, options)
  if (!result.ok) throw new Error(`refused: ${result.code}`)
  return result.text
}

async function codeOf(bytes: Uint8Array, options?: ReadOptions): Promise<string> {
  const result = await read(bytes, options)
  return result.ok ? 'ok' : result.code
}

beforeEach(() => {
  partsRead.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('structure: headings, paragraphs and tables', () => {
  it('reads a TEST ONLY datasheet into structured text', async () => {
    const bytes = docx([
      heading(1, 'LT180C'),
      para('Aperture: 180 mm'),
      para('Power: 0.45 kW'),
      table([['Parameter', 'Value'], ['Voltage', '220 V']]),
    ])
    expect(await textOf(bytes)).toBe('# LT180C\nAperture: 180 mm\nPower: 0.45 kW\nTable:\nParameter | Value\nVoltage | 220 V')
  })

  it('names heading levels from the styles: built-in headings, a style based on one, never by how a paragraph looks', async () => {
    const styles = stylesXml(
      styleXml('SpecHeading', 'Spec Heading', { basedOn: 'Heading2' })
      + styleXml('BigBold', 'Big Bold', { basedOn: 'Normal' })
      + styleXml('Heading9', 'heading 9', { basedOn: 'Normal' }),
    )
    const bytes = docx([
      heading(1, 'Electrical'),
      heading(2, 'Power'),
      heading(3, 'Supply'),
      para('Custom heading', 'SpecHeading'),
      para('Styled to look important', 'BigBold'),
      paraXml(run('Bold and large', '<w:b/><w:sz w:val="48"/><w:color w:val="1F3864"/>')),
      para('Deep level', 'Heading9'),
    ], { styles })
    expect(await textOf(bytes)).toBe([
      '# Electrical',
      '## Power',
      '### Supply',
      '## Custom heading',
      'Styled to look important',
      'Bold and large',
      '###### Deep level',
    ].join('\n'))
  })

  it('reads the body without a styles part: every paragraph is a plain paragraph', async () => {
    const bytes = docx([heading(1, 'LT180C'), para('Aperture: 180 mm')], { styles: null })
    expect(await textOf(bytes)).toBe('LT180C\nAperture: 180 mm')
    expect(partsRead).toEqual(['[Content_Types].xml', 'word/_rels/document.xml.rels', 'word/document.xml'])
  })

  it('joins runs, turns tabs into spaces, keeps line breaks as lines, and collapses stray whitespace', async () => {
    const bytes = docx([
      paraXml(run('Power:') + run(' 0.45 kW')),
      paraXml('<w:r><w:t>Voltage</w:t><w:tab/><w:t>220 V</w:t></w:r>'),
      paraXml('<w:r><w:t>Line one</w:t><w:br/><w:t xml:space="preserve">  Line two</w:t></w:r>'),
      paraXml(run('Many    spaces\u200B  here')),
      paraXml('<w:r><w:t>  not preserved  </w:t></w:r><w:r><w:t>joined</w:t></w:r>'),
      para(''),
      paraXml(`<w:r><w:t>Anti</w:t><w:noBreakHyphen/><w:t>static</w:t></w:r>`),
    ])
    expect(await textOf(bytes)).toBe([
      'Power: 0.45 kW',
      'Voltage 220 V',
      'Line one',
      'Line two',
      'Many spaces here',
      'not preservedjoined',
      'Anti-static',
    ].join('\n'))
  })

  it('keeps every value in its own row and cell: several paragraphs share a cell, an empty cell keeps its place, a `|` cannot fake a cell', async () => {
    const bytes = docx([table([
      ['Model', 'Voltage', 'Power'],
      ['LT180C', '220 V', '0.45 kW'],
      ['LT200C', ['380 V', '3-phase'], ''],
      ['', '', ''],
      ['Note', 'A | B', '1'],
    ])])
    expect(await textOf(bytes)).toBe([
      'Table:',
      'Model | Voltage | Power',
      'LT180C | 220 V | 0.45 kW',
      'LT200C | 380 V / 3-phase | ',
      'Note | A \\| B | 1',
    ].join('\n'))
  })

  it('keeps later cells under their columns when a cell spans columns or a row starts after skipped columns', async () => {
    const bytes = docx([table([
      ['Parameter', 'LT180C', 'LT200C'],
      [{ xml: para('Shared by both'), properties: '<w:gridSpan w:val="2"/>' }, 'Yes'],
      ['220 V', '380 V'],
    ], { 2: '<w:gridBefore w:val="1"/>' })])
    expect(await textOf(bytes)).toBe('Table:\nParameter | LT180C | LT200C\nShared by both |  | Yes\n | 220 V | 380 V')
  })

  it('keeps a nested table inside its cell, and refuses a third level of nesting', async () => {
    const nested = docx([table([['Outer', { xml: table([['a', 'b'], ['c', 'd']]) + para('after') }]])])
    expect(await textOf(nested)).toBe('Table:\nOuter | a ; b / c ; d / after')

    const third = docx([table([[{ xml: table([[{ xml: table([['x']]) + para('') }]]) + para('') }]])])
    expect(DOCX_LIMITS.maxTableNesting).toBe(2)
    expect(await codeOf(third)).toBe('too_complex')
  })

  it('keeps every model section of a multi-model document — nothing here narrows to one product', async () => {
    const bytes = docx([
      heading(1, 'LT180C'), para('Aperture 180 mm'), para('Voltage 220 V'),
      heading(1, 'LT200C'), para('Aperture 200 mm'), para('Voltage 380 V'),
    ])
    expect(await textOf(bytes)).toBe('# LT180C\nAperture 180 mm\nVoltage 220 V\n# LT200C\nAperture 200 mm\nVoltage 380 V')
    // The reader takes no product identity at all; attribution is the D-025 guard's.
    const source = readFileSync(resolve(process.cwd(), 'server/utils/docxExtraction.ts'), 'utf8')
    expect(source).not.toMatch(/productCode|productCodeMatch|normalizeProductCode/)
  })

  it('keeps a content control\'s text but none of its properties', async () => {
    const bytes = docx([
      `<w:sdt><w:sdtPr><w:alias w:val="Internal alias"/><w:tag w:val="secret-tag"/><w:placeholder><w:docPart w:val="Internal placeholder"/></w:placeholder></w:sdtPr><w:sdtContent>${para('Voltage 220 V')}</w:sdtContent></w:sdt>`,
    ])
    expect(await textOf(bytes)).toBe('Voltage 220 V')
  })
})

describe('the document as it reads: tracked changes, hidden text, fields, links', () => {
  it('keeps inserted text and drops deleted text, so an old value never travels with the new one', async () => {
    const bytes = docx([
      paraXml('<w:del w:id="1" w:author="TEST ONLY"><w:r><w:delText>Voltage 380 V</w:delText></w:r></w:del>'),
      paraXml(`<w:ins w:id="2" w:author="TEST ONLY">${run('Voltage 220 V')}</w:ins>`),
      paraXml(`${run('Power ')}<w:del w:id="3" w:author="TEST ONLY"><w:r><w:delText>0.55</w:delText></w:r></w:del><w:ins w:id="4" w:author="TEST ONLY">${run('0.45')}</w:ins>${run(' kW')}`),
    ])
    const text = await textOf(bytes)
    expect(text).toBe('Voltage 220 V\nPower 0.45 kW')
    expect(text).not.toMatch(/380|0\.55/)
  })

  it('keeps moved text once, where it was moved to', async () => {
    const bytes = docx([
      paraXml(`<w:moveFrom w:id="5" w:author="TEST ONLY">${run('Aperture 180 mm')}</w:moveFrom>`),
      para('Weight 45 kg'),
      paraXml(`<w:moveTo w:id="6" w:author="TEST ONLY">${run('Aperture 180 mm')}</w:moveTo>`),
    ])
    const text = await textOf(bytes)
    expect(text).toBe('Weight 45 kg\nAperture 180 mm')
    expect(text.match(/Aperture/g)).toHaveLength(1)
  })

  it('drops a deleted table row and a deleted cell, and keeps an inserted row', async () => {
    const bytes = docx([table([
      ['Model', 'Voltage'],
      ['LT180C', '380 V'],
      ['LT180C', '220 V'],
      ['Removed', { xml: para('Removed cell'), properties: '<w:cellDel w:id="9" w:author="TEST ONLY"/>' }],
    ], { 1: '<w:del w:id="7" w:author="TEST ONLY"/>', 2: '<w:ins w:id="8" w:author="TEST ONLY"/>' })])
    expect(await textOf(bytes)).toBe('Table:\nModel | Voltage\nLT180C | 220 V\nRemoved')
  })

  it('drops hidden text — set on the run, through a character or paragraph style, or by the defaults — and nothing else', async () => {
    const styles = stylesXml(
      styleXml('SecretChar', 'Secret Char', { type: 'character', hidden: true })
      + styleXml('HiddenPara', 'Hidden Para', { basedOn: 'Normal', hidden: true })
      + styleXml('HiddenChild', 'Hidden Child', { basedOn: 'HiddenPara' }),
    )
    const bytes = docx([
      paraXml(run('Aperture 180 mm') + run(' Internal cost 123', '<w:vanish/>')),
      paraXml(run('Internal cost 124', '<w:webHidden/>')),
      paraXml(run('Internal cost 125', '<w:specVanish/>')),
      paraXml(run('Visible again', '<w:vanish w:val="0"/>')),
      paraXml(run('Internal cost 126', '<w:rStyle w:val="SecretChar"/>')),
      para('Internal cost 127', 'HiddenPara'),
      para('Internal cost 128', 'HiddenChild'),
      paraXml(run('Shown despite its style', '<w:vanish w:val="false"/>'), 'HiddenPara'),
      paraXml(run('Formerly hidden', '<w:rPrChange w:id="9" w:author="TEST ONLY"><w:rPr><w:vanish/></w:rPr></w:rPrChange>')),
    ], { styles })
    const text = await textOf(bytes)
    expect(text).toBe('Aperture 180 mm\nVisible again\nShown despite its style\nFormerly hidden')
    expect(text).not.toContain('Internal cost')

    expect(await codeOf(docx([para('Internal cost 129')], { styles: stylesXml('', '<w:vanish/>') }))).toBe('no_text')
  })

  it('never opens comments, headers, footers, footnotes or endnotes, and nothing from them reaches the text', async () => {
    const part = (root: string, inner: string) => `${XML}<w:${root} ${W}>${inner}</w:${root}>`
    const secretParagraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
    const bytes = docx([
      paraXml(`<w:commentRangeStart w:id="0"/>${run('Voltage 220 V')}<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`),
      paraXml(`${run('Aperture 180 mm')}<w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:endnoteReference w:id="1"/></w:r>`),
    ], {
      extraEntries: [
        { name: 'word/comments.xml', data: part('comments', `<w:comment w:id="0" w:author="TEST ONLY">${secretParagraph('maybe use 380V')}</w:comment>`) },
        { name: 'word/header1.xml', data: part('hdr', secretParagraph('INTERNAL CONFIDENTIAL PRICE')) },
        { name: 'word/footer1.xml', data: part('ftr', secretParagraph('INTERNAL CONFIDENTIAL PRICE')) },
        { name: 'word/footnotes.xml', data: part('footnotes', `<w:footnote w:id="1">${secretParagraph('Footnote secret 999')}</w:footnote>`) },
        { name: 'word/endnotes.xml', data: part('endnotes', `<w:endnote w:id="1">${secretParagraph('Endnote secret 888')}</w:endnote>`) },
        { name: 'word/media/image1.png', data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]) },
        { name: 'word/embeddings/oleObject1.bin', data: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]) },
        { name: 'customXml/item1.xml', data: '<secret>Custom XML secret 777</secret>' },
      ],
      documentRelationships: ['comments', 'header', 'footer', 'footnotes', 'endnotes']
        .map((kind, index) => `<Relationship Id="rIdX${index}" Type="${REL}/${kind}" Target="${kind === 'header' ? 'header1' : kind === 'footer' ? 'footer1' : kind}.xml"/>`).join(''),
    })
    const text = await textOf(bytes)
    expect(text).toBe('Voltage 220 V\nAperture 180 mm')
    expect(text).not.toMatch(/380V|INTERNAL|CONFIDENTIAL|secret|777/i)
    expect(partsRead).toEqual(['[Content_Types].xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/document.xml'])
  })

  it('drops field instructions — a path never reaches the text — and keeps the result a field shows', async () => {
    const bytes = docx([
      paraXml(
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        + '<w:r><w:instrText xml:space="preserve"> INCLUDETEXT "C:\\private.docx" </w:instrText></w:r>'
        + '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        + run('Included value: 220 V')
        + '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
      ),
      paraXml(`<w:fldSimple w:instr=" INCLUDETEXT C:\\private.docx ">${run('Simple field result')}</w:fldSimple>`),
      paraXml('<w:r><w:fldChar w:fldCharType="begin"><w:fldData xml:space="preserve">QzpccHJpdmF0ZS5kb2N4</w:fldData></w:fldChar></w:r>'),
    ])
    const text = await textOf(bytes)
    expect(text).toBe('Included value: 220 V\nSimple field result')
    expect(text).not.toMatch(/INCLUDETEXT|C:\\|private|QzpccHJp/)
  })

  it('keeps the words a hyperlink shows, never where it points, and never reaches the network', async () => {
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const bytes = docx([paraXml(`<w:hyperlink r:id="rIdLink">${run('LITUBO technical page')}</w:hyperlink>`)], {
      documentRelationships: `<Relationship Id="rIdLink" Type="${REL}/hyperlink" Target="https://example.invalid/litubo-technical" TargetMode="External"/>`,
    })
    const text = await textOf(bytes)
    expect(text).toBe('LITUBO technical page')
    expect(text).not.toMatch(/example\.invalid|https?:/)
    expect(network).not.toHaveBeenCalled()
  })

  it('reads one branch of alternate content, never two', async () => {
    const alternate = (choices: string[], fallback?: string) => '<mc:AlternateContent>'
      + choices.map(choice => `<mc:Choice Requires="w14">${choice}</mc:Choice>`).join('')
      + (fallback === undefined ? '' : `<mc:Fallback>${fallback}</mc:Fallback>`)
      + '</mc:AlternateContent>'
    const bytes = docx([
      paraXml(alternate([run('Shared text')], run('Shared text'))),
      paraXml(alternate([run('First choice')], run('Fallback text'))),
      paraXml(alternate([run('Choice one'), run('Choice two')])),
      paraXml(alternate([], run('Only a fallback'))),
    ])
    expect(await textOf(bytes)).toBe('Shared text\nFirst choice\nChoice one\nOnly a fallback')
  })

  it('reads a text box once, whether it comes with a drawing and a VML fallback or as VML alone', async () => {
    const box = (text: string) => `<w:txbxContent>${para(text)}</w:txbxContent>`
    const bytes = docx([
      paraXml(`${run('Before box')}<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:wsp><wps:txbx>${box('Box text 45 kg')}</wps:txbx></wps:wsp></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox>${box('Box text 45 kg')}</v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`),
      paraXml(`<w:r><w:pict><v:shape><v:textbox>${box('Legacy box 12 V')}</v:textbox></v:shape></w:pict></w:r>`),
    ])
    const text = await textOf(bytes)
    expect(text).toBe('Box text 45 kg\nBefore box\nLegacy box 12 V')
    expect(text.match(/Box text/g)).toHaveLength(1)
  })

  it('a document with no visible text is no_text', async () => {
    expect(await codeOf(docx([]))).toBe('no_text')
    expect(await codeOf(docx([para(''), para('   ')]))).toBe('no_text')
    expect(await codeOf(docx([table([['', ''], ['', '']])]))).toBe('no_text')
    expect(await codeOf(docx([
      paraXml('<w:del w:id="1" w:author="TEST ONLY"><w:r><w:delText>Old</w:delText></w:r></w:del>'),
      paraXml(run('Hidden', '<w:vanish/>')),
    ]))).toBe('no_text')
  })
})

describe('refusals: damaged, encrypted, macro and imported content', () => {
  it('refuses bytes that are not a Word package as malformed', async () => {
    const good = docx([para('Aperture 180 mm')])
    expect(await codeOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe('malformed')
    expect(await codeOf(new TextEncoder().encode('Aperture: 180 mm'))).toBe('malformed')
    expect(await codeOf(good.slice(0, Math.floor(good.length / 2)))).toBe('malformed')
    expect(await codeOf(tableXlsx([['Parameter', 'Value'], ['Aperture', '180 mm']]))).toBe('malformed')
    expect(await codeOf(buildDocx({ body: para('x'), omitDocumentPart: true }))).toBe('malformed')
    expect(await codeOf(buildZip(docxEntries({ body: para('x') }).filter(entry => entry.name !== '[Content_Types].xml')))).toBe('malformed')
    expect(await codeOf(buildDocx({ documentXml: `${XML}<w:glossaryDocument ${W}><w:docParts/></w:glossaryDocument>` }))).toBe('malformed')
    expect(await codeOf(buildDocx({ documentXml: `${XML}<w:document ${W}><w:body><w:p>` }))).toBe('malformed')
  })

  it('refuses an encrypted document (an OLE compound file) as encrypted, without trying a password', async () => {
    const cfb = new Uint8Array(4 * KB)
    cfb.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
    expect(await codeOf(cfb)).toBe('encrypted')
  })

  it('refuses macro-enabled and template documents and any VBA project as unsupported, without reading the macro', async () => {
    const macroTypes = [
      'application/vnd.ms-word.document.macroEnabled.main+xml',
      'application/vnd.ms-word.template.macroEnabledTemplate.main+xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
    ]
    for (const documentContentType of macroTypes) {
      expect(await codeOf(buildDocx({ body: para('Aperture 180 mm'), documentContentType }))).toBe('unsupported')
    }
    const vba: ZipEntrySpec = { name: 'word/vbaProject.bin', data: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 1, 2, 3]) }
    expect(await codeOf(buildDocx({
      body: para('Aperture 180 mm'),
      extraEntries: [vba],
      contentTypes: '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>',
    }))).toBe('unsupported')
    expect(await codeOf(buildDocx({ body: para('Aperture 180 mm'), extraEntries: [vba] }))).toBe('unsupported')
    expect(await codeOf(buildDocx({
      body: para('Aperture 180 mm'),
      documentRelationships: `<Relationship Id="rIdVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="macros.bin"/>`,
    }))).toBe('unsupported')
    expect(partsRead.some(part => /vba|macros/i.test(part))).toBe(false)
  })

  it('refuses content shown from another file (altChunk, subDoc) as unsupported, rather than silently leaving it out', async () => {
    const chunk = buildDocx({
      body: para('Aperture 180 mm') + '<w:altChunk r:id="rIdChunk"/>',
      documentRelationships: `<Relationship Id="rIdChunk" Type="${REL}/aFChunk" Target="afchunk.htm"/>`,
      extraEntries: [{ name: 'word/afchunk.htm', data: '<html><body>Voltage 380 V</body></html>' }],
    })
    expect(await codeOf(chunk)).toBe('unsupported')
    expect(await codeOf(docx([paraXml('<w:subDoc r:id="rIdSub"/>')]))).toBe('unsupported')
  })

  it('refuses unsafe entry names and a second copy of the document part as malformed', async () => {
    const withEntry = (entry: ZipEntrySpec) => buildZip([...docxEntries({ body: para('Aperture 180 mm') }), entry])
    expect(await codeOf(withEntry({ name: '../evil.xml', data: '<a/>' }))).toBe('malformed')
    expect(await codeOf(withEntry({ name: 'word\\document2.xml', data: '<a/>' }))).toBe('malformed')
    expect(await codeOf(withEntry({ name: 'C:/evil.xml', data: '<a/>' }))).toBe('malformed')
    expect(await codeOf(withEntry({ name: 'word/document.xml', data: documentXml(para('Voltage 380 V')) }))).toBe('malformed')
    expect(await codeOf(withEntry({ name: 'WORD/Document.xml', data: documentXml(para('Voltage 380 V')) }))).toBe('malformed')
  })

  it('refuses a DOCTYPE anywhere it is read, so no entity is ever expanded', async () => {
    const entity = `${XML}<!DOCTYPE w:document [<!ENTITY cost "Internal cost 123">]><w:document ${W}><w:body><w:p><w:r><w:t>&cost;</w:t></w:r></w:p></w:body></w:document>`
    expect(await read(buildDocx({ documentXml: entity }))).toEqual({ ok: false, code: 'malformed' })
    const laughs = `${XML}<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><w:document ${W}><w:body><w:p><w:r><w:t>&lol2;</w:t></w:r></w:p></w:body></w:document>`
    expect(await codeOf(buildDocx({ documentXml: laughs }))).toBe('malformed')
    const external = `${XML}<!DOCTYPE w:document [<!ENTITY xxe SYSTEM "file:///C:/private.docx">]><w:document ${W}><w:body><w:p><w:r><w:t>&xxe;</w:t></w:r></w:p></w:body></w:document>`
    expect(await codeOf(buildDocx({ documentXml: external }))).toBe('malformed')
    const styles = `${XML}<!DOCTYPE w:styles [<!ENTITY x "y">]><w:styles ${W}/>`
    expect(await codeOf(buildDocx({ body: para('Aperture 180 mm'), styles }))).toBe('malformed')
  })
})

describe('limits of the shared OOXML reader, as the Word reader meets them', () => {
  it('allows element depth 128 and refuses 129', async () => {
    // document (1) > body (2) > n nested customXml elements.
    const nest = (n: number) => docx([para('Aperture 180 mm'), `${'<w:customXml>'.repeat(n)}${'</w:customXml>'.repeat(n)}`])
    expect(MAX_XML_DEPTH).toBe(128)
    expect(await codeOf(nest(126))).toBe('ok')
    expect(await codeOf(nest(127))).toBe('too_complex')
  })

  it('allows a single XML token of 1 MB and refuses one character more', async () => {
    const withAttribute = (length: number) => docx([`<w:p w:rsidR="${'a'.repeat(length)}">${run('Aperture 180 mm')}</w:p>`])
    expect(MAX_XML_TOKEN_CHARS).toBe(MB)
    expect(await codeOf(withAttribute(MB))).toBe('ok')
    expect(await codeOf(withAttribute(MB + 1))).toBe('too_complex')
  })

  it('stops a decompression bomb at the bytes actually inflated, never at what the archive declares', async () => {
    // A few megabytes of one repeated empty element deflate to a few kilobytes, and no single token is large.
    const bomb = documentXml(`${para('Aperture 180 mm')}${'<w:bookmarkEnd w:id="0"/>'.repeat(120_000)}`)
    expect(bomb.length).toBeGreaterThan(2 * MB)
    const honest = buildZip(docxEntries({ documentXml: bomb }))
    expect(honest.byteLength).toBeLessThan(64 * KB)
    // Controlled lowered-limit test: the document part may inflate to 1 MB here.
    expect(await codeOf(honest, { limits: { maxDocumentXmlBytes: MB } })).toBe('too_complex')
    // A declared size of almost 4 GB changes nothing: the actual bytes still stop it.
    const lying = buildZip(docxEntries({ documentXml: bomb }).map(entry => (entry.name === 'word/document.xml' ? { ...entry, declaredSize: 0xFFFF_FFF0 } : entry)))
    expect(await codeOf(lying, { limits: { maxDocumentXmlBytes: MB } })).toBe('too_complex')
    // A declared size smaller than the real output is damage.
    const small = buildZip(docxEntries({ documentXml: bomb }).map(entry => (entry.name === 'word/document.xml' ? { ...entry, declaredSize: 100 } : entry)))
    expect(await codeOf(small)).toBe('malformed')
    // The same bomb within the production limits is read.
    expect(await textOf(honest)).toBe('Aperture 180 mm')
  })

  it('counts every part read against the whole-package ceiling', async () => {
    const padding = `<w:customXml>${' '.repeat(700 * KB)}</w:customXml>`
    const bytes = buildDocx({
      body: para('Aperture 180 mm') + padding,
      styles: stylesXml().replace('</w:styles>', `${' '.repeat(700 * KB)}</w:styles>`),
    })
    // Controlled lowered-limit test: 1 MB for the whole package; each part alone fits.
    expect(await codeOf(bytes, { limits: { maxTotalDecompressedBytes: MB } })).toBe('too_complex')
    expect(await codeOf(bytes)).toBe('ok')
  })

  it('refuses a document part over its own inflated-size ceiling', async () => {
    const bytes = docx([para('Aperture 180 mm'), `<w:customXml>${' '.repeat(40 * KB)}</w:customXml>`])
    expect(await codeOf(bytes, { limits: { maxDocumentXmlBytes: 32 * KB } })).toBe('too_complex')
    expect(await codeOf(bytes, { limits: { maxDocumentXmlBytes: 64 * KB } })).toBe('ok')
  })

  it('opens a package of exactly 1,000 entries and refuses 1,001', async () => {
    const entries = (total: number) => {
      const base = docxEntries({ body: para('Aperture 180 mm') })
      const extra = Array.from({ length: total - base.length }, (_, index): ZipEntrySpec => ({ name: `customXml/item${index}.xml`, data: '<a/>', method: 'store' }))
      return buildZip([...base, ...extra])
    }
    expect(MAX_ZIP_ENTRIES).toBe(1_000)
    expect(await codeOf(entries(1_000))).toBe('ok')
    expect(await codeOf(entries(1_001))).toBe('too_complex')
  })

  it('pins the production ceilings the reader starts from', () => {
    expect(DOCX_LIMITS).toMatchObject({
      maxEntries: 1_000,
      maxTotalDecompressedBytes: MAX_TOTAL_DECOMPRESSED_BYTES,
      maxXmlDepth: 128,
      maxXmlTokenChars: MB,
      maxBytes: 10 * MB,
      maxDocumentXmlBytes: 32 * MB,
      maxStylesXmlBytes: 4 * MB,
      maxMetadataXmlBytes: 4 * MB,
      maxParagraphs: 5_000,
      maxTables: 100,
      maxRowsPerTable: 1_000,
      maxTableCellsTotal: 20_000,
      maxTableNesting: 2,
      maxOutputChars: 20_000,
    })
    expect(MAX_TOTAL_DECOMPRESSED_BYTES).toBe(64 * MB)
    expect(MAX_DOCX_PROCESSING_MS).toBe(5_000)
  })
})

describe('Word limits: refused whole at limit + 1, never cut', () => {
  it('paragraphs — every paragraph counts, table cells included', async () => {
    const paragraphs = (n: number) => docx(Array.from({ length: n }, (_, index) => para(`Line ${index}`)))
    expect(await codeOf(paragraphs(3), { limits: { maxParagraphs: 3 } })).toBe('ok')
    expect(await codeOf(paragraphs(4), { limits: { maxParagraphs: 3 } })).toBe('too_complex')
    expect(await codeOf(docx([para('a'), table([['b', 'c']])]), { limits: { maxParagraphs: 2 } })).toBe('too_complex')
  })

  it('tables', async () => {
    const tables = (n: number) => docx(Array.from({ length: n }, (_, index) => table([[`T${index}`]])))
    expect(await codeOf(tables(2), { limits: { maxTables: 2 } })).toBe('ok')
    expect(await codeOf(tables(3), { limits: { maxTables: 2 } })).toBe('too_complex')
  })

  it('rows per table', async () => {
    const rows = (n: number) => docx([table(Array.from({ length: n }, (_, index) => [`R${index}`]))])
    expect(await codeOf(rows(3), { limits: { maxRowsPerTable: 3 } })).toBe('ok')
    expect(await codeOf(rows(4), { limits: { maxRowsPerTable: 3 } })).toBe('too_complex')
  })

  it('cells across all tables, a spanned cell counting once per column', async () => {
    const grid = docx([table([['a', 'b', 'c'], ['d', 'e', 'f']])])
    expect(await codeOf(grid, { limits: { maxTableCellsTotal: 6 } })).toBe('ok')
    expect(await codeOf(docx([table([['a', 'b', 'c'], ['d', 'e', 'f']]), table([['g']])]), { limits: { maxTableCellsTotal: 6 } })).toBe('too_complex')
    const spanned = docx([table([[{ xml: para('wide'), properties: '<w:gridSpan w:val="7"/>' }]])])
    expect(await codeOf(spanned, { limits: { maxTableCellsTotal: 6 } })).toBe('too_complex')
    expect(await codeOf(docx([table([[{ xml: para('huge'), properties: '<w:gridSpan w:val="100000"/>' }]])]))).toBe('too_complex')
  })

  it('characters: exactly the limit is read, one more is refused — also when a table would take it over', async () => {
    expect(await textOf(docx([para('a'.repeat(100))]), { maxChars: 100 })).toHaveLength(100)
    expect(await codeOf(docx([para('a'.repeat(101))]), { maxChars: 100 })).toBe('too_complex')
    // Two 49-character lines and the newline between them: 99.
    expect(await codeOf(docx([para('b'.repeat(49)), para('c'.repeat(49))]), { maxChars: 99 })).toBe('ok')
    expect(await codeOf(docx([para('b'.repeat(49)), para('c'.repeat(49))]), { maxChars: 98 })).toBe('too_complex')
    expect(await codeOf(docx([table([['x'.repeat(40), 'y'.repeat(40)]])]), { maxChars: 60 })).toBe('too_complex')
    // A share can only lower the production ceiling, never raise it.
    expect(await codeOf(docx([para('d'.repeat(20_001))]), { maxChars: 50_000 })).toBe('too_complex')
    expect(await codeOf(docx([para('d'.repeat(20_000))]), { maxChars: 50_000 })).toBe('ok')
  })

  it('file size: refused before a byte is parsed', async () => {
    const bytes = docx([para('Aperture 180 mm')])
    expect(await read(bytes, { limits: { maxBytes: bytes.byteLength - 1 } })).toEqual({ ok: false, code: 'too_large' })
    expect(partsRead).toEqual([])
    expect(await codeOf(bytes, { limits: { maxBytes: bytes.byteLength } })).toBe('ok')
  })

  it('deadline: checked while parsing, not after', async () => {
    const long = docx(Array.from({ length: 400 }, (_, index) => para(`Line ${index}`)))
    expect(await codeOf(long, { deadline: Date.now() - 1 })).toBe('timeout')
    let clock = 0
    // The clock advances on every check; the document is refused part-way through its paragraphs.
    expect(await codeOf(long, { now: () => clock++, deadline: 100 })).toBe('timeout')
    expect(clock).toBeGreaterThan(20)
  })
})

describe('boundaries of the implementation', () => {
  it('builds on the shared OOXML reader, adds no parser library, and never imports a test helper', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/utils/docxExtraction.ts'), 'utf8')
    expect(source).toContain('from \'./ooxmlReader\'')
    expect(source).not.toMatch(/from ['"](?:mammoth|docx|jszip|pizzip|officeparser|xml2js|cheerio|@xmldom|fast-xml-parser|libreoffice)/)
    expect(source).not.toMatch(/tests\/|helpers\/|node:fs|node:child_process|fetch\(/)
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { dependencies: Record<string, string>, devDependencies: Record<string, string> }
    for (const name of ['mammoth', 'docx', 'jszip', 'pizzip', 'officeparser', 'xml2js', 'cheerio']) {
      expect(pkg.dependencies[name], name).toBeUndefined()
      expect(pkg.devDependencies[name], name).toBeUndefined()
    }
  })

  it('every generated fixture is marked TEST ONLY', () => {
    const entries = docxEntries({ body: para('x') })
    expect(String(entries.find(entry => entry.name === 'docProps/core.xml')?.data)).toContain(TEST_ONLY_MARK)
  })
})
