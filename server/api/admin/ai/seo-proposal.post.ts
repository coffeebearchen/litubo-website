import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { createSeoMetaTarget, SEO_META_TARGET_ID, type SeoMetaProposal } from '~/server/utils/aiTargets/seoMetaTarget'
import { SEO_ENTITIES, isSeoEntity, seoFingerprint, seoSubjectKey, toSeoInput } from '~/server/utils/seoMetaAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * The admin assistant's one write-capable action: propose search metadata for one article or one
 * content item. Nothing is written here. The proposal is held under a one-time reference and
 * `seo-confirm.post.ts` is the only writer.
 *
 * The assistant is available on every admin page, so the request names its own subject explicitly
 * rather than inferring it from the current URL: a panel that guessed would one day write a proposal
 * against the wrong article.
 */
export const MAX_SEO_PROPOSAL_BODY_BYTES = 512

interface Body {
  entity?: unknown
  id?: unknown
}

interface PostRow {
  id: number
  slug: string
  content_type: string
  title_en: string | null
  excerpt_en: string | null
  body_en: string | null
}


export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_SEO_PROPOSAL_BODY_BYTES)
  const entity = body?.entity
  if (!isSeoEntity(entity)) throw createError({ statusCode: 400, message: 'Unknown entity' })
  const rawId = String(body?.id ?? '')
  if (!/^[1-9]\d*$/.test(rawId)) throw createError({ statusCode: 400, message: 'Invalid id' })
  const id = Number(rawId)

  const spec = SEO_ENTITIES[entity]
  const fields = entity === 'post'
    ? 'id,slug,content_type,title_en,excerpt_en,body_en'
    : 'id,content_items_id,locale,title,summary,blocks'
  const query = entity === 'post'
    ? `/items/posts?filter[id][_eq]=${id}&fields=${fields}&limit=1`
    : `/items/content_item_locales?filter[content_items_id][_eq]=${id}&filter[locale][_eq]=${spec.locale}&fields=${fields}&limit=1`

  const res = await adminFetch<{ data: Array<Record<string, unknown>> }>(event, query)
  const row = res?.data?.[0]
  if (!row) {
    throw createError({
      statusCode: 404,
      message: entity === 'post' ? 'Article not found' : 'No English content locale for this item',
    })
  }

  const kind = entity === 'post'
    ? `article (${String((row as unknown as PostRow).content_type ?? 'insight')})`
    : 'content item'
  const input = toSeoInput(entity, row, kind)
  if (!input.title.trim() && !input.excerpt.trim() && !input.body.trim()) {
    throw createError({ statusCode: 422, message: 'This item has no text to base search metadata on.' })
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

  const subjectKey = seoSubjectKey(entity, id)
  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A suggestion is already being generated for this item. Wait for it to finish.'
        : 'Please wait a moment before generating another suggestion for this item.',
    })
  }

  try {
    const fingerprint = seoFingerprint(entity, id, input)
    const scope = { adminUserId, subjectKey, targetId: SEO_META_TARGET_ID, providerId, fingerprint }

    const reusable = lookupAnalysis<SeoMetaProposal>(scope)
    if (reusable && !reusable.alreadyApplied) {
      return {
        ok: true,
        entity,
        id,
        proposal: reusable.output,
        proposalRef: reusable.proposalRef,
        reused: true,
        source: { title: input.title, excerpt: input.excerpt },
      }
    }
    // A confirmed record's reference is spent. Generating again uses a distinct scope so the editor
    // gets a live reference instead of one whose save could only answer 409.
    const generationScope = reusable && reusable.alreadyApplied
      ? { ...scope, fingerprint: `${fingerprint}:${Date.now()}` }
      : scope

    const result = await registry.generateStructured(providerId, createSeoMetaTarget(), input)
    if (!result.ok) return { ok: false, error: result.error }

    const proposalRef = rememberAnalysis(generationScope, result.output, Date.now(), {
      fingerprint,
      generatedAt: new Date().toISOString(),
    })

    return {
      ok: true,
      entity,
      id,
      proposal: result.output,
      proposalRef,
      reused: false,
      source: { title: input.title, excerpt: input.excerpt },
    }
  }
  finally {
    releaseGenerateSlot(adminUserId, subjectKey)
  }
})
