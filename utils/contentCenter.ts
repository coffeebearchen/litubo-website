/**
 * CC-IMP-02 — Content Center List (CC-00), Workspace Shell and Overview (CC-01).
 *
 * Pure helpers shared by the admin pages and components. Every value they
 * format comes from the Content Center registries (types, blocks, locales) or
 * from a field the admin BFF actually returns (CONTENT-CENTER-BLUEPRINT-V1 §6.1).
 * Nothing here computes readiness, scores or AI state — those modules are not
 * built yet and are reported as unavailable, never estimated.
 */

import type {
  AdminContentDraft,
  AdminContentListItem,
  AdminContentLocaleDraft,
  ContentItemStatus,
} from '../types/content-center'
import { CONTENT_BLOCK_TYPES, type ContentBlockType } from './contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from './contentLocales'
import { CONTENT_TYPE_IDS, CONTENT_TYPES, getContentType, isContentTypeId, type ContentTypeId } from './contentTypes'

// ── Routes (Module Freeze §12) ───────────────────────────────────────────────

export const CONTENT_CENTER_LIST_ROUTE = '/admin/content-center'
export const CONTENT_CENTER_NEW_ROUTE = '/admin/content-center/new'

export function contentOverviewRoute(id: number | string): string {
  return `/admin/content-center/${encodeURIComponent(String(id))}/overview`
}

// ── Workspace module rail (Module Freeze §10–§12) ────────────────────────────

export interface ContentWorkspaceModule {
  key: string
  label: string
  /** Existing `WorkspaceNavIcon` glyph reused for this module. */
  icon: string
  /** Only a module whose implementation work order has landed is enabled. */
  enabled: boolean
  disabledReason?: string
}

/** Frozen order. Only Overview exists; every other entry is a visible, non-navigating placeholder. */
export const CONTENT_WORKSPACE_MODULES: readonly ContentWorkspaceModule[] = [
  { key: 'overview', label: 'Overview', icon: 'overview', enabled: true },
  { key: 'editor', label: 'Content editor', icon: 'page-content', enabled: true },
  { key: 'media-relations', label: 'Media & relations', icon: 'media-resources', enabled: true },
  { key: 'seo-locales', label: 'SEO & locales', icon: 'seo-locales', enabled: true },
  { key: 'ai-source-intake', label: 'AI Source Intake', icon: 'ai-source-intake', enabled: false, disabledReason: 'Not built yet' },
  { key: 'ai-proposal-review', label: 'AI Proposal Review', icon: 'sources-evidence', enabled: false, disabledReason: 'Not built yet' },
  { key: 'preview-publish', label: 'Preview & publish readiness', icon: 'share-distribution', enabled: true },
  { key: 'history', label: 'Change history', icon: 'change-history', enabled: false, disabledReason: 'Not built yet' },
]

/** CC-IMP-03 — CC-02 Content Editor. */
export function contentEditorRoute(id: number | string): string {
  return `/admin/content-center/${encodeURIComponent(String(id))}/editor`
}

/** CC-IMP-04 — CC-03 Media & Relations. */
export function contentMediaRelationsRoute(id: number | string): string {
  return `/admin/content-center/${encodeURIComponent(String(id))}/media-relations`
}

/** CC-IMP-05 — CC-04 SEO & Locales, optionally opened on one language. */
export function contentSeoLocalesRoute(id: number | string, locale?: string): string {
  const base = `/admin/content-center/${encodeURIComponent(String(id))}/seo-locales`
  return locale && locale !== DEFAULT_CONTENT_LOCALE ? `${base}?locale=${encodeURIComponent(locale)}` : base
}

/** CC-IMP-05 — the Content Editor on one language; the default language needs no query. */
export function contentEditorLocaleRoute(id: number | string, locale: string): string {
  const base = contentEditorRoute(id)
  return locale === DEFAULT_CONTENT_LOCALE ? base : `${base}?locale=${encodeURIComponent(locale)}`
}

