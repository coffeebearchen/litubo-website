import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { createMediaAltTarget, MEDIA_ALT_TARGET_ID, type MediaAltProposal } from '~/server/utils/aiTargets/mediaAltTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * The assistant's alt-text proposal for one Media Library file.
 *
 * Unlike the product media AI, this is about the file itself - the 326 pictures in the library that
 * nobody has described yet - so it is reachable from the media page rather than from a product.
 *
 * Nothing is written here. `media-alt-confirm.post.ts` is the only writer, and it writes exactly one
 * column: the file's title, which is what both the media library and the public page read as alt.
 */
export const MAX_MEDIA_ALT_BODY_BYTES = 512

interface Body { fileId?: unknown }

interface FileRow {
  id: string
  title: string | null
  filename_download: string | null
  type: string | null
  folder: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_MEDIA_ALT_BODY_BYTES)
  const fileId = String(body?.fileId ?? '')
  if (!UUID_RE.test(fileId)) throw createError({ statusCode: 400, message: 'Invalid file id' })

  const fileRes = await adminFetch<{ data: FileRow[] }>(
    event,
    `/files?filter[id][_eq]=${fileId}&fields=id,title,filename_download,type,folder&limit=1`,
  )
  const file = fileRes?.data?.[0]
  if (!file) throw createError({ statusCode: 404, message: 'File not found' })

  // Optional context: the product this file is linked to, and the folder it lives in. Both make the
  // difference between "product photograph" and "XR-700 X-ray inspection system on a production line".
  let productName: string | null = null
  try {
    const links = await adminFetch<{ data: Array<{ products_id: number }> }>(
      event,
      `/items/products_files?filter[directus_files_id][_eq]=${fileId}&fields=products_id&limit=1`,
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

  const subjectKey = `media:${fileId.toLowerCase()}`
  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A suggestion is already being generated for this file. Wait for it to finish.'
        : 'Please wait a moment before generating another suggestion for this file.',
    })
  }

  try {
    const fingerprint = `media:${fileId.toLowerCase()}`
    const scope = { adminUserId, subjectKey, targetId: MEDIA_ALT_TARGET_ID, providerId, fingerprint }
    const reusable = lookupAnalysis<MediaAltProposal>(scope)
    if (reusable && !reusable.alreadyApplied) {
      return {
        ok: true,
        fileId,
        proposal: reusable.output,
        proposalRef: reusable.proposalRef,
        reused: true,
        context: { filename: input.filename, productName, folderName },
      }
    }
    const generationScope = reusable && reusable.alreadyApplied
      ? { ...scope, fingerprint: `${fingerprint}:${Date.now()}` }
      : scope

    const result = await registry.generateStructured(providerId, createMediaAltTarget(), input)
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
    })
    return {
      ok: true,
      fileId,
      proposal: result.output,
      proposalRef,
      reused: false,
      context: { filename: input.filename, productName, folderName },
    }
  }
  finally {
    releaseGenerateSlot(adminUserId, subjectKey)
  }
})
