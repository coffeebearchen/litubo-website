// Media lifecycle utility — dependency-injected for testability

export interface FileReference {
  product_id: number
  product_name: string
  /** Nullable in the junction — a file can be attached to a product without a declared role. */
  file_role: string | null
}

export interface ReferencesResult {
  product_count: number
  section_count: number
  source_count: number
  other_count: number
  total: number
  can_archive: boolean
  references: FileReference[]
}

export interface LifecycleRecord {
  id: string
  archived: boolean
  archived_at: string | null
  restored_at?: string | null
}

export type FetchFn = <T>(path: string, options?: Record<string, unknown>) => Promise<T>

interface JunctionRow {
  id: number
  file_role: string | null
  products_id: { id: number; name_en: string | null } | null
}

/**
 * ML-CLOUD-02 — the product name field is `name_en`, not `name`.
 *
 * `products` has never had a bare `name` column; it carries `name_en` /
 * `name_es` / `name_pt`. Directus answers a request for a field that does not
 * exist with 403 Forbidden, the same status it uses for a field you may not
 * read, so this looked for a long time like a `products_files` permission
 * problem and was carried as a blocked P1 on that basis. It was our own query.
 * Nothing about Directus permissions, roles or schema was changed to fix it.
 */
async function queryProductsFiles(fileUuid: string, fetch: FetchFn): Promise<JunctionRow[]> {
  const res = await fetch<{ data: JunctionRow[] }>(
    `/items/products_files?filter[directus_files_id][_eq]=${fileUuid}` +
    `&fields=id,file_role,products_id.id,products_id.name_en&limit=500`,
  )
  return res.data ?? []
}

async function querySectionCount(junctionIds: number[], fetch: FetchFn): Promise<number> {
  if (junctionIds.length === 0) return 0
  const idList = junctionIds.join(',')
  const res = await fetch<{ data: { id: number }[]; meta?: { filter_count?: number } }>(
    `/items/product_sections?filter[media_id][_in]=${idList}&fields=id&limit=500&meta=filter_count`,
  )
  return res.meta?.filter_count ?? res.data?.length ?? 0
}

interface SourceRecordRow {
  id: number
  product_id: { id: number; name_en: string | null } | null
}

// A file cited as evidence in an active (non-archived) source record is still
// referenced even if it was never added as a products_files media association —
// PWS-07-DOR-01/02A found this collection missing from the reference check.
async function querySourceRecords(fileUuid: string, fetch: FetchFn): Promise<SourceRecordRow[]> {
  const res = await fetch<{ data: SourceRecordRow[] }>(
    `/items/product_source_records?filter[source_file_id][_eq]=${fileUuid}` +
    `&filter[archived][_eq]=false&fields=id,product_id.id,product_id.name_en&limit=500`,
  )
  return res.data ?? []
}

export async function getFileReferences(fileUuid: string, fetch: FetchFn): Promise<ReferencesResult> {
  const junctionRows = await queryProductsFiles(fileUuid, fetch)
  const sectionCount = await querySectionCount(junctionRows.map(r => r.id), fetch)
  const sourceRows = await querySourceRecords(fileUuid, fetch)

  const seenProducts = new Set<number>()
  const references: FileReference[] = []

  for (const row of junctionRows) {
    if (!row.products_id) continue
    seenProducts.add(row.products_id.id)
    references.push({
      product_id: row.products_id.id,
      product_name: row.products_id.name_en ?? String(row.products_id.id),
      file_role: row.file_role,
    })
  }

  for (const row of sourceRows) {
    if (!row.product_id) continue
    seenProducts.add(row.product_id.id)
    references.push({
      product_id: row.product_id.id,
      product_name: row.product_id.name_en ?? String(row.product_id.id),
      file_role: 'source_evidence',
    })
  }

  const sourceCount = sourceRows.length
  const total = junctionRows.length + sectionCount + sourceCount
  return {
    product_count: seenProducts.size,
    section_count: sectionCount,
    source_count: sourceCount,
    other_count: 0,
    total,
    can_archive: total === 0,
    references,
  }
}

export async function getLifecycleRecord(fileUuid: string, fetch: FetchFn): Promise<LifecycleRecord | null> {
  const res = await fetch<{ data: LifecycleRecord[] }>(
    `/items/media_file_lifecycle?filter[file_id][_eq]=${fileUuid}&fields=id,archived,archived_at,restored_at&limit=1`,
  )
  return res.data?.[0] ?? null
}

export async function createOrUpdateLifecycleArchive(
  fileUuid: string,
  archivedBy: string,
  existing: LifecycleRecord | null,
  fetch: FetchFn,
): Promise<string> {
  const now = new Date().toISOString()

  if (existing) {
    await fetch(`/items/media_file_lifecycle/${existing.id}`, {
      method: 'PATCH',
      body: { archived: true, archived_at: now, archived_by: archivedBy, restored_at: null, restored_by: null },
    })
  } else {
    await fetch('/items/media_file_lifecycle', {
      method: 'POST',
      body: { file_id: fileUuid, archived: true, archived_at: now, archived_by: archivedBy },
    })
  }
  return now
}

export async function restoreLifecycleRecord(
  record: LifecycleRecord,
  restoredBy: string,
  fetch: FetchFn,
): Promise<string> {
  const now = new Date().toISOString()
  await fetch(`/items/media_file_lifecycle/${record.id}`, {
    method: 'PATCH',
    body: { archived: false, restored_at: now, restored_by: restoredBy },
  })
  return now
}

const FILE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * MEDIA-AI-LINK-PICKER-01-R1 — every file currently archived, by id.
 *
 * The same rule `lifecycle.get.ts` and `getLifecycleRecord()` read:
 * `media_file_lifecycle.archived = true`. Restoring flips that flag back, so
 * this is the whole of "archived" — there is no second archive state.
 *
 * `limit=-1` because excluding only the first page of archived files would
 * quietly offer the rest. An entry that is not a UUID cannot be a file id, and
 * is dropped rather than spliced into a Directus filter.
 */
export async function listArchivedFileIds(fetch: FetchFn): Promise<string[]> {
  const res = await fetch<{ data: Array<{ file_id: string | null }> }>(
    '/items/media_file_lifecycle?filter[archived][_eq]=true&fields=file_id&limit=-1',
  )
  return (res.data ?? []).map(r => r.file_id ?? '').filter(id => FILE_UUID_RE.test(id))
}
