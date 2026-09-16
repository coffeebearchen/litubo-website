/**
 * FINAL-RELEASE-FIX-F — the server proposal, not the request, decides what AI
 * Apply writes (D-037).
 *
 * The previous contract let a request carry the whole instruction: `action`
 * chose create-or-update, `specItemId` chose the row, and `group` / `parameter`
 * were free text. Anyone holding one valid `proposalRef` could therefore write
 * any value into any specification of that product and call it an AI proposal.
 *
 * These tests pin the replacement: a change may only name WHICH proposal item it
 * accepts and the value the reviewer accepted it at. Everything else — the
 * target row, whether that is an add or an update, which group it lands in — is
 * derived server-side from the stored proposal and the product's current
 * specifications.
 */

import { describe, expect, it } from 'vitest'
import type { SpecificationProposal } from '../utils/aiProposal'
import {
  ApplyChangeSchema,
  ApplyRequestSchema,
  indexProposalItems,
  planSpecificationApply,
  proposalItemKey,
} from '../server/utils/aiSpecificationApply'

const PRODUCT_ID = 7

const PROPOSAL: SpecificationProposal = {
  groups: [
    {
      group: 'Detection performance',
      items: [
        { parameter: 'Aperture width', value: '180 mm' },
        { parameter: 'Belt speed', value: '25 m/min', note: 'at 50 Hz' },
      ],
    },
    { group: 'Electrical', items: [{ parameter: 'Power supply', value: '220 V' }] },
  ],
  conflicts: [{ group: 'Electrical', parameter: 'Frequency', candidateValues: ['50 Hz', '60 Hz'] }],
}

const key = (group: string, parameter: string) => proposalItemKey(group, parameter)

/** Any syntactically valid key; these cases never reach the proposal lookup. */
const ANY_KEY = proposalItemKey('a', 'b')

/**
 * A Directus stand-in that answers only the two reads the planner makes. Rows
 * are supplied per test, so "what the product already has" is explicit.
 */
function mockFetch(options: {
  items?: Array<{ id: number, label_en: string | null, groupId: number, groupTitle: string | null }>
  groups?: Array<{ id: number, title_en: string | null }>
} = {}) {
  const calls: string[] = []
  const fetch = async <T>(path: string): Promise<T> => {
    calls.push(path)
    if (path.startsWith('/items/product_spec_items')) {
      return {
        data: (options.items ?? []).map(row => ({
          id: row.id,
          label_en: row.label_en,
          spec_group_id: { id: row.groupId, title_en: row.groupTitle },
        })),
      } as T
    }
    if (path.startsWith('/items/product_spec_groups')) {
      return { data: options.groups ?? [] } as T
    }
    throw new Error(`unexpected read: ${path}`)
  }
  return { fetch: fetch as never, calls }
}

describe('a change can only name a proposal item, never a destination', () => {
  it('accepts exactly itemKey, value and an optional note', () => {
    expect(ApplyChangeSchema.safeParse({ itemKey: ANY_KEY, value: '180 mm' }).success).toBe(true)
    expect(ApplyChangeSchema.safeParse({ itemKey: ANY_KEY, value: '180 mm', note: 'x' }).success).toBe(true)
  })

  it.each([
    ['a row id', { itemKey: ANY_KEY, value: '1', specItemId: 42 }],
    ['an operation', { itemKey: ANY_KEY, value: '1', action: 'update' }],
    ['a group name', { itemKey: ANY_KEY, value: '1', group: 'Electrical' }],
    ['a parameter name', { itemKey: ANY_KEY, value: '1', parameter: 'Power supply' }],
  ])('refuses a change that also supplies %s', (_label, body) => {
    expect(ApplyChangeSchema.safeParse(body).success).toBe(false)
  })

  it('still requires the proposal reference and bounds the batch', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [{ itemKey: ANY_KEY, value: '1' }] }).success).toBe(false)
    expect(ApplyRequestSchema.safeParse({ proposalRef: 'r', changes: [] }).success).toBe(false)
    expect(ApplyRequestSchema.safeParse({
      proposalRef: 'r',
      changes: Array.from({ length: 101 }, () => ({ itemKey: ANY_KEY, value: '1' })),
    }).success).toBe(false)
  })
})

