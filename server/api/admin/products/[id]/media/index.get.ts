import { getRouterParam, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { ProductMedia } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })

  const result = await adminFetch<{ data: ProductMedia[] }>(
    event,
    `/items/products_files?filter[products_id][_eq]=${id}&fields=id,products_id,directus_files_id,file_role,alt_en,alt_es,alt_pt,caption_en,caption_es,caption_pt,enabled,language,version_label,sort,file_date&sort[]=sort&sort[]=id&limit=200`,
  )
  return (result as { data: ProductMedia[] }).data ?? []
})
