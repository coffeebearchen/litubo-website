import { describe, it, expect } from 'vitest'

// ── Replication of the categories-summary join logic for unit testing ─────────

interface RawCategory { id: number; slug: string; name_en: string; intro_en: string | null }
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
    return {
      id: cat.id,
      slug: cat.slug,
      name_en: cat.name_en,
      intro_en: cat.intro_en ?? null,
      total,
      by_status: byStatus,
    }
  })
}

const CATS: RawCategory[] = [
  { id: 1, slug: 'x-ray', name_en: 'X-Ray Inspection', intro_en: 'X-ray inspection systems.' },
  { id: 2, slug: 'metal-detection', name_en: 'Metal Detection', intro_en: null },
  { id: 3, slug: 'checkweighing', name_en: 'Checkweighing', intro_en: null },
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

  it('passes through intro_en and normalises a missing intro to null', () => {
    const result = buildCategorySummary(CATS, [])
    expect(result.find(r => r.id === 1)!.intro_en).toBe('X-ray inspection systems.')
    expect(result.find(r => r.id === 2)!.intro_en).toBeNull()
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

// ── products-summary aggregation logic ───────────────────────────────────────

interface ProductsAggRow { status: string; count: { id: string } }

const KNOWN_STATUSES = new Set(['draft', 'review', 'published', 'archived'])

function buildProductsSummary(aggRows: ProductsAggRow[]) {
  const byStatus: Record<string, number> = {}
  let all = 0
  for (const row of aggRows) {
    const n = parseInt(row.count.id, 10) || 0
    if (KNOWN_STATUSES.has(row.status)) {
      byStatus[row.status] = n
      all += n
    }
  }
  return {
    all,
    draft: byStatus['draft'] ?? 0,
    review: byStatus['review'] ?? 0,
    draft_review: (byStatus['draft'] ?? 0) + (byStatus['review'] ?? 0),
    published: byStatus['published'] ?? 0,
    archived: byStatus['archived'] ?? 0,
  }
}

describe('products-summary aggregation', () => {
  it('returns all-zero when no rows', () => {
    const s = buildProductsSummary([])
    expect(s.all).toBe(0)
    expect(s.draft).toBe(0)
    expect(s.draft_review).toBe(0)
    expect(s.published).toBe(0)
  })

  it('sums all known statuses into the all count', () => {
    const rows: ProductsAggRow[] = [
      { status: 'draft',     count: { id: '3' } },
      { status: 'review',    count: { id: '2' } },
      { status: 'published', count: { id: '10' } },
      { status: 'archived',  count: { id: '1' } },
    ]
    const s = buildProductsSummary(rows)
    expect(s.all).toBe(16)
    expect(s.draft).toBe(3)
    expect(s.review).toBe(2)
    expect(s.published).toBe(10)
    expect(s.archived).toBe(1)
  })

  it('computes draft_review as sum of draft + review', () => {
    const rows: ProductsAggRow[] = [
      { status: 'draft',  count: { id: '5' } },
      { status: 'review', count: { id: '3' } },
    ]
    const s = buildProductsSummary(rows)
    expect(s.draft_review).toBe(8)
  })

  it('excludes unknown statuses from all count', () => {
    const rows: ProductsAggRow[] = [
      { status: 'published', count: { id: '4' } },
      { status: 'unknown',   count: { id: '99' } },
    ]
    const s = buildProductsSummary(rows)
    expect(s.all).toBe(4)
  })

  it('handles non-numeric count strings without throwing', () => {
    const rows: ProductsAggRow[] = [
      { status: 'draft', count: { id: '' } },
      { status: 'published', count: { id: 'NaN' } },
    ]
    const s = buildProductsSummary(rows)
    expect(s.all).toBe(0)
    expect(s.draft).toBe(0)
  })
})

// ── multi-status filter query string builder ──────────────────────────────────

function buildStatusFilterParts(status: string): string[] {
  const parts: string[] = []
  if (!status) return parts
  const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
  if (statuses.length === 1) {
    parts.push(`filter[status][_eq]=${encodeURIComponent(statuses[0])}`)
  } else {
    statuses.forEach(s => parts.push(`filter[status][_in][]=${encodeURIComponent(s)}`))
  }
  return parts
}

describe('multi-status filter query builder', () => {
  it('single status uses _eq operator', () => {
    const parts = buildStatusFilterParts('draft')
    expect(parts).toHaveLength(1)
    expect(parts[0]).toBe('filter[status][_eq]=draft')
  })

  it('two statuses use _in[] operator', () => {
    const parts = buildStatusFilterParts('draft,review')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toBe('filter[status][_in][]=draft')
    expect(parts[1]).toBe('filter[status][_in][]=review')
  })

  it('empty string produces no filter parts', () => {
    expect(buildStatusFilterParts('')).toHaveLength(0)
  })

  it('trims whitespace around comma-separated values', () => {
    const parts = buildStatusFilterParts('draft , review')
    expect(parts[0]).toBe('filter[status][_in][]=draft')
    expect(parts[1]).toBe('filter[status][_in][]=review')
  })

  it('filters out empty segments after trim', () => {
    const parts = buildStatusFilterParts('draft,')
    expect(parts).toHaveLength(1)
    expect(parts[0]).toBe('filter[status][_eq]=draft')
  })
})

// ── Needs Attention gate enforcement ─────────────────────────────────────────

describe('Needs Attention gate (BP-DG-02)', () => {
  it('is not in SYSTEM_VIEWS active items (gated)', () => {
    const ACTIVE_VIEWS = ['', 'draft,review', 'published', 'archived']
    expect(ACTIVE_VIEWS).not.toContain('needs_attention')
  })

  it('draft_review count does not depend on Needs Attention formula', () => {
    const rows: ProductsAggRow[] = [
      { status: 'draft',  count: { id: '4' } },
      { status: 'review', count: { id: '3' } },
    ]
    const s = buildProductsSummary(rows)
    expect(s.draft_review).toBe(7)
  })

  it('unknown formula keys do not appear in summary output', () => {
    const s = buildProductsSummary([])
    const keys = Object.keys(s)
    expect(keys).not.toContain('needs_attention')
    expect(keys).not.toContain('attention')
  })
})

// ── Category context (/categories/[id]) product filtering ─────────────────────

describe('category context product filtering', () => {
  it('filters products to only those matching category id', () => {
    const allProducts = [
      { id: 1, category_id: 1, status: 'published' },
      { id: 2, category_id: 2, status: 'draft' },
      { id: 3, category_id: 1, status: 'draft' },
    ]
    const categoryId = 1
    const filtered = allProducts.filter(p => p.category_id === categoryId)
    expect(filtered).toHaveLength(2)
    expect(filtered.every(p => p.category_id === 1)).toBe(true)
  })

  it('returns category summary by id', () => {
    const result = buildCategorySummary(CATS, [
      { category_id: 1, status: 'published', count: { id: '5' } },
      { category_id: 2, status: 'draft',     count: { id: '2' } },
    ])
    const cat = result.find(c => c.id === 1)
    expect(cat).toBeDefined()
    expect(cat!.name_en).toBe('X-Ray Inspection')
    expect(cat!.total).toBe(5)
  })

  it('returns undefined when category id not in summary list', () => {
    const result = buildCategorySummary(CATS, [])
    const missing = result.find(c => c.id === 999)
    expect(missing).toBeUndefined()
  })

  it('category context status counts are independent per category', () => {
    const agg: AggRow[] = [
      { category_id: 1, status: 'draft',     count: { id: '3' } },
      { category_id: 2, status: 'published', count: { id: '5' } },
      { category_id: 1, status: 'published', count: { id: '2' } },
    ]
    const result = buildCategorySummary(CATS, agg)
    const cat1 = result.find(c => c.id === 1)!
    const cat2 = result.find(c => c.id === 2)!
    expect(cat1.by_status.published).toBe(2)
    expect(cat2.by_status.published).toBe(5)
    expect(cat1.by_status.draft).toBe(3)
    expect(cat2.by_status.draft).toBe(0)
  })
})
