import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { ProductFaq } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })

  const result = await adminFetch<{ data: ProductFaq[] }>(
    event,
    `/items/product_faqs?filter[product_id][_eq]=${id}&sort[]=sort&sort[]=id&limit=200`,
  )
  return (result as { data: ProductFaq[] }).data ?? []
})
