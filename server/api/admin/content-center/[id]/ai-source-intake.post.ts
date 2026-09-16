import { createError, getRouterParam, setResponseHeader } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { CONTENT_AI_ANALYZE_BODY_MAX_BYTES, analyzeContentAiSources } from '~/server/utils/aiContentIntake'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { MAX_PER_FILE_CHARS } from '~/server/utils/aiTextExtraction'
import { createImageTextReader, createPdfTextReader } from '~/server/utils/documentExtractorClient'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentAiAnalyzeResult } from '~/types/content-center'

/**
 * CC-IMP-08 — "Analyze selected sources" for one content item and locale. The only Content
 * Center endpoint that can call an AI provider; it writes no content data, no association and
 * no publication field, and there is no Apply here (CC-IMP-09). Admin session + CSRF come from
 * the global middleware; the body is byte-limited before it is parsed.
 */
export default defineEventHandler(async (event): Promise<AdminContentAiAnalyzeResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const body = await readJsonBodyWithByteLimit(event, CONTENT_AI_ANALYZE_BODY_MAX_BYTES)
  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const config = useRuntimeConfig()
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    // API keys come from the running process, never runtimeConfig (FINAL-RELEASE-PRODUCTION-READY-01D).
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })
  // The same isolated document-extractor readers the Product AI path uses (PDF text, image OCR).
  const readers = {
    pdf: createPdfTextReader({ baseUrl: config.documentExtractorUrl, maxTextChars: MAX_PER_FILE_CHARS }),
    image: createImageTextReader({ baseUrl: config.documentExtractorUrl }),
  }

  try {
    return await analyzeContentAiSources(contentAdminFetch(event), registry, id, body, adminUserId, { readers })
  } catch (error) {
    const retryAfter = (error as { data?: { retryAfterSeconds?: unknown } }).data?.retryAfterSeconds
    if (typeof retryAfter === 'number') setResponseHeader(event, 'Retry-After', retryAfter)
    throw error
  }
})
