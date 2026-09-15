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
import { isPublishedLocale, publicPageStatus } from '../utils/publicRoute'

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
    const table = base!.replace('/items/', '')
    if (directus.failing.has(table)) throw new Error(`fetch failed (${table})`)
    let rows = directus.tables[table] ?? []
    const params = new URLSearchParams(query)
    for (const [key, value] of params) {
      const eq = key.match(/^filter\[(\w+)\]\[_eq\]$/)
      if (eq) rows = rows.filter(row => String(row[eq[1]!]) === value)
      const within = key.match(/^filter\[(\w+)\]\[_in\]$/)
      if (within) rows = rows.filter(row => value.split(',').includes(String(row[within[1]!])))
    }
    return { data: rows.slice(0, Number(params.get('limit') ?? rows.length)) }
  },
}))

const config: { cmsMode: string | undefined, productsCmsMode: string | undefined, public: { publishedLocales: string[] } } = {
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
