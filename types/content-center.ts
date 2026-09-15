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

/** CC-IMP-06 — one deterministic readiness result (Blueprint §21): no score, weight or percentage. */
export type ContentReadinessState = 'pass' | 'fail' | 'warn'

export interface ContentReadinessCheck {
  key: string
  /** Hard checks are `pass` / `fail`; soft checks are `pass` / `warn`. */
  state: ContentReadinessState
  label: string
  detail: string | null
}

export interface ContentReadiness {
  locale: ContentLocale
  /** Every hard check passes. Being ready never publishes anything. */
  ready: boolean
  hard: ContentReadinessCheck[]
  soft: ContentReadinessCheck[]
}

/** CC-IMP-06 — a Media Library file as the admin Draft preview shows it. */
export interface AdminContentPreviewMedia {
  link_id: number
  role: 'hero' | 'og_image' | 'inline' | 'download'
  directus_files_id: string
  alt: string | null
  caption: string | null
  enabled: boolean
  language: string | null
  version_label: string | null
  file_date: string | null
  /** The link exists but its Media Library file does not. */
  missing: boolean
  file: {
    filename_download: string | null
    title: string | null
    type: string | null
    width: number | null
    height: number | null
    is_public: boolean
    archived: boolean
  } | null
}

export interface AdminContentPreviewRelation {
  id: number
  relation_kind: 'product' | 'content'
  /** Admin label: product name / code, or the related content's title in the previewed language only. */
  label: string | null
  target_id: number | null
  status: string | null
}

/** CC-IMP-06 — the working copy of one language as the admin Draft preview renders it. Never public. */
export interface AdminContentPreview {
  title: string
  slug: string
  summary: string | null
  blocks: unknown[]
  seo: {
    title: string
    title_source: 'seo' | 'fallback' | 'none'
    description: string
    description_source: 'seo' | 'fallback' | 'none'
    canonical_path: string | null
    noindex: boolean
  }
  hero: AdminContentPreviewMedia | null
  og_image: AdminContentPreviewMedia | null
  /** Inline links referenced by this language's image sections. */
  inline: AdminContentPreviewMedia[]
  /** Enabled download links, shown by a downloads section. */
  downloads: AdminContentPreviewMedia[]
  relations: AdminContentPreviewRelation[]
}

export interface AdminContentPublicationLocale {
  locale: ContentLocale
  started: boolean
  state: 'not_started' | 'draft' | 'published' | 'published_with_changes'
  draft_revision: number | null
  published_revision: number | null
  published_at: string | null
  first_published_at: string | null
}

/** CC-IMP-06 — `GET /api/admin/content-center/:id/preview-publish?locale=`. */
export interface AdminContentPreviewPublish {
  item: {
    id: number
    content_type: ContentTypeId
    status: ContentItemStatus
    first_published_at: string | null
    archived_at: string | null
    title: string | null
  }
  type: { label: string, public_enabled: boolean, hero_required: boolean, requires_download_file: boolean }
  default_locale: ContentLocale
  site_locales: ContentLocale[]
  published_locales: ContentLocale[]
  locale: ContentLocale
  locales: AdminContentPublicationLocale[]
  /** `null` when this language has not been started — never another language's content. */
  preview: AdminContentPreview | null
  readiness: ContentReadiness
  /** Server fingerprint of every readiness / snapshot input; Publish must send it back (Review Fix 01). */
  publicationInputFingerprint: string
  publication: {
    has_snapshot: boolean
    published_revision: number | null
    published_at: string | null
    first_published_at: string | null
    /** The Draft differs from the published snapshot (text, media or relations). */
    unpublished_changes: boolean
  }
  /** Something of this language (or, for the default language, of the item) is published. */
  can_unpublish: boolean
}

/** CC-IMP-06 — inputs of the safe structured-content renderer, already resolved by the caller. */
export interface ContentRendererImage {
  src: string | null
  alt: string
  caption: string | null
  note: string | null
}

