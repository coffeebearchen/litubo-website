import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import {
  buildSpecItemFactKey,
  assertSpecItemBelongsToProduct,
  assertSourceFileLinkedToProduct,
  assertNoDuplicateEvidenceLink,
  isValidReviewStatus,
  ALLOWED_REVIEW_STATUSES,
} from '~/server/utils/productEvidenceLinks'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Creates one Specifications evidence link. This is a single write to
 * product_source_records: Directus records the resulting create in its own
 * directus_activity/directus_revisions system collections as part of the
 * same internal transaction, under the real logged-in admin's own session
 * token — there is no separate "audit" call for this endpoint to get wrong,
 * and nothing here can create the evidence row without also producing its
 * audit trail (or vice versa).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  await assertProductExists(event, Number(id))

  const body = await readBody(event)

  const specItemId = Number(body.spec_item_id)
  if (!Number.isInteger(specItemId) || specItemId <= 0) {
    throw createError({ statusCode: 400, message: 'spec_item_id must be a positive integer' })
  }

  const fileUuid = body.source_file_id
  if (typeof fileUuid !== 'string' || !UUID_RE.test(fileUuid)) {
    throw createError({ statusCode: 400, message: 'source_file_id must be a valid UUID' })
  }

  const reviewStatus = body.review_status ?? 'needs_review'
  if (!isValidReviewStatus(reviewStatus)) {
    throw createError({ statusCode: 400, message: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` })
  }

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)

  await assertSpecItemBelongsToProduct(Number(id), specItemId, fetch)
  await assertSourceFileLinkedToProduct(Number(id), fileUuid, fetch)

  const factKey = buildSpecItemFactKey(specItemId)
  await assertNoDuplicateEvidenceLink(Number(id), factKey, fileUuid, fetch)

  const result = await adminFetch<{ data: { id: number } }>(event, '/items/product_source_records', {
    method: 'POST',
    body: {
      product_id: Number(id),
      source_file_id: fileUuid,
      fact_key: factKey,
      review_status: reviewStatus,
      archived: false,
    },
  })

  // Only the new link's own stable id is ever echoed back — never the file
  // UUID or fact_key the client just submitted.
  return { id: (result as { data: { id: number } }).data.id }
})
