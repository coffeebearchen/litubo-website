import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { parseSpecItemFactKey, isValidReviewStatus, ALLOWED_REVIEW_STATUSES } from '~/server/utils/productEvidenceLinks'

/**
 * Changes only the review_status of one Specifications evidence link. This
 * PATCH is the single write; Directus records its own activity/revision for
 * it atomically as part of the same request — never a second call from here.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const linkId = getRouterParam(event, 'linkId')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  if (!linkId || isNaN(Number(linkId))) throw createError({ statusCode: 400, message: 'Invalid evidence link id' })
  await assertProductExists(event, Number(id))

  const check = await adminFetch<{ data: { product_id: number; fact_key: string | null; archived: boolean } | null }>(
    event, `/items/product_source_records/${linkId}?fields=product_id,fact_key,archived`,
  )
  const existing = (check as { data: { product_id: number; fact_key: string | null; archived: boolean } | null }).data
  if (!existing || existing.product_id !== Number(id) || parseSpecItemFactKey(existing.fact_key) === null) {
    throw createError({ statusCode: 404, message: `Evidence link ${linkId} not found for product ${id}` })
  }
  if (existing.archived) {
    throw createError({ statusCode: 409, message: 'Cannot change the review status of an archived evidence link' })
  }

  const body = await readBody(event)
  if (!isValidReviewStatus(body.review_status)) {
    throw createError({ statusCode: 400, message: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` })
  }

  await adminFetch(event, `/items/product_source_records/${linkId}`, {
    method: 'PATCH',
    body: { review_status: body.review_status },
  })

  return { ok: true }
})
