import { createError, getQuery, getRouterParam } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  await assertProductExists(event, Number(id))

  const { include_archived = 'false' } = getQuery(event)
  const showArchived = include_archived === 'true'

  const archivedFilter = showArchived ? '' : '&filter[archived][_eq]=false'

  const FIELDS = 'id,product_id,source_file_id,source_locator,fact_key,review_status,note,date_created,archived,archived_at'

  return adminFetch<{ data: unknown[] }>(
    event,
    `/items/product_source_records?filter[product_id][_eq]=${id}${archivedFilter}&fields=${FIELDS}&sort=-date_created`,
  )
})
