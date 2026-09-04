// Media lifecycle utility — dependency-injected for testability

export interface FileReference {
  product_id: number
  product_name: string
  file_role: string
}

export interface ReferencesResult {
  product_count: number
  section_count: number
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
  file_role: string
  products_id: { id: number; name: string } | null
}

async function queryProductsFiles(fileUuid: string, fetch: FetchFn): Promise<JunctionRow[]> {
  const res = await fetch<{ data: JunctionRow[] }>(
    `/items/products_files?filter[directus_files_id][_eq]=${fileUuid}` +
    `&fields=id,file_role,products_id.id,products_id.name&limit=500`,
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

export async function getFileReferences(fileUuid: string, fetch: FetchFn): Promise<ReferencesResult> {
  const junctionRows = await queryProductsFiles(fileUuid, fetch)
  const sectionCount = await querySectionCount(junctionRows.map(r => r.id), fetch)

  const seenProducts = new Set<number>()
  const references: FileReference[] = []

  for (const row of junctionRows) {
    if (!row.products_id) continue
    seenProducts.add(row.products_id.id)
    references.push({
      product_id: row.products_id.id,
      product_name: row.products_id.name ?? String(row.products_id.id),
      file_role: row.file_role,
    })
  }

  const total = junctionRows.length + sectionCount
  return {
    product_count: seenProducts.size,
    section_count: sectionCount,
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
