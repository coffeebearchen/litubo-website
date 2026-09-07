import { createError, getQuery, getRouterParam } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

// Deep-fetch the linked file via dot-notation only, never the bare `source_file_id`
// field — this guarantees Directus returns an object (or null), never a raw UUID
// string, so the file identifier can never leak into this response by accident.
const FIELDS = [
  'id', 'product_id', 'fact_key', 'review_status', 'date_created', 'archived',
  'source_file_id.filename_download',
  'source_file_id.title',
  'source_file_id.type',
].join(',')

interface SourceRecordRow {
  id: number
  product_id: number
  fact_key: string | null
  review_status: string | null
  date_created: string | null
  archived: boolean
  source_file_id: { filename_download: string | null; title: string | null; type: string | null } | null
}

/**
 * Sanitized, display-only shape for the read-only Sources & Evidence page
 * (PWS-07-FAST-01R). Deliberately excludes `source_locator`, `raw_excerpt`,
 * `note` and the file UUID — none of these may leave the server for this
 * restricted-but-still-internal listing.
 */
export interface SourceRecordSummary {
  id: number
  product_id: number
  source_name: string
  source_type: string | null
  fact_key: string | null
  review_status: string | null
  date_created: string | null
  archived: boolean
}

export default defineEventHandler(async (event): Promise<SourceRecordSummary[]> => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })

  await assertProductExists(event, Number(id))

  const { include_archived = 'false' } = getQuery(event)
  const showArchived = include_archived === 'true'

  const archivedFilter = showArchived ? '' : '&filter[archived][_eq]=false'

  const result = await adminFetch<{ data: SourceRecordRow[] }>(
    event,
    `/items/product_source_records?filter[product_id][_eq]=${id}${archivedFilter}&fields=${FIELDS}&sort=-date_created`,
  )

  const rows = (result as { data: SourceRecordRow[] }).data ?? []

  return rows.map(row => ({
    id: row.id,
    product_id: row.product_id,
    source_name: row.source_file_id?.title || row.source_file_id?.filename_download || 'Untitled source',
    source_type: row.source_file_id?.type ?? null,
    fact_key: row.fact_key,
    review_status: row.review_status,
    date_created: row.date_created,
    archived: row.archived,
  }))
})
