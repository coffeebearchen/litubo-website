import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getFileReferences } from '~/server/utils/mediaLifecycle'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const fetch = <T>(path: string, opts?: Record<string, unknown>) =>
    adminFetch<T>(event, path, opts)

  return getFileReferences(uuid, fetch)
})
