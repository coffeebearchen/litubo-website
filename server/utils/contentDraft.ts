import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { blockStructureForNewLocale, createDefaultBlocks, validateBlocks } from './contentBlocks'
import { MAX_BLOCKS_JSON_BYTES, type ContentBlock } from '../../utils/contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { getContentType, isContentTypeId } from '../../utils/contentTypes'
import type {
  AdminContentDraft,
  AdminContentLinkCounts,
  AdminContentList,
  AdminContentListItem,
  AdminContentLocaleDraft,
  ContentItemStatus,
} from '../../types/content-center'

/**
 * CC-IMP-01 — Content Center Draft Foundation (CONTENT-CENTER-BLUEPRINT-V1 §6–§9, §14, §25).
 *
 * The only write surface of this module: create a draft item (with its default
 * locale, atomically), create a further locale draft, and save a locale working
 * copy guarded by `expectedDraftRevision`. There is no publish, unpublish,
 * archive, restore, media, relation, AI or public read here.
 *
 * Error convention:
 *   400 — body is not a JSON object / no updatable field / invalid id
 *   404 — content item or locale row not found for this route
 *   409 — duplicate slug or locale (database unique constraint is the final
 *         authority), stale `expectedDraftRevision` (BFF pre-check; the
 *         database revision guard trigger is the final authority), archived item
 *   422 — a field that may not be set here (mass assignment), unknown content
 *         type or locale, or a value that fails validation
 * Every rejection writes nothing.
 */

export const CONTENT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const CONTENT_SLUG_MAX = 100
export const RESERVED_CONTENT_SLUGS = ['new', 'index', 'preview', 'draft', 'edit', 'admin', 'api', 'search', 'page', 'all'] as const

export const CONTENT_CREATE_FIELDS = ['content_type', 'title', 'slug', 'summary'] as const
export const LOCALE_CREATE_FIELDS = ['locale', 'title', 'slug', 'summary'] as const
export const LOCALE_UPDATE_FIELDS = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex'] as const

export const CREATE_BODY_MAX_BYTES = 16 * 1024
export const UPDATE_BODY_MAX_BYTES = MAX_BLOCKS_JSON_BYTES + 64 * 1024

const TITLE_MAX = 160
const SUMMARY_MAX = 400
const SEO_TITLE_MAX = 120
const SEO_DESCRIPTION_MAX = 320
const CANONICAL_PATH_MAX = 255
const LIST_LIMIT_MAX = 100
const LIST_LIMIT_DEFAULT = 25
const LIST_SEARCH_MAX = 100
const ITEM_STATUSES: readonly ContentItemStatus[] = ['draft', 'published', 'archived']

const ITEM_READ_FIELDS = ['id', 'content_type', 'status', 'first_published_at', 'archived_at', 'date_created', 'date_updated'] as const
const LOCALE_READ_FIELDS = [
  'id', 'content_items_id', 'locale', 'title', 'slug', 'summary', 'blocks',
  'seo_title', 'seo_description', 'canonical_path', 'noindex',
  'draft_revision', 'published_revision', 'published_at', 'first_published_at', 'last_change_kind',
] as const

type Body = Record<string, unknown>

interface ItemCore {
  id: number
  content_type: string
  status: string
}

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

export function assertJsonObject(body: unknown): Body {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail(400, 'Request body must be a JSON object.')
  }
  return body as Body
}

export function rejectedFields(body: Body, allowed: readonly string[]): string[] {
  return Object.keys(body).filter(key => !allowed.includes(key))
}

function assertOnlyAllowedFields(body: Body, allowed: readonly string[]): void {
  const rejected = rejectedFields(body, allowed)
  if (rejected.length > 0) {
    fail(422, `These fields cannot be set here: ${rejected.join(', ')}.`, { rejectedFields: rejected })
  }
}

export function parseContentItemId(raw: unknown): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) fail(400, 'Invalid content item id.')
  return id
}

export type SlugValidation = { ok: true, slug: string } | { ok: false, message: string }

