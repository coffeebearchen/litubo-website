import { createError, readBody, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { createProductIntakeTarget, PRODUCT_INTAKE_TARGET_ID, type ProductIntakeProposal } from '~/server/utils/aiTargets/productIntakeTarget'
import { extractIntakeText, intakeFingerprint, intakeReaders } from '~/server/utils/productIntake'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * Product Centre intake — read one uploaded document and propose a new product from it. Writes nothing:
 * the proposal is held against a one-time reference and the confirm endpoint creates the record.
 *
 * The person names the product code here, because it may differ from anything printed in the document.
 * The code is part of the fingerprint, so a proposal generated for one code cannot be published under
 * another.
 */
const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/
const FILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readBody(event)
  const fileId = String(body?.fileId ?? '').trim()
  if (!FILE_ID_RE.test(fileId)) throw createError({ statusCode: 400, message: 'A media file id is required' })

  const productCode = String(body?.productCode ?? '').trim().toUpperCase()
  if (!PRODUCT_CODE_RE.test(productCode)) {
    throw createError({ statusCode: 400, message: 'Product code must use uppercase letters, digits and hyphens (e.g. LT-180C)' })
  }
  const instruction = typeof body?.instruction === 'string' ? body.instruction.trim().slice(0, 400) : ''

  const fileRes = await adminFetch<{ data?: Array<{ id: string, filename_download?: string | null, type?: string | null }> }>(
    event,
    `/files?filter[id][_eq]=${fileId}&fields=id,filename_download,type&limit=1`,
  )
  const file = fileRes?.data?.[0]
  if (!file) throw createError({ statusCode: 404, message: 'The uploaded file was not found in the media library.' })

  const config = useRuntimeConfig()
  const extracted = await extractIntakeText(
    event,
    { id: file.id, filename: file.filename_download ?? 'document', mimeType: file.type ?? null },
    intakeReaders(config),
  )
  if (!extracted.ok) return { ok: false, error: extracted.error }

  const catRes = await adminFetch<{ data?: Array<{ id: number, name_en?: string | null }> }>(
    event,
    '/items/product_categories?fields=id,name_en&sort=sort,name_en&limit=-1',
  )
  const categories = (catRes?.data ?? []).map(c => ({ id: c.id, name: c.name_en ?? '' }))

  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })
  const providerId = parseAiProviderId(config.aiDefaultProvider, 'deepseek')
  if (!registry.getProvider(providerId).isConfigured()) {
    return { ok: false, unavailable: true, error: 'AI is not configured on this server yet.' }
  }

  const slotKey = `product-intake:${fileId}`
  const slot = claimGenerateSlot(adminUserId, slotKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'This document is already being read. Wait for it to finish.'
        : 'Please wait a moment before reading this document again.',
    })
  }

  try {
    const fingerprint = intakeFingerprint(fileId, productCode)
    const scope = { adminUserId, subjectKey: 'product-intake', targetId: PRODUCT_INTAKE_TARGET_ID, providerId, fingerprint }

    const reusable = lookupAnalysis<ProductIntakeProposal>(scope)
    if (reusable && !reusable.alreadyApplied) {
      return { ok: true, proposal: reusable.output, proposalRef: reusable.proposalRef, categories, file: { name: extracted.filename }, reused: true }
    }
    const generationScope = reusable && reusable.alreadyApplied
      ? { ...scope, fingerprint: `${fingerprint}:${Date.now()}` }
      : scope

    const result = await registry.generateStructured(
      providerId,
      createProductIntakeTarget(categories.map(c => c.id)),
      {
        sourceFileSummaries: [{ displayName: extracted.filename, fileType: file.type ?? 'document' }],
        extractedSourceTexts: [{ displayName: extracted.filename, text: extracted.text }],
        productCode,
        instruction: instruction || null,
        categories,
      },
    )
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
      fileId,
      productCode,
    })

    return { ok: true, proposal: result.output, proposalRef, categories, file: { name: extracted.filename }, reused: false }
  }
  finally {
    releaseGenerateSlot(adminUserId, slotKey)
  }
})
