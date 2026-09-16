import { z } from 'zod'
import type { FetchFn } from './mediaLifecycle'
import type { SpecificationProposal } from '~/utils/aiProposal'
import { proposalItemKey } from '~/utils/aiProposal'
import {
  listSpecGroupsForProduct,
  createSpecGroup,
  createSpecItem,
  updateSpecItem,
  normalizeSpecName,
} from './productSpecWriter'

/**
 * FINAL-RELEASE-FIX-F — the server proposal, not the request, decides what Apply
 * writes.
 *
 * Before this module was rewritten the request body carried the whole
 * instruction: `action` chose create-or-update, `specItemId` chose the row, and
 * `group` / `parameter` / `value` were free text. The server checked only that
 * the row belonged to this product. So an administrator holding one valid
 * `proposalRef` could write any value into any specification of that product and
 * call it an AI proposal — the proposal itself constrained nothing.
 *
 * Now a change can only say WHICH proposal item it accepts, and what the
 * reviewer edited the value to:
 *
 *   { itemKey, value, note? }
 *
 * `itemKey` is a deterministic identity derived from the server-held proposal —
 * the normalized group and parameter of one proposed item — because the proposal
 * shape has no per-item id and inventing a database-backed Proposal collection
 * is out of scope for V1. The server looks the key up in ITS OWN copy of the
 * proposal; an unknown or repeated key refuses the whole batch. Target and
 * operation are then derived server-side: if this product already has an item
 * under that group and parameter, it is an update of that row; otherwise it is
 * an add into that group. The request cannot express either choice.
 *
 * The reviewer may still correct a value before accepting it — that is the point
 * of a human review — so `value` and `note` are taken from the request and
 * validated for type and length. What the request can no longer do is decide
 * where that value lands.
 */

export const ApplyChangeSchema = z.object({
  /** Identity of one item in the server's copy of the proposal (see `proposalItemKey`). */
  itemKey: z.string().min(1).max(500),
  /** The reviewer's accepted value — theirs to edit, but not theirs to aim. */
  value: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional(),
}).strict()

export const ApplyRequestSchema = z.object({
  /**
   * PWS-AI-DUP-GUARD-01 — the server-minted handle for the proposal these
   * changes came from. It is what makes a replayed Apply detectable, and now
   * also what the server reads the authoritative proposal back out of.
   */
  proposalRef: z.string().min(1).max(200),
  changes: z.array(ApplyChangeSchema).min(1).max(100),
}).strict()

export type ApplyChange = z.infer<typeof ApplyChangeSchema>
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>

/**
 * The deterministic identity of one proposed item. Defined in `utils/aiProposal`
 * so the browser and the server derive the same key from the same proposal, and
 * re-exported here because this module is where Apply's contract lives.
 */
export { proposalItemKey }

export interface ProposedItem {
  group: string
  parameter: string
  value: string
  note: string | null
}

/**
 * Indexes the server's copy of a proposal by item key.
 *
 * A proposal that names the same group and parameter twice is rejected outright:
 * the key would be ambiguous, and a reviewer accepting "that one" could not be
 * told which row the server would write.
 */
export function indexProposalItems(proposal: SpecificationProposal | null | undefined):
  { ok: true, items: Map<string, ProposedItem> } | { ok: false, message: string } {
  const items = new Map<string, ProposedItem>()
  for (const group of proposal?.groups ?? []) {
    for (const item of group.items ?? []) {
      const key = proposalItemKey(group.group ?? '', item.parameter ?? '')
      if (items.has(key)) {
        return {
          ok: false,
          message: 'This proposal names the same parameter twice in one group, so it cannot be applied safely. Analyze the sources again.',
        }
      }
      items.set(key, {
        group: group.group ?? '',
        parameter: item.parameter ?? '',
        value: item.value ?? '',
        note: item.note ?? null,
      })
    }
  }

  /**
   * A conflicted parameter is a proposed item too. The model reports the
   * disagreement instead of a value, the reviewer picks one of the candidates,
   * and the accepted row then travels the same Apply path as any other. It is
   * indexed here so that path exists — without it, resolving a conflict would be
   * refused as "not part of this proposal". An entry already contributed by
   * `groups` wins: it carries the proposed value, and a conflict never adds a
   * second destination for the same group and parameter.
   */
  for (const conflict of proposal?.conflicts ?? []) {
    const key = proposalItemKey(conflict.group ?? '', conflict.parameter ?? '')
    if (items.has(key)) continue
    items.set(key, {
      group: conflict.group ?? '',
      parameter: conflict.parameter ?? '',
      value: '',
      note: null,
    })
  }

  return { ok: true, items }
}