export function validateContentSlug(value: unknown): SlugValidation {
  if (typeof value !== 'string' || value.length === 0) return { ok: false, message: 'slug is required.' }
  if (value.length > CONTENT_SLUG_MAX) return { ok: false, message: `slug must be at most ${CONTENT_SLUG_MAX} characters.` }
  if (!CONTENT_SLUG_RE.test(value)) {
    return { ok: false, message: 'slug may contain only lowercase letters, digits and single hyphens between them.' }
  }
  if ((RESERVED_CONTENT_SLUGS as readonly string[]).includes(value)) {
    return { ok: false, message: `"${value}" is a reserved slug.` }
  }
  return { ok: true, slug: value }
}

function requireSlug(value: unknown): string {
  const result = validateContentSlug(value)
  if (!result.ok) fail(422, result.message, { field: 'slug' })
  return result.slug
}

function requireTitle(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(422, 'title is required.', { field: 'title' })
  const title = value.trim()
  if (title.length > TITLE_MAX) fail(422, `title must be at most ${TITLE_MAX} characters.`, { field: 'title' })
  return title
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') fail(422, `${field} must be a string or null.`, { field })
  const text = value.trim()
  if (text.length > max) fail(422, `${field} must be at most ${max} characters.`, { field })
  return text.length > 0 ? text : null
}

function optionalCanonicalPath(value: unknown): string | null {
  const path = optionalText(value, 'canonical_path', CANONICAL_PATH_MAX)
  if (path !== null && !/^\/(?!\/)\S*$/.test(path)) {
    fail(422, 'canonical_path must be an internal path starting with "/".', { field: 'canonical_path' })
  }
  return path
}

/** Directus reports a violated unique constraint/index as RECORD_NOT_UNIQUE. */
export function uniqueViolationField(err: unknown): string | null {
  const errors = (err as { data?: { errors?: Array<{ extensions?: { code?: string, field?: string } }> } })?.data?.errors
  const hit = Array.isArray(errors) ? errors.find(e => e?.extensions?.code === 'RECORD_NOT_UNIQUE') : undefined
  return hit ? String(hit.extensions?.field ?? '') : null
}

/**
 * CC-IMP-01-FIX-01-R1 — the database revision guard
 * (directus/schema/cc-imp-01-fix-01-revision-guard.sql) raises SQLSTATE 23505
 * with the field `draft_revision`, which Directus reports as RECORD_NOT_UNIQUE
 * on that field. No real index covers `draft_revision`, so only the guard
 * produces it. Every other error keeps its own status.
 */
export const DRAFT_REVISION_GUARD_FIELD = 'draft_revision'

export function isDraftRevisionConflict(err: unknown): boolean {
  return uniqueViolationField(err) === DRAFT_REVISION_GUARD_FIELD
}

async function writeOrConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write
  } catch (err) {
    if (isDraftRevisionConflict(err)) throw err
    const field = uniqueViolationField(err)
    if (field !== null) {
      if (field.includes('slug')) fail(409, 'This slug is already used for this language.', { field: 'slug' })
      fail(409, 'This content item already has a draft for this language.', { field: 'locale' })
    }
    throw err
  }
}

/** Friendly pre-check only; the (locale, slug) unique index is the final authority. */
async function assertSlugAvailable(fetch: FetchFn, locale: ContentLocale, slug: string, ownRowId?: number): Promise<void> {
  const res = await fetch<{ data: Array<{ id: number }> }>(
    `/items/content_item_locales?filter[locale][_eq]=${encodeURIComponent(locale)}`
    + `&filter[slug][_eq]=${encodeURIComponent(slug)}&fields=id&limit=2`,
  )
  if ((res.data ?? []).some(row => row.id !== ownRowId)) {
    fail(409, 'This slug is already used for this language.', { field: 'slug' })
  }
}

async function getItemCore(fetch: FetchFn, itemId: number): Promise<ItemCore> {
  const res = await fetch<{ data: ItemCore[] }>(
    `/items/content_items?filter[id][_eq]=${itemId}&fields=id,content_type,status&limit=1`,
  )
  const row = (res.data ?? [])[0]
  if (!row) fail(404, `Content item ${itemId} not found.`)
  return row
}

function assertEditable(item: ItemCore): void {
  if (item.status === 'archived') fail(409, 'This content item is archived and cannot be edited.')
}

