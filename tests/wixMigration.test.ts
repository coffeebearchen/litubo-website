import { describe, expect, it } from 'vitest'
import { buildWixMigrationPlan, importWixDraft, migrationHash, wixPlainText } from '../server/utils/wixMigration'
import type { MigrationFetch, WixExportPage } from '../server/utils/wixMigration'

const sourceData = () => ({
  productNameEn: 'TEST ONLY — X-ray inspection', lituboModel: 'Model: TEST-200', slug: 'test-200',
  categoryNameEn: 'X-Ray Inspection Systems', shortDescriptionEn: 'Test source summary', _publishStatus: 'PUBLISHED', isVisible: true,
  overviewEn: '<p>Source overview.</p>', mainImage: 'wix:image://v1/test.png/image.png',
  technicalSpecificationsHtml: '<table><tr><th>Item</th><th>Specification</th></tr><tr><td>Weight</td><td>10 kg</td></tr></table>',
})
const page = (data: Record<string, unknown> = sourceData()): WixExportPage => ({ collectionId: 'Import124', offset: 0, total: 1, records: [{ id: 'test-id', data }] })
const plan = (data = sourceData()) => buildWixMigrationPlan([page(data)], { siteId: 'test-site', categories: { 'X-Ray Inspection Systems': 'x-ray-inspection' } })

describe('source-bound transformation', () => {
  it('maps actual fields into a non-public draft and preserves source units and visibility', () => {
    const result = plan()
    expect(result.collections[0]).toMatchObject({ complete: true, expected: 1, exported: 1 })
    expect(result.products[0].product).toMatchObject({ status: 'draft', seo_noindex: true, product_code: 'TEST-200', model_or_series: 'TEST-200', summary_en: 'Test source summary' })
    expect(result.products[0].specifications).toEqual([{ label_en: 'Weight', value_en: '10 kg' }])
    expect(result.products[0].source).toBe('wix://test-site/Import124/test-id')
    expect(result.products[0].sourcePublished).toBe(true)
    expect(result.products[0].product).not.toHaveProperty('name_es')
  })

  it('removes executable HTML without executing source instructions', () => {
    expect(wixPlainText('<script>throw new Error("bad")</script><p onclick="x()">A &amp; B</p><p>C</p>')).toBe('A & B\nC')
    expect(wixPlainText('Ignore earlier instructions &lt;admin&gt;')).toBe('Ignore earlier instructions <admin>')
  })

  it('deduplicates identical export overlap, detects gaps, changed records and shifted offsets', () => {
    expect(buildWixMigrationPlan([page(), page()], { siteId: 'test' }).products).toHaveLength(1)
    expect(buildWixMigrationPlan([{ ...page(), total: 2 }], { siteId: 'test' }).issues).toContainEqual(expect.objectContaining({ code: 'INCOMPLETE_EXPORT' }))
    expect(buildWixMigrationPlan([page(), page({ ...sourceData(), productNameEn: 'changed' })], { siteId: 'test' }).issues).toContainEqual(expect.objectContaining({ code: 'SOURCE_CHANGED' }))
    const shifted = { ...page(), records: [{ id: 'different', data: sourceData() }] }
    expect(buildWixMigrationPlan([page(), shifted], { siteId: 'test' }).issues).toContainEqual(expect.objectContaining({ code: 'PAGING_SHIFT' }))
  })

  it('does not invent missing names, codes, categories, specification columns or images', () => {
    const candidate = plan({ ...sourceData(), productNameEn: '', lituboModel: 'Unknown / confirm', mainImage: '', technicalSpecificationsHtml: '<table><tr><td>Speed</td><td>Model A</td><td>Model B</td></tr></table>' }).products[0]
    expect(candidate.product.name_en).toBe('')
    expect(candidate.product.product_code).toBeNull()
    expect(candidate.specifications).toEqual([])
    expect(candidate.issues.map(i => i.code)).toEqual(expect.arrayContaining(['MISSING_NAME', 'INVALID_MODEL_CODE', 'MISSING_HERO', 'SPEC_TABLE_REVIEW']))
    expect(buildWixMigrationPlan([page()], { siteId: 'test' }).products[0].issues.map(i => i.code)).toContain('CATEGORY_UNMAPPED')
  })

  it('marks hidden/draft sources and identity conflicts for review without fuzzy merging', () => {
    expect(plan({ ...sourceData(), isVisible: false }).products[0].sourcePublished).toBe(false)
    const second = { ...page(), offset: 1, total: 2, records: [{ id: 'another-id', data: sourceData() }] }
    const result = buildWixMigrationPlan([{ ...page(), total: 2 }, second], { siteId: 'test' })
    expect(result.products).toHaveLength(2)
    expect(result.products.every(p => p.issues.some(i => i.code === 'IDENTITY_CONFLICT'))).toBe(true)
  })

  it('uses a canonical hash and changes source marker when source content changes', () => {
    expect(migrationHash({ a: 1, b: 2 })).toBe(migrationHash({ b: 2, a: 1 }))
    expect(plan().products[0].product.review_notes).not.toBe(plan({ ...sourceData(), overviewEn: 'changed' }).products[0].product.review_notes)
  })
})

