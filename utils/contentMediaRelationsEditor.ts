/**
 * CC-IMP-04 — Media & Relations page state (client).
 *
 * Every Select / Replace / Remove / reorder / metadata edit changes only this
 * local staged state. One Save sends the complete desired inventory with the
 * `inventory_version` it was loaded with; the server validates the whole set
 * before writing anything.
 */

import type { AdminContentMediaLink, AdminContentMediaRelations, AdminContentRelation } from '../types/content-center'
import { CONTENT_MEDIA_MANAGED_ROLES, isContentDownloadLanguage, type ContentDownloadLanguage, type ContentManagedMediaRole } from './contentMediaRelations'
import { contentApiErrorStatus, contentTypeLabel } from './contentCenter'

export interface StagedMediaFile {
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  /** `null` for a file picked on this page: its visibility is shown after Save. */
  is_public: boolean | null
  archived: boolean
}

export interface StagedMediaLink {
  key: string
  id: number | null
  directus_files_id: string
  file_role: ContentManagedMediaRole
  alt: string
  caption: string
  language: ContentDownloadLanguage | ''
  version_label: string
  file_date: string
  enabled: boolean
  used_by_image_blocks: boolean
  file: StagedMediaFile
}

export interface StagedRelation {
  key: string
  id: number | null
  relation_kind: 'product' | 'content'
  target_id: number
  label: string
  code: string | null
  status: string | null
  content_type: string | null
}

export interface MediaRelationsState {
  media: StagedMediaLink[]
  relations: StagedRelation[]
}

/** A product or content item offered by the relation picker. */
export interface RelationCandidate {
  kind: 'product' | 'content'
  id: number
  label: string
  code: string | null
  status: string | null
  content_type: string | null
}

export interface PickedLibraryFile {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
}

export const mediaLinkKey = (fileId: string, role: string) => `${role}:${fileId.toLowerCase()}`
export const relationKey = (kind: string, targetId: number) => `${kind}:${targetId}`

export function stagedMediaFromLink(link: AdminContentMediaLink): StagedMediaLink {
  return {
    key: mediaLinkKey(link.directus_files_id, link.file_role),
    id: link.id,
    directus_files_id: link.directus_files_id,
    file_role: link.file_role,
    alt: link.alt ?? '',
    caption: link.caption ?? '',
    language: isContentDownloadLanguage(link.language) ? link.language : '',
    version_label: link.version_label ?? '',
    file_date: link.file_date ?? '',
    enabled: link.enabled,
    used_by_image_blocks: link.used_by_image_blocks,
    file: { ...link.file },
  }
}

export function stagedMediaFromFile(file: PickedLibraryFile, role: ContentManagedMediaRole): StagedMediaLink {
  return {
    key: mediaLinkKey(file.id, role),
    id: null,
    directus_files_id: file.id,
    file_role: role,
    alt: '',
    caption: '',
    language: role === 'download' ? 'all' : '',
    version_label: '',
    file_date: '',
    enabled: true,
    used_by_image_blocks: false,
    file: {
      filename_download: file.filename_download ?? file.title,
      title: file.title,
      type: file.type,
      filesize: file.filesize,
      width: file.width,
      height: file.height,
      is_public: null,
      archived: false,
    },
  }
}

export function stagedRelationFromRelation(relation: AdminContentRelation): StagedRelation {
  if (relation.relation_kind === 'product' && relation.product) {
    return {
      key: relationKey('product', relation.product.id), id: relation.id, relation_kind: 'product', target_id: relation.product.id,
      label: relation.product.name_en ?? `Product ${relation.product.id}`, code: relation.product.product_code, status: relation.product.status, content_type: null,
    }
  }
  const content = relation.content!
  return {
    key: relationKey('content', content.id), id: relation.id, relation_kind: 'content', target_id: content.id,
    label: content.title ?? `Content item ${content.id}`, code: null, status: content.status, content_type: content.content_type,
  }
}

