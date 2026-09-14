/**
 * CC-IMP-01 — Content Center block type registry (CONTENT-CENTER-BLUEPRINT-V1 §9).
 *
 * Fail-closed: a block type not listed here is rejected on every write. The strict
 * per-type schemas live server-side in `server/utils/contentBlocks.ts`. Block text
 * is plain text — no field is ever rendered as HTML.
 */

export const CONTENT_BLOCK_TYPES = [
  'text',
  'key_points',
  'image',
  'faq',
  'cta',
  'related_content',
  'downloads',
] as const

export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number]

export interface ContentBlock {
  id: string
  type: ContentBlockType
  data: Record<string, unknown>
}

/** Blueprint §9: at most 60 blocks per locale row. */
export const MAX_BLOCKS_PER_LOCALE = 60

/** Blueprint §9: at most 200 KB (200 × 1024 bytes) of serialized block JSON per locale row. */
export const MAX_BLOCKS_JSON_BYTES = 200 * 1024

export const BLOCK_TEXT_LIMITS = {
  heading: 160,
  paragraph: 2000,
  paragraphsMax: 20,
  keyPointTitle: 120,
  keyPointBody: 600,
  keyPointsMax: 12,
  caption: 300,
  faqQuestion: 300,
  faqAnswer: 2000,
  faqItemsMax: 30,
  ctaBody: 600,
  ctaLabel: 60,
  ctaHref: 500,
} as const

export function isContentBlockType(value: unknown): value is ContentBlockType {
  return typeof value === 'string' && (CONTENT_BLOCK_TYPES as readonly string[]).includes(value)
}
