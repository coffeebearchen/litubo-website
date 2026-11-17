import { createError, readBody, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { ALLOWED_TRANSITIONS, isAllowedTransition } from '~/server/utils/productLifecycle'
import { createSpecGroup, createSpecItem } from '~/server/utils/productSpecWriter'
import { slugBase, uniqueSlug } from '~/server/utils/productIntake'
import { INTAKE_LIMITS, type ProductIntakeProposal } from '~/server/utils/aiTargets/productIntakeTarget'
import { claimApply, readProposal, releaseApply, settleApply } from '~/server/utils/aiProposalReplayGuard'

/**
 * The only writer for the intake feature, and it does exactly what the owner asked for: one human
 * click creates the product, writes the accepted parameter rows, and publishes it.
 *
 * The single click still walks the record through the state machine the rest of the product code uses
 * — draft → review → published — with each transition checked against `ALLOWED_TRANSITIONS`. Nothing
 * becomes public by being written; it becomes public by the transition that the click triggers.
 *
 * What it refuses outright: a duplicate product code, a name that is not accepted (a product needs a
 * name), a missing category (the schema requires one), and a code different from the one the proposal
 * was generated for.
 */
const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/


interface Binding { fingerprint: string, generatedAt: string, fileId: string, productCode: string }

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readBody(event)
  const productCode = String(body?.productCode ?? '').trim().toUpperCase()
  if (!PRODUCT_CODE_RE.test(productCode)) {
    throw createError({ statusCode: 400, message: 'Product code must use uppercase letters, digits and hyphens (e.g. LT-180C)' })
  }
  const acceptSummary = body?.acceptSummary === true
  const acceptSeo = body?.acceptSeo === true
  const acceptCategory = body?.acceptCategory === true
  const acceptSpecs = body?.acceptSpecs === true
  // A person may overrule the suggested category in the preview, and may drop individual parameter
  // rows. Both are validated below; neither is trusted from the browser as-is.
  const requestedCategoryId = Number(body?.categoryId ?? 0)
  const specIndexes: number[] | null = Array.isArray(body?.specIndexes)
    ? (body.specIndexes as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0)
    : null

  const stored = readProposal<ProductIntakeProposal, Binding>(body?.proposalRef, { subjectKey: 'product-intake', adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This proposal is no longer available. Generate a new one.' })
  if (stored.applyState === 'applied' || stored.applyState === 'partial') {
    throw createError({ statusCode: 409, message: 'This proposal has already been used to create a product.' })
  }
  if (stored.applyState === 'applying') throw createError({ statusCode: 409, message: 'This proposal is already being used.' })
  if (stored.binding?.productCode !== productCode) {
    throw createError({ statusCode: 409, message: 'The product code changed since this proposal was generated. Generate a new one.' })
  }

  const proposal = stored.output
  const name = proposal.name?.trim()
  if (!name || name.length > INTAKE_LIMITS.name) throw createError({ statusCode: 400, message: 'The proposal has no usable product name.' })

  const categoryId = acceptCategory ? (requestedCategoryId > 0 ? requestedCategoryId : proposal.categoryId) : 0
  if (!categoryId) throw createError({ statusCode: 400, message: 'Choose a technical category before creating the product.' })

  const fetchFn = <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options)

  // A code is how a person identifies the product for years; two records with one code is a data fault
  // that is cheap to refuse here and expensive to unpick later.
  const dupCode = await fetchFn<{ data?: Array<{ id: number }> }>(
    `/items/products?filter[product_code][_eq]=${encodeURIComponent(productCode)}&fields=id&limit=1`,
  )
  if (dupCode?.data?.length) {
    throw createError({ statusCode: 409, message: `Product code ${productCode} is already used by another product. Choose a different code.` })
  }

  const claim = claimApply(body?.proposalRef, { subjectKey: 'product-intake', adminUserId })
  if (!claim.ok) {
    const message = claim.reason === 'in-progress'
      ? 'This proposal is already being used.'
      : claim.reason === 'terminal'
        ? 'This proposal has already been used to create a product.'
        : 'This proposal is no longer available. Generate a new one.'
    throw createError({ statusCode: 409, message })
  }

  const slug = await uniqueSlug(fetchFn, slugBase(name))
  const productPayload: Record<string, unknown> = {
    status: 'draft',
    name_en: name,
    slug,
    category_id: categoryId,
    product_code: productCode,
  }
  if (proposal.modelOrSeries) productPayload.model_or_series = proposal.modelOrSeries
  if (acceptSummary && proposal.summary) productPayload.summary_en = proposal.summary.slice(0, INTAKE_LIMITS.summary)
  if (acceptSeo && proposal.seoTitle) productPayload.seo_title_en = proposal.seoTitle.slice(0, INTAKE_LIMITS.seoTitle)
  if (acceptSeo && proposal.seoDescription) productPayload.seo_description_en = proposal.seoDescription.slice(0, INTAKE_LIMITS.seoDescription)

  let productId: number | null = null
  let specGroups = 0
  let specItems = 0
  try {
    const created = await fetchFn<{ data?: { id: number } }>('/items/products', { method: 'POST', body: productPayload })
    productId = created?.data?.id ?? null
    if (!productId) throw createError({ statusCode: 502, message: 'The product record could not be created.' })

    const chosenSpecs = acceptSpecs
      ? (specIndexes ? proposal.specs.filter((_, i) => specIndexes.includes(i)) : proposal.specs)
      : []
    if (chosenSpecs.length) {
      // One group row per distinct group name, in the order the proposal gave them.
      const byGroup = new Map<string, Array<{ parameter: string, value: string }>>()
      for (const row of chosenSpecs) {
        const list = byGroup.get(row.group) ?? []
        list.push({ parameter: row.parameter, value: row.value })
        byGroup.set(row.group, list)
      }
      let groupSort = 0
      for (const [group, rows] of byGroup) {
        const groupId = await createSpecGroup(fetchFn, { product_id: productId, title_en: group, sort: groupSort++ })
        specGroups += 1
        let itemSort = 0
        for (const row of rows) {
          await createSpecItem(fetchFn, {
            spec_group_id: groupId,
            label_en: row.parameter,
            value_en: row.value,
            sort: itemSort++,
          })
          specItems += 1
        }
      }
    }

    // The one click the owner asked for: save, then walk the state machine to published.
    const check = (from: string, to: string) => {
      if (!isAllowedTransition(from, to)) {
        throw createError({ statusCode: 403, message: `Status transition ${from} → ${to} is not permitted. Allowed: ${(ALLOWED_TRANSITIONS[from] ?? []).join(', ') || 'none'}.` })
      }
    }
    check('draft', 'review')
    await fetchFn(`/items/products/${productId}`, { method: 'PATCH', body: { status: 'review' } })
    check('review', 'published')
    await fetchFn(`/items/products/${productId}`, {
      method: 'PATCH',
      body: { status: 'published', published_at: new Date().toISOString() },
    })

    settleApply(body?.proposalRef as string, {
      ok: true,
      appliedCount: 1,
      totalCount: 1,
      partial: false,
      message: `Created and published ${productCode}.`,
    })

    return {
      ok: true,
      published: true,
      product: { id: productId, slug, name, productCode, status: 'published' },
      specs: { groups: specGroups, items: specItems },
    }
  }
  catch (error) {
    // The product may already exist; saying "nothing happened" would be a lie. Report what survived so
    // the person can finish or remove it deliberately.
    if (productId) {
      settleApply(body?.proposalRef as string, {
        ok: false,
        appliedCount: 1,
        totalCount: 1,
        partial: true,
        message: 'The product was created but publishing did not complete.',
      })
      const message = (error as { data?: { message?: string } })?.data?.message ?? (error as Error).message
      throw createError({
        statusCode: 500,
        message: `The product was created as a draft (id ${productId}) but publishing did not complete: ${message}. Finish it from the product editor.`,
      })
    }
    releaseApply(body?.proposalRef as string)
    throw error
  }
})
