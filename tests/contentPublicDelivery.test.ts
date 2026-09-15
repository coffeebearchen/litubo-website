/**
 * CC-IMP-10 — Content Center public delivery, sitemap and public media
 * (CONTENT-CENTER-BLUEPRINT-V1 §12, §15, §29–§32; RELEASE-SAFETY-GATES RSG-01,
 * RSG-02, RSG-05, RSG-06, RSG-07, §3.1, §3A.1, §3A.2, §3A.4; D-035).
 *
 * The real services run against an in-memory Directus double that applies the same
 * list filters Directus applies and records every request. Every record is
 * `TEST ONLY — NOT FOR PUBLICATION`. No real Directus, no AI, no network.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  getPublicContentDetail,
  isSitemapEligible,
  listPublicContent,
  loadEligiblePublicContent,
  PUBLIC_LOCALE_FIELDS,
  publicContentOptionsFromConfig,
  publicContentTypes,
  publicLocalesQuery,
  resolvePublicEligibility,
  type PublicContentOptions,
} from '../server/utils/contentPublic'
import { buildSitemapUrls, renderSitemap, SITEMAP_CATEGORIES_QUERY, SITEMAP_PRODUCTS_QUERY } from '../server/utils/sitemap'
import { isAssetGone, lookupPublicMedia } from '../server/utils/publicMedia'
import { isLegacyPublicPostType, LEGACY_PUBLIC_POST_TYPES } from '../server/utils/legacyPosts'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { CONTENT_TYPES, getContentType } from '../utils/contentTypes'

type Row = Record<string, unknown>

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const TITLE = 'TEST ONLY — NOT FOR PUBLICATION'
const HERO = '11111111-1111-4111-8111-111111111111'
const INLINE = '22222222-2222-4222-8222-222222222222'
const PDF = '33333333-3333-4333-8333-333333333333'
const PRIVATE = '44444444-4444-4444-8444-444444444444'
const ARCHIVED = '55555555-5555-4555-8555-555555555555'
const PUBLISHED_AT = '2026-09-15T10:00:00.000Z'

const OPTIONS: PublicContentOptions = { publishedLocales: ['en'], contentFromDirectus: true, productsFromDirectus: true }

function snapshot(overrides: Row = {}): Row {
  return {
    version: 1,
    contentType: 'technical_article',
    locale: 'en',
    publishedRevision: 3,
    title: `${TITLE} article`,
    slug: 'test-only-article',
    summary: 'TEST ONLY published summary',
    blocks: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'text', data: { heading: 'TEST ONLY intro', paragraphs: ['TEST ONLY published paragraph.'], extra: 'not allowed' } },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', type: 'key_points', data: { items: [{ title: 'TEST ONLY point', body: 'TEST ONLY body', secret: 'x' }] } },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', type: 'image', data: { fileLinkId: 201, caption: 'TEST ONLY caption' } },
      { id: 'c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc', type: 'image', data: { fileLinkId: 205, caption: 'TEST ONLY private image' } },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', type: 'faq', data: { items: [{ question: 'TEST ONLY question?', answer: 'TEST ONLY answer.' }] } },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', type: 'cta', data: { label: 'Contact us', href: '/contact' } },
      { id: 'e2e2e2e2-eeee-4eee-8eee-eeeeeeeeeeee', type: 'cta', data: { label: 'Bad link', href: 'javascript:alert(1)' } },
      { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', type: 'downloads', data: {} },
      { id: '12121212-1212-4121-8121-121212121212', type: 'related_content', data: {} },
      { id: '13131313-1313-4131-8131-131313131313', type: 'raw_html', data: { html: '<script>alert(1)</script>' } },
    ],
    seo: { title: 'TEST ONLY SEO title', description: 'TEST ONLY SEO description', canonicalPath: null, noindex: false },
    media: {
      hero: { linkId: 200, fileId: HERO, alt: 'TEST ONLY hero alt', caption: null },
      ogImage: { linkId: 200, fileId: HERO, alt: 'TEST ONLY hero alt', caption: null },
      inline: [
        { linkId: 201, fileId: INLINE, alt: 'TEST ONLY inline alt', caption: null },
        { linkId: 205, fileId: PRIVATE, alt: 'TEST ONLY private', caption: null },
      ],
      downloads: [
        { linkId: 202, fileId: PDF, alt: null, caption: null, language: 'en', versionLabel: 'v1', fileDate: '2026-09-01' },
        { linkId: 203, fileId: ARCHIVED, alt: null, caption: null, language: 'all', versionLabel: null, fileDate: null },
      ],
    },
    relations: { products: [31, 32, 33], content: [2, 4, 5, 6, 1] },
    ...overrides,
  }
}

interface ItemSpec { id: number, type: string, status: string, archived?: boolean }

function localeRow(item: ItemSpec, locale: string, slug: string, snap: Row | null, extra: Row = {}): Row {
  return {
    locale,
    slug,
    published_snapshot: snap,
    published_at: snap ? PUBLISHED_AT : null,
    content_items_id: { id: item.id, content_type: item.type, status: item.status, archived_at: item.archived ? '2026-09-14T00:00:00.000Z' : null },
    ...extra,
  }
}

const ARTICLE: ItemSpec = { id: 1, type: 'technical_article', status: 'published' }
const CASE: ItemSpec = { id: 2, type: 'case_study', status: 'published' }
const NOINDEX: ItemSpec = { id: 3, type: 'technical_article', status: 'published' }
const DRAFT: ItemSpec = { id: 4, type: 'technical_article', status: 'draft' }
const ARCHIVED_ITEM: ItemSpec = { id: 5, type: 'technical_article', status: 'archived', archived: true }
const NEWS: ItemSpec = { id: 6, type: 'news', status: 'published' }
const RESOURCE: ItemSpec = { id: 7, type: 'resource_download', status: 'published' }
const APPLICATION: ItemSpec = { id: 8, type: 'application_solution', status: 'published' }
const NO_SNAPSHOT: ItemSpec = { id: 9, type: 'technical_article', status: 'published' }
const PT_ONLY: ItemSpec = { id: 10, type: 'technical_article', status: 'published' }

function baseDb() {
  return {
    locales: [
      // The working copy is never requested; if a row ever carried it, it must not leak.
      localeRow(ARTICLE, 'en', 'test-only-article', snapshot(), { title: 'DRAFT WORKING TITLE', blocks: [{ type: 'text', data: { paragraphs: ['DRAFT WORKING TEXT'] } }], draft_revision: 9 }),
      localeRow(CASE, 'en', 'test-only-case-study', snapshot({ contentType: 'case_study', slug: 'test-only-case-study', title: `${TITLE} case study`, relations: { products: [], content: [] } })),
      localeRow(NOINDEX, 'en', 'test-only-noindex', snapshot({ slug: 'test-only-noindex', title: `${TITLE} noindex`, seo: { title: 'n', description: 'n', canonicalPath: null, noindex: true }, relations: { products: [], content: [] } })),
      // A draft item may still hold a stale snapshot row (e.g. interrupted unpublish) — never public.
      localeRow(DRAFT, 'en', 'test-only-draft', snapshot({ slug: 'test-only-draft', title: `${TITLE} draft` })),
      localeRow(ARCHIVED_ITEM, 'en', 'test-only-archived', snapshot({ slug: 'test-only-archived', title: `${TITLE} archived` })),
      localeRow(NEWS, 'en', 'test-only-news', snapshot({ contentType: 'news', slug: 'test-only-news', title: `${TITLE} news` })),
      localeRow(RESOURCE, 'en', 'test-only-resource', snapshot({ contentType: 'resource_download', slug: 'test-only-resource', title: `${TITLE} resource` })),
      localeRow(APPLICATION, 'en', 'test-only-application', snapshot({ contentType: 'application_solution', slug: 'test-only-application', title: `${TITLE} application` })),
      localeRow(NO_SNAPSHOT, 'en', 'test-only-missing-snapshot', null),
      localeRow(NO_SNAPSHOT, 'es', 'test-only-es', snapshot({ locale: 'es', slug: 'test-only-es', title: `${TITLE} ES` })),
      localeRow(PT_ONLY, 'pt', 'test-only-pt', snapshot({ locale: 'pt', slug: 'test-only-pt', title: `${TITLE} PT` })),
    ] as Row[],
    files: [
      { id: HERO, is_public: true, type: 'image/png', title: 'TEST ONLY hero', filename_download: 'hero.png' },
      { id: INLINE, is_public: true, type: 'image/png', title: 'TEST ONLY inline', filename_download: 'inline.png' },
      { id: PDF, is_public: true, type: 'application/pdf', title: 'TEST ONLY datasheet', filename_download: 'datasheet.pdf' },
      { id: PRIVATE, is_public: false, type: 'image/png', title: 'TEST ONLY private', filename_download: 'private.png' },
      { id: ARCHIVED, is_public: true, type: 'application/pdf', title: 'TEST ONLY archived', filename_download: 'archived.pdf' },
    ] as Row[],
    archived: [ARCHIVED],
    products: [
      { id: 31, slug: 'test-only-product', category_id: 1, status: 'published', seo_noindex: false, name_en: 'TEST ONLY Product', name_es: null },
      { id: 32, slug: 'test-only-draft-product', category_id: 1, status: 'draft', seo_noindex: false, name_en: 'TEST ONLY Draft Product' },
      { id: 33, slug: 'test-only-hidden-category', category_id: 2, status: 'published', seo_noindex: false, name_en: 'TEST ONLY Hidden Category Product' },
      { id: 34, slug: 'test-only-noindex-product', category_id: 1, status: 'published', seo_noindex: true, name_en: 'TEST ONLY Noindex Product' },
    ] as Row[],
    categories: [
      { id: 1, slug: 'x-ray-inspection', status: 'published' },
      { id: 2, slug: 'test-only-draft-category', status: 'draft' },
    ] as Row[],
  }
}

type Db = ReturnType<typeof baseDb>

/** In-memory Directus: applies the same list filters the real queries use. `failOn` simulates an upstream failure. */
function fakeDirectus(db: Db, opts: { failOn?: RegExp, status?: number } = {}) {
  const calls: string[] = []
  const fetch: FetchFn = async <T>(path: string): Promise<T> => {
    calls.push(path)
    if (opts.failOn?.test(path)) throw Object.assign(new Error('upstream failure'), { statusCode: opts.status ?? 503 })
    const url = new URL(path, 'http://directus.test')
    const q = (key: string) => url.searchParams.get(key)
    const list = (key: string) => (q(key) ?? '').split(',').filter(Boolean)
    const result = (data: Row[]) => ({ data: clone(data) }) as T

    if (url.pathname === '/items/content_item_locales') {
      let rows = db.locales.filter(r => r.published_snapshot !== null)
      const item = (r: Row) => r.content_items_id as Row
      if (q('filter[locale][_eq]')) rows = rows.filter(r => r.locale === q('filter[locale][_eq]'))
      if (q('filter[slug][_eq]') !== null) rows = rows.filter(r => r.slug === q('filter[slug][_eq]'))
      if (q('filter[content_items_id][status][_eq]')) rows = rows.filter(r => item(r).status === q('filter[content_items_id][status][_eq]'))
      if (q('filter[content_items_id][archived_at][_null]') === 'true') rows = rows.filter(r => item(r).archived_at === null)
      if (q('filter[content_items_id][content_type][_in]') !== null) rows = rows.filter(r => list('filter[content_items_id][content_type][_in]').includes(String(item(r).content_type)))
      if (q('filter[content_items_id][_in]') !== null) rows = rows.filter(r => list('filter[content_items_id][_in]').includes(String(item(r).id)))
      return result(rows)
    }
    if (url.pathname === '/files') {
      const ids = q('filter[id][_in]') !== null ? list('filter[id][_in]') : [q('filter[id][_eq]') ?? '']
      return result(db.files.filter(f => ids.includes(String(f.id)) && f.is_public === true))
    }
    if (url.pathname === '/items/media_file_lifecycle') {
      const ids = list('filter[file_id][_in]')
      return result(db.archived.filter(id => ids.includes(id)).map(file_id => ({ file_id })))
    }
    if (url.pathname === '/items/products') {
      let rows = db.products.filter(p => p.status === q('filter[status][_eq]'))
      if (q('filter[id][_in]') !== null) rows = rows.filter(p => list('filter[id][_in]').includes(String(p.id)))
      if (q('filter[seo_noindex][_neq]') === 'true') rows = rows.filter(p => p.seo_noindex !== true)
      const fields = (q('fields') ?? '').split(',')
      return result(rows.map(p => Object.fromEntries(fields.filter(f => f in p).map(f => [f, p[f]]))))
    }
    if (url.pathname === '/items/product_categories') {
      let rows = db.categories.filter(c => c.status === q('filter[status][_eq]'))
      if (q('filter[id][_in]') !== null) rows = rows.filter(c => list('filter[id][_in]').includes(String(c.id)))
      return result(rows.map(c => ({ id: c.id, slug: c.slug })))
    }
    throw new Error(`unexpected Directus request ${path}`)
  }
  return { fetch, calls }
}

