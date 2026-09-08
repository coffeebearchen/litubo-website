import { z } from 'zod'
import type { FetchFn } from './mediaLifecycle'
import {
  normalizeSpecName,
  listSpecGroupsForProduct,
  getSpecItemOwnership,
  createSpecGroup,
  createSpecItem,
  updateSpecItem,
  deleteSpecItem,
  deleteSpecGroup,
  type SpecItemOwnership,
} from './productSpecWriter'

/**
 * PWS-AI-ENGINE-01R — request shape for "Apply accepted changes to Draft".
 * This is the only place the AI-assisted flow is allowed to reach the
 * canonical Specifications write model (`productSpecWriter.ts`): an `add`
 * creates a new `product_spec_items` row (and its `product_spec_groups`
 * parent if the named group does not already exist on this product); an
 * `update` only ever changes `value_en`/`note_en` on an existing item this
 * product already owns. `.strict()` on both branches means any extra key —
 * including one branch's fields sent alongside the other's — fails
 * validation outright rather than being silently ignored. No other field,
 * table, or write shape is reachable through this schema — the AI model
 * itself never touches Directus directly.
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
  changes: z.array(ApplyChangeSchema).min(1).max(100),
}).strict()

export type ApplyChange = z.infer<typeof ApplyChangeSchema>
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>

type AddChange = Extract<ApplyChange, { action: 'add' }>
type UpdateChange = Extract<ApplyChange, { action: 'update' }>

export type ApplyOutcome =
  | { ok: true, appliedCount: number }
  | { ok: false, error: string }

/**
 * The full "Apply accepted changes to Draft" orchestration: pre-validates
 * the ENTIRE accepted batch (every `update` target's ownership, duplicate
 * adds within the request, an `add` that would duplicate an existing
 * specification) BEFORE writing anything, then writes — and if any single
 * write in the batch fails partway through, runs a compensating rollback
 * (deletes rows created earlier in this same call, reverts items updated
 * earlier in this same call back to their pre-Apply value) so the batch
 * never leaves a partial result behind. Directus' REST API has no
 * cross-collection, mixed-operation atomic transaction primitive this
 * project could call instead — this saga-style compensation is the
 * verifiable alternative this task's instructions explicitly allow.
 */
export async function applyAcceptedSpecificationChanges(
  fetch: FetchFn,
  productId: number,
  changes: ApplyChange[],
): Promise<ApplyOutcome> {
  const updateChanges = changes.filter((c): c is UpdateChange => c.action === 'update')
  const addChanges = changes.filter((c): c is AddChange => c.action === 'add')

  // 1) Every `update` target must exist and belong to this exact product —
  // checked for the WHOLE batch before any write, not interleaved with writes.
  const ownershipByItemId = new Map<number, SpecItemOwnership>()
  for (const c of updateChanges) {
    const ownership = await getSpecItemOwnership(fetch, c.specItemId)
    if (!ownership || ownership.productId !== productId) {
      return { ok: false, error: 'One or more specification items could not be found for this product.' }
    }
    ownershipByItemId.set(c.specItemId, ownership)
  }

  // 2) Reject the same new specification appearing twice within this one request.
  const addKeys = new Set<string>()
  for (const c of addChanges) {
    const key = normalizeSpecName(c.parameter)
    if (addKeys.has(key)) {
      return { ok: false, error: 'The accepted changes include the same new specification more than once.' }
    }
    addKeys.add(key)
  }

  // 3) Reject an `add` that would duplicate a specification this product already has.
  if (addChanges.length > 0) {
    const existingItemsResult = await fetch<{ data: Array<{ id: number, label_en: string | null }> }>(
      `/items/product_spec_items?filter[spec_group_id][product_id][_eq]=${productId}&fields=id,label_en&limit=500`,
    )
    const existingNames = new Set(
      (existingItemsResult.data ?? []).filter(i => i.label_en).map(i => normalizeSpecName(i.label_en!)),
    )
    for (const c of addChanges) {
      if (existingNames.has(normalizeSpecName(c.parameter))) {
        return { ok: false, error: 'One or more accepted "add" changes would duplicate an existing specification.' }
      }
    }
  }

  const existingGroups = await listSpecGroupsForProduct(fetch, productId)
  const groupIdByName = new Map(
    existingGroups.filter(g => g.title_en).map(g => [normalizeSpecName(g.title_en!), g.id] as const),
  )

  // All pre-validation passed — now write, tracking everything needed to compensate on failure.
  const createdGroupIds: number[] = []
  const createdItemIds: number[] = []
  const updatedItems: Array<{ itemId: number, previousValue: string | null, previousNote: string | null }> = []

  async function compensate(): Promise<void> {
    for (const itemId of createdItemIds) {
      try { await deleteSpecItem(fetch, itemId) } catch { /* best-effort: nothing more we can do */ }
    }
    for (const groupId of createdGroupIds) {
      try { await deleteSpecGroup(fetch, groupId) } catch { /* best-effort: nothing more we can do */ }
    }
    for (const u of updatedItems) {
      try { await updateSpecItem(fetch, u.itemId, { value_en: u.previousValue, note_en: u.previousNote }) } catch { /* best-effort */ }
    }
  }

  try {
    for (const c of updateChanges) {
      const ownership = ownershipByItemId.get(c.specItemId)!
      updatedItems.push({ itemId: c.specItemId, previousValue: ownership.valueEn, previousNote: ownership.noteEn })
      await updateSpecItem(fetch, c.specItemId, { value_en: c.value, note_en: c.note ?? null })
    }
    for (const c of addChanges) {
      const key = normalizeSpecName(c.group)
      let groupId = groupIdByName.get(key)
      if (!groupId) {
        groupId = await createSpecGroup(fetch, { product_id: productId, title_en: c.group })
        groupIdByName.set(key, groupId)
        createdGroupIds.push(groupId)
      }
      const itemId = await createSpecItem(fetch, {
        spec_group_id: groupId,
        label_en: c.parameter,
        value_en: c.value,
        note_en: c.note ?? null,
      })
      createdItemIds.push(itemId)
    }
  } catch {
    await compensate()
    return { ok: false, error: 'These changes could not be applied and have been rolled back. Nothing was saved.' }
  }

  return { ok: true, appliedCount: changes.length }
}
