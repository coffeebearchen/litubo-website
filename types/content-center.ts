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
