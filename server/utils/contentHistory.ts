import type { FetchFn } from './mediaLifecycle'
import { buildLifecycleState, lifecycleItemTitle, loadLifecycleContext } from './contentLifecycle'
import { isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import type { ContentTypeId } from '../../utils/contentTypes'
import type {
  AdminContentHistory,
  AdminContentHistoryEvent,
  ContentHistoryCategory,
  ContentHistoryEventKind,
} from '../../types/content-center'

/**
 * CC-IMP-07 — read-only Change History (CONTENT-CENTER-BLUEPRINT-V1 §19, §20).
 *
 * Sourced only from Directus revisions (with their activity: action, time, actor) for this
 * item's own rows — the item, its locale rows, its current media links and relations —
 * plus the `last_change_kind` marker every Content Center write carries. No audit
 * collection, no rollback, no write. Events are derived only from recorded evidence;
 * anything that cannot be classified is "Content updated". Output is a safe DTO: event
 * labels and changed field *names*, never stored values, IP addresses, user agents or
 * raw revision JSON.
 *
 * Limitation (recorded on the page): Directus revisions of media links and relations do
 * not carry the owning content item id, and a deletion has no revision, so removed links
 * cannot be attributed to this item and are not listed.
 */

export const HISTORY_PAGE_SIZE = 25
export const HISTORY_SOURCE_LIMIT = 2000

const REVISION_FIELDS = [
  'id', 'collection', 'item', 'delta',
  'activity.id', 'activity.action', 'activity.timestamp',
  'activity.user.first_name', 'activity.user.last_name', 'activity.user.email',
].join(',')

export interface HistoryRevision {
  id: number
  collection: string
  item: string | number
  delta: unknown
  activity: {
    id?: number
    action?: string
    timestamp?: string
    user?: { first_name?: string | null, last_name?: string | null, email?: string | null } | string | null
  } | null
}

export interface HistoryLookups {
  itemId: number
  localeByRowId: Map<string, ContentLocale>
  fileByLinkId: Map<string, { role: string, name: string | null }>
  relationById: Map<string, { kind: string }>
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title', slug: 'URL slug', summary: 'Summary', blocks: 'Sections', seo_title: 'SEO title', seo_description: 'Meta description',
  canonical_path: 'Canonical path', noindex: 'Search indexing', published_snapshot: 'Published version', published_at: 'Publication date',
  published_revision: 'Published revision', first_published_at: 'First publication date', status: 'Status', archived_at: 'Archive date',
  content_type: 'Content type', locale: 'Language',
  alt_en: 'Alt text', alt_es: 'Alt text', alt_pt: 'Alt text', caption_en: 'Caption', caption_es: 'Caption', caption_pt: 'Caption',
  enabled: 'Enabled', sort: 'Order', language: 'Download language', version_label: 'Version', file_date: 'File date',
  file_role: 'Role', directus_files_id: 'File', relation_kind: 'Kind', product_id: 'Product', related_content_id: 'Related content',
}
const META_FIELDS = new Set(['draft_revision', 'last_change_kind', 'content_items_id', 'id', 'date_created', 'date_updated', 'user_created', 'user_updated'])
const SEO_FIELDS = new Set(['slug', 'seo_title', 'seo_description', 'canonical_path', 'noindex'])
const ROLE_LABELS: Record<string, string> = { hero: 'Hero image', og_image: 'Open Graph image', inline: 'Inline image', download: 'Download', source_document: 'Source document' }

function deltaOf(revision: HistoryRevision): Record<string, unknown> {
  let value = revision.delta
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function changedLabels(delta: Record<string, unknown>): string[] {
  const labels = Object.keys(delta).filter(key => !META_FIELDS.has(key)).map(key => FIELD_LABELS[key] ?? 'Other fields')
  return [...new Set(labels)]
}

export function historyActor(user: NonNullable<HistoryRevision['activity']>['user']): string {
  if (!user || typeof user !== 'object') return 'System / Unknown'
  const name = [user.first_name, user.last_name].map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean).join(' ')
  if (name) return name
  return typeof user.email === 'string' && user.email.trim() ? user.email.trim() : 'System / Unknown'
}

const numberOr = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null)

