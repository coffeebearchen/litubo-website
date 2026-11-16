import { createError, getRouterParam } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const FIELDS = 'id,status,slug,name_en,name_es,name_pt,product_code,model_or_series,checkweigher_series,checkweigher_configuration,checkweigher_l_series,summary_en,summary_es,summary_pt,category_id,page_preset_id,published_at,review_notes,date_created,date_updated,hero_image,highlights,specifications,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_noindex'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/products/${id}?fields=${FIELDS}`)
  return (result as { data: unknown }).data
})
