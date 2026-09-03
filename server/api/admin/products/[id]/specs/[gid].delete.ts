import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const gid = getRouterParam(event, 'gid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!gid || isNaN(Number(gid))) throw createError({ statusCode: 400, message: '无效的参数组 ID' })
  await assertProductExists(event, Number(id))

  const check = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_spec_groups/${gid}?fields=product_id`,
  )
  const checkData = (check as { data: { product_id: number } | null }).data
  if (!checkData || checkData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该参数组不属于此产品，操作被拒绝' })
  }

  await adminFetch(event, `/items/product_spec_groups/${gid}`, { method: 'DELETE' })
  return { ok: true }
})
