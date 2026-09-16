import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  const iid = getRouterParam(event, 'iid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!sid || isNaN(Number(sid))) throw createError({ statusCode: 400, message: '无效的 section ID' })
  if (!iid || isNaN(Number(iid))) throw createError({ statusCode: 400, message: '无效的条目 ID' })
  await assertProductDraftForMutation(event, Number(id))

  // Ownership chain: item → section → product
  const itemCheck = await adminFetch<{ data: { section_id: number } | null }>(
    event, `/items/product_section_items/${iid}?fields=section_id`,
  )
  const itemData = (itemCheck as { data: { section_id: number } | null }).data
  if (!itemData || itemData.section_id !== Number(sid)) {
    throw createError({ statusCode: 403, message: '该条目不属于此 section，操作被拒绝' })
  }
  const secCheck = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_sections/${sid}?fields=product_id`,
  )
  const secData = (secCheck as { data: { product_id: number } | null }).data
  if (!secData || secData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 section 不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}
  const allowed = ['label_en','label_es','label_pt','title_en','title_es','title_pt',
    'body_en','body_es','body_pt','icon_key','sort','enabled']
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/product_section_items/${iid}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
