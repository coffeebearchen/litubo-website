import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { createCategoryIntroTarget, CATEGORY_INTRO_TARGET_ID, type CategoryIntroProposal } from '~/server/utils/aiTargets/categoryIntroTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * Category introduction + search metadata for one product category. Nothing is written here; the
 * confirm endpoint writes exactly three columns on that category.
 *
 * The material is the category's own name and the names/summaries of the products already filed under
 * it, so a five-product X-ray family reads differently from a two-product conveyor family without the
 * model inventing anything.
 */
export const MAX_CATEGORY_BODY_BYTES = 256

interface Body { id?: unknown }

interface CategoryRow {
  id: number
  name_en: string | null
  intro_en: string | null
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_CATEGORY_BODY_BYTES)
  const rawId = String(body?.id ?? '')
  if (!/^[1-9]\d*$/.test(rawId)) throw createError({ statusCode: 400, message: 'Invalid category id' })
  const id = Number(rawId)

  const catRes = await adminFetch<{ data: CategoryRow[] }>(
    event,
    `/items/product_categories?filter[id][_eq]=${id}&fields=id,name_en,intro_en&limit=1`,
  )
  const category = catRes?.data?.[0]
  if (!category) throw createError({ statusCode: 404, message: 'Category not found' })

  const productRes = await adminFetch<{ data: Array<{ name_en: string | null, summary_en: string | null }> }>(
    event,
    `/items/products?filter[category_id][_eq]=${id}&filter[status][_eq]=published&fields=name_en,summary_en&sort=name_en&limit=20`,
  )
  const products = (productRes?.data ?? []).map(p => ({
    name: p.name_en ?? '',
    summary: (p.summary_en ?? '').slice(0, 300),
  }))

  const input = {
    sourceFileSummaries: [],
    extractedSourceTexts: [],
    categoryName: category.name_en ?? '',
    locale: 'en',
    products,
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

  const subjectKey = `category:${id}`
  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A suggestion is already being generated for this category. Wait for it to finish.'
        : 'Please wait a moment before generating another suggestion for this category.',
    })
  }

  try {
    const fingerprint = `category:${id}:${products.map(p => p.name).join('|')}`
    const scope = { adminUserId, subjectKey, targetId: CATEGORY_INTRO_TARGET_ID, providerId, fingerprint }
    const reusable = lookupAnalysis<CategoryIntroProposal>(scope)
    if (reusable && !reusable.alreadyApplied) {
      return { ok: true, id, proposal: reusable.output, proposalRef: reusable.proposalRef, reused: true, productCount: products.length }
    }
    const generationScope = reusable && reusable.alreadyApplied
      ? { ...scope, fingerprint: `${fingerprint}:${Date.now()}` }
      : scope

    const result = await registry.generateStructured(providerId, createCategoryIntroTarget(), input)
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
    })
    return { ok: true, id, proposal: result.output, proposalRef, reused: false, productCount: products.length }
  }
  finally {
    releaseGenerateSlot(adminUserId, subjectKey)
  }
})
