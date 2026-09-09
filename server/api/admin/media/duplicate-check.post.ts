import { readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { findPossibleDuplicates } from '~/server/utils/mediaFilename'
import type { ExistingFile, DuplicateCandidate } from '~/server/utils/mediaFilename'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CANDIDATES = 50

/**
 * ML-CLOUD-02 — "have I already uploaded this?", asked before the upload.
 *
 * Answers with what is already in the destination folder under the same name
 * and the same byte count. It is a warning the operator resolves, never a
 * block: nothing here deletes, overwrites or refuses an upload, and the
 * endpoint writes nothing at all.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { folder?: unknown, candidates?: unknown }
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体无效' })
  }

  const rawFolder = body.folder
  if (rawFolder !== null && rawFolder !== undefined && rawFolder !== '' && !UUID_RE.test(String(rawFolder))) {
    throw createError({ statusCode: 400, message: 'folder 必须是有效的 UUID 或 null' })
  }
  const folder = rawFolder === '' || rawFolder === undefined ? null : (rawFolder as string | null)

  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    throw createError({ statusCode: 400, message: 'candidates 必须是非空数组' })
  }
  if (body.candidates.length > MAX_CANDIDATES) {
    throw createError({ statusCode: 400, message: `单次最多检查 ${MAX_CANDIDATES} 个文件` })
  }

  const candidates: DuplicateCandidate[] = []
  for (const raw of body.candidates as Array<Record<string, unknown>>) {
    const filename = String(raw?.filename ?? '').trim()
    const size = Number(raw?.size)
    if (!filename || !Number.isFinite(size) || size < 0) {
      throw createError({ statusCode: 400, message: 'candidates 每项需要 filename 与 size' })
    }
    candidates.push({ filename, size })
  }

  const existing = await adminFetch<{ data: ExistingFile[] }>(
    event,
    `/files?${folder === null ? 'filter[folder][_null]=true' : `filter[folder][_eq]=${folder}`}`
    + '&fields=id,filename_download,filesize&limit=500',
  )

  return { duplicates: findPossibleDuplicates(candidates, existing.data ?? []) }
})
