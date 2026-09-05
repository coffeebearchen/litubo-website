import { readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { resolveFolderRegistry, validateMoveFolder } from '~/server/utils/folderRegistry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 200

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { file_ids?: unknown; folder?: unknown }

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体无效' })
  }

  const { file_ids, folder } = body

  // Validate folder UUID
  if (typeof folder !== 'string' || !UUID_RE.test(folder)) {
    throw createError({ statusCode: 400, message: 'folder 必须是有效的 UUID（批量移动不可使用 null）' })
  }

  // Validate file_ids array
  if (!Array.isArray(file_ids) || file_ids.length === 0) {
    throw createError({ statusCode: 400, message: 'file_ids 必须是非空数组' })
  }
  if (file_ids.length > MAX_BATCH) {
    throw createError({ statusCode: 400, message: `单次批量移动最多 ${MAX_BATCH} 个文件` })
  }
  for (const id of file_ids) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw createError({ statusCode: 400, message: `file_ids 包含无效的文件 UUID：${id}` })
    }
  }

  // Pre-validate target folder against registry BEFORE any write
  const registry = await resolveFolderRegistry(event)
  const check = validateMoveFolder(registry, folder)
  if (!check.ok) {
    throw createError({ statusCode: 422, message: `${check.code}: ${check.message}` })
  }

  // All validation passed — write each file (individual PATCHes, not atomic in Directus)
  const results: Array<{ id: string; ok: boolean; message?: string }> = []

  for (const fileId of file_ids as string[]) {
    try {
      await adminFetch(event, `/files/${fileId}`, {
        method: 'PATCH',
        body: { folder },
      })
      results.push({ id: fileId, ok: true })
    } catch {
      results.push({ id: fileId, ok: false, message: 'Directus PATCH failed' })
    }
  }

  const failed = results.filter(r => !r.ok)
  return {
    moved: results.filter(r => r.ok).length,
    failed: failed.length,
    errors: failed.length > 0 ? failed : undefined,
  }
})
