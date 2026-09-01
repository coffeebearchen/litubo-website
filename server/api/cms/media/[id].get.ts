import { defineEventHandler, getRouterParam, getQuery, createError, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''

  // Reject non-UUID ids immediately — no Directus host in the error
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const config = useRuntimeConfig()
  const base = config.directusUrl
  const token = config.directusToken

  if (!base || !token) {
    throw createError({ statusCode: 503, message: 'Media service unavailable' })
  }

  // Fetch file metadata to check is_public
  let meta: { data?: { is_public?: boolean; type?: string; filename_download?: string } }
  try {
    meta = await $fetch(`${base}/files/${id}?fields=is_public,type,filename_download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Directus 404 or network error — return plain 404, no internal details
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  if (!meta.data?.is_public) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  // Fetch the actual file bytes
  let fileBytes: ArrayBuffer
  try {
    fileBytes = await $fetch<ArrayBuffer>(`${base}/assets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arrayBuffer',
    })
  } catch {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const mimeType = meta.data.type ?? 'application/octet-stream'
  setResponseHeader(event, 'Content-Type', mimeType)

  const query = getQuery(event)
  if (query.download === 'true' && meta.data.filename_download) {
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${meta.data.filename_download}"`
    )
  } else if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  }

  return new Uint8Array(fileBytes)
})
