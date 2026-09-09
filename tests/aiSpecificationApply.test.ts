/**
 * PWS-AI-APPLY-DRAFT-01 — the Zod request contract AND the restored write
 * path.
 *
 * The write path is back deliberately, and it is a different thing from what
 * was removed: the earlier version wrapped several REST writes in a
 * best-effort compensating rollback and described that as a transaction. The
 * tests below assert the opposite property — that a partial batch is reported
 * honestly and NOT compensated — alongside the boundaries that do the real
 * protecting: whole-batch preflight, cross-product refusal, and a write set
 * that contains no DELETE and touches only `value_en`/`note_en` on an update.
 */

import { describe, it, expect } from 'vitest'
import {
  ApplyChangeSchema,
  ApplyRequestSchema,
  planSpecificationApply,
  executeSpecificationApply,
} from '../server/utils/aiSpecificationApply'
import type { ApplyChange } from '../server/utils/aiSpecificationApply'
import type { FetchFn } from '../server/utils/mediaLifecycle'
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

// ── PWS-AI-APPLY-DRAFT-01: the restored write path ──

/**
 * These exercise the REAL preflight and executor against a recording mock of
 * the Directus fetch, so every assertion below is about the requests the
 * writer would actually issue — method, path and body — not about a
 * reimplementation of it.
 */


interface RecordedCall { path: string, method: string, body?: Record<string, unknown> }

/**
 * @param routes  path-prefix → response (or a thrower, to simulate a save error)
 */
function recordingFetch(routes: Record<string, unknown | ((call: RecordedCall) => unknown)>) {
  const calls: RecordedCall[] = []
  let nextId = 1000
  const fetch = (async (path: string, options?: Record<string, unknown>) => {
    const method = String(options?.method ?? 'GET').toUpperCase()
    const call: RecordedCall = { path, method, body: options?.body as Record<string, unknown> | undefined }
    calls.push(call)
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) {
        const resolved = typeof value === 'function' ? (value as (c: RecordedCall) => unknown)(call) : value
        return resolved
      }
    }
    // Default: a successful create returning a fresh id.
    if (method === 'POST') return { data: { id: nextId++ } }
    return { data: null }
  }) as FetchFn
  return { fetch, calls }
}

const writesIn = (calls: RecordedCall[]) => calls.filter(c => c.method !== 'GET')

