/**
 * FINAL-RELEASE-FIX-C — public route correctness, locale isolation and fixture fail-closed
 * (FINAL-RELEASE-AUDIT-01 P1-01 … P1-04; RELEASE-SAFETY-GATES RSG-05, RSG-08; D-009, D-020, D-035).
 *
 * The real public CMS API handlers (products, legacy posts, home) run on an h3 app behind a real
 * `node:http` server. Only the edges are replaced: the Nitro `useRuntimeConfig` global and the Directus
 * fetch, an in-memory double that applies the same `_eq` / `_in` filters Directus applies. The page
 * contract is tested through the shared helpers every Product and legacy posts page calls, plus source
 * checks that each page uses them before loading data. No real Directus and no network.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, createRouter, toNodeListener } from 'h3'
import categoriesHandler from '../server/api/cms/products/categories.get'
import categoryHandler from '../server/api/cms/products/[category].get'
import productHandler from '../server/api/cms/products/[category]/[slug].get'
import postsHandler from '../server/api/cms/posts/index.get'
import postHandler from '../server/api/cms/posts/[slug].get'
import homeHandler from '../server/api/cms/home.get'
import { requireCmsSource, resolveCmsSource, type CmsModeKey } from '../server/utils/cmsSource'
import { designatedHeroFileId } from '../server/utils/productHero'
import { legacyBodyFileIds, legacyPostHtml } from '../server/utils/legacyPosts'
import { absoluteSiteUrl, isPublishedLocale, publicPageStatus } from '../utils/publicRoute'
import { useSeoHead } from '../composables/useSeoHead'
import { ref } from 'vue'

type Row = Record<string, unknown>

const directus = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  failing: new Set<string>(),
  calls: [] as string[],
}))

vi.mock('../server/utils/directus', () => ({
  directusFetch: async (path: string) => {
    directus.calls.push(path)
    const [base, query = ''] = path.split('?')
    // `/files` is Directus's endpoint for the directus_files system collection.
    const table = base === '/files' ? 'directus_files' : base!.replace('/items/', '')
    if (directus.failing.has(table)) throw new Error(`fetch failed (${table})`)
    let rows = directus.tables[table] ?? []
    const params = new URLSearchParams(query)
    for (const [key, value] of params) {
      const eq = key.match(/^filter\[(\w+)\]\[_eq\]$/)
      if (eq) rows = rows.filter(row => String(row[eq[1]!]) === value)
      const within = key.match(/^filter\[(\w+)\]\[_in\]$/)
      if (within) rows = rows.filter(row => value.split(',').includes(String(row[within[1]!])))
    }
    // As in Directus, `limit=-1` means every row.
    const limit = Number(params.get('limit') ?? rows.length)
    return { data: limit < 0 ? rows : rows.slice(0, limit) }
  },
}))

const config: { cmsMode: string | undefined, productsCmsMode: string | undefined, public: { publishedLocales: string[], siteUrl?: string } } = {
  cmsMode: 'directus',
  productsCmsMode: 'directus',
  public: { publishedLocales: ['en'] },
}

const MARK = 'TEST ONLY — NOT FOR PUBLICATION'
const PRODUCT_TABLES = ['product_categories', 'products', 'products_files', 'product_spec_groups', 'product_spec_items', 'product_faqs', 'product_sections', 'product_section_items']

const nulls = (...fields: string[]): Row => Object.fromEntries(fields.map(field => [field, null]))

function category(overrides: Row): Row {
  return {
    ...nulls('name_es', 'name_pt', 'intro_es', 'intro_pt', 'hero_image', 'seo_title_en', 'seo_title_es', 'seo_title_pt', 'seo_description_en', 'seo_description_es', 'seo_description_pt'),
    intro_en: 'TEST ONLY intro', seo_noindex: true, sort: 1, ...overrides,
  }
}

function product(overrides: Row): Row {
  return {
    ...nulls('name_es', 'name_pt', 'model_or_series', 'summary_es', 'summary_pt', 'hero_image', 'seo_title_en', 'seo_title_es', 'seo_title_pt', 'seo_description_en', 'seo_description_es', 'seo_description_pt', 'seo_image'),
    summary_en: 'TEST ONLY summary', highlights: [], specifications: [], related_product_slugs: [], application_slugs: [], seo_noindex: true, ...overrides,
  }
}

function post(overrides: Row): Row {
  return {
    ...nulls('author', 'faq_group', 'cover_image', 'seo_og_image', 'seo_title_en', 'seo_title_es', 'seo_title_pt', 'seo_description_en', 'seo_description_es', 'seo_description_pt'),
    publish_date: '2026-09-01T00:00:00.000Z', topics: [], related_product_slugs: [], related_application_slugs: [],
    title_es: '', title_pt: '', excerpt_en: 'TEST ONLY excerpt', excerpt_es: '', excerpt_pt: '', body_en: '<p>TEST ONLY body</p>', body_es: '', body_pt: '',
    ...overrides,
  }
}

function seed(): void {
  directus.tables = {
    product_categories: [
      category({ id: 1, slug: 'test-only-category', status: 'published', name_en: `${MARK} category` }),
      category({ id: 2, slug: 'test-only-draft-category', status: 'draft', name_en: `${MARK} draft category` }),
    ],
    products: [
      product({ id: 10, slug: 'test-only-product', category_id: 1, status: 'published', name_en: `${MARK} product` }),
      product({ id: 11, slug: 'test-only-draft-product', category_id: 1, status: 'draft', name_en: `${MARK} draft product` }),
    ],
    products_files: [{ id: 100, products_id: 10, directus_files_id: '11111111-1111-4111-8111-111111111111', file_role: 'gallery', sort: 1, alt_en: 'TEST ONLY alt', alt_es: null, alt_pt: null, caption_en: null, enabled: true, version_label: null, file_date: null }],
    product_spec_groups: [{ id: 200, product_id: 10, title_en: 'TEST ONLY group', title_es: null, title_pt: null, description_en: null, description_es: null, description_pt: null, enabled: true, sort: 1 }],
    product_spec_items: [{ id: 300, spec_group_id: 200, label_en: 'TEST ONLY label', label_es: null, label_pt: null, value_en: 'TEST ONLY value', value_es: null, value_pt: null, note_en: null, sort: 1, enabled: true }],
    product_faqs: [{ id: 400, product_id: 10, question_en: 'TEST ONLY question', question_es: null, question_pt: null, answer_en: 'TEST ONLY answer', answer_es: null, answer_pt: null, enabled: true, sort: 1 }],
    product_sections: [{ id: 500, product_id: 10, type: 'text', title_en: 'TEST ONLY section', title_es: null, title_pt: null, eyebrow_en: null, eyebrow_es: null, eyebrow_pt: null, body_en: 'TEST ONLY section body', body_es: null, body_pt: null, layout_variant: null, media_id: null, external_url: null, enabled: true, sort: 1 }],
    product_section_items: [{ id: 600, section_id: 500, label_en: null, label_es: null, label_pt: null, title_en: 'TEST ONLY item', title_es: null, title_pt: null, body_en: 'TEST ONLY item body', body_es: null, body_pt: null, icon_key: null, sort: 1, enabled: true }],
    posts: [
      post({ id: 1, status: 'published', content_type: 'technical_guide', slug: 'test-only-guide', title_en: `${MARK} guide` }),
      post({ id: 2, status: 'draft', content_type: 'technical_guide', slug: 'test-only-draft-guide', title_en: `${MARK} draft guide` }),
    ],
    site_content: [],
    // The seeded gallery image is public: the page links a file only while RSG-06 allows it.
    directus_files: [{ id: '11111111-1111-4111-8111-111111111111', is_public: true, type: 'image/png', title: 'TEST ONLY gallery image', filename_download: 'test-only-gallery.png' }],
    media_file_lifecycle: [],
  }
  directus.failing.clear()
  directus.calls.length = 0
}

let server: Server
let port = 0

async function get(path: string): Promise<{ status: number, body: string, json: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`)
  const body = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(body)
  } catch {
    json = null
  }
  return { status: res.status, body, json }
}

async function withNodeEnv<T>(nodeEnv: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  try {
    return await run()
  } finally {
    process.env.NODE_ENV = previous
  }
}

beforeAll(async () => {
  vi.stubGlobal('useRuntimeConfig', () => config)
  const router = createRouter()
    .get('/api/cms/products/categories', categoriesHandler)
    .get('/api/cms/products/:category', categoryHandler)
    .get('/api/cms/products/:category/:slug', productHandler)
    .get('/api/cms/posts', postsHandler)
    .get('/api/cms/posts/:slug', postHandler)
    .get('/api/cms/home', homeHandler)
  const app = createApp({
    onError: (error, event) => {
      event.node.res.statusCode = error.statusCode
      event.node.res.setHeader('content-type', 'application/json')
      event.node.res.end(JSON.stringify({ statusCode: error.statusCode, message: error.message }))
    },
  })
  app.use(router)
  server = createServer(toNodeListener(app))
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  await new Promise<void>(done => server.close(() => done()))
  vi.unstubAllGlobals()
})

beforeEach(() => {
  seed()
  config.cmsMode = 'directus'
  config.productsCmsMode = 'directus'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FINAL-RELEASE-FIX-C — CMS source: DEMO fixtures never served in production (P1-04, D-020)', () => {
  it('resolveCmsSource: production serves Directus only; development and test may use fixtures', () => {
    expect(resolveCmsSource('directus', 'production')).toBe('directus')
    for (const mode of [undefined, null, '', 'fixtures', 'Directus', 'directus ', 'other']) {
      expect(resolveCmsSource(mode, 'production'), String(mode)).toBeNull()
    }
    expect(resolveCmsSource('fixtures', 'development')).toBe('fixtures')
    expect(resolveCmsSource('fixtures', 'test')).toBe('fixtures')
    expect(resolveCmsSource('directus', 'development')).toBe('directus')
  })

  it('requireCmsSource: production with CMS_MODE or CMS_MODE_PRODUCTS missing or fixtures fails with 503; both directus is allowed', async () => {
    await withNodeEnv('production', async () => {
      const cases: Array<[CmsModeKey, string | undefined]> = [
        ['cmsMode', undefined], ['cmsMode', 'fixtures'], ['productsCmsMode', undefined], ['productsCmsMode', 'fixtures'],
      ]
      for (const [key, mode] of cases) {
        config.cmsMode = 'directus'
        config.productsCmsMode = 'directus'
        config[key] = mode
        let thrown: { statusCode?: number } | null = null
        try {
          requireCmsSource(key)
        } catch (err) {
          thrown = err as { statusCode?: number }
        }
        expect(thrown?.statusCode, `${key}=${String(mode)}`).toBe(503)
      }
      config.cmsMode = 'directus'
      config.productsCmsMode = 'directus'
      expect(requireCmsSource('cmsMode')).toBe('directus')
      expect(requireCmsSource('productsCmsMode')).toBe('directus')
    })
    const logged = vi.mocked(console.error).mock.calls.map(args => args.join(' '))
    expect(logged).toContain('[cms] CMS_MODE must be "directus" in production; refusing to serve demo fixtures')
    expect(logged).toContain('[cms] CMS_MODE_PRODUCTS must be "directus" in production; refusing to serve demo fixtures')
  })

  it('a production server with a missing, empty or fixtures CMS mode answers 503 on every public CMS API and never serves a fixture', async () => {
    await withNodeEnv('production', async () => {
      for (const mode of [undefined, '', 'fixtures']) {
        config.cmsMode = mode
        config.productsCmsMode = mode
        for (const path of [
          '/api/cms/products/categories',
          '/api/cms/products/x-ray-inspection',
          '/api/cms/products/x-ray-inspection/any-product',
          '/api/cms/posts',
          '/api/cms/posts/weight-legislation-eu-prepacked-food',
          '/api/cms/home',
        ]) {
          const reply = await get(path)
          expect(reply.status, `${path} mode=${String(mode)}`).toBe(503)
          expect(reply.body).not.toMatch(/TODO_CONTENT|Weight Legislation|X-Ray Inspection|hero/)
        }
      }
    })
    expect(directus.calls).toEqual([])
  })

  it('development with fixtures explicitly configured still serves the DEMO fixtures', async () => {
    await withNodeEnv('development', async () => {
      config.cmsMode = 'fixtures'
      config.productsCmsMode = 'fixtures'
      const categories = await get('/api/cms/products/categories')
      expect(categories.status).toBe(200)
      expect((categories.json as Array<{ slug: string }>).map(c => c.slug)).toContain('x-ray-inspection')
      expect((await get('/api/cms/posts/weight-legislation-eu-prepacked-food')).status).toBe(200)
      expect(await get('/api/cms/home')).toMatchObject({ status: 200, json: { hero: null } })
    })
    expect(directus.calls).toEqual([])
  })

  it('a production server configured for Directus is served from Directus', async () => {
    await withNodeEnv('production', async () => {
      const categories = await get('/api/cms/products/categories')
      expect(categories.status).toBe(200)
      expect((categories.json as Array<{ slug: string }>).map(c => c.slug)).toEqual(['test-only-category'])
    })
  })
})

describe('FINAL-RELEASE-FIX-C — product API error semantics (P1-02)', () => {
  it('categories: published categories 200; an empty catalogue is a valid empty 200; Directus unavailable is 503', async () => {
    expect(await get('/api/cms/products/categories')).toMatchObject({ status: 200 })
    directus.tables.product_categories = []
    expect(await get('/api/cms/products/categories')).toMatchObject({ status: 200, json: [] })
    directus.failing.add('product_categories')
    expect((await get('/api/cms/products/categories')).status).toBe(503)
  })

  it('category: published category 200 with its published products only; missing or draft category 404', async () => {
    const reply = await get('/api/cms/products/test-only-category')
    expect(reply.status).toBe(200)
    const json = reply.json as { category: { slug: string }, products: Array<{ slug: string }> }
    expect(json.category.slug).toBe('test-only-category')
    expect(json.products.map(p => p.slug)).toEqual(['test-only-product'])
    expect(json).not.toHaveProperty('cmsError')
    expect((await get('/api/cms/products/missing-category')).status).toBe(404)
    expect((await get('/api/cms/products/test-only-draft-category')).status).toBe(404)
  })

  it('category: a category or product-list failure is 503, never a 200 category with an empty list', async () => {
    directus.failing.add('products')
    expect((await get('/api/cms/products/test-only-category')).status).toBe(503)
    directus.failing.clear()
    directus.failing.add('product_categories')
    expect((await get('/api/cms/products/test-only-category')).status).toBe(503)
  })

  it('detail: a published product is 200 with specs, FAQ, sections and media; a missing or draft product, or a missing category, is 404', async () => {
    const reply = await get('/api/cms/products/test-only-category/test-only-product')
    expect(reply.status).toBe(200)
    const json = reply.json as { specGroups: unknown[], faqs: unknown[], sections: unknown[], gallery: unknown[] }
    expect(json.specGroups).toHaveLength(1)
    expect(json.faqs).toHaveLength(1)
    expect(json.sections).toHaveLength(1)
    expect(json.gallery).toHaveLength(1)
    expect((await get('/api/cms/products/test-only-category/missing-product')).status).toBe(404)
    expect((await get('/api/cms/products/test-only-category/test-only-draft-product')).status).toBe(404)
    expect((await get('/api/cms/products/missing-category/test-only-product')).status).toBe(404)
  })

  it('detail: any failing query — category, product, media, spec groups, spec items, FAQ, sections, section items — is 503, never a partial 200', async () => {
    for (const table of PRODUCT_TABLES) {
      directus.failing.clear()
      directus.failing.add(table)
      const reply = await get('/api/cms/products/test-only-category/test-only-product')
      expect(reply.status, table).toBe(503)
      expect(reply.body).not.toContain('TEST ONLY')
    }
  })
})

describe('FINAL-RELEASE-FIX-C — legacy posts API error semantics (P1-01)', () => {
  it('an existing published Technical Guide is 200; a missing or draft slug is 404; Directus unavailable is 503', async () => {
    const reply = await get('/api/cms/posts/test-only-guide')
    expect(reply.status).toBe(200)
    expect((reply.json as { title: { en: string } }).title.en).toBe(`${MARK} guide`)
    expect((await get('/api/cms/posts/missing-guide')).status).toBe(404)
    expect((await get('/api/cms/posts/test-only-draft-guide')).status).toBe(404)
    directus.failing.add('posts')
    expect((await get('/api/cms/posts/test-only-guide')).status).toBe(503)
  })
})

describe('FINAL-RELEASE-FIX-C — public page contract (P1-01, P1-02, P1-03)', () => {
  it('isPublishedLocale: only a locale in runtimeConfig.public.publishedLocales is public', () => {
    expect(isPublishedLocale('en', ['en'])).toBe(true)
    for (const locale of ['es', 'pt', 'fr', '', undefined, null]) {
      expect(isPublishedLocale(locale, ['en']), String(locale)).toBe(false)
    }
    expect(isPublishedLocale('en', undefined)).toBe(false)
    expect(isPublishedLocale('es', ['en', 'es'])).toBe(true)
  })

  it('publicPageStatus: API 404 / 4xx → 404; API 5xx or unreachable → 503; no data → 404; data → render (valid EN or empty list)', () => {
    expect(publicPageStatus({ statusCode: 404 }, false)).toBe(404)
    expect(publicPageStatus({ statusCode: 400 }, false)).toBe(404)
    expect(publicPageStatus({ statusCode: 503 }, false)).toBe(503)
    expect(publicPageStatus({ statusCode: 500 }, false)).toBe(503)
    expect(publicPageStatus({}, false)).toBe(503)
    expect(publicPageStatus(null, false)).toBe(404)
    expect(publicPageStatus(null, true)).toBeNull()
    expect(publicPageStatus(undefined, true)).toBeNull()
  })
})

describe('FINAL-RELEASE-FIX-C — public page and API sources', () => {
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
  const PAGES = [
    'pages/products/index.vue',
    'pages/products/[category]/index.vue',
    'pages/products/[category]/[slug].vue',
    'pages/resources/technical-guides/[slug].vue',
    'pages/support/faq.vue',
  ]
  const APIS = [
    'server/api/cms/products/categories.get.ts',
    'server/api/cms/products/[category].get.ts',
    'server/api/cms/products/[category]/[slug].get.ts',
    'server/api/cms/posts/index.get.ts',
    'server/api/cms/posts/[slug].get.ts',
    'server/api/cms/home.get.ts',
  ]

  it('every Product and legacy posts page asserts a published locale before loading any data', () => {
    for (const file of PAGES) {
      const text = source(file)
      const guard = text.indexOf('assertPublishedLocale()')
      const load = Math.min(...['useAsyncData', 'usePostDetail('].map(key => text.indexOf(key)).filter(index => index >= 0))
      expect(guard, file).toBeGreaterThan(-1)
      expect(guard, file).toBeLessThan(load)
    }
  })

  it('Product and Technical Guide pages answer with the upstream status through publicPageStatus and a fatal error', () => {
    for (const file of PAGES.filter(page => !page.endsWith('faq.vue'))) {
      const text = source(file)
      expect(text, file).toContain('publicPageStatus(')
      expect(text, file).toContain('fatal: true')
      expect(text, file).not.toMatch(/statusCode: 404, statusMessage: '(Product|Category) not found'/)
    }
  })

  it('the Technical Guide detail awaits its data before deciding the status', () => {
    expect(source('composables/usePostDetail.ts')).toMatch(/await useAsyncData/)
    expect(source('pages/resources/technical-guides/[slug].vue')).toMatch(/await usePostDetail\(/)
  })

  it('no Product or legacy posts presentation path reads the English field in place of the current locale', () => {
    for (const file of [...PAGES, 'pages/resources/index.vue', 'composables/usePostDetail.ts']) {
      expect(source(file), file).not.toMatch(/\.en\b/)
    }
  })

  it('the public CMS APIs choose between Directus and fixtures only through requireCmsSource', () => {
    for (const file of APIS) {
      const text = source(file)
      expect(text, file).toContain('requireCmsSource(')
      expect(text, file).not.toMatch(/useRuntimeConfig|#imports/)
    }
  })

  it('the product detail API has no non-fatal query: every catch rethrows', () => {
    const text = source('server/api/cms/products/[category]/[slug].get.ts')
    expect(text).not.toMatch(/non-fatal|use empty arrays/)
    const catches = text.match(/ {2}catch \(err\) \{[\s\S]*?\n {2}\}/g) ?? []
    expect(catches).toHaveLength(6)
    for (const block of catches) expect(block).toMatch(/throw /)
  })

  it('the FAQ page shows its unavailable state, never an empty list, when the FAQ request fails', () => {
    expect(source('pages/support/faq.vue')).toMatch(/cmsError = computed\(\(\) => Boolean\(faqError\.value\) \|\|/)
  })

  it('the error page tells a 5xx from a 404, and .env.example names both CMS modes', () => {
    expect(source('error.vue')).toMatch(/statusCode >= 500/)
    const env = source('.env.example')
    expect(env).toMatch(/^CMS_MODE=/m)
    expect(env).toMatch(/^CMS_MODE_PRODUCTS=/m)
  })
})

describe('LITUBO-HERO-FIX-01 — a category card shows the hero the product media editor designates, only when RSG-06 allows it', () => {
  const HERO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const PRIVATE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const ARCHIVED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

  const heroLink = (id: number, fileId: string, overrides: Row = {}): Row => ({
    id, products_id: 10, directus_files_id: fileId, file_role: 'hero', sort: null,
    alt_en: null, alt_es: null, alt_pt: null, caption_en: null, enabled: true, version_label: null, file_date: null, ...overrides,
  })
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY image', filename_download: `${id}.png` })

  async function card(): Promise<{ status: number, body: string, hero: { id: string, url: string } | null }> {
    const reply = await get('/api/cms/products/test-only-category')
    const json = reply.json as { products?: Array<{ slug: string, heroMedia: { id: string, url: string } }> } | null
    return { status: reply.status, body: reply.body, hero: json?.products?.find(p => p.slug === 'test-only-product')?.heroMedia ?? null }
  }

  beforeEach(() => {
    directus.tables.directus_files!.push(file(HERO, true), file(OTHER, true), file(PRIVATE, false), file(ARCHIVED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('the shared rule: the first enabled hero link (lowest sort, then lowest id), else products.hero_image', () => {
    expect(designatedHeroFileId([], null)).toBeNull()
    expect(designatedHeroFileId([], OTHER)).toBe(OTHER)
    expect(designatedHeroFileId([{ directus_files_id: HERO, file_role: 'gallery' }], OTHER)).toBe(OTHER)
    expect(designatedHeroFileId([{ directus_files_id: HERO, file_role: 'hero', enabled: false }], OTHER)).toBe(OTHER)
    expect(designatedHeroFileId([{ directus_files_id: HERO, file_role: 'hero' }], OTHER)).toBe(HERO)
    expect(designatedHeroFileId([
      { id: 2, directus_files_id: OTHER, file_role: 'hero', sort: null },
      { id: 3, directus_files_id: PRIVATE, file_role: 'hero', sort: 5 },
      { id: 1, directus_files_id: HERO, file_role: 'hero', sort: 5 },
    ], null)).toBe(HERO)
  })

  it('the defect: a hero set in the product media editor, with no products.hero_image, now reaches the card', async () => {
    directus.tables.products_files!.push(heroLink(101, HERO))
    expect(await card()).toMatchObject({ status: 200, hero: { id: HERO, url: `/api/cms/media/${HERO}` } })
  })

  it('an existing product that only has products.hero_image keeps its card image', async () => {
    directus.tables.products![0]!.hero_image = OTHER
    expect((await card()).hero).toMatchObject({ id: OTHER, url: `/api/cms/media/${OTHER}` })
  })

  it('the designated hero link wins over products.hero_image, and replacing the hero changes the card', async () => {
    directus.tables.products![0]!.hero_image = OTHER
    directus.tables.products_files!.push(heroLink(101, HERO))
    expect((await card()).hero?.id).toBe(HERO)
    directus.tables.products_files = directus.tables.products_files!.map(row => (row.id === 101 ? { ...row, file_role: 'gallery' } : row))
    directus.tables.products_files.push(heroLink(102, OTHER))
    expect((await card()).hero?.id).toBe(OTHER)
  })

  it('RSG-06: a private or archived hero is not emitted and nothing is substituted — its id never appears', async () => {
    directus.tables.products![0]!.hero_image = OTHER // public, but not the designated hero
    for (const blocked of [PRIVATE, ARCHIVED]) {
      directus.tables.products_files = directus.tables.products_files!.filter(row => row.file_role !== 'hero')
      directus.tables.products_files.push(heroLink(101, blocked))
      const reply = await card()
      expect(reply.status, blocked).toBe(200)
      expect(reply.hero, blocked).toMatchObject({ id: '', url: '' })
      expect(reply.body, blocked).not.toContain(blocked)
    }
  })

  it('a disabled hero link does not count', async () => {
    directus.tables.products_files!.push(heroLink(101, HERO, { enabled: false }))
    expect((await card()).hero).toMatchObject({ id: '', url: '' })
  })

  it('a failed hero-link or media-eligibility read is 503, never a card that guesses', async () => {
    directus.tables.products_files!.push(heroLink(101, HERO))
    for (const table of ['products_files', 'directus_files', 'media_file_lifecycle']) {
      directus.failing.clear()
      directus.failing.add(table)
      expect((await card()).status, table).toBe(503)
    }
  })

  it('the product page and its card pick the same hero; the page gallery is unchanged', async () => {
    directus.tables.products_files!.push(heroLink(101, HERO))
    const detail = await get('/api/cms/products/test-only-category/test-only-product')
    const json = detail.json as { heroMedia: { id: string }, gallery: unknown[] }
    expect(json.heroMedia.id).toBe(HERO)
    expect(json.gallery).toHaveLength(1)
    expect((await card()).hero?.id).toBe(HERO)
  })
})

describe('LITUBO-PUBLIC-MEDIA-CLOSEOUT-01 — the product page gallery, hero and downloads, and a category\'s own image, link only files RSG-06 allows', () => {
  const GALLERY = '11111111-1111-4111-8111-111111111111' // the seeded public gallery image
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const ARCHIVED = '99999999-9999-4999-8999-999999999999'
  const DISABLED = '88888888-8888-4888-8888-888888888888' // public file, but its product link is disabled
  const PAGE = '/api/cms/products/test-only-category/test-only-product'

  type Media = { id: string, url: string }
  const link = (id: number, fileId: string, role: string, sort: number, overrides: Row = {}): Row => ({
    id, products_id: 10, directus_files_id: fileId, file_role: role, sort,
    alt_en: `TEST ONLY alt ${id}`, alt_es: null, alt_pt: null, caption_en: null, enabled: true, version_label: null, file_date: null, ...overrides,
  })
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })

  async function page(): Promise<{ status: number, body: string, json: { heroMedia: Media, gallery: unknown[], downloads: unknown[] } }> {
    const reply = await get(PAGE)
    return { ...reply, json: reply.json as { heroMedia: Media, gallery: unknown[], downloads: unknown[] } }
  }

  async function categoryImages(): Promise<{ page: Media | undefined, list: Media | undefined, bodies: string }> {
    const categoryPage = await get('/api/cms/products/test-only-category')
    const list = await get('/api/cms/products/categories')
    expect([categoryPage.status, list.status]).toEqual([200, 200])
    return {
      page: (categoryPage.json as { category: { heroMedia: Media } }).category.heroMedia,
      list: (list.json as Array<{ slug: string, heroMedia: Media }>).find(c => c.slug === 'test-only-category')?.heroMedia,
      bodies: categoryPage.body + list.body,
    }
  }

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false), file(ARCHIVED, true), file(DISABLED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('gallery: public images keep their order; private, archived and disabled ones are left out and their ids never appear', async () => {
    directus.tables.products_files!.push(
      link(101, PRIVATE, 'gallery', 2),
      link(102, PUBLIC, 'gallery', 3),
      link(103, ARCHIVED, 'gallery', 4),
      link(104, DISABLED, 'gallery', 5, { enabled: false }),
    )
    const reply = await page()
    expect(reply.status).toBe(200)
    expect(reply.json.gallery).toEqual([
      { id: GALLERY, url: `/api/cms/media/${GALLERY}`, alt: { en: 'TEST ONLY alt', es: '', pt: '' } },
      { id: PUBLIC, url: `/api/cms/media/${PUBLIC}`, alt: { en: 'TEST ONLY alt 102', es: '', pt: '' } },
    ])
    for (const blocked of [PRIVATE, ARCHIVED, DISABLED]) expect(reply.body, blocked).not.toContain(blocked)
  })

  it('downloads: a public file keeps its download link, role, version and date; private, archived and disabled ones are left out', async () => {
    directus.tables.products_files!.push(
      link(111, PUBLIC, 'datasheet', 1, { version_label: 'v2', file_date: '2026-09-01' }),
      link(112, PRIVATE, 'manual', 2),
      link(113, ARCHIVED, 'certificate', 3),
      link(114, DISABLED, 'brochure', 4, { enabled: false }),
    )
    const reply = await page()
    expect(reply.status).toBe(200)
    expect(reply.json.downloads).toEqual([
      { uuid: PUBLIC, url: `/api/cms/media/${PUBLIC}?download=true`, role: 'datasheet', versionLabel: 'v2', fileDate: '2026-09-01' },
    ])
    for (const blocked of [PRIVATE, ARCHIVED, DISABLED]) expect(reply.body, blocked).not.toContain(blocked)
  })

  it('hero: a private or archived designated hero is left out of the page as it is of the card, and nothing is substituted', async () => {
    directus.tables.products![0]!.hero_image = PUBLIC // public, but not the designated hero
    for (const blocked of [PRIVATE, ARCHIVED]) {
      directus.tables.products_files = directus.tables.products_files!.filter(row => row.file_role !== 'hero')
      directus.tables.products_files.push(link(121, blocked, 'hero', 1))
      const reply = await page()
      expect(reply.status, blocked).toBe(200)
      expect(reply.json.heroMedia, blocked).toMatchObject({ id: '', url: '' })
      expect(reply.json.gallery, blocked).toHaveLength(1)
      expect(reply.body, blocked).not.toContain(blocked)
    }
  })

  it('category image: the category page and the category list emit it only while its file is public', async () => {
    directus.tables.product_categories![0]!.hero_image = PUBLIC
    let images = await categoryImages()
    expect(images.page).toMatchObject({ id: PUBLIC, url: `/api/cms/media/${PUBLIC}` })
    expect(images.list).toMatchObject({ id: PUBLIC, url: `/api/cms/media/${PUBLIC}` })
    for (const blocked of [PRIVATE, ARCHIVED]) {
      directus.tables.product_categories![0]!.hero_image = blocked
      images = await categoryImages()
      expect(images.page, blocked).toMatchObject({ id: '', url: '' })
      expect(images.list, blocked).toMatchObject({ id: '', url: '' })
      expect(images.bodies, blocked).not.toContain(blocked)
    }
  })

  it('a failed media-eligibility read is 503 on the product page and on both category APIs, never a page with unchecked files', async () => {
    directus.tables.product_categories![0]!.hero_image = PUBLIC
    for (const table of ['directus_files', 'media_file_lifecycle']) {
      directus.failing.clear()
      directus.failing.add(table)
      for (const path of [PAGE, '/api/cms/products/test-only-category', '/api/cms/products/categories']) {
        const reply = await get(path)
        expect(reply.status, `${path} (${table})`).toBe(503)
        expect(reply.body, `${path} (${table})`).not.toContain('TEST ONLY')
      }
    }
  })
})

describe('LITUBO-PUBLIC-MEDIA-CLOSEOUT-01 — section images, the product OG image and the home hero image link only files RSG-06 allows', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const ARCHIVED = '99999999-9999-4999-8999-999999999999'
  const PAGE = '/api/cms/products/test-only-category/test-only-product'

  type Media = { id: string, url: string, alt: Record<string, string> }
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })
  const link = (id: number, fileId: string, role: string): Row => ({
    id, products_id: 10, directus_files_id: fileId, file_role: role, sort: id,
    alt_en: `TEST ONLY alt ${id}`, alt_es: null, alt_pt: null, caption_en: null, enabled: true, version_label: null, file_date: null,
  })
  const section = (id: number, mediaId: number | null): Row => ({
    id, product_id: 10, type: 'text', title_en: `TEST ONLY section ${id}`, title_es: null, title_pt: null, eyebrow_en: null, eyebrow_es: null, eyebrow_pt: null,
    body_en: 'TEST ONLY section body', body_es: null, body_pt: null, layout_variant: null, media_id: mediaId, external_url: null, enabled: true, sort: id,
  })
  const homeHero = (heroImage: string | null): Row => ({
    id: 1, content_key: 'home.hero', status: 'published', hero_image: heroImage,
    ...nulls('eyebrow_en', 'eyebrow_es', 'eyebrow_pt', 'title_es', 'title_pt', 'body_en', 'body_es', 'body_pt', 'cta_primary_label_en', 'cta_primary_label_es', 'cta_primary_label_pt', 'cta_primary_path', 'cta_secondary_label_en', 'cta_secondary_label_es', 'cta_secondary_label_pt', 'cta_secondary_path'),
    title_en: 'TEST ONLY hero title',
  })

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false), file(ARCHIVED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('section images: a section links its image only while the file is public; a private or archived image is left out and the section stays', async () => {
    directus.tables.products_files!.push(link(131, PUBLIC, 'detail'), link(132, PRIVATE, 'application'), link(133, ARCHIVED, 'overview'))
    directus.tables.product_sections!.push(section(501, 131), section(502, 132), section(503, 133))
    const reply = await get(PAGE)
    expect(reply.status).toBe(200)
    const sections = (reply.json as { sections: Array<{ title: { en: string }, media?: Media }> }).sections
    expect(sections.map(s => s.title.en)).toEqual(['TEST ONLY section', 'TEST ONLY section 501', 'TEST ONLY section 502', 'TEST ONLY section 503'])
    expect(sections[1]!.media).toEqual({ id: PUBLIC, url: `/api/cms/media/${PUBLIC}`, alt: { en: 'TEST ONLY alt 131', es: '', pt: '' } })
    for (const index of [0, 2, 3]) expect(sections[index], String(index)).not.toHaveProperty('media')
    for (const blocked of [PRIVATE, ARCHIVED]) expect(reply.body, blocked).not.toContain(blocked)
  })

  it('OG image: seo.ogImage is emitted only while the file is public; a private or archived OG image is left out', async () => {
    directus.tables.products![0]!.seo_image = PUBLIC
    const shown = await get(PAGE)
    expect((shown.json as { seo: { ogImage?: string } }).seo.ogImage).toBe(`/api/cms/media/${PUBLIC}`)
    for (const blocked of [PRIVATE, ARCHIVED]) {
      directus.tables.products![0]!.seo_image = blocked
      const reply = await get(PAGE)
      expect(reply.status, blocked).toBe(200)
      expect((reply.json as { seo: object }).seo, blocked).not.toHaveProperty('ogImage')
      expect(reply.body, blocked).not.toContain(blocked)
    }
  })

  it('home hero: the image is emitted only while the file is public; a private or archived image is left out and the hero text stays', async () => {
    directus.tables.site_content = [homeHero(PUBLIC)]
    expect(await get('/api/cms/home')).toMatchObject({ status: 200, json: { hero: { imageUrl: `/api/cms/media/${PUBLIC}`, title: { en: 'TEST ONLY hero title' } } } })
    for (const blocked of [PRIVATE, ARCHIVED]) {
      directus.tables.site_content = [homeHero(blocked)]
      const reply = await get('/api/cms/home')
      expect(reply, blocked).toMatchObject({ status: 200, json: { hero: { imageUrl: '', title: { en: 'TEST ONLY hero title' } } } })
      expect(reply.body, blocked).not.toContain(blocked)
    }
    directus.tables.site_content = [homeHero(null)]
    directus.calls.length = 0
    expect(await get('/api/cms/home')).toMatchObject({ status: 200, json: { hero: { imageUrl: '' } } })
    expect(directus.calls.some(call => call.startsWith('/files'))).toBe(false)
  })

  it('home hero: a failed media-eligibility read falls back like any failed home read — no hero and no unchecked image', async () => {
    directus.tables.site_content = [homeHero(PUBLIC)]
    for (const table of ['directus_files', 'media_file_lifecycle']) {
      directus.failing.clear()
      directus.failing.add(table)
      const reply = await get('/api/cms/home')
      expect(reply, table).toMatchObject({ status: 200, json: { hero: null } })
      expect(reply.body, table).not.toContain(PUBLIC)
    }
  })
})

describe('LITUBO-STABLE-BASELINE-CLOSEOUT-01 — legacy post cover / OG images link only files RSG-06 allows; OG image URLs are absolute from the configured site URL', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const ARCHIVED = '99999999-9999-4999-8999-999999999999'
  const DETAIL = '/api/cms/posts/test-only-guide'
  const LIST = '/api/cms/posts?content_type=technical_guide'
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false), file(ARCHIVED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('post detail: the cover and OG image are emitted only while the file is public; private or archived ones are left out', async () => {
    Object.assign(directus.tables.posts![0]!, { cover_image: PUBLIC, seo_og_image: PUBLIC })
    const shown = await get(DETAIL)
    expect(shown).toMatchObject({ status: 200, json: { coverImageUrl: `/api/cms/media/${PUBLIC}`, seo: { ogImage: `/api/cms/media/${PUBLIC}` } } })
    for (const blocked of [PRIVATE, ARCHIVED]) {
      Object.assign(directus.tables.posts![0]!, { cover_image: blocked, seo_og_image: blocked })
      const reply = await get(DETAIL)
      expect(reply, blocked).toMatchObject({ status: 200, json: { coverImageUrl: '' } })
      expect((reply.json as { seo: object }).seo, blocked).not.toHaveProperty('ogImage')
      expect(reply.body, blocked).not.toContain(blocked)
    }
  })

  it('post list: a Technical Guide card keeps its cover only while the file is public', async () => {
    directus.tables.posts![0]!.cover_image = PUBLIC
    directus.tables.posts!.push(
      post({ id: 3, status: 'published', content_type: 'technical_guide', slug: 'test-only-guide-private-cover', title_en: `${MARK} private cover`, cover_image: PRIVATE }),
      post({ id: 4, status: 'published', content_type: 'technical_guide', slug: 'test-only-guide-archived-cover', title_en: `${MARK} archived cover`, cover_image: ARCHIVED }),
    )
    const reply = await get(LIST)
    expect(reply.status).toBe(200)
    const cards = (reply.json as { posts: Array<{ slug: string, coverImageUrl: string }> }).posts
    // Same order as the upstream rows; only the unverified covers are blanked.
    expect(cards.map(p => [p.slug, p.coverImageUrl])).toEqual([
      ['test-only-guide', `/api/cms/media/${PUBLIC}`],
      ['test-only-guide-private-cover', ''],
      ['test-only-guide-archived-cover', ''],
    ])
    for (const blocked of [PRIVATE, ARCHIVED]) expect(reply.body, blocked).not.toContain(blocked)
  })

  it('a failed media-eligibility read is 503 on the post detail and the existing cmsError fallback on the list — never unchecked files', async () => {
    directus.tables.posts![0]!.cover_image = PUBLIC
    for (const table of ['directus_files', 'media_file_lifecycle']) {
      directus.failing.clear()
      directus.failing.add(table)
      const detail = await get(DETAIL)
      expect(detail.status, table).toBe(503)
      expect(detail.body, table).not.toContain('TEST ONLY')
      const list = await get(LIST)
      expect(list, table).toMatchObject({ status: 200, json: { posts: [], cmsError: true } })
      expect(list.body, table).not.toContain(PUBLIC)
    }
  })

  it('absoluteSiteUrl: a site-relative path becomes absolute with the configured site URL; an absolute URL is kept; anything else is refused', () => {
    expect(absoluteSiteUrl('https://litubo.com', `/api/cms/media/${PUBLIC}`)).toBe(`https://litubo.com/api/cms/media/${PUBLIC}`)
    expect(absoluteSiteUrl('https://litubo.com/', '/images/home/home-hero-inspection-line.png')).toBe('https://litubo.com/images/home/home-hero-inspection-line.png')
    expect(absoluteSiteUrl('https://litubo.com', 'https://litubo.com/api/cms/media/x')).toBe('https://litubo.com/api/cms/media/x')
    for (const refused of [undefined, null, '', 'https://evil.example/a.png', 'https://litubo.com.evil.example/a.png', 'http://localhost:3000/a.png', '//evil.example/a.png', 'javascript:alert(1)', 'data:image/png;base64,AA', 'api/cms/media/x']) {
      expect(absoluteSiteUrl('https://litubo.com', refused), String(refused)).toBeUndefined()
    }
  })

  it('the SEO head builds og:image and twitter:image with absoluteSiteUrl from the configured site URL, never from the request host', () => {
    const head = source('composables/useSeoHead.ts')
    expect(head).toMatch(/const siteUrl = \(config\.public\.siteUrl as string\)/)
    expect(head).toMatch(/const ogImage = absoluteSiteUrl\(siteUrl, ogImageProp\) \?\? `\$\{siteUrl\}\$\{OG_IMAGE_FALLBACK\}`/)
    expect(head).toMatch(/name: 'twitter:image', content: ogImage/)
    expect(head).not.toMatch(/useRequestURL|useRequestHeaders?\(|useRequestEvent|getRequestHost|getRequestURL|getHeader|headers\.host|location\.origin|x-forwarded-host/i)
    // The product and Technical Guide pages hand their API's site-relative OG path to the SEO head.
    expect(source('pages/products/[category]/[slug].vue')).toMatch(/ogImage: computed\(\(\) => product\.value\?\.seo\.ogImage\)/)
    expect(source('pages/resources/technical-guides/[slug].vue')).toMatch(/ogImage: computed\(\(\) => post\.value\?\.seo\?\.ogImage\)/)
  })
})

describe('LITUBO-STABLE-BASELINE-CLOSEOUT-01 — review follow-ups: cover and OG image checked separately, missing files, SEO head behaviour', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const MISSING = '77777777-7777-4777-8777-777777777777' // referenced, but no directus_files row
  const DETAIL = '/api/cms/posts/test-only-guide'
  const SITE = 'https://litubo.com'
  const FALLBACK = `${SITE}/images/home/home-hero-inspection-line.png`
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false))
  })

  it('the cover and the OG image are checked separately: a public cover with a private OG image, and the reverse', async () => {
    Object.assign(directus.tables.posts![0]!, { cover_image: PUBLIC, seo_og_image: PRIVATE })
    let reply = await get(DETAIL)
    expect(reply).toMatchObject({ status: 200, json: { coverImageUrl: `/api/cms/media/${PUBLIC}` } })
    expect((reply.json as { seo: object }).seo).not.toHaveProperty('ogImage')
    expect(reply.body).not.toContain(PRIVATE)
    Object.assign(directus.tables.posts![0]!, { cover_image: PRIVATE, seo_og_image: PUBLIC })
    reply = await get(DETAIL)
    expect(reply).toMatchObject({ status: 200, json: { coverImageUrl: '', seo: { ogImage: `/api/cms/media/${PUBLIC}` } } })
    expect(reply.body).not.toContain(PRIVATE)
  })

  it('a cover or OG image whose file no longer exists is left out', async () => {
    Object.assign(directus.tables.posts![0]!, { cover_image: MISSING, seo_og_image: MISSING })
    const reply = await get(DETAIL)
    expect(reply).toMatchObject({ status: 200, json: { coverImageUrl: '' } })
    expect((reply.json as { seo: object }).seo).not.toHaveProperty('ogImage')
    expect(reply.body).not.toContain(MISSING)
  })

  it('the SEO head emits absolute og:image and twitter:image from the configured site URL and falls back to the site default for anything else', () => {
    const heads: Array<{ value: { meta: Array<Record<string, string>> } }> = []
    vi.stubGlobal('useI18n', () => ({ locale: ref('en') }))
    vi.stubGlobal('useHead', (input: { value: { meta: Array<Record<string, string>> } }) => { heads.push(input) })
    config.public.siteUrl = `${SITE}/`
    const images = (ogImage: string | undefined) => {
      heads.length = 0
      useSeoHead({ title: 'TEST ONLY', description: 'TEST ONLY', canonicalPath: '/resources/technical-guides/test-only-guide', ogImage })
      const meta = heads[0]!.value.meta
      return { og: meta.find(m => m.property === 'og:image')?.content, twitter: meta.find(m => m.name === 'twitter:image')?.content }
    }
    expect(images(`/api/cms/media/${PUBLIC}`)).toEqual({ og: `${SITE}/api/cms/media/${PUBLIC}`, twitter: `${SITE}/api/cms/media/${PUBLIC}` })
    expect(images(`${SITE}/api/cms/media/${PUBLIC}`).og).toBe(`${SITE}/api/cms/media/${PUBLIC}`)
    for (const other of [undefined, '', 'https://evil.example/a.png', '//evil.example/a.png', 'javascript:alert(1)']) {
      expect(images(other), String(other)).toEqual({ og: FALLBACK, twitter: FALLBACK })
    }
    delete config.public.siteUrl
  })
})

describe('LITUBO-STABLE-BASELINE-CLOSEOUT-01 — legacy post bodies (Technical Guide detail, FAQ list) link only files RSG-06 allows', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const ARCHIVED = '99999999-9999-4999-8999-999999999999'
  const MISSING = '77777777-7777-4777-8777-777777777777' // referenced, but no directus_files row
  const DIRECTUS = 'https://cms.example.test'
  const DETAIL = '/api/cms/posts/test-only-guide'
  const FAQ = '/api/cms/posts?content_type=faq'
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })
  const BODY = [
    '<p>TEST ONLY intro text</p>',
    `<img src="${DIRECTUS}/assets/${PUBLIC}?width=800" alt="Public diagram">`,
    `<img src="/assets/${PRIVATE}" alt="Private diagram">`,
    `<img src="/assets/${ARCHIVED}" alt="Archived diagram">`,
    `<img src="/assets/${MISSING}" alt="Missing diagram">`,
    '<img src="https://images.example.com/external.png" alt="External image">',
    `<p><a href="${DIRECTUS}/assets/${PUBLIC}?download">Public datasheet</a> `,
    `<a href="/assets/${PRIVATE}">Private manual</a> `,
    `<a href="/api/cms/media/${ARCHIVED}">Archived certificate</a> `,
    `<a href="${DIRECTUS}/assets/${MISSING}">Missing brochure</a> `,
    '<a href="https://example.com/standards">External standard</a> ',
    '<a href="/products">Our products</a></p>',
    '<script>alert(1)</script>',
  ].join('\n')

  function expectFiltered(html: string, reply: string, label: string) {
    expect(html, label).toMatch(new RegExp(`<img src="/api/cms/media/${PUBLIC}" alt="Public diagram"`))
    expect(html, label).toContain(`<a href="/api/cms/media/${PUBLIC}?download=true" rel="noopener noreferrer" target="_self">Public datasheet</a>`)
    // A link to a file RSG-06 does not allow keeps its text and loses the link.
    for (const text of ['Private manual', 'Archived certificate', 'Missing brochure']) {
      expect(html, `${label}: ${text}`).toContain(text)
      expect(html, `${label}: ${text}`).not.toMatch(new RegExp(`<a[^>]*>${text}`))
    }
    expect(html, label).toContain('<a href="https://example.com/standards" rel="noopener noreferrer" target="_blank">External standard</a>')
    expect(html, label).toContain('<a href="/products" rel="noopener noreferrer" target="_self">Our products</a>')
    expect(html, label).toContain('<p>TEST ONLY intro text</p>')
    expect(html, label).not.toMatch(/<script|alert\(1\)|images\.example\.com|cms\.example\.test/)
    for (const blocked of [PRIVATE, ARCHIVED, MISSING]) expect(reply, `${label}: ${blocked}`).not.toContain(blocked)
  }

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false), file(ARCHIVED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('legacyBodyFileIds: every UUID in the bodies once, lower-cased', () => {
    expect(legacyBodyFileIds(BODY, `<img src="/assets/${PUBLIC.toUpperCase()}">`, null)).toEqual([PUBLIC, PRIVATE, ARCHIVED, MISSING])
    expect(legacyBodyFileIds('<p>no files</p>', undefined)).toEqual([])
  })

  it('Technical Guide detail: allowed files go through the public proxy; private, archived and missing ones are removed (images) or unwrapped (links); text and other links stay', async () => {
    directus.tables.posts![0]!.body_en = BODY
    const reply = await get(DETAIL)
    expect(reply.status).toBe(200)
    expectFiltered((reply.json as { bodyHtml: { en: string } }).bodyHtml.en, reply.body, 'detail')
    expect(directus.tables.posts![0]!.body_en, 'the stored body is not changed').toBe(BODY)
  })

  it('FAQ list: every body is sanitized and filtered the same way', async () => {
    directus.tables.posts!.push(post({ id: 5, status: 'published', content_type: 'faq', slug: 'test-only-faq', title_en: `${MARK} faq`, faq_group: 'general', body_en: BODY }))
    const reply = await get(FAQ)
    expect(reply.status).toBe(200)
    const faq = (reply.json as { posts: Array<{ slug: string, bodyHtml?: { en: string } }> }).posts.find(p => p.slug === 'test-only-faq')
    expectFiltered(faq?.bodyHtml?.en ?? '', reply.body, 'faq list')
    expect(directus.tables.posts![2]!.body_en, 'the stored body is not changed').toBe(BODY)
  })

  it('a failed media-eligibility read never passes an unchecked body: 503 on the detail, the cmsError fallback on the FAQ list', async () => {
    directus.tables.posts![0]!.body_en = BODY
    directus.tables.posts!.push(post({ id: 5, status: 'published', content_type: 'faq', slug: 'test-only-faq', title_en: `${MARK} faq`, faq_group: 'general', body_en: BODY }))
    for (const table of ['directus_files', 'media_file_lifecycle']) {
      directus.failing.clear()
      directus.failing.add(table)
      const detail = await get(DETAIL)
      expect(detail.status, table).toBe(503)
      expect(detail.body, table).not.toContain('TEST ONLY')
      const faq = await get(FAQ)
      expect(faq, table).toMatchObject({ status: 200, json: { posts: [], cmsError: true } })
      expect(faq.body, table).not.toMatch(/TEST ONLY|assets|api\/cms\/media/)
    }
  })
})

describe('LITUBO-STABLE-BASELINE-CLOSEOUT-01 — legacy post bodies, review follow-ups: text, attributes, disguised links, other locales', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const ARCHIVED = '99999999-9999-4999-8999-999999999999'
  const DIRECTUS = 'https://cms.example.test'
  const DETAIL = '/api/cms/posts/test-only-guide'
  const file = (id: string, isPublic: boolean): Row => ({ id, is_public: isPublic, type: 'image/png', title: 'TEST ONLY file', filename_download: `${id}.png` })
  const noRefusedId = (text: string, label: string) => {
    for (const blocked of [PRIVATE, ARCHIVED]) expect(text.toLowerCase(), `${label}: ${blocked}`).not.toContain(blocked)
  }
  const bodyOf = async (locale: 'en' | 'es' | 'pt' = 'en') => {
    const reply = await get(DETAIL)
    expect(reply.status).toBe(200)
    return { html: (reply.json as { bodyHtml: Record<string, string> }).bodyHtml[locale]!, reply: reply.body }
  }

  beforeEach(() => {
    directus.tables.directus_files!.push(file(PUBLIC, true), file(PRIVATE, false), file(ARCHIVED, true))
    directus.tables.media_file_lifecycle = [{ file_id: ARCHIVED, archived: true }]
  })

  it('a refused file URL used as link text, or written as plain text, is removed; an allowed one stays', async () => {
    directus.tables.posts![0]!.body_en = [
      `<p><a href="${DIRECTUS}/assets/${PRIVATE}">${DIRECTUS}/assets/${PRIVATE}</a></p>`,
      `<p>See ${DIRECTUS}/assets/${ARCHIVED} and /api/cms/media/${PRIVATE}?download for details.</p>`,
      `<p>Allowed: ${DIRECTUS}/assets/${PUBLIC}</p>`,
    ].join('')
    const { html, reply } = await bodyOf()
    noRefusedId(reply, 'text')
    expect(html).toContain('See  and  for details.')
    expect(html).toContain(`Allowed: ${DIRECTUS}/assets/${PUBLIC}`)
  })

  it('refused references in the Spanish and Portuguese bodies are filtered too', async () => {
    Object.assign(directus.tables.posts![0]!, {
      body_es: `<p><img src="/assets/${PRIVATE}" alt="x"><a href="/assets/${ARCHIVED}">archivo</a></p>`,
      body_pt: `<p><img src="/assets/${ARCHIVED}" alt="x"> ${DIRECTUS}/assets/${PRIVATE}</p>`,
    })
    const es = await bodyOf('es')
    expect(es.html).toBe('<p>archivo</p>')
    noRefusedId(es.reply, 'es/pt')
    expect((await bodyOf('pt')).html).toBe('<p> </p>')
  })

  it('upper-case, protocol-relative and disguised (backslash, control character, percent-encoded) file links never stay clickable or carry a refused id', async () => {
    directus.tables.posts![0]!.body_en = [
      `<p><img src="//cms.example.test/ASSETS/${PRIVATE.toUpperCase()}" alt="u"></p>`,
      `<p><a href="//cms.example.test/assets/${PRIVATE.toUpperCase()}">upper</a></p>`,
      `<p><a href="https://cms.example.test\\assets\\${PRIVATE}">backslash</a></p>`,
      `<p><a href="/ass&#9;ets/${ARCHIVED}">tab</a></p>`,
      `<p><a href="/%61ssets/${PRIVATE}">encoded</a></p>`,
      `<p><a href="/assets%2F${ARCHIVED}">encoded slash</a></p>`,
    ].join('')
    const { html, reply } = await bodyOf()
    noRefusedId(reply, 'disguised')
    expect(html).not.toMatch(/<a |<img /)
    for (const text of ['upper', 'backslash', 'tab', 'encoded', 'encoded slash']) expect(html).toContain(text)
  })

  it('attribute values: an alt text loses a refused reference; width, height, colspan and rowspan keep plain numbers only', async () => {
    directus.tables.posts![0]!.body_en = [
      `<p><img src="/assets/${PUBLIC}" alt="see ${DIRECTUS}/assets/${PRIVATE} here" width="640px" height="360"></p>`,
      `<table><tr><td colspan="2" rowspan="/assets/${ARCHIVED}">cell</td><th colspan="3x">head</th></tr></table>`,
    ].join('')
    const { html, reply } = await bodyOf()
    noRefusedId(reply, 'attributes')
    expect(html).toContain(`<img src="/api/cms/media/${PUBLIC}" alt="see  here" height="360" />`)
    expect(html).toContain('<td colspan="2">cell</td>')
    expect(html).toContain('<th>head</th>')
  })

  it('an allowed image may use the public proxy form; download=false stays an inline link; FAQ rows share one eligibility read', async () => {
    directus.tables.posts![0]!.body_en = `<p><img src="/api/cms/media/${PUBLIC}" alt="proxy"> <a href="/assets/${PUBLIC}?download=false">inline</a></p>`
    const { html } = await bodyOf()
    expect(html).toContain(`<img src="/api/cms/media/${PUBLIC}" alt="proxy" />`)
    expect(html).toContain(`<a href="/api/cms/media/${PUBLIC}" rel="noopener noreferrer" target="_self">inline</a>`)
    directus.tables.posts!.push(
      post({ id: 5, status: 'published', content_type: 'faq', slug: 'test-only-faq-1', title_en: `${MARK} faq 1`, faq_group: 'general', body_en: `<p><img src="/assets/${PUBLIC}" alt="one"></p>` }),
      post({ id: 6, status: 'published', content_type: 'faq', slug: 'test-only-faq-2', title_en: `${MARK} faq 2`, faq_group: 'general', body_en: `<p><img src="/assets/${PRIVATE}" alt="two"></p>` }),
    )
    directus.calls.length = 0
    const faq = await get('/api/cms/posts?content_type=faq')
    const bodies = Object.fromEntries((faq.json as { posts: Array<{ slug: string, bodyHtml?: { en: string } }> }).posts.map(p => [p.slug, p.bodyHtml?.en]))
    expect(bodies['test-only-faq-1']).toContain(`/api/cms/media/${PUBLIC}`)
    expect(bodies['test-only-faq-2']).toBe('<p></p>')
    noRefusedId(faq.body, 'faq rows')
    expect(directus.calls.filter(call => call.startsWith('/files')).length).toBe(1)
  })
})

describe('LITUBO-STABLE-BASELINE-CLOSEOUT-01 — legacy post bodies, second review: split references, mixed words, path tricks, long input', () => {
  const PUBLIC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const PRIVATE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const DIRECTUS = 'https://cms.example.test'
  const files = new Map([[PUBLIC, { id: PUBLIC, type: 'image/png', title: null, filename_download: null }]])
  const html = (raw: string) => legacyPostHtml(raw, files)
  const noPrivate = (out: string, label: string) => expect(out.toLowerCase(), label).not.toContain(PRIVATE)
  const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)

  beforeEach(() => {
    directus.tables.directus_files!.push(
      { id: PUBLIC, is_public: true, type: 'image/png', title: 'TEST ONLY file', filename_download: 'public.png' },
      { id: PRIVATE, is_public: false, type: 'image/png', title: 'TEST ONLY file', filename_download: 'private.png' },
    )
  })

  it('a reference split by dropped markup, comments or entities is still found and removed', () => {
    for (const raw of [
      `<p>See ${DIRECTUS}/assets/<span>${PRIVATE}</span> now</p>`,
      `<p>See ${DIRECTUS}/assets/${PRIVATE.slice(0, 8)}<wbr>${PRIVATE.slice(8)} now</p>`,
      `<p>See ${DIRECTUS}/assets/${PRIVATE.slice(0, 8)}<!-- x -->${PRIVATE.slice(8)} now</p>`,
      `<p>See ${DIRECTUS}&#47;assets&#47;&#102;${PRIVATE.slice(1)} now</p>`,
      `<p>${DIRECTUS}/assets/<a href="/assets/${PRIVATE}">${PRIVATE}</a> now</p>`,
    ]) {
      const out = html(raw)
      noPrivate(out, raw)
      expect(out, raw).toContain('now')
    }
  })

  it('a refused id split by kept markup or invisible characters withholds the whole body (fail closed)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const raw of [
      `<p>Intro</p><p>${PRIVATE.slice(0, 8)}<strong>${PRIVATE.slice(8)}</strong></p>`,
      `<p>Intro</p><p>${PRIVATE.slice(0, 4)}&shy;${PRIVATE.slice(4)}</p>`,
      `<p>Intro</p><p>${PRIVATE.slice(0, 4)}${ZERO_WIDTH_SPACE}${PRIVATE.slice(4)}</p>`,
    ]) expect(html(raw), raw).toBe('')
    expect(warn).toHaveBeenCalledTimes(3)
    const split = `<p>${PUBLIC.slice(0, 8)}<strong>${PUBLIC.slice(8)}</strong></p>`
    expect(html(split), 'an allowed id split the same way is left alone').toBe(split)
  })

  it('a word or alt text that carries a refused id next to an allowed one is removed whole', () => {
    const out = html(`<p>${DIRECTUS}/assets/${PRIVATE},${DIRECTUS}/assets/${PUBLIC} x ${DIRECTUS}/assets/${PUBLIC}?fallback=/assets/${PRIVATE}</p>`
      + `<p><img src="/assets/${PUBLIC}" alt="/assets/${PRIVATE}|/assets/${PUBLIC}"></p>`)
    noPrivate(out, 'mixed')
    expect(out).toBe(`<p> x </p><p><img src="/api/cms/media/${PUBLIC}" alt="" /></p>`)
  })

  it('dot segments, malformed escapes and other paths that carry a refused id never stay clickable', () => {
    for (const href of [
      `${DIRECTUS}/assets/./${PRIVATE}`, `/assets/x/../${PRIVATE}`, `/assets/%2e/${PRIVATE}`, `/assets/x/%2E%2E/${PRIVATE}`,
      `/%61ssets/${PRIVATE}?%`, `/assets%2F${PRIVATE}#%zz`, `/assets//${PRIVATE}`, `/files/${PRIVATE}`,
      `https://example.com/?id=${PRIVATE}`, `#${PRIVATE}`,
    ]) expect(html(`<p><a href="${href}">link text</a></p>`), href).toBe('<p>link text</p>')
    expect(html(`<p><a href="${DIRECTUS}/assets/./${PUBLIC}">ok</a></p>`), 'an allowed file behind a disguise still goes through the proxy')
      .toBe(`<p><a href="/api/cms/media/${PUBLIC}" rel="noopener noreferrer" target="_self">ok</a></p>`)
  })

  it('srcset and data-* attributes never survive on an allowed image', () => {
    expect(html(`<p><img src="/assets/${PUBLIC}" srcset="/assets/${PRIVATE} 2x" data-src="/assets/${PRIVATE}" alt="a"></p>`))
      .toBe(`<p><img src="/api/cms/media/${PUBLIC}" alt="a" /></p>`)
  })

  it('a long whitespace-free body is processed in linear time', () => {
    const raw = `<p>${'a'.repeat(60_000)}/assets/${PRIVATE}${'b'.repeat(60_000)}</p>`
    const started = performance.now()
    const out = html(raw)
    expect(performance.now() - started).toBeLessThan(1500)
    noPrivate(out, 'long')
  })

  it('FAQ list: the Spanish and Portuguese bodies are filtered too', async () => {
    directus.tables.posts!.push(post({
      id: 5, status: 'published', content_type: 'faq', slug: 'test-only-faq-locales', title_en: `${MARK} faq`, faq_group: 'general',
      body_es: `<p><img src="/assets/${PRIVATE}" alt="es">texto ${DIRECTUS}/assets/${PRIVATE}</p>`,
      body_pt: `<p><a href="/assets/${PRIVATE}">arquivo</a></p>`,
    }))
    const reply = await get('/api/cms/posts?content_type=faq')
    const faq = (reply.json as { posts: Array<{ slug: string, bodyHtml?: Record<string, string> }> }).posts.find(p => p.slug === 'test-only-faq-locales')
    expect(faq?.bodyHtml).toMatchObject({ es: '<p>texto </p>', pt: '<p>arquivo</p>' })
    noPrivate(reply.body, 'faq es/pt')
  })
})
