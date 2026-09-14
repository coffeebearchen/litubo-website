/**
 * CC-IMP-01 — Content Center block validation (CONTENT-CENTER-BLUEPRINT-V1 §9).
 * Strict schemas, unknown type/key rejection, bounded lengths and counts, the
 * 60-block and 200 KB limits (tested at the exact boundary), plain-text only.
 */

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  blockStructureForNewLocale,
  blocksJsonBytes,
  createDefaultBlocks,
  isValidCtaHref,
  validateBlocks,
} from '../server/utils/contentBlocks'
import {
  BLOCK_TEXT_LIMITS,
  CONTENT_BLOCK_TYPES,
  MAX_BLOCKS_JSON_BYTES,
  MAX_BLOCKS_PER_LOCALE,
  type ContentBlock,
} from '../utils/contentBlocks'
import { CONTENT_TYPE_IDS, CONTENT_TYPES } from '../utils/contentTypes'

const newId = () => randomUUID()

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  text: { heading: 'TEST ONLY — NOT FOR PUBLICATION', paragraphs: ['First paragraph.'] },
  key_points: { heading: 'Key points', items: [{ title: 'Point', body: 'Body' }] },
  image: { fileLinkId: 7, caption: 'Caption' },
  faq: { items: [{ question: 'Question?', answer: 'Answer.' }] },
  cta: { heading: 'Talk to us', label: 'Contact', href: '/contact' },
  related_content: { heading: 'Related' },
  downloads: {},
}

const block = (type: string, data: unknown = SAMPLE_DATA[type]) => ({ id: newId(), type, data })

describe('block registry — accepted shapes', () => {
  it.each(CONTENT_BLOCK_TYPES)('accepts a valid %s block', (type) => {
    const result = validateBlocks([block(type)])
    expect(result.ok).toBe(true)
  })

  it('accepts an empty blocks array', () => {
    expect(validateBlocks([])).toEqual({ ok: true, blocks: [] })
  })

  it('does not include hero as a block type (hero is the item template header)', () => {
    expect((CONTENT_BLOCK_TYPES as readonly string[]).includes('hero')).toBe(false)
  })
})

describe('block registry — fail closed', () => {
  it('rejects a non-array', () => {
    expect(validateBlocks({ type: 'text' }).ok).toBe(false)
  })

  it('rejects an unknown block type', () => {
    expect(validateBlocks([block('hero', { title: 'x' })]).ok).toBe(false)
    expect(validateBlocks([block('rich_html', { html: '<p>x</p>' })]).ok).toBe(false)
  })

  it('rejects an unknown key inside block data', () => {
    const result = validateBlocks([block('text', { paragraphs: ['a'], html: '<b>x</b>' })])
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown key on the block envelope', () => {
    expect(validateBlocks([{ ...block('text'), extra: true }]).ok).toBe(false)
  })

  it('rejects an unknown key inside a nested item', () => {
    expect(validateBlocks([block('faq', { items: [{ question: 'q', answer: 'a', score: 1 }] })]).ok).toBe(false)
  })

  it('rejects a block id that is not a UUID', () => {
    expect(validateBlocks([{ id: 'block-1', type: 'text', data: SAMPLE_DATA.text }]).ok).toBe(false)
  })

  it('rejects duplicate block ids', () => {
    const one = block('text')
    expect(validateBlocks([one, { ...one }]).ok).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(validateBlocks([block('text', {})]).ok).toBe(false)
    expect(validateBlocks([block('image', {})]).ok).toBe(false)
    expect(validateBlocks([block('cta', { href: '/x' })]).ok).toBe(false)
  })

  it('enforces text lengths', () => {
    const tooLong = 'a'.repeat(BLOCK_TEXT_LIMITS.paragraph + 1)
    expect(validateBlocks([block('text', { paragraphs: [tooLong] })]).ok).toBe(false)
    expect(validateBlocks([block('text', { paragraphs: ['a'.repeat(BLOCK_TEXT_LIMITS.paragraph)] })]).ok).toBe(true)
    expect(validateBlocks([block('text', { heading: 'h'.repeat(BLOCK_TEXT_LIMITS.heading + 1), paragraphs: ['a'] })]).ok).toBe(false)
  })

  it('enforces item counts', () => {
    expect(validateBlocks([block('key_points', { items: [] })]).ok).toBe(false)
    const many = Array.from({ length: BLOCK_TEXT_LIMITS.keyPointsMax + 1 }, () => ({ title: 't' }))
    expect(validateBlocks([block('key_points', { items: many })]).ok).toBe(false)
    const paragraphs = Array.from({ length: BLOCK_TEXT_LIMITS.paragraphsMax + 1 }, () => 'p')
    expect(validateBlocks([block('text', { paragraphs })]).ok).toBe(false)
  })

  it('rejects a non-positive or non-integer image fileLinkId', () => {
    expect(validateBlocks([block('image', { fileLinkId: 0 })]).ok).toBe(false)
    expect(validateBlocks([block('image', { fileLinkId: 1.5 })]).ok).toBe(false)
    expect(validateBlocks([block('image', { fileLinkId: '7' })]).ok).toBe(false)
  })

  it('narrows accepted types to the content type', () => {
    const news = CONTENT_TYPES.news
    expect(validateBlocks([block('faq')], news.allowedBlocks).ok).toBe(false)
    expect(validateBlocks([block('text')], news.allowedBlocks).ok).toBe(true)
  })
})

