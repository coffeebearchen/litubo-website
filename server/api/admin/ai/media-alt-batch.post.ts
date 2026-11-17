import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { createMediaAltTarget, MEDIA_ALT_TARGET_ID } from '~/server/utils/aiTargets/mediaAltTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * Alt text for several undescribed files in one request.
 *
 * "Undescribed" means the file's title is empty or still the raw file name: those are the 200-odd
 * pictures nobody has looked at. Each one still gets its own one-time reference, so the panel can show
 * a list and the person still confirms file by file - this endpoint shortens the clicking, not the
 * review.
 *
 * The batch is capped (default 5, never more than 10) because every item is a provider call that costs
 * money, and because a list longer than a screen stops being something a person actually reads.
 */
export const MAX_BATCH_BODY_BYTES = 256
const DEFAULT_BATCH = 5
const HARD_BATCH_MAX = 10
const FILE_SCAN_LIMIT = 400

interface Body { limit?: unknown }

interface FileRow {
  id: string
  title: string | null
  filename_download: string | null
  type: string | null
  folder: string | null
}

/** A title that is missing, or that still is the file name, is not a description. */
function needsAlt(file: FileRow): boolean {
  const title = (file.title ?? '').trim()
  if (!title) return true
  const name = (file.filename_download ?? '').trim()
  return Boolean(name) && title.toLowerCase() === name.toLowerCase()
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_BATCH_BODY_BYTES)
  const requested = Number(body?.limit)
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), HARD_BATCH_MAX)
    : DEFAULT_BATCH

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

  const slot = claimGenerateSlot(adminUserId, 'media-batch')
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A batch is already running for your account. Wait for it to finish.'
        : 'Please wait a moment before starting another batch.',
    })
  }

  try {
    const res = await adminFetch<{ data: FileRow[] }>(
      event,
      `/files?fields=id,title,filename_download,type,folder&limit=${FILE_SCAN_LIMIT}&sort=-uploaded_on`,
    )
    const candidates = (res?.data ?? []).filter(f => (f.type ?? '').startsWith('image/') && needsAlt(f))
    const chosen = candidates.slice(0, limit)

    const rows: Array<{
      fileId: string
      filename: string
      productName: string | null
      altText: string
      proposalRef: string
      error: string
    }> = []

    for (const file of chosen) {
      let productName: string | null = null
      try {
        const links = await adminFetch<{ data: Array<{ products_id: number }> }>(
          event,
          `/items/products_files?filter[directus_files_id][_eq]=${file.id}&fields=products_id&limit=1`,
        )
        const productId = links?.data?.[0]?.products_id
        if (productId) {
          const product = await adminFetch<{ data: Array<{ name_en: string | null }> }>(
            event,
            `/items/products?filter[id][_eq]=${productId}&fields=name_en&limit=1`,
          )
          productName = product?.data?.[0]?.name_en ?? null
        }
      }
      catch { productName = null }

      let folderName: string | null = null
      if (file.folder) {
        try {
          const folder = await adminFetch<{ data: Array<{ name: string | null }> }>(
            event,
            `/folders?filter[id][_eq]=${file.folder}&fields=name&limit=1`,
          )
          folderName = folder?.data?.[0]?.name ?? null
        }
        catch { folderName = null }
      }

      const input = {
        sourceFileSummaries: [],
        extractedSourceTexts: [],
        filename: file.filename_download ?? '',
        currentTitle: file.title ?? '',
        fileType: file.type ?? '',
        productName,
        folderName,
      }

      const fileId = file.id.toLowerCase()
      try {
        const result = await registry.generateStructured(providerId, createMediaAltTarget(), input)
        if (!result.ok) {
          rows.push({ fileId, filename: input.filename, productName, altText: '', proposalRef: '', error: result.error })
          continue
        }
        const proposalRef = rememberAnalysis(
          { adminUserId, subjectKey: `media:${fileId}`, targetId: MEDIA_ALT_TARGET_ID, providerId, fingerprint: `media:${fileId}` },
          result.output,
          Date.now(),
          { generatedAt: new Date().toISOString() },
        )
        rows.push({ fileId, filename: input.filename, productName, altText: result.output.altText, proposalRef, error: '' })
      }
      catch (error) {
        rows.push({
          fileId,
          filename: input.filename,
          productName,
          altText: '',
          proposalRef: '',
          error: error instanceof Error ? error.message.slice(0, 120) : 'provider call failed',
        })
      }
    }

    return {
      ok: true,
      scanned: (res?.data ?? []).length,
      undescribed: candidates.length,
      requested: limit,
      rows,
    }
  }
  finally {
    releaseGenerateSlot(adminUserId, 'media-batch')
  }
})
