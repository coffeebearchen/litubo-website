import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getAdminInquiry, inquiryId } from '~/server/utils/adminInquiries'
import type { InquirySummaryProposal } from '~/server/utils/aiTargets/inquirySummaryTarget'
import { inquiryFingerprint, inquirySubjectKey } from '~/server/utils/inquiryAi'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, releaseApply, settleApply } from '~/server/utils/aiProposalReplayGuard'

/**
 * V2-06 — the one place an AI proposal becomes stored data, and only after a person accepted it.
 *
 * What the server checks before writing anything, in this order:
 *
 *  1. the reference belongs to **this administrator** and **this inquiry** (not merely to a session);
 *  2. it has not expired;
 *  3. it has not already been confirmed — the claim is one-time, so a double click or a second tab
 *     cannot write twice;
 *  4. the fields the proposal was generated from are **unchanged** (`inquiryFingerprint`);
 *  5. at least one item was actually accepted.
 *
 * What it writes is a closed set of columns: `ai_summary`, `ai_intent`, `ai_processed_at` and
 * `ai_reviewed`. It never writes `ai_recommended_products` or `ai_draft_reply` (reserved, not in this
 * scope), never asserts `ai_confidence` (there is no calibrated basis for one), and never touches
 * `status`, `inquiry_type`, `note`, `first_handled_at` or any contact field.
 *
 * The proposal text is read from the server-side record, never from the request: a client that sends
 * its own "summary" has nothing to write with.
 */
export const MAX_AI_CONFIRM_BODY_BYTES = 1024

interface Body {
  proposalRef?: unknown
  acceptSummary?: unknown
  acceptIntent?: unknown
}

interface ProposalBinding {
  fingerprint: string
  generatedAt: string
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const id = inquiryId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_AI_CONFIRM_BODY_BYTES)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const acceptSummary = body?.acceptSummary === true
  const acceptIntent = body?.acceptIntent === true
  if (!acceptSummary && !acceptIntent) {
    throw createError({ statusCode: 400, message: 'Choose at least one recommendation to save.' })
  }

  const subjectKey = inquirySubjectKey(id)
  const inquiry = await getAdminInquiry(id, <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options))

  const stored = readProposal<InquirySummaryProposal, ProposalBinding>(body?.proposalRef, { subjectKey, adminUserId })
  if (!stored) {
    throw createError({ statusCode: 409, message: 'This proposal is no longer available. Generate a new one.' })
  }
  if (stored.applyState === 'applied' || stored.applyState === 'partial') {
    throw createError({ statusCode: 409, message: 'This proposal has already been confirmed.' })
  }
  if (stored.applyState === 'applying') {
    throw createError({ statusCode: 409, message: 'This proposal is already being confirmed.' })
  }

  // The inquiry must not have changed under the proposal. Comparing the fingerprint of the stored
  // binding with the fingerprint of the row as it is now is what makes "confirm" mean "confirm this".
  if (stored.binding?.fingerprint !== inquiryFingerprint(inquiry)) {
    throw createError({
      statusCode: 409,
      message: 'The inquiry changed since this proposal was generated. Generate a new one.',
    })
  }

  const claim = claimApply(body?.proposalRef, { subjectKey, adminUserId })
  if (!claim.ok) {
    const message = claim.reason === 'in-progress'
      ? 'This proposal is already being confirmed.'
      : claim.reason === 'terminal'
        ? 'This proposal has already been confirmed.'
        : 'This proposal is no longer available. Generate a new one.'
    throw createError({ statusCode: 409, message })
  }

  const payload: Record<string, unknown> = {
    // The generation time, not the click time: this column says which proposal produced the result.
    ai_processed_at: stored.binding.generatedAt,
    ai_reviewed: true,
  }
  if (acceptSummary) payload.ai_summary = stored.output.summary
  if (acceptIntent) payload.ai_intent = stored.output.intent

  try {
    await adminFetch(event, `/items/inquiries/${id}`, { method: 'PATCH', body: payload })
  }
  catch (error) {
    // Nothing was written, so the reference goes back to `ready` and the person can retry.
    releaseApply(body?.proposalRef as string)
    throw error
  }

  settleApply(body?.proposalRef as string, {
    ok: true,
    appliedCount: Number(acceptSummary) + Number(acceptIntent),
    totalCount: 2,
    partial: false,
    message: acceptSummary && acceptIntent
      ? 'Summary and intent confirmed.'
      : acceptSummary ? 'Summary confirmed.' : 'Intent confirmed.',
  })

  const refreshed = await getAdminInquiry(id, <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options))
  return { ok: true, inquiry: refreshed }
})
