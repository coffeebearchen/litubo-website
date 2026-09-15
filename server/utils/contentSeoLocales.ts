import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import {
  assertEditable,
  assertJsonObject,
  commitLocaleDraftUpdate,
  getContentDraft,
  getItemCore,
  prepareLocaleDraftUpdate,
  uniqueViolationField,
  type PreparedLocaleUpdate,
} from './contentDraft'
import { archivedAmong } from './contentMediaRelations'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { isImageMimeType } from '../../utils/contentMediaRelations'
import type {
  AdminContentSeoImage,
  AdminContentSeoLocaleRow,
  AdminContentSeoLocales,
} from '../../types/content-center'

/**
 * CC-IMP-05 — Content Center SEO & Locales BFF (CONTENT-CENTER-BLUEPRINT-V1 §6.1, §11, §13–§15).
 *
 * Read: every locale row of the item (without blocks), the site / published
 * locales from configuration, the item's `og_image` link and its enabled hero
 * (the preview fallback).
 *
 * Save: one request may carry SEO fields for one locale and / or an Open Graph
 * image change. Everything is validated before anything is written — locale
 * revision (`expectedDraftRevision`), slug lock and field rules through the same
 * prepare step the locale PATCH uses, and the image (`expectedOgVersion`, exists,
 * image, not archived). Then:
 *   1. the locale row is written with one PATCH (the database revision guard is
 *      the final authority), and
 *   2. the `og_image` link is written with one create, update or delete.
 * These are two collections, so they are not one transaction. When the SEO write
 * succeeds and the image write fails, the response is a 500 marked `partial`
 * that says which part was saved; the image change is still valid to retry.
 * Only `og_image` links are written here — never hero, inline, download or
 * source_document links, file lifecycle, file visibility, blocks or status.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const SEO_LOCALE_FIELDS = ['slug', 'seo_title', 'seo_description', 'canonical_path', 'noindex'] as const
const SAVE_KEYS = ['locale', 'expectedDraftRevision', 'fields', 'og_image']
const OG_KEYS = ['directus_files_id', 'expectedOgVersion']

export const SEO_LOCALES_BODY_MAX_BYTES = 16 * 1024

interface FileObject {
  id: string
  filename_download?: string | null
  title?: string | null
  type?: string | null
  filesize?: number | string | null
  width?: number | null
  height?: number | null
  is_public?: boolean | null
}

interface SeoFileRow {
  id: number
  content_items_id: number
  file_role: string
  enabled: boolean | null
  sort: number | null
  directus_files_id: string | FileObject | null
}

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

const fileIdOf = (value: SeoFileRow['directus_files_id']): string => (typeof value === 'string' ? value : value?.id ?? '').toLowerCase()

const FILE_ROW_FIELDS = [
  'id', 'content_items_id', 'file_role', 'enabled', 'sort',
  'directus_files_id.id', 'directus_files_id.filename_download', 'directus_files_id.title', 'directus_files_id.type',
  'directus_files_id.filesize', 'directus_files_id.width', 'directus_files_id.height', 'directus_files_id.is_public',
].join(',')

/** The item's hero and Open Graph links — the only roles this module reads. */
async function loadSeoFileRows(fetch: FetchFn, itemId: number): Promise<SeoFileRow[]> {
  const res = await fetch<{ data: SeoFileRow[] }>(
    `/items/content_items_files?filter[content_items_id][_eq]=${itemId}&filter[file_role][_in]=og_image,hero`
    + `&fields=${FILE_ROW_FIELDS}&sort[]=sort&sort[]=id&limit=-1`,
  )
  return (res.data ?? []).filter(row => row.content_items_id === itemId || typeof row.content_items_id !== 'number')
}

const ogRowsOf = (rows: SeoFileRow[]) => rows.filter(row => row.file_role === 'og_image')

/** Fingerprint of the item's `og_image` links, so an image change never overwrites one made meanwhile. */
export function ogImageVersion(rows: SeoFileRow[]): string {
  const og = ogRowsOf(rows).sort((a, b) => a.id - b.id).map(r => [r.id, fileIdOf(r.directus_files_id), r.enabled !== false])
  return createHash('sha256').update(JSON.stringify(og)).digest('hex').slice(0, 32)
}

