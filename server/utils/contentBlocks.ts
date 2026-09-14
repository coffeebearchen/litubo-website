import { z } from 'zod'
import {
  BLOCK_TEXT_LIMITS as L,
  MAX_BLOCKS_JSON_BYTES,
  MAX_BLOCKS_PER_LOCALE,
  emptyBlockData,
  type ContentBlock,
  type ContentBlockType,
} from '../../utils/contentBlocks'
import { CONTENT_TYPES, type ContentTypeId } from '../../utils/contentTypes'

/**
 * CC-IMP-01 — strict block validation (CONTENT-CENTER-BLUEPRINT-V1 §9).
 *
 * Every write of `content_item_locales.blocks` passes through `validateBlocks`:
 * unknown block types, unknown keys, bounded lengths and item counts, at most
 * MAX_BLOCKS_PER_LOCALE blocks and MAX_BLOCKS_JSON_BYTES of serialized JSON.
 *
 * Draft storage allows empty strings (a new draft starts with empty block text);
 * "is this content complete" is a readiness rule of the Publish module, not a
 * storage rule. All values are plain text — nothing here is ever HTML.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INTERNAL_PATH_RE = /^\/(?!\/)\S*$/

export function isValidCtaHref(value: string): boolean {
  if (value === '') return true
  if (INTERNAL_PATH_RE.test(value)) return true
  if (/\s/.test(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const heading = z.string().max(L.heading).optional()

const TextData = z.object({
  heading,
  paragraphs: z.array(z.string().max(L.paragraph)).min(1).max(L.paragraphsMax),
}).strict()

const KeyPointsData = z.object({
  heading,
  items: z.array(z.object({
    title: z.string().max(L.keyPointTitle),
    body: z.string().max(L.keyPointBody).optional(),
  }).strict()).min(1).max(L.keyPointsMax),
}).strict()

const ImageData = z.object({
  fileLinkId: z.number().int().positive(),
  caption: z.string().max(L.caption).optional(),
}).strict()

const FaqData = z.object({
  heading,
  items: z.array(z.object({
    question: z.string().max(L.faqQuestion),
    answer: z.string().max(L.faqAnswer),
  }).strict()).min(1).max(L.faqItemsMax),
}).strict()

const CtaData = z.object({
  heading,
  body: z.string().max(L.ctaBody).optional(),
  label: z.string().max(L.ctaLabel),
  href: z.string().max(L.ctaHref).refine(isValidCtaHref, {
    message: 'href must be empty, an internal path starting with "/", or an https:// URL',
  }),
}).strict()

const HeadingOnlyData = z.object({ heading }).strict()

const blockId = z.string().regex(UUID_RE, 'block id must be a UUID')

export const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('text'), data: TextData }).strict(),
  z.object({ id: blockId, type: z.literal('key_points'), data: KeyPointsData }).strict(),
  z.object({ id: blockId, type: z.literal('image'), data: ImageData }).strict(),
  z.object({ id: blockId, type: z.literal('faq'), data: FaqData }).strict(),
  z.object({ id: blockId, type: z.literal('cta'), data: CtaData }).strict(),
  z.object({ id: blockId, type: z.literal('related_content'), data: HeadingOnlyData }).strict(),
  z.object({ id: blockId, type: z.literal('downloads'), data: HeadingOnlyData }).strict(),
])

export type BlocksValidation =
  | { ok: true, blocks: ContentBlock[] }
  | { ok: false, errors: string[] }

const MAX_REPORTED_ERRORS = 20

export function blocksJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

/** Validates a whole blocks array. `allowedTypes` narrows the accepted block types (per content type). */
export function validateBlocks(input: unknown, allowedTypes?: readonly ContentBlockType[]): BlocksValidation {
  if (!Array.isArray(input)) return { ok: false, errors: ['blocks must be an array'] }
  if (input.length > MAX_BLOCKS_PER_LOCALE) {
    return { ok: false, errors: [`at most ${MAX_BLOCKS_PER_LOCALE} blocks are allowed`] }
  }
  if (blocksJsonBytes(input) > MAX_BLOCKS_JSON_BYTES) {
    return { ok: false, errors: [`blocks exceed ${MAX_BLOCKS_JSON_BYTES} bytes`] }
  }

  const errors: string[] = []
  const blocks: ContentBlock[] = []
  const seenIds = new Set<string>()

  input.forEach((raw, index) => {
    if (errors.length >= MAX_REPORTED_ERRORS) return
    const parsed = ContentBlockSchema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const path = issue?.path?.length ? `.${issue.path.join('.')}` : ''
      errors.push(`blocks[${index}]${path}: ${issue?.message ?? 'invalid block'}`)
      return
    }
    const block = parsed.data as ContentBlock
    if (seenIds.has(block.id)) {
      errors.push(`blocks[${index}].id: duplicate block id`)
      return
    }
    seenIds.add(block.id)
    if (allowedTypes && !allowedTypes.includes(block.type)) {
      errors.push(`blocks[${index}].type: "${block.type}" is not allowed for this content type`)
      return
    }
    blocks.push(block)
  })

  return errors.length > 0 ? { ok: false, errors } : { ok: true, blocks }
}

/** Empty draft data for a block type — defined in the shared registry (utils/contentBlocks.ts). */
export { emptyBlockData }

/** Default blocks for a new draft of `typeId`, each with a fresh server-generated id. */
export function createDefaultBlocks(typeId: ContentTypeId, newId: () => string): ContentBlock[] {
  return CONTENT_TYPES[typeId].defaultBlocks.map((type) => {
    if (type === 'image') throw new Error('image blocks cannot be default blocks')
    return { id: newId(), type, data: emptyBlockData(type) }
  })
}

/**
 * Blueprint §15: a new locale starts from the default locale's block structure —
 * same ids and types, empty text. An image block keeps its (locale-neutral) file link.
 */
export function blockStructureForNewLocale(source: ContentBlock): ContentBlock {
  if (source.type === 'image') {
    return { id: source.id, type: 'image', data: { fileLinkId: source.data.fileLinkId } }
  }
  return { id: source.id, type: source.type, data: emptyBlockData(source.type) }
}
