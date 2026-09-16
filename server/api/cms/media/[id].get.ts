import { defineEventHandler, getRouterParam, getQuery, createError, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { readDirectusToken } from '~/server/utils/directusServiceToken'
import { isAssetGone, lookupPublicMedia, MEDIA_ID_RE, type PublicMediaLookup } from '~/server/utils/publicMedia'

/**
 * Public media proxy. CC-IMP-10 (RSG-06): at request time the file must exist, be
 * `is_public` and not be archived in the Media Library → otherwise 404. An upstream
 * Directus failure is 503, never a disguised 404. No Directus host in any error.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''

  // Reject non-UUID ids immediately — no Directus host in the error
  if (!MEDIA_ID_RE.test(id)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const config = useRuntimeConfig()
  // The token comes from the running process, never runtimeConfig (FINAL-RELEASE-PRODUCTION-READY-01C).
  if (!config.directusUrl || !readDirectusToken()) {
    throw createError({ statusCode: 503, message: 'Media service unavailable' })
  }

  let media: PublicMediaLookup
  try {
    media = await lookupPublicMedia(directusFetch, id)
  } catch (err) {
    console.error('[cms/media] Directus lookup failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Media service unavailable' })
  }
  if (!media.found) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  // Fetch the actual file bytes
  let fileBytes: ArrayBuffer
  try {
    fileBytes = await directusFetch<ArrayBuffer>(`/assets/${id.toLowerCase()}`, { responseType: 'arrayBuffer' })
  } catch (err) {
    if (isAssetGone(err)) throw createError({ statusCode: 404, message: 'Not found' })
    console.error('[cms/media] Directus asset read failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Media service unavailable' })
  }

  const mimeType = media.type ?? 'application/octet-stream'
  setResponseHeader(event, 'Content-Type', mimeType)

  const query = getQuery(event)
  if (query.download === 'true' && media.filenameDownload) {
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${media.filenameDownload}"`
    )
  } else if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  }

  return new Uint8Array(fileBytes)
})
