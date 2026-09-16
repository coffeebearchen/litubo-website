import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readProductLifecycle } from '~/server/utils/productLifecycle'
import { runProposalEngine } from '~/server/utils/aiProposalEngine'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { specificationsTarget } from '~/server/utils/aiTargets/specificationsTarget'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { resolveSourceRefs, SourceRefUnavailableError } from '~/server/utils/aiSourceRef'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'
import { createProductProposalBinding } from '~/server/utils/aiProposalBinding'
import type { SpecificationProposal } from '~/utils/aiProposal'
import { MAX_FILES_PER_REQUEST, MAX_PER_FILE_CHARS } from '~/server/utils/aiTextExtraction'
import { createImageTextReader, createPdfTextReader } from '~/server/utils/documentExtractorClient'

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
 * FINAL-RELEASE-FIX-F — analysing a product that is not a Draft is refused
 * BEFORE the provider is reached. A proposal for a product under review or
 * already published could only ever end in confusion: Apply would refuse it,
 * and the analysis would have been paid for to produce something unusable.
 * The check costs one read and saves a provider call.
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

  // A generation result describes one administrator's working session and must
  // not be cached or persisted by anything in front of this endpoint.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const body = await readJsonBodyWithByteLimit<GenerateBody>(event, MAX_GENERATE_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  /**
   * FINAL-RELEASE-FIX-F — the Draft gate.
   *
   * It sits after the two checks that cost nothing and must keep their own
   * contracts — the byte ceiling on the body and authentication — and before
   * everything that costs something: no source ref is resolved, no rate-limit
   * slot is claimed, and above all no provider is ever called for a product
   * whose proposal could not be applied anyway.
   */
  const lifecycle = await readProductLifecycle(event, productId)
  if (lifecycle.status !== 'draft') {
    throw createError({
      statusCode: 409,
      message: 'AI analysis is available only while this product is a Draft.',
    })
  }

  // A ref that was not minted for this admin AND this product resolves to
  // nothing; one bad ref refuses the whole request rather than silently
  // analyzing the subset that happened to verify.
  let mediaIds: number[] | null
  try {
    mediaIds = resolveSourceRefs(body?.sourceRefs, { productId, adminUserId }, MAX_FILES_PER_REQUEST)
  } catch (error) {
    // No server secret configured: fail closed rather than fall back to
    // anything that would accept raw ids.
    if (error instanceof SourceRefUnavailableError) {
      throw createError({ statusCode: 503, message: 'AI source selection is unavailable on this server.' })
    }
    throw error
  }
  if (mediaIds === null) {
    return {
      ok: false,
      error: 'This selection is no longer valid. Reload the page and choose the files again.',
      fileResults: [],
    }
  }

  // Cost control: one generation at a time per administrator per product, plus
  // a cooldown. Claimed only after the request has been fully validated, so a
  // malformed request never consumes the slot.
  const slot = claimGenerateSlot(adminUserId, productId)
  if (!slot.allowed) {
    // h3 types `Retry-After` as a number (seconds), not a string.
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'An analysis is already running for this product. Wait for it to finish.'
        : 'Please wait a moment before analyzing this product again.',
    })
  }

  const config = useRuntimeConfig()

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: config.openaiApiKey, model: config.openaiModel },
    deepseek: { apiKey: config.deepseekApiKey, model: config.deepseekModel },
  })

  // AI-PDF-SOURCE-01 — PDFs are read by the isolated document-extractor sidecar,
  // never in this process. An unset or unreachable URL makes each PDF report
  // "unavailable"; the other selected sources are still analyzed.
  // AI-IMAGE-OCR-SOURCE-01 — images are transcribed by the same sidecar, locally.
  const readers = {
    pdf: createPdfTextReader({ baseUrl: config.documentExtractorUrl, maxTextChars: MAX_PER_FILE_CHARS }),
    image: createImageTextReader({ baseUrl: config.documentExtractorUrl }),
  }

  try {
    /**
     * PWS-AI-DUP-GUARD-01 — the reuse hooks. The engine still downloads,
     * extracts and dedupes every time, because that is how it establishes the
     * sources are unchanged; what it skips on a hit is the provider call.
     *
     * The scope is deliberately narrow: this administrator, this product, this
     * Target, this provider, this exact set of source content. Anything
     * different is a different analysis.
     */
    const scopeFor = (fingerprint: string) => ({
      adminUserId,
      productId,
      targetId: specificationsTarget.id,
      providerId: String(body?.providerId ?? config.aiDefaultProvider ?? ''),
      fingerprint,
    })

    let reusedRef: string | null = null
    let reusedAlreadyApplied = false

    const result = await runProposalEngine(fetch, registry, specificationsTarget, {
      productId,
      providerId: body?.providerId,
      mediaIds,
    }, {
      lookup: (fingerprint) => {
        const hit = lookupAnalysis<SpecificationProposal>(scopeFor(fingerprint))
        if (!hit) return null
        reusedRef = hit.proposalRef
        reusedAlreadyApplied = hit.alreadyApplied
        return hit.output
      },
      // Storing happens below, where the reference is minted with it, so the
      // analysis and its proposalRef can never exist independently.
      store: () => {},
    }, readers)

    if (!result.ok) {
      return { ok: false, error: result.error, fileResults: result.fileResults }
    }

    /**
     * A cache hit keeps its ORIGINAL reference. Minting a new one would hand
     * back a clean slate and let a re-analysis walk past the Apply guard.
     *
     * FINAL-RELEASE-FIX-F — a freshly minted reference now carries the server's
     * binding: which association rows this analysis read, and under which
     * fingerprint. Apply re-resolves those rows before it writes.
     */
    const proposalRef = reusedRef ?? rememberAnalysis(
      scopeFor(result.fingerprint),
      result.output,
      Date.now(),
      createProductProposalBinding(productId, mediaIds, result.fingerprint),
    )

    return {
      ok: true,
      proposal: result.output,
      fileResults: result.fileResults,
      proposalRef,
      reused: result.reused,
      alreadyApplied: reusedAlreadyApplied,
    }
  } finally {
    // Always released, including on failure — a failed analysis must not lock
    // this product until the in-flight ceiling expires.
    releaseGenerateSlot(adminUserId, productId)
  }
})
