import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!sid || isNaN(Number(sid))) throw createError({ statusCode: 400, message: '无效的 section ID' })

  const existing = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_sections/${sid}?fields=product_id`,
  )
  const existData = (existing as { data: { product_id: number } | null }).data
  if (!existData || existData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 section 不属于此产品，操作被拒绝' })
  }

  await adminFetch(event, `/items/product_sections/${sid}`, { method: 'DELETE' })
  return { ok: true }
})