export interface ContentRendererListEntry {
  key: string | number
  label: string
  meta: string | null
  note: string | null
}

export type ContentPublicationOutcome = 'published' | 'already_published' | 'unpublished' | 'already_unpublished'

/** CC-IMP-06 — `POST …/locales/:locale/publish` and `…/unpublish`. */
export interface AdminContentPublicationResult {
  result: ContentPublicationOutcome
  state: AdminContentPreviewPublish
}

/**
 * CC-IMP-06 — the published snapshot stored in `content_item_locales.published_snapshot`
 * (Blueprint §23). Built server-side by an explicit allowlist; it is the only content
 * a future public reader may use. It never holds working-copy metadata, AI, readiness,
 * history, `source_document` files or Directus system fields.
 */
export interface ContentSnapshotFileRef {
  linkId: number
  fileId: string
  alt: string | null
  caption: string | null
}

export interface ContentSnapshotDownloadRef extends ContentSnapshotFileRef {
  language: string | null
  versionLabel: string | null
  fileDate: string | null
}

export interface ContentPublishedSnapshot {
  version: 1
  contentType: ContentTypeId
  locale: ContentLocale
  publishedRevision: number
  title: string
  slug: string
  summary: string
  blocks: ContentBlock[]
  seo: { title: string, description: string, canonicalPath: string | null, noindex: boolean }
  media: {
    hero: ContentSnapshotFileRef | null
    /** Open Graph image, or the hero when there is none (fallback resolved at publish). */
    ogImage: ContentSnapshotFileRef | null
    inline: ContentSnapshotFileRef[]
    downloads: ContentSnapshotDownloadRef[]
  }
  relations: { products: number[], content: number[] }
}

/** CC-IMP-07 — item lifecycle as the Change History page shows it (Blueprint §8, §24). */
export interface AdminContentLifecycle {
  status: ContentItemStatus
  archived_at: string | null
  first_published_at: string | null
  /** Languages that currently hold a published snapshot (kept but unreadable while archived). */
  published_locales: ContentLocale[]
  /** Server fingerprint of the lifecycle and publication state; Archive / Restore must send it back. */
  lifecycleFingerprint: string
  can_archive: boolean
  can_restore: boolean
}

export type ContentLifecycleOutcome = 'archived' | 'restored'

/** CC-IMP-07 — `POST /api/admin/content-center/:id/archive` and `…/restore`. */
export interface AdminContentLifecycleResult {
  result: ContentLifecycleOutcome
  lifecycle: AdminContentLifecycle
}

export type ContentHistoryEventKind =
  | 'created' | 'locale_started' | 'draft_updated' | 'seo_updated' | 'ai_applied'
  | 'published' | 'unpublished' | 'archived' | 'restored' | 'status_changed'
  | 'media_linked' | 'media_updated' | 'relation_added' | 'relation_updated' | 'updated'

export type ContentHistoryCategory = 'Lifecycle' | 'Publication' | 'Draft' | 'SEO' | 'Language' | 'Media' | 'Relations' | 'AI' | 'Other'

/** CC-IMP-07 — one read-only event derived from a Directus revision. Only safe, human-readable fields. */
export interface AdminContentHistoryEvent {
  id: string
  timestamp: string | null
  kind: ContentHistoryEventKind
  category: ContentHistoryCategory
  label: string
  locale: ContentLocale | null
  /** What the event concerns, e.g. "Hero image · hero.png" or "Product". */
  area: string | null
  /** Changed field names in plain words — never the values. */
  changes: string[]
  actor: string
  revision: number | null
}

/** CC-IMP-07 — `GET /api/admin/content-center/:id/history?page=`. */
export interface AdminContentHistory {
  item: { id: number, content_type: ContentTypeId, status: ContentItemStatus, title: string | null }
  lifecycle: AdminContentLifecycle
  events: AdminContentHistoryEvent[]
  page: number
  limit: number
  total: number
  pages: number
  /** A source reached its read cap; older events may be missing. */
  truncated: boolean
  limitations: string[]
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
