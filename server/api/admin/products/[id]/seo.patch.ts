import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}

  if (body.seo_title_en !== undefined) {
    const title = String(body.seo_title_en ?? '').trim()
    if (title.length > 120) throw createError({ statusCode: 400, message: 'SEO 标题不得超过 120 个字符' })
    payload.seo_title_en = title || null
  }
  if (body.seo_description_en !== undefined) {
    const desc = String(body.seo_description_en ?? '').trim()
    if (desc.length > 320) throw createError({ statusCode: 400, message: 'SEO 描述不得超过 320 个字符' })
    payload.seo_description_en = desc || null
  }
  if (body.seo_noindex !== undefined) {
    payload.seo_noindex = Boolean(body.seo_noindex)
  }

  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的 SEO 字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/products/${id}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
