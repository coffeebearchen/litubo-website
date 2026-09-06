import { createError, getQuery, sendStream, setResponseHeader } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import {
  validateAssetId,
  buildSafeParams,
  validateMime,
} from '~/server/utils/adminAssetProxy'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  // 1. Validate asset id — must be a strict Directus file UUID
  const id = getRouterParam(event, 'id') ?? ''
  if (!validateAssetId(id)) throw createError({ statusCode: 400, message: 'Invalid asset id' })

  // 2. Auth — reads event.context.adminToken set by admin-auth middleware (defense-in-depth)
  const token = getAdminToken(event)
  const config = useRuntimeConfig()

  // 3. Sanitize transform query params — never let user reach arbitrary values
  const raw = getQuery(event) as Record<string, unknown>
  const params = buildSafeParams(raw)

  // 4. Fetch from Directus — fixed host from runtimeConfig, no browser headers forwarded
  let res: Response
  try {
    res = await fetch(
      `${config.directusUrl}/assets/${encodeURIComponent(id)}?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'manual',   // never follow upstream redirects
      },
    )
  } catch {
    throw createError({ statusCode: 502, message: 'Asset unavailable' })
  }

  // 5. Upstream redirect — refuse; do not reveal redirect target
  if (res.status >= 300 && res.status < 400) {
    throw createError({ statusCode: 502, message: 'Asset unavailable' })
  }

  // 6. Upstream error — map to safe codes; never expose Directus internals
  if (!res.ok) {
    const safe = res.status === 404 ? 404 : 502
    throw createError({ statusCode: safe, message: safe === 404 ? 'Asset not found' : 'Asset unavailable' })
  }

  // 7. MIME allowlist — reject PDF, SVG, HTML, video, and any non-image type
  const rawType = res.headers.get('content-type') ?? ''
  const mimeBase = rawType.split(';')[0].trim().toLowerCase()
  if (!validateMime(mimeBase)) {
    throw createError({ statusCode: 415, message: 'Unsupported asset type' })
  }

  // 8. Set minimal safe response headers — never forward Set-Cookie, Location, CORS, or token
  setResponseHeader(event, 'content-type', mimeBase)
  setResponseHeader(event, 'content-disposition', 'inline')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'cache-control', 'private, no-store')

  // 9. Stream response body — no buffering; sendStream pipes ReadableStream directly
  return sendStream(event, res.body!)
})
