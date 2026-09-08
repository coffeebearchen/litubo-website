import { createError, getRouterParam } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { runProposalEngine } from '~/server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { specificationsTarget } from '~/server/utils/aiTargets/specificationsTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { resolveSourceRefs } from '~/server/utils/aiSourceRef'
import { MAX_FILES_PER_REQUEST } from '~/server/utils/aiTextExtraction'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — a legitimate body here is
 * `{ providerId, sourceRefs: [at most 5 opaque refs] }`, a few hundred bytes.
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
  sourceRefs?: unknown
}

/**
 * PWS-AI-ENGINE-01R — "Analyze selected sources" for the `specifications`
 * Target. The only endpoint that calls an AI provider; it never writes
 * Specifications or any other product data.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — the body carries `sourceRefs`, the
 * opaque references minted by `ai/sources`, not raw ids. Each ref is
 * re-verified here against the CURRENT administrator and the CURRENT product
 * before it resolves to anything, so a ref from another product, another
 * admin, or an expired session resolves to nothing and the whole request is
 * refused. The engine then independently re-checks that each resolved row
 * still belongs to this product and is still enabled — the ref is a handle,
 * never a grant.
 *
 * The response never includes a file UUID, path, download URL, locator,
 * internal note, raw extracted text, or the provider's raw response — only
 * the validated structured proposal (or a short, safe error) plus a per-file
 * summary keyed by sanitized display name.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  const productId = Number(id)
  const body = await readJsonBodyWithByteLimit<GenerateBody>(event, MAX_GENERATE_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  // A ref that was not minted for this admin AND this product resolves to
  // nothing; one bad ref refuses the whole request rather than silently
  // analyzing the subset that happened to verify.
  const mediaIds = resolveSourceRefs(body?.sourceRefs, { productId, adminUserId }, MAX_FILES_PER_REQUEST)
  if (mediaIds === null) {
    return {
      ok: false,
      error: 'This selection is no longer valid. Reload the page and choose the files again.',
      fileResults: [],
    }
  }

  const config = useRuntimeConfig()

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: config.openaiApiKey, model: config.openaiModel },
    deepseek: { apiKey: config.deepseekApiKey, model: config.deepseekModel },
  })

  const result = await runProposalEngine(fetch, registry, specificationsTarget, {
    productId,
    providerId: body?.providerId,
    mediaIds,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, fileResults: result.fileResults }
  }
  return { ok: true, proposal: result.output, fileResults: result.fileResults }
})