function toSeoImage(row: SeoFileRow | undefined, archived: Set<string>): AdminContentSeoImage | null {
  if (!row) return null
  const file = typeof row.directus_files_id === 'object' && row.directus_files_id ? row.directus_files_id : null
  const fileId = fileIdOf(row.directus_files_id)
  return {
    link_id: row.id,
    directus_files_id: fileId,
    enabled: row.enabled !== false,
    file: {
      filename_download: file?.filename_download ?? null,
      title: file?.title ?? null,
      type: file?.type ?? null,
      width: file?.width ?? null,
      height: file?.height ?? null,
      filesize: file?.filesize === null || file?.filesize === undefined ? null : Number(file.filesize),
      is_public: file?.is_public === true,
      archived: archived.has(fileId),
    },
  }
}

function sitePublishedLocales(publishedLocales: readonly unknown[]): ContentLocale[] {
  return CONTENT_LOCALES.filter(locale => publishedLocales.includes(locale))
}

export async function getContentSeoLocales(fetch: FetchFn, itemId: number, publishedLocales: readonly unknown[]): Promise<AdminContentSeoLocales> {
  const draft = await getContentDraft(fetch, itemId)
  const fileRows = await loadSeoFileRows(fetch, itemId)
  const og = ogRowsOf(fileRows)[0]
  const hero = fileRows.find(row => row.file_role === 'hero' && row.enabled !== false)
  const archived = await archivedAmong(fetch, [og, hero].filter(Boolean).map(row => fileIdOf(row!.directus_files_id)))
  const defaultRow = draft.locales.find(l => l.locale === DEFAULT_CONTENT_LOCALE) ?? draft.locales[0]

  const locales: AdminContentSeoLocaleRow[] = draft.locales.map(({ blocks, ...row }) => ({
    ...row,
    block_count: Array.isArray(blocks) ? blocks.length : 0,
  }))

  return {
    item: { id: draft.id, content_type: draft.content_type, status: draft.status, title: defaultRow?.title ?? null },
    default_locale: DEFAULT_CONTENT_LOCALE,
    site_locales: [...CONTENT_LOCALES],
    published_locales: sitePublishedLocales(publishedLocales),
    locales,
    og_image: toSeoImage(og, archived),
    hero: toSeoImage(hero, archived),
    og_version: ogImageVersion(fileRows),
  }
}

// ── Save ────────────────────────────────────────────────────────────────────

type OgStep = () => Promise<unknown>

