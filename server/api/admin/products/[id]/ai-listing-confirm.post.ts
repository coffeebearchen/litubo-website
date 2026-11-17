import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readProductLifecycle } from '~/server/utils/productLifecycle'
import { productSubjectKey } from '~/server/utils/aiSubject'
import { LISTING_LIMITS, type ProductListingProposal } from '~/server/utils/aiTargets/productListingTarget'
import { productListingFingerprint, type ProductListingRow } from '~/server/utils/productListingAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, releaseApply, settleApply } from '~/server/utils/aiProposalReplayGuard'

/**
 * The only writer for the Product Centre AI. A person has already accepted specific items; this
 * checks that the reference is still theirs and still valid, that the product has not changed or left
 * Draft, and that the claim is unused, before writing those items to the product record.
 *
 * It writes a closed set of four columns: `summary_en`, `seo_title_en`, `seo_description_en` and
 * `category_id`. It never writes `name_en`, `slug`, `product_code`, `status`, `published_at`, media or
 * anything else, and it re-applies the same length limits the manual editors enforce.
 */
export const MAX_LISTING_CONFIRM_BODY_BYTES = 1024

interface Body {
  proposalRef?: unknown
  acceptSummary?: unknown
  acceptSeoTitle?: unknown
  acceptSeoDescription?: unknown
  acceptCategory?: unknown
}

interface Binding { fingerprint: string, generatedAt: string }

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const raw = getRouterParam(event, 'id')
  if (!raw || !/^[1-9]\d*$/.test(raw)) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(raw)

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_LISTING_CONFIRM_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const acceptSummary = body?.acceptSummary === true
  const acceptSeoTitle = body?.acceptSeoTitle === true
  const acceptSeoDescription = body?.acceptSeoDescription === true
  const acceptCategory = body?.acceptCategory === true
  if (!acceptSummary && !acceptSeoTitle && !acceptSeoDescription && !acceptCategory) {
    throw createError({ statusCode: 400, message: 'Choose at least one suggestion to save.' })
  }

  const lifecycle = await readProductLifecycle(event, productId)
  if (lifecycle.status !== 'draft') {
    throw createError({ statusCode: 409, message: 'AI suggestions can only be saved while this product is a Draft.' })
  }

  const productRes = await adminFetch<{ data?: ProductListingRow[] }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,name_en,product_code,model_or_series,summary_en,category_id,status&limit=1`,
  )
  const product = productRes?.data?.[0]
  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })

  const subjectKey = productSubjectKey(productId)
  const stored = readProposal<ProductListingProposal, Binding>(body?.proposalRef, { subjectKey, adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This suggestion is no longer available. Generate a new one.' })
  if (stored.applyState === 'applied' || stored.applyState === 'partial') {
    throw createError({ statusCode: 409, message: 'This suggestion has already been confirmed.' })
  }
  if (stored.applyState === 'applying') {
    throw createError({ statusCode: 409, message: 'This suggestion is already being confirmed.' })
  }
  if (stored.binding?.fingerprint !== productListingFingerprint(product)) {
    throw createError({ statusCode: 409, message: 'The product changed since this suggestion was generated. Generate a new one.' })
  }

  const claim = claimApply(body?.proposalRef, { subjectKey, adminUserId })
  if (!claim.ok) {
    const message = claim.reason === 'in-progress'
      ? 'This suggestion is already being confirmed.'
      : claim.reason === 'terminal'
        ? 'This suggestion has already been confirmed.'
        : 'This suggestion is no longer available. Generate a new one.'
    throw createError({ statusCode: 409, message })
  }

  const payload: Record<string, unknown> = {}
  if (acceptSummary && stored.output.summary) payload.summary_en = stored.output.summary.slice(0, LISTING_LIMITS.summary)
  if (acceptSeoTitle && stored.output.seoTitle) payload.seo_title_en = stored.output.seoTitle.slice(0, LISTING_LIMITS.seoTitle)
  if (acceptSeoDescription && stored.output.seoDescription) payload.seo_description_en = stored.output.seoDescription.slice(0, LISTING_LIMITS.seoDescription)
  // A null categoryId means "none fits"; accepting it must not silently clear the current category.
  if (acceptCategory && stored.output.categoryId !== null) payload.category_id = stored.output.categoryId

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'The accepted suggestions were empty; nothing was saved.' })
  }

  try {
    await adminFetch(event, `/items/products/${productId}`, { method: 'PATCH', body: payload })
  }
  catch (error) {
    // Nothing was written, so the reference goes back to `ready` and the person can retry.
    releaseApply(body?.proposalRef as string)
    throw error
  }

  settleApply(body?.proposalRef as string, {
    ok: true,
    appliedCount: Object.keys(payload).length,
    totalCount: 4,
    partial: false,
    message: `Saved ${Object.keys(payload).length} field(s) from the AI suggestion.`,
  })

  const refreshed = await adminFetch<{ data?: ProductListingRow[] }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,name_en,product_code,model_or_series,summary_en,category_id,status&limit=1`,
  )

  return { ok: true, saved: Object.keys(payload), product: refreshed?.data?.[0] ?? null }
})
