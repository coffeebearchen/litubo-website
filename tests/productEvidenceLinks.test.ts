import { describe, it, expect, vi } from 'vitest'
import {
  EVIDENCE_FACT_KEY_PREFIX,
  ALLOWED_REVIEW_STATUSES,
  isValidReviewStatus,
  buildSpecItemFactKey,
  parseSpecItemFactKey,
  assertSpecItemBelongsToProduct,
  assertSourceFileLinkedToProduct,
  assertNoDuplicateEvidenceLink,
  computeEvidenceAuditEntries,
  type EvidenceRevision,
} from '../server/utils/productEvidenceLinks'

const PRODUCT_ID = 3
const OTHER_PRODUCT_ID = 99
const SPEC_ITEM_ID = 42
const FILE_UUID = '33333333-3333-3333-3333-333333333333'

describe('fact_key convention (server-generated, never client-supplied)', () => {
  it('builds a deterministic fact_key from a spec item id', () => {
    expect(buildSpecItemFactKey(SPEC_ITEM_ID)).toBe(`${EVIDENCE_FACT_KEY_PREFIX}${SPEC_ITEM_ID}`)
    expect(buildSpecItemFactKey(SPEC_ITEM_ID)).toBe('spec_item:42')
  })

  it('parses a well-formed fact_key back to its spec item id', () => {
    expect(parseSpecItemFactKey('spec_item:42')).toBe(42)
  })

  it('returns null for anything that is not one of our evidence fact_keys', () => {
    expect(parseSpecItemFactKey(null)).toBeNull()
    expect(parseSpecItemFactKey(undefined)).toBeNull()
    expect(parseSpecItemFactKey('')).toBeNull()
    expect(parseSpecItemFactKey('some_other_fact')).toBeNull()
    expect(parseSpecItemFactKey('spec_item:not-a-number')).toBeNull()
    expect(parseSpecItemFactKey('spec_item:-1')).toBeNull()
    expect(parseSpecItemFactKey('spec_item:0')).toBeNull()
  })

  it('round-trips build → parse', () => {
    expect(parseSpecItemFactKey(buildSpecItemFactKey(7))).toBe(7)
  })
})

describe('isValidReviewStatus (reuses the existing, unchanged enum)', () => {
  it('accepts exactly the four already-approved values', () => {
    for (const s of ALLOWED_REVIEW_STATUSES) expect(isValidReviewStatus(s)).toBe(true)
    expect(ALLOWED_REVIEW_STATUSES).toEqual(['confirmed', 'needs_review', 'missing', 'conflict'])
  })

  it('rejects anything else, including a client-invented status', () => {
    expect(isValidReviewStatus('approved')).toBe(false)
    expect(isValidReviewStatus('')).toBe(false)
    expect(isValidReviewStatus(null)).toBe(false)
    expect(isValidReviewStatus(undefined)).toBe(false)
    expect(isValidReviewStatus(123)).toBe(false)
  })
})

describe('assertSpecItemBelongsToProduct (cross-product spec items are rejected)', () => {
  it('resolves when the spec item belongs to this product', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [{ id: SPEC_ITEM_ID }] })
    await expect(assertSpecItemBelongsToProduct(PRODUCT_ID, SPEC_ITEM_ID, fetch)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`filter[id][_eq]=${SPEC_ITEM_ID}`))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`filter[spec_group_id][product_id][_eq]=${PRODUCT_ID}`))
  })

  it('throws 404 (never a cross-product leak) when the spec item belongs to a different product', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await expect(assertSpecItemBelongsToProduct(OTHER_PRODUCT_ID, SPEC_ITEM_ID, fetch))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('assertSourceFileLinkedToProduct (source must already be in this product\'s Media & Resources)', () => {
  it('resolves when the file is already linked via products_files', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [{ id: 1 }] })
    await expect(assertSourceFileLinkedToProduct(PRODUCT_ID, FILE_UUID, fetch)).resolves.toBeUndefined()
  })

  it('throws 400 when the file has never been linked to this product', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await expect(assertSourceFileLinkedToProduct(PRODUCT_ID, FILE_UUID, fetch))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('scopes the check to this exact product id, never a global file lookup', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await assertSourceFileLinkedToProduct(PRODUCT_ID, FILE_UUID, fetch).catch(() => {})
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`filter[products_id][_eq]=${PRODUCT_ID}`))
  })
})

