import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readProductLifecycle } from '~/server/utils/productLifecycle'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { productSubjectKey } from '~/server/utils/aiSubject'
import { createProductMediaTarget, PRODUCT_MEDIA_TARGET_ID, type ProductMediaProposal } from '~/server/utils/aiTargets/productMediaTarget'
import { buildProductMediaInput, loadProductMediaCandidates, productMediaFingerprint } from '~/server/utils/productMediaAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * Product Centre — a Draft-only suggestion for which of this product's own pictures should be its
 * hero, plus alt text for it. Writes nothing; Confirm is the only writer.
 *
 * Only publicly eligible, enabled pictures are offered (RSG-06), so a suggestion can never be one the
 * public page would refuse to render.
 */
export const MAX_MEDIA_PROPOSAL_BODY_BYTES = 1024

interface Body { providerId?: unknown }

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const raw = getRouterParam(event, 'id')
  if (!raw || !/^[1-9]\d*$/.test(raw)) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(raw)

  await readJsonBodyWithByteLimit<Body>(event, MAX_MEDIA_PROPOSAL_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const lifecycle = await readProductLifecycle(event, productId)
  if (lifecycle.status !== 'draft') {
    throw createError({ statusCode: 409, message: 'AI suggestions are available only while this product is a Draft.' })
  }

  const fetchFn = <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options)
  const productRes = await adminFetch<{ data?: Array<{ id: number, name_en?: string | null, product_code?: string | null, summary_en?: string | null }> }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,name_en,product_code,summary_en&limit=1`,
  )
  const product = productRes?.data?.[0]
  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })

  const candidates = await loadProductMediaCandidates(fetchFn, productId)
  if (candidates.length === 0) {
    return { ok: false, error: 'This product has no enabled, publicly usable pictures to choose from yet.' }
  }

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
  const slot = claimGenerateSlot(adminUserId, `${subjectKey}#media`)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A picture suggestion is already being generated for this product. Wait for it to finish.'
        : 'Please wait a moment before generating another picture suggestion for this product.',
    })
  }

  try {
    const fingerprint = productMediaFingerprint(product, candidates)
    const scope = { adminUserId, subjectKey: `${subjectKey}#media`, targetId: PRODUCT_MEDIA_TARGET_ID, providerId, fingerprint }

    const reusable = lookupAnalysis<ProductMediaProposal>(scope)
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
    // An already-confirmed analysis is NOT handed back as a fresh suggestion: its reference is spent,
    // so returning it would give the editor a proposal whose save can only answer 409.
    if (reusable && !reusable.alreadyApplied) {
      return { ok: true, proposal: reusable.output, proposalRef: reusable.proposalRef, candidates, reused: true }
    }

    const result = await registry.generateStructured(
      providerId,
      createProductMediaTarget(candidates.map(c => c.rowId)),
      buildProductMediaInput(product, candidates),
    )
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
    })

    return { ok: true, proposal: result.output, proposalRef, candidates, reused: false }
  }
  finally {
    releaseGenerateSlot(adminUserId, `${subjectKey}#media`)
  }
})
