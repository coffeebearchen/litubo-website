import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { SiteSocialLink } from '~/types/settings'

const VALID_PLATFORMS = ['linkedin', 'youtube', 'instagram', 'facebook']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const platform = typeof body.platform === 'string' ? body.platform.toLowerCase().trim() : null
  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    throw createError({ statusCode: 422, message: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : null
  if (!url) throw createError({ statusCode: 422, message: 'url is required' })
  if (!url.startsWith('https://')) throw createError({ statusCode: 422, message: 'url must start with https://' })
  if (url.length > 500) throw createError({ statusCode: 422, message: 'url max length is 500' })
  try { new URL(url) } catch { throw createError({ statusCode: 422, message: 'url is not a valid URL' }) }

  const sort = body.sort !== undefined && body.sort !== null ? Number(body.sort) : null
  const enabled = body.enabled !== false && body.enabled !== 'false' && body.enabled !== 0

  // Prevent duplicate platforms within the same settings record
  const settingsRes = await adminFetch<{ data: { id: number } | null }>(event, '/items/site_settings')
  const settingsId = (settingsRes as { data: { id: number } | null }).data?.id
  if (!settingsId) throw createError({ statusCode: 404, message: 'Settings not found — run setup first' })

  const dupCheck = await adminFetch<{ data: SiteSocialLink[] }>(
    event,
    `/items/site_social_links?filter[settings_id][_eq]=${settingsId}&filter[platform][_eq]=${encodeURIComponent(platform)}&limit=1&fields=id`,
  )
  if ((dupCheck as { data: SiteSocialLink[] }).data.length > 0) {
    throw createError({ statusCode: 409, message: `Platform '${platform}' already exists` })
  }

  const result = await adminFetch<{ data: SiteSocialLink }>(event, '/items/site_social_links', {
    method: 'POST',
    body: { settings_id: settingsId, platform, url, sort, enabled },
  })
  return (result as { data: SiteSocialLink }).data
})
