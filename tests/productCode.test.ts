/**
 * Tests for product_code field rules:
 * - Format validation
 * - Immutability once set
 * - Status gate: draft→review and review→published require a product_code
 */

import { describe, it, expect } from 'vitest'

// ── Format validation (shared regex, extracted for unit testing) ──────────
const PRODUCT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/

function validateCode(code: string): boolean {
  return PRODUCT_CODE_RE.test(code)
}

describe('product_code format', () => {
  it('accepts valid codes', () => {
    expect(validateCode('LT-180C')).toBe(true)
    expect(validateCode('XR-001')).toBe(true)
    expect(validateCode('A')).toBe(true)
    expect(validateCode('AB')).toBe(true)
    expect(validateCode('LT180C')).toBe(true)
    expect(validateCode('LT-180C-2R')).toBe(true)
    expect(validateCode('PRODUCT-CODE-123')).toBe(true)
  })

  it('rejects lowercase', () => {
    expect(validateCode('lt-180c')).toBe(false)
    expect(validateCode('Lt-180C')).toBe(false)
  })

  it('rejects leading/trailing hyphens', () => {
    expect(validateCode('-LT-180C')).toBe(false)
    expect(validateCode('LT-180C-')).toBe(false)
    expect(validateCode('-')).toBe(false)
  })

  it('rejects special characters beyond hyphens', () => {
    expect(validateCode('LT_180C')).toBe(false)
    expect(validateCode('LT.180C')).toBe(false)
    expect(validateCode('LT 180C')).toBe(false)
    expect(validateCode('LT/180C')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateCode('')).toBe(false)
  })

  it('rejects code over 100 chars', () => {
    const long = 'A' + '-'.repeat(99) + 'B' // 101 chars
    expect(validateCode(long)).toBe(false)
  })

  it('accepts code of exactly 100 chars', () => {
    const exact = 'A' + '-'.repeat(98) + 'B' // 100 chars
    expect(validateCode(exact)).toBe(true)
  })
})

// ── Status gate logic ─────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['draft'],
}

function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

function requiresCode(nextStatus: string): boolean {
  return nextStatus === 'review' || nextStatus === 'published'
}

describe('product_code status gate', () => {
  it('draft→review blocked without product_code', () => {
    const productCode: string | null = null
    const canGo = canTransition('draft', 'review')
    const hasCode = productCode !== null && productCode !== ''
    expect(canGo).toBe(true)
    expect(requiresCode('review') && !hasCode).toBe(true)
  })

  it('draft→review allowed with product_code', () => {
    const productCode: string | null = 'LT-180C'
    const canGo = canTransition('draft', 'review')
    const hasCode = productCode !== null && productCode !== ''
    expect(canGo && hasCode).toBe(true)
  })

  it('review→published blocked without product_code', () => {
    const productCode: string | null = null
    const canGo = canTransition('review', 'published')
    const hasCode = productCode !== null && productCode !== ''
    expect(canGo).toBe(true)
    expect(requiresCode('published') && !hasCode).toBe(true)
  })

  it('review→published allowed with product_code', () => {
    const productCode: string | null = 'LT-180C'
    const canGo = canTransition('review', 'published')
    const hasCode = productCode !== null && productCode !== ''
    expect(canGo && hasCode).toBe(true)
  })

  it('draft→review with NULL code is blocked', () => {
    const existingCode: string | null = null
    const blocked = requiresCode('review') && (!existingCode || existingCode === '')
    expect(blocked).toBe(true)
  })

  it('published→draft does not require product_code', () => {
    expect(requiresCode('draft')).toBe(false)
  })

  it('review→draft does not require product_code', () => {
    expect(requiresCode('draft')).toBe(false)
  })
})

// ── Immutability ──────────────────────────────────────────────────────────

function canSetCode(existingCode: string | null, newCode: string): { allowed: boolean; error?: string } {
  if (existingCode !== null && existingCode !== '') {
    return { allowed: false, error: 'product_code is already set and cannot be changed' }
  }
  if (!validateCode(newCode)) {
    return { allowed: false, error: 'product_code must use uppercase letters, digits, and hyphens only' }
  }
  return { allowed: true }
}

describe('product_code immutability', () => {
  it('allows setting code when currently null', () => {
    expect(canSetCode(null, 'LT-180C').allowed).toBe(true)
  })

  it('blocks changing an existing code', () => {
    const existing: string | null = 'LT-180C'
    const result = canSetCode(existing, 'XR-001')
    expect(result.allowed).toBe(false)
    expect(result.error).toMatch(/already set/)
  })

  it('blocks overwriting with same code', () => {
    const existing: string | null = 'LT-180C'
    const result = canSetCode(existing, 'LT-180C')
    expect(result.allowed).toBe(false)
    expect(result.error).toMatch(/already set/)
  })

  it('blocks setting invalid format', () => {
    const result = canSetCode(null, 'lt-180c')
    expect(result.allowed).toBe(false)
    expect(result.error).toMatch(/uppercase/)
  })
})
