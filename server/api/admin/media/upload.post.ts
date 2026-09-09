import { readMultipartFormData, createError } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import { assertFolderAllowsUpload } from '~/server/utils/folderRegistry'

/**
 * PWS-AI-BETA-01R1 — the Media Library is the only sanctioned upload route, so
 * whatever the AI Source Intake screen can analyse has to be uploadable here.
 * Text sources (TXT / CSV / TSV) were analysable but not uploadable, which left
 * no supported way to get one onto a product at all. Image and PDF handling is
 * unchanged; these three types are added alongside them.
 */
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
  'text/plain', 'text/csv', 'text/tab-separated-values',
])
const ALLOWED_EXTS = /\.(jpe?g|png|webp|pdf|txt|csv|tsv)$/i

/** Human-readable list of what is accepted, kept next to the rule it describes so the two cannot drift. */
export const ALLOWED_UPLOAD_LABEL = 'JPG、PNG、WebP、PDF、TXT、CSV、TSV'

/**
 * The upload rule itself, exported so it is asserted directly rather than
 * restated in a test. Both halves must pass: a matching MIME type AND a
 * matching extension, so neither a renamed file nor a spoofed content type is
 * enough on its own.
 */
export function isAllowedUpload(filename: string, contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType.toLowerCase().split(';')[0].trim()) && ALLOWED_EXTS.test(filename)
}
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

    if (!isAllowedUpload(filename, ct)) {
      errors.push({ filename, message: `格式不支持（${ct}）。仅允许 ${ALLOWED_UPLOAD_LABEL}` })
      continue
    }

    if (part.data.length > MAX_SIZE) {
      errors.push({ filename, message: `文件超过 50MB 限制（实际 ${(part.data.length / 1048576).toFixed(1)} MB）` })
      continue
    }

    const autoTitle = filename.replace(/\.[^.]+$/, '')

    /**
     * ML-CLOUD-01 — field order matters here, and getting it wrong is silent.
     *
     * Directus reads the multipart stream in order and applies the metadata
     * fields it has seen by the time the file part arrives; anything appended
     * after the file is ignored without an error. `folder` and `title` were
     * being appended last, so every upload landed in Unclassified no matter
     * which folder the operator chose — the request succeeded, the file was
     * stored, and the destination was quietly dropped. They now precede the
     * file part.
     */
    const fd = new FormData()
    const rawBuf = part.data.buffer instanceof SharedArrayBuffer
      ? new Uint8Array(part.data).slice().buffer
      : (part.data.buffer as ArrayBuffer)
    fd.append('title', autoTitle)
    if (folder) fd.append('folder', folder)
    fd.append('file', new Blob([rawBuf], { type: ct }), filename)

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
