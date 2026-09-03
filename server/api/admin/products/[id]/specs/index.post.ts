import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  const body = await readBody(event)
  if (!body.title_en?.trim()) throw createError({ statusCode: 400, message: '参数组标题（EN）为必填项' })

  const payload = {
    product_id: Number(id),
    title_en: body.title_en,
    title_es: body.title_es ?? null,
    title_pt: body.title_pt ?? null,
    description_en: body.description_en ?? null,
    enabled: body.enabled !== false,
    sort: body.sort ?? null,
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_spec_groups', {
    method: 'POST', body: payload,
  })
  return (result as { data: unknown }).data
})
