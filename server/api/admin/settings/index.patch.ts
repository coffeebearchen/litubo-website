import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { SiteSettings } from '~/types/settings'

const ALLOWED = [
  'brand_name', 'legal_company_name', 'public_email',
  'public_phone', 'public_whatsapp_url', 'public_address', 'copyright_text',
] as const

const MAX_LENGTHS: Record<string, number> = {
  brand_name: 100, legal_company_name: 200, public_email: 254,
  public_phone: 50, public_whatsapp_url: 500, public_address: 500, copyright_text: 200,
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload: Record<string, string | null> = {}

  for (const key of ALLOWED) {
    if (!(key in body)) continue
    const val = body[key]
    if (val === null || val === '' || val === undefined) { payload[key] = null; continue }
    if (typeof val !== 'string') throw createError({ statusCode: 400, message: `${key} must be string or null` })
    const s = val.trim()

    if (key === 'public_email' && s) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        throw createError({ statusCode: 422, message: 'public_email: invalid email format' })
      }
    }
    if (key === 'public_whatsapp_url' && s) {
      if (!s.startsWith('https://')) {
        throw createError({ statusCode: 422, message: 'public_whatsapp_url must start with https://' })
      }
    }
    if (s.length > (MAX_LENGTHS[key] ?? 1000)) {
      throw createError({ statusCode: 422, message: `${key} exceeds maximum length of ${MAX_LENGTHS[key]}` })
    }

    payload[key] = s || null
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  // For Directus singleton: PATCH without ID creates/updates the single record
  const result = await adminFetch(event, '/items/site_settings', { method: 'PATCH', body: payload })
  return (result as { data: SiteSettings }).data
})
