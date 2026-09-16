import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ALLOWED_REVIEW_STATUSES = ['confirmed', 'needs_review', 'missing', 'conflict'] as const

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  await assertProductDraftForMutation(event, Number(id))

  const body = await readBody(event)

  // Normalize empty string → null for source fields
  const rawFileId = body.source_file_id === '' ? null : body.source_file_id
  const rawLocator = typeof body.source_locator === 'string' ? body.source_locator.trim() || null : body.source_locator ?? null

  // Validate source_file_id if provided
  if (rawFileId !== undefined && rawFileId !== null) {
    if (typeof rawFileId !== 'string' || !UUID_RE.test(rawFileId)) {
      throw createError({ statusCode: 400, message: 'source_file_id must be a valid UUID' })
    }
  }

  // Require at least a valid source_file_id: source_locator is a within-file positional descriptor
  // and is not an independent citable source on its own.
  const effectiveFileId = rawFileId === undefined ? null : rawFileId
  if (!effectiveFileId) {
    throw createError({ statusCode: 422, message: 'SOURCE_REFERENCE_REQUIRED: source_file_id is required' })
  }

  if (body.review_status !== undefined && body.review_status !== null) {
    if (!ALLOWED_REVIEW_STATUSES.includes(body.review_status)) {
      throw createError({ statusCode: 400, message: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` })
    }
  }

  const payload: Record<string, unknown> = {
    product_id: Number(id),
    archived: false,
    source_file_id: rawFileId,
  }

  if (body.source_locator !== undefined) payload.source_locator = rawLocator

  const textFields = ['fact_key', 'review_status', 'note'] as const
  for (const key of textFields) {
    if (body[key] !== undefined) payload[key] = body[key] === '' ? null : body[key]
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_source_records', {
    method: 'POST',
    body: payload,
  })

  return (result as { data: unknown }).data
})
