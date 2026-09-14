import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { assertJsonObject, uniqueViolationField } from './contentDraft'
import { DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { validateContentRelationInput } from '../../utils/contentRelations'
import {
  CONTENT_IMAGE_ONLY_ROLES,
  CONTENT_MEDIA_ALT_MAX,
  CONTENT_MEDIA_CAPTION_MAX,
  CONTENT_MEDIA_LINKS_MAX,
  CONTENT_MEDIA_VERSION_MAX,
  CONTENT_RELATIONS_MAX,
  contentMediaAltField,
  contentMediaCaptionField,
  isContentDownloadLanguage,
  isImageMimeType,
  isIsoDate,
  isManagedContentMediaRole,
  type ContentManagedMediaRole,
} from '../../utils/contentMediaRelations'
import type {
  AdminContentMediaLink,
  AdminContentMediaRelations,
  AdminContentRelation,
  ContentItemStatus,
} from '../../types/content-center'
import type { ContentTypeId } from '../../utils/contentTypes'

/**
 * CC-IMP-04 — Content Center Media & Relations BFF (CONTENT-CENTER-BLUEPRINT-V1 §11, §12, §25).
 *
 * The page sends the complete desired inventory of the links this module owns
 * (hero / inline / download files, product / content relations) plus the
 * `inventory_version` it loaded. The server:
 *   1. validates the whole change set before writing anything (item not archived,
 *      unchanged inventory, roles, files exist, files not archived, image roles are
 *      images, one hero, no duplicates, relation targets exist, no self relation,
 *      no removal of an inline link an image block still uses);
 *   2. matches desired entries to existing rows by id, or by (file, role) /
 *      target, so a repeated save converges instead of duplicating;
 *   3. writes with Directus batch requests in a fixed order — creates, updates,
 *      then deletes — so an interrupted save can leave extra rows but never loses
 *      a link that was meant to stay.
 *
 * Atomicity: each batch request is one Directus transaction; the sequence of up
 * to six requests is not a single transaction. A failure after the first write is
 * reported as a partial save and the inventory version then differs, so the user
 * reloads before saving again. `og_image` and `source_document` rows, file
 * lifecycle, file visibility, content status and blocks are never written here.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAVE_KEYS = ['expectedInventoryVersion', 'locale', 'media', 'relations']
const MEDIA_KEYS = ['id', 'directus_files_id', 'file_role', 'alt', 'caption', 'language', 'version_label', 'file_date', 'enabled']
const RELATION_KEYS = ['id', 'relation_kind', 'product_id', 'related_content_id']
const LOCALIZED_FIELDS = ['alt_en', 'alt_es', 'alt_pt', 'caption_en', 'caption_es', 'caption_pt'] as const

export const MEDIA_RELATIONS_BODY_MAX_BYTES = 256 * 1024

type Row = Record<string, unknown>

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

interface RawFileRow extends Row {
  id: number
  content_items_id: number
  file_role: string
  directus_files_id: string | FileObject | null
  language: string | null
  version_label: string | null
  file_date: string | null
  enabled: boolean
  sort: number | null
}

interface RawRelationRow {
  id: number
  content_items_id: number
  relation_kind: string
  sort: number | null
  product_id: number | { id: number, name_en?: string | null, product_code?: string | null, status?: string | null } | null
  related_content_id: number | { id: number, content_type?: string | null, status?: string | null, locales?: Array<{ locale: string, title: string | null }> } | null
}

interface ItemRow {
  id: number
  content_type: string
  status: string
  locales?: Array<{ locale: string, title: string | null, blocks: unknown }>
}

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

const fileIdOf = (value: RawFileRow['directus_files_id']): string => (typeof value === 'string' ? value : value?.id ?? '')
const productIdOf = (value: RawRelationRow['product_id']): number | null => (typeof value === 'number' ? value : value?.id ?? null)
const contentIdOf = (value: RawRelationRow['related_content_id']): number | null => (typeof value === 'number' ? value : value?.id ?? null)

function localeTitle(locales: Array<{ locale: string, title: string | null }> | undefined, locale: string): string | null {
  const rows = Array.isArray(locales) ? locales : []
  return rows.find(l => l.locale === locale)?.title ?? rows.find(l => l.locale === DEFAULT_CONTENT_LOCALE)?.title ?? rows[0]?.title ?? null
}

async function loadItem(fetch: FetchFn, itemId: number): Promise<ItemRow> {
  const res = await fetch<{ data: ItemRow[] }>(
    `/items/content_items?filter[id][_eq]=${itemId}&fields=id,content_type,status,locales.locale,locales.title,locales.blocks&limit=1`,
  )
  const row = (res.data ?? [])[0]
  if (!row) fail(404, `Content item ${itemId} not found.`)
  return row
}

const FILE_ROW_FIELDS = [
  'id', 'content_items_id', 'file_role', ...LOCALIZED_FIELDS, 'language', 'version_label', 'file_date', 'enabled', 'sort',
  'directus_files_id.id', 'directus_files_id.filename_download', 'directus_files_id.title', 'directus_files_id.type',
  'directus_files_id.filesize', 'directus_files_id.width', 'directus_files_id.height', 'directus_files_id.is_public',
].join(',')

async function loadFileRows(fetch: FetchFn, itemId: number): Promise<RawFileRow[]> {
  const res = await fetch<{ data: RawFileRow[] }>(
    `/items/content_items_files?filter[content_items_id][_eq]=${itemId}&fields=${FILE_ROW_FIELDS}&sort[]=sort&sort[]=id&limit=-1`,
  )
  return (res.data ?? []).filter(row => row.content_items_id === itemId || typeof row.content_items_id !== 'number')
}

const RELATION_ROW_FIELDS = [
  'id', 'content_items_id', 'relation_kind', 'sort',
  'product_id.id', 'product_id.name_en', 'product_id.product_code', 'product_id.status',
  'related_content_id.id', 'related_content_id.content_type', 'related_content_id.status',
  'related_content_id.locales.locale', 'related_content_id.locales.title',
].join(',')

async function loadRelationRows(fetch: FetchFn, itemId: number): Promise<RawRelationRow[]> {
  const res = await fetch<{ data: RawRelationRow[] }>(
    `/items/content_relations?filter[content_items_id][_eq]=${itemId}&fields=${RELATION_ROW_FIELDS}&sort[]=sort&sort[]=id&limit=-1`,
  )
  return (res.data ?? []).filter(row => row.content_items_id === itemId || typeof row.content_items_id !== 'number')
}

/** The archived subset of `fileIds` — the same rule the Media Library uses (`media_file_lifecycle.archived`). */
async function archivedAmong(fetch: FetchFn, fileIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(fileIds.filter(id => UUID_RE.test(id)))]
  if (ids.length === 0) return new Set()
  const res = await fetch<{ data: Array<{ file_id: string | null }> }>(
    `/items/media_file_lifecycle?filter[file_id][_in]=${ids.join(',')}&filter[archived][_eq]=true&fields=file_id&limit=-1`,
  )
  return new Set((res.data ?? []).map(r => r.file_id ?? '').filter(Boolean))
}

