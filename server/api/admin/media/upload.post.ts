import { readMultipartFormData, createError } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import { assertFolderAllowsUpload } from '~/server/utils/folderRegistry'

/**
 * PWS-AI-BETA-01R1 — the Media Library is the only sanctioned upload route, so
 * whatever the AI Source Intake screen can analyse has to be uploadable here.
 * Text sources (TXT / CSV / TSV) were analysable but not uploadable, which left
 * no supported way to get one onto a product at all. Image and PDF handling is
 * unchanged; these three types are added alongside them.
 *
 * AI-XLSX-SOURCE-01 — standard .xlsx workbooks are accepted too. Legacy .xls and
 * macro-enabled .xlsm are not: V1 reads neither, so storing one would only offer
 * a source that can never be analyzed.
 */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
  'text/plain', 'text/csv', 'text/tab-separated-values',
  XLSX_MIME,
])
const ALLOWED_EXTS = /\.(jpe?g|png|webp|pdf|txt|csv|tsv|xlsx)$/i

/** Human-readable list of what is accepted, kept next to the rule it describes so the two cannot drift. */
export const ALLOWED_UPLOAD_LABEL = 'JPG、PNG、WebP、PDF、TXT、CSV、TSV、XLSX'

/** A legacy workbook is told what to do about it, not only that it was refused. */
export const LEGACY_XLS_MESSAGE = 'Legacy .xls files are not supported. Save as .xlsx and upload again.'

/**
 * The upload rule itself, exported so it is asserted directly rather than
 * restated in a test. Both halves must pass: a matching MIME type AND a
 * matching extension, so neither a renamed file nor a spoofed content type is
 * enough on its own.
 */
export function isAllowedUpload(filename: string, contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType.toLowerCase().split(';')[0].trim()) && ALLOWED_EXTS.test(filename)
}

/**
 * Why a file was refused. A legacy .xls workbook gets its own sentence. It is
 * recognised by its name alone: a browser on a machine with Excel installed can
 * label a .csv file `application/vnd.ms-excel` too, and that file is no .xls.
 */
export function uploadRefusalMessage(filename: string, contentType: string): string {
  if (/\.xls$/i.test(filename)) return LEGACY_XLS_MESSAGE
  return `格式不支持（${contentType}）。仅允许 ${ALLOWED_UPLOAD_LABEL}`
}
/**
 * A safe, actionable reason for a storage failure, derived from the HTTP
 * status alone. Nothing from the provider's response body reaches the browser.
 */
export function uploadFailureMessage(status: number | undefined): string {
  if (status === 401 || status === 403) return '没有权限保存该文件，请重新登录后重试'
  if (status === 413) return '文件过大，存储服务拒绝接收'
  if (status === 415 || status === 400) return '存储服务无法识别该文件内容'
  if (status !== undefined && status >= 500) return '存储服务暂时不可用，请稍后重试'
  if (status === undefined) return '无法连接存储服务，请稍后重试'
  return `文件未能保存（存储服务返回 ${status}），请重试`
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
      errors.push({ filename, message: uploadRefusalMessage(filename, ct) })
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
    /**
     * MEDIA-UPLOAD-BLOCKER-HOTFIX-02 — send THIS file's bytes, not the buffer
     * pool they happen to live in.
     *
     * `part.data` is a Node Buffer, and Node allocates buffers under 8 KB from
     * a shared 8192-byte pool. `part.data.buffer` is therefore the whole pool,
     * not the file: reading it uploaded 8192 bytes starting at offset 0, which
     * both truncated/padded every small file to 8 KB and shipped whatever else
     * was in the pool at that moment — in testing, a 160-byte text file was
     * stored as 8 KB of the dev server's internal IPC traffic.
     *
     * That also explains why this failed intermittently rather than always:
     * Directus accepts or rejects the result depending on what the neighbouring
     * bytes happen to be, so the same file could upload once and fail the next
     * time. `byteOffset` and `byteLength` are what identify the file inside the
     * pool, and `.slice()` on the view copies exactly those bytes.
     */
    const exactBytes = new Uint8Array(part.data.buffer, part.data.byteOffset, part.data.byteLength).slice()
    fd.append('title', autoTitle)
    if (folder) fd.append('folder', folder)
    fd.append('file', new Blob([exactBytes], { type: ct }), filename)

    try {
      const res = await $fetch<{ data: { id: string; filename_download: string; title: string } }>(
        `${config.directusUrl}/files`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd },
      )
      uploaded.push(res.data)
    } catch (e: unknown) {
      /**
       * Report why, without leaking how. "Upload failed" gave the operator
       * nothing to act on; the Directus status distinguishes the cases they
       * can actually do something about. The response body is never forwarded
       * — it can carry paths and internal detail — so only the status is read.
       */
      const status = (e as { statusCode?: number, response?: { status?: number } })?.statusCode
        ?? (e as { response?: { status?: number } })?.response?.status
      errors.push({ filename, message: uploadFailureMessage(status) })
    }
  }

  return { uploaded, errors }
})
