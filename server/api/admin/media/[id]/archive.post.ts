import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import {
  getFileReferences,
  getLifecycleRecord,
  createOrUpdateLifecycleArchive,
} from '~/server/utils/mediaLifecycle'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const fetch = <T>(path: string, opts?: Record<string, unknown>) =>
    adminFetch<T>(event, path, opts)

  // Verify file exists
  const fileCheck = await adminFetch<{ data: { id: string }[] }>(
    event,
    `/files?filter[id][_eq]=${uuid}&fields=id&limit=1`,
  )
  if (!fileCheck.data?.length) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  // Check if already archived
  const existing = await getLifecycleRecord(uuid, fetch)
  if (existing?.archived) {
    throw createError({ statusCode: 409, message: '该文件已处于归档状态' })
  }

  // Reference check — refuse if any active references exist
  const refs = await getFileReferences(uuid, fetch)
  if (!refs.can_archive) {
    throw createError({
      statusCode: 409,
      message: `文件仍被 ${refs.total} 个引用使用，无法归档`,
      data: refs,
    })
  }

  // Get admin email for audit trail
  const meRes = await adminFetch<{ data: { email: string } }>(event, '/users/me?fields=email')
  const archivedBy = meRes.data?.email ?? 'unknown'

  const archivedAt = await createOrUpdateLifecycleArchive(uuid, archivedBy, existing, fetch)

  return {
    success: true,
    file_id: uuid,
    archived_at: archivedAt,
    archived_by: archivedBy,
  }
})