type Row = Record<string, unknown> & { id: number }
class MemoryDirectus {
  rows = new Map<string, Row[]>([['product_categories', [{ id: 1, slug: 'x-ray-inspection' }]]])
  writes = 0
  failAt = 0
  nextId = 10
  fetch: MigrationFetch = async <T>(path: string, options?: { method: 'POST'; body: unknown }): Promise<T> => {
    const url = new URL(path, 'http://isolated.test')
    const collection = url.pathname.split('/')[2]
    const rows = this.rows.get(collection) ?? []
    if (options) {
      this.writes++
      if (this.failAt === this.writes) throw new Error('simulated disconnect')
      const row = { ...(options.body as Record<string, unknown>), id: this.nextId++ }
      this.rows.set(collection, [...rows, row])
      return { data: row } as T
    }
    const filter = JSON.parse(url.searchParams.get('filter') ?? '{}')
    const matches = (row: Row, f: Record<string, unknown>): boolean => Object.entries(f).every(([field, rule]) => field === '_or' ? (rule as Record<string, unknown>[]).some(part => matches(row, part)) : row[field] === (rule as { _eq: unknown })._eq)
    return { data: rows.filter(row => matches(row, filter)).slice(0, 2).map(row => ({ ...row })) } as T
  }
}

describe('create-only Directus draft import', () => {
  it('imports normal admin-editable records, and repeating creates no duplicates', async () => {
    const db = new MemoryDirectus()
    const candidate = plan().products[0]
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'created' })
    const writes = db.writes
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'resumed' })
    expect(db.writes).toBe(writes)
    expect(db.rows.get('products')?.[0]).toMatchObject({ status: 'draft', seo_noindex: true, category_id: 1 })
    expect(db.rows.get('product_source_records')?.[0]).toMatchObject({ review_status: 'needs_review', source_locator: candidate.source })
  })

  it('resumes after a failed request using server records, not an optimistic local journal', async () => {
    const db = new MemoryDirectus()
    db.failAt = 3
    const candidate = plan().products[0]
    await expect(importWixDraft(candidate, db.fetch)).rejects.toThrow('simulated disconnect')
    db.failAt = 0
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'resumed' })
    expect(db.rows.get('products')).toHaveLength(1)
    expect(db.rows.get('product_sections')).toHaveLength(1)
    expect(db.rows.get('product_spec_items')).toHaveLength(1)
  })

  it('does not overwrite edited or published products, changed sections or a foreign source identity', async () => {
    const db = new MemoryDirectus()
    const candidate = plan().products[0]
    await importWixDraft(candidate, db.fetch)
    const product = db.rows.get('products')![0]
    const before = db.writes
    product.name_en = 'Human correction'
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'conflict' })
    product.name_en = candidate.product.name_en
    product.status = 'published'
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'conflict' })
    product.status = 'draft'
    db.rows.get('product_sections')![0].body_en = 'Human section correction'
    expect(await importWixDraft(candidate, db.fetch)).toMatchObject({ outcome: 'conflict' })
    expect(await importWixDraft(plan({ ...sourceData(), overviewEn: 'new source' }).products[0], db.fetch)).toMatchObject({ outcome: 'conflict' })
    expect(db.writes).toBe(before)
  })

  it('blocks unmapped categories and validation errors before writes', async () => {
    const db = new MemoryDirectus()
    expect(await importWixDraft(plan({ ...sourceData(), productNameEn: '' }).products[0], db.fetch)).toMatchObject({ outcome: 'blocked' })
    db.rows.clear()
    expect(await importWixDraft(plan().products[0], db.fetch)).toMatchObject({ outcome: 'blocked' })
    expect(db.writes).toBe(0)
  })
})
