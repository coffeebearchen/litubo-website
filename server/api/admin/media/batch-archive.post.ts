import { readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import {
  getFileReferences,
  getLifecycleRecord,
  createOrUpdateLifecycleArchive,
} from '~/server/utils/mediaLifecycle'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 100

export type BatchArchiveOutcome = 'archived' | 'referenced' | 'already-archived' | 'not-found' | 'failed'

export interface BatchArchiveRow {
  id: string
  outcome: BatchArchiveOutcome
  message?: string
  reference_total?: number
}

/**
 * ML-CLOUD-02 — archive many files, one reference check each.
 *
 * This runs the SAME protection as single-file archive: `getFileReferences`
 * decides, and a file a product still points at is skipped rather than
 * archived. Batching is about saving clicks, and a batch that quietly relaxed
 * the rule the single action enforces would be the one way to lose a
 * referenced asset — so every file is judged on its own and reported on its
 * own, and one refusal never stops the rest.
 *
 * Nothing here deletes anything. Archive is a row in the lifecycle collection
 * and Restore reverses it.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { file_ids?: unknown }
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体无效' })
  }

  const { file_ids } = body
  if (!Array.isArray(file_ids) || file_ids.length === 0) {
    throw createError({ statusCode: 400, message: 'file_ids 必须是非空数组' })
  }
  if (file_ids.length > MAX_BATCH) {
    throw createError({ statusCode: 400, message: `单次批量归档最多 ${MAX_BATCH} 个文件` })
  }
  for (const id of file_ids) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw createError({ statusCode: 400, message: `file_ids 包含无效的文件 UUID：${id}` })
    }
  }

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)

  const meRes = await adminFetch<{ data: { email: string } }>(event, '/users/me?fields=email')
  const archivedBy = meRes.data?.email ?? 'unknown'

  const results: BatchArchiveRow[] = []

  for (const fileId of file_ids as string[]) {
    try {
      const fileCheck = await adminFetch<{ data: { id: string }[] }>(
        event, `/files?filter[id][_eq]=${fileId}&fields=id&limit=1`,
      )
      if (!fileCheck.data?.length) {
        results.push({ id: fileId, outcome: 'not-found', message: '文件不存在' })
        continue
      }

      const existing = await getLifecycleRecord(fileId, fetch)
      if (existing?.archived) {
        results.push({ id: fileId, outcome: 'already-archived' })
        continue
      }

      const refs = await getFileReferences(fileId, fetch)
      if (!refs.can_archive) {
        results.push({
          id: fileId,
          outcome: 'referenced',
          reference_total: refs.total,
          message: `仍被 ${refs.total} 个引用使用`,
        })
        continue
      }

      await createOrUpdateLifecycleArchive(fileId, archivedBy, existing, fetch)
      results.push({ id: fileId, outcome: 'archived' })
    }
    catch (e: unknown) {
      const err = e as { data?: { message?: string }, message?: string }
      results.push({ id: fileId, outcome: 'failed', message: err.data?.message ?? err.message ?? '归档失败' })
    }
  }

  const archived = results.filter(r => r.outcome === 'archived').length
  return {
    archived,
    skipped: results.length - archived,
    archived_by: archivedBy,
    results,
  }
})
