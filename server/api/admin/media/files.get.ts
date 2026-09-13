import { getQuery } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { listArchivedFileIds } from '~/server/utils/mediaLifecycle'

const MAX_LIMIT = 200
const FIELDS = [
  'id', 'filename_disk', 'filename_download', 'title', 'description',
  'type', 'filesize', 'width', 'height', 'folder',
  'uploaded_on', 'focal_point_x', 'focal_point_y',
].join(',')

/**
 * MEDIA-AI-LINK-PICKER-01 — `type=text` narrows to the formats AI Source Intake
 * can analyze today.
 *
 * Kept as a literal in the media module rather than imported from the AI
 * engine, and pinned to the engine's own allowlist by a parity test
 * (`tests/mediaLinkPicker.test.ts`), so the two cannot drift apart silently.
 *
 * Matched with `_starts_with`, not `_eq`: a stored content type may carry a
 * parameter (`text/plain; charset=utf-8`), which the engine ignores too.
 */
export const TEXT_FILTER_MIME_TYPES = ['text/plain', 'text/csv', 'text/tab-separated-values'] as const

/**
 * The Directus `/files` query for one request. Folder, format and search are
 * independent conditions that Directus ANDs together, which is what lets the
 * Product Workspace picker search inside a single folder.
 *
 * MEDIA-AI-LINK-PICKER-01-R1 — `excludeFileIds` removes files by id. The picker
 * uses it to leave archived files out of the result itself, so they are absent
 * from the list, the count and every page — not merely hidden on screen.
 */
export function buildFilesDirectusQuery(q: Record<string, unknown>, excludeFileIds: readonly string[] = []): string {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit ?? 100)))
  const offset = Math.max(0, Number(q.offset ?? 0))

  const parts: string[] = [
    `fields=${FIELDS}`,
    `limit=${limit}`,
    `offset=${offset}`,
    `sort[]=-uploaded_on`,
    `meta=total_count,filter_count`,
  ]

  if (q.folder === 'root') {
    parts.push('filter[folder][_null]=true')
  } else if (q.folder) {
    parts.push(`filter[folder][_eq]=${encodeURIComponent(String(q.folder))}`)
  }

  if (q.type === 'image') {
    parts.push('filter[type][_starts_with]=image/')
  } else if (q.type === 'pdf') {
    parts.push('filter[type][_eq]=application/pdf')
  } else if (q.type === 'text') {
    TEXT_FILTER_MIME_TYPES.forEach((mime, i) => {
      parts.push(`filter[_or][${i}][type][_starts_with]=${mime}`)
    })
  }

  if (excludeFileIds.length > 0) {
    parts.push(`filter[id][_nin]=${excludeFileIds.join(',')}`)
  }

  if (q.search) {
    parts.push(`search=${encodeURIComponent(String(q.search).slice(0, 100))}`)
  }

  return parts.join('&')
}

/**
 * `archived=exclude` is opt-in. Media Library's own views show archived files
 * with their badge and keep doing so; only a caller that must never offer an
 * archived file — the Product Workspace picker — asks for it.
 *
 * Fails closed: if the archived list cannot be read, the request fails rather
 * than returning a result that might contain archived files.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const excludeFileIds = q.archived === 'exclude' ? await listArchivedFileIds(fetch) : []
  return adminFetch(event, `/files?${buildFilesDirectusQuery(q, excludeFileIds)}`)
})