const rowOf = (db: Db, slug: string, locale = 'en') => db.locales.find(r => r.slug === slug && r.locale === locale)!

// ── Registry and permission layer ──────────────────────────────────────────

describe('Phase 1 public types (D-035)', () => {
  it('only Technical Article and Case Study are public, each with its confirmed route', () => {
    expect(publicContentTypes().map(t => [t.id, t.publicRoute, t.sitemapEligible])).toEqual([
      ['technical_article', '/resources/insights', true],
      ['case_study', '/resources/case-studies', true],
    ])
    for (const id of ['application_solution', 'resource_download', 'news'] as const) {
      expect(CONTENT_TYPES[id].publicEnabled, id).toBe(false)
      expect(CONTENT_TYPES[id].sitemapEligible, id).toBe(false)
      expect(CONTENT_TYPES[id].publicRoute, id).toBeNull()
    }
  })

  it('the nuxt-server permission artifact (D-034) is never wider than the registry and the published locales', () => {
    const sql = source('directus/schema/directus-permissions-01-nuxt-server-content-read.sql')
    const inLists = [...sql.matchAll(/"content_type":\{"_in":\[([^\]]*)\]\}/g)].map(m => JSON.parse(`[${m[1]}]`) as string[])
    expect(inLists.length).toBeGreaterThanOrEqual(2)
    for (const types of inLists) expect([...types].sort()).toEqual(publicContentTypes().map(t => t.id).sort())
    const locales = [...sql.matchAll(/"locale":\{"_eq":"([a-z]+)"\}/g)].map(m => m[1])
    expect(locales).toEqual(['en'])
    expect(source('nuxt.config.ts')).toMatch(/publishedLocales:\s*\['en'\]/)
  })

  it('reads runtime config into reader options without trusting anything else', () => {
    expect(publicContentOptionsFromConfig({ cmsMode: 'directus', productsCmsMode: 'fixtures', public: { publishedLocales: ['en'] } }))
      .toEqual({ publishedLocales: ['en'], contentFromDirectus: true, productsFromDirectus: false })
    expect(publicContentOptionsFromConfig({})).toEqual({ publishedLocales: [], contentFromDirectus: false, productsFromDirectus: false })
  })
})

