import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { SiteSocialLink } from '~/types/settings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid social link id' })

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}

  if ('url' in body) {
    const url = typeof body.url === 'string' ? body.url.trim() : null
    if (!url) throw createError({ statusCode: 422, message: 'url is required' })
    if (!url.startsWith('https://')) throw createError({ statusCode: 422, message: 'url must start with https://' })
    if (url.length > 500) throw createError({ statusCode: 422, message: 'url max length is 500' })
    try { new URL(url) } catch { throw createError({ statusCode: 422, message: 'url is not a valid URL' }) }
    payload.url = url
  }

  if ('sort' in body) {
    const sort = body.sort !== null && body.sort !== undefined ? Number(body.sort) : null
    if (sort !== null && !Number.isFinite(sort)) throw createError({ statusCode: 422, message: 'sort must be a number' })
    payload.sort = sort
  }

  if ('enabled' in body) {
    payload.enabled = body.enabled !== false && body.enabled !== 'false' && body.enabled !== 0
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  const result = await adminFetch<{ data: SiteSocialLink }>(event, `/items/site_social_links/${id}`, {
    method: 'PATCH',
    body: payload,
  })
  return (result as { data: SiteSocialLink }).data
})
