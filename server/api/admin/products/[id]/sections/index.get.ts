import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import type { ProductSection } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const result = await adminFetch<{ data: ProductSection[] }>(
    event,
    `/items/product_sections?filter[product_id][_eq]=${id}&sort[]=sort&sort[]=id&limit=200`,
  )
  return (result as { data: ProductSection[] }).data ?? []
})