async function getLocaleRow(fetch: FetchFn, itemId: number, locale: ContentLocale): Promise<AdminContentLocaleDraft | null> {
  const res = await fetch<{ data: AdminContentLocaleDraft[] }>(
    `/items/content_item_locales?filter[content_items_id][_eq]=${itemId}`
    + `&filter[locale][_eq]=${encodeURIComponent(locale)}&fields=${LOCALE_READ_FIELDS.join(',')}&limit=1`,
  )
  const row = (res.data ?? [])[0]
  return row && row.content_items_id === itemId && row.locale === locale ? projectLocale(row) : null
}

function projectLocale(row: AdminContentLocaleDraft): AdminContentLocaleDraft {
  const out = {} as Record<string, unknown>
  for (const key of LOCALE_READ_FIELDS) out[key] = (row as unknown as Record<string, unknown>)[key] ?? null
  return out as unknown as AdminContentLocaleDraft
}

const localeOrder = (locale: string) => (CONTENT_LOCALES as readonly string[]).indexOf(locale)

/** Image blocks may only reference this item's own `inline` file links. */
async function assertImageLinksBelongToItem(fetch: FetchFn, itemId: number, blocks: ContentBlock[]): Promise<void> {
  const ids = [...new Set(blocks.filter(b => b.type === 'image').map(b => Number(b.data.fileLinkId)))]
  if (ids.length === 0) return
  const res = await fetch<{ data: Array<{ id: number }> }>(
    `/items/content_items_files?filter[id][_in]=${ids.join(',')}&filter[content_items_id][_eq]=${itemId}`
    + `&filter[file_role][_eq]=inline&fields=id&limit=${ids.length}`,
  )
  const found = new Set((res.data ?? []).map(row => row.id))
  const missing = ids.filter(id => !found.has(id))
  if (missing.length > 0) {
    fail(422, 'Image blocks may only use inline file links of this content item.', { invalidFileLinkIds: missing })
  }
}

export async function getContentDraft(fetch: FetchFn, itemId: number): Promise<AdminContentDraft> {
  const fields = [...ITEM_READ_FIELDS, ...LOCALE_READ_FIELDS.map(f => `locales.${f}`)].join(',')
  const res = await fetch<{ data: Array<AdminContentDraft> }>(
    `/items/content_items?filter[id][_eq]=${itemId}&fields=${fields}&limit=1`,
  )
  const row = (res.data ?? [])[0]
  if (!row) fail(404, `Content item ${itemId} not found.`)
  const locales = (row.locales ?? [])
    .filter(l => l.content_items_id === itemId)
    .map(projectLocale)
    .sort((a, b) => localeOrder(a.locale) - localeOrder(b.locale))
  return {
    id: row.id,
    content_type: row.content_type,
    status: row.status,
    first_published_at: row.first_published_at ?? null,
    archived_at: row.archived_at ?? null,
    date_created: row.date_created ?? null,
    date_updated: row.date_updated ?? null,
    locales,
  }
}

/**
 * CC-IMP-02 — real link counts for the CC-01 Overview (read-only). Media links
 * and relations are managed in CC-IMP-04; the Overview only reports how many
 * rows exist for this item.
 */
export async function countContentLinks(fetch: FetchFn, itemId: number): Promise<AdminContentLinkCounts> {
  const count = async (collection: string): Promise<number> => {
    const res = await fetch<{ data: Array<{ count: number | string }> }>(
      `/items/${collection}?filter[content_items_id][_eq]=${itemId}&aggregate[count]=*`,
    )
    const value = Number((res.data ?? [])[0]?.count ?? 0)
    return Number.isFinite(value) ? value : 0
  }
  const [media, relations] = await Promise.all([count('content_items_files'), count('content_relations')])
  return { media, relations }
}