describe('planSpecificationApply — the whole batch is judged before anything is written', () => {
  it('refuses the entire request when one update targets another product, with zero writes', async () => {
    const { fetch, calls } = recordingFetch({
      '/items/product_spec_items/11': { data: { id: 11, value_en: 'a', note_en: null, spec_group_id: { id: 5, product_id: 3 } } },
      // Item 99 lives under product 4 — the browser asked to update it on product 3.
      '/items/product_spec_items/99': { data: { id: 99, value_en: 'b', note_en: null, spec_group_id: { id: 8, product_id: 4 } } },
    })

    const changes: ApplyChange[] = [
      { action: 'update', specItemId: 11, value: 'legitimate' },
      { action: 'update', specItemId: 99, value: 'belongs to product 4' },
    ]
    const plan = await planSpecificationApply(fetch, 3, changes)

    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      expect(plan.statusCode).toBe(409)
      expect(plan.message).toContain('does not belong to this product')
    }
    // Critically: not "the first one was fine so we wrote it".
    expect(writesIn(calls)).toEqual([])
  })

  it('refuses an update whose item does not exist at all', async () => {
    const { fetch, calls } = recordingFetch({ '/items/product_spec_items/404': { data: null } })
    const plan = await planSpecificationApply(fetch, 3, [{ action: 'update', specItemId: 404, value: 'x' }])
    expect(plan.ok).toBe(false)
    expect(writesIn(calls)).toEqual([])
  })

  it('refuses an add when the product already has two groups with the same normalized name', async () => {
    const { fetch, calls } = recordingFetch({
      '/items/product_spec_groups?filter': {
        data: [
          { id: 5, title_en: 'Detection performance' },
          { id: 6, title_en: '  detection   PERFORMANCE ' },
        ],
      },
    })

    const plan = await planSpecificationApply(fetch, 3, [
      { action: 'add', group: 'Detection performance', parameter: 'Sensitivity', value: '0.8 mm' },
    ])

    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.statusCode).toBe(409)
    expect(writesIn(calls)).toEqual([])
  })

  it('resolves an add to the one existing group that matches by normalized name', async () => {
    const { fetch } = recordingFetch({
      '/items/product_spec_groups?filter': { data: [{ id: 5, title_en: 'Detection  Performance' }] },
    })
    const plan = await planSpecificationApply(fetch, 3, [
      { action: 'add', group: 'detection performance', parameter: 'Sensitivity', value: '0.8 mm' },
    ])
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.steps[0]).toMatchObject({ kind: 'add', existingGroupId: 5 })
  })

  it('marks an add for a group this product does not have yet as "create during apply"', async () => {
    const { fetch } = recordingFetch({ '/items/product_spec_groups?filter': { data: [] } })
    const plan = await planSpecificationApply(fetch, 3, [
      { action: 'add', group: 'Brand new group', parameter: 'P', value: 'V' },
    ])
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.steps[0]).toMatchObject({ kind: 'add', existingGroupId: null })
  })

  it('does not list groups at all when the batch is updates only', async () => {
    const { fetch, calls } = recordingFetch({
      '/items/product_spec_items/11': { data: { id: 11, value_en: 'a', note_en: null, spec_group_id: { id: 5, product_id: 3 } } },
    })
    await planSpecificationApply(fetch, 3, [{ action: 'update', specItemId: 11, value: 'x' }])
    expect(calls.some(c => c.path.startsWith('/items/product_spec_groups'))).toBe(false)
  })
})

describe('executeSpecificationApply — writes exactly what was accepted, and nothing else', () => {
  it('an update changes only value_en and note_en', async () => {
    const { fetch, calls } = recordingFetch({})
    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'update', specItemId: 11, value: '0.9 mm', note: 'from datasheet' },
    ])

    expect(result).toMatchObject({ ok: true, appliedCount: 1, totalCount: 1, partial: false })

    const patches = calls.filter(c => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].path).toBe('/items/product_spec_items/11')
    // The exhaustive assertion: these two keys and no others.
    expect(Object.keys(patches[0].body ?? {}).sort()).toEqual(['note_en', 'value_en'])
    expect(patches[0].body).toEqual({ value_en: '0.9 mm', note_en: 'from datasheet' })
  })

  it('an add into an existing group creates the item and no group', async () => {
    const { fetch, calls } = recordingFetch({})
    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'add', groupKey: 'detection performance', groupTitle: 'Detection performance', existingGroupId: 5, parameter: 'Sensitivity', value: '0.8 mm', note: null },
    ])

    expect(result.ok).toBe(true)
    expect(calls.some(c => c.path === '/items/product_spec_groups' && c.method === 'POST')).toBe(false)

    const itemPost = calls.find(c => c.path === '/items/product_spec_items' && c.method === 'POST')!
    expect(itemPost.body).toMatchObject({ spec_group_id: 5, label_en: 'Sensitivity', value_en: '0.8 mm', note_en: null })
  })

  it('an add for a missing group creates that group under THIS product, then the item', async () => {
    const { fetch, calls } = recordingFetch({
      '/items/product_spec_groups': { data: { id: 77 } },
    })
    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'add', groupKey: 'new group', groupTitle: 'New group', existingGroupId: null, parameter: 'P', value: 'V', note: null },
    ])

    expect(result.ok).toBe(true)
    const groupPost = calls.find(c => c.path === '/items/product_spec_groups' && c.method === 'POST')!
    expect(groupPost.body).toMatchObject({ product_id: 3, title_en: 'New group' })

    const itemPost = calls.find(c => c.path === '/items/product_spec_items' && c.method === 'POST')!
    expect(itemPost.body).toMatchObject({ spec_group_id: 77 })
  })

  it('several adds naming the same new group create that group once, not once each', async () => {
    const { fetch, calls } = recordingFetch({ '/items/product_spec_groups': { data: { id: 77 } } })
    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'add', groupKey: 'new group', groupTitle: 'New group', existingGroupId: null, parameter: 'A', value: '1', note: null },
      { kind: 'add', groupKey: 'new group', groupTitle: 'New group', existingGroupId: null, parameter: 'B', value: '2', note: null },
      { kind: 'add', groupKey: 'new group', groupTitle: 'New group', existingGroupId: null, parameter: 'C', value: '3', note: null },
    ])

    expect(result).toMatchObject({ ok: true, appliedCount: 3, totalCount: 3 })
    expect(calls.filter(c => c.path === '/items/product_spec_groups' && c.method === 'POST')).toHaveLength(1)

    const itemPosts = calls.filter(c => c.path === '/items/product_spec_items' && c.method === 'POST')
    expect(itemPosts).toHaveLength(3)
    for (const post of itemPosts) expect(post.body).toMatchObject({ spec_group_id: 77 })
  })

  it('never issues a DELETE', async () => {
    const { fetch, calls } = recordingFetch({ '/items/product_spec_groups': { data: { id: 77 } } })
    await executeSpecificationApply(fetch, 3, [
      { kind: 'update', specItemId: 11, value: 'x', note: null },
      { kind: 'add', groupKey: 'g', groupTitle: 'G', existingGroupId: null, parameter: 'P', value: 'V', note: null },
    ])
    expect(calls.filter(c => c.method === 'DELETE')).toEqual([])
  })
})