function event(
  revision: HistoryRevision,
  kind: ContentHistoryEventKind,
  category: ContentHistoryCategory,
  label: string,
  extra: Partial<Pick<AdminContentHistoryEvent, 'locale' | 'area' | 'changes' | 'revision'>> = {},
): AdminContentHistoryEvent {
  return {
    id: `rev-${revision.id}`,
    timestamp: typeof revision.activity?.timestamp === 'string' ? revision.activity.timestamp : null,
    kind,
    category,
    label,
    locale: extra.locale ?? null,
    area: extra.area ?? null,
    changes: extra.changes ?? [],
    actor: historyActor(revision.activity?.user ?? null),
    revision: extra.revision ?? null,
  }
}

/** Maps one revision of this item's rows to an event, using only what the revision records. */
export function mapHistoryRevision(revision: HistoryRevision, lookups: HistoryLookups): AdminContentHistoryEvent {
  const action = revision.activity?.action
  const delta = deltaOf(revision)
  const changes = changedLabels(delta)
  const item = String(revision.item)

  if (revision.collection === 'content_items') {
    if (action === 'create') return event(revision, 'created', 'Lifecycle', 'Content created')
    if (action === 'update') {
      if (delta.status === 'archived') return event(revision, 'archived', 'Lifecycle', 'Archived')
      if (delta.status === 'draft' && 'archived_at' in delta && delta.archived_at === null) return event(revision, 'restored', 'Lifecycle', 'Restored to draft')
      if (delta.status === 'published') return event(revision, 'status_changed', 'Publication', 'Content status set to Published')
      if (delta.status === 'draft') return event(revision, 'status_changed', 'Publication', 'Content status set to Draft')
    }
    return event(revision, 'updated', 'Other', 'Content updated', { changes })
  }

  if (revision.collection === 'content_item_locales') {
    const locale = lookups.localeByRowId.get(item) ?? (isContentLocale(delta.locale) ? delta.locale : null)
    if (action === 'create') return event(revision, 'locale_started', 'Language', 'Language draft created', { locale, revision: numberOr(delta.draft_revision) })
    if (action === 'update') {
      switch (delta.last_change_kind) {
        case 'publish': return event(revision, 'published', 'Publication', 'Published', { locale, revision: numberOr(delta.published_revision) })
        case 'unpublish': return event(revision, 'unpublished', 'Publication', 'Unpublished', { locale })
        case 'restore': return event(revision, 'restored', 'Lifecycle', 'Publication cleared by restore', { locale })
        case 'ai_apply': return event(revision, 'ai_applied', 'AI', 'AI proposal applied to draft', { locale, changes, revision: numberOr(delta.draft_revision) })
        case 'manual_edit': {
          const fields = Object.keys(delta).filter(key => !META_FIELDS.has(key))
          const seoOnly = fields.length > 0 && fields.every(key => SEO_FIELDS.has(key))
          return seoOnly
            ? event(revision, 'seo_updated', 'SEO', 'SEO updated', { locale, changes, revision: numberOr(delta.draft_revision) })
            : event(revision, 'draft_updated', 'Draft', 'Draft updated', { locale, changes, revision: numberOr(delta.draft_revision) })
        }
      }
    }
    return event(revision, 'updated', 'Other', 'Content updated', { locale, changes })
  }

  if (revision.collection === 'content_items_files') {
    const file = lookups.fileByLinkId.get(item)
    const role = file ? ROLE_LABELS[file.role] ?? 'Media' : typeof delta.file_role === 'string' ? ROLE_LABELS[delta.file_role] ?? 'Media' : 'Media'
    const area = [role, file?.name].filter(Boolean).join(' · ')
    if (action === 'create') return event(revision, 'media_linked', 'Media', 'Media linked', { area })
    if (action === 'update') return event(revision, 'media_updated', 'Media', 'Media details updated', { area, changes })
    return event(revision, 'updated', 'Other', 'Content updated', { area })
  }

  if (revision.collection === 'content_relations') {
    const kind = lookups.relationById.get(item)?.kind
    const area = kind === 'product' ? 'Product' : kind === 'content' ? 'Content' : 'Relation'
    if (action === 'create') return event(revision, 'relation_added', 'Relations', 'Relation added', { area })
    if (action === 'update') return event(revision, 'relation_updated', 'Relations', 'Relation updated', { area, changes })
    return event(revision, 'updated', 'Other', 'Content updated', { area })
  }

  return event(revision, 'updated', 'Other', 'Content updated')
}

