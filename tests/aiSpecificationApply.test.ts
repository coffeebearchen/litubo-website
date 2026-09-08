/**
 * PWS-AI-ENGINE-01R — "Apply accepted changes to Draft". Covers the Zod
 * request schema AND the real, executed orchestration function
 * `applyAcceptedSpecificationChanges()` — including a genuine "a later item
 * fails" simulation that verifies earlier successful writes in the same
 * batch are compensated (reverted/deleted), not left behind. All tests use
 * a mock `FetchFn` — no network, no Directus, no AI provider involved.
 */

import { describe, it, expect } from 'vitest'
import {
  ApplyChangeSchema,
  ApplyRequestSchema,
  applyAcceptedSpecificationChanges,
  type ApplyChange,
} from '../server/utils/aiSpecificationApply'
import { normalizeSpecName } from '../server/utils/productSpecWriter'
import type { FetchFn } from '../server/utils/mediaLifecycle'

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
  it('rejects an empty changes array — Apply is disabled client-side but the server refuses it too', () => {
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

// ── applyAcceptedSpecificationChanges — real execution against a mock FetchFn ──

interface MockState {
  groups: Array<{ id: number, title_en: string, product_id: number }>
  items: Array<{ id: number, spec_group_id: number, label_en: string, value_en: string, note_en: string | null }>
  nextGroupId: number
  nextItemId: number
  calls: Array<{ path: string, method?: string, body?: unknown }>
  failOnCallIndex?: number // 0-based index into `calls` (mutating calls) at which to throw
}

function buildMockFetch(state: MockState): FetchFn {
  return (async <T>(path: string, opts?: Record<string, unknown>): Promise<T> => {
    const method = (opts?.method as string | undefined) ?? 'GET'
    const isMutation = method !== 'GET'
    if (isMutation) {
      const callIndex = state.calls.length
      state.calls.push({ path, method, body: opts?.body })
      if (state.failOnCallIndex === callIndex) {
        throw new Error('simulated write failure')
      }
    }

    if (path.startsWith('/items/product_spec_items/') && method === 'GET') {
      const id = Number(path.split('/items/product_spec_items/')[1].split('?')[0])
      const item = state.items.find(i => i.id === id)
      if (!item) return { data: null } as T
      const group = state.groups.find(g => g.id === item.spec_group_id)
      return { data: { id: item.id, value_en: item.value_en, note_en: item.note_en, spec_group_id: group ? { id: group.id, product_id: group.product_id } : null } } as T
    }
    if (path.startsWith('/items/product_spec_items?filter[spec_group_id][product_id]')) {
      const productIdMatch = path.match(/filter\[spec_group_id\]\[product_id\]\[_eq\]=(\d+)/)
      const productId = productIdMatch ? Number(productIdMatch[1]) : -1
      const groupIds = new Set(state.groups.filter(g => g.product_id === productId).map(g => g.id))
      const rows = state.items.filter(i => groupIds.has(i.spec_group_id)).map(i => ({ id: i.id, label_en: i.label_en }))
      return { data: rows } as T
    }
    if (path.startsWith('/items/product_spec_groups?filter[product_id]')) {
      const productIdMatch = path.match(/filter\[product_id\]\[_eq\]=(\d+)/)
      const productId = productIdMatch ? Number(productIdMatch[1]) : -1
      return { data: state.groups.filter(g => g.product_id === productId).map(g => ({ id: g.id, title_en: g.title_en })) } as T
    }
    if (path === '/items/product_spec_groups' && method === 'POST') {
      const body = opts!.body as { product_id: number, title_en: string }
      const id = state.nextGroupId++
      state.groups.push({ id, title_en: body.title_en, product_id: body.product_id })
      return { data: { id } } as T
    }
    if (path === '/items/product_spec_items' && method === 'POST') {
      const body = opts!.body as { spec_group_id: number, label_en: string, value_en: string, note_en: string | null }
      const id = state.nextItemId++
      state.items.push({ id, spec_group_id: body.spec_group_id, label_en: body.label_en, value_en: body.value_en, note_en: body.note_en })
      return { data: { id } } as T
    }
    if (path.startsWith('/items/product_spec_items/') && method === 'PATCH') {
      const id = Number(path.split('/items/product_spec_items/')[1])
      const body = opts!.body as { value_en?: string, note_en?: string | null }
      const item = state.items.find(i => i.id === id)
      if (item) {
        if (body.value_en !== undefined) item.value_en = body.value_en
        if (body.note_en !== undefined) item.note_en = body.note_en
      }
      return undefined as T
    }
    if (path.startsWith('/items/product_spec_items/') && method === 'DELETE') {
      const id = Number(path.split('/items/product_spec_items/')[1])
      state.items = state.items.filter(i => i.id !== id)
      return undefined as T
    }
    if (path.startsWith('/items/product_spec_groups/') && method === 'DELETE') {
      const id = Number(path.split('/items/product_spec_groups/')[1])
      state.groups = state.groups.filter(g => g.id !== id)
      return undefined as T
    }
    throw new Error(`Unexpected mock fetch call: ${method} ${path}`)
  }) as FetchFn
}

function freshState(): MockState {
  return {
    groups: [{ id: 1, title_en: 'Detection performance', product_id: 100 }],
    items: [{ id: 10, spec_group_id: 1, label_en: 'Existing parameter', value_en: 'old value', note_en: null }],
    nextGroupId: 2,
    nextItemId: 20,
    calls: [],
  }
}

describe('applyAcceptedSpecificationChanges — full pre-validation before any write', () => {
  it('rejects the whole batch if any update target does not belong to this product — before writing anything', async () => {
    const state = freshState()
    state.groups.push({ id: 2, title_en: 'Other group', product_id: 200 }) // belongs to a DIFFERENT product
    state.items.push({ id: 11, spec_group_id: 2, label_en: 'Other product item', value_en: 'x', note_en: null })
    const fetch = buildMockFetch(state)

    const changes: ApplyChange[] = [
      { action: 'update', specItemId: 10, value: 'new value' }, // valid, belongs to product 100
      { action: 'update', specItemId: 11, value: 'hijack' }, // belongs to product 200 — must reject the whole batch
    ]
    const result = await applyAcceptedSpecificationChanges(fetch, 100, changes)
    expect(result.ok).toBe(false)
    // No PATCH/POST/DELETE was ever issued — pre-validation ran before any write.
    expect(state.calls.filter(c => c.method !== 'GET')).toHaveLength(0)
    expect(state.items.find(i => i.id === 10)!.value_en).toBe('old value')
  })

  it('rejects a nonexistent update target', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const result = await applyAcceptedSpecificationChanges(fetch, 100, [{ action: 'update', specItemId: 999, value: 'x' }])
    expect(result.ok).toBe(false)
  })

  it('rejects the same new specification appearing twice in one request', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const changes: ApplyChange[] = [
      { action: 'add', group: 'G', parameter: 'New param', value: 'A' },
      { action: 'add', group: 'G2', parameter: 'new   param', value: 'B' }, // same normalized name
    ]
    const result = await applyAcceptedSpecificationChanges(fetch, 100, changes)
    expect(result.ok).toBe(false)
    expect(state.calls.filter(c => c.method !== 'GET')).toHaveLength(0)
  })

  it('rejects an add that would duplicate an existing specification', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const result = await applyAcceptedSpecificationChanges(fetch, 100, [
      { action: 'add', group: 'Detection performance', parameter: 'Existing parameter', value: 'dup' },
    ])
    expect(result.ok).toBe(false)
    expect(state.calls.filter(c => c.method !== 'GET')).toHaveLength(0)
  })
})

