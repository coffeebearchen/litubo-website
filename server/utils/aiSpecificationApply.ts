import { z } from 'zod'
import type { FetchFn } from './mediaLifecycle'
import {
  listSpecGroupsForProduct,
  getSpecItemOwnership,
  createSpecGroup,
  createSpecItem,
  updateSpecItem,
  normalizeSpecName,
} from './productSpecWriter'

/**
 * PWS-AI-ENGINE-01R — request shape for "Apply accepted changes to Draft".
 * An `add` creates a new `product_spec_items` row (and its
 * `product_spec_groups` parent if the named group does not already exist on
 * this product); an `update` only ever changes `value_en`/`note_en` on an
 * existing item this product already owns. `.strict()` on both branches means
 * any extra key — including one branch's fields sent alongside the other's —
 * fails validation outright rather than being silently ignored.
 */

export const ApplyChangeSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    group: z.string().trim().min(1).max(200),
    parameter: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({
    action: z.literal('update'),
    specItemId: z.number().int().positive(),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }).strict(),
])

export const ApplyRequestSchema = z.object({
  /**
   * PWS-AI-DUP-GUARD-01 — the server-minted handle for the proposal these
   * changes came from. It is what makes a replayed Apply detectable at all;
   * without it the server has no way to tell a second identical request from
   * a first one. Opaque, unguessable, and bound to one administrator and one
   * product on the server side.
   */
  proposalRef: z.string().min(1).max(200),
  changes: z.array(ApplyChangeSchema).min(1).max(100),
}).strict()

export type ApplyChange = z.infer<typeof ApplyChangeSchema>
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>

/**
 * PWS-AI-APPLY-DRAFT-01 — the write path, restored deliberately and scoped by
 * Charter FD-004.
 *
 * The previous implementation was removed because it wrapped several
 * independent Directus REST writes in a best-effort compensating rollback and
 * presented that as a transaction. It was not one: a compensation call could
 * itself fail and be swallowed, so the reviewer could be told a batch had been
 * fully undone when it had not.
 *
 * The honest fix at this stage is NOT a bigger machine. Under FD-004 this is
 * Draft-only assistance for one product's specifications, with a human
 * approving every row — a partially applied batch is a recoverable Draft
 * state, not unrecoverable data damage, and so is P1 at worst rather than a
 * blocker. What was actually wrong before was the *claim*, not the absence of
 * a database transaction.
 *
 * So this writer does three things and nothing more:
 *
 *  1. **Preflight the whole batch before writing anything.** Ownership of
 *     every update target and the group destination of every add are resolved
 *     first. If any of them is wrong, the request is refused with zero writes
 *     — no "the first few were fine" partial application from a bad request.
 *  2. **Write in request order and stop at the first real failure.** Nothing
 *     after a failed write is attempted.
 *  3. **Report exactly what happened.** `appliedCount` is what actually
 *     landed. There is no compensation, no rollback, and no pretending the
 *     batch either fully succeeded or fully didn't.
 */

/** One resolved, ready-to-execute write. Produced only by a preflight that passed. */
export type ApplyPlanStep =
  | {
      kind: 'update'
      specItemId: number
      value: string
      /**
       * PWS-AI-APPLY-DRAFT-01R1 — `undefined` means "this change says nothing
       * about the note", and is NOT the same as `null`. It is deliberately not
       * collapsed to `null` here: doing so made the executor send
       * `note_en: null`, which erased a note a person had written by hand
       * whenever the model happened to propose a value without one.
       */
      note: string | undefined
    }
  | {
      kind: 'add'
      /** Normalized group name — the cache key that stops one group being created twice in a batch. */
      groupKey: string
      /** The name to create the group under, if it has to be created. */
      groupTitle: string
      /** An existing group on this product, or null meaning "create it during apply". */
      existingGroupId: number | null
      parameter: string
      value: string
      note: string | null
    }

export type ApplyPlan =
  | { ok: true, steps: ApplyPlanStep[] }
  | { ok: false, statusCode: number, message: string }

export interface ApplyResult {
  ok: boolean
  appliedCount: number
  totalCount: number
  partial: boolean
  message: string
}

/**
 * Resolves every change against the product's CURRENT state, without writing.
 *
 * Two things are checked, and both are refusals of the entire request:
 *
 *  - **Ownership.** An update's `specItemId` must belong to a spec group owned
 *    by THIS product. The browser supplies that id, so it is re-derived
 *    server-side from the item's own group; a value that resolves elsewhere,
 *    or to nothing, refuses the batch. This is the cross-product boundary and
 *    it is not negotiable.
 *  - **Group ambiguity.** If the product already has two groups whose names
 *    normalize to the same string, an add naming that group has no single
 *    correct destination. The batch is refused rather than a target guessed —
 *    the same rule the Review screen already applies to ambiguous items.
 */
