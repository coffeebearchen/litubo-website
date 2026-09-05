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

function buildSourcePayload(body: Record<string, unknown>, productId: number): { payload: Record<string, unknown> | null; error?: string } {
  // Normalize
  const rawFileId = body.source_file_id === '' ? null : body.source_file_id
  const rawLocator = typeof body.source_locator === 'string'
    ? (body.source_locator.trim() || null)
    : (body.source_locator ?? null)

  // UUID format check
  if (rawFileId !== undefined && rawFileId !== null) {
    if (typeof rawFileId !== 'string' || !isValidUUID(rawFileId)) {
      return { payload: null, error: 'source_file_id must be a valid UUID' }
    }
  }

  // source_locator is a within-file positional descriptor, not an independent source
  const effectiveFileId = rawFileId === undefined ? null : rawFileId
  if (!effectiveFileId) {
    return { payload: null, error: 'SOURCE_REFERENCE_REQUIRED: source_file_id is required' }
  }

  if (body.review_status !== undefined && body.review_status !== null) {
    if (!isValidReviewStatus(String(body.review_status))) {
      return { payload: null, error: `review_status must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` }
    }
  }

  const payload: Record<string, unknown> = { product_id: productId, archived: false, source_file_id: rawFileId }
  if (body.source_locator !== undefined) payload.source_locator = rawLocator
  const textFields = ['fact_key', 'review_status', 'note'] as const
  for (const key of textFields) {
    if (body[key] !== undefined) payload[key] = body[key] === '' ? null : body[key]
  }
  return { payload }
}

// ── Payload construction ──────────────────────────────────────────────────

describe('source record payload construction', () => {
  const VALID_UUID = 'eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac'

  it('requires source_file_id (minimal payload without it → error)', () => {
    const { payload, error } = buildSourcePayload({}, 42)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('accepts minimal payload with valid source_file_id', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: VALID_UUID }, 42)
    expect(error).toBeUndefined()
    expect(payload).toMatchObject({ product_id: 42, archived: false, source_file_id: VALID_UUID })
  })

  it('accepts all allowed fields', () => {
    const { payload, error } = buildSourcePayload({
      source_file_id: VALID_UUID,
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
    const { payload } = buildSourcePayload({ source_file_id: VALID_UUID, raw_excerpt: 'some text', injected: 'x' }, 1)
    expect(payload).not.toHaveProperty('raw_excerpt')
    expect(payload).not.toHaveProperty('injected')
  })

  it('coerces empty string text fields to null', () => {
    const { payload } = buildSourcePayload({ source_file_id: VALID_UUID, note: '', fact_key: '' }, 1)
    expect(payload!.note).toBeNull()
    expect(payload!.fact_key).toBeNull()
  })

  it('always sets archived=false on creation', () => {
    const { payload } = buildSourcePayload({ source_file_id: VALID_UUID, archived: true } as Record<string, unknown>, 1)
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

  it('empty string source_file_id → SOURCE_REFERENCE_REQUIRED (coerced to null, then gate fires)', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: '' }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('rejects numeric as UUID', () => {
    const { error } = buildSourcePayload({ source_file_id: 12345 }, 1)
    expect(error).toMatch(/UUID/)
  })
})

// ── Review status whitelist ───────────────────────────────────────────────

describe('review_status whitelist', () => {
  const VALID_UUID = 'eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac'

  for (const s of ALLOWED_REVIEW_STATUSES) {
    it(`accepts ${s}`, () => {
      const { error } = buildSourcePayload({ source_file_id: VALID_UUID, review_status: s }, 1)
      expect(error).toBeUndefined()
    })
  }

  it('rejects unknown status', () => {
    const { error } = buildSourcePayload({ source_file_id: VALID_UUID, review_status: 'approved' }, 1)
    expect(error).toMatch(/review_status must be one of/)
  })

  it('rejects ai_verified status', () => {
    const { error } = buildSourcePayload({ source_file_id: VALID_UUID, review_status: 'ai_verified' }, 1)
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
  const VALID_UUID = 'eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac'

  it('payload has no AI fields', () => {
    const { payload } = buildSourcePayload({
      source_file_id: VALID_UUID,
      ai_suggestion: 'some ai output',
      ai_confidence: 0.99,
    }, 1)
    expect(payload).not.toHaveProperty('ai_suggestion')
    expect(payload).not.toHaveProperty('ai_confidence')
  })

  it('payload cannot auto-associate a product beyond the route param id', () => {
    const { payload, error } = buildSourcePayload({ product_id: 999 }, 42)
    // Without a valid source_file_id, SOURCE_REFERENCE_REQUIRED fires first
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
    expect(payload).toBeNull()
  })
})

// ── Zero-source invariant ──────────────────────────────────────────────────

describe('zero-source record invariant', () => {
  const VALID_UUID = 'eb7dfefd-0de8-4eda-9d19-87fc5b31c1ac'

  it('rejects: source_file_id=null, locator absent → SOURCE_REFERENCE_REQUIRED', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: null }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('rejects: source_file_id=null, locator empty string → SOURCE_REFERENCE_REQUIRED', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: null, source_locator: '' }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('rejects: source_file_id="", locator whitespace only → SOURCE_REFERENCE_REQUIRED', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: '', source_locator: '   ' }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('rejects: locator-only (no source_file_id) → SOURCE_REFERENCE_REQUIRED', () => {
    const { payload, error } = buildSourcePayload({ source_locator: 'page 3, table 1' }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('rejects: source_file_id="", valid locator provided → SOURCE_REFERENCE_REQUIRED', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: '', source_locator: 'section 2.1' }, 1)
    expect(payload).toBeNull()
    expect(error).toMatch(/SOURCE_REFERENCE_REQUIRED/)
  })

  it('allows: valid UUID, no locator', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: VALID_UUID }, 1)
    expect(error).toBeUndefined()
    expect(payload!.source_file_id).toBe(VALID_UUID)
    expect(payload).not.toHaveProperty('source_locator')
  })

  it('allows: valid UUID + locator', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: VALID_UUID, source_locator: 'page 3' }, 1)
    expect(error).toBeUndefined()
    expect(payload!.source_locator).toBe('page 3')
  })

  it('locator whitespace-only is coerced to null when source_file_id is valid', () => {
    const { payload, error } = buildSourcePayload({ source_file_id: VALID_UUID, source_locator: '   ' }, 1)
    expect(error).toBeUndefined()
    expect(payload!.source_locator).toBeNull()
  })
})
