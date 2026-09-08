import type { FetchFn } from './mediaLifecycle'

/**
 * PWS-AI-ENGINE-01R — the single canonical, server-side Specifications
 * writer. Both the existing Specifications editor endpoints
 * (`server/api/admin/products/[id]/specs/**`) and the AI-assisted Apply
 * endpoint (`.../ai/specification-proposal/apply.post.ts`) call these same
 * functions to reach `product_spec_groups`/`product_spec_items` — there is
 * no longer a second, AI-only write path that duplicates this logic.
 * Dependency-injected (`FetchFn`), matching the established convention in
 * `mediaLifecycle.ts`/`aiProposalEngine.ts`, so every function here is
 * unit-testable with a mock Directus fetch.
 */

export interface SpecGroupSummary {
  id: number
  title_en: string | null
}

export interface SpecItemOwnership {
  id: number
  specGroupId: number
  productId: number
  valueEn: string | null
  noteEn: string | null
}

export async function listSpecGroupsForProduct(fetch: FetchFn, productId: number): Promise<SpecGroupSummary[]> {
  const result = await fetch<{ data: SpecGroupSummary[] }>(
    `/items/product_spec_groups?filter[product_id][_eq]=${productId}&fields=id,title_en&limit=200`,
  )
  return result.data ?? []
}

/** Returns `null` if the item does not exist at all — callers must separately check `productId` ownership. */
export async function getSpecItemOwnership(fetch: FetchFn, itemId: number): Promise<SpecItemOwnership | null> {
  const result = await fetch<{
    data: {
      id: number
      value_en: string | null
      note_en: string | null
      spec_group_id: { id: number, product_id: number } | null
    } | null
  }>(`/items/product_spec_items/${itemId}?fields=id,value_en,note_en,spec_group_id.id,spec_group_id.product_id`)
  const item = result.data
  if (!item || !item.spec_group_id) return null
  return {
    id: item.id,
    specGroupId: item.spec_group_id.id,
    productId: item.spec_group_id.product_id,
    valueEn: item.value_en,
    noteEn: item.note_en,
  }
}

export interface CreateSpecGroupPayload {
  product_id: number
  title_en: string
  title_es?: string | null
  title_pt?: string | null
  description_en?: string | null
  enabled?: boolean
  sort?: number | null
}

export async function createSpecGroup(fetch: FetchFn, payload: CreateSpecGroupPayload): Promise<number> {
  const result = await fetch<{ data: { id: number } }>('/items/product_spec_groups', {
    method: 'POST',
    body: {
      title_es: null,
      title_pt: null,
      description_en: null,
      enabled: true,
      sort: null,
      ...payload,
    },
  })
  return result.data.id
}

export async function deleteSpecGroup(fetch: FetchFn, groupId: number): Promise<void> {
  await fetch(`/items/product_spec_groups/${groupId}`, { method: 'DELETE' })
}

export interface CreateSpecItemPayload {
  spec_group_id: number
  label_en: string | null
  label_es?: string | null
  label_pt?: string | null
  value_en: string | null
  value_es?: string | null
  value_pt?: string | null
  note_en?: string | null
  note_es?: string | null
  note_pt?: string | null
  sort?: number | null
  enabled?: boolean
}

export async function createSpecItem(fetch: FetchFn, payload: CreateSpecItemPayload): Promise<number> {
  const result = await fetch<{ data: { id: number } }>('/items/product_spec_items', {
    method: 'POST',
    body: {
      label_es: null,
      label_pt: null,
      value_es: null,
      value_pt: null,
      note_es: null,
      note_pt: null,
      sort: null,
      enabled: true,
      ...payload,
    },
  })
  return result.data.id
}

export async function updateSpecItem(fetch: FetchFn, itemId: number, payload: Record<string, unknown>): Promise<void> {
  await fetch(`/items/product_spec_items/${itemId}`, { method: 'PATCH', body: payload })
}

export async function deleteSpecItem(fetch: FetchFn, itemId: number): Promise<void> {
  await fetch(`/items/product_spec_items/${itemId}`, { method: 'DELETE' })
}

/** Case/whitespace-insensitive match, used both to detect "Review required" duplicates and to reuse an existing group by name rather than creating a near-duplicate. */
export function normalizeSpecName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}
