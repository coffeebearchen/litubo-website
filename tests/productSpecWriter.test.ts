/**
 * PWS-AI-ENGINE-01R — the single canonical Specifications writer, shared by
 * both the existing editor endpoints and the AI Apply endpoint. Every test
 * here calls the real exported functions with a mock `FetchFn` (no real
 * Directus, no network) — this is real behavior-level testing, not source
 * string matching.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  listSpecGroupsForProduct,
  getSpecItemOwnership,
  createSpecGroup,
  createSpecItem,
  updateSpecItem,
  deleteSpecItem,
  deleteSpecGroup,
  normalizeSpecName,
} from '../server/utils/productSpecWriter'
import type { FetchFn } from '../server/utils/mediaLifecycle'

describe('normalizeSpecName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeSpecName('  Detection   Sensitivity (Fe) ')).toBe('detection sensitivity (fe)')
  })
  it('two differently-cased/spaced names normalize to the same key', () => {
    expect(normalizeSpecName('Detection sensitivity (Fe)')).toBe(normalizeSpecName('detection  SENSITIVITY (fe)'))
  })
})

describe('listSpecGroupsForProduct', () => {
  it('returns the parsed data array', async () => {
    const fetch = vi.fn(async () => ({ data: [{ id: 1, title_en: 'Detection performance' }] })) as unknown as FetchFn
    const result = await listSpecGroupsForProduct(fetch, 5)
    expect(result).toEqual([{ id: 1, title_en: 'Detection performance' }])
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('filter[product_id][_eq]=5'))
  })

  it('returns an empty array when data is missing', async () => {
    const fetch = vi.fn(async () => ({})) as unknown as FetchFn
    expect(await listSpecGroupsForProduct(fetch, 5)).toEqual([])
  })
})

describe('getSpecItemOwnership', () => {
  it('returns ownership info when the item has a parent group', async () => {
    const fetch = vi.fn(async () => ({
      data: { id: 10, value_en: 'old value', note_en: 'old note', spec_group_id: { id: 3, product_id: 7 } },
    })) as unknown as FetchFn
    const result = await getSpecItemOwnership(fetch, 10)
    expect(result).toEqual({ id: 10, specGroupId: 3, productId: 7, valueEn: 'old value', noteEn: 'old note' })
  })

  it('returns null when the item does not exist', async () => {
    const fetch = vi.fn(async () => ({ data: null })) as unknown as FetchFn
    expect(await getSpecItemOwnership(fetch, 999)).toBeNull()
  })

  it('returns null when the item has no parent group (orphaned)', async () => {
    const fetch = vi.fn(async () => ({ data: { id: 10, value_en: 'x', note_en: null, spec_group_id: null } })) as unknown as FetchFn
    expect(await getSpecItemOwnership(fetch, 10)).toBeNull()
  })
})

describe('createSpecGroup / createSpecItem — default localized fields, real payload shape', () => {
  it('createSpecGroup fills in ES/PT/description/sort defaults when not given', async () => {
    let sentBody: unknown
    const fetch = vi.fn(async (_path: string, opts?: Record<string, unknown>) => {
      sentBody = (opts as { body: unknown }).body
      return { data: { id: 42 } }
    }) as unknown as FetchFn
    const id = await createSpecGroup(fetch, { product_id: 1, title_en: 'New group' })
    expect(id).toBe(42)
    expect(sentBody).toMatchObject({ product_id: 1, title_en: 'New group', title_es: null, title_pt: null, enabled: true })
  })

  it('createSpecItem fills in ES/PT defaults and accepts explicit note_en', async () => {
    let sentBody: unknown
    const fetch = vi.fn(async (_path: string, opts?: Record<string, unknown>) => {
      sentBody = (opts as { body: unknown }).body
      return { data: { id: 99 } }
    }) as unknown as FetchFn
    const id = await createSpecItem(fetch, { spec_group_id: 5, label_en: 'Parameter', value_en: '0.8 mm', note_en: 'from AI' })
    expect(id).toBe(99)
    expect(sentBody).toMatchObject({ spec_group_id: 5, label_en: 'Parameter', value_en: '0.8 mm', note_en: 'from AI', enabled: true })
  })
})

describe('updateSpecItem / deleteSpecItem / deleteSpecGroup — real call shape', () => {
  it('updateSpecItem PATCHes exactly the given payload', async () => {
    const fetch = vi.fn(async () => ({ data: { id: 1 } })) as unknown as FetchFn
    await updateSpecItem(fetch, 10, { value_en: 'new value' })
    expect(fetch).toHaveBeenCalledWith('/items/product_spec_items/10', { method: 'PATCH', body: { value_en: 'new value' } })
  })

  it('deleteSpecItem issues a DELETE to the right item', async () => {
    const fetch = vi.fn(async () => undefined) as unknown as FetchFn
    await deleteSpecItem(fetch, 10)
    expect(fetch).toHaveBeenCalledWith('/items/product_spec_items/10', { method: 'DELETE' })
  })

  it('deleteSpecGroup issues a DELETE to the right group', async () => {
    const fetch = vi.fn(async () => undefined) as unknown as FetchFn
    await deleteSpecGroup(fetch, 3)
    expect(fetch).toHaveBeenCalledWith('/items/product_spec_groups/3', { method: 'DELETE' })
  })
})