export async function listContentDrafts(fetch: FetchFn, query: Record<string, unknown>): Promise<AdminContentList> {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1)
  const limit = Math.min(LIST_LIMIT_MAX, Math.max(1, Number.parseInt(String(query.limit ?? LIST_LIMIT_DEFAULT), 10) || LIST_LIMIT_DEFAULT))
  const filters: string[] = []
  if (query.content_type !== undefined && query.content_type !== '') {
    if (!isContentTypeId(query.content_type)) fail(422, 'Unknown content_type filter.')
    filters.push(`filter[content_type][_eq]=${query.content_type}`)
  }
  if (query.status !== undefined && query.status !== '') {
    if (!ITEM_STATUSES.includes(query.status as ContentItemStatus)) fail(422, 'Unknown status filter.')
    filters.push(`filter[status][_eq]=${query.status}`)
  }
  // CC-IMP-02 — "has a draft in this locale" and a title/slug search across the
  // item's locale drafts. Both are allowlisted/bounded and URL-encoded values;
  // Directus parameterizes them.
  if (query.locale !== undefined && query.locale !== '') {
    if (!isContentLocale(query.locale)) fail(422, 'Unknown locale filter.')
    filters.push(`filter[locales][_some][locale][_eq]=${query.locale}`)
  }
  if (query.search !== undefined) {
    if (typeof query.search !== 'string') fail(422, 'search must be a single string.')
    const term = query.search.trim()
    if (term.length > LIST_SEARCH_MAX) fail(422, `search must be at most ${LIST_SEARCH_MAX} characters.`)
    if (term.length > 0) {
      const value = encodeURIComponent(term)
      filters.push(`filter[_or][0][locales][_some][title][_icontains]=${value}`)
      filters.push(`filter[_or][1][locales][_some][slug][_icontains]=${value}`)
    }
  }
  const fields = ['id', 'content_type', 'status', 'date_created', 'date_updated', 'locales.locale', 'locales.title', 'locales.slug', 'locales.draft_revision'].join(',')
  const res = await fetch<{ data: AdminContentListItem[], meta?: { filter_count?: number } }>(
    `/items/content_items?${[...filters, `fields=${fields}`, 'sort=-date_created', `limit=${limit}`, `page=${page}`, 'meta=filter_count'].join('&')}`,
  )
  const data = (res.data ?? []).map(item => ({
    id: item.id,
    content_type: item.content_type,
    status: item.status,
    date_created: item.date_created ?? null,
    date_updated: item.date_updated ?? null,
    locales: (item.locales ?? [])
      .map(l => ({ locale: l.locale, title: l.title, slug: l.slug, draft_revision: l.draft_revision }))
      .sort((a, b) => localeOrder(a.locale) - localeOrder(b.locale)),
  }))
  return { data, total: Number(res.meta?.filter_count ?? data.length), page, limit }
}

export async function createContentDraft(fetch: FetchFn, rawBody: unknown, newId: () => string = randomUUID): Promise<AdminContentDraft> {
  const body = assertJsonObject(rawBody)
  assertOnlyAllowedFields(body, CONTENT_CREATE_FIELDS)
  const type = getContentType(body.content_type)
  if (!type) fail(422, 'content_type must be one of the Content Center V1 types.', { field: 'content_type' })
  const title = requireTitle(body.title)
  const slug = requireSlug(body.slug)
  const summary = optionalText(body.summary, 'summary', SUMMARY_MAX)

  await assertSlugAvailable(fetch, DEFAULT_CONTENT_LOCALE, slug)

  // One Directus request with the nested default locale: the item and its first
  // locale row are created in the same database transaction, or not at all.
  const created = await writeOrConflict(fetch<{ data: { id: number } }>('/items/content_items?fields=id', {
    method: 'POST',
    body: {
      content_type: type.id,
      status: 'draft',
      locales: [{
        locale: DEFAULT_CONTENT_LOCALE,
        title,
        slug,
        summary,
        blocks: createDefaultBlocks(type.id, newId),
        noindex: false,
        draft_revision: 1,
        last_change_kind: 'manual_edit',
      }],
    },
  }))
  return getContentDraft(fetch, created.data.id)
}

export async function createLocaleDraft(fetch: FetchFn, itemId: number, rawBody: unknown): Promise<AdminContentDraft> {
  const body = assertJsonObject(rawBody)
  assertOnlyAllowedFields(body, LOCALE_CREATE_FIELDS)
  if (!isContentLocale(body.locale)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })
  const locale = body.locale
  if (locale === DEFAULT_CONTENT_LOCALE) fail(422, 'The default locale is created together with the content item.', { field: 'locale' })

  const item = await getItemCore(fetch, itemId)
  assertEditable(item)
  const defaultRow = await getLocaleRow(fetch, itemId, DEFAULT_CONTENT_LOCALE)
  if (!defaultRow) fail(409, 'The default locale draft is missing for this content item.')
  if (await getLocaleRow(fetch, itemId, locale)) fail(409, 'This content item already has a draft for this language.', { field: 'locale' })

  const title = requireTitle(body.title)
  const slug = requireSlug(body.slug)
  const summary = optionalText(body.summary, 'summary', SUMMARY_MAX)
  await assertSlugAvailable(fetch, locale, slug)

  await writeOrConflict(fetch<{ data: { id: number } }>('/items/content_item_locales?fields=id', {
    method: 'POST',
    body: {
      content_items_id: itemId,
      locale,
      title,
      slug,
      summary,
      blocks: (defaultRow.blocks ?? []).map(blockStructureForNewLocale),
      noindex: false,
      draft_revision: 1,
      last_change_kind: 'manual_edit',
    },
  }))
  return getContentDraft(fetch, itemId)
}

