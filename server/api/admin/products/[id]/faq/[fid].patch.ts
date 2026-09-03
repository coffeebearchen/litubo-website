import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const fid = getRouterParam(event, 'fid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!fid || isNaN(Number(fid))) throw createError({ statusCode: 400, message: '无效的 FAQ ID' })

  const check = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_faqs/${fid}?fields=product_id`,
  )
  const checkData = (check as { data: { product_id: number } | null }).data
  if (!checkData || checkData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 FAQ 不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}
  const allowed = ['question_en','question_es','question_pt','answer_en','answer_es','answer_pt',
    'source_note','enabled','sort']
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/product_faqs/${fid}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