/** CC-IMP-06 — CC-05 Preview & Publish Readiness, optionally opened on one language. */
export function contentPreviewPublishRoute(id: number | string, locale?: string): string {
  const base = `/admin/content-center/${encodeURIComponent(String(id))}/preview-publish`
  return locale && locale !== DEFAULT_CONTENT_LOCALE ? `${base}?locale=${encodeURIComponent(locale)}` : base
}

/** Routes exist only for enabled modules. */
export function contentWorkspaceModuleRoute(key: string, id: number | string): string | null {
  if (key === 'overview') return contentOverviewRoute(id)
  if (key === 'editor') return contentEditorRoute(id)
  if (key === 'media-relations') return contentMediaRelationsRoute(id)
  if (key === 'seo-locales') return contentSeoLocalesRoute(id)
  if (key === 'preview-publish') return contentPreviewPublishRoute(id)
  return null
}

/**
 * CC-IMP-05 — `?locale=` on a workspace page. Missing or empty means the default
 * language; anything that is not a site language is `null` (shown as an error,
 * never created).
 */
export function parseContentLocaleQuery(value: unknown): ContentLocale | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === null || raw === '') return DEFAULT_CONTENT_LOCALE
  return isContentLocale(raw) ? raw : null
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const CONTENT_STATUS_LABELS: Readonly<Record<ContentItemStatus, string>> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

export const CONTENT_LOCALE_LABELS: Readonly<Record<ContentLocale, string>> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
}

export const CONTENT_BLOCK_LABELS: Readonly<Record<ContentBlockType, string>> = {
  text: 'Text',
  key_points: 'Key points',
  image: 'Image',
  faq: 'FAQ',
  cta: 'Call to action',
  related_content: 'Related content',
  downloads: 'Downloads',
}

export const CONTENT_TYPE_OPTIONS: ReadonlyArray<{ value: ContentTypeId, label: string }> =
  CONTENT_TYPE_IDS.map(id => ({ value: id, label: CONTENT_TYPES[id].label }))

export const CONTENT_STATUS_OPTIONS: ReadonlyArray<{ value: ContentItemStatus, label: string }> =
  (Object.keys(CONTENT_STATUS_LABELS) as ContentItemStatus[]).map(value => ({ value, label: CONTENT_STATUS_LABELS[value] }))

export const CONTENT_LOCALE_OPTIONS: ReadonlyArray<{ value: ContentLocale, label: string }> =
  CONTENT_LOCALES.map(value => ({ value, label: CONTENT_LOCALE_LABELS[value] }))

export function contentTypeLabel(id: unknown): string {
  return getContentType(id)?.label ?? 'Unknown type'
}

export const CONTENT_READINESS_UNAVAILABLE = 'Not available yet'
/** CC-IMP-06 — the Overview does not compute readiness; it points to the module that does. */
export const CONTENT_READINESS_ELSEWHERE = 'Checked in Preview & publish'
export const CONTENT_AI_UNAVAILABLE = 'AI workflow not configured'

