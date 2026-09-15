import type { ContentBlock } from '../utils/contentBlocks'
import type { ContentLocale } from '../utils/contentLocales'
import type { ContentTypeId } from '../utils/contentTypes'

/** CC-IMP-01 — admin read shapes for Content Center drafts (CONTENT-CENTER-BLUEPRINT-V1 §6.1). */

export type ContentItemStatus = 'draft' | 'published' | 'archived'

export type ContentChangeKind = 'manual_edit' | 'ai_apply' | 'publish' | 'unpublish' | 'restore'

export interface AdminContentLocaleDraft {
  id: number
  content_items_id: number
  locale: ContentLocale
  title: string
  slug: string
  summary: string | null
  blocks: ContentBlock[]
  seo_title: string | null
  seo_description: string | null
  canonical_path: string | null
  noindex: boolean
  draft_revision: number
  published_revision: number | null
  published_at: string | null
  first_published_at: string | null
  last_change_kind: ContentChangeKind
}

export interface AdminContentDraft {
  id: number
  content_type: ContentTypeId
  status: ContentItemStatus
  first_published_at: string | null
  archived_at: string | null
  date_created: string | null
  date_updated: string | null
  locales: AdminContentLocaleDraft[]
}

/** CC-IMP-02 — real row counts shown read-only on the CC-01 Overview. */
export interface AdminContentLinkCounts {
  media: number
  relations: number
}

/** CC-IMP-02 — `GET /api/admin/content-center/:id`: the draft plus its link counts. */
export interface AdminContentDraftDetail extends AdminContentDraft {
  linkCounts: AdminContentLinkCounts
}

/** CC-IMP-04 — one Media Library file linked with a role this module manages. */
export interface AdminContentMediaLink {
  id: number
  directus_files_id: string
  file_role: 'hero' | 'inline' | 'download'
  /** `alt_<locale>` / `caption_<locale>` for the requested locale. */
  alt: string | null
  caption: string | null
  language: 'all' | 'en' | 'es' | 'pt' | null
  version_label: string | null
  file_date: string | null
  enabled: boolean
  sort: number | null
  /** Referenced by an `image` block in any locale, so it cannot be unlinked here. */
  used_by_image_blocks: boolean
  file: {
    filename_download: string | null
    title: string | null
    type: string | null
    filesize: number | null
    width: number | null
    height: number | null
    is_public: boolean
    archived: boolean
  }
}

/** CC-IMP-04 — a product or content relation, with the target read from its own collection. */
export interface AdminContentRelation {
  id: number
  relation_kind: 'product' | 'content'
  sort: number | null
  product: { id: number, name_en: string | null, product_code: string | null, status: string | null } | null
  content: { id: number, title: string | null, content_type: string | null, status: string | null } | null
}

/** CC-IMP-04 — `GET` / `PUT /api/admin/content-center/:id/media-relations`. */
export interface AdminContentMediaRelations {
  item: { id: number, content_type: ContentTypeId, status: ContentItemStatus, title: string | null }
  locale: ContentLocale
  media: AdminContentMediaLink[]
  /** Links owned by other modules (SEO & Locales, AI Source Intake) — counted, never changed here. */
  preserved_role_counts: { og_image: number, source_document: number }
  relations: AdminContentRelation[]
  /** Fingerprint of every file link and relation row; a save must send the one it loaded. */
  inventory_version: string
}

/** CC-IMP-05 — a hero or Open Graph image link as the SEO & Locales page needs it. */
export interface AdminContentSeoImage {
  link_id: number
  directus_files_id: string
  enabled: boolean
  file: {
    filename_download: string | null
    title: string | null
    type: string | null
    width: number | null
    height: number | null
    filesize: number | null
    is_public: boolean
    archived: boolean
  }
}

/** CC-IMP-05 — a locale draft without its blocks (the SEO page does not edit sections). */
export type AdminContentSeoLocaleRow = Omit<AdminContentLocaleDraft, 'blocks'> & { block_count: number }

/** CC-IMP-05 — `GET` / `PUT /api/admin/content-center/:id/seo-locales`. */
export interface AdminContentSeoLocales {
  item: { id: number, content_type: ContentTypeId, status: ContentItemStatus, title: string | null }
  default_locale: ContentLocale
  /** i18n `locales`, in configuration order. */
  site_locales: ContentLocale[]
  /** `runtimeConfig.public.publishedLocales` — languages the public site serves. */
  published_locales: ContentLocale[]
  /** Existing locale rows only; a site locale without a row is "Not started". */
  locales: AdminContentSeoLocaleRow[]
  og_image: AdminContentSeoImage | null
  /** Enabled hero, shown as the preview fallback when there is no Open Graph image. */
  hero: AdminContentSeoImage | null
  /** Fingerprint of the item's `og_image` links; an image change must send the one it loaded. */
  og_version: string
}

export interface AdminContentListItem {
  id: number
  content_type: ContentTypeId
  status: ContentItemStatus
  date_created: string | null
  date_updated: string | null
  locales: Array<Pick<AdminContentLocaleDraft, 'locale' | 'title' | 'slug' | 'draft_revision'>>
}

export interface AdminContentList {
  data: AdminContentListItem[]
  total: number
  page: number
  limit: number
}
