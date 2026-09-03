import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const fid = getRouterParam(event, 'fid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!fid || isNaN(Number(fid))) throw createError({ statusCode: 400, message: '无效的 FAQ ID' })
  await assertProductExists(event, Number(id))

  const check = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_faqs/${fid}?fields=product_id`,
  )
  const checkData = (check as { data: { product_id: number } | null }).data
  if (!checkData || checkData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 FAQ 不属于此产品，操作被拒绝' })
  }

  await adminFetch(event, `/items/product_faqs/${fid}`, { method: 'DELETE' })
  return { ok: true }
})
