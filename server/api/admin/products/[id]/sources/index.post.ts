import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ALLOWED_REVIEW_STATUSES = ['confirmed', 'needs_review', 'missing', 'conflict'] as const

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  await assertProductExists(event, Number(id))

  const body = await readBody(event)

  // Validate source_file_id if provided; empty string coerces to null (field clear)
  if (body.source_file_id !== undefined && body.source_file_id !== null && body.source_file_id !== '') {
    if (typeof body.source_file_id !== 'string' || !UUID_RE.test(body.source_file_id)) {
      throw createError({ statusCode: 400, message: 'source_file_id must be a valid UUID' })
    }
  }

  if (body.review_status !== undefined && body.review_status !== null) {
    if (!ALLOWED_REVIEW_STATUSES.includes(body.review_status)) {
      throw createError({ statusCode: 400, message: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` })
    }
  }

  const payload: Record<string, unknown> = {
    product_id: Number(id),
    archived: false,
  }

  const allowed = ['source_file_id', 'source_locator', 'fact_key', 'review_status', 'note'] as const
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key] === '' ? null : body[key]
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_source_records', {
    method: 'POST',
    body: payload,
  })

  return (result as { data: unknown }).data
})
