import { defineEventHandler, getRouterParam, getQuery, setResponseHeader, send, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getAdminToken } from '~/server/utils/adminDirectusClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_FIT = new Set(['cover', 'contain', 'inside', 'outside'])
const ALLOWED_FMT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif'])

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, message: 'Not found' })

  // admin-auth middleware has already verified Administrator role
  const token = getAdminToken(event)
  const config = useRuntimeConfig()
  const base = config.directusUrl

  // Build Directus asset URL with optional image transforms
  const q = getQuery(event)
  const params = new URLSearchParams()
  if (q.width)  params.set('width',  String(Number(q.width)))
  if (q.height) params.set('height', String(Number(q.height)))
  if (q.fit && ALLOWED_FIT.has(String(q.fit)))   params.set('fit', String(q.fit))
  if (q.format && ALLOWED_FMT.has(String(q.format))) params.set('format', String(q.format))
  if (q.quality) params.set('quality', String(Math.min(100, Math.max(1, Number(q.quality)))))
  if (q.focal_point_x !== undefined) params.set('focal_point_x', String(Number(q.focal_point_x)))
  if (q.focal_point_y !== undefined) params.set('focal_point_y', String(Number(q.focal_point_y)))
  const qs = params.toString()
  const assetUrl = `${base}/assets/${id}${qs ? '?' + qs : ''}`

  let fileBytes: ArrayBuffer
  let contentType = 'application/octet-stream'
  try {
    const resp = await $fetch.raw<ArrayBuffer>(assetUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arrayBuffer',
    })
    fileBytes = resp._data as ArrayBuffer
    contentType = (resp.headers.get('content-type') ?? contentType).split(';')[0].trim()
  } catch {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  setResponseHeader(event, 'Content-Type', contentType)
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')

  return send(event, Buffer.from(fileBytes), contentType)
})
