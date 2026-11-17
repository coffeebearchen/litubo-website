import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const ALLOWED = ['name_en', 'name_es', 'name_pt', 'slug', 'category_id', 'page_preset_id', 'model_or_series', 'summary_en', 'summary_es', 'summary_pt',
  // V2-01: these three existing columns were missing here, so a product created with a series lost it
  // on the next save.
  'checkweigher_series', 'checkweigher_configuration', 'checkweigher_l_series']

/** The values the database enum actually allows; anything else is rejected rather than stored. */
const SERIES_VALUES = ['compact', 'standard', 'medium-range', 'extra-large', 'pharmaceutical']
const CONFIG_VALUES = ['online', 'left-right']

const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!String(body?.name_en ?? '').trim()) throw createError({ statusCode: 400, message: 'name_en is required' })
  if (!String(body?.slug ?? '').trim()) throw createError({ statusCode: 400, message: 'slug is required' })
  if (!body?.category_id) throw createError({ statusCode: 400, message: 'category_id is required' })
  if (!/^[a-z0-9-]+$/.test(String(body.slug))) {
    throw createError({ statusCode: 400, message: 'slug must contain only lowercase letters, numbers, and hyphens' })
  }

  const payload: Record<string, unknown> = { status: 'draft' }
  // V2-01: enum-guard the two select columns. `null` is a real value ("not classified") and passes.
  if (body?.checkweigher_series != null && !SERIES_VALUES.includes(String(body.checkweigher_series))) {
    throw createError({ statusCode: 400, message: 'checkweigher_series is not an allowed value' })
  }
  if (body?.checkweigher_configuration != null && !CONFIG_VALUES.includes(String(body.checkweigher_configuration))) {
    throw createError({ statusCode: 400, message: 'checkweigher_configuration is not an allowed value' })
  }
  if (body?.checkweigher_l_series != null && typeof body.checkweigher_l_series !== 'boolean') {
    throw createError({ statusCode: 400, message: 'checkweigher_l_series must be a boolean or null' })
  }

  for (const key of ALLOWED) {
    if (body[key] !== undefined) payload[key] = body[key]
  }

  if (body.product_code !== undefined && body.product_code !== null && body.product_code !== '') {
    const code = String(body.product_code).trim()
    if (!PRODUCT_CODE_RE.test(code)) {
      throw createError({ statusCode: 400, message: 'product_code must use uppercase letters, digits, and hyphens only (e.g. LT-180C)' })
    }
    payload.product_code = code
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/products', {
    method: 'POST',
    body: payload,
  })

  return (result as { data: unknown }).data
})
