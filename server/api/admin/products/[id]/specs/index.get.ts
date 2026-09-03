import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import type { ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  const [groupsResult, itemsResult] = await Promise.all([
    adminFetch<{ data: ProductSpecGroup[] }>(
      event, `/items/product_spec_groups?filter[product_id][_eq]=${id}&sort[]=sort&sort[]=id&limit=100`,
    ),
    adminFetch<{ data: ProductSpecItem[] }>(
      event,
      `/items/product_spec_items?filter[spec_group_id][product_id][_eq]=${id}&sort[]=sort&sort[]=id&limit=500`,
    ).catch(() => ({ data: [] as ProductSpecItem[] })),
  ])

  const groups = (groupsResult as { data: ProductSpecGroup[] }).data ?? []
  const items = (itemsResult as { data: ProductSpecItem[] }).data ?? []

  return groups.map(g => ({
    ...g,
    items: items.filter(i => i.spec_group_id === g.id),
  }))
})
