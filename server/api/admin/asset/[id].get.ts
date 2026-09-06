import { createError, getQuery, sendStream, setResponseHeader } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import type { H3Event } from 'h3'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event: H3Event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, message: 'Invalid asset id' })

  const token = getAdminToken(event)
  const config = useRuntimeConfig()

  const { width = '80', height = '80', fit = 'cover', quality = '75' } = getQuery(event)
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    fit: String(fit),
    quality: String(quality),
  })

  const res = await fetch(`${config.directusUrl}/assets/${id}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw createError({ statusCode: res.status })

  setResponseHeader(event, 'content-type', res.headers.get('content-type') ?? 'image/jpeg')
  setResponseHeader(event, 'cache-control', 'private, max-age=3600')
  return sendStream(event, res.body!)
})
