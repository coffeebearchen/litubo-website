import { readMultipartFormData, createError } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import { assertFolderAllowsUpload } from '~/server/utils/folderRegistry'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
])
const ALLOWED_EXTS = /\.(jpe?g|png|webp|pdf)$/i
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const token = getAdminToken(event)
  const config = useRuntimeConfig()

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: '没有收到文件' })
  }

  // Extract non-file fields (apply to all files in batch)
  const folderPart = parts.find(p => !p.filename && p.name === 'folder')
  const folder = folderPart ? String(folderPart.data).trim() : null
  if (folder && !UUID_RE.test(folder)) {
    throw createError({ statusCode: 400, message: 'folder 必须是有效的 UUID' })
  }

  // Server-side registry validation — null folder is allowed (Needs Classification).
  // Client-side isFolderCanonical checks are not trusted.
  await assertFolderAllowsUpload(folder, event, true)

  const fileParts = parts.filter(p => !!p.filename)
  if (fileParts.length === 0) {
    throw createError({ statusCode: 400, message: '没有收到文件内容' })
  }

  const uploaded: Array<{ id: string; filename_download: string; title: string }> = []
  const errors: Array<{ filename: string; message: string }> = []

  for (const part of fileParts) {
    const filename = part.filename ?? 'upload'
    const ct = (part.type ?? '').toLowerCase().split(';')[0].trim() || 'application/octet-stream'

    if (!ALLOWED_TYPES.has(ct) || !ALLOWED_EXTS.test(filename)) {
      errors.push({ filename, message: `格式不支持（${ct}）。仅允许 JPG、PNG、WebP、PDF` })
      continue
    }

    if (part.data.length > MAX_SIZE) {
      errors.push({ filename, message: `文件超过 50MB 限制（实际 ${(part.data.length / 1048576).toFixed(1)} MB）` })
      continue
    }

    const autoTitle = filename.replace(/\.[^.]+$/, '')

    const fd = new FormData()
    const rawBuf = part.data.buffer instanceof SharedArrayBuffer
      ? new Uint8Array(part.data).slice().buffer
      : (part.data.buffer as ArrayBuffer)
    fd.append('file', new Blob([rawBuf], { type: ct }), filename)
    fd.append('title', autoTitle)
    if (folder) fd.append('folder', folder)

    try {
      const res = await $fetch<{ data: { id: string; filename_download: string; title: string } }>(
        `${config.directusUrl}/files`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd },
      )
      uploaded.push(res.data)
    } catch {
      errors.push({ filename, message: '上传失败，Directus 返回错误，请重试' })
    }
  }

  return { uploaded, errors }
})
