import { getQuery } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import {
  filterKnownStatuses,
  parsePageNum,
  parseLimitNum,
  validateCategoryId,
  sanitizeSearch,
  buildProductsFilterParts,
} from '~/server/utils/adminProductsQuery'

const FIELDS = 'id,status,slug,name_en,name_es,name_pt,product_code,model_or_series,category_id,page_preset_id,published_at,date_created,date_updated'

export default defineEventHandler(async (event) => {
  const { status, category_id, search, page = '1', limit = '20' } = getQuery(event)

  const pageNum = parsePageNum(page)
  const limitNum = parseLimitNum(limit)
  const offset = (pageNum - 1) * limitNum

  const statuses = filterKnownStatuses(status)
  const categoryId = validateCategoryId(category_id)
  const searchStr = sanitizeSearch(search)

  const filterParts = buildProductsFilterParts(statuses, categoryId, searchStr)
  const filterQuery = filterParts.length ? '&' + filterParts.join('&') : ''

  return adminFetch<{ data: unknown[]; meta: { total_count: number; filter_count: number } }>(
    event,
    `/items/products?fields=${FIELDS}${filterQuery}&limit=${limitNum}&offset=${offset}&sort=-date_updated&meta=total_count,filter_count`,
  )
})