/** Validates an Open Graph image change and returns its writes (none when nothing changes). */
async function planOgImage(fetch: FetchFn, itemId: number, raw: unknown): Promise<OgStep[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(422, 'og_image must be an object.', { field: 'og_image' })
  const body = raw as Record<string, unknown>
  const extra = Object.keys(body).filter(key => !OG_KEYS.includes(key))
  if (extra.length > 0) fail(422, `These fields cannot be set here: ${extra.join(', ')}.`, { field: 'og_image', rejectedFields: extra })
  if (typeof body.expectedOgVersion !== 'string' || body.expectedOgVersion.length === 0) {
    fail(422, 'expectedOgVersion is required.', { field: 'og_image' })
  }
  const wanted = body.directus_files_id
  if (wanted !== null && (typeof wanted !== 'string' || !UUID_RE.test(wanted))) {
    fail(422, 'The Open Graph image must be a Media Library file id or null.', { field: 'og_image' })
  }

  const item = await getItemCore(fetch, itemId)
  assertEditable(item)
  const rows = await loadSeoFileRows(fetch, itemId)
  const current = ogImageVersion(rows)
  if (body.expectedOgVersion !== current) {
    fail(409, 'The Open Graph image changed since this page was loaded. Reload before saving.', { field: 'og_image', currentOgVersion: current })
  }
  const ogRows = ogRowsOf(rows)

  if (wanted === null) {
    return ogRows.length > 0
      ? [() => fetch('/items/content_items_files', { method: 'DELETE', body: ogRows.map(r => r.id) })]
      : []
  }

  const fileId = wanted.toLowerCase()
  const keep = ogRows.find(r => fileIdOf(r.directus_files_id) === fileId) ?? ogRows[0]
  if (!keep || fileIdOf(keep.directus_files_id) !== fileId) {
    const [filesRes, archived] = await Promise.all([
      fetch<{ data: Array<{ id: string, type: string | null }> }>(`/files?filter[id][_in]=${fileId}&fields=id,type&limit=1`),
      archivedAmong(fetch, [fileId]),
    ])
    const file = (filesRes.data ?? []).find(f => String(f.id).toLowerCase() === fileId)
    if (!file) fail(422, 'The Open Graph image does not exist in the Media Library.', { field: 'og_image' })
    if (archived.has(fileId)) fail(422, 'The Open Graph image is archived in the Media Library and cannot be used.', { field: 'og_image' })
    if (!isImageMimeType(file.type)) fail(422, 'The Open Graph image must be an image.', { field: 'og_image' })
  }

  const steps: OgStep[] = []
  if (!keep) {
    steps.push(() => fetch('/items/content_items_files?fields=id', {
      method: 'POST',
      body: { content_items_id: itemId, directus_files_id: fileId, file_role: 'og_image', enabled: true, sort: 0 },
    }))
  } else if (fileIdOf(keep.directus_files_id) !== fileId || keep.enabled === false) {
    steps.push(() => fetch(`/items/content_items_files/${keep.id}?fields=id`, {
      method: 'PATCH',
      body: { directus_files_id: fileId, enabled: true },
    }))
  }
  const extras = ogRows.filter(r => r.id !== keep?.id).map(r => r.id)
  if (extras.length > 0) steps.push(() => fetch('/items/content_items_files', { method: 'DELETE', body: extras }))
  return steps
}

export async function saveContentSeoLocales(
  fetch: FetchFn,
  itemId: number,
  rawBody: unknown,
  publishedLocales: readonly unknown[],
): Promise<AdminContentSeoLocales> {
  const body = assertJsonObject(rawBody)
  const unknownKeys = Object.keys(body).filter(key => !SAVE_KEYS.includes(key))
  if (unknownKeys.length > 0) fail(422, `These fields cannot be set here: ${unknownKeys.join(', ')}.`, { rejectedFields: unknownKeys })
  if (!isContentLocale(body.locale)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })
  const locale = body.locale
  if (body.fields === undefined && body.og_image === undefined) fail(400, 'Nothing to save.')

  // ── Validate everything before writing ──
  let prepared: PreparedLocaleUpdate | null = null
  if (body.fields !== undefined) {
    if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) fail(422, 'fields must be an object.')
    prepared = await prepareLocaleDraftUpdate(
      fetch, itemId, locale,
      { expectedDraftRevision: body.expectedDraftRevision, ...(body.fields as Record<string, unknown>) },
      SEO_LOCALE_FIELDS,
    )
  }
  const ogSteps = body.og_image !== undefined ? await planOgImage(fetch, itemId, body.og_image) : []

  // ── Write: locale row, then the image link ──
  if (prepared) await commitLocaleDraftUpdate(fetch, itemId, prepared)

  let completed = 0
  try {
    for (const step of ogSteps) {
      await step()
      completed++
    }
  } catch (err) {
    if (prepared || completed > 0) {
      fail(500, prepared && completed === 0
        ? 'Search settings were saved, but the Open Graph image was not. The image change is still staged — save again to retry.'
        : 'The Open Graph image was only partly updated. Reload to see the current state before saving again.', {
        partial: true,
        saved: prepared ? ['seo'] : [],
        notSaved: ['og_image'],
        ogImageRetryable: completed === 0,
        currentDraftRevision: prepared ? prepared.patch.draft_revision : null,
      })
    }
    if (uniqueViolationField(err) !== null) {
      fail(409, 'The Open Graph image was changed by another save at the same time. Reload before saving again.', { field: 'og_image' })
    }
    throw err
  }

  return getContentSeoLocales(fetch, itemId, publishedLocales)
}
