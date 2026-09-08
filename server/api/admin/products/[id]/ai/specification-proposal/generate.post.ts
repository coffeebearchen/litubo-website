import { createError, getRouterParam } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { runProposalEngine } from '~/server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { specificationsTarget } from '~/server/utils/aiTargets/specificationsTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — a legitimate body here is
 * `{ providerId, mediaIds: [at most 5 integers] }`, a few dozen bytes.
 *
 * The limit is enforced on bytes actually received, not on the declared
 * `Content-Length`: the previous version trusted that header and then called
 * `readBody()`, so a request that omitted it (chunked, HTTP/2), understated
 * it, or sent garbage in it was fully buffered and parsed before its real
 * size was ever checked. `readJsonBodyWithByteLimit()` counts bytes as they
 * arrive and destroys the connection the moment the ceiling is passed, so
 * JSON parsing only ever sees a body that already fits.
 */
export const MAX_GENERATE_BODY_BYTES = 4 * 1024

interface GenerateBody {
  providerId?: unknown
  mediaIds?: unknown
}

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

  const body = await readJsonBodyWithByteLimit<GenerateBody>(event, MAX_GENERATE_BODY_BYTES)
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
