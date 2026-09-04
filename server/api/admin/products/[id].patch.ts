import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const ALLOWED = [
  'name_en', 'name_es', 'name_pt',
  'slug', 'model_or_series',
  'summary_en', 'summary_es', 'summary_pt',
  'category_id', 'page_preset_id', 'review_notes',
]

// Phase 9A-2D: full publish/revert state machine
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['draft'],
}

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

  if (body.status !== undefined) {
    const current = await adminFetch<{ data: { status: string; published_at: string | null } }>(
      event,
      `/items/products/${id}?fields=status,published_at`,
    )
    const { status: currentStatus, published_at: currentPublishedAt } = (
      current as { data: { status: string; published_at: string | null } }
    ).data
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(String(body.status))) {
      throw createError({
        statusCode: 403,
        message: `Status transition ${currentStatus} → ${body.status} is not permitted. Allowed from ${currentStatus}: ${allowed.join(', ') || 'none'}.`,
      })
    }
    payload.status = body.status

    // Set published_at only on first publish; preserve history on revert to draft
    if (body.status === 'published' && !currentPublishedAt) {
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
