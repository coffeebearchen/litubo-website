// Specification evidence links reuse the existing product_source_records
// collection (PWS-07). A link is a normal source record whose fact_key is a
// server-generated, deterministic reference to a spec item this product
// already owns — never a client-submitted table/field/target reference.

import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'

export const EVIDENCE_FACT_KEY_PREFIX = 'spec_item:'

export const ALLOWED_REVIEW_STATUSES = ['confirmed', 'needs_review', 'missing', 'conflict'] as const
export type EvidenceReviewStatus = (typeof ALLOWED_REVIEW_STATUSES)[number]

export function isValidReviewStatus(value: unknown): value is EvidenceReviewStatus {
  return typeof value === 'string' && (ALLOWED_REVIEW_STATUSES as readonly string[]).includes(value)
}

export function buildSpecItemFactKey(specItemId: number): string {
  return `${EVIDENCE_FACT_KEY_PREFIX}${specItemId}`
}

/** Returns the spec item id encoded in a fact_key, or null if it isn't one of ours. */
export function parseSpecItemFactKey(factKey: string | null | undefined): number | null {
  if (!factKey || !factKey.startsWith(EVIDENCE_FACT_KEY_PREFIX)) return null
  const raw = factKey.slice(EVIDENCE_FACT_KEY_PREFIX.length)
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 404s (never leaks a cross-product id) unless the spec item belongs to this product. */
export async function assertSpecItemBelongsToProduct(
  productId: number,
  specItemId: number,
  fetch: FetchFn,
): Promise<void> {
  const res = await fetch<{ data: { id: number }[] }>(
    `/items/product_spec_items?filter[id][_eq]=${specItemId}` +
    `&filter[spec_group_id][product_id][_eq]=${productId}&fields=id&limit=1`,
  )
  if ((res.data ?? []).length === 0) {
    throw createError({ statusCode: 404, message: `Specification item ${specItemId} not found for this product` })
  }
}

/** The source file must already be an explicit products_files association of this product. */
export async function assertSourceFileLinkedToProduct(
  productId: number,
  fileUuid: string,
  fetch: FetchFn,
): Promise<void> {
  const res = await fetch<{ data: { id: number }[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}` +
    `&filter[directus_files_id][_eq]=${fileUuid}&fields=id&limit=1`,
  )
  if ((res.data ?? []).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'The source file must already be linked to this product in Media & Resources',
    })
  }
}

/** Refuses a second active evidence link for the same product + spec item + source file. */
export async function assertNoDuplicateEvidenceLink(
  productId: number,
  factKey: string,
  fileUuid: string,
  fetch: FetchFn,
): Promise<void> {
  const res = await fetch<{ data: { id: number }[] }>(
    `/items/product_source_records?filter[product_id][_eq]=${productId}` +
    `&filter[fact_key][_eq]=${encodeURIComponent(factKey)}` +
    `&filter[source_file_id][_eq]=${fileUuid}&filter[archived][_eq]=false&fields=id&limit=1`,
  )
  if ((res.data ?? []).length > 0) {
    throw createError({ statusCode: 409, message: 'This source is already linked as evidence for this specification item' })
  }
}

// ── Audit-trail interpretation (pure — no fetch, real Directus data in/out) ──
//
// The audit trail itself is never written by our own code: it is Directus's
// own directus_activity/directus_revisions system collections, produced as a
// side effect of the single product_source_records write that created or
// changed the link. This module only interprets already-fetched revisions
// into a safe, per-link timeline — it never selects or forwards fact_key,
// source_file_id, raw_excerpt, source_locator or note.

export interface EvidenceSourceRecordRef {
  id: number
  fact_key: string | null
}

export interface EvidenceRevisionActivity {
  action: string
  timestamp: string
  user: { email: string; first_name: string | null; last_name: string | null } | null
}

export interface EvidenceRevision {
  id: number
  item: string
  data: { review_status?: string | null; archived?: boolean } | null
  activity: EvidenceRevisionActivity | null
}

export type EvidenceAuditAction = 'linked' | 'status_changed' | 'archived' | 'updated'

export interface EvidenceAuditEntry {
  id: number
  evidence_link_id: number
  spec_item_id: number
  action: EvidenceAuditAction
  at: string
  actor: string
  from_status: string | null
  to_status: string | null
}

function evidenceActorLabel(user: EvidenceRevisionActivity['user']): string {
  if (!user) return 'Unknown'
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return name || user.email
}

/**
 * Folds a product's product_source_records rows (scoped to this product's
 * own spec-item evidence links) and their Directus revisions into a
 * chronological, per-link audit trail. Rows whose fact_key does not encode
 * one of this product's own spec items are silently skipped — never
 * surfaced as a dangling or cross-product reference.
 */
export function computeEvidenceAuditEntries(
  records: EvidenceSourceRecordRef[],
  revisions: EvidenceRevision[],
): EvidenceAuditEntry[] {
  const specItemByRecordId = new Map<number, number>()
  for (const r of records) {
    const specItemId = parseSpecItemFactKey(r.fact_key)
    if (specItemId !== null) specItemByRecordId.set(r.id, specItemId)
  }
  if (specItemByRecordId.size === 0) return []

  const byItem = new Map<string, EvidenceRevision[]>()
  for (const rev of revisions) {
    const list = byItem.get(rev.item) ?? []
    list.push(rev)
    byItem.set(rev.item, list)
  }

  const entries: EvidenceAuditEntry[] = []
  for (const [itemIdStr, revList] of byItem) {
    const recordId = Number(itemIdStr)
    const specItemId = specItemByRecordId.get(recordId)
    if (specItemId === undefined) continue // not one of this product's own evidence links

    let prevStatus: string | null = null
    let prevArchived = false
    for (const rev of revList) {
      const action = rev.activity?.action
      const actor = evidenceActorLabel(rev.activity?.user ?? null)
      const at = rev.activity?.timestamp ?? ''
      const newStatus: string | null = rev.data?.review_status ?? prevStatus
      const newArchived: boolean = rev.data?.archived ?? prevArchived

      let entryAction: EvidenceAuditAction
      if (action === 'create') {
        entryAction = 'linked'
      } else if (newArchived && !prevArchived) {
        entryAction = 'archived'
      } else if (newStatus !== prevStatus) {
        entryAction = 'status_changed'
      } else {
        entryAction = 'updated'
      }

      entries.push({
        id: rev.id,
        evidence_link_id: recordId,
        spec_item_id: specItemId,
        action: entryAction,
        at,
        actor,
        from_status: entryAction === 'linked' ? null : prevStatus,
        to_status: newStatus,
      })

      prevStatus = newStatus
      prevArchived = newArchived
    }
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : -1))
  return entries
}
