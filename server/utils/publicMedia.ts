import type { FetchFn } from './mediaLifecycle'
import { archivedAmong } from './contentMediaRelations'

/**
 * CC-IMP-10 — runtime eligibility of one file behind the public media proxy
 * `/api/cms/media/:id` (RELEASE-SAFETY-GATES RSG-06; Blueprint §29, §35 P1 #10).
 *
 * A file is served only when, at request time, it exists, `is_public = true` and it
 * is not archived in the Media Library (`media_file_lifecycle.archived`). Publish
 * having checked it earlier is not trusted. The lookup uses list reads, so "no such
 * public file" is an empty result (404) while any upstream failure — auth,
 * permission, network, 5xx — throws and becomes 503, never a disguised 404.
 */

export const MEDIA_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PublicMediaLookup =
  | { found: false }
  | { found: true, type: string | null, filenameDownload: string | null }

export async function lookupPublicMedia(fetch: FetchFn, rawId: string): Promise<PublicMediaLookup> {
  if (!MEDIA_ID_RE.test(rawId)) return { found: false }
  const id = rawId.toLowerCase()
  const [fileRes, archived] = await Promise.all([
    fetch<{ data: Array<Record<string, unknown>> }>(
      `/files?filter[id][_eq]=${id}&filter[is_public][_eq]=true&fields=id,is_public,type,filename_download&limit=1`,
    ),
    archivedAmong(fetch, [id]),
  ])
  const file = (fileRes.data ?? []).find(row => String(row.id ?? '').toLowerCase() === id)
  if (!file || file.is_public !== true) return { found: false }
  if (archived.has(id)) return { found: false }
  return {
    found: true,
    type: typeof file.type === 'string' ? file.type : null,
    filenameDownload: typeof file.filename_download === 'string' ? file.filename_download : null,
  }
}

/** The asset disappeared between the metadata check and the byte read (Directus answers 403 / 404 for a missing item). */
export function isAssetGone(err: unknown): boolean {
  const status = (err as { statusCode?: unknown, status?: unknown } | null)?.statusCode ?? (err as { status?: unknown } | null)?.status
  return status === 403 || status === 404
}
