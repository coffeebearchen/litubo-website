import { createError, getRouterParam, sendStream, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'
import { adminFetch, assertProductExists, getAdminToken } from '~/server/utils/adminDirectusClient'
import { buildSafeParams, validateAssetId, validateMime } from '~/server/utils/adminAssetProxy'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the product thumbnail for the AI screens,
 * addressed by the product's numeric route instead of its Directus file UUID.
 *
 * The existing `/api/admin/asset/:uuid` proxy is safe in itself, but its URL
 * *is* the file UUID, so any page using it hands that identifier to the
 * browser. The AI screens must not, so this endpoint resolves `hero_image`
 * server-side from the product id already present in the route: the browser
 * only ever sees `/api/admin/products/3/ai/hero`.
 *
 * Everything else follows the existing proxy's rules — administrator session
 * required (global middleware), fixed upstream host, no browser headers
 * forwarded, redirects refused, image MIME allowlist, no caching.
 */

/** Thumbnail geometry is fixed here rather than taken from the query, so this endpoint cannot be used as a general image transformer. */
const HERO_TRANSFORM = { width: '480', height: '320', fit: 'cover', quality: '75' }

export default defineEventHandler(async (event: H3Event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const product = await adminFetch<{ data: { hero_image: string | null } | null }>(
    event, `/items/products/${productId}?fields=hero_image`,
  )
  const heroId = product.data?.hero_image ?? null

  // No hero, or a value that is not a real file id: 404 rather than a guess.
  // The AI screens fall back to a neutral placeholder on a 404.
  if (!heroId || !validateAssetId(heroId)) {
    throw createError({ statusCode: 404, message: 'No image for this product' })
  }

  const token = getAdminToken(event)
  const config = useRuntimeConfig()
  const params = buildSafeParams(HERO_TRANSFORM)

  let res: Response
  try {
    res = await fetch(`${config.directusUrl}/assets/${encodeURIComponent(heroId)}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    })
  } catch {
    throw createError({ statusCode: 502, message: 'Image unavailable' })
  }

  if (res.status >= 300 && res.status < 400) throw createError({ statusCode: 502, message: 'Image unavailable' })
  if (!res.ok) {
    throw createError(res.status === 404
      ? { statusCode: 404, message: 'No image for this product' }
      : { statusCode: 502, message: 'Image unavailable' })
  }

  const mimeBase = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!validateMime(mimeBase)) throw createError({ statusCode: 415, message: 'Unsupported image type' })

  setResponseHeader(event, 'content-type', mimeBase)
  setResponseHeader(event, 'content-disposition', 'inline')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'cache-control', 'private, no-store')

  return sendStream(event, res.body!)
})