describe('assertNoDuplicateEvidenceLink (server-side duplicate guard — the direct-repeat-POST case)', () => {
  const factKey = buildSpecItemFactKey(SPEC_ITEM_ID)

  it('resolves when no active link exists yet', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await expect(assertNoDuplicateEvidenceLink(PRODUCT_ID, factKey, FILE_UUID, fetch)).resolves.toBeUndefined()
  })

  it('throws 409 when the same product + spec item + source is already linked and active', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [{ id: 5 }] })
    await expect(assertNoDuplicateEvidenceLink(PRODUCT_ID, factKey, FILE_UUID, fetch))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('never lets a second call through even when called twice in a row (simulated repeat POST)', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 5 }] })
    await expect(assertNoDuplicateEvidenceLink(PRODUCT_ID, factKey, FILE_UUID, fetch)).resolves.toBeUndefined()
    await expect(assertNoDuplicateEvidenceLink(PRODUCT_ID, factKey, FILE_UUID, fetch)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('only checks non-archived rows, so re-linking after a real archive is allowed', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await assertNoDuplicateEvidenceLink(PRODUCT_ID, factKey, FILE_UUID, fetch)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('filter[archived][_eq]=false'))
  })
})

// ── computeEvidenceAuditEntries — the append-only audit interpretation ──────
//
// This is pure interpretation of already-fetched Directus revisions; it never
// fetches or writes anything itself. The audit rows it consumes here stand in
// for what Directus's own directus_activity/directus_revisions produced as a
// side effect of the real product_source_records writes.

function activity(action: string, timestamp: string, email = 'reviewer@litubo.com', first = 'Jane', last = 'Reviewer') {
  return { action, timestamp, user: { email, first_name: first, last_name: last } }
}

describe('computeEvidenceAuditEntries', () => {
  const RECORD_ID = 11
  const SPEC_ITEM_ID = 42

  it('returns an empty timeline when there are no evidence records', () => {
    expect(computeEvidenceAuditEntries([], [])).toEqual([])
  })

  it('a single create revision becomes one "linked" entry with no from_status', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'needs_review', archived: false }, activity: activity('create', '2026-01-01T00:00:00Z') },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      evidence_link_id: RECORD_ID,
      spec_item_id: SPEC_ITEM_ID,
      action: 'linked',
      from_status: null,
      to_status: 'needs_review',
      actor: 'Jane Reviewer',
    })
  })

  it('a later review_status update becomes a "status_changed" entry with correct from/to', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'needs_review', archived: false }, activity: activity('create', '2026-01-01T00:00:00Z') },
      { id: 101, item: String(RECORD_ID), data: { review_status: 'confirmed' }, activity: activity('update', '2026-01-02T00:00:00Z') },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    expect(entries).toHaveLength(2)
    const statusChange = entries.find(e => e.id === 101)
    expect(statusChange).toMatchObject({ action: 'status_changed', from_status: 'needs_review', to_status: 'confirmed' })
  })

  it('an archive update becomes an "archived" entry, taking precedence over a simultaneous status field', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'confirmed', archived: false }, activity: activity('create', '2026-01-01T00:00:00Z') },
      { id: 102, item: String(RECORD_ID), data: { archived: true }, activity: activity('update', '2026-01-03T00:00:00Z') },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    const archiveEntry = entries.find(e => e.id === 102)
    expect(archiveEntry?.action).toBe('archived')
  })

  it('never fabricates an actor — falls back to email when no name is set, and "Unknown" when there is no user at all', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'needs_review' }, activity: { action: 'create', timestamp: 't', user: { email: 'a@b.com', first_name: null, last_name: null } } },
      { id: 101, item: String(RECORD_ID), data: { review_status: 'confirmed' }, activity: { action: 'update', timestamp: 't2', user: null } },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    expect(entries.find(e => e.id === 100)?.actor).toBe('a@b.com')
    expect(entries.find(e => e.id === 101)?.actor).toBe('Unknown')
  })

  it('skips revisions for source records that are not this product\'s own spec-item evidence links', () => {
    const records = [{ id: 999, fact_key: 'some_other_fact' }] // not a spec_item: fact_key
    const revisions: EvidenceRevision[] = [
      { id: 100, item: '999', data: { review_status: 'needs_review' }, activity: activity('create', '2026-01-01T00:00:00Z') },
    ]
    expect(computeEvidenceAuditEntries(records, revisions)).toEqual([])
  })

  it('sorts newest first', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'needs_review' }, activity: activity('create', '2026-01-01T00:00:00Z') },
      { id: 101, item: String(RECORD_ID), data: { review_status: 'confirmed' }, activity: activity('update', '2026-01-05T00:00:00Z') },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    expect(entries[0].id).toBe(101)
    expect(entries[1].id).toBe(100)
  })

  it('never carries fact_key, source_file_id, raw_excerpt or note on any entry', () => {
    const records = [{ id: RECORD_ID, fact_key: 'spec_item:42' }]
    const revisions: EvidenceRevision[] = [
      { id: 100, item: String(RECORD_ID), data: { review_status: 'needs_review' }, activity: activity('create', '2026-01-01T00:00:00Z') },
    ]
    const entries = computeEvidenceAuditEntries(records, revisions)
    for (const entry of entries) {
      expect(entry).not.toHaveProperty('fact_key')
      expect(entry).not.toHaveProperty('source_file_id')
      expect(entry).not.toHaveProperty('raw_excerpt')
      expect(entry).not.toHaveProperty('note')
    }
  })
})