/** Inline link ids an `image` block (any locale) points at through `fileLinkId`. */
function imageBlockLinkIds(item: ItemRow): Set<number> {
  const ids = new Set<number>()
  for (const locale of item.locales ?? []) {
    const blocks = Array.isArray(locale.blocks) ? locale.blocks as Array<{ type?: string, data?: { fileLinkId?: unknown } }> : []
    for (const block of blocks) {
      if (block?.type === 'image' && Number.isInteger(block.data?.fileLinkId)) ids.add(block.data!.fileLinkId as number)
    }
  }
  return ids
}

/** Fingerprint of every link and relation row of the item, including roles owned by other modules. */
export function mediaRelationsInventoryVersion(fileRows: RawFileRow[], relationRows: RawRelationRow[]): string {
  const files = [...fileRows].sort((a, b) => a.id - b.id).map(r => [
    r.id, fileIdOf(r.directus_files_id), r.file_role, ...LOCALIZED_FIELDS.map(f => r[f] ?? null),
    r.language ?? null, r.version_label ?? null, r.file_date ?? null, r.enabled !== false, r.sort ?? null,
  ])
  const relations = [...relationRows].sort((a, b) => a.id - b.id).map(r => [
    r.id, r.relation_kind, productIdOf(r.product_id), contentIdOf(r.related_content_id), r.sort ?? null,
  ])
  return createHash('sha256').update(JSON.stringify({ files, relations })).digest('hex').slice(0, 32)
}