// ── Eligibility (RSG-01, RSG-02, RSG-05) ─────────────────────────────────────

describe('single public eligibility contract', () => {
  const db = baseDb()
  const eligible = (row: Row, locale = 'en', options: Pick<PublicContentOptions, 'publishedLocales'> = OPTIONS) => resolvePublicEligibility(row, locale, options)

  it('1. Draft item → not public, even with a stale snapshot row', () => {
    expect(eligible(rowOf(db, 'test-only-draft'))).toBeNull()
  })

  it('2. Published item without a snapshot for the locale → not public', () => {
    expect(eligible(rowOf(db, 'test-only-missing-snapshot'))).toBeNull()
  })

  it('3. Published item with a valid EN snapshot → public', () => {
    const entry = eligible(rowOf(db, 'test-only-article'))
    expect(entry).toMatchObject({ itemId: 1, locale: 'en', slug: 'test-only-article', publishedAt: PUBLISHED_AT })
    expect(entry?.type.id).toBe('technical_article')
  })

  it('4. Archived item → not public (status archived, or archived_at set)', () => {
    expect(eligible(rowOf(db, 'test-only-archived'))).toBeNull()
    const halfArchived = clone(rowOf(db, 'test-only-article'))
    ;(halfArchived.content_items_id as Row).archived_at = '2026-09-14T00:00:00.000Z'
    expect(eligible(halfArchived)).toBeNull()
  })

  it('5. An ES snapshot never makes EN public, and ES is not a published site locale', () => {
    const es = rowOf(db, 'test-only-es', 'es')
    expect(eligible(es, 'en')).toBeNull()
    expect(eligible(es, 'es')).toBeNull()
    expect(eligible(es, 'es', { publishedLocales: ['en', 'es'] })).not.toBeNull()
  })

  it('6. A PT snapshot never makes EN public', () => {
    const pt = rowOf(db, 'test-only-pt', 'pt')
    expect(eligible(pt, 'en')).toBeNull()
    expect(eligible(pt, 'pt')).toBeNull()
  })

  it('7. no locale fallback: a snapshot for another locale, type or slug is rejected', () => {
    const row = clone(rowOf(db, 'test-only-article'))
    ;(row.published_snapshot as Row).locale = 'es'
    expect(eligible(row)).toBeNull()
    const slugDrift = clone(rowOf(db, 'test-only-article'))
    ;(slugDrift.published_snapshot as Row).slug = 'another-slug'
    expect(eligible(slugDrift)).toBeNull()
    const missingArchivedField = clone(rowOf(db, 'test-only-article'))
    delete (missingArchivedField.content_items_id as Row).archived_at
    expect(eligible(missingArchivedField)).toBeNull()
  })

  it('8. noindex eligible content stays public', () => {
    const entry = eligible(rowOf(db, 'test-only-noindex'))
    expect(entry).not.toBeNull()
    expect(entry!.snapshot.seo.noindex).toBe(true)
  })

  it('9. noindex content is excluded from the sitemap; indexable content is included', () => {
    expect(isSitemapEligible(eligible(rowOf(db, 'test-only-noindex'))!)).toBe(false)
    expect(isSitemapEligible(eligible(rowOf(db, 'test-only-article'))!)).toBe(true)
  })

  it('10. wrong or non-public content types → not public (News, Resource / Download, Application / Solution, unknown)', () => {
    for (const slug of ['test-only-news', 'test-only-resource', 'test-only-application']) expect(eligible(rowOf(db, slug)), slug).toBeNull()
    const unknown = clone(rowOf(db, 'test-only-article'))
    ;(unknown.content_items_id as Row).content_type = 'insight'
    expect(eligible(unknown)).toBeNull()
    const typeDrift = clone(rowOf(db, 'test-only-article'))
    ;(typeDrift.published_snapshot as Row).contentType = 'case_study'
    expect(eligible(typeDrift)).toBeNull()
  })

  it('an isolated registry can switch a type off and the reader follows it (one contract)', () => {
    const resolveType = (id: unknown) => {
      const def = getContentType(id)
      return def?.id === 'technical_article' ? { ...def, publicEnabled: false } : def
    }
    expect(resolvePublicEligibility(rowOf(db, 'test-only-article'), 'en', { ...OPTIONS, resolveType })).toBeNull()
  })

  it('the shared query filters on every eligibility condition and requests snapshot-side columns only', () => {
    const query = publicLocalesQuery('en', ['technical_article', 'case_study'], { slug: 'test-only-article', limit: 2 })
    for (const part of [
      'filter[locale][_eq]=en',
      'filter[published_snapshot][_nnull]=true',
      'filter[content_items_id][status][_eq]=published',
      'filter[content_items_id][archived_at][_null]=true',
      'filter[content_items_id][content_type][_in]=technical_article,case_study',
      'filter[slug][_eq]=test-only-article',
      'limit=2',
    ]) expect(query).toContain(part)
    expect(PUBLIC_LOCALE_FIELDS.split(',').sort()).toEqual([
      'content_items_id.archived_at', 'content_items_id.content_type', 'content_items_id.id', 'content_items_id.status',
      'locale', 'published_at', 'published_snapshot', 'slug',
    ])
    expect(query).not.toMatch(/draft_revision|last_change_kind|summary|blocks|seo_title|noindex|title|user_/)
  })

  it('a locale the site does not publish reads nothing', async () => {
    const { fetch, calls } = fakeDirectus(baseDb())
    expect(await loadEligiblePublicContent(fetch, 'es', publicContentTypes(), {}, OPTIONS)).toEqual([])
    expect(calls).toEqual([])
  })
})

