/**
 * PC-01 / PC-02 Product Centre recovery tests (J-2).
 *
 * The pure helpers are imported from utils/productCentre.ts — the SAME module the
 * Vue pages and components import, so these tests exercise production code rather
 * than a copy of it. Behaviour that only exists inside Nitro handlers is verified
 * through source-evidence assertions, as established by tests/assetProxy.test.ts.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  CATEGORY_HEALTH_UNAVAILABLE,
  DEFAULT_PRODUCT_FILTERS,
  PRODUCT_STATUS_VALUES,
  adminAssetUrl,
  buildProductCardModel,
  buildProductFilterQuery,
  buildStatusTiles,
  categoryContextRoute,
  categoryNameFor,
  hasActiveProductFilters,
  normaliseCategoryFilter,
  normalisePageNumber,
  normaliseSearchFilter,
  normaliseStatusFilter,
  pageRangeLabel,
  parseProductFilterQuery,
  productDetailRoute,
  totalPageCount,
} from '../utils/productCentre'
import { KNOWN_STATUSES, buildProductsFilterParts } from '../server/utils/adminProductsQuery'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const SUMMARY = { all: 12, draft: 5, review: 2, draft_review: 7, published: 4, archived: 1 }

// ── Status tiles — real counts only ──────────────────────────────────────────

describe('status tiles (VM1-ADM02 status strip)', () => {
  it('renders one tile per real lifecycle bucket plus the unfiltered view', () => {
    const tiles = buildStatusTiles(SUMMARY)
    expect(tiles.map(t => t.key)).toEqual(['all', 'draft', 'review', 'published', 'archived'])
  })

  it('takes every count from the products-summary aggregate', () => {
    const tiles = buildStatusTiles(SUMMARY)
    expect(tiles.find(t => t.key === 'all')!.count).toBe(12)
    expect(tiles.find(t => t.key === 'draft')!.count).toBe(5)
    expect(tiles.find(t => t.key === 'published')!.count).toBe(4)
    expect(tiles.find(t => t.key === 'archived')!.count).toBe(1)
  })

  it('does not reproduce the master "blocked" tile — no confirmed rule exists', () => {
    const labels = buildStatusTiles(SUMMARY).map(t => t.label.toLowerCase())
    expect(labels).not.toContain('blocked')
    expect(labels).not.toContain('needs attention')
  })

  it('emits filter values the products BFF accepts', () => {
    for (const tile of buildStatusTiles(SUMMARY)) {
      if (tile.value === '') continue
      expect(KNOWN_STATUSES.has(tile.value)).toBe(true)
    }
  })
})

// ── Filter state ↔ URL query ─────────────────────────────────────────────────

describe('product filter query parsing', () => {
  it('defaults to an unfiltered first page', () => {
    expect(parseProductFilterQuery({})).toEqual(DEFAULT_PRODUCT_FILTERS)
  })

  it('keeps a known single status', () => {
    expect(parseProductFilterQuery({ status: 'published' }).status).toBe('published')
  })

  it('keeps the Draft & Review pair as a real two-status aggregate', () => {
    expect(normaliseStatusFilter('draft,review')).toBe('draft,review')
  })

  it('drops unknown status values instead of forwarding them', () => {
    expect(normaliseStatusFilter('draft,evil')).toBe('draft')
    expect(normaliseStatusFilter('needs_attention')).toBe('')
    expect(normaliseStatusFilter('DROP TABLE products')).toBe('')
  })

  it('de-duplicates repeated status values', () => {
    expect(normaliseStatusFilter('draft,draft,review')).toBe('draft,review')
  })

  it('accepts only integer category ids', () => {
    expect(normaliseCategoryFilter('3')).toBe('3')
    expect(normaliseCategoryFilter('3; DROP')).toBe('')
    expect(normaliseCategoryFilter('abc')).toBe('')
    expect(normaliseCategoryFilter('-1')).toBe('')
    expect(normaliseCategoryFilter(undefined)).toBe('')
  })

  it('trims and caps the search term at 200 characters', () => {
    expect(normaliseSearchFilter('  metal  ')).toBe('metal')
    expect(normaliseSearchFilter('x'.repeat(500))).toHaveLength(200)
  })

  it('never returns a page below 1', () => {
    expect(normalisePageNumber('0')).toBe(1)
    expect(normalisePageNumber('-4')).toBe(1)
    expect(normalisePageNumber('abc')).toBe(1)
    expect(normalisePageNumber('7')).toBe(7)
  })
})

describe('product filter query serialisation', () => {
  it('omits default values so a clean URL stays clean', () => {
    expect(buildProductFilterQuery(DEFAULT_PRODUCT_FILTERS)).toEqual({})
  })

  it('round-trips an active filter set (refresh keeps scope)', () => {
    const state = { status: 'draft,review', categoryId: '2', search: 'metal', page: 3 }
    const restored = parseProductFilterQuery(buildProductFilterQuery(state))
    expect(restored).toEqual(state)
  })

  it('round-trips a category scope arriving from a PC-02 link', () => {
    const restored = parseProductFilterQuery({ category_id: '5' })
    expect(restored.categoryId).toBe('5')
    expect(buildProductFilterQuery(restored)).toEqual({ category_id: '5' })
  })

  it('reports active filters for search, status and category', () => {
    expect(hasActiveProductFilters(DEFAULT_PRODUCT_FILTERS)).toBe(false)
    expect(hasActiveProductFilters({ ...DEFAULT_PRODUCT_FILTERS, search: 'lt' })).toBe(true)
    expect(hasActiveProductFilters({ ...DEFAULT_PRODUCT_FILTERS, status: 'draft' })).toBe(true)
    expect(hasActiveProductFilters({ ...DEFAULT_PRODUCT_FILTERS, categoryId: '1' })).toBe(true)
  })

  it('clearing filters returns to the default query (no residual scope)', () => {
    const cleared = { ...DEFAULT_PRODUCT_FILTERS }
    expect(buildProductFilterQuery(cleared)).toEqual({})
    expect(hasActiveProductFilters(cleared)).toBe(false)
  })
})

describe('filter state reaches the BFF as a real Directus filter', () => {
  it('Draft & Review becomes a two-value _in filter', () => {
    const statuses = normaliseStatusFilter('draft,review').split(',')
    const parts = buildProductsFilterParts(statuses, null, null)
    expect(parts).toEqual([
      'filter[status][_in][]=draft',
      'filter[status][_in][]=review',
    ])
  })

  it('a single status becomes an _eq filter', () => {
    const parts = buildProductsFilterParts(['published'], null, null)
    expect(parts).toEqual(['filter[status][_eq]=published'])
  })

  it('category scope and search are forwarded together', () => {
    const parts = buildProductsFilterParts(['draft'], '4', 'metal')
    expect(parts).toContain('filter[category_id][_eq]=4')
    expect(parts).toContain('search=metal')
  })

  it('client and server agree on the known status vocabulary', () => {
    expect(new Set(PRODUCT_STATUS_VALUES)).toEqual(KNOWN_STATUSES)
  })
})

// ── 375px card list ──────────────────────────────────────────────────────────

const PRODUCT = {
  id: 7,
  status: 'published' as const,
  slug: 'lt-3000f',
  name_en: 'LT-3000F Metal Detector',
  name_es: null,
  name_pt: null,
  product_code: 'LT-3000F',
  model_or_series: 'LT series',
  summary_en: 'High sensitivity metal detector.',
  summary_es: null,
  summary_pt: null,
  category_id: 2,
  page_preset_id: null,
  published_at: null,
  review_notes: null,
  date_created: null,
  date_updated: '2026-09-01T10:00:00Z',
  hero_image: '11111111-2222-3333-4444-555555555555',
  seo_title_en: null,
  seo_description_en: null,
  seo_noindex: null,
}

const CATEGORIES = [
  { id: 1, slug: 'x-ray', name_en: 'X-ray Inspection', intro_en: null, total: 4, by_status: { draft: 1, review: 0, published: 3, archived: 0 } },
  { id: 2, slug: 'metal-detection', name_en: 'Metal Detection', intro_en: 'Metal detection systems.', total: 8, by_status: { draft: 2, review: 1, published: 5, archived: 0 } },
]

describe('375px product card model', () => {
  it('exposes only fields the products BFF actually returns', () => {
    const card = buildProductCardModel(PRODUCT, categoryNameFor(CATEGORIES, PRODUCT.category_id))
    expect(card).toEqual({
      id: 7,
      name: 'LT-3000F Metal Detector',
      code: 'LT-3000F',
      model: 'LT series',
      categoryName: 'Metal Detection',
      status: 'published',
      thumbUrl: '/api/admin/asset/11111111-2222-3333-4444-555555555555?width=96&height=96&fit=cover&quality=70',
      detailRoute: '/admin/products/7',
    })
  })

  it('carries no readiness, completeness, media or source value', () => {
    const card = buildProductCardModel(PRODUCT, 'Metal Detection')
    const keys = Object.keys(card)
    expect(keys).not.toContain('readiness')
    expect(keys).not.toContain('completeness')
    expect(keys).not.toContain('mediaCount')
    expect(keys).not.toContain('sourceStatus')
  })

  it('falls back to no thumbnail when no hero image is linked', () => {
    const card = buildProductCardModel({ ...PRODUCT, hero_image: null }, 'Metal Detection')
    expect(card.thumbUrl).toBeNull()
  })

  it('states an unclassified product honestly instead of inventing a category', () => {
    const card = buildProductCardModel({ ...PRODUCT, category_id: null }, categoryNameFor(CATEGORIES, null))
    expect(card.categoryName).toBe('Uncategorised')
  })

  it('shows the raw id when a category is missing from the summary list', () => {
    expect(categoryNameFor(CATEGORIES, 99)).toBe('ID 99')
  })
})

// ── Asset and route contracts ────────────────────────────────────────────────

describe('image and route contracts', () => {
  it('always addresses images through the hardened admin proxy', () => {
    const url = adminAssetUrl('abc-123', { width: 80, height: 80 })
    expect(url.startsWith('/api/admin/asset/')).toBe(true)
    expect(url).not.toContain('8055')
    expect(url).not.toContain('http')
    expect(url).not.toContain('/assets/')
  })

  it('encodes the asset id', () => {
    expect(adminAssetUrl('a/../b', { width: 40, height: 40 })).toContain('a%2F..%2Fb')
  })

  it('links to routes that exist in pages/admin (no /edit route exists)', () => {
    expect(productDetailRoute(7)).toBe('/admin/products/7')
    expect(productDetailRoute(7)).not.toContain('/edit')
    expect(categoryContextRoute(3)).toBe('/admin/products/categories/3')
  })
})

// ── Gate discipline ──────────────────────────────────────────────────────────

describe('gate discipline (CH-DG-10 / CH-DG-11 / CH-DG-12 / BP-DG-01 / BP-DG-02 / BP-DG-05 / BP-DG-06)', () => {
  it('Category Health renders exactly the mandated unavailable text', () => {
    expect(CATEGORY_HEALTH_UNAVAILABLE).toBe('Not assessed — rule not configured')
    expect(CATEGORY_HEALTH_UNAVAILABLE).not.toMatch(/\d/)
    expect(CATEGORY_HEALTH_UNAVAILABLE).not.toContain('%')
  })

  it('Product Control shows no readiness, completeness, media or source value', () => {
    const source = repoFile('components/admin/product/ProductControlPanel.vue').toLowerCase()
    expect(source).not.toContain('readiness')
    expect(source).not.toContain('completeness')
    expect(source).not.toContain('linked media')
    expect(source).not.toContain('source review')
  })

  it('the catalogue rail does not offer Needs attention without a confirmed rule', () => {
    const source = repoFile('components/admin/product/ProductCentreSidebar.vue').toLowerCase()
    expect(source).not.toContain('needs attention')
  })

  it('no Product Centre surface renders a Category Health score or colour result', () => {
    for (const file of [
      'pages/admin/products/categories/index.vue',
      'components/admin/product/CategoryContextPanel.vue',
    ]) {
      const source = repoFile(file)
      // Gate identifiers such as CH-DG-10 are allowed; a rendered score is not.
      expect(renderedMarkup(source)).not.toMatch(/\d+\s*%/)
      expect(renderedMarkup(source)).not.toMatch(/avg\.?\s*readiness/i)
      expect(source).toContain('CATEGORY_HEALTH_UNAVAILABLE')
    }
  })
})

// ── Pagination labels ────────────────────────────────────────────────────────

describe('pagination', () => {
  it('reports a real inclusive range', () => {
    expect(pageRangeLabel(1, 20, 128)).toBe('1–20 of 128 products')
    expect(pageRangeLabel(7, 20, 128)).toBe('121–128 of 128 products')
  })

  it('states an empty result honestly', () => {
    expect(pageRangeLabel(1, 20, 0)).toBe('0 products')
  })

  it('computes the page count from the real filtered total', () => {
    expect(totalPageCount(128, 20)).toBe(7)
    expect(totalPageCount(0, 20)).toBe(0)
    expect(totalPageCount(20, 20)).toBe(1)
  })
})

// ── Source evidence: BFF boundaries that only run inside Nitro ───────────────

describe('products BFF output allow-list (source evidence)', () => {
  const source = repoFile('server/api/admin/products/index.get.ts')

  it('returns the fields the Product Control panel and thumbnails need', () => {
    expect(source).toContain('summary_en')
    expect(source).toContain('hero_image')
  })

  it('keeps internal review notes out of the list DTO', () => {
    const fieldsLine = source.split('\n').find(l => l.startsWith('const FIELDS'))!
    expect(fieldsLine).not.toContain('review_notes')
  })

  it('still validates every user-supplied query parameter', () => {
    expect(source).toContain('filterKnownStatuses')
    expect(source).toContain('validateCategoryId')
    expect(source).toContain('sanitizeSearch')
    expect(source).toContain('parsePageNum')
    expect(source).toContain('parseLimitNum')
  })
})

describe('categories-summary output allow-list (source evidence)', () => {
  const source = repoFile('server/api/admin/categories-summary.get.ts')

  it('requests an explicit field list rather than all fields', () => {
    expect(source).toContain('fields=id,slug,name_en,intro_en')
    expect(source).not.toContain('fields=*')
  })

  it('returns intro_en for the category context block', () => {
    expect(source).toContain('intro_en: cat.intro_en ?? null')
  })
})

describe('Product Centre pages render no fabricated indicator (source evidence)', () => {
  const pages = [
    'pages/admin/products/index.vue',
    'pages/admin/products/categories/index.vue',
    'pages/admin/products/categories/[id].vue',
  ]

  it('no page hard-codes a percentage value', () => {
    for (const page of pages) {
      expect(repoFile(page)).not.toMatch(/>\s*\d{1,3}%\s*</)
    }
  })

  it('no page implements an AI or import affordance (CF-5 — belongs to IMP-01)', () => {
    for (const page of pages) {
      const source = repoFile(page).toLowerCase()
      expect(source).not.toContain('ai batch')
      expect(source).not.toContain('import workbook')
      expect(source).not.toContain('/admin/import')
    }
  })

  it('category routes render the mandated Category Health text', () => {
    expect(repoFile('pages/admin/products/categories/index.vue')).toContain('CATEGORY_HEALTH_UNAVAILABLE')
    expect(repoFile('components/admin/product/CategoryContextPanel.vue'))
      .toContain('CATEGORY_HEALTH_UNAVAILABLE')
  })
})

describe('mandatory four-part Product Centre structure (source evidence)', () => {
  const routes = [
    'pages/admin/products/index.vue',
    'pages/admin/products/categories/index.vue',
    'pages/admin/products/categories/[id].vue',
  ]

  it('every Product Centre route mounts the Product Catalogue rail', () => {
    for (const route of routes) {
      expect(repoFile(route)).toContain('ProductCentreSidebar')
    }
  })

  it('every Product Centre route mounts a persistent right control rail', () => {
    for (const route of routes) {
      const source = repoFile(route)
      const hasControl = source.includes('ProductControlPanel')
        || source.includes('CategoryContextPanel')
      expect(hasControl).toBe(true)
    }
  })

  it('the control rail is a layout column, not a pop-up rendered only on selection', () => {
    const source = repoFile('pages/admin/products/index.vue')
    // The panel is always in the tree; its own stylesheet turns it into a drawer below 1024px.
    expect(source).toMatch(/<ProductControlPanel\s+:product="selectedProduct"/)
    expect(source).not.toMatch(/<ProductControlPanel[^>]*v-if="selectedProduct"/)
  })

  it('the rail carries the Product Catalogue heading, System views and Product taxonomy', () => {
    const rail = repoFile('components/admin/product/ProductCentreSidebar.vue')
    expect(rail).toContain('Product Catalogue')
    expect(rail).toContain('System views')
    expect(rail).toContain('Product taxonomy')
    for (const view of ['All Products', 'Draft & Review', 'Published', 'Archived']) {
      expect(rail).toContain(view)
    }
  })

  it('taxonomy entries navigate to real category context routes with real counts', () => {
    const rail = repoFile('components/admin/product/ProductCentreSidebar.vue')
    expect(rail).toContain('categoryContextRoute(cat.id)')
    expect(rail).toContain('{{ cat.total }}')
  })

  it('category pills are not used as a taxonomy substitute on PC-01', () => {
    const source = repoFile('pages/admin/products/index.vue')
    expect(source).not.toContain('category-chip')
    expect(source).not.toContain('category-strip')
  })

  it('the rail stays visible as a band down to 768px instead of disappearing', () => {
    const rail = repoFile('components/admin/product/ProductCentreSidebar.vue')
    const accordionBlock = rail.slice(rail.indexOf('@media (max-width: 767px)'))
    // The collapse-to-accordion behaviour is scoped to ≤767px only.
    expect(accordionBlock).toContain('.rail-content {\n    display: none;')
    expect(rail.slice(0, rail.indexOf('@media (max-width: 767px)'))).not.toContain('.rail-content { display: none; }')
  })
})

describe('375px contract (source evidence)', () => {
  it('PC-01 swaps the table for the card list instead of scrolling it sideways', () => {
    const source = repoFile('pages/admin/products/index.vue')
    expect(source).toContain('.table-wrap { display: none; }')
    expect(source).toContain('.card-list { display: block; }')
    expect(source).not.toContain('overflow-x: auto')
    expect(source).not.toContain('overflow-x: hidden')
  })

  it('PC-02 category context does the same', () => {
    const source = repoFile('pages/admin/products/categories/[id].vue')
    expect(source).toContain('.table-wrap { display: none; }')
    expect(source).toContain('.card-list { display: block; }')
    expect(source).not.toContain('overflow-x: hidden')
  })

  it('PC-02 category overview replaces its table with cards', () => {
    const source = repoFile('pages/admin/products/categories/index.vue')
    expect(source).toContain('.table-wrap { display: none; }')
    expect(source).not.toContain('min-width: 700px')
    expect(source).not.toContain('overflow-x: hidden')
  })

  it('no Product Centre table declares a desktop min-width that would force sideways scrolling', () => {
    for (const page of [
      'pages/admin/products/index.vue',
      'pages/admin/products/categories/index.vue',
      'pages/admin/products/categories/[id].vue',
    ]) {
      expect(repoFile(page)).not.toMatch(/table\s*\{[^}]*min-width/)
    }
  })
})

/**
 * Register §7 allows Chinese in non-rendered source comments; it forbids Chinese in
 * anything an operator can see or hear. These checks therefore strip comments first.
 */
function renderedMarkup(source: string): string {
  return source
    .slice(source.indexOf('<template>'), source.indexOf('</template>'))
    .replace(/<!--[\s\S]*?-->/g, '')
}

describe('shared admin shell is English-first (source evidence)', () => {
  it('layouts/admin.vue has no visible or assistive Chinese string', () => {
    expect(renderedMarkup(repoFile('layouts/admin.vue'))).not.toMatch(/[一-鿿]/)
  })

  it('Product Centre routes and components have no Chinese in their templates', () => {
    for (const file of [
      'pages/admin/products/index.vue',
      'pages/admin/products/categories/index.vue',
      'pages/admin/products/categories/[id].vue',
      'components/admin/product/ProductCentreSidebar.vue',
      'components/admin/product/ProductControlPanel.vue',
      'components/admin/product/ProductCardList.vue',
      'components/admin/product/ProductStatusTiles.vue',
      'components/admin/product/CategoryContextPanel.vue',
    ]) {
      expect(repoFile(file)).not.toMatch(/[一-鿿]/)
    }
  })
})