/** Newest first; the same timestamp orders by the later revision id first, so pages are stable. */
export function compareHistoryEvents(a: AdminContentHistoryEvent, b: AdminContentHistoryEvent): number {
  const ta = a.timestamp ? Date.parse(a.timestamp) : 0
  const tb = b.timestamp ? Date.parse(b.timestamp) : 0
  if (tb !== ta) return tb - ta
  return Number(b.id.slice(4)) - Number(a.id.slice(4))
}

export function parseHistoryPage(raw: unknown): number {
  const value = Number.parseInt(String(Array.isArray(raw) ? raw[0] : raw ?? '1'), 10)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10_000) : 1
}

export async function getContentHistory(fetch: FetchFn, itemId: number, rawPage: unknown): Promise<AdminContentHistory> {
  const page = parseHistoryPage(rawPage)
  const ctx = await loadLifecycleContext(fetch, itemId)

  const [filesRes, relationsRes] = await Promise.all([
    fetch<{ data: Array<Record<string, unknown>> }>(
      `/items/content_items_files?filter[content_items_id][_eq]=${itemId}&fields=id,content_items_id,file_role,directus_files_id.title,directus_files_id.filename_download&limit=-1`,
    ),
    fetch<{ data: Array<Record<string, unknown>> }>(`/items/content_relations?filter[content_items_id][_eq]=${itemId}&fields=id,content_items_id,relation_kind&limit=-1`),
  ])
  const own = (row: Record<string, unknown>) => row.content_items_id === itemId || typeof row.content_items_id !== 'number'
  const files = (filesRes.data ?? []).filter(own)
  const relations = (relationsRes.data ?? []).filter(own)

  const lookups: HistoryLookups = {
    itemId,
    localeByRowId: new Map(ctx.locales.map(l => [String(l.id), l.locale])),
    fileByLinkId: new Map(files.map((f) => {
      const file = f.directus_files_id && typeof f.directus_files_id === 'object' ? f.directus_files_id as Record<string, unknown> : null
      const name = (typeof file?.title === 'string' && file.title.trim()) || (typeof file?.filename_download === 'string' ? file.filename_download : null)
      return [String(f.id), { role: String(f.file_role), name: name || null }]
    })),
    relationById: new Map(relations.map(r => [String(r.id), { kind: String(r.relation_kind) }])),
  }

  const sources: Array<[string, string[]]> = [
    ['content_items', [String(itemId)]],
    ['content_item_locales', [...lookups.localeByRowId.keys()]],
    ['content_items_files', [...lookups.fileByLinkId.keys()]],
    ['content_relations', [...lookups.relationById.keys()]],
  ]
  let truncated = false
  const revisions: HistoryRevision[] = []
  await Promise.all(sources.filter(([, ids]) => ids.length > 0).map(async ([collection, ids]) => {
    const res = await fetch<{ data: HistoryRevision[] }>(
      `/revisions?filter[collection][_eq]=${collection}&filter[item][_in]=${ids.map(encodeURIComponent).join(',')}`
      + `&fields=${REVISION_FIELDS}&sort[]=-id&limit=${HISTORY_SOURCE_LIMIT}`,
    )
    const rows = res.data ?? []
    if (rows.length >= HISTORY_SOURCE_LIMIT) truncated = true
    // Defence in depth: only this item's own rows, whatever the source returned.
    revisions.push(...rows.filter(r => r.collection === collection && ids.includes(String(r.item))))
  }))

  const events = revisions.map(r => mapHistoryRevision(r, lookups)).sort(compareHistoryEvents)
  const total = events.length
  const start = (page - 1) * HISTORY_PAGE_SIZE
  const limitations = [
    'History begins from the Directus revisions available for this content.',
    'Removed media links and relations are not listed: Directus does not record which content item a deleted link belonged to.',
  ]
  if (truncated) limitations.push(`Only the most recent ${HISTORY_SOURCE_LIMIT} revisions per area are read; older events may be missing.`)

  return {
    item: { id: ctx.item.id, content_type: ctx.item.content_type as ContentTypeId, status: ctx.item.status, title: lifecycleItemTitle(ctx) },
    lifecycle: buildLifecycleState(ctx),
    events: events.slice(start, start + HISTORY_PAGE_SIZE),
    page,
    limit: HISTORY_PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    truncated,
    limitations,
  }
}
