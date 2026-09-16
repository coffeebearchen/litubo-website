import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'
import { createSpecItem } from '~/server/utils/productSpecWriter'

/** Delegates to the canonical writer (`productSpecWriter.ts`) — the same function the AI Apply endpoint uses to create an item. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const gid = getRouterParam(event, 'gid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!gid || isNaN(Number(gid))) throw createError({ statusCode: 400, message: '无效的参数组 ID' })
  await assertProductDraftForMutation(event, Number(id))

  const check = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_spec_groups/${gid}?fields=product_id`,
  )
  const checkData = (check as { data: { product_id: number } | null }).data
  if (!checkData || checkData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该参数组不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)
  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const itemId = await createSpecItem(fetch, {
    spec_group_id: Number(gid),
    label_en: body.label_en ?? null,
    label_es: body.label_es ?? null,
    label_pt: body.label_pt ?? null,
    value_en: body.value_en ?? null,
    value_es: body.value_es ?? null,
    value_pt: body.value_pt ?? null,
    note_en: body.note_en ?? null,
    note_es: body.note_es ?? null,
    note_pt: body.note_pt ?? null,
    sort: body.sort ?? null,
    enabled: body.enabled !== false,
  })
  return { id: itemId }
})