describe('applyAcceptedSpecificationChanges — successful batch writes exactly what was accepted', () => {
  it('an update writes only value_en/note_en to the existing item', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const result = await applyAcceptedSpecificationChanges(fetch, 100, [{ action: 'update', specItemId: 10, value: '0.8 mm', note: 'confirmed' }])
    expect(result).toEqual({ ok: true, appliedCount: 1 })
    expect(state.items.find(i => i.id === 10)).toMatchObject({ value_en: '0.8 mm', note_en: 'confirmed' })
  })

  it('an add reuses an existing group by normalized name instead of creating a duplicate', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    await applyAcceptedSpecificationChanges(fetch, 100, [
      { action: 'add', group: '  detection PERFORMANCE  ', parameter: 'New param', value: 'A' },
    ])
    expect(state.groups.filter(g => g.product_id === 100)).toHaveLength(1) // still just the one original group
  })

  it('an add with a brand-new group name creates both the group and the item', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const result = await applyAcceptedSpecificationChanges(fetch, 100, [
      { action: 'add', group: 'Brand new group', parameter: 'New param', value: 'A' },
    ])
    expect(result).toEqual({ ok: true, appliedCount: 1 })
    expect(state.groups.some(g => g.title_en === 'Brand new group')).toBe(true)
    expect(state.items.some(i => i.label_en === 'New param')).toBe(true)
  })
})

describe('applyAcceptedSpecificationChanges — a later item failing leaves zero residue (compensation)', () => {
  it('reverts an earlier successful update and deletes an earlier successful add when a later write in the same batch throws', async () => {
    const state = freshState()
    // Fail on the 3rd mutating call: [0]=update item 10, [1]=create group, [2]=create item -> we want the
    // LAST item's own write to fail, so put the failing change last and target its own write call.
    const fetch = buildMockFetch(state)

    const changes: ApplyChange[] = [
      { action: 'update', specItemId: 10, value: 'reverted-away-value' }, // call 0 — succeeds first
      { action: 'add', group: 'New group', parameter: 'Param A', value: 'X' }, // calls 1 (create group), 2 (create item) — succeed
      { action: 'add', group: 'New group', parameter: 'Param B', value: 'Y' }, // call 3 — this one we make fail
    ]
    state.failOnCallIndex = 3
    const result = await applyAcceptedSpecificationChanges(fetch, 100, changes)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('rolled back')

    // The update to item 10 must have been reverted back to its original value.
    expect(state.items.find(i => i.id === 10)!.value_en).toBe('old value')
    // The group and item created earlier in this same batch must have been deleted again.
    expect(state.groups.some(g => g.title_en === 'New group')).toBe(false)
    expect(state.items.some(i => i.label_en === 'Param A')).toBe(false)
    // Nothing from the failed final change was left behind either.
    expect(state.items.some(i => i.label_en === 'Param B')).toBe(false)
  })

  it('a compensation run actually issues the expected revert/delete calls (verifiable, not just "trust me")', async () => {
    const state = freshState()
    const fetch = buildMockFetch(state)
    const changes: ApplyChange[] = [
      { action: 'update', specItemId: 10, value: 'temp' }, // call 0
      { action: 'add', group: 'G2', parameter: 'Will fail next', value: 'Z' }, // calls 1, 2
    ]
    state.failOnCallIndex = 2 // fail the item creation itself
    await applyAcceptedSpecificationChanges(fetch, 100, changes)

    const methodsAfterFailure = state.calls.slice(3).map(c => `${c.method} ${c.path.split('?')[0]}`)
    // Compensation must include a PATCH reverting item 10 and a DELETE of the group created in call 1.
    expect(methodsAfterFailure.some(m => m === 'PATCH /items/product_spec_items/10')).toBe(true)
    expect(methodsAfterFailure.some(m => m.startsWith('DELETE /items/product_spec_groups/'))).toBe(true)
  })
})