describe('the item key is derived from the proposal the same way on both sides', () => {
  it('normalizes case and whitespace, and keeps group and parameter apart', () => {
    expect(key('Detection performance', 'Aperture width')).toBe(key('  DETECTION   performance ', 'aperture Width'))
    expect(key('a', 'b')).not.toBe(key('b', 'a'))
    // The separator is a NUL, so no ordinary name can run into the next field.
    expect(key('a b', 'c')).not.toBe(key('a', 'b c'))
  })

  it('indexes every proposed item, including conflicts a reviewer must resolve', () => {
    const indexed = indexProposalItems(PROPOSAL)
    expect(indexed.ok).toBe(true)
    if (!indexed.ok) return
    expect([...indexed.items.keys()].sort()).toEqual([
      key('Detection performance', 'Aperture width'),
      key('Detection performance', 'Belt speed'),
      key('Electrical', 'Frequency'),
      key('Electrical', 'Power supply'),
    ].sort())
  })

  it('refuses a proposal that names the same parameter twice in one group', () => {
    const ambiguous: SpecificationProposal = {
      groups: [{
        group: 'Electrical',
        items: [{ parameter: 'Power supply', value: '220 V' }, { parameter: 'power  SUPPLY', value: '110 V' }],
      }],
    }
    const indexed = indexProposalItems(ambiguous)
    expect(indexed.ok).toBe(false)
  })
})

describe('the plan is derived from the proposal and the product, never from the request', () => {
  const items = () => {
    const indexed = indexProposalItems(PROPOSAL)
    if (!indexed.ok) throw new Error('fixture proposal must index')
    return indexed.items
  }

  it('refuses an item the proposal does not contain, with no reads of consequence', async () => {
    const { fetch } = mockFetch()
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Invented', 'Parameter'), value: 'x' }], items())
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.statusCode).toBe(409)
    expect(plan.message).toMatch(/not part of this proposal/)
  })

  it('refuses the same proposal item accepted twice', async () => {
    const { fetch } = mockFetch()
    const change = { itemKey: key('Electrical', 'Power supply'), value: '220 V' }
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [change, { ...change }], items())
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.message).toMatch(/accepted twice/)
  })

  it('updates the row the product already has under that group and parameter', async () => {
    const { fetch } = mockFetch({
      items: [{ id: 501, label_en: 'Power supply', groupId: 90, groupTitle: 'Electrical' }],
      groups: [{ id: 90, title_en: 'Electrical' }],
    })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '230 V' }], items())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps).toEqual([{ kind: 'update', specItemId: 501, value: '230 V', note: undefined }])
  })

  it('adds into the existing group when the product has no such parameter yet', async () => {
    const { fetch } = mockFetch({ items: [], groups: [{ id: 90, title_en: 'electrical' }] })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '220 V' }], items())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps[0]).toMatchObject({ kind: 'add', existingGroupId: 90, parameter: 'Power supply', value: '220 V' })
  })

  it('creates the group during apply when the product does not have it at all', async () => {
    const { fetch } = mockFetch({ items: [], groups: [] })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '220 V' }], items())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps[0]).toMatchObject({ kind: 'add', existingGroupId: null, groupTitle: 'Electrical' })
  })

  it('takes the group and parameter from the proposal, not from anything the request said', async () => {
    const { fetch } = mockFetch({ items: [], groups: [] })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Detection performance', 'Belt speed'), value: '30 m/min' }], items())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    // The proposal's own spelling survives, and the reviewer's edited value is kept.
    expect(plan.steps[0]).toMatchObject({ kind: 'add', groupTitle: 'Detection performance', parameter: 'Belt speed', value: '30 m/min' })
  })

  it('refuses when the product has two items that resolve to the same parameter', async () => {
    const { fetch } = mockFetch({
      items: [
        { id: 501, label_en: 'Power supply', groupId: 90, groupTitle: 'Electrical' },
        { id: 502, label_en: 'power  supply', groupId: 90, groupTitle: 'electrical' },
      ],
      groups: [{ id: 90, title_en: 'Electrical' }],
    })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '230 V' }], items())
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.statusCode).toBe(409)
    expect(plan.message).toMatch(/more than one/)
  })

  it('refuses when the destination group name is ambiguous', async () => {
    const { fetch } = mockFetch({ items: [], groups: [{ id: 90, title_en: 'Electrical' }, { id: 91, title_en: 'electrical ' }] })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '220 V' }], items())
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.message).toMatch(/more than one specification group/)
  })

  it('lets a reviewer resolve a conflict and apply the value they chose', async () => {
    const { fetch } = mockFetch({ items: [], groups: [{ id: 90, title_en: 'Electrical' }] })
    const plan = await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Frequency'), value: '50 Hz' }], items())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps[0]).toMatchObject({ kind: 'add', parameter: 'Frequency', value: '50 Hz' })
  })

  it('never reads or writes outside this product', async () => {
    const { fetch, calls } = mockFetch({ items: [], groups: [] })
    await planSpecificationApply(fetch, PRODUCT_ID, [{ itemKey: key('Electrical', 'Power supply'), value: '220 V' }], items())
    expect(calls.length).toBeGreaterThan(0)
    for (const path of calls) expect(path).toContain(String(PRODUCT_ID))
    // The planner issues reads only; every write happens in the executor.
    for (const path of calls) expect(path).toMatch(/^\/items\/product_spec_(items|groups)\?/)
  })
})
