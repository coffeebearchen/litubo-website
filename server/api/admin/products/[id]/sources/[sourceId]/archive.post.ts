import { createError, getRouterParam } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sourceId = getRouterParam(event, 'sourceId')

  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  if (!sourceId || isNaN(Number(sourceId))) throw createError({ statusCode: 400, message: 'Invalid source record id' })

  await assertProductExists(event, Number(id))

  // Verify source record belongs to this product
  const existing = await adminFetch<{ data: { id: number; product_id: number; archived: boolean }[] }>(
    event,
    `/items/product_source_records?filter[id][_eq]=${sourceId}&filter[product_id][_eq]=${id}&fields=id,product_id,archived&limit=1`,
  )
  const rows = (existing as { data: { id: number; product_id: number; archived: boolean }[] }).data
  if (!Array.isArray(rows) || rows.length === 0) {
    throw createError({ statusCode: 404, message: `Source record ${sourceId} not found for product ${id}` })
  }
  if (rows[0].archived) {
    throw createError({ statusCode: 409, message: 'Source record is already archived' })
  }

  const result = await adminFetch<{ data: unknown }>(event, `/items/product_source_records/${sourceId}`, {
    method: 'PATCH',
    body: {
      archived: true,
      archived_at: new Date().toISOString(),
    },
  })

  return (result as { data: unknown }).data
})