export async function planSpecificationApply(
  fetch: FetchFn,
  productId: number,
  changes: ApplyChange[],
): Promise<ApplyPlan> {
  const steps: ApplyPlanStep[] = []

  const addsPresent = changes.some(c => c.action === 'add')
  const groupsByNormalizedName = new Map<string, number[]>()
  if (addsPresent) {
    for (const group of await listSpecGroupsForProduct(fetch, productId)) {
      const key = normalizeSpecName(group.title_en ?? '')
      groupsByNormalizedName.set(key, [...(groupsByNormalizedName.get(key) ?? []), group.id])
    }
  }

  for (const change of changes) {
    if (change.action === 'update') {
      const ownership = await getSpecItemOwnership(fetch, change.specItemId)
      if (!ownership || ownership.productId !== productId) {
        return {
          ok: false,
          statusCode: 409,
          message: 'One of these changes targets a specification that does not belong to this product. Nothing was written.',
        }
      }
      steps.push({
        kind: 'update',
        specItemId: change.specItemId,
        value: change.value,
        // Passed through as-is. `?? null` here is what silently cleared notes.
        note: change.note,
      })
      continue
    }

    const groupKey = normalizeSpecName(change.group)
    const matches = groupsByNormalizedName.get(groupKey) ?? []
    if (matches.length > 1) {
      return {
        ok: false,
        statusCode: 409,
        message: `This product already has more than one specification group named "${change.group}". Rename or merge them in Specifications first — nothing was written.`,
      }
    }
    steps.push({
      kind: 'add',
      groupKey,
      groupTitle: change.group,
      existingGroupId: matches[0] ?? null,
      parameter: change.parameter,
      value: change.value,
      note: change.note ?? null,
    })
  }

  return { ok: true, steps }
}

/**
 * Executes a preflighted plan in order, stopping at the first write that
 * fails. Never deletes, never publishes, never touches product status, and
 * never changes an existing item's label, group, sort or enabled flag.
 */
export async function executeSpecificationApply(
  fetch: FetchFn,
  productId: number,
  steps: ApplyPlanStep[],
): Promise<ApplyResult> {
  const totalCount = steps.length
  let appliedCount = 0

  // Groups created during THIS batch, so two adds naming the same new group
  // produce one group, not two near-duplicates.
  const createdGroupIds = new Map<string, number>()

  /**
   * PWS-AI-APPLY-DRAFT-01R1 — true between "a new group was created" and "its
   * item was created". An add is two writes, and failing between them leaves a
   * real, empty group in the Draft while `appliedCount` is still 0. Without
   * this flag the batch reported "Nothing was written", which is false.
   */
  let groupCreatedForCurrentStep = false

  try {
    for (const step of steps) {
      if (step.kind === 'update') {
        // Only these fields. Label, group, sort, enabled and locale columns are
        // deliberately absent — and `note_en` appears ONLY when this change
        // actually carries a note, so an omitted note leaves the existing one
        // alone instead of erasing it.
        const payload: Record<string, unknown> = { value_en: step.value }
        if (step.note !== undefined) payload.note_en = step.note
        await updateSpecItem(fetch, step.specItemId, payload)
        appliedCount++
        continue
      }

      let groupId = step.existingGroupId ?? createdGroupIds.get(step.groupKey) ?? null
      if (groupId === null) {
        groupId = await createSpecGroup(fetch, { product_id: productId, title_en: step.groupTitle })
        createdGroupIds.set(step.groupKey, groupId)
        groupCreatedForCurrentStep = true
      }

      await createSpecItem(fetch, {
        spec_group_id: groupId,
        label_en: step.parameter,
        value_en: step.value,
        note_en: step.note,
      })
      // The group now holds its item, so it is no longer a dangling write.
      groupCreatedForCurrentStep = false
      appliedCount++
    }
  } catch {
    // Deliberately no compensation. Whatever landed, landed; the reviewer is
    // told the real number and sent to Specifications to look at it. Inventing
    // a rollback here is what produced the dishonest behaviour this endpoint
    // was disabled for in the first place.
    // A group created without its item still changed the Draft, so it counts
    // as a partial write even though no accepted change completed.
    const wrotePartially = appliedCount > 0 || groupCreatedForCurrentStep

    let message: string
    if (appliedCount > 0 && groupCreatedForCurrentStep) {
      message = `Applied ${appliedCount} of ${totalCount} accepted changes before a save error. A new specification group was also created before the error. Review Specifications before starting a new AI proposal.`
    } else if (appliedCount > 0) {
      message = `Applied ${appliedCount} of ${totalCount} accepted changes before a save error. Review Specifications before starting a new AI proposal.`
    } else if (groupCreatedForCurrentStep) {
      message = 'A new specification group was created before the item could be saved. Review Specifications before starting a new AI proposal.'
    } else {
      message = 'No changes could be saved. Nothing was written to this product.'
    }

    return {
      ok: false,
      appliedCount,
      totalCount,
      partial: wrotePartially,
      message,
    }
  }

  return {
    ok: true,
    appliedCount,
    totalCount,
    partial: false,
    message: `Applied ${appliedCount} accepted change${appliedCount === 1 ? '' : 's'} to Draft.`,
  }
}
