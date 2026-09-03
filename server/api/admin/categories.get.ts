import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const result = await adminFetch<{ data: unknown[] }>(
    event,
    '/items/product_categories?fields=id,slug,name_en&sort=name_en',
  )
  return (result as { data: unknown[] }).data
})