/** UTC so the server-rendered and hydrated text are identical. */
export function formatContentDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })} UTC`
}

export function formatContentDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── List (CC-00) ────────────────────────────────────────────────────────────

export const CONTENT_LIST_PAGE_SIZE = 25
export const CONTENT_SEARCH_MAX = 100

export interface ContentListFilterState {
  search: string
  contentType: string
  status: string
  locale: string
  page: number
}

function firstQueryValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

/** URL → state. Unknown values are dropped rather than sent to the API. */
export function parseContentListQuery(query: Record<string, unknown>): ContentListFilterState {
  const contentType = firstQueryValue(query.type)
  const status = firstQueryValue(query.status)
  const locale = firstQueryValue(query.locale)
  const page = Number.parseInt(firstQueryValue(query.page), 10)
  return {
    search: firstQueryValue(query.search).slice(0, CONTENT_SEARCH_MAX),
    contentType: isContentTypeId(contentType) ? contentType : '',
    status: (CONTENT_STATUS_OPTIONS.some(o => o.value === status)) ? status : '',
    locale: isContentLocale(locale) ? locale : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** State → URL query (empty values omitted, page 1 omitted). */
export function buildContentListQuery(state: ContentListFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.search.trim()) query.search = state.search.trim()
  if (state.contentType) query.type = state.contentType
  if (state.status) query.status = state.status
  if (state.locale) query.locale = state.locale
  if (state.page > 1) query.page = String(state.page)
  return query
}

/** State → `GET /api/admin/content-center` query. */
export function contentListApiQuery(state: ContentListFilterState): Record<string, string | number> {
  const query: Record<string, string | number> = { page: state.page, limit: CONTENT_LIST_PAGE_SIZE }
  if (state.search.trim()) query.search = state.search.trim()
  if (state.contentType) query.content_type = state.contentType
  if (state.status) query.status = state.status
  if (state.locale) query.locale = state.locale
  return query
}

export function hasActiveContentFilters(state: ContentListFilterState): boolean {
  return Boolean(state.search.trim() || state.contentType || state.status || state.locale)
}

export function contentPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / CONTENT_LIST_PAGE_SIZE))
}

type LocaleIdentity = Pick<AdminContentLocaleDraft, 'locale' | 'title' | 'slug'>

/** The default-locale draft, or the first locale draft when the default is missing. */
export function primaryContentLocale<T extends LocaleIdentity>(locales: readonly T[]): T | null {
  return locales.find(l => l.locale === DEFAULT_CONTENT_LOCALE) ?? locales[0] ?? null
}

export interface ContentListRow {
  id: number
  title: string
  slug: string | null
  typeLabel: string
  status: ContentItemStatus
  localeCodes: string[]
  updated: string
  overviewRoute: string
}

export function contentListRow(item: AdminContentListItem): ContentListRow {
  const primary = primaryContentLocale(item.locales)
  return {
    id: item.id,
    title: primary?.title || `Untitled content #${item.id}`,
    slug: primary?.slug ?? null,
    typeLabel: contentTypeLabel(item.content_type),
    status: item.status,
    localeCodes: item.locales.map(l => l.locale.toUpperCase()),
    updated: formatContentDate(item.date_updated ?? item.date_created),
    overviewRoute: contentOverviewRoute(item.id),
  }
}

// ── API errors (CC-IMP-01 error convention) ─────────────────────────────────

export type ContentCreateField = 'content_type' | 'title' | 'slug' | 'summary'
const CREATE_FIELDS: readonly ContentCreateField[] = ['content_type', 'title', 'slug', 'summary']

export interface ContentApiErrorView {
  status: number
  message: string
  field: ContentCreateField | null
}

export function contentApiErrorStatus(err: unknown): number {
  const e = err as { statusCode?: number, status?: number, response?: { status?: number } } | null
  return Number(e?.statusCode ?? e?.status ?? e?.response?.status ?? 0) || 0
}

/** Turns a BFF error into an English, user-facing message; never swallows it. */
export function interpretContentApiError(err: unknown): ContentApiErrorView {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: { field?: unknown } } } | null)?.data
  const serverMessage = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const rawField = payload?.data?.field
  const field = CREATE_FIELDS.includes(rawField as ContentCreateField) ? rawField as ContentCreateField : null

  switch (status) {
    case 400:
      return { status, field: null, message: 'The request could not be processed. Check the form and try again.' }
    case 401:
      return { status, field: null, message: 'Your session has expired. Sign in again to continue.' }
    case 403:
      return { status, field: null, message: 'You do not have permission to do this.' }
    case 404:
      return { status, field: null, message: 'This content item was not found.' }
    case 409:
      return { status, field, message: serverMessage ?? 'This conflicts with existing content.' }
    case 422:
      return { status, field, message: serverMessage ?? 'Some values are not valid.' }
    default:
      return { status, field: null, message: 'Content Center is temporarily unavailable. Try again in a moment.' }
  }
}

// ── Create Draft form ───────────────────────────────────────────────────────

export interface ContentCreateFormValue {
  content_type: string
  title: string
  slug: string
  summary: string
}

export function emptyContentCreateForm(): ContentCreateFormValue {
  return { content_type: '', title: '', slug: '', summary: '' }
}

