import { getQuery } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const FIELDS = 'id,status,slug,name_en,name_es,name_pt,product_code,model_or_series,category_id,page_preset_id,published_at,date_created,date_updated'

export default defineEventHandler(async (event) => {
  const { status, page = '1', limit = '20' } = getQuery(event)

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20))
  const offset = (pageNum - 1) * limitNum

  const filterPart = status ? `&filter[status][_eq]=${encodeURIComponent(String(status))}` : ''

  return adminFetch<{ data: unknown[]; meta: { total_count: number; filter_count: number } }>(
    event,
    `/items/products?fields=${FIELDS}${filterPart}&limit=${limitNum}&offset=${offset}&sort=-date_updated&meta=total_count,filter_count`,
  )
})
