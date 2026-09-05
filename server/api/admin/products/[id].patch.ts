import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const ALLOWED = [
  'name_en', 'name_es', 'name_pt',
  'slug', 'model_or_series',
  'summary_en', 'summary_es', 'summary_pt',
  'category_id', 'page_preset_id', 'review_notes',
]

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['draft'],
}

const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}

  for (const key of ALLOWED) {
    if (body[key] !== undefined) payload[key] = body[key]
  }

  if (body.slug !== undefined && !/^[a-z0-9-]+$/.test(String(body.slug))) {
    throw createError({ statusCode: 400, message: 'slug must contain only lowercase letters, numbers, and hyphens' })
  }

  // product_code: set only if currently NULL; never overwrite an existing code
  if (body.product_code !== undefined) {
    const currentData = await adminFetch<{ data: { product_code: string | null; status: string; published_at: string | null } }>(
      event,
      `/items/products/${id}?fields=product_code,status,published_at`,
    )
    const { product_code: existingCode, status: currentStatus, published_at: currentPublishedAt } = (
      currentData as { data: { product_code: string | null; status: string; published_at: string | null } }
    ).data

    if (existingCode !== null && existingCode !== '') {
      throw createError({ statusCode: 400, message: 'product_code is already set and cannot be changed' })
    }

    if (body.product_code !== null && body.product_code !== '') {
      const code = String(body.product_code).trim()
      if (!PRODUCT_CODE_RE.test(code)) {
        throw createError({ statusCode: 400, message: 'product_code must use uppercase letters, digits, and hyphens only (e.g. LT-180C)' })
      }
      payload.product_code = code
    }

    // status transition may also be in this same request — handle below using already-fetched state
    if (body.status !== undefined) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
      if (!allowed.includes(String(body.status))) {
        throw createError({
          statusCode: 403,
          message: `Status transition ${currentStatus} → ${body.status} is not permitted. Allowed from ${currentStatus}: ${allowed.join(', ') || 'none'}.`,
        })
      }
      const nextStatus = String(body.status)
      if ((nextStatus === 'review' || nextStatus === 'published') && !payload.product_code && (!existingCode || existingCode === '')) {
        throw createError({ statusCode: 422, message: `product_code is required before transitioning to ${nextStatus}` })
      }
      payload.status = nextStatus
      if (nextStatus === 'published' && !currentPublishedAt) {
        payload.published_at = new Date().toISOString()
      }
    }
  }
  else if (body.status !== undefined) {
    const current = await adminFetch<{ data: { status: string; published_at: string | null; product_code: string | null } }>(
      event,
      `/items/products/${id}?fields=status,published_at,product_code`,
    )
    const { status: currentStatus, published_at: currentPublishedAt, product_code: existingCode } = (
      current as { data: { status: string; published_at: string | null; product_code: string | null } }
    ).data
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(String(body.status))) {
      throw createError({
        statusCode: 403,
        message: `Status transition ${currentStatus} → ${body.status} is not permitted. Allowed from ${currentStatus}: ${allowed.join(', ') || 'none'}.`,
      })
    }

    const nextStatus = String(body.status)
    if ((nextStatus === 'review' || nextStatus === 'published') && (!existingCode || existingCode === '')) {
      throw createError({ statusCode: 422, message: `product_code is required before transitioning to ${nextStatus}` })
    }

    payload.status = nextStatus
    if (nextStatus === 'published' && !currentPublishedAt) {
      payload.published_at = new Date().toISOString()
    }
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  const result = await adminFetch<{ data: unknown }>(event, `/items/products/${id}`, {
    method: 'PATCH',
    body: payload,
  })

  return (result as { data: unknown }).data
})
