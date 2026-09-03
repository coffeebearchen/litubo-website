import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const ALLOWED = ['name_en', 'name_es', 'name_pt', 'slug', 'category_id', 'page_preset_id', 'model_or_series', 'summary_en', 'summary_es', 'summary_pt']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!String(body?.name_en ?? '').trim()) throw createError({ statusCode: 400, message: 'name_en is required' })
  if (!String(body?.slug ?? '').trim()) throw createError({ statusCode: 400, message: 'slug is required' })
  if (!body?.category_id) throw createError({ statusCode: 400, message: 'category_id is required' })
  if (!/^[a-z0-9-]+$/.test(String(body.slug))) {
    throw createError({ statusCode: 400, message: 'slug must contain only lowercase letters, numbers, and hyphens' })
  }

  const payload: Record<string, unknown> = { status: 'draft' }
  for (const key of ALLOWED) {
    if (body[key] !== undefined) payload[key] = body[key]
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/products', {
    method: 'POST',
    body: payload,
  })

  return (result as { data: unknown }).data
})
