import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readProductLifecycle } from '~/server/utils/productLifecycle'
import { productSubjectKey } from '~/server/utils/aiSubject'
import { ALT_MAX, type ProductMediaProposal } from '~/server/utils/aiTargets/productMediaTarget'
import { loadProductMediaCandidates, productMediaFingerprint } from '~/server/utils/productMediaAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, releaseApply, settleApply } from '~/server/utils/aiProposalReplayGuard'

/**
 * The only writer for the picture suggestion. It writes two things at most, both on the product's own
 * `products_files` rows:
 *
 *  - `file_role = 'hero'` on the chosen row, and `file_role = null` on any other row of THIS product
 *    that currently holds `hero` — the public rule picks the first enabled hero link, so leaving two
 *    would make which picture shows ambiguous;
 *  - `alt_en` on the chosen row, when accepted.
 *
 * It never touches `products.hero_image`, the file itself, its public flag, any other product, or the
 * picture's archived state.
 */
export const MAX_MEDIA_CONFIRM_BODY_BYTES = 1024

interface Body {
  proposalRef?: unknown
  acceptHero?: unknown
  acceptAlt?: unknown
  /**
   * A row the person picked themselves, for when the model declines to choose (file names are often
   * hashes). It is still validated against this product's own eligible pictures, so the client cannot
   * point at a file the product does not own.
   */
  mediaRowId?: unknown
}

interface Binding { fingerprint: string, generatedAt: string }

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const raw = getRouterParam(event, 'id')
  if (!raw || !/^[1-9]\d*$/.test(raw)) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(raw)

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_MEDIA_CONFIRM_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const acceptHero = body?.acceptHero === true
  const acceptAlt = body?.acceptAlt === true
  if (!acceptHero && !acceptAlt) throw createError({ statusCode: 400, message: 'Choose at least one suggestion to save.' })

  const lifecycle = await readProductLifecycle(event, productId)
  if (lifecycle.status !== 'draft') {
    throw createError({ statusCode: 409, message: 'AI suggestions can only be saved while this product is a Draft.' })
  }

  const fetchFn = <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options)
  const productRes = await adminFetch<{ data?: Array<{ id: number, name_en?: string | null, product_code?: string | null, summary_en?: string | null }> }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,name_en,product_code,summary_en&limit=1`,
  )
  const product = productRes?.data?.[0]
  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })

  const candidates = await loadProductMediaCandidates(fetchFn, productId)
  const subjectKey = `${productSubjectKey(productId)}#media`

  const stored = readProposal<ProductMediaProposal, Binding>(body?.proposalRef, { subjectKey, adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This suggestion is no longer available. Generate a new one.' })
  if (stored.applyState === 'applied' || stored.applyState === 'partial') {
    throw createError({ statusCode: 409, message: 'This suggestion has already been confirmed.' })
  }
  if (stored.applyState === 'applying') {
    throw createError({ statusCode: 409, message: 'This suggestion is already being confirmed.' })
  }
  if (stored.binding?.fingerprint !== productMediaFingerprint(product, candidates)) {
    throw createError({ statusCode: 409, message: 'The product or its pictures changed since this suggestion was generated. Generate a new one.' })
  }

  // The row must still be one of this product's usable pictures right now — the reference is a handle,
  // never a grant. A person may name the row when the model declined to choose one.
  const requestedRowId = typeof body?.mediaRowId === 'number' && Number.isInteger(body.mediaRowId) && body.mediaRowId > 0
    ? body.mediaRowId
    : stored.output.mediaRowId
  const chosen = requestedRowId > 0
    ? candidates.find(c => c.rowId === requestedRowId) ?? null
    : null
  if ((acceptHero || acceptAlt) && !chosen) {
    throw createError({
      statusCode: 400,
      message: requestedRowId > 0
        ? 'That picture is no longer one of this product\'s usable pictures. Reload the media tab.'
        : 'Choose which picture this applies to, then save again.',
    })
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

  const writes: string[] = []
  try {
    if (acceptHero && chosen) {
      // Clear any other hero link of this product first, so exactly one row carries the role.
      const heroRes = await adminFetch<{ data?: Array<{ id: number }> }>(
        event,
        `/items/products_files?filter[products_id][_eq]=${productId}&filter[file_role][_eq]=hero&fields=id&limit=-1`,
      )
      for (const row of heroRes?.data ?? []) {
        if (row.id === chosen.rowId) continue
        await adminFetch(event, `/items/products_files/${row.id}`, { method: 'PATCH', body: { file_role: null } })
      }
      await adminFetch(event, `/items/products_files/${chosen.rowId}`, { method: 'PATCH', body: { file_role: 'hero' } })
      writes.push('hero')

      if (acceptAlt && stored.output.altText) {
        await adminFetch(event, `/items/products_files/${chosen.rowId}`, {
          method: 'PATCH',
          body: { alt_en: stored.output.altText.slice(0, ALT_MAX) },
        })
        writes.push('alt')
      }
    }
    else if (acceptAlt && stored.output.altText && chosen) {
      await adminFetch(event, `/items/products_files/${chosen.rowId}`, {
        method: 'PATCH',
        body: { alt_en: stored.output.altText.slice(0, ALT_MAX) },
      })
      writes.push('alt')
    }
  }
  catch (error) {
    // If nothing was written the reference goes back to `ready`, so a person can retry. Once anything
    // landed it stays claimed: a second attempt could mark a second picture as hero.
    if (writes.length === 0) releaseApply(body?.proposalRef as string)
    throw error
  }

  settleApply(body?.proposalRef as string, {
    ok: true,
    appliedCount: writes.length,
    totalCount: 2,
    partial: false,
    message: `Saved ${writes.join(' and ')}.`,
  })

  return { ok: true, saved: writes, chosenRowId: chosen?.rowId ?? null }
})
