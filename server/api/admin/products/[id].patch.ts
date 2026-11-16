import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import {
  ALLOWED_TRANSITIONS,
  NOT_DRAFT_MESSAGE,
  isAllowedTransition,
  readProductLifecycle,
} from '~/server/utils/productLifecycle'

/**
 * Product base fields. Every one of them is business data, so every one of them
 * is Draft-only (D-037).
 */
const ALLOWED = [
  'name_en', 'name_es', 'name_pt',
  'slug', 'model_or_series',
  // Checkweigher series metadata. Nullable, and only meaningful on That category.
  'checkweigher_series', 'checkweigher_configuration', 'checkweigher_l_series',
  'summary_en', 'summary_es', 'summary_pt',
  'category_id', 'page_preset_id', 'review_notes',
]

const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/

/**
 * FINAL-RELEASE-FIX-F — this route now does exactly one of two things per
 * request, never both.
 *
 *  - A **lifecycle request** carries `status` and nothing else. It moves the
 *    product through the state machine and may write only `status` and the
 *    server-derived `published_at`.
 *  - A **content request** carries business fields and no `status`. It is
 *    refused unless the product is a Draft.
 *
 * Mixing them is what made "publish" and "edit the thing being published" a
 * single indivisible action: one PATCH could rename a product, move it to
 * another category and push it draft → review → published, with the review
 * step reviewing content that the same request had just replaced. Separating
 * them is the whole point of the V1 contract, and it is enforced here rather
 * than relied upon from the UI (which already sent them separately).
 *
 * The state machine itself is unchanged; it moved to `productLifecycle.ts` so
 * this route, the publish panel and the tests stop keeping private copies.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)

  const body = await readBody(event)
  const wantsStatusChange = body?.status !== undefined
  const contentKeys = ALLOWED.filter(key => body?.[key] !== undefined)
  const wantsProductCode = body?.product_code !== undefined

  if (wantsStatusChange && (contentKeys.length > 0 || wantsProductCode)) {
    throw createError({
      statusCode: 400,
      message: 'A status change must be sent on its own. Save your edits first, then change the status.',
    })
  }

  const lifecycle = await readProductLifecycle(event, productId)
  const payload: Record<string, unknown> = {}

  if (wantsStatusChange) {
    const nextStatus = String(body.status)
    if (!isAllowedTransition(lifecycle.status, nextStatus)) {
      const allowed = ALLOWED_TRANSITIONS[lifecycle.status] ?? []
      throw createError({
        statusCode: 403,
        message: `Status transition ${lifecycle.status} → ${body.status} is not permitted. Allowed from ${lifecycle.status}: ${allowed.join(', ') || 'none'}.`,
      })
    }
    if ((nextStatus === 'review' || nextStatus === 'published') && !lifecycle.product_code) {
      throw createError({ statusCode: 422, message: `product_code is required before transitioning to ${nextStatus}` })
    }
    payload.status = nextStatus
    if (nextStatus === 'published' && !lifecycle.published_at) {
      payload.published_at = new Date().toISOString()
    }
  }
  else {
    // Everything below writes business data, so the product must be a Draft.
    if (lifecycle.status !== 'draft') {
      throw createError({ statusCode: 409, message: NOT_DRAFT_MESSAGE })
    }

    for (const key of contentKeys) payload[key] = body[key]

    if (body.slug !== undefined && !/^[a-z0-9-]+$/.test(String(body.slug))) {
      throw createError({ statusCode: 400, message: 'slug must contain only lowercase letters, numbers, and hyphens' })
    }

    // product_code: set only if currently NULL; never overwrite an existing code.
    if (wantsProductCode) {
      if (lifecycle.product_code !== null && lifecycle.product_code !== '') {
        throw createError({ statusCode: 400, message: 'product_code is already set and cannot be changed' })
      }
      if (body.product_code !== null && body.product_code !== '') {
        const code = String(body.product_code).trim()
        if (!PRODUCT_CODE_RE.test(code)) {
          throw createError({ statusCode: 400, message: 'product_code must use uppercase letters, digits, and hyphens only (e.g. LT-180C)' })
        }
        payload.product_code = code
      }
    }
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  const result = await adminFetch<{ data: unknown }>(event, `/items/products/${productId}`, {
    method: 'PATCH',
    body: payload,
  })

  return (result as { data: unknown }).data
})