function toMediaLink(row: RawFileRow, locale: ContentLocale, archived: Set<string>, imageLinks: Set<number>): AdminContentMediaLink {
  const file = typeof row.directus_files_id === 'object' && row.directus_files_id ? row.directus_files_id : null
  const fileId = fileIdOf(row.directus_files_id)
  return {
    id: row.id,
    directus_files_id: fileId,
    file_role: row.file_role as ContentManagedMediaRole,
    alt: (row[contentMediaAltField(locale)] as string | null) ?? null,
    caption: (row[contentMediaCaptionField(locale)] as string | null) ?? null,
    language: isContentDownloadLanguage(row.language) ? row.language : null,
    version_label: row.version_label ?? null,
    file_date: row.file_date ?? null,
    enabled: row.enabled !== false,
    sort: row.sort ?? null,
    used_by_image_blocks: row.file_role === 'inline' && imageLinks.has(row.id),
    file: {
      filename_download: file?.filename_download ?? null,
      title: file?.title ?? null,
      type: file?.type ?? null,
      filesize: file?.filesize === null || file?.filesize === undefined ? null : Number(file.filesize),
      width: file?.width ?? null,
      height: file?.height ?? null,
      is_public: file?.is_public === true,
      archived: archived.has(fileId),
    },
  }
}

function toRelation(row: RawRelationRow, locale: ContentLocale): AdminContentRelation {
  const product = typeof row.product_id === 'object' && row.product_id ? row.product_id : null
  const content = typeof row.related_content_id === 'object' && row.related_content_id ? row.related_content_id : null
  return {
    id: row.id,
    relation_kind: row.relation_kind === 'content' ? 'content' : 'product',
    sort: row.sort ?? null,
    product: row.relation_kind === 'product' && productIdOf(row.product_id) !== null
      ? { id: productIdOf(row.product_id)!, name_en: product?.name_en ?? null, product_code: product?.product_code ?? null, status: product?.status ?? null }
      : null,
    content: row.relation_kind === 'content' && contentIdOf(row.related_content_id) !== null
      ? { id: contentIdOf(row.related_content_id)!, title: localeTitle(content?.locales, locale), content_type: content?.content_type ?? null, status: content?.status ?? null }
      : null,
  }
}

function parseLocale(raw: unknown): ContentLocale {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_CONTENT_LOCALE
  if (!isContentLocale(raw)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })
  return raw
}

interface LoadedInventory {
  item: ItemRow
  fileRows: RawFileRow[]
  relationRows: RawRelationRow[]
}

async function loadInventory(fetch: FetchFn, itemId: number): Promise<LoadedInventory> {
  const item = await loadItem(fetch, itemId)
  const [fileRows, relationRows] = await Promise.all([loadFileRows(fetch, itemId), loadRelationRows(fetch, itemId)])
  return { item, fileRows, relationRows }
}

async function buildResponse(fetch: FetchFn, inventory: LoadedInventory, locale: ContentLocale): Promise<AdminContentMediaRelations> {
  const { item, fileRows, relationRows } = inventory
  const managed = fileRows.filter(row => isManagedContentMediaRole(row.file_role))
  const archived = await archivedAmong(fetch, managed.map(row => fileIdOf(row.directus_files_id)))
  const imageLinks = imageBlockLinkIds(item)
  return {
    item: {
      id: item.id,
      content_type: item.content_type as ContentTypeId,
      status: item.status as ContentItemStatus,
      title: localeTitle(item.locales, locale),
    },
    locale,
    media: managed.map(row => toMediaLink(row, locale, archived, imageLinks)),
    preserved_role_counts: {
      og_image: fileRows.filter(row => row.file_role === 'og_image').length,
      source_document: fileRows.filter(row => row.file_role === 'source_document').length,
    },
    relations: relationRows.map(row => toRelation(row, locale)),
    inventory_version: mediaRelationsInventoryVersion(fileRows, relationRows),
  }
}

