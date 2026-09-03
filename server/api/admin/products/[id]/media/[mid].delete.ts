import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const mid = getRouterParam(event, 'mid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!mid || isNaN(Number(mid))) throw createError({ statusCode: 400, message: '无效的媒体记录 ID' })

  const check = await adminFetch<{ data: { products_id: number } | null }>(
    event, `/items/products_files/${mid}?fields=products_id`,
  )
  const checkData = (check as { data: { products_id: number } | null }).data
  if (!checkData || checkData.products_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该媒体记录不属于此产品，操作被拒绝' })
  }

  // Only delete the products_files record (the join row), NOT the directus_files asset
  await adminFetch(event, `/items/products_files/${mid}`, { method: 'DELETE' })
  return { ok: true }
})