describe('cta href', () => {
  it.each(['', '/contact', '/resources/insights?x=1', 'https://litubo.com/contact'])('accepts %j', (href) => {
    expect(isValidCtaHref(href)).toBe(true)
  })

  it.each(['http://litubo.com', '//evil.example', 'javascript:alert(1)', 'mailto:a@b.c', 'contact', '/has space'])('rejects %j', (href) => {
    expect(isValidCtaHref(href)).toBe(false)
  })
})

describe('block count limit', () => {
  const small = () => block('related_content', {})

  it(`allows exactly ${MAX_BLOCKS_PER_LOCALE} blocks`, () => {
    expect(validateBlocks(Array.from({ length: MAX_BLOCKS_PER_LOCALE }, small)).ok).toBe(true)
  })

  it(`rejects ${MAX_BLOCKS_PER_LOCALE + 1} blocks`, () => {
    expect(validateBlocks(Array.from({ length: MAX_BLOCKS_PER_LOCALE + 1 }, small)).ok).toBe(false)
  })
})

/**
 * Builds a valid blocks array whose serialized JSON is exactly `target` bytes.
 * Full text blocks fill most of the space; the last block has fixed full
 * paragraphs plus one variable heading (0–160) and one variable paragraph
 * (0–2000), which together cover every remainder, so the result is exact.
 */
function blocksWithExactBytes(target: number): ContentBlock[] {
  const fullParagraph = 'a'.repeat(BLOCK_TEXT_LIMITS.paragraph)
  const fullBlock = (): ContentBlock => ({ id: newId(), type: 'text', data: { paragraphs: Array.from({ length: 10 }, () => fullParagraph) } })
  const tailBlock = (m: number, heading = '', last = ''): ContentBlock => ({
    id: '00000000-0000-4000-8000-000000000000',
    type: 'text',
    data: { heading, paragraphs: [...Array.from({ length: m }, () => fullParagraph), last] },
  })

  for (let n = 0; n < MAX_BLOCKS_PER_LOCALE; n++) {
    const head = Array.from({ length: n }, fullBlock)
    for (let m = 0; m < BLOCK_TEXT_LIMITS.paragraphsMax; m++) {
      const gap = target - blocksJsonBytes([...head, tailBlock(m)])
      if (gap >= 0 && gap <= BLOCK_TEXT_LIMITS.paragraph + BLOCK_TEXT_LIMITS.heading) {
        const paragraph = Math.min(gap, BLOCK_TEXT_LIMITS.paragraph)
        const blocks = [...head, tailBlock(m, 'h'.repeat(gap - paragraph), 'b'.repeat(paragraph))]
        expect(blocksJsonBytes(blocks)).toBe(target)
        return blocks
      }
    }
  }
  throw new Error(`could not build exactly ${target} bytes`)
}

describe('block payload size limit', () => {
  it(`allows exactly ${MAX_BLOCKS_JSON_BYTES} bytes`, () => {
    const blocks = blocksWithExactBytes(MAX_BLOCKS_JSON_BYTES)
    expect(validateBlocks(blocks).ok).toBe(true)
  })

  it(`rejects ${MAX_BLOCKS_JSON_BYTES + 1} bytes`, () => {
    const blocks = blocksWithExactBytes(MAX_BLOCKS_JSON_BYTES + 1)
    const result = validateBlocks(blocks)
    expect(result.ok).toBe(false)
  })
})

describe('default and translation block structures', () => {
  it.each(CONTENT_TYPE_IDS)('default blocks of %s are valid and allowed for the type', (typeId) => {
    const blocks = createDefaultBlocks(typeId, newId)
    expect(blocks.map(b => b.type)).toEqual([...CONTENT_TYPES[typeId].defaultBlocks])
    expect(validateBlocks(blocks, CONTENT_TYPES[typeId].allowedBlocks).ok).toBe(true)
  })

  it('a new locale keeps block ids and types with empty text', () => {
    const source: ContentBlock[] = [
      { id: newId(), type: 'text', data: { heading: 'H', paragraphs: ['Filled'] } },
      { id: newId(), type: 'image', data: { fileLinkId: 3, caption: 'C' } },
      { id: newId(), type: 'cta', data: { label: 'Go', href: '/contact' } },
    ]
    const copy = source.map(blockStructureForNewLocale)
    expect(copy.map(b => [b.id, b.type])).toEqual(source.map(b => [b.id, b.type]))
    expect(copy[0].data).toEqual({ paragraphs: [''] })
    expect(copy[1].data).toEqual({ fileLinkId: 3 })
    expect(copy[2].data).toEqual({ label: '', href: '' })
    expect(validateBlocks(copy).ok).toBe(true)
  })
})