/**
 * Required-field check only, so an obviously incomplete form is not sent.
 * Slug format, reserved words, lengths and uniqueness stay with the BFF and the
 * database, and their errors are shown as returned.
 */
export function missingContentCreateFields(form: ContentCreateFormValue): Partial<Record<ContentCreateField, string>> {
  const errors: Partial<Record<ContentCreateField, string>> = {}
  if (!isContentTypeId(form.content_type)) errors.content_type = 'Select a content type.'
  if (!form.title.trim()) errors.title = 'Enter a title.'
  if (!form.slug.trim()) errors.slug = 'Enter a slug.'
  return errors
}

export function contentCreateRequestBody(form: ContentCreateFormValue): Record<string, string> {
  const body: Record<string, string> = {
    content_type: form.content_type,
    title: form.title.trim(),
    slug: form.slug.trim(),
  }
  if (form.summary.trim()) body.summary = form.summary.trim()
  return body
}

// ── Overview (CC-01) ────────────────────────────────────────────────────────

export type ContentLocaleState = 'not_started' | 'draft' | 'published' | 'published_with_changes'

export const CONTENT_LOCALE_STATE_LABELS: Readonly<Record<ContentLocaleState, string>> = {
  not_started: 'Not started',
  draft: 'Draft',
  published: 'Published',
  published_with_changes: 'Published · unpublished changes',
}

/** Derived per Blueprint §8.1; `published_revision` is set only while a snapshot exists. */
export function contentLocaleState(row: Pick<AdminContentLocaleDraft, 'draft_revision' | 'published_revision'> | null): ContentLocaleState {
  if (!row) return 'not_started'
  if (row.published_revision === null || row.published_revision === undefined) return 'draft'
  return row.draft_revision > row.published_revision ? 'published_with_changes' : 'published'
}

export interface ContentLocaleSummaryRow {
  code: ContentLocale
  label: string
  isDefault: boolean
  state: ContentLocaleState
  stateLabel: string
  title: string | null
  draftRevision: number | null
}

export function contentLocaleSummary(draft: Pick<AdminContentDraft, 'locales'>): ContentLocaleSummaryRow[] {
  return CONTENT_LOCALES.map((code) => {
    const row = draft.locales.find(l => l.locale === code) ?? null
    const state = contentLocaleState(row)
    return {
      code,
      label: CONTENT_LOCALE_LABELS[code],
      isDefault: code === DEFAULT_CONTENT_LOCALE,
      state,
      stateLabel: CONTENT_LOCALE_STATE_LABELS[state],
      title: row?.title ?? null,
      draftRevision: row?.draft_revision ?? null,
    }
  })
}

export interface ContentBlockSummary {
  total: number
  byType: Array<{ type: ContentBlockType, label: string, count: number }>
}

export function contentBlockSummary(row: Pick<AdminContentLocaleDraft, 'blocks'> | null): ContentBlockSummary {
  const blocks = Array.isArray(row?.blocks) ? row.blocks : []
  const byType = CONTENT_BLOCK_TYPES
    .map(type => ({ type, label: CONTENT_BLOCK_LABELS[type], count: blocks.filter(b => b.type === type).length }))
    .filter(entry => entry.count > 0)
  return { total: blocks.length, byType }
}

export interface ContentSeoSummary {
  seoTitle: boolean
  seoDescription: boolean
  canonicalOverride: boolean
  noindex: boolean
}

export function contentSeoSummary(row: Pick<AdminContentLocaleDraft, 'seo_title' | 'seo_description' | 'canonical_path' | 'noindex'> | null): ContentSeoSummary {
  return {
    seoTitle: Boolean(row?.seo_title?.trim()),
    seoDescription: Boolean(row?.seo_description?.trim()),
    canonicalOverride: Boolean(row?.canonical_path?.trim()),
    noindex: row?.noindex === true,
  }
}

export function contentAllowedBlockLabels(typeId: unknown): string[] {
  return (getContentType(typeId)?.allowedBlocks ?? []).map(type => CONTENT_BLOCK_LABELS[type])
}
