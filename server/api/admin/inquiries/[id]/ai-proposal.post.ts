import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getAdminInquiry, inquiryId } from '~/server/utils/adminInquiries'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { createInquirySummaryTarget, INQUIRY_SUMMARY_TARGET_ID, type InquirySummaryProposal } from '~/server/utils/aiTargets/inquirySummaryTarget'
import { buildInquiryGenerationInput, inquiryFingerprint, inquirySubjectKey } from '~/server/utils/inquiryAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'
import { lookupAnalysis, rememberAnalysis } from '~/server/utils/aiProposalReplayGuard'

/**
 * V2-06 — generate an internal summary, an intent hint and a missing-information list for one
 * inquiry. This is the only new endpoint that costs money, and it writes NOTHING.
 *
 * Design notes, each one a deliberate boundary:
 *
 *  - **It never writes `inquiries`.** The proposal goes back to the browser and, for one-time
 *    confirmation, into the existing in-memory proposal guard under a random reference. If this
 *    process restarts, the reference dies and the reviewer simply generates again; no half-written
 *    state can exist.
 *  - **A missing provider is not an error page.** `{ ok: false, unavailable: true }` lets the screen
 *    say "AI is not available" and keep the ordinary status/note workflow working.
 *  - **Repeated clicks are bounded** by the existing per-administrator, per-subject single-flight slot
 *    and cooldown, so a stuck retry cannot bill repeatedly.
 *  - **Reuse:** an identical request over unchanged fields returns the proposal already generated,
 *    with its original reference — so the second click is free and cannot mint a fresh one to slip
 *    past the one-time confirmation.
 *  - **The response contains no provider internals**: no prompt, no raw response, no key, no model
 *    name, no inquiry ids the caller did not already know.
 */

/** `{ providerId }` is a few dozen bytes; anything larger is not a request this endpoint makes. */
export const MAX_AI_PROPOSAL_BODY_BYTES = 1024

interface Body {
  providerId?: unknown
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const id = inquiryId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_AI_PROPOSAL_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const fetchFn = <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options)
  const inquiry = await getAdminInquiry(id, fetchFn)

  // Nothing to summarize is a refusal, not an empty summary: a model asked to summarize silence will
  // describe the form instead of the message.
  if (!(inquiry.message ?? '').trim()) {
    return { ok: false, error: 'This inquiry has no message to summarize.' }
  }

  const config = useRuntimeConfig()
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    // Keys come from the running process, never runtimeConfig.
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })

  const providerId = parseAiProviderId(body?.providerId, parseAiProviderId(config.aiDefaultProvider, 'deepseek'))
  if (!registry.getProvider(providerId).isConfigured()) {
    return { ok: false, unavailable: true, error: 'AI is not configured on this server yet.' }
  }

  const subjectKey = inquirySubjectKey(id)
  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: slot.reason === 'in-flight'
        ? 'A proposal is already being generated for this inquiry. Wait for it to finish.'
        : 'Please wait a moment before generating another proposal for this inquiry.',
    })
  }

  try {
    const fingerprint = inquiryFingerprint(inquiry)
    const scope = {
      adminUserId,
      subjectKey,
      targetId: INQUIRY_SUMMARY_TARGET_ID,
      providerId,
      fingerprint,
    }

    const reusable = lookupAnalysis<InquirySummaryProposal>(scope)
    if (reusable) {
      return {
        ok: true,
        proposal: reusable.output,
        proposalRef: reusable.proposalRef,
        reused: true,
        // A proposal that was already confirmed stays confirmed; a new one never inherits that state.
        alreadyConfirmed: reusable.alreadyApplied,
      }
    }

    const result = await registry.generateStructured(providerId, createInquirySummaryTarget(), buildInquiryGenerationInput(inquiry))
    if (!result.ok) return { ok: false, error: result.error }

    // The generation timestamp travels with the reference, so Confirm can store when the proposal was
    // produced rather than when somebody pressed the button.
    const proposalRef = rememberAnalysis(scope, result.output, Date.now(), { fingerprint, generatedAt: new Date().toISOString() })

    return {
      ok: true,
      proposal: result.output,
      proposalRef,
      reused: false,
      alreadyConfirmed: false,
    }
  }
  finally {
    // Released even on failure: a failed generation must not lock this inquiry until the in-flight
    // ceiling expires.
    releaseGenerateSlot(adminUserId, subjectKey)
  }
})