export function stagedRelationFromProduct(product: { id: number, name_en: string | null, product_code: string | null, status: string | null }): StagedRelation {
  return {
    key: relationKey('product', product.id), id: null, relation_kind: 'product', target_id: product.id,
    label: product.name_en ?? `Product ${product.id}`, code: product.product_code, status: product.status, content_type: null,
  }
}

export function stagedRelationFromContent(content: { id: number, title: string | null, content_type: string | null, status: string | null }): StagedRelation {
  return {
    key: relationKey('content', content.id), id: null, relation_kind: 'content', target_id: content.id,
    label: content.title ?? `Content item ${content.id}`, code: null, status: content.status, content_type: content.content_type,
  }
}

const roleOrder = (role: string) => (CONTENT_MEDIA_MANAGED_ROLES as readonly string[]).indexOf(role)

export function mediaRelationsStateFrom(response: AdminContentMediaRelations): MediaRelationsState {
  const media = [...response.media]
    .sort((a, b) => roleOrder(a.file_role) - roleOrder(b.file_role) || (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    .map(stagedMediaFromLink)
  return { media, relations: response.relations.filter(r => r.product || r.content).map(stagedRelationFromRelation) }
}

export function cloneMediaRelationsState(state: MediaRelationsState): MediaRelationsState {
  return JSON.parse(JSON.stringify(state)) as MediaRelationsState
}

export function mediaOfRole(media: readonly StagedMediaLink[], role: ContentManagedMediaRole): StagedMediaLink[] {
  return media.filter(m => m.file_role === role)
}

function comparable(state: MediaRelationsState) {
  return {
    media: CONTENT_MEDIA_MANAGED_ROLES.flatMap(role => mediaOfRole(state.media, role).map(m => [
      m.id, m.directus_files_id.toLowerCase(), role, m.alt.trim(), m.caption.trim(), m.enabled,
      role === 'download' ? m.language : '', role === 'download' ? m.version_label.trim() : '', role === 'download' ? m.file_date : '',
    ])),
    relations: state.relations.map(r => [r.id, r.key]),
  }
}

export function isMediaRelationsDirty(original: MediaRelationsState, current: MediaRelationsState): boolean {
  return JSON.stringify(comparable(original)) !== JSON.stringify(comparable(current))
}

export interface MediaRelationsSaveBody {
  expectedInventoryVersion: string
  locale: string
  media: Array<Record<string, unknown>>
  relations: Array<Record<string, unknown>>
}

/** The whole desired inventory, ordered hero → inline → download; order inside a role is the saved sort. */
export function buildMediaRelationsSaveBody(state: MediaRelationsState, inventoryVersion: string, locale: string): MediaRelationsSaveBody {
  const media = CONTENT_MEDIA_MANAGED_ROLES.flatMap(role => mediaOfRole(state.media, role).map((m) => {
    const entry: Record<string, unknown> = {
      id: m.id,
      directus_files_id: m.directus_files_id,
      file_role: role,
      alt: m.alt.trim() || null,
      caption: m.caption.trim() || null,
      enabled: m.enabled,
    }
    if (role === 'download') {
      entry.language = m.language || null
      entry.version_label = m.version_label.trim() || null
      entry.file_date = m.file_date || null
    }
    return entry
  }))
  const relations = state.relations.map(r => ({
    id: r.id,
    relation_kind: r.relation_kind,
    product_id: r.relation_kind === 'product' ? r.target_id : null,
    related_content_id: r.relation_kind === 'content' ? r.target_id : null,
  }))
  return { expectedInventoryVersion: inventoryVersion, locale, media, relations }
}

/** Human labels for each entry of a save body, so `media[2]` in a server error reads as the file. */
export function saveBodyLabels(state: MediaRelationsState): { media: string[], relations: string[] } {
  return {
    media: CONTENT_MEDIA_MANAGED_ROLES.flatMap(role => mediaOfRole(state.media, role).map(m => `"${m.file.filename_download ?? m.directus_files_id}" (${role})`)),
    relations: state.relations.map(r => `"${r.label}"`),
  }
}

export function moveMediaWithinRole(media: readonly StagedMediaLink[], key: string, delta: number): StagedMediaLink[] {
  const target = media.find(m => m.key === key)
  if (!target) return [...media]
  const group = mediaOfRole(media, target.file_role)
  const index = group.findIndex(m => m.key === key)
  const swapWith = group[index + delta]
  if (!swapWith) return [...media]
  const next = [...media]
  const a = next.indexOf(target)
  const b = next.indexOf(swapWith)
  next[a] = swapWith
  next[b] = target
  return next
}

export function moveRelation(relations: readonly StagedRelation[], key: string, delta: number): StagedRelation[] {
  const index = relations.findIndex(r => r.key === key)
  const target = index + delta
  if (index < 0 || target < 0 || target >= relations.length) return [...relations]
  const next = [...relations]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry)
  return next
}

export function summarizeMediaRelations(state: MediaRelationsState) {
  return {
    hero: mediaOfRole(state.media, 'hero').length,
    inline: mediaOfRole(state.media, 'inline').length,
    downloads: mediaOfRole(state.media, 'download').length,
    products: state.relations.filter(r => r.relation_kind === 'product').length,
    content: state.relations.filter(r => r.relation_kind === 'content' && r.content_type !== 'resource_download').length,
    resources: state.relations.filter(r => r.relation_kind === 'content' && r.content_type === 'resource_download').length,
    archived: state.media.filter(m => m.file.archived).length,
  }
}

export function relationKindLabel(relation: Pick<StagedRelation, 'relation_kind' | 'content_type'>): string {
  return relation.relation_kind === 'product' ? 'Product' : contentTypeLabel(relation.content_type)
}

export function formatContentFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Save errors ─────────────────────────────────────────────────────────────

export type MediaRelationsErrorKind = 'conflict' | 'invalid' | 'partial' | 'rejected' | 'session' | 'forbidden' | 'not_found' | 'too_large' | 'unavailable'

export interface MediaRelationsSaveError {
  kind: MediaRelationsErrorKind
  status: number
  message: string
  errors: string[]
}

export const MEDIA_RELATIONS_CONFLICT_MESSAGE = 'Media or relations changed since you opened this page.'

export function interpretMediaRelationsSaveError(err: unknown, labels?: { media: string[], relations: string[] }): MediaRelationsSaveError {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: Record<string, unknown> } } | null)?.data
  const serverMessage = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const inner = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const base = (kind: MediaRelationsErrorKind, message: string, errors: string[] = []) => ({ kind, status, message, errors })

  if (inner.partial === true) {
    return base('partial', serverMessage ?? 'Saving stopped part-way. Reload to see the current state before saving again.')
  }
  switch (status) {
    case 409:
      if ('currentInventoryVersion' in inner) return base('conflict', MEDIA_RELATIONS_CONFLICT_MESSAGE)
      return base('rejected', serverMessage ?? 'These changes cannot be saved right now.')
    case 422: {
      const errors = (Array.isArray(inner.errors) ? inner.errors.map(String) : []).map(line => line
        .replace(/^media\[(\d+)\]/, (match, i) => labels?.media[Number(i)] ?? match)
        .replace(/^relations\[(\d+)\]/, (match, i) => labels?.relations[Number(i)] ?? match))
      return base('invalid', serverMessage ?? 'Some changes are not valid. Nothing was saved.', errors)
    }
    case 413:
      return base('too_large', 'This save is too large. Save fewer changes at once.')
    case 400:
      return base('rejected', serverMessage ?? 'The save request could not be processed.')
    case 401:
      return base('session', 'Your session has expired. Your staged changes are still here — sign in again in another tab, then save.')
    case 403:
      return base('forbidden', 'You do not have permission to change this content item.')
    case 404:
      return base('not_found', serverMessage ?? 'This content item was not found.')
    default:
      return base('unavailable', 'Content Center is temporarily unavailable. Your staged changes are kept — try again.')
  }
}

export const MEDIA_RELATIONS_LEAVE_MESSAGE = 'You have unsaved media or relation changes. Leave without saving?'
