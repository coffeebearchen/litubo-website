import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { resolveFolderRegistry, validateMoveFolder } from '~/server/utils/folderRegistry'
import { normalizeFilename, findFilenameClash } from '~/server/utils/mediaFilename'
import type { ExistingFile } from '~/server/utils/mediaFilename'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_FIELDS = new Set(['title', 'description', 'folder', 'filename_download'])

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

  /**
   * ML-CLOUD-02 — File Rename.
   *
   * `filename_download` is the name a person sees and downloads; the file's
   * UUID, its stored object (`filename_disk`), its MIME type and every
   * Product / Content / AI Source reference are untouched, because none of
   * them address a file by name. That is the whole reason a rename is safe
   * here: it is a metadata edit on one row, not a copy and not a re-upload.
   */
  if ('filename_download' in body) {
    const current = await adminFetch<{ data: { filename_download: string | null, folder: string | null } }>(
      event, `/files/${id}?fields=filename_download,folder`,
    )
    const currentName = current.data?.filename_download ?? null

    const named = normalizeFilename(body.filename_download, currentName)
    if (!named.ok) {
      throw createError({ statusCode: 422, message: `${named.code}: ${named.message}` })
    }

    // Compare against the folder the file will END UP in — a rename and a move
    // can arrive in the same request, and the clash that matters is the one at
    // the destination.
    const destination = 'folder' in payload
      ? (payload.folder as string | null)
      : (current.data?.folder ?? null)

    const siblings = await adminFetch<{ data: ExistingFile[] }>(
      event,
      `/files?${destination === null ? 'filter[folder][_null]=true' : `filter[folder][_eq]=${destination}`}`
      + '&fields=id,filename_download,filesize&limit=500',
    )
    const clash = findFilenameClash(siblings.data ?? [], named.name, id)
    if (clash) {
      throw createError({
        statusCode: 422,
        message: `FILENAME_TAKEN: "${named.name}" already exists in this folder.`,
      })
    }

    payload.filename_download = named.name
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
