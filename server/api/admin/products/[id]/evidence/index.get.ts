import { createError, getRouterParam } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { parseSpecItemFactKey } from '~/server/utils/productEvidenceLinks'
import type { SourceReviewStatus } from '~/types/product-cms'

// Deep-fetch the linked file via dot-notation only — Directus then returns an
// object (or null), never a raw UUID string, so the file identifier can never
// leak into this response by accident. raw_excerpt, source_locator and note
// are deliberately never selected.
const FIELDS = [
  'id', 'product_id', 'fact_key', 'review_status', 'date_created', 'archived',
  'source_file_id.filename_download',
  'source_file_id.title',
  'source_file_id.type',
].join(',')

interface EvidenceRow {
  id: number
  product_id: number
  fact_key: string | null
  review_status: SourceReviewStatus | null
  date_created: string | null
  archived: boolean
  source_file_id: { filename_download: string | null; title: string | null; type: string | null } | null
}

interface SpecItemRow { id: number; label_en: string | null; spec_group_id: number }
interface SpecGroupRow { id: number; title_en: string | null }

/**
 * Safe, display-only shape for a Specifications evidence link. Never carries
 * source_file_id, fact_key, raw_excerpt, source_locator, note, or any other
 * product's data — only what this product's own spec items and already-
 * linked media already make safe to show.
 */
export interface EvidenceLinkSummary {
  id: number
  spec_item_id: number
  spec_item_label: string
  spec_group_title: string
  source_name: string
  source_type: string | null
  review_status: SourceReviewStatus | null
  archived: boolean
  date_created: string | null
}

export default defineEventHandler(async (event): Promise<EvidenceLinkSummary[]> => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  await assertProductExists(event, Number(id))

  const [recordsResult, itemsResult, groupsResult] = await Promise.all([
    adminFetch<{ data: EvidenceRow[] }>(
      event,
      `/items/product_source_records?filter[product_id][_eq]=${id}` +
      `&filter[fact_key][_starts_with]=spec_item:&fields=${FIELDS}&sort=-date_created&limit=500`,
    ),
    adminFetch<{ data: SpecItemRow[] }>(
      event,
      `/items/product_spec_items?filter[spec_group_id][product_id][_eq]=${id}&fields=id,label_en,spec_group_id&limit=500`,
    ),
    adminFetch<{ data: SpecGroupRow[] }>(
      event,
      `/items/product_spec_groups?filter[product_id][_eq]=${id}&fields=id,title_en&limit=100`,
    ),
  ])

  const rows = (recordsResult as { data: EvidenceRow[] }).data ?? []
  const items = (itemsResult as { data: SpecItemRow[] }).data ?? []
  const groups = (groupsResult as { data: SpecGroupRow[] }).data ?? []

  const itemById = new Map(items.map(i => [i.id, i]))
  const groupById = new Map(groups.map(g => [g.id, g]))

  const summaries: EvidenceLinkSummary[] = []
  for (const row of rows) {
    const specItemId = parseSpecItemFactKey(row.fact_key)
    if (specItemId === null) continue // not one of ours — defensive, ignore
    const item = itemById.get(specItemId)
    if (!item) continue // spec item no longer exists on this product — never surface a dangling id
    const group = groupById.get(item.spec_group_id)
    summaries.push({
      id: row.id,
      spec_item_id: specItemId,
      spec_item_label: item.label_en || `Parameter ${specItemId}`,
      spec_group_title: group?.title_en || 'Specifications',
      source_name: row.source_file_id?.title || row.source_file_id?.filename_download || 'Untitled source',
      source_type: row.source_file_id?.type ?? null,
      review_status: row.review_status,
      archived: row.archived,
      date_created: row.date_created,
    })
  }
  return summaries
})
