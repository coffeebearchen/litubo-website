import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { ProductSeoFields } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })

  const result = await adminFetch<{ data: ProductSeoFields }>(
    event,
    `/items/products/${id}?fields=seo_title_en,seo_description_en,seo_noindex`,
  )
  return (result as { data: ProductSeoFields }).data
})
