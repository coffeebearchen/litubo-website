import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const gid = getRouterParam(event, 'gid')
  const iid = getRouterParam(event, 'iid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!gid || isNaN(Number(gid))) throw createError({ statusCode: 400, message: '无效的参数组 ID' })
  if (!iid || isNaN(Number(iid))) throw createError({ statusCode: 400, message: '无效的条目 ID' })
  await assertProductExists(event, Number(id))

  const itemCheck = await adminFetch<{ data: { spec_group_id: number } | null }>(
    event, `/items/product_spec_items/${iid}?fields=spec_group_id`,
  )
  const itemData = (itemCheck as { data: { spec_group_id: number } | null }).data
  if (!itemData || itemData.spec_group_id !== Number(gid)) {
    throw createError({ statusCode: 403, message: '该条目不属于此参数组，操作被拒绝' })
  }
  const groupCheck = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_spec_groups/${gid}?fields=product_id`,
  )
  const groupData = (groupCheck as { data: { product_id: number } | null }).data
  if (!groupData || groupData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该参数组不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}
  const allowed = ['label_en','label_es','label_pt','value_en','value_es','value_pt','note_en','note_es','note_pt','sort','enabled']
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/product_spec_items/${iid}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
