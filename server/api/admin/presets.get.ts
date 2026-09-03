import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const result = await adminFetch<{ data: unknown[] }>(
    event,
    '/items/product_page_presets?filter[active][_eq]=true&sort=name_en&fields=id,code,name_en,category_hint',
  )
  return (result as { data: unknown[] }).data
})
