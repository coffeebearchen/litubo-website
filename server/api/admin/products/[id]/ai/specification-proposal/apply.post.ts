import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { ApplyRequestSchema, normalizeSpecName, type ApplyChange } from '~/server/utils/aiSpecificationApply'

interface GroupRow { id: number, title_en: string | null }
interface SpecItemOwnershipRow { id: number, spec_group_id: { product_id: number } | null }

/**
 * PWS-AI-ENGINE-01 — "Apply accepted changes to Draft". The ONLY endpoint in
 * the AI-assisted Specifications flow that writes anything. It never calls
 * a model, never touches Page Content/FAQ/SEO/Media/Evidence/publish state,
 * and only writes exactly the fields the existing Specifications editor
 * already writes (`title_en` for a new group; `label_en`/`value_en`/`note_en`
 * for an item) — the request schema in `aiSpecificationApply.ts` makes any
 * other field or table structurally unreachable.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const body = await readBody(event)
  const parsed = ApplyRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Request body did not match the expected shape.' })
  }
  const { changes } = parsed.data

  // Existing groups for this product — reused so an "add" under an
  // already-existing group name never creates a near-duplicate group.
  const existingGroupsResult = await adminFetch<{ data: GroupRow[] }>(
    event, `/items/product_spec_groups?filter[product_id][_eq]=${productId}&fields=id,title_en&limit=200`,
  )
  const existingGroups = existingGroupsResult.data ?? []
  const groupIdByName = new Map(
    existingGroups
      .filter(g => g.title_en)
      .map(g => [normalizeSpecName(g.title_en!), g.id] as const),
  )

  let appliedCount = 0

  for (const change of changes as ApplyChange[]) {
    if (change.action === 'update') {
      // Re-verify this item still belongs to this product before writing anything.
      const itemCheck = await adminFetch<{ data: SpecItemOwnershipRow | null }>(
        event, `/items/product_spec_items/${change.specItemId}?fields=id,spec_group_id.product_id`,
      )
      const item = itemCheck.data
      if (!item || !item.spec_group_id || item.spec_group_id.product_id !== productId) {
        throw createError({ statusCode: 404, message: `Specification item not found for this product` })
      }
      await adminFetch(event, `/items/product_spec_items/${change.specItemId}`, {
        method: 'PATCH',
        body: { value_en: change.value, note_en: change.note ?? null },
      })
      appliedCount++
      continue
    }

    // action === 'add'
    const normalizedGroupName = normalizeSpecName(change.group)
    let groupId = groupIdByName.get(normalizedGroupName)
    if (!groupId) {
      const createdGroup = await adminFetch<{ data: { id: number } }>(
        event, '/items/product_spec_groups',
        { method: 'POST', body: { product_id: productId, title_en: change.group, enabled: true } },
      )
      groupId = createdGroup.data.id
      groupIdByName.set(normalizedGroupName, groupId)
    }

    await adminFetch(event, '/items/product_spec_items', {
      method: 'POST',
      body: {
        spec_group_id: groupId,
        label_en: change.parameter,
        value_en: change.value,
        note_en: change.note ?? null,
        enabled: true,
      },
    })
    appliedCount++
  }

  return { message: `${appliedCount} specification change${appliedCount === 1 ? '' : 's'} were applied to Draft.` }
})
