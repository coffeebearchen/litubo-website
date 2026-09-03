import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { ProductSectionItem } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!sid || isNaN(Number(sid))) throw createError({ statusCode: 400, message: '无效的 section ID' })

  // Ownership check: verify section belongs to product
  const secCheck = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_sections/${sid}?fields=product_id`,
  )
  const secData = (secCheck as { data: { product_id: number } | null }).data
  if (!secData || secData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 section 不属于此产品' })
  }

  const result = await adminFetch<{ data: ProductSectionItem[] }>(
    event, `/items/product_section_items?filter[section_id][_eq]=${sid}&sort[]=sort&sort[]=id&limit=200`,
  )
  return (result as { data: ProductSectionItem[] }).data ?? []
})