// ── Detail (RSG-01, RSG-06, RSG-07, §3A.1, §3A.4) ────────────────────────────

describe('public detail', () => {
  it('Technical Article: eligible → allowlisted payload from the published snapshot only', async () => {
    const { fetch } = fakeDirectus(baseDb())
    const detail = await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'en', OPTIONS)
    expect(detail).not.toBeNull()
    expect(Object.keys(detail!).sort()).toEqual(['blocks', 'downloads', 'hero', 'images', 'locale', 'publishedAt', 'related', 'seo', 'slug', 'summary', 'title', 'type', 'typeLabel'])
    expect(Object.keys(detail!.seo).sort()).toEqual(['canonicalPath', 'description', 'noindex', 'ogImageUrl', 'title'])
    expect(detail).toMatchObject({
      type: 'technical_article',
      typeLabel: 'Technical Article',
      locale: 'en',
      slug: 'test-only-article',
      title: `${TITLE} article`,
      summary: 'TEST ONLY published summary',
      publishedAt: PUBLISHED_AT,
      hero: { url: `/api/cms/media/${HERO}`, alt: 'TEST ONLY hero alt', caption: null },
      seo: { title: 'TEST ONLY SEO title', description: 'TEST ONLY SEO description', canonicalPath: '/resources/insights/test-only-article', noindex: false, ogImageUrl: `/api/cms/media/${HERO}` },
    })
    const json = JSON.stringify(detail)
    for (const leak of ['DRAFT WORKING', 'draft_revision', 'publishedRevision', 'linkId', 'content_items_id', 'not allowed', 'secret', '<script>', 'javascript:', 'aaaaaaaa-aaaa', PRIVATE, ARCHIVED]) {
      expect(json, leak).not.toContain(leak)
    }
  })

  it('renders only supported blocks with allowlisted plain-text data and safe links', async () => {
    const { fetch } = fakeDirectus(baseDb())
    const detail = (await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!
    // The private image section, the unsafe call to action and the unknown block type are not rendered.
    expect(detail.blocks.map(b => b.type)).toEqual(['text', 'key_points', 'image', 'faq', 'cta', 'downloads', 'related_content'])
    expect(detail.blocks.map(b => b.id)).toEqual(detail.blocks.map((_, i) => `block-${i + 1}`))
    expect(detail.blocks[0].data).toEqual({ heading: 'TEST ONLY intro', paragraphs: ['TEST ONLY published paragraph.'] })
    expect(detail.blocks[1].data).toEqual({ heading: undefined, items: [{ title: 'TEST ONLY point', body: 'TEST ONLY body' }] })
    expect(detail.blocks[2].data).toEqual({ fileLinkId: 1, caption: 'TEST ONLY caption' })
    expect(detail.blocks[4].data).toEqual({ heading: undefined, body: undefined, label: 'Contact us', href: '/contact' })
    expect(detail.images).toEqual({ 1: { url: `/api/cms/media/${INLINE}`, alt: 'TEST ONLY inline alt', caption: null } })
  })

  it('media: public + active files only; private and archived files never appear (RSG-06)', async () => {
    const { fetch } = fakeDirectus(baseDb())
    const detail = (await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!
    expect(detail.downloads).toEqual([{ key: 'download-1', label: 'TEST ONLY datasheet', meta: 'v1 · 2026-09-01', href: `/api/cms/media/${PDF}?download=true` }])
    const db = baseDb()
    db.archived.push(HERO)
    const withoutHero = (await getPublicContentDetail(fakeDirectus(db).fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!
    expect(withoutHero.hero).toBeNull()
    expect(withoutHero.seo.ogImageUrl).toBeNull()
  })

  it('related content renders only eligible targets in the same locale; related products only published products in published categories', async () => {
    const { fetch } = fakeDirectus(baseDb())
    const detail = (await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!
    expect(detail.related).toEqual([
      { key: 'content-1', label: `${TITLE} case study`, meta: 'Case Study', href: '/resources/case-studies/test-only-case-study' },
      { key: 'product-1', label: 'TEST ONLY Product', meta: 'Product', href: '/products/x-ray-inspection/test-only-product' },
    ])
    const json = JSON.stringify(detail.related)
    for (const hidden of ['draft', 'archived', 'news', 'Draft Product', 'Hidden Category']) expect(json, hidden).not.toContain(hidden)
    const noProducts = (await getPublicContentDetail(fakeDirectus(baseDb()).fetch, 'technical_article', 'test-only-article', 'en', { ...OPTIONS, productsFromDirectus: false }))!
    expect(noProducts.related.map(r => r.key)).toEqual(['content-1'])
  })

  it('related and downloads sections with nothing public to list are not rendered', async () => {
    const db = baseDb()
    const caseStudy = (await getPublicContentDetail(fakeDirectus(db).fetch, 'case_study', 'test-only-case-study', 'en', OPTIONS))!
    expect(caseStudy.related).toEqual([])
    expect(caseStudy.blocks.map(b => b.type)).toEqual(['text', 'key_points', 'image', 'faq', 'cta', 'downloads'])
    expect(caseStudy.blocks.map(b => b.id)).toEqual(caseStudy.blocks.map((_, i) => `block-${i + 1}`))
    db.archived.push(PDF)
    const noDownloads = (await getPublicContentDetail(fakeDirectus(db).fetch, 'case_study', 'test-only-case-study', 'en', OPTIONS))!
    expect(noDownloads.downloads).toEqual([])
    expect(noDownloads.blocks.map(b => b.type)).not.toContain('downloads')
  })

  for (const [type, slug] of [['technical_article', 'test-only-article'], ['case_study', 'test-only-case-study']] as const) {
    it(`${type}: Draft, Archived, missing snapshot, wrong type and nonexistent slug → not found; noindex → public`, async () => {
      const { fetch } = fakeDirectus(baseDb())
      expect(await getPublicContentDetail(fetch, type, slug, 'en', OPTIONS)).not.toBeNull()
      for (const other of ['test-only-draft', 'test-only-archived', 'test-only-missing-snapshot', 'test-only-news', 'test-only-resource', 'test-only-application', 'test-only-does-not-exist']) {
        expect(await getPublicContentDetail(fetch, type, other, 'en', OPTIONS), other).toBeNull()
      }
      const otherType = type === 'technical_article' ? ['case_study', slug] : ['technical_article', slug]
      expect(await getPublicContentDetail(fetch, otherType[0], otherType[1], 'en', OPTIONS)).toBeNull()
      const noindex = await getPublicContentDetail(fetch, 'technical_article', 'test-only-noindex', 'en', OPTIONS)
      expect(noindex?.seo.noindex).toBe(true)
    })

    it(`${type}: backend failure throws (route → 503), never a not-found`, async () => {
      for (const failOn of [/content_item_locales/, /\/files/, /media_file_lifecycle/]) {
        const { fetch } = fakeDirectus(baseDb(), { failOn, status: 401 })
        await expect(getPublicContentDetail(fetch, type, slug, 'en', OPTIONS)).rejects.toThrow('upstream failure')
      }
    })
  }

  it('News, legacy post types and unknown types are never a public content type; ES / PT and bad slugs read nothing', async () => {
    const { fetch, calls } = fakeDirectus(baseDb())
    for (const type of ['news', 'resource_download', 'application_solution', 'insight', 'case-studies', '', undefined]) {
      expect(await getPublicContentDetail(fetch, type, 'test-only-news', 'en', OPTIONS), String(type)).toBeNull()
      expect(await listPublicContent(fetch, type, 'en', OPTIONS), String(type)).toBeNull()
    }
    expect(await getPublicContentDetail(fetch, 'technical_article', 'test-only-es', 'es', OPTIONS)).toBeNull()
    expect(await getPublicContentDetail(fetch, 'technical_article', 'test-only-pt', 'pt', OPTIONS)).toBeNull()
    expect(await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'fr', OPTIONS)).toBeNull()
    expect(await getPublicContentDetail(fetch, 'technical_article', '../admin', 'en', OPTIONS)).toBeNull()
    expect(calls).toEqual([])
  })

  it('without CMS_MODE=directus there is no content source: detail not found, list empty, nothing read', async () => {
    const { fetch, calls } = fakeDirectus(baseDb())
    const off = { ...OPTIONS, contentFromDirectus: false }
    expect(await getPublicContentDetail(fetch, 'technical_article', 'test-only-article', 'en', off)).toBeNull()
    expect(await listPublicContent(fetch, 'technical_article', 'en', off)).toEqual({ items: [] })
    expect(calls).toEqual([])
  })

  it('a canonical override is used only when it is a valid internal path', async () => {
    const db = baseDb()
    ;(rowOf(db, 'test-only-article').published_snapshot as Row).seo = { title: 't', description: 'd', canonicalPath: '/resources/insights/preferred', noindex: false }
    expect((await getPublicContentDetail(fakeDirectus(db).fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!.seo.canonicalPath).toBe('/resources/insights/preferred')
    ;(rowOf(db, 'test-only-article').published_snapshot as Row).seo = { title: 't', description: 'd', canonicalPath: 'https://evil.example/x', noindex: false }
    expect((await getPublicContentDetail(fakeDirectus(db).fetch, 'technical_article', 'test-only-article', 'en', OPTIONS))!.seo.canonicalPath).toBe('/resources/insights/test-only-article')
  })
})

// ── List ─────────────────────────────────────────────────────────────────────

describe('public list', () => {
  it('lists only eligible content of the requested type, noindex included, with allowlisted card fields', async () => {
    const { fetch } = fakeDirectus(baseDb())
    const articles = (await listPublicContent(fetch, 'technical_article', undefined, OPTIONS))!
    expect(articles.items.map(i => i.href).sort()).toEqual(['/resources/insights/test-only-article', '/resources/insights/test-only-noindex'])
    expect(Object.keys(articles.items[0]).sort()).toEqual(['href', 'image', 'publishedAt', 'summary', 'title', 'type', 'typeLabel'])
    const withHero = articles.items.find(i => i.href.endsWith('test-only-article'))!
    expect(withHero.image).toEqual({ url: `/api/cms/media/${HERO}`, alt: 'TEST ONLY hero alt', caption: null })
    const cases = (await listPublicContent(fetch, 'case_study', 'en', OPTIONS))!
    expect(cases.items.map(i => i.title)).toEqual([`${TITLE} case study`])
    expect(JSON.stringify([articles, cases])).not.toMatch(/test-only-(draft|archived|news|resource|application|missing-snapshot|es|pt)\b|DRAFT WORKING/i)
  })

  it('a backend failure throws (route → 503), never an empty list', async () => {
    const { fetch } = fakeDirectus(baseDb(), { failOn: /content_item_locales/, status: 403 })
    await expect(listPublicContent(fetch, 'technical_article', 'en', OPTIONS)).rejects.toThrow('upstream failure')
  })
})

// ── Sitemap (RSG-02, §3A.2) ──────────────────────────────────────────────────

describe('sitemap', () => {
  const SITE = { ...OPTIONS, siteUrl: 'https://litubo.test/' }

  it('the products query does not request date_updated and reads only permitted product fields', () => {
    expect(SITEMAP_PRODUCTS_QUERY).not.toContain('date_updated')
    const fields = new URL(SITEMAP_PRODUCTS_QUERY, 'http://d').searchParams.get('fields')!.split(',')
    expect(fields.sort()).toEqual(['category_id', 'seo_noindex', 'slug'])
    expect(source('server/routes/sitemap.xml.ts')).not.toContain('date_updated')
  })

  it('includes eligible Technical Articles, Case Studies and published products; excludes everything else', async () => {
    const { fetch, calls } = fakeDirectus(baseDb())
    const urls = await buildSitemapUrls(fetch, SITE)
    expect(urls).toEqual([
      { loc: 'https://litubo.test/products/x-ray-inspection/test-only-product', lastmod: null },
      { loc: 'https://litubo.test/resources/insights/test-only-article', lastmod: '2026-09-15' },
      { loc: 'https://litubo.test/resources/case-studies/test-only-case-study', lastmod: '2026-09-15' },
    ])
    const text = renderSitemap(urls)
    for (const excluded of ['test-only-draft', 'test-only-archived', 'test-only-missing-snapshot', 'test-only-noindex', 'test-only-news', 'test-only-resource', 'test-only-application', 'test-only-es', 'test-only-pt', 'test-only-draft-product', 'test-only-hidden-category', 'test-only-noindex-product']) {
      expect(text, excluded).not.toContain(`/${excluded}<`)
    }
    expect(calls).toContain(SITEMAP_PRODUCTS_QUERY)
    expect(calls).toContain(SITEMAP_CATEGORIES_QUERY)
    expect(calls.some(c => c.includes('filter[locale][_eq]=en') && c.includes('limit=-1'))).toBe(true)
    expect(calls.some(c => /filter\[locale\]\[_eq\]=(es|pt)/.test(c))).toBe(false)
  })

  it('a Directus 401 / 403 / 5xx on any sitemap source throws — never a silent empty sitemap', async () => {
    for (const [failOn, status] of [[/\/items\/products/, 403], [/product_categories/, 401], [/content_item_locales/, 500]] as const) {
      const { fetch } = fakeDirectus(baseDb(), { failOn, status })
      await expect(buildSitemapUrls(fetch, SITE), String(failOn)).rejects.toThrow('upstream failure')
    }
    const route = source('server/routes/sitemap.xml.ts')
    expect(route).toContain('statusCode: 503')
    expect(route).not.toMatch(/return skeleton|catch\s*\{\s*return/)
  })

  it('no eligible data is a valid empty sitemap; no CMS mode reads nothing', async () => {
    const empty = { ...baseDb(), locales: [], products: [] }
    expect(await buildSitemapUrls(fakeDirectus(empty).fetch, SITE)).toEqual([])
    const { fetch, calls } = fakeDirectus(baseDb())
    expect(await buildSitemapUrls(fetch, { ...SITE, contentFromDirectus: false, productsFromDirectus: false })).toEqual([])
    expect(calls).toEqual([])
    expect(renderSitemap([])).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>')
    expect(renderSitemap([{ loc: 'https://litubo.test/a?b=1&c=<d>', lastmod: null }])).toContain('<loc>https://litubo.test/a?b=1&amp;c=&lt;d&gt;</loc>')
  })
})

// ── Public media proxy (RSG-06) ──────────────────────────────────────────────

describe('public media lookup', () => {
  it('public + active → found; missing, not public or archived → not found', async () => {
    const { fetch } = fakeDirectus(baseDb())
    expect(await lookupPublicMedia(fetch, HERO)).toEqual({ found: true, type: 'image/png', filenameDownload: 'hero.png' })
    expect(await lookupPublicMedia(fetch, HERO.toUpperCase())).toMatchObject({ found: true })
    expect(await lookupPublicMedia(fetch, '99999999-9999-4999-8999-999999999999')).toEqual({ found: false })
    expect(await lookupPublicMedia(fetch, PRIVATE)).toEqual({ found: false })
    expect(await lookupPublicMedia(fetch, ARCHIVED)).toEqual({ found: false })
  })

  it('an invalid id reads nothing; an upstream failure throws (route → 503)', async () => {
    const { fetch, calls } = fakeDirectus(baseDb())
    expect(await lookupPublicMedia(fetch, 'not-a-uuid')).toEqual({ found: false })
    expect(calls).toEqual([])
    for (const failOn of [/\/files/, /media_file_lifecycle/]) {
      await expect(lookupPublicMedia(fakeDirectus(baseDb(), { failOn, status: 500 }).fetch, HERO)).rejects.toThrow('upstream failure')
    }
  })

  it('only a Directus 403 / 404 on the byte read means the asset is gone', () => {
    expect(isAssetGone({ statusCode: 404 })).toBe(true)
    expect(isAssetGone({ statusCode: 403 })).toBe(true)
    for (const other of [{ statusCode: 401 }, { statusCode: 500 }, { statusCode: 502 }, new Error('network'), null]) expect(isAssetGone(other)).toBe(false)
  })

  it('the proxy route uses the runtime lookup and maps upstream failures to 503', () => {
    const route = source('server/api/cms/media/[id].get.ts')
    expect(route).toContain('lookupPublicMedia(directusFetch, id)')
    expect(route).toContain('isAssetGone(err)')
    expect(route.match(/statusCode: 503/g)?.length).toBeGreaterThanOrEqual(3)
    expect(route).not.toMatch(/catch\s*\{\s*\/\/[^\n]*\n\s*throw createError\(\{ statusCode: 404/)
  })
})

// ── Route ownership and static boundaries ───────────────────────────────────

describe('Phase 1 route ownership (D-035)', () => {
  it('Technical Article and Case Study pages read Content Center only — no legacy posts fallback, no HTML', () => {
    for (const [file, type] of [['pages/resources/insights/[slug].vue', 'technical_article'], ['pages/resources/case-studies/[slug].vue', 'case_study']]) {
      const text = source(file)
      expect(text, file).toContain(`/api/cms/content/${type}/`)
      expect(text, file).not.toMatch(/usePostDetail|\/api\/cms\/posts|v-html|DEMO_POSTS/)
      expect(text, file).toMatch(/throw createError\(\{ statusCode: error\.value\?\.statusCode \?\? 404, fatal: true \}\)/)
    }
    expect(source('components/content/PublicContentArticle.vue')).not.toMatch(/v-html|innerHTML|\/api\/cms\/posts/)
    expect(source('components/content/ContentBlocksRenderer.vue')).not.toMatch(/v-html\s*=|\.innerHTML/)
  })

  it('News detail is always 404 and reads nothing', () => {
    const text = source('pages/resources/news/[slug].vue')
    expect(text).toContain('throw createError({ statusCode: 404, fatal: true })')
    expect(text).not.toMatch(/\$fetch|useAsyncData|usePostDetail/)
  })

  it('the Resources hub has no News filter or cards and no legacy Insight / Case Study source', () => {
    const text = source('pages/resources/index.vue')
    expect(text).toContain("'/api/cms/content/technical_article'")
    expect(text).toContain("'/api/cms/content/case_study'")
    expect(text).toContain("'/api/cms/posts?content_type=technical_guide'")
    expect(text).not.toMatch(/key: 'news'|label: 'News'|exclude_type=faq|'insight'|resources\/news/)
  })

  it('legacy posts serve only Technical Guides and FAQ', () => {
    expect([...LEGACY_PUBLIC_POST_TYPES]).toEqual(['technical_guide', 'faq'])
    for (const type of ['insight', 'case_study', 'news', 'technical_article', '', null]) expect(isLegacyPublicPostType(type)).toBe(false)
    for (const file of ['server/api/cms/posts/index.get.ts', 'server/api/cms/posts/[slug].get.ts']) {
      const text = source(file)
      expect(text, file).toContain('isLegacyPublicPostType')
      expect(text, file).toContain('filter[content_type][_in]=${LEGACY_PUBLIC_POST_TYPES.join(\',\')}')
    }
  })

  it('public content routes answer 404 for not eligible and 503 for upstream failures', () => {
    for (const file of ['server/api/cms/content/[type]/index.get.ts', 'server/api/cms/content/[type]/[slug].get.ts']) {
      const text = source(file)
      expect(text, file).toContain('statusCode: 503')
      expect(text, file).toContain("if (!result) throw createError({ statusCode: 404, message: 'Not found' })")
      expect(text, file).toContain('directusFetch')
      expect(text, file).not.toMatch(/contentAdminFetch|adminDirectusClient|api\/admin|\.\.\.row|\.\.\.record/)
    }
  })

  it('the public reader never imports publication, lifecycle, draft, AI or admin services', () => {
    for (const file of ['server/utils/contentPublic.ts', 'server/utils/sitemap.ts', 'server/utils/publicMedia.ts']) {
      const imports = source(file).split('\n').filter(line => line.startsWith('import '))
      expect(imports.join('\n'), file).not.toMatch(/contentPublication|contentLifecycle|contentDraft|contentAdminFetch|adminDirectus|\/ai|aiTarget|aiProposal/)
    }
    expect(source('server/utils/contentPublic.ts')).not.toMatch(/method:\s*'(PATCH|POST|DELETE)'/)
  })
})
