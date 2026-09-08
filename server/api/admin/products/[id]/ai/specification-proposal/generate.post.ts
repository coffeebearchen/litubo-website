import { createError, getHeader, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { runProposalEngine } from '~/server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { specificationsTarget } from '~/server/utils/aiTargets/specificationsTarget'

/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — a legitimate body here is
 * `{ providerId, mediaIds: [at most 5 integers] }`, a few dozen bytes. An
 * oversized body is refused from its declared `Content-Length` BEFORE
 * `readBody()` parses anything, so a huge payload is never buffered or parsed
 * just to be rejected later by the engine's array-length check. (A request
 * that declares no length — chunked transfer — cannot be judged before
 * reading; the engine's own limits remain the backstop for that case.)
 */
export const MAX_GENERATE_BODY_BYTES = 4 * 1024

/**
 * PWS-AI-ENGINE-01R — "Analyze selected sources" for the `specifications`
 * Target. The only endpoint that calls an AI provider; it never writes
 * Specifications or any other product data. Body:
 * `{ providerId: 'deepseek' | 'openai', mediaIds: number[] }` — `mediaIds`
 * are this product's own `products_files.id` rows only, never a raw
 * Directus file UUID. Response never includes a file UUID, path, download
 * URL, locator, internal note, raw extracted text, or the provider's raw
 * response — only the validated structured proposal (or a short, safe
 * error) plus a per-file display-name-keyed read/unsupported/unreadable
 * summary.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  const declaredLength = Number(getHeader(event, 'content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GENERATE_BODY_BYTES) {
    throw createError({ statusCode: 413, message: 'Request body is too large.' })
  }

  const body = await readBody(event)
  const config = useRuntimeConfig()

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: config.openaiApiKey, model: config.openaiModel },
    deepseek: { apiKey: config.deepseekApiKey, model: config.deepseekModel },
  })

  const result = await runProposalEngine(fetch, registry, specificationsTarget, {
    productId: Number(id),
    providerId: body?.providerId,
    mediaIds: body?.mediaIds,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, fileResults: result.fileResults }
  }
  return { ok: true, proposal: result.output, fileResults: result.fileResults }
})
