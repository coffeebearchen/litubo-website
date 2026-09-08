import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { runSpecificationProposalEngine } from '~/server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'

/**
 * PWS-AI-ENGINE-01 — "Analyze selected sources". The only endpoint that
 * calls an AI provider; it never writes Specifications or any other product
 * data. Body: `{ providerId: 'deepseek' | 'openai', mediaIds: number[] }` —
 * `mediaIds` are this product's own `products_files.id` rows only, never a
 * raw Directus file UUID. Response never includes a file UUID, path,
 * download URL, locator, internal note, raw extracted text, or the
 * provider's raw response — only the validated structured proposal (or a
 * short, safe error) plus a per-file display-name-keyed read/unsupported/
 * unreadable summary.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  const body = await readBody(event)
  const config = useRuntimeConfig()

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: config.openaiApiKey, model: config.openaiModel },
    deepseek: { apiKey: config.deepseekApiKey, model: config.deepseekModel },
  })

  const result = await runSpecificationProposalEngine(fetch, registry, {
    productId: Number(id),
    providerId: body?.providerId,
    mediaIds: body?.mediaIds,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, fileResults: result.fileResults }
  }
  return { ok: true, proposal: result.proposal, fileResults: result.fileResults }
})
