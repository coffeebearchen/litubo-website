import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation, readProductLifecycle } from '~/server/utils/productLifecycle'
import { assertProductAiApplyEnabled } from '~/server/utils/productAiApplyGate'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import {
  ApplyRequestSchema,
  indexProposalItems,
  planSpecificationApply,
  executeSpecificationApply,
} from '~/server/utils/aiSpecificationApply'
import { resolveProductSourceFiles } from '~/server/utils/aiProposalEngine'
import { claimApply, settleApply, releaseApply, readProposal } from '~/server/utils/aiProposalReplayGuard'
import type { ProductProposalBinding } from '~/server/utils/aiProposalBinding'
import type { SpecificationProposal } from '~/utils/aiProposal'

/**
 * A legitimate body is at most 100 changes, each bounded by the schema to
 * roughly 1.2KB of text. The ceiling is enforced on bytes actually received
 * rather than on a declared `Content-Length`, matching Generate.
 */
export const MAX_APPLY_BODY_BYTES = 256 * 1024

/**
 * PWS-AI-APPLY-DRAFT-01 / FINAL-RELEASE-FIX-F — "Apply accepted changes to
 * Draft": the last step of the single-product AI loop, and the only place
 * AI-derived content is ever written to a product.
 *
 * It writes ONLY items the server's own copy of the proposal contains, ONLY to
 * the product in this route, and ONLY while that product is a Draft. It creates
 * and updates specification rows and nothing else — no delete, no status change,
 * no publish, no media, no source, no SEO, no page content. It calls no AI
 * provider and reads no provider key.
 *
 * FIX-F changed four things about how it is guarded:
 *
 *  1. The Draft gate is the shared one every other product write uses, and it is
 *     checked AGAIN immediately before the first write, so a product published
 *     in another tab while the batch was being planned cannot be written to.
 *  2. The proposal is authority. The request names proposal items; the server
 *     decides the target row and whether that is an add or an update.
 *  3. The sources the proposal was made from are re-resolved before writing. A
 *     file unlinked, disabled or archived in the meantime refuses the batch.
 *  4. Every path out of a claimed reference now settles or releases it. A thrown
 *     error used to leave the reference stuck in `applying` for two hours.
 *
 * Under Charter FD-004 this is Draft-only assistance with a human approving
 * every row, and it carries no database transaction because this repository has
 * none to give it. Production is protected by refusing to run the non-atomic
 * write there at all (`productAiApplyGate.ts`), not by pretending it is atomic.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)

  // This describes one administrator's working session against one Draft.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  // Release gate first: on a server where Apply is closed, nothing is read,
  // claimed or written at all.
  assertProductAiApplyEnabled(useRuntimeConfig())

  // Draft gate, checked before the body is even read: a product under review,
  // published, or archived is refused outright.
  await assertProductDraftForMutation(event, productId, {
    message: 'AI-assisted changes can only be applied to a Draft product.',
  })

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)

  const rawBody = await readJsonBodyWithByteLimit<unknown>(event, MAX_APPLY_BODY_BYTES)
  const parsed = ApplyRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    // The specific validation path is not echoed back: it describes the
    // request the client just sent, and a generic refusal is enough to act on.
    throw createError({ statusCode: 400, message: 'These changes could not be read. Nothing was written.' })
  }

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const proposalRef = parsed.data.proposalRef

  /**
   * The server's own copy of the proposal, read before anything is claimed. The
   * same ownership rule the claim applies: this administrator, this product.
   */
  const stored = readProposal<SpecificationProposal, ProductProposalBinding | null>(
    proposalRef, { adminUserId, productId },
  )
  if (!stored) {
    throw createError({
      statusCode: 409,
      message: 'This proposal is no longer valid. Analyze the sources again before applying.',
    })
  }

  const indexed = indexProposalItems(stored.output)
  if (!indexed.ok) throw createError({ statusCode: 409, message: indexed.message })

  /**
   * PWS-AI-DUP-GUARD-01 — the one write this proposal is allowed.
   *
   * A disabled button cannot help a request that has already left the browser:
   * a double click that beat the disable, a second tab, or a client that never
   * saw the first response and retried, all arrive here as ordinary requests.
   * The reference is claimed BEFORE any write, so a duplicate is refused
   * rather than executed a second time.
   */
  const claim = claimApply(proposalRef, { adminUserId, productId })
  if (!claim.ok) {
    if (claim.reason === 'in-progress') {
      throw createError({ statusCode: 409, message: 'This proposal is already being applied.' })
    }
    if (claim.reason === 'terminal') {
      // Replaying the recorded outcome, not re-running it. Zero additional writes.
      return claim.appliedResult ?? {
        ok: false,
        appliedCount: 0,
        totalCount: 0,
        partial: claim.state === 'partial',
        message: 'This proposal has already been applied to Draft.',
      }
    }
    throw createError({
      statusCode: 409,
      message: 'This proposal is no longer valid. Analyze the sources again before applying.',
    })
  }

  /**
   * From here the reference is claimed, so every exit has to settle it or
   * release it. `wrote` flips only once a write may actually have happened: a
   * failure before that point is a provable zero-write refusal and returns the
   * reference to `ready`; a failure after it is terminal and must never become
   * reusable, because replaying it would re-apply whatever landed.
   */
  let wrote = false
  try {
    const binding = stored.binding
    if (!binding || binding.kind !== 'product' || binding.productId !== productId) {
      throw createError({
        statusCode: 409,
        message: 'This proposal is no longer valid. Analyze the sources again before applying.',
      })
    }

    /**
     * FINAL-RELEASE-FIX-F — the sources are re-resolved, not assumed. The
     * resolver applies the same rules Generate used: rows of THIS product, still
     * enabled, and not archived in the Media Library. A source removed, disabled
     * or archived between Analyze and Apply means the proposal no longer
     * describes material this product is allowed to use.
     */
    const stillEligible = await resolveProductSourceFiles(fetch, productId, binding.mediaIds)
    if (stillEligible.length !== binding.mediaIds.length) {
      throw createError({
        statusCode: 409,
        message: 'A source this proposal was based on is no longer available. Analyze the sources again before applying.',
      })
    }

    // Whole-batch preflight against the server's proposal and the product's
    // current specifications. Every target is derived here, never supplied.
    const plan = await planSpecificationApply(fetch, productId, parsed.data.changes, indexed.items)
    if (!plan.ok) {
      throw createError({ statusCode: plan.statusCode, message: plan.message })
    }

    /**
     * Second Draft check, immediately before the first write. The first one was
     * several round trips ago; a publish in another tab in between must not be
     * written over.
     */
    const lifecycle = await readProductLifecycle(event, productId)
    if (lifecycle.status !== 'draft') {
      throw createError({
        statusCode: 409,
        message: 'This product is no longer a Draft. Nothing was written.',
      })
    }

    wrote = true
    const result = await executeSpecificationApply(fetch, productId, plan.steps)
    settleApply(proposalRef, result)
    return result
  }
  catch (error) {
    if (wrote) {
      // A write may have landed before this threw. Record it as a terminal,
      // non-replayable outcome rather than handing back a reusable reference.
      settleApply(proposalRef, {
        ok: false,
        appliedCount: 0,
        totalCount: parsed.data.changes.length,
        partial: true,
        message: 'This proposal stopped part way through and cannot be applied again. Review Specifications before starting a new AI proposal.',
      })
    }
    else {
      // Provably nothing was written, so the reviewer can correct the request
      // and try again.
      releaseApply(proposalRef)
    }
    throw error
  }
})