describe('executeSpecificationApply — partial failure is reported, never compensated', () => {
  it('stops at the first save error, reports the real count, and does not touch later changes', async () => {
    let itemWrites = 0
    const { fetch, calls } = recordingFetch({
      '/items/product_spec_items/': () => { throw new Error('directus write failed') },
      '/items/product_spec_items': () => {
        itemWrites++
        return { data: { id: 500 + itemWrites } }
      },
    })

    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'add', groupKey: 'g', groupTitle: 'G', existingGroupId: 5, parameter: 'A', value: '1', note: null },
      { kind: 'add', groupKey: 'g', groupTitle: 'G', existingGroupId: 5, parameter: 'B', value: '2', note: null },
      // This one fails: the PATCH path throws.
      { kind: 'update', specItemId: 11, value: 'boom', note: null },
      { kind: 'add', groupKey: 'g', groupTitle: 'G', existingGroupId: 5, parameter: 'D', value: '4', note: null },
    ])

    expect(result.ok).toBe(false)
    expect(result.partial).toBe(true)
    expect(result.appliedCount).toBe(2)
    expect(result.totalCount).toBe(4)
    expect(result.message).toContain('Applied 2 of 4')
    expect(result.message).toContain('Review Specifications')

    // The fourth change was never attempted...
    expect(itemWrites).toBe(2)
    // ...and nothing was compensated: no DELETE, no revert PATCH.
    expect(calls.filter(c => c.method === 'DELETE')).toEqual([])
    expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(1)
  })

  it('a failure on the very first change reports zero applied and is not flagged partial', async () => {
    const { fetch } = recordingFetch({
      '/items/product_spec_items/': () => { throw new Error('directus write failed') },
    })
    const result = await executeSpecificationApply(fetch, 3, [
      { kind: 'update', specItemId: 11, value: 'x', note: null },
      { kind: 'update', specItemId: 12, value: 'y', note: null },
    ])

    expect(result).toMatchObject({ ok: false, appliedCount: 0, totalCount: 2, partial: false })
    expect(result.message).toContain('Nothing was written')
  })
})
