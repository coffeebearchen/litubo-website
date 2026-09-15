import type { ContentBlockType } from '../utils/contentBlocks'
import type { ContentLocale } from '../utils/contentLocales'
import type { ContentTypeId } from '../utils/contentTypes'

/**
 * CC-IMP-10 — public Content Center payloads (CONTENT-CENTER-BLUEPRINT-V1 §29;
 * RELEASE-SAFETY-GATES §3A.1). Every field is built by an explicit allowlist from a
 * published snapshot. No working-copy field, internal id, revision, AI, readiness,
 * history, source document or Directus field is part of these types.
 */

export interface PublicContentImage {
  url: string
  alt: string
  caption: string | null
}

export interface PublicContentCard {
  type: ContentTypeId
  typeLabel: string
  title: string
  summary: string
  href: string
  publishedAt: string | null
  image: PublicContentImage | null
}

export interface PublicContentList {
  items: PublicContentCard[]
}

/** A supported block with only its allowlisted plain-text data. Image blocks point at `images` by ordinal. */
export interface PublicContentBlock {
  id: string
  type: ContentBlockType
  data: Record<string, unknown>
}

export interface PublicContentLink {
  key: string
  label: string
  meta: string | null
  href: string
}

export interface PublicContentDetail {
  type: ContentTypeId
  typeLabel: string
  locale: ContentLocale
  slug: string
  title: string
  summary: string
  publishedAt: string | null
  hero: PublicContentImage | null
  blocks: PublicContentBlock[]
  /** Inline images by the ordinal used in image blocks (`fileLinkId`). */
  images: Record<string, PublicContentImage>
  downloads: PublicContentLink[]
  related: PublicContentLink[]
  seo: {
    title: string
    description: string
    canonicalPath: string
    noindex: boolean
    ogImageUrl: string | null
  }
}
