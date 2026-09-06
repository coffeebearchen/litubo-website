import { describe, it, expect } from 'vitest'

// ── Replication of the categories-summary join logic for unit testing ─────────

interface RawCategory { id: number; slug: string; name_en: string }
interface AggRow { category_id: number | null; status: string; count: { id: string } }

function buildCategorySummary(categories: RawCategory[], aggRows: AggRow[]) {
  return categories.map((cat) => {
    const rows = aggRows.filter((r) => r.category_id === cat.id)
    const byStatus = { draft: 0, review: 0, published: 0, archived: 0 }
    let total = 0
    for (const row of rows) {
      const s = row.status as keyof typeof byStatus
      const n = parseInt(row.count.id, 10) || 0
      if (s in byStatus) {
        byStatus[s] = n
        total += n
      }
    }
    return { id: cat.id, slug: cat.slug, name_en: cat.name_en, total, by_status: byStatus }
  })
}

const CATS: RawCategory[] = [
  { id: 1, slug: 'x-ray', name_en: 'X-Ray Inspection' },
  { id: 2, slug: 'metal-detection', name_en: 'Metal Detection' },
  { id: 3, slug: 'checkweighing', name_en: 'Checkweighing' },
]

describe('categories-summary join', () => {
  it('returns zero counts when no products exist', () => {
    const result = buildCategorySummary(CATS, [])
    const xray = result.find(r => r.id === 1)!
    expect(xray.total).toBe(0)
    expect(xray.by_status.draft).toBe(0)
    expect(xray.by_status.published).toBe(0)
  })

  it('correctly sums products across multiple statuses for a category', () => {
    const agg: AggRow[] = [
      { category_id: 1, status: 'draft', count: { id: '3' } },
      { category_id: 1, status: 'published', count: { id: '7' } },
      { category_id: 1, status: 'review', count: { id: '2' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    const xray = result.find(r => r.id === 1)!
    expect(xray.total).toBe(12)
    expect(xray.by_status.draft).toBe(3)
    expect(xray.by_status.published).toBe(7)
    expect(xray.by_status.review).toBe(2)
    expect(xray.by_status.archived).toBe(0)
  })

  it('does not assign null category_id rows to any category', () => {
    const agg: AggRow[] = [
      { category_id: null, status: 'draft', count: { id: '5' } },
      { category_id: 2, status: 'published', count: { id: '2' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    expect(result.find(r => r.id === 2)!.total).toBe(2)
    expect(result.find(r => r.id === 1)!.total).toBe(0)
    expect(result.find(r => r.id === 3)!.total).toBe(0)
  })

  it('handles multiple categories independently', () => {
    const agg: AggRow[] = [
      { category_id: 1, status: 'published', count: { id: '10' } },
      { category_id: 2, status: 'draft', count: { id: '4' } },
      { category_id: 3, status: 'archived', count: { id: '1' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    expect(result.find(r => r.id === 1)!.total).toBe(10)
    expect(result.find(r => r.id === 2)!.total).toBe(4)
    expect(result.find(r => r.id === 3)!.total).toBe(1)
  })

  it('preserves category order from input list', () => {
    const result = buildCategorySummary(CATS, [])
    expect(result.map(r => r.id)).toEqual([1, 2, 3])
  })

  it('ignores unknown status values gracefully', () => {
    const agg: AggRow[] = [
      { category_id: 1, status: 'unknown_status', count: { id: '3' } },
      { category_id: 1, status: 'published', count: { id: '2' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    const xray = result.find(r => r.id === 1)!
    expect(xray.total).toBe(2)
    expect(xray.by_status.published).toBe(2)
  })

  it('handles non-numeric count strings safely', () => {
    const agg: AggRow[] = [
      { category_id: 1, status: 'draft', count: { id: '' } },
      { category_id: 1, status: 'published', count: { id: 'NaN' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    const xray = result.find(r => r.id === 1)!
    expect(xray.total).toBe(0)
  })
})
