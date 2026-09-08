/**
 * PWS-AI-ENGINE-01R2 — `aiSpecificationApply.ts` no longer contains a write
 * path. `applyAcceptedSpecificationChanges()` (the best-effort, multi-REST-
 * call saga with swallowed compensation failures) has been removed rather
 * than kept/wrapped/renamed, per this task's instructions. Only the Zod
 * request-shape contract remains, kept as the agreed shape for a future real
 * transactional writer. The live `apply.post.ts` endpoint now unconditionally
 * returns 503 and writes nothing — see that file's real-server verification
 * in this task's browser evidence, not a unit test here (there is no
 * production write path left to unit-test).
 */

import { describe, it, expect } from 'vitest'
import { ApplyChangeSchema, ApplyRequestSchema } from '../server/utils/aiSpecificationApply'
import { normalizeSpecName } from '../server/utils/productSpecWriter'

describe('ApplyChangeSchema — add', () => {
  it('accepts a well-formed add change', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'Detection performance', parameter: 'Detection sensitivity (Fe)', value: '0.8 mm',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an optional note', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'Detection performance', parameter: 'X', value: 'Y', note: 'From datasheet page 7',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an add missing a required field', () => {
    expect(ApplyChangeSchema.safeParse({ action: 'add', group: 'X', value: 'Y' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'add', parameter: 'X', value: 'Y' }).success).toBe(false)
  })

  it('.strict() rejects an add carrying an update-only field like specItemId', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'X', parameter: 'Y', value: 'Z', specItemId: 999,
    })
    expect(result.success).toBe(false)
  })
})

describe('ApplyChangeSchema — update', () => {
  it('accepts a well-formed update change', () => {
    const result = ApplyChangeSchema.safeParse({ action: 'update', specItemId: 42, value: '0.8 mm' })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive or non-integer specItemId', () => {
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: 0, value: 'X' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: -1, value: 'X' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: 1.5, value: 'X' }).success).toBe(false)
  })

  it('.strict() rejects an update carrying an add-only field like group/parameter', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'update', specItemId: 1, value: 'X', group: 'Should not exist', parameter: 'Should not exist',
    })
    expect(result.success).toBe(false)
  })
})

describe('ApplyRequestSchema', () => {
  it('accepts a request with 1-100 changes', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [{ action: 'update', specItemId: 1, value: 'X' }] }).success).toBe(true)
  })
  it('rejects an empty changes array', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [] }).success).toBe(false)
  })
  it('rejects an unrecognized action value', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [{ action: 'delete', specItemId: 1 }] }).success).toBe(false)
  })
  it('rejects a request with more than 100 changes', () => {
    const changes = Array.from({ length: 101 }, (_, i) => ({ action: 'update' as const, specItemId: i + 1, value: 'X' }))
    expect(ApplyRequestSchema.safeParse({ changes }).success).toBe(false)
  })
})

describe('normalizeSpecName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeSpecName('  Detection   Sensitivity (Fe) ')).toBe('detection sensitivity (fe)')
  })
})
