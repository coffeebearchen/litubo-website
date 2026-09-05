import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { resolveFolderRegistry, validateMoveFolder } from '~/server/utils/folderRegistry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_FIELDS = new Set(['title', 'description', 'folder'])

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const body = await readBody(event) as Record<string, unknown>
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体无效' })
  }

  // Strict whitelist — reject any unexpected field
  const rejected = Object.keys(body).filter(k => !ALLOWED_FIELDS.has(k))
  if (rejected.length > 0) {
    throw createError({ statusCode: 400, message: `不允许修改字段：${rejected.join(', ')}` })
  }

  const payload: Record<string, unknown> = {}

  if ('title' in body) {
    const t = String(body.title ?? '').trim().slice(0, 255)
    payload.title = t || null
  }
  if ('description' in body) {
    const d = String(body.description ?? '').trim().slice(0, 1000)
    payload.description = d || null
  }
  if ('folder' in body) {
    const f = body.folder
    if (f !== null && f !== '' && !UUID_RE.test(String(f))) {
      throw createError({ statusCode: 400, message: 'folder 必须是有效的 UUID 或 null' })
    }
    const folderUuid = f === '' ? null : (f as string | null) ?? null

    // Server-side registry validation — single-file patch/move cannot set folder to null
    // (existing files cannot be returned to Needs Classification this way).
    const registry = await resolveFolderRegistry(event)
    const check = validateMoveFolder(registry, folderUuid)
    if (!check.ok) {
      throw createError({ statusCode: 422, message: `${check.code}: ${check.message}` })
    }

    payload.folder = folderUuid
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: '没有提供可更新的字段' })
  }

  const result = await adminFetch<{ data: unknown }>(event, `/files/${id}`, {
    method: 'PATCH',
    body: payload,
  })

  return (result as { data: unknown }).data
})