export async function updateLocaleDraft(fetch: FetchFn, itemId: number, rawLocale: unknown, rawBody: unknown): Promise<AdminContentDraft> {
  if (!isContentLocale(rawLocale)) fail(404, 'Unknown locale.')
  const locale = rawLocale
  const body = assertJsonObject(rawBody)
  assertOnlyAllowedFields(body, ['expectedDraftRevision', ...LOCALE_UPDATE_FIELDS])

  const expected = body.expectedDraftRevision
  if (!Number.isInteger(expected) || (expected as number) < 1) {
    fail(422, 'expectedDraftRevision is required.', { field: 'expectedDraftRevision' })
  }
  const fieldKeys = LOCALE_UPDATE_FIELDS.filter(key => body[key] !== undefined)
  if (fieldKeys.length === 0) fail(400, 'No updatable fields provided.')

  const item = await getItemCore(fetch, itemId)
  assertEditable(item)
  const row = await getLocaleRow(fetch, itemId, locale)
  if (!row) fail(404, `No ${locale} draft exists for content item ${itemId}.`)
  if (row.draft_revision !== expected) {
    fail(409, 'This draft was changed since it was loaded. Reload it before saving.', { currentDraftRevision: row.draft_revision })
  }

  const type = getContentType(item.content_type)
  if (!type) fail(409, 'This content item has an unknown content type.')

  const patch: Body = {}
  if (body.title !== undefined) patch.title = requireTitle(body.title)
  if (body.slug !== undefined) {
    const slug = requireSlug(body.slug)
    if (slug !== row.slug) await assertSlugAvailable(fetch, locale, slug, row.id)
    patch.slug = slug
  }
  if (body.summary !== undefined) patch.summary = optionalText(body.summary, 'summary', SUMMARY_MAX)
  if (body.seo_title !== undefined) patch.seo_title = optionalText(body.seo_title, 'seo_title', SEO_TITLE_MAX)
  if (body.seo_description !== undefined) patch.seo_description = optionalText(body.seo_description, 'seo_description', SEO_DESCRIPTION_MAX)
  if (body.canonical_path !== undefined) patch.canonical_path = optionalCanonicalPath(body.canonical_path)
  if (body.noindex !== undefined) {
    if (typeof body.noindex !== 'boolean') fail(422, 'noindex must be true or false.', { field: 'noindex' })
    patch.noindex = body.noindex
  }
  if (body.blocks !== undefined) {
    const result = validateBlocks(body.blocks, type.allowedBlocks)
    if (!result.ok) fail(422, 'blocks are not valid.', { field: 'blocks', errors: result.errors })
    await assertImageLinksBelongToItem(fetch, itemId, result.blocks)
    patch.blocks = result.blocks
  }

  patch.draft_revision = row.draft_revision + 1
  patch.last_change_kind = 'manual_edit'

  try {
    await writeOrConflict(fetch(`/items/content_item_locales/${row.id}?fields=id`, { method: 'PATCH', body: patch }))
  } catch (err) {
    // CC-IMP-01-FIX-01-R1 — the database guard rejected a concurrent save that
    // passed the pre-check with the same revision. Nothing was written.
    if (isDraftRevisionConflict(err)) {
      const current = await getLocaleRow(fetch, itemId, locale)
      fail(409, 'This draft was changed since it was loaded. Reload it before saving.', { currentDraftRevision: current?.draft_revision ?? null })
    }
    throw err
  }
  // The revision returned here is read back from the database after the write.
  return getContentDraft(fetch, itemId)
}
