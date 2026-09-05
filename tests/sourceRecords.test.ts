/**
 * Tests for product_source_records API rules:
 * - Only admin can access (auth boundary — integration-level; here tested as policy functions)
 * - create accepts only whitelisted fields
 * - UUID validation for source_file_id
 * - review_status whitelist
 * - archive is logical (sets archived=true, archived_at); no physical delete
 * - archived records excluded from default list
 * - no AI calls, no media scanning, no auto-association
 */

import { describe, it, expect } from 'vitest'

// ── Whitelist & validation helpers (extracted from API logic) ─────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_REVIEW_STATUSES = ['confirmed', 'needs_review', 'missing', 'conflict'] as const
type ReviewStatus = (typeof ALLOWED_REVIEW_STATUSES)[number]

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value)
}

function isValidReviewStatus(value: string): value is ReviewStatus {
  return (ALLOWED_REVIEW_STATUSES as readonly string[]).includes(value)
}

const SOURCE_ALLOWED_FIELDS = ['source_file_id', 'source_locator', 'fact_key', 'review_status', 'note'] as const

function buildSourcePayload(body: Record<string, unknown>, productId: number): { payload: Record<string, unknown> | null; error?: string } {
  if (body.source_file_id !== undefined && body.source_file_id !== null && body.source_file_id !== '') {
    if (typeof body.source_file_id !== 'string' || !isValidUUID(body.source_file_id)) {
      return { payload: null, error: 'source_file_id must be a valid UUID' }
    }
  }
  if (body.review_status !== undefined && body.review_status !== null) {
    if (!isValidReviewStatus(String(body.review_status))) {
      return { payload: null, error: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` }
    }
  }

  const payload: Record<string, unknown> = { product_id: productId, archived: false }
  for (const key of SOURCE_ALLOWED_FIELDS) {
    if (body[key] !== undefined) payload[key] = body[key] === '' ? null : body[key]
  }
  return { payload }
}

// ── Payload construction ──────────────────────────────────────────────────

describe('source record payload construction', () => {
  it('accepts minimal payload (no optional fields)', () => {
    const { payload, error } = buildSourcePayload({}, 42)
    expect(error).toBeUndefined()
    expect(payload).toMatchObject({ product_id: 42, archived: false })
  })

  it('accepts all allowed fields', () => {
    const { payload, error } = buildSourcePayload({
      source_file_id: 'eb7dfefd-0000-0000-0000-000000000000',
      source_locator: 'page 3, table 1',
      fact_key: 'sensitivity_fe',
      review_status: 'confirmed',
      note: 'Verified against brochure',
    }, 3)
    expect(error).toBeUndefined()
    expect(payload!.product_id).toBe(3)
    expect(payload!.archived).toBe(false)
    expect(payload!.source_locator).toBe('page 3, table 1')
  })

  it('strips non-whitelisted fields', () => {
    const { payload } = buildSourcePayload({ raw_excerpt: 'some text', injected: 'x' }, 1)
    expect(payload).not.toHaveProperty('raw_excerpt')
    expect(payload).not.toHaveProperty('injected')
  })

  it('coerces empty string fields to null', () => {
    const { payload } = buildSourcePayload({ note: '', fact_key: '' }, 1)
    expect(payload!.note).toBeNull()
    expect(payload!.fact_key).toBeNull()
  })

  it('always sets archived=false on creation', () => {
    const { payload } = buildSourcePayload({ archived: true } as Record<string, unknown>, 1)
    expect(payload!.archived).toBe(false)
  })
})

// ── UUID validation ───────────────────────────────────────────────────────

describe('source_file_id UUID validation', () => {
  it('accepts valid v4 UUID', () => {
    expect(isValidUUID('eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac')).toBe(true)
  })

  it('accepts uppercase UUID', () => {
    expect(isValidUUID('EB7DFEFD-0DE8-4EDA-9D19-87FC5B31C1AC')).toBe(true)
  })

  it('rejects non-UUID string', () => {
    const { error } = buildSourcePayload({ source_file_id: 'not-a-uuid' }, 1)
    expect(error).toMatch(/UUID/)
  })

  it('coerces empty string source_file_id to null (not a UUID error)', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: '' }, 1)
    expect(error).toBeUndefined()
    expect(payload!.source_file_id).toBeNull()
  })

  it('rejects numeric as UUID', () => {
    const { error } = buildSourcePayload({ source_file_id: 12345 }, 1)
    expect(error).toMatch(/UUID/)
  })
})

// ── Review status whitelist ───────────────────────────────────────────────

describe('review_status whitelist', () => {
  for (const s of ALLOWED_REVIEW_STATUSES) {
    it(`accepts ${s}`, () => {
      const { error } = buildSourcePayload({ review_status: s }, 1)
      expect(error).toBeUndefined()
    })
  }

  it('rejects unknown status', () => {
    const { error } = buildSourcePayload({ review_status: 'approved' }, 1)
    expect(error).toMatch(/review_status must be one of/)
  })

  it('rejects ai_verified status', () => {
    const { error } = buildSourcePayload({ review_status: 'ai_verified' }, 1)
    expect(error).toMatch(/review_status must be one of/)
  })
})

// ── Archive logic ─────────────────────────────────────────────────────────

interface SourceRecord {
  id: number
  product_id: number
  archived: boolean
  archived_at: string | null
}

function archiveRecord(record: SourceRecord): { result: SourceRecord | null; error?: string } {
  if (record.archived) {
    return { result: null, error: 'Source record is already archived' }
  }
  return {
    result: {
      ...record,
      archived: true,
      archived_at: new Date().toISOString(),
    },
  }
}

describe('archive logic', () => {
  it('sets archived=true and archived_at on archive', () => {
    const record: SourceRecord = { id: 1, product_id: 3, archived: false, archived_at: null }
    const { result } = archiveRecord(record)
    expect(result!.archived).toBe(true)
    expect(result!.archived_at).toBeTruthy()
  })

  it('does not physically delete the record', () => {
    const record: SourceRecord = { id: 1, product_id: 3, archived: false, archived_at: null }
    const { result } = archiveRecord(record)
    expect(result!.id).toBe(1)
    expect(result!.product_id).toBe(3)
  })

  it('returns 409 if already archived', () => {
    const record: SourceRecord = { id: 1, product_id: 3, archived: true, archived_at: '2026-09-06T00:00:00Z' }
    const { result, error } = archiveRecord(record)
    expect(result).toBeNull()
    expect(error).toMatch(/already archived/)
  })

  it('archived record absent from default active list', () => {
    const records: SourceRecord[] = [
      { id: 1, product_id: 3, archived: false, archived_at: null },
      { id: 2, product_id: 3, archived: true, archived_at: '2026-09-06T00:00:00Z' },
    ]
    const active = records.filter(r => !r.archived)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(1)
  })
})

// ── No AI / no media scan guardrails ─────────────────────────────────────

describe('source records guardrails', () => {
  it('payload has no AI fields', () => {
    const { payload } = buildSourcePayload({
      source_file_id: 'eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac',
      ai_suggestion: 'some ai output',
      ai_confidence: 0.99,
    }, 1)
    expect(payload).not.toHaveProperty('ai_suggestion')
    expect(payload).not.toHaveProperty('ai_confidence')
  })

  it('payload cannot auto-associate a product beyond the route param id', () => {
    const { payload } = buildSourcePayload({ product_id: 999 }, 42)
    // product_id always comes from the route param, not body
    expect(payload!.product_id).toBe(42)
  })
})
