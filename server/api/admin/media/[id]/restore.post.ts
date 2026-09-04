import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getLifecycleRecord, restoreLifecycleRecord } from '~/server/utils/mediaLifecycle'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const fetch = <T>(path: string, opts?: Record<string, unknown>) =>
    adminFetch<T>(event, path, opts)

  const record = await getLifecycleRecord(uuid, fetch)

  if (!record) {
    throw createError({ statusCode: 404, message: '未找到该文件的归档记录' })
  }

  if (!record.archived) {
    throw createError({ statusCode: 409, message: '该文件当前未处于归档状态' })
  }

  const meRes = await adminFetch<{ data: { email: string } }>(event, '/users/me?fields=email')
  const restoredBy = meRes.data?.email ?? 'unknown'

  const restoredAt = await restoreLifecycleRecord(record, restoredBy, fetch)

  return {
    success: true,
    file_id: uuid,
    restored_at: restoredAt,
    restored_by: restoredBy,
  }
})