/** One resolved, ready-to-execute write. Produced only by a preflight that passed. */
export type ApplyPlanStep =
  | {
      kind: 'update'
      specItemId: number
      value: string
      /**
       * PWS-AI-APPLY-DRAFT-01R1 — `undefined` means "this change says nothing
       * about the note", and is NOT the same as `null`. Collapsing it to `null`
       * erased notes a person had written by hand.
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

interface ExistingSpecItem {
  id: number
  groupId: number
  key: string
}

/**
 * Every specification item this product owns, keyed the same way the proposal is.
 * This is the lookup that turns an accepted proposal item into an update target
 * without the browser ever naming a row id.
 */
async function listSpecItemsForProduct(fetch: FetchFn, productId: number): Promise<ExistingSpecItem[]> {
  const result = await fetch<{
    data: Array<{ id: number, label_en: string | null, spec_group_id: { id: number, title_en: string | null } | null }>
  }>(
    `/items/product_spec_items?filter[spec_group_id][product_id][_eq]=${productId}`
    + '&fields=id,label_en,spec_group_id.id,spec_group_id.title_en&limit=500',
  )
  const rows = result.data ?? []
  const items: ExistingSpecItem[] = []
  for (const row of rows) {
    if (!row.spec_group_id) continue
    items.push({
      id: row.id,
      groupId: row.spec_group_id.id,
      key: proposalItemKey(row.spec_group_id.title_en ?? '', row.label_en ?? ''),
    })
  }
  return items
}

/**
 * Resolves every accepted change against the server's proposal and the product's
 * CURRENT state, without writing.
 *
 * Refusals are whole-batch, and each of them is a zero-write refusal:
 *
 *  - **Unknown item.** The key is not in the server's proposal. The request is
 *    describing a write the proposal never proposed.
 *  - **Duplicate item.** The same proposal item accepted twice in one batch.
 *  - **Ambiguous existing target.** The product already has two items that
 *    normalize to the same group and parameter, so "update that one" has no
 *    single answer.
 *  - **Ambiguous group.** Two existing groups normalize to the same name, so an
 *    add has no single destination. Unchanged from before.
 */
export async function planSpecificationApply(
  fetch: FetchFn,
  productId: number,
  changes: ApplyChange[],
  proposalItems: Map<string, ProposedItem>,
): Promise<ApplyPlan> {
  const seen = new Set<string>()
  for (const change of changes) {
    if (seen.has(change.itemKey)) {
      return {
        ok: false,
        statusCode: 409,
        message: 'The same proposed parameter was accepted twice. Nothing was written.',
      }
    }
    seen.add(change.itemKey)
    if (!proposalItems.has(change.itemKey)) {
      return {
        ok: false,
        statusCode: 409,
        message: 'One of these changes is not part of this proposal. Nothing was written.',
      }
    }
  }

  const existingItems = await listSpecItemsForProduct(fetch, productId)
  const itemsByKey = new Map<string, ExistingSpecItem[]>()
  for (const item of existingItems) {
    itemsByKey.set(item.key, [...(itemsByKey.get(item.key) ?? []), item])
  }

  const groupsByNormalizedName = new Map<string, number[]>()
  for (const group of await listSpecGroupsForProduct(fetch, productId)) {
    const key = normalizeSpecName(group.title_en ?? '')
    groupsByNormalizedName.set(key, [...(groupsByNormalizedName.get(key) ?? []), group.id])
  }

  const steps: ApplyPlanStep[] = []
  for (const change of changes) {
    // Present: the unknown-key check above already ran over every change.
    const proposed = proposalItems.get(change.itemKey)!

    const matches = itemsByKey.get(change.itemKey) ?? []
    if (matches.length > 1) {
      return {
        ok: false,
        statusCode: 409,
        message: `This product already has more than one "${proposed.parameter}" in "${proposed.group}". Merge them in Specifications first — nothing was written.`,
      }
    }
    if (matches.length === 1) {
      steps.push({
        kind: 'update',
        specItemId: matches[0]!.id,
        value: change.value,
        note: change.note,
      })
      continue
    }

    const groupKey = normalizeSpecName(proposed.group)
    const groupMatches = groupsByNormalizedName.get(groupKey) ?? []
    if (groupMatches.length > 1) {
      return {
        ok: false,
        statusCode: 409,
        message: `This product already has more than one specification group named "${proposed.group}". Rename or merge them in Specifications first — nothing was written.`,
      }
    }
    steps.push({
      kind: 'add',
      groupKey,
      groupTitle: proposed.group,
      existingGroupId: groupMatches[0] ?? null,
      parameter: proposed.parameter,
      value: change.value,
      note: change.note ?? null,
    })
  }

  return { ok: true, steps }
}

/**
 * Executes a preflighted plan in order, stopping at the first write that fails.
 * Never deletes, never publishes, never touches product status, and never
 * changes an existing item's label, group, sort or enabled flag.
 *
 * This is NOT a transaction and does not claim to be one: it preflights the
 * whole batch, writes in order, stops at the first real failure and reports the
 * true count. Production safety for the non-atomic case is handled a level up,
 * by the release gate in `productAiApplyGate.ts`.
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
   * real, empty group in the Draft while `appliedCount` is still 0.
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
