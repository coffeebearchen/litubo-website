import { createHash } from 'node:crypto'
import type { SeoMetaInput } from './aiTargets/seoMetaTarget'

/**
 * Shared between the assistant's proposal and confirm endpoints, so the two can never disagree about
 * what a proposal was based on, or about which column a confirmed value belongs in.
 *
 * The entities the assistant can write SEO for today. Each one names the table, the id column, the two
 * value columns and the columns the source text comes from. Adding a fourth entity means adding a row
 * here, not a new endpoint.
 */
export type SeoEntity = 'post' | 'contentItem'

export interface SeoEntitySpec {
  label: string
  /** Table the SEO columns live in. */
  table: string
  /** Column that identifies the row inside `table`. */
  idColumn: string
  titleColumn: string
  excerptColumn: string
  bodyColumn: string
  seoTitleColumn: string
  seoDescriptionColumn: string
  /** Fixed at 'en' while only the English site is public; the column names are per-locale. */
  locale: string
}

export const SEO_ENTITIES: Record<SeoEntity, SeoEntitySpec> = {
  post: {
    label: 'article',
    table: 'posts',
    idColumn: 'id',
    titleColumn: 'title_en',
    excerptColumn: 'excerpt_en',
    bodyColumn: 'body_en',
    seoTitleColumn: 'seo_title_en',
    seoDescriptionColumn: 'seo_description_en',
    locale: 'en',
  },
  contentItem: {
    label: 'content item',
    table: 'content_item_locales',
    idColumn: 'content_items_id',
    titleColumn: 'title',
    excerptColumn: 'summary',
    bodyColumn: 'blocks',
    seoTitleColumn: 'seo_title',
    seoDescriptionColumn: 'seo_description',
    locale: 'en',
  },
}

export function isSeoEntity(value: unknown): value is SeoEntity {
  return value === 'post' || value === 'contentItem'
}

/** One proposal per entity row: two articles cannot consume each other's reference. */
export function seoSubjectKey(entity: SeoEntity, id: number): string {
  return `seo:${entity}:${id}`
}

export function seoFingerprint(entity: SeoEntity, id: number, input: SeoMetaInput): string {
  return createHash('sha256')
    .update(JSON.stringify([entity, id, input.locale, input.kind, input.title, input.excerpt, input.body]), 'utf8')
    .digest('hex')
}

/** Strips markup the model must not see as instructions, and flattens whitespace. */
export function stripToText(value: unknown, limit = 3000): string {
  if (typeof value !== 'string') {
    // `blocks` on a content locale is structured JSON; its text is what matters here.
    if (value && typeof value === 'object') return JSON.stringify(value).replace(/[{}"[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
    return ''
  }
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

export function toSeoInput(
  entity: SeoEntity,
  row: Record<string, unknown>,
  kind: string,
): SeoMetaInput {
  const spec = SEO_ENTITIES[entity]
  return {
    sourceFileSummaries: [],
    extractedSourceTexts: [],
    kind,
    locale: spec.locale,
    title: stripToText(row[spec.titleColumn], 300),
    excerpt: stripToText(row[spec.excerptColumn], 600),
    body: stripToText(row[spec.bodyColumn], 3000),
  }
}
