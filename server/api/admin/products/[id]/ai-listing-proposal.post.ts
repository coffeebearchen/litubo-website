import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readProductLifecycle } from '~/server/utils/productLifecycle'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { productSubjectKey } from '~/server/utils/aiSubject'
import { createProductListingTarget, PRODUCT_LISTING_TARGET_ID, type ProductListingProposal } from '~/server/utils/aiTargets/productListingTarget'
import { buildProductListingInput, productListingFingerprint, type CategoryOption, type ProductListingRow } from '~/server/utils/productListingAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * Product Centre — a Draft-only suggestion for one product's listing copy: summary, SEO title, SEO
 * description and which existing technical category fits.
 *
 * Nothing is written. The proposal is stored in the shared in-memory proposal guard under a random
 * one-time reference; the Confirm endpoint is the only writer.
 *
 * The product must be a Draft before the provider is called. A suggestion for a product under review
 * or already published could not be applied anyway, so paying for it would be waste.
 */
export const MAX_LISTING_PROPOSAL_BODY_BYTES = 1024

interface Body { providerId?: unknown }

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const raw = getRouterParam(event, 'id')
  if (!raw || !/^[1-9]\d*$/.test(raw)) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(raw)

  await readJsonBodyWithByteLimit<Body>(event, MAX_LISTING_PROPOSAL_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const lifecycle = await readProductLifecycle(event, productId)
  if (lifecycle.status !== 'draft') {
    throw createError({ statusCode: 409, message: 'AI suggestions are available only while this product is a Draft.' })
  }

  const productRes = await adminFetch<{ data: ProductListingRow[] }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,name_en,product_code,model_or_series,summary_en,category_id,status&limit=1`,
  )
  const product = productRes?.data?.[0]
  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })

  const catRes = await adminFetch<{ data: Array<{ id: number, name_en?: string | null }> }>(
    event,
    '/items/product_categories?fields=id,name_en&sort=sort,name_en&limit=-1',
  )
  const categories: CategoryOption[] = (catRes?.data ?? []).map(c => ({ id: c.id, name: c.name_en ?? '' }))

  const config = useRuntimeConfig()
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })
  const providerId = parseAiProviderId(config.aiDefaultProvider, 'deepseek')
  if (!registry.getProvider(providerId).isConfigured()) {
    return { ok: false, unavailable: true, error: 'AI is not configured on this server yet.' }
  }

  const subjectKey = productSubjectKey(productId)
  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A suggestion is already being generated for this product. Wait for it to finish.'
        : 'Please wait a moment before generating another suggestion for this product.',
    })
  }

  try {
    const fingerprint = productListingFingerprint(product)
    const scope = { adminUserId, subjectKey, targetId: PRODUCT_LISTING_TARGET_ID, providerId, fingerprint }

    const reusable = lookupAnalysis<ProductListingProposal>(scope)
    /**
     * The guard keys its records by scope, and ememberAnalysis hands back an existing reference for
     * the same scope. That is what stops one analysis being applied twice - but it would also make
     * "generate again" after a confirmation return a reference that is already spent, so every save
     * would answer 409. A confirmed record therefore gets a distinct scope for the next generation:
     * the old reference stays dead, the new one is a real, fresh, one-time proposal.
     */
    const generationScope = reusable && reusable.alreadyApplied
      ? { ...scope, fingerprint: +
""+
":" }
      : scope
    // An already-confirmed analysis is not reused: its reference is spent, so handing it back would
    // give the editor a proposal whose save can only answer 409.
    if (reusable && !reusable.alreadyApplied) {
      return { ok: true, proposal: reusable.output, proposalRef: reusable.proposalRef, reused: true, alreadyConfirmed: reusable.alreadyApplied, categories }
    }

    const result = await registry.generateStructured(
      providerId,
      createProductListingTarget(categories.map(c => c.id)),
      buildProductListingInput(product, categories),
    )
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
    })

    return { ok: true, proposal: result.output, proposalRef, reused: false, alreadyConfirmed: false, categories }
  }
  finally {
    releaseGenerateSlot(adminUserId, subjectKey)
  }
})