export async function getContentMediaRelations(fetch: FetchFn, itemId: number, rawLocale?: unknown): Promise<AdminContentMediaRelations> {
  const locale = parseLocale(rawLocale)
  return buildResponse(fetch, await loadInventory(fetch, itemId), locale)
}

// ── Save ────────────────────────────────────────────────────────────────────

function optionalText(value: unknown, max: number, label: string, errors: string[]): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    errors.push(`${label} must be text or null.`)
    return undefined
  }
  const text = value.trim()
  if (text.length > max) {
    errors.push(`${label} must be at most ${max} characters.`)
    return undefined
  }
  return text.length > 0 ? text : null
}

interface DesiredMedia {
  index: number
  row: RawFileRow | null
  fileId: string
  role: ContentManagedMediaRole
  sort: number
  alt: string | null | undefined
  caption: string | null | undefined
  language: string | null | undefined
  version_label: string | null | undefined
  file_date: string | null | undefined
  enabled: boolean | undefined
}

interface DesiredRelation {
  index: number
  row: RawRelationRow | null
  kind: 'product' | 'content'
  productId: number | null
  contentId: number | null
  sort: number
}

export async function saveContentMediaRelations(fetch: FetchFn, itemId: number, rawBody: unknown): Promise<AdminContentMediaRelations> {
  const body = assertJsonObject(rawBody)
  const unknownKeys = Object.keys(body).filter(key => !SAVE_KEYS.includes(key))
  if (unknownKeys.length > 0) fail(422, `These fields cannot be set here: ${unknownKeys.join(', ')}.`, { rejectedFields: unknownKeys })
  const locale = parseLocale(body.locale)
  if (typeof body.expectedInventoryVersion !== 'string' || body.expectedInventoryVersion.length === 0) {
    fail(422, 'expectedInventoryVersion is required.', { field: 'expectedInventoryVersion' })
  }
  if (!Array.isArray(body.media) || !Array.isArray(body.relations)) fail(422, 'media and relations must both be lists.')
  if (body.media.length > CONTENT_MEDIA_LINKS_MAX) fail(422, `At most ${CONTENT_MEDIA_LINKS_MAX} media links can be saved.`)
  if (body.relations.length > CONTENT_RELATIONS_MAX) fail(422, `At most ${CONTENT_RELATIONS_MAX} relations can be saved.`)

  const inventory = await loadInventory(fetch, itemId)
  const { item, fileRows, relationRows } = inventory
  if (item.status === 'archived') fail(409, 'This content item is archived and its media and relations cannot be changed.')
  const currentVersion = mediaRelationsInventoryVersion(fileRows, relationRows)
  if (body.expectedInventoryVersion !== currentVersion) {
    fail(409, 'Media or relations changed since this page was loaded. Reload before saving.', { currentInventoryVersion: currentVersion })
  }

  const errors: string[] = []
  const managedRows = fileRows.filter(row => isManagedContentMediaRole(row.file_role))
  const managedById = new Map(managedRows.map(row => [row.id, row]))
  const managedByKey = new Map(managedRows.map(row => [`${fileIdOf(row.directus_files_id)}|${row.file_role}`, row]))

  // ── Media: shape, identity and metadata ──
  const desiredMedia: DesiredMedia[] = []
  const seenMediaKeys = new Set<string>()
  const matchedMediaIds = new Set<number>()
  const roleCounters: Record<string, number> = {}
  body.media.forEach((raw: unknown, index: number) => {
    const label = `media[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { errors.push(`${label}: must be an object.`); return }
    const entry = raw as Row
    const extra = Object.keys(entry).filter(key => !MEDIA_KEYS.includes(key))
    if (extra.length > 0) { errors.push(`${label}: these fields cannot be set here: ${extra.join(', ')}.`); return }
    if (!isManagedContentMediaRole(entry.file_role)) {
      errors.push(entry.file_role === 'og_image' || entry.file_role === 'source_document'
        ? `${label}: the ${entry.file_role} role is managed in another workspace module.`
        : `${label}: file_role must be hero, inline or download.`)
      return
    }
    const role = entry.file_role
    if (typeof entry.directus_files_id !== 'string' || !UUID_RE.test(entry.directus_files_id)) { errors.push(`${label}: directus_files_id must be a Media Library file id.`); return }
    const fileId = entry.directus_files_id.toLowerCase()
    const key = `${fileId}|${role}`
    if (seenMediaKeys.has(key)) { errors.push(`${label}: this file is already linked as ${role}.`); return }
    seenMediaKeys.add(key)

    let row: RawFileRow | null = null
    if (entry.id !== undefined && entry.id !== null) {
      const existing = Number.isInteger(entry.id) ? managedById.get(entry.id as number) : undefined
      if (!existing || fileIdOf(existing.directus_files_id).toLowerCase() !== fileId || existing.file_role !== role) {
        errors.push(`${label}: link ${String(entry.id)} does not belong to this content item with this file and role.`)
        return
      }
      row = existing
    } else {
      row = managedByKey.get(`${fileId}|${role}`) ?? null
    }
    if (row) {
      if (matchedMediaIds.has(row.id)) { errors.push(`${label}: link ${row.id} appears twice.`); return }
      matchedMediaIds.add(row.id)
    }

    const alt = optionalText(entry.alt, CONTENT_MEDIA_ALT_MAX, `${label}.alt`, errors)
    const caption = optionalText(entry.caption, CONTENT_MEDIA_CAPTION_MAX, `${label}.caption`, errors)
    let language: string | null | undefined
    let versionLabel: string | null | undefined
    let fileDate: string | null | undefined
    if (role === 'download') {
      if (entry.language !== undefined && entry.language !== null && !isContentDownloadLanguage(entry.language)) {
        errors.push(`${label}.language must be all, en, es or pt.`)
      } else {
        language = entry.language as string | null | undefined
      }
      versionLabel = optionalText(entry.version_label, CONTENT_MEDIA_VERSION_MAX, `${label}.version_label`, errors)
      if (entry.file_date !== undefined && entry.file_date !== null && !isIsoDate(entry.file_date)) {
        errors.push(`${label}.file_date must be a date (YYYY-MM-DD).`)
      } else {
        fileDate = entry.file_date as string | null | undefined
      }
    } else {
      for (const field of ['language', 'version_label', 'file_date']) {
        if (entry[field] !== undefined && entry[field] !== null) errors.push(`${label}.${field} applies to downloads only.`)
      }
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') errors.push(`${label}.enabled must be true or false.`)

    const sort = roleCounters[role] ?? 0
    roleCounters[role] = sort + 1
    desiredMedia.push({
      index, row, fileId, role, sort, alt, caption, language, version_label: versionLabel, file_date: fileDate,
      enabled: typeof entry.enabled === 'boolean' ? entry.enabled : undefined,
    })
  })

  if (desiredMedia.filter(m => m.role === 'hero').length > 1) errors.push('Only one hero media file can be linked.')

  // New files: exist, not archived, pictures where the role needs one.
  const newMedia = desiredMedia.filter(m => !m.row)
  if (newMedia.length > 0) {
    const ids = [...new Set(newMedia.map(m => m.fileId))]
    const [filesRes, archived] = await Promise.all([
      fetch<{ data: Array<{ id: string, type: string | null }> }>(`/files?filter[id][_in]=${ids.join(',')}&fields=id,type&limit=-1`),
      archivedAmong(fetch, ids),
    ])
    const types = new Map((filesRes.data ?? []).map(f => [String(f.id).toLowerCase(), f.type]))
    for (const media of newMedia) {
      const label = `media[${media.index}]`
      if (!types.has(media.fileId)) errors.push(`${label}: the file does not exist in the Media Library.`)
      else if (archived.has(media.fileId)) errors.push(`${label}: the file is archived in the Media Library and cannot be linked.`)
      else if (CONTENT_IMAGE_ONLY_ROLES.includes(media.role) && !isImageMimeType(types.get(media.fileId))) {
        errors.push(`${label}: ${media.role === 'hero' ? 'hero media' : 'inline media'} must be an image.`)
      }
    }
  }

  // Removed links: an inline link an image block still points at stays.
  const imageLinks = imageBlockLinkIds(item)
  const removedMedia = managedRows.filter(row => !matchedMediaIds.has(row.id))
  for (const row of removedMedia) {
    if (row.file_role === 'inline' && imageLinks.has(row.id)) {
      errors.push(`Inline media link ${row.id} is used by an image section. Remove that section in Content editor first.`)
    }
  }

  // ── Relations ──
  const relationsById = new Map(relationRows.map(row => [row.id, row]))
  const relationsByTarget = new Map(relationRows.map(row => [
    row.relation_kind === 'product' ? `product:${productIdOf(row.product_id)}` : `content:${contentIdOf(row.related_content_id)}`, row,
  ]))
  const desiredRelations: DesiredRelation[] = []
  const seenTargets = new Set<string>()
  const matchedRelationIds = new Set<number>()
  body.relations.forEach((raw: unknown, index: number) => {
    const label = `relations[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { errors.push(`${label}: must be an object.`); return }
    const entry = raw as Row
    const extra = Object.keys(entry).filter(key => !RELATION_KEYS.includes(key))
    if (extra.length > 0) { errors.push(`${label}: these fields cannot be set here: ${extra.join(', ')}.`); return }
    const valid = validateContentRelationInput(entry as never, itemId)
    if (!valid.ok) { errors.push(`${label}: ${valid.message}`); return }
    const target = valid.relation_kind === 'product' ? `product:${valid.product_id}` : `content:${valid.related_content_id}`
    if (seenTargets.has(target)) { errors.push(`${label}: this ${valid.relation_kind} is already related.`); return }
    seenTargets.add(target)

    let row: RawRelationRow | null = null
    if (entry.id !== undefined && entry.id !== null) {
      const existing = Number.isInteger(entry.id) ? relationsById.get(entry.id as number) : undefined
      const existingTarget = existing
        ? (existing.relation_kind === 'product' ? `product:${productIdOf(existing.product_id)}` : `content:${contentIdOf(existing.related_content_id)}`)
        : null
      if (!existing || existingTarget !== target) {
        errors.push(`${label}: relation ${String(entry.id)} does not belong to this content item with this target.`)
        return
      }
      row = existing
    } else {
      row = relationsByTarget.get(target) ?? null
    }
    if (row) matchedRelationIds.add(row.id)
    desiredRelations.push({ index, row, kind: valid.relation_kind, productId: valid.product_id, contentId: valid.related_content_id, sort: desiredRelations.length })
  })

  const newProductIds = [...new Set(desiredRelations.filter(r => !r.row && r.kind === 'product').map(r => r.productId!))]
  const newContentIds = [...new Set(desiredRelations.filter(r => !r.row && r.kind === 'content').map(r => r.contentId!))]
  const [productsRes, contentRes] = await Promise.all([
    newProductIds.length ? fetch<{ data: Array<{ id: number }> }>(`/items/products?filter[id][_in]=${newProductIds.join(',')}&fields=id&limit=-1`) : Promise.resolve({ data: [] }),
    newContentIds.length ? fetch<{ data: Array<{ id: number, status: string }> }>(`/items/content_items?filter[id][_in]=${newContentIds.join(',')}&fields=id,status&limit=-1`) : Promise.resolve({ data: [] }),
  ])
  const products = new Set((productsRes.data ?? []).map(p => p.id))
  const contents = new Map((contentRes.data ?? []).map(c => [c.id, c.status]))
  for (const relation of desiredRelations.filter(r => !r.row)) {
    const label = `relations[${relation.index}]`
    if (relation.kind === 'product' && !products.has(relation.productId!)) errors.push(`${label}: product ${relation.productId} does not exist.`)
    if (relation.kind === 'content') {
      if (!contents.has(relation.contentId!)) errors.push(`${label}: content item ${relation.contentId} does not exist.`)
      else if (contents.get(relation.contentId!) === 'archived') errors.push(`${label}: content item ${relation.contentId} is archived and cannot be related.`)
    }
  }

  if (errors.length > 0) {
    fail(422, 'Some media or relation changes are not valid. Nothing was saved.', { field: 'media-relations', errors: errors.slice(0, 30) })
  }

  // ── Plan ──
  const altField = contentMediaAltField(locale)
  const captionField = contentMediaCaptionField(locale)
  const mediaCreates: Row[] = []
  const mediaUpdates: Row[] = []
  for (const media of desiredMedia) {
    const values: Row = { sort: media.sort }
    if (media.alt !== undefined) values[altField] = media.alt
    if (media.caption !== undefined) values[captionField] = media.caption
    if (media.role === 'download') {
      if (media.language !== undefined) values.language = media.language
      if (media.version_label !== undefined) values.version_label = media.version_label
      if (media.file_date !== undefined) values.file_date = media.file_date
    }
    if (media.enabled !== undefined) values.enabled = media.enabled
    if (!media.row) {
      mediaCreates.push({ content_items_id: itemId, directus_files_id: media.fileId, file_role: media.role, enabled: true, ...values })
      continue
    }
    const changed = Object.entries(values).filter(([key, value]) => (media.row![key] ?? null) !== (value ?? null))
    if (changed.length > 0) mediaUpdates.push({ id: media.row.id, ...Object.fromEntries(changed) })
  }
  const mediaDeletes = removedMedia.map(row => row.id)

  const relationCreates = desiredRelations.filter(r => !r.row).map(r => ({
    content_items_id: itemId, relation_kind: r.kind, product_id: r.productId, related_content_id: r.contentId, sort: r.sort,
  }))
  const relationUpdates = desiredRelations.filter(r => r.row && (r.row.sort ?? null) !== r.sort).map(r => ({ id: r.row!.id, sort: r.sort }))
  const relationDeletes = relationRows.filter(row => !matchedRelationIds.has(row.id)).map(row => row.id)

  // ── Write: creates → updates → deletes ──
  const steps: Array<() => Promise<unknown>> = []
  if (mediaCreates.length) steps.push(() => fetch('/items/content_items_files?fields=id', { method: 'POST', body: mediaCreates }))
  if (relationCreates.length) steps.push(() => fetch('/items/content_relations?fields=id', { method: 'POST', body: relationCreates }))
  if (mediaUpdates.length) steps.push(() => fetch('/items/content_items_files?fields=id', { method: 'PATCH', body: mediaUpdates }))
  if (relationUpdates.length) steps.push(() => fetch('/items/content_relations?fields=id', { method: 'PATCH', body: relationUpdates }))
  if (mediaDeletes.length) steps.push(() => fetch('/items/content_items_files', { method: 'DELETE', body: mediaDeletes }))
  if (relationDeletes.length) steps.push(() => fetch('/items/content_relations', { method: 'DELETE', body: relationDeletes }))

  let completed = 0
  try {
    for (const step of steps) {
      await step()
      completed++
    }
  } catch (err) {
    const partial = completed > 0
    const data = { partial, completedSteps: completed, totalSteps: steps.length }
    if (partial) {
      fail(500, 'Saving stopped part-way: some changes were saved and some were not. Reload to see the current state before saving again.', data)
    }
    if (uniqueViolationField(err) !== null) {
      fail(409, 'This link was added by another save at the same time. Reload before saving again.', data)
    }
    throw err
  }

  return buildResponse(fetch, await loadInventory(fetch, itemId), locale)
}
