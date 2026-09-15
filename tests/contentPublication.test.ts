/**
 * CC-IMP-06 — Content Center Preview, Readiness & manual Publish
 * (CONTENT-CENTER-BLUEPRINT-V1 §8, §11, §14, §15, §21–§23, §31, §32;
 * docs/project/RELEASE-SAFETY-GATES.md RSG-01, RSG-03, RSG-04, RSG-05, RSG-06, RSG-07).
 *
 * The real services run against an in-memory Directus double that emulates the
 * draft revision guard (cc-imp-01-fix-01-revision-guard.sql) and records every
 * write, so "nothing was written" and write order are checked exactly.
 *
 * The positive lifecycle uses a TEST ONLY registry injected into the service call
 * (`resolveType`). The committed registry is never changed: every content type
 * stays `publicEnabled = false`, and the normal runtime path is blocked.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateLocaleDraft } from '../server/utils/contentDraft'
import {
  buildPublishedSnapshot,
  computeContentReadiness,
  getContentPreviewPublish,
  loadPublicationContext,
  publishContentLocale,
  unpublishContentLocale,
  type PublicationOptions,
} from '../server/utils/contentPublication'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { CONTENT_TYPES, getContentType } from '../utils/contentTypes'
import {
  interpretPublicationError,
  previewMediaStatus,
  publicationLocaleTabs,
  publishAction,
  readinessCounts,
} from '../utils/contentPreviewPublish'
import type { AdminContentPreviewMedia } from '../types/content-center'

type Row = Record<string, unknown> & { id: number }

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ITEM = 6
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION publish'
const HERO = '11111111-1111-4111-8111-111111111111'
const OG = '22222222-2222-4222-8222-222222222222'
const INLINE = '44444444-4444-4444-8444-444444444444'
const PDF = '55555555-5555-4555-8555-555555555555'
const PDF_OFF = '66666666-6666-4666-8666-666666666666'
const SRC = '77777777-7777-4777-8777-777777777777'
const PDF_EN = '88888888-8888-4888-8888-888888888801'
const PDF_ES = '88888888-8888-4888-8888-888888888802'
const PDF_PT = '88888888-8888-4888-8888-888888888803'
const B = {
  text: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  points: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  image: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  faq: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  cta: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  downloads: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  related: '12121212-1212-4121-8121-121212121212',
}
const NOW = '2026-09-15T10:00:00.000Z'
const LATER = '2026-09-15T11:00:00.000Z'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** TEST ONLY — an isolated registry in which technical articles (and the listed types) are public. Never the committed registry. */
function testOnlyRegistry(...types: string[]): PublicationOptions['resolveType'] {
  const publicTypes = types.length ? types : ['technical_article']
  return (id: unknown) => {
    const def = getContentType(id)
    return def && publicTypes.includes(def.id) ? { ...def, publicEnabled: true } : def
  }
}

const RUNTIME: PublicationOptions = { publishedLocales: ['en'] }
const TEST_PUBLIC: PublicationOptions = { publishedLocales: ['en'], resolveType: testOnlyRegistry() }

function enBlocks() {
  return [
    { id: B.text, type: 'text', data: { heading: 'TEST ONLY intro', paragraphs: ['TEST ONLY paragraph.'] } },
    { id: B.points, type: 'key_points', data: { items: [{ title: 'TEST ONLY point', body: 'TEST ONLY body' }] } },
    { id: B.image, type: 'image', data: { fileLinkId: 103, caption: 'TEST ONLY caption' } },
    { id: B.faq, type: 'faq', data: { items: [{ question: 'TEST ONLY question?', answer: 'TEST ONLY answer.' }] } },
    { id: B.cta, type: 'cta', data: { label: 'Contact us', href: '/contact' } },
    { id: B.downloads, type: 'downloads', data: {} },
    { id: B.related, type: 'related_content', data: {} },
  ]
}

function uniqueError(field: string) {
  return Object.assign(new Error('unique'), { statusCode: 400, data: { errors: [{ extensions: { code: 'RECORD_NOT_UNIQUE', field } }] } })
}

async function rejection(promise: Promise<unknown>): Promise<{ statusCode: number, message: string, data: Record<string, unknown> }> {
  try {
    await promise
  } catch (err) {
    return err as { statusCode: number, message: string, data: Record<string, unknown> }
  }
  throw new Error('expected a rejection')
}

const DRAFT_FIELDS = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex']

class FakeDirectus {
  item: Row = { id: ITEM, content_type: 'technical_article', status: 'draft', first_published_at: null, archived_at: null }
  locales = new Map<number, Row>()
  links = new Map<number, Row>()
  files = new Map<string, Row & { id: never } | Record<string, unknown>>([
    [HERO, { id: HERO, type: 'image/png', filename_download: 'hero.png', title: 'TEST ONLY hero', width: 1600, height: 900, is_public: true }],
    [OG, { id: OG, type: 'image/jpeg', filename_download: 'og.jpg', title: null, width: 1200, height: 630, is_public: true }],
    [INLINE, { id: INLINE, type: 'image/webp', filename_download: 'inline.webp', title: null, width: 800, height: 600, is_public: true }],
    [PDF, { id: PDF, type: 'application/pdf', filename_download: 'guide.pdf', title: 'TEST ONLY guide', width: null, height: null, is_public: true }],
    [PDF_OFF, { id: PDF_OFF, type: 'application/pdf', filename_download: 'old.pdf', title: null, width: null, height: null, is_public: true }],
    [SRC, { id: SRC, type: 'text/plain', filename_download: 'notes.txt', title: 'internal notes', width: null, height: null, is_public: false }],
    [PDF_EN, { id: PDF_EN, type: 'application/pdf', filename_download: 'guide-en.pdf', title: null, width: null, height: null, is_public: true }],
    [PDF_ES, { id: PDF_ES, type: 'application/pdf', filename_download: 'guia-es.pdf', title: null, width: null, height: null, is_public: true }],
    [PDF_PT, { id: PDF_PT, type: 'application/pdf', filename_download: 'guia-pt.pdf', title: null, width: null, height: null, is_public: true }],
  ])

  archived = new Set<string>()
  relations: Row[] = [
    { id: 5, content_items_id: ITEM, relation_kind: 'product', sort: 0, product_id: { id: 3, name_en: 'TEST ONLY product', product_code: 'TEST-3', status: 'draft' }, related_content_id: null },
    { id: 6, content_items_id: ITEM, relation_kind: 'content', sort: 1, product_id: null, related_content_id: { id: 2, status: 'draft', locales: [{ locale: 'en', title: 'TEST ONLY related EN' }] } },
  ]

  /** Rows of other content items, for slug uniqueness. */
  otherLocales: Row[] = []
  writes: Array<{ method: string, path: string, body: unknown }> = []
  failWrite: RegExp | null = null

  constructor() {
    this.locales.set(20, this.localeRow({ id: 20, locale: 'en', title: TITLE, slug: 'test-only-publish', summary: 'TEST ONLY summary', blocks: enBlocks(), seo_description: 'TEST ONLY meta', draft_revision: 4 }))
    this.locales.set(21, this.localeRow({
      id: 21, locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-publicar', summary: 'TEST ONLY resumen', draft_revision: 2,
      blocks: [{ id: B.text, type: 'text', data: { paragraphs: ['TEST ONLY párrafo.'] } }],
    }))
    this.addLink({ id: 101, directus_files_id: HERO, file_role: 'hero', alt_en: 'TEST ONLY hero alt' })
    this.addLink({ id: 102, directus_files_id: OG, file_role: 'og_image' })
    this.addLink({ id: 103, directus_files_id: INLINE, file_role: 'inline', alt_en: 'TEST ONLY inline alt', caption_en: 'TEST ONLY inline caption' })
    this.addLink({ id: 104, directus_files_id: PDF, file_role: 'download', language: 'all', version_label: 'v1', file_date: '2026-09-01' })
    this.addLink({ id: 105, directus_files_id: PDF_OFF, file_role: 'download', language: 'en', enabled: false })
    this.addLink({ id: 106, directus_files_id: SRC, file_role: 'source_document' })
  }

  localeRow(values: Partial<Row>): Row {
    return {
      id: 0, content_items_id: ITEM, locale: 'en', title: 'T', slug: 's', summary: null, blocks: [],
      seo_title: null, seo_description: null, canonical_path: null, noindex: false, draft_revision: 1,
      published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit', published_snapshot: null,
      ...values,
    } as Row
  }

  addLink(values: Partial<Row>): void {
    const row = {
      content_items_id: ITEM, alt_en: null, alt_es: null, alt_pt: null, caption_en: null, caption_es: null, caption_pt: null,
      language: null, version_label: null, file_date: null, enabled: true, sort: 0, ...values,
    } as Row
    this.links.set(row.id, row)
  }

  row(locale: string): Row {
    return [...this.locales.values()].find(r => r.locale === locale)!
  }

  private patchLocale(id: number, patch: Row) {
    const old = this.locales.get(id)
    if (!old) throw Object.assign(new Error('forbidden'), { statusCode: 403 })
    const next = { ...old, ...patch }
    const changed = DRAFT_FIELDS.some(f => JSON.stringify(old[f] ?? null) !== JSON.stringify(next[f] ?? null))
    if ((changed || next.draft_revision !== old.draft_revision) && next.draft_revision !== Number(old.draft_revision) + 1) throw uniqueError('draft_revision')
    this.locales.set(id, next)
  }

  fetch: FetchFn = (async (path: string, options: Record<string, unknown> = {}) => {
    const method = String(options.method ?? 'GET')
    const url = new URL(path, 'http://directus.local')
    const q = (key: string) => url.searchParams.get(key)
    const ids = (key: string) => String(q(key) ?? '').split(',').filter(Boolean)
    const body = options.body as Row | Row[]
    if (method !== 'GET') {
      this.writes.push({ method, path: url.pathname, body: clone(body) })
      if (this.failWrite?.test(`${method} ${url.pathname}`)) {
        this.failWrite = null
        throw Object.assign(new Error('Directus unavailable'), { statusCode: 503 })
      }
    }

    if (url.pathname === '/items/content_items' && method === 'GET') {
      if (Number(q('filter[id][_eq]')) !== ITEM) return { data: [] }
      return { data: [{ ...clone(this.item), locales: [...this.locales.values()].map(r => clone(r)) }] }
    }
    if (url.pathname === `/items/content_items/${ITEM}` && method === 'PATCH') {
      this.item = { ...this.item, ...(body as Row) }
      return { data: { id: ITEM } }
    }
    if (url.pathname === '/items/content_item_locales') {
      if (method === 'GET') {
        let rows = [...this.locales.values(), ...this.otherLocales]
        if (q('filter[content_items_id][_eq]')) rows = rows.filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
        if (q('filter[locale][_eq]')) rows = rows.filter(r => r.locale === q('filter[locale][_eq]'))
        if (q('filter[slug][_eq]')) rows = rows.filter(r => r.slug === q('filter[slug][_eq]'))
        return { data: rows.map(r => clone(r)) }
      }
      if (method === 'PATCH') {
        for (const patch of body as Row[]) this.patchLocale(patch.id, patch)
        return { data: [] }
      }
    }
    const localeMatch = /^\/items\/content_item_locales\/(\d+)$/.exec(url.pathname)
    if (localeMatch && method === 'PATCH') {
      this.patchLocale(Number(localeMatch[1]), body as Row)
      return { data: { id: Number(localeMatch[1]) } }
    }
    if (url.pathname === '/items/content_items_files' && method === 'GET') {
      let rows = [...this.links.values()].filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
      if (q('filter[id][_in]')) rows = rows.filter(r => ids('filter[id][_in]').map(Number).includes(r.id))
      if (q('filter[file_role][_eq]')) rows = rows.filter(r => r.file_role === q('filter[file_role][_eq]'))
      return { data: rows.map(r => ({ ...clone(r), directus_files_id: this.files.has(String(r.directus_files_id)) ? clone(this.files.get(String(r.directus_files_id))) : null })) }
    }
    if (url.pathname === '/items/content_relations' && method === 'GET') return { data: clone(this.relations) }
    if (url.pathname === '/items/media_file_lifecycle' && method === 'GET') {
      return { data: ids('filter[file_id][_in]').filter(id => this.archived.has(id)).map(file_id => ({ file_id })) }
    }
    throw new Error(`unexpected request ${method} ${path}`)
  }) as FetchFn
}

let db: FakeDirectus
beforeEach(() => { db = new FakeDirectus() })

const readiness = async (locale: 'en' | 'es' | 'pt' = 'en', options: PublicationOptions = TEST_PUBLIC) =>
  computeContentReadiness(await loadPublicationContext(db.fetch, ITEM), locale, options)
const failing = (r: { hard: Array<{ key: string, state: string }> }) => r.hard.filter(c => c.state === 'fail').map(c => c.key)
/**
 * Publishes as a reviewer who has just loaded the page: a body that names a draft
 * revision but no fingerprint gets the current publication input fingerprint
 * from the preview read (which never writes). Fingerprint tests call the service directly.
 */
async function publish(locale: string, body: unknown, options: PublicationOptions = TEST_PUBLIC, now = NOW) {
  let request = body
  if (body && typeof body === 'object' && !Array.isArray(body) && 'expectedDraftRevision' in body && !('expectedPublicationInputFingerprint' in body)) {
    try {
      const state = await getContentPreviewPublish(db.fetch, ITEM, locale, options)
      request = { ...body, expectedPublicationInputFingerprint: state.publicationInputFingerprint }
    } catch { /* unknown locale: the publish call reports it */ }
  }
  return publishContentLocale(db.fetch, ITEM, locale, request, { ...options, now: () => now })
}
const unpublish = (locale: string, body: unknown = undefined, options: PublicationOptions = TEST_PUBLIC) =>
  unpublishContentLocale(db.fetch, ITEM, locale, body, options)
const workingCopy = (row: Row) => clone(Object.fromEntries(DRAFT_FIELDS.concat('draft_revision').map(f => [f, row[f]])))

// ── Readiness ────────────────────────────────────────────────────────────────

describe('readiness — deterministic, server-side (Blueprint §21)', () => {
  it('normal runtime registry: the only blocker of complete content is the content type not being public', async () => {
    const r = await readiness('en', RUNTIME)
    expect(r.ready).toBe(false)
    expect(failing(r)).toEqual(['type_public'])
    expect(r.hard.find(c => c.key === 'type_public')!.label).toBe('This content type is not enabled for public delivery yet.')
    expect(db.writes).toHaveLength(0)
  })

  it('with a TEST ONLY public registry every hard check passes, soft warnings do not block, and nothing is written', async () => {
    const r = await readiness('en')
    expect(r.ready).toBe(true)
    expect(r.hard.map(c => c.key)).toEqual([
      'item_not_archived', 'title', 'summary', 'slug', 'sections_valid', 'required_sections',
      'media_public', 'type_public', 'locale_site_published',
    ])
    expect(r.soft.filter(c => c.state === 'warn').map(c => c.key)).toEqual(['seo_title'])
    expect(r.soft.map(c => c.state).every(s => s === 'pass' || s === 'warn')).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/%|score|confidence|weight/i)
    expect(db.writes).toHaveLength(0)
  })

  it('fails each hard rule on its own', async () => {
    const cases: Array<[string, () => void, string]> = [
      ['archived', () => { db.item.status = 'archived' }, 'item_not_archived'],
      ['title', () => { db.row('en').title = '  ' }, 'title'],
      ['summary', () => { db.row('en').summary = null }, 'summary'],
      ['reserved slug', () => { db.row('en').slug = 'preview' }, 'slug'],
      ['slug used by another item', () => { db.otherLocales.push(db.localeRow({ id: 90, content_items_id: 99, locale: 'en', slug: 'test-only-publish' })) }, 'slug'],
      ['invalid section', () => { (db.row('en').blocks as Row[])[0] = { id: B.text, type: 'text', data: { paragraphs: ['x'], html: '<b>' } } as unknown as Row }, 'sections_valid'],
      ['required section', () => { db.row('en').blocks = enBlocks().filter(b => b.type !== 'text') }, 'required_sections'],
      ['private hero', () => { (db.files.get(HERO) as Row).is_public = false }, 'media_public'],
      ['archived Open Graph image', () => { db.archived.add(OG) }, 'media_public'],
      ['missing inline file', () => { db.files.delete(INLINE) }, 'media_public'],
      ['image section on a disabled link', () => { db.links.get(103)!.enabled = false }, 'media_public'],
      ['image section on a missing link', () => { db.links.delete(103) }, 'media_public'],
      ['private enabled download', () => { (db.files.get(PDF) as Row).is_public = false }, 'media_public'],
      ['runtime registry', () => {}, 'type_public'],
    ]
    for (const [name, mutate, key] of cases) {
      db = new FakeDirectus()
      mutate()
      const r = await readiness('en', name === 'runtime registry' ? RUNTIME : TEST_PUBLIC)
      expect(failing(r), name).toEqual([key])
      expect(r.ready, name).toBe(false)
    }
  })

  it('Review Fix 01: required content missing blocks; text the schema allows to be empty only warns', async () => {
    // Blueprint §21: summary is required to publish.
    db.row('en').summary = ''
    expect(failing(await readiness())).toEqual(['summary'])
    // Registry §7: a technical article needs a text section.
    db = new FakeDirectus()
    db.row('en').blocks = enBlocks().filter(b => b.type !== 'text')
    expect(failing(await readiness())).toEqual(['required_sections'])
    // Optional / schema-allowed empty values: an empty paragraph, FAQ answer and CTA link.
    db = new FakeDirectus()
    const blocks = db.row('en').blocks as Array<{ data: Record<string, unknown> }>
    blocks[0].data = { heading: 'TEST ONLY intro', paragraphs: [''] }
    blocks[3].data = { items: [{ question: 'TEST ONLY question?', answer: ' ' }] }
    blocks[4].data = { label: 'Contact us', href: '' }
    const r = await readiness()
    expect(r.ready).toBe(true)
    expect(r.hard.some(c => c.key === 'sections_complete')).toBe(false)
    const warning = r.soft.find(c => c.key === 'sections_complete')!
    expect(warning.state).toBe('warn')
    expect(warning.detail).toBe('Check: Text 1, FAQ 1, Call to action 1.')
    expect((await publish('en', { expectedDraftRevision: 4 })).result).toBe('published')
  })

  it('does not check files that would not be published: disabled downloads and source documents', async () => {
    (db.files.get(PDF_OFF) as Row).is_public = false
    db.archived.add(SRC)
    expect((await readiness('en')).ready).toBe(true)
  })

  it('requires an enabled hero for Application / Solution and Case Study', async () => {
    db.item.content_type = 'application_solution'
    db.links.delete(101)
    const r = await readiness('en', { publishedLocales: ['en'], resolveType: testOnlyRegistry('application_solution') })
    expect(failing(r)).toEqual(['hero'])
  })

  it('requires an enabled download file for Resource / Download', async () => {
    db.item.content_type = 'resource_download'
    db.row('en').blocks = [enBlocks()[0], enBlocks()[5], enBlocks()[6]]
    db.links.get(104)!.enabled = false
    const r = await readiness('en', { publishedLocales: ['en'], resolveType: testOnlyRegistry('resource_download') })
    expect(failing(r)).toEqual(['download_file'])
  })

  it('Spanish: blocked while the site does not publish Spanish and while English is not published', async () => {
    const r = await readiness('es')
    expect(failing(r)).toEqual(['locale_site_published', 'default_locale_published'])
    const siteEs = await readiness('es', { publishedLocales: ['en', 'es'], resolveType: testOnlyRegistry() })
    expect(failing(siteEs)).toEqual(['default_locale_published'])
  })

  it('a language that was not started is blocked and never borrows another language', async () => {
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'pt', TEST_PUBLIC)
    expect(state.preview).toBeNull()
    expect(failing(state.readiness)).toEqual(['locale_started', 'locale_site_published', 'default_locale_published'])
    expect(state.readiness.soft).toEqual([])
    expect(JSON.stringify(state.preview)).toBe('null')
    expect(db.writes).toHaveLength(0)
  })

  it('soft warnings never block: noindex, no SEO text, no Open Graph image, no relations', async () => {
    Object.assign(db.row('en'), { noindex: true, seo_description: null })
    db.links.delete(102)
    db.relations = []
    const r = await readiness('en')
    expect(r.ready).toBe(true)
    expect(r.soft.filter(c => c.state === 'warn').map(c => c.key)).toEqual(['seo_title', 'seo_description', 'og_image', 'relations', 'noindex'])
    expect(r.soft.find(c => c.key === 'ai_proposal')!.state).toBe('pass')
  })
})

// ── Snapshot ─────────────────────────────────────────────────────────────────

describe('published snapshot — explicit allowlist (Blueprint §23, RSG-01, RSG-06)', () => {
  it('is exactly the expected structure', async () => {
    const snapshot = buildPublishedSnapshot(await loadPublicationContext(db.fetch, ITEM), 'en', TEST_PUBLIC)
    expect(snapshot).toEqual({
      version: 1,
      contentType: 'technical_article',
      locale: 'en',
      publishedRevision: 4,
      title: TITLE,
      slug: 'test-only-publish',
      summary: 'TEST ONLY summary',
      blocks: enBlocks(),
      seo: { title: TITLE, description: 'TEST ONLY meta', canonicalPath: null, noindex: false },
      media: {
        hero: { linkId: 101, fileId: HERO, alt: 'TEST ONLY hero alt', caption: null },
        ogImage: { linkId: 102, fileId: OG, alt: null, caption: null },
        inline: [{ linkId: 103, fileId: INLINE, alt: 'TEST ONLY inline alt', caption: 'TEST ONLY inline caption' }],
        downloads: [{ linkId: 104, fileId: PDF, alt: null, caption: null, language: 'all', versionLabel: 'v1', fileDate: '2026-09-01' }],
      },
      relations: { products: [3], content: [2] },
    })
  })

  it('never contains source documents, disabled links, draft metadata, file visibility or Directus fields', async () => {
    const text = JSON.stringify(buildPublishedSnapshot(await loadPublicationContext(db.fetch, ITEM), 'en', TEST_PUBLIC))
    for (const forbidden of [SRC, PDF_OFF, 'source_document', 'internal notes', 'draft_revision', 'last_change_kind', 'manual_edit',
      'user_created', 'date_created', 'is_public', 'archived', 'first_published_at', 'filename_download', 'proposal', 'readiness', 'blocker']) {
      expect(text, forbidden).not.toContain(forbidden)
    }
  })

  it('uses the hero as the Open Graph image when there is none', async () => {
    db.links.delete(102)
    const snapshot = buildPublishedSnapshot(await loadPublicationContext(db.fetch, ITEM), 'en', TEST_PUBLIC)
    expect(snapshot.media.ogImage).toEqual(snapshot.media.hero)
  })
})

// ── Publish ──────────────────────────────────────────────────────────────────

describe('publish — human action, server authority (RSG-03)', () => {
  it('is refused in the normal runtime because the content type is not public, and writes nothing', async () => {
    const err = await rejection(publish('en', { expectedDraftRevision: 4 }, RUNTIME))
    expect(err.statusCode).toBe(422)
    expect(err.data.code).toBe('not_ready')
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['type_public'])
    expect(db.writes).toHaveLength(0)
    expect(db.row('en').published_snapshot).toBeNull()
  })

  it('refuses a stale expectedDraftRevision with 409 changed_since_review and writes nothing', async () => {
    const err = await rejection(publish('en', { expectedDraftRevision: 3 }))
    expect(err.statusCode).toBe(409)
    expect(err.data).toMatchObject({ code: 'changed_since_review', currentDraftRevision: 4 })
    expect(db.writes).toHaveLength(0)
  })

  it('rejects invalid requests without writing', async () => {
    expect((await rejection(publish('en', {}))).statusCode).toBe(422)
    expect((await rejection(publish('en', { expectedDraftRevision: '4' }))).statusCode).toBe(422)
    expect((await rejection(publish('en', { expectedDraftRevision: 4, published_snapshot: { title: 'x' } }))).statusCode).toBe(422)
    expect((await rejection(publish('en', { expectedDraftRevision: 4, ready: true }))).statusCode).toBe(422)
    expect((await rejection(publish('en', undefined))).statusCode).toBe(400)
    expect((await rejection(publish('zh', { expectedDraftRevision: 4 }))).statusCode).toBe(404)
    expect((await rejection(publish('pt', { expectedDraftRevision: 1 }))).statusCode).toBe(404)
    expect((await rejection(publishContentLocale(db.fetch, ITEM, 'en', { expectedDraftRevision: 4 }, TEST_PUBLIC))).data).toMatchObject({ field: 'expectedPublicationInputFingerprint' })
    expect((await rejection(publishContentLocale(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, expectedPublicationInputFingerprint: 'abc' }, TEST_PUBLIC))).statusCode).toBe(422)
    expect((await rejection(publishContentLocale(db.fetch, 999, 'en', { expectedDraftRevision: 4, expectedPublicationInputFingerprint: '0'.repeat(32) }, TEST_PUBLIC))).statusCode).toBe(404)
    expect(db.writes).toHaveLength(0)
  })

  it('publishes English: snapshot first, then the item; the working copy and its revision are unchanged', async () => {
    const before = workingCopy(db.row('en'))
    const res = await publish('en', { expectedDraftRevision: 4 })
    expect(res.result).toBe('published')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_item_locales/20', 'PATCH /items/content_items/6'])
    expect(Object.keys(db.writes[0].body as Row).sort()).toEqual(['first_published_at', 'last_change_kind', 'published_at', 'published_revision', 'published_snapshot'])
    expect(db.writes[1].body).toEqual({ status: 'published', first_published_at: NOW })
    const en = db.row('en')
    expect(en).toMatchObject({ published_revision: 4, published_at: NOW, first_published_at: NOW, last_change_kind: 'publish', draft_revision: 4 })
    expect(workingCopy(en)).toEqual(before)
    expect(db.item).toMatchObject({ status: 'published', first_published_at: NOW })
    expect(res.state.publication).toMatchObject({ has_snapshot: true, published_revision: 4, unpublished_changes: false })
    expect(res.state.locales.find(l => l.locale === 'en')!.state).toBe('published')
  })

  it('is idempotent: the same revision and snapshot write nothing again', async () => {
    await publish('en', { expectedDraftRevision: 4 })
    db.writes = []
    const again = await publish('en', { expectedDraftRevision: 4 }, TEST_PUBLIC, LATER)
    expect(again.result).toBe('already_published')
    expect(db.writes).toHaveLength(0)
    expect(db.row('en').published_at).toBe(NOW)
  })

  it('partial failure between snapshot and item status exposes nothing; a retry completes only the item status', async () => {
    db.failWrite = /^PATCH \/items\/content_items\/6$/
    const err = await rejection(publish('en', { expectedDraftRevision: 4 }))
    expect(err.statusCode).toBe(500)
    expect(err.data).toMatchObject({ partial: true, retryable: true, completedSteps: 1, totalSteps: 2 })
    expect(db.row('en').published_snapshot).not.toBeNull()
    // Public eligibility requires item.status = published AND a snapshot: not eligible.
    expect(db.item.status).toBe('draft')

    db.writes = []
    const retry = await publish('en', { expectedDraftRevision: 4 }, TEST_PUBLIC, LATER)
    expect(retry.result).toBe('already_published')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_items/6'])
    expect(db.item).toMatchObject({ status: 'published', first_published_at: LATER })
    expect(db.row('en').first_published_at).toBe(NOW)
  })

  it('later Draft edits leave the snapshot unchanged until published again; first_published_at is kept and the slug stays locked', async () => {
    await publish('en', { expectedDraftRevision: 4 })
    const published = clone(db.row('en').published_snapshot)

    await updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: `${TITLE} v2` })
    expect(db.row('en').published_snapshot).toEqual(published)
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(state.locales.find(l => l.locale === 'en')!.state).toBe('published_with_changes')
    expect(state.publication.unpublished_changes).toBe(true)
    expect(state.readiness.soft.find(c => c.key === 'unpublished_changes')!.state).toBe('warn')

    const locked = await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 5, slug: 'another-slug' }))
    expect(locked.statusCode).toBe(422)
    expect(locked.data).toMatchObject({ field: 'slug', slugLocked: true })

    db.writes = []
    const republished = await publish('en', { expectedDraftRevision: 5 }, TEST_PUBLIC, LATER)
    expect(republished.result).toBe('published')
    expect(db.writes.map(w => w.path)).toEqual(['/items/content_item_locales/20'])
    expect(db.row('en')).toMatchObject({ published_revision: 5, published_at: LATER, first_published_at: NOW })
    expect((db.row('en').published_snapshot as { title: string }).title).toBe(`${TITLE} v2`)
    expect(db.item.first_published_at).toBe(NOW)
  })

  it('media metadata changed after publishing counts as unpublished changes and can be published again', async () => {
    await publish('en', { expectedDraftRevision: 4 })
    db.links.get(101)!.alt_en = 'TEST ONLY hero alt v2'
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(state.publication.unpublished_changes).toBe(true)
    db.writes = []
    expect((await publish('en', { expectedDraftRevision: 4 }, TEST_PUBLIC, LATER)).result).toBe('published')
    expect(db.writes).toHaveLength(1)
  })

  it('private or archived media blocks publishing, and publishing never changes a file', async () => {
    (db.files.get(INLINE) as Row).is_public = false
    const err = await rejection(publish('en', { expectedDraftRevision: 4 }))
    expect(err.statusCode).toBe(422)
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['media_public'])
    db.archived.add(HERO)
    expect((await rejection(publish('en', { expectedDraftRevision: 4 }))).statusCode).toBe(422)
    expect(db.writes).toHaveLength(0)

    db = new FakeDirectus()
    await publish('en', { expectedDraftRevision: 4 })
    expect(db.writes.every(w => w.path.startsWith('/items/content_item'))).toBe(true)
  })
})

// ── Publication review fingerprint (Review Fix 01, RSG-03) ─────────────────

describe('publication input fingerprint — the reviewed state is the published state', () => {
  async function reviewOf(locale: 'en' | 'es' = 'en', options: PublicationOptions = TEST_PUBLIC) {
    const state = await getContentPreviewPublish(db.fetch, ITEM, locale, options)
    return { expectedDraftRevision: state.locales.find(l => l.locale === locale)!.draft_revision!, expectedPublicationInputFingerprint: state.publicationInputFingerprint }
  }
  const publishReviewed = (review: unknown) => publishContentLocale(db.fetch, ITEM, 'en', review, { ...TEST_PUBLIC, now: () => NOW })

  async function expectStale(label: string, mutate: () => void) {
    const review = await reviewOf()
    mutate()
    const err = await rejection(publishReviewed(review))
    expect(err.statusCode, label).toBe(409)
    expect(err.data.code, label).toBe('changed_since_review')
    expect(err.data.currentPublicationInputFingerprint, label).not.toBe(review.expectedPublicationInputFingerprint)
    expect(err.data.currentDraftRevision, label).toBe(4)
    expect(db.writes, label).toHaveLength(0)
    expect(db.row('en').published_snapshot, label).toBeNull()
    expect(db.item.status, label).toBe('draft')
  }

  it('is a 32-hex server value, stable across reads, and independent of the page (no UI state)', async () => {
    const a = await reviewOf()
    const b = await reviewOf()
    expect(a.expectedPublicationInputFingerprint).toMatch(/^[0-9a-f]{32}$/)
    expect(b).toEqual(a)
    expect(db.writes).toHaveLength(0)
  })

  it('A. Draft text changed → the draft revision contract still returns 409 and writes nothing', async () => {
    const review = await reviewOf()
    await updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: `${TITLE} v2` })
    db.writes = []
    const err = await rejection(publishReviewed(review))
    expect(err.statusCode).toBe(409)
    expect(err.data).toMatchObject({ code: 'changed_since_review', currentDraftRevision: 5 })
    expect(db.writes).toHaveLength(0)
  })

  it('B. media association changed without a new draft revision → 409, zero publication writes', async () => {
    await expectStale('hero replaced', () => { db.links.get(101)!.directus_files_id = INLINE })
    db = new FakeDirectus()
    await expectStale('Open Graph link removed', () => { db.links.delete(102) })
    db = new FakeDirectus()
    await expectStale('inline alt text changed', () => { db.links.get(103)!.alt_en = 'TEST ONLY inline alt v2' })
    db = new FakeDirectus()
    await expectStale('file visibility changed', () => { (db.files.get(OG) as Row).is_public = false })
  })

  it('C. download metadata changed without a new draft revision → 409', async () => {
    await expectStale('version label', () => { db.links.get(104)!.version_label = 'v2' })
    db = new FakeDirectus()
    await expectStale('download language', () => { db.links.get(104)!.language = 'es' })
    db = new FakeDirectus()
    await expectStale('download enabled', () => { db.links.get(105)!.enabled = true })
  })

  it('D. relation changed without a new draft revision → 409', async () => {
    await expectStale('relation added', () => { db.relations.push({ id: 7, content_items_id: ITEM, relation_kind: 'product', sort: 2, product_id: { id: 4, name_en: 'TEST ONLY product 4', product_code: 'TEST-4', status: 'draft' }, related_content_id: null }) })
    db = new FakeDirectus()
    await expectStale('relation removed', () => { db.relations = db.relations.slice(1) })
    db = new FakeDirectus()
    await expectStale('relation reordered', () => { db.relations[0].sort = 5 })
  })

  it('E. nothing changed → Publish proceeds', async () => {
    const res = await publishReviewed(await reviewOf())
    expect(res.result).toBe('published')
    expect(db.writes).toHaveLength(2)
  })

  it('F. after a 409, reloading gives the new fingerprint and an explicit Publish of the latest state succeeds', async () => {
    const old = await reviewOf()
    db.links.get(104)!.version_label = 'v2'
    expect((await rejection(publishReviewed(old))).statusCode).toBe(409)
    const latest = await reviewOf()
    expect(latest.expectedPublicationInputFingerprint).not.toBe(old.expectedPublicationInputFingerprint)
    expect((await publishReviewed(latest)).result).toBe('published')
    expect((db.row('en').published_snapshot as { media: { downloads: Array<{ versionLabel: string }> } }).media.downloads[0].versionLabel).toBe('v2')
  })

  it('a source document change is not a publication input', async () => {
    const review = await reviewOf()
    db.links.get(106)!.enabled = false
    expect((await publishReviewed(review)).result).toBe('published')
  })
})

// ── Download locale isolation (Review Fix 01, RSG-05) ──────────────────────

describe('download locale isolation — exact language or the existing "all" value only', () => {
  function addLocaleDownloads() {
    db.addLink({ id: 107, directus_files_id: PDF_EN, file_role: 'download', language: 'en' })
    db.addLink({ id: 108, directus_files_id: PDF_ES, file_role: 'download', language: 'es' })
    db.addLink({ id: 109, directus_files_id: PDF_PT, file_role: 'download', language: 'pt' })
  }
  const snapshotDownloads = async (locale: 'en' | 'es') =>
    buildPublishedSnapshot(await loadPublicationContext(db.fetch, ITEM), locale, TEST_PUBLIC).media.downloads.map(d => d.linkId)

  it('EN snapshot and preview include EN and all-language downloads, never ES / PT or unset language', async () => {
    addLocaleDownloads()
    db.addLink({ id: 110, directus_files_id: PDF_PT, file_role: 'download', language: null })
    expect(await snapshotDownloads('en')).toEqual([104, 107])
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(state.preview!.downloads.map(d => d.link_id)).toEqual([104, 107])
  })

  it('ES snapshot and preview include ES and all-language downloads, never EN / PT', async () => {
    addLocaleDownloads()
    db.row('es').blocks = [...(db.row('es').blocks as unknown[]), { id: B.downloads, type: 'downloads', data: {} }]
    expect(await snapshotDownloads('es')).toEqual([104, 108])
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'es', TEST_PUBLIC)
    expect(state.preview!.downloads.map(d => d.link_id)).toEqual([104, 108])
  })

  const RESOURCE: PublicationOptions = { publishedLocales: ['en'], resolveType: testOnlyRegistry('resource_download') }
  function resourceWithoutAllLanguageDownload() {
    db.item.content_type = 'resource_download'
    db.row('en').blocks = [enBlocks()[0], enBlocks()[5], enBlocks()[6]]
    db.links.delete(104)
  }

  it('EN resource_download with only an enabled ES download is blocked', async () => {
    resourceWithoutAllLanguageDownload()
    db.addLink({ id: 108, directus_files_id: PDF_ES, file_role: 'download', language: 'es' })
    expect(failing(await readiness('en', RESOURCE))).toEqual(['download_file'])
    const err = await rejection(publish('en', { expectedDraftRevision: 4 }, RESOURCE))
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['download_file'])
    expect(db.writes).toHaveLength(0)
  })

  it('a disabled current-language download is neither published nor counted', async () => {
    resourceWithoutAllLanguageDownload()
    db.addLink({ id: 107, directus_files_id: PDF_EN, file_role: 'download', language: 'en', enabled: false })
    expect(failing(await readiness('en', RESOURCE))).toEqual(['download_file'])
    const ctx = await loadPublicationContext(db.fetch, ITEM)
    expect(buildPublishedSnapshot(ctx, 'en', RESOURCE).media.downloads).toEqual([])
  })

  it('a private or archived current-language download blocks publishing (RSG-06)', async () => {
    resourceWithoutAllLanguageDownload()
    db.addLink({ id: 107, directus_files_id: PDF_EN, file_role: 'download', language: 'en' })
    expect((await readiness('en', RESOURCE)).ready).toBe(true);
    (db.files.get(PDF_EN) as Row).is_public = false
    expect(failing(await readiness('en', RESOURCE))).toEqual(['media_public', 'download_file'])
    ;(db.files.get(PDF_EN) as Row).is_public = true
    db.archived.add(PDF_EN)
    expect(failing(await readiness('en', RESOURCE))).toEqual(['media_public', 'download_file'])
  })
})

// ── Locale isolation ────────────────────────────────────────────────────────

describe('locale isolation (RSG-05)', () => {
  it('publishing English never publishes Spanish or Portuguese', async () => {
    const es = clone(db.row('es'))
    await publish('en', { expectedDraftRevision: 4 })
    expect(db.row('es')).toEqual(es)
    expect(db.writes.some(w => w.path === '/items/content_item_locales/21')).toBe(false)
    expect([...db.locales.values()].map(r => r.locale)).toEqual(['en', 'es'])
  })

  it('Spanish cannot be published while the site does not publish Spanish — even after English is published', async () => {
    await publish('en', { expectedDraftRevision: 4 })
    db.writes = []
    const err = await rejection(publish('es', { expectedDraftRevision: 2 }))
    expect(err.statusCode).toBe(422)
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['locale_site_published'])
    expect(db.writes).toHaveLength(0)
  })

  it('Spanish requires published English; then only the Spanish row is written', async () => {
    const siteEs: PublicationOptions = { publishedLocales: ['en', 'es'], resolveType: testOnlyRegistry() }
    const err = await rejection(publish('es', { expectedDraftRevision: 2 }, siteEs))
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['default_locale_published'])
    await publish('en', { expectedDraftRevision: 4 }, siteEs)
    db.writes = []
    expect((await publish('es', { expectedDraftRevision: 2 }, siteEs)).result).toBe('published')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_item_locales/21'])
    expect((db.row('es').published_snapshot as { title: string, locale: string })).toMatchObject({ locale: 'es', title: 'TEST ONLY ES' })
  })

  it('the Spanish preview shows only Spanish text and relation titles, never English', async () => {
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'es', TEST_PUBLIC)
    const preview = JSON.stringify(state.preview)
    expect(preview).toContain('TEST ONLY ES')
    expect(preview).not.toContain('TEST ONLY paragraph.')
    expect(preview).not.toContain('TEST ONLY related EN')
    expect(preview).not.toContain('TEST ONLY hero alt')
    expect(state.preview!.relations.find(r => r.relation_kind === 'content')!.label).toBeNull()
  })
})

// ── Unpublish ────────────────────────────────────────────────────────────────

describe('unpublish — explicit action, Draft kept (Blueprint §23)', () => {
  const siteEs: PublicationOptions = { publishedLocales: ['en', 'es'], resolveType: testOnlyRegistry() }

  async function publishBoth() {
    await publish('en', { expectedDraftRevision: 4 }, siteEs)
    await publish('es', { expectedDraftRevision: 2 }, siteEs)
    db.writes = []
  }

  it('a non-default language clears only its own publication fields', async () => {
    await publishBoth()
    const esDraft = workingCopy(db.row('es'))
    const en = clone(db.row('en'))
    const res = await unpublish('es', {}, siteEs)
    expect(res.result).toBe('unpublished')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_item_locales/21'])
    expect(db.row('es')).toMatchObject({ published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'unpublish', first_published_at: NOW })
    expect(workingCopy(db.row('es'))).toEqual(esDraft)
    expect(db.row('en')).toEqual(en)
    expect(db.item.status).toBe('published')
  })

  it('the default language returns the item to draft first, then clears every language in one request', async () => {
    await publishBoth()
    const drafts = [workingCopy(db.row('en')), workingCopy(db.row('es'))]
    const links = clone([...db.links.values()])
    const res = await unpublish('en')
    expect(res.result).toBe('unpublished')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_items/6', 'PATCH /items/content_item_locales'])
    expect(db.writes[0].body).toEqual({ status: 'draft' })
    expect((db.writes[1].body as Row[]).map(r => r.id)).toEqual([20, 21])
    for (const locale of ['en', 'es']) {
      expect(db.row(locale)).toMatchObject({ published_snapshot: null, published_revision: null, published_at: null, first_published_at: NOW })
    }
    expect([workingCopy(db.row('en')), workingCopy(db.row('es'))]).toEqual(drafts)
    expect([...db.links.values()]).toEqual(links)
    expect(db.relations).toHaveLength(2)
    expect(db.item).toMatchObject({ status: 'draft', first_published_at: NOW })
    expect(res.state.can_unpublish).toBe(false)
    // Slug lock survives unpublishing.
    expect((await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, slug: 'x-y' }))).data).toMatchObject({ slugLocked: true })
  })

  it('an interrupted default unpublish leaves nothing public and a retry finishes clearing', async () => {
    await publishBoth()
    db.failWrite = /^PATCH \/items\/content_item_locales$/
    const err = await rejection(unpublish('en'))
    expect(err.statusCode).toBe(500)
    expect(err.data).toMatchObject({ partial: true, completedSteps: 1 })
    expect(db.item.status).toBe('draft')
    db.writes = []
    expect((await unpublish('en')).result).toBe('unpublished')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_item_locales'])
    expect([...db.locales.values()].every(r => r.published_snapshot === null)).toBe(true)
  })

  it('is a no-op when nothing is published, refuses archived content and unexpected body fields', async () => {
    expect((await unpublish('en')).result).toBe('already_unpublished')
    expect((await unpublish('es', {})).result).toBe('already_unpublished')
    expect((await rejection(unpublish('en', { all: true }))).statusCode).toBe(422)
    expect((await rejection(unpublish('pt'))).statusCode).toBe(404)
    db.item.status = 'archived'
    expect((await rejection(unpublish('en'))).statusCode).toBe(409)
    expect(db.writes).toHaveLength(0)
  })
})

// ── Generic save cannot touch publication (N-14) ────────────────────────────

describe('the Draft save route cannot set publication fields (N-14)', () => {
  it('rejects status, snapshot, published revision and dates with 422 and writes nothing', async () => {
    for (const field of ['published_snapshot', 'published_revision', 'published_at', 'first_published_at', 'status', 'last_change_kind']) {
      const err = await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, [field]: field === 'published_snapshot' ? { title: 'x' } : 'x' }))
      expect(err.statusCode, field).toBe(422)
    }
    expect(db.writes).toHaveLength(0)
  })
})

// ── Static boundaries: human-only publish, AI isolation, no public surface ──

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? (name === 'node_modules' || name.startsWith('.') ? [] : listFiles(full)) : [full]
  })
}

const source = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const rel = (file: string) => relative(ROOT, file).split('\\').join('/')

describe('static boundaries (RSG-03, RSG-04, RSG-01)', () => {
  const runtimeFiles = ['server', 'components', 'pages', 'utils', 'composables', 'layouts', 'plugins', 'middleware']
    .flatMap(dir => listFiles(join(ROOT, dir)))
    .filter(f => /\.(ts|vue)$/.test(f))

  it('only the three admin routes import the publication service', () => {
    const importers = runtimeFiles.filter(f => source(rel(f)).includes('contentPublication')).map(rel).sort()
    expect(importers).toEqual([
      'server/api/admin/content-center/[id]/locales/[locale]/publish.post.ts',
      'server/api/admin/content-center/[id]/locales/[locale]/unpublish.post.ts',
      'server/api/admin/content-center/[id]/preview-publish.get.ts',
    ])
  })

  it('no AI module references the publication service, publish routes or publication fields', () => {
    const aiFiles = runtimeFiles.map(rel).filter(f => /(^|\/)ai[A-Z_/-]|\/ai\//.test(f) || /aiTargets\//.test(f))
    expect(aiFiles.length).toBeGreaterThan(5)
    for (const file of aiFiles) {
      const text = source(file)
      expect(text, file).not.toContain('contentPublication')
      expect(text, file).not.toMatch(/\/publish|published_snapshot|publishContentLocale/)
    }
  })

  it('Draft save, media, SEO and preview paths never write publication fields', () => {
    for (const file of ['server/utils/contentDraft.ts', 'server/utils/contentMediaRelations.ts', 'server/utils/contentSeoLocales.ts']) {
      expect(source(file), file).not.toMatch(/published_snapshot|contentPublication|last_change_kind: 'publish'/)
    }
    const get = source('server/api/admin/content-center/[id]/preview-publish.get.ts')
    expect(get).not.toMatch(/publishContentLocale|unpublishContentLocale|method:/)
  })

  it('the action routes use the admin session (revisions record the admin), a byte-limited body and no static token', () => {
    for (const file of ['server/api/admin/content-center/[id]/locales/[locale]/publish.post.ts', 'server/api/admin/content-center/[id]/locales/[locale]/unpublish.post.ts']) {
      const text = source(file)
      expect(text).toContain('contentAdminFetch(event)')
      expect(text).toContain('readJsonBodyWithByteLimit')
      expect(text).not.toMatch(/directusFetch|directusToken/)
    }
  })

  it('the renderer never renders HTML and the preview page is noindex without a canonical link', () => {
    for (const file of ['components/content/ContentBlocksRenderer.vue', 'components/admin/content/ContentPreviewPublish.vue', 'pages/admin/content-center/[id]/preview-publish.vue']) {
      expect(source(file), file).not.toMatch(/v-html\s*=|\.innerHTML/)
    }
    const page = source('pages/admin/content-center/[id]/preview-publish.vue')
    expect(page).toContain("{ name: 'robots', content: 'noindex, nofollow' }")
    expect(page).not.toMatch(/rel:\s*'canonical'|useSeoHead\(/)
  })

  it('adds no public Content Center route, API, sitemap entry or preview parameter', () => {
    const publicFiles = [...listFiles(join(ROOT, 'server', 'api', 'cms')), ...listFiles(join(ROOT, 'server', 'routes')), ...listFiles(join(ROOT, 'pages'))]
      .map(rel)
      .filter(f => !f.startsWith('pages/admin/'))
    for (const file of publicFiles) {
      expect(source(file), file).not.toMatch(/content_items|content_item_locales|published_snapshot|preview-publish|api\/admin\/content-center/)
    }
  })

  it('the committed registry keeps every content type non-public', () => {
    for (const def of Object.values(CONTENT_TYPES)) expect(def.publicEnabled).toBe(false)
    expect(source('utils/contentTypes.ts')).not.toMatch(/publicEnabled:\s*true/)
  })
})

// ── Admin middleware on the new routes (RSG-07, N-07, N-13) ─────────────────

function mockEvent(url: string, method: string, opts: { cookies?: Record<string, string>, headers?: Record<string, string> } = {}) {
  const cookie = Object.entries(opts.cookies ?? {}).map(([k, v]) => `${k}=${v}`).join('; ')
  const req = Object.assign(new Readable({ read() { this.push(null) } }), {
    url, method, headers: { host: 'localhost:3000', ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
  })
  const event = {
    path: url,
    method,
    node: { req, res: { setHeader: () => {}, getHeader: () => undefined, end: () => {}, writableEnded: false, statusCode: 200 } },
    context: { params: {} } as Record<string, unknown>,
  }
  return event as unknown as Parameters<typeof import('h3').getRequestURL>[0]
}

async function statusOf(run: () => Promise<unknown>): Promise<number | 'passed'> {
  try {
    await run()
    return 'passed'
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1
  }
}

describe('admin-auth middleware on the preview and publication routes', () => {
  const PUBLISH = '/api/admin/content-center/6/locales/en/publish'
  const UNPUBLISH = '/api/admin/content-center/6/locales/en/unpublish'
  const PREVIEW = '/api/admin/content-center/6/preview-publish?locale=en'

  function install(role: string | null) {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useRuntimeConfig', () => ({ directusUrl: 'http://directus.test' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.includes('/users/me') && role) return { data: { id: 'admin-1', role: { name: role } } }
      throw Object.assign(new Error('unauthorized'), { statusCode: 401 })
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('unauthenticated → 401; non-administrator → 403', async () => {
    install(null)
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    for (const [url, method] of [[PUBLISH, 'POST'], [UNPUBLISH, 'POST'], [PREVIEW, 'GET']]) {
      expect(await statusOf(() => middleware(mockEvent(url, method)))).toBe(401)
    }
    install('Editor')
    for (const url of [PUBLISH, UNPUBLISH]) {
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 'token' }, headers: { origin: 'http://localhost:3000' } })))).toBe(403)
    }
  })

  it('an administrator still needs a same-site Origin for publish and unpublish', async () => {
    install('Administrator')
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    for (const url of [PUBLISH, UNPUBLISH]) {
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 'token' } })))).toBe(403)
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 'token' }, headers: { origin: 'https://evil.example' } })))).toBe(403)
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 'token' }, headers: { origin: 'http://localhost:3000' } })))).toBe('passed')
    }
  })
})

// ── Client helpers ───────────────────────────────────────────────────────────

describe('page helpers', () => {
  it('explains a blocked Publish, finishes an interrupted one, and reports an up-to-date language', async () => {
    const blocked = await getContentPreviewPublish(db.fetch, ITEM, 'en', RUNTIME)
    expect(publishAction(blocked)).toEqual({ enabled: false, label: 'Publish English', reason: 'This content type is not enabled for public delivery yet.' })
    expect(readinessCounts(blocked.readiness)).toEqual({ blockers: 1, warnings: 1 })

    const ready = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(publishAction(ready)).toMatchObject({ enabled: true, label: 'Publish English' })

    db.failWrite = /^PATCH \/items\/content_items\/6$/
    await rejection(publish('en', { expectedDraftRevision: 4 }))
    const unfinished = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(publishAction(unfinished)).toMatchObject({ enabled: true, label: 'Finish publishing' })
    await publish('en', { expectedDraftRevision: 4 })
    const done = await getContentPreviewPublish(db.fetch, ITEM, 'en', TEST_PUBLIC)
    expect(publishAction(done)).toMatchObject({ enabled: false, label: 'Published' })
    expect(publicationLocaleTabs(done).map(t => `${t.code}:${t.stateLabel}`)).toEqual(['en:Published', 'es:Draft', 'pt:Not started'])

    const notStarted = await getContentPreviewPublish(db.fetch, ITEM, 'pt', TEST_PUBLIC)
    expect(publishAction(notStarted)).toMatchObject({ enabled: false, reason: 'Portuguese has not been started.' })
  })

  it('maps server errors to user-facing kinds', () => {
    const e = (statusCode: number, data: Record<string, unknown> = {}, message = 'server message') => ({ statusCode, data: { statusCode, message, data } })
    expect(interpretPublicationError(e(409, { code: 'changed_since_review' })).kind).toBe('conflict')
    expect(interpretPublicationError(e(409)).kind).toBe('archived')
    expect(interpretPublicationError(e(422, { code: 'not_ready' })).kind).toBe('not_ready')
    expect(interpretPublicationError(e(500, { partial: true })).kind).toBe('partial')
    expect(interpretPublicationError(e(401)).kind).toBe('auth')
    expect(interpretPublicationError(e(403)).kind).toBe('forbidden')
    expect(interpretPublicationError(new Error('network')).kind).toBe('unavailable')
  })

  it('names why a previewed file would not be published', () => {
    const media = (over: Partial<AdminContentPreviewMedia>): AdminContentPreviewMedia => ({
      link_id: 1, role: 'hero', directus_files_id: HERO, alt: null, caption: null, enabled: true, language: null, version_label: null, file_date: null, missing: false,
      file: { filename_download: 'a.png', title: null, type: 'image/png', width: 1, height: 1, is_public: true, archived: false }, ...over,
    })
    expect(previewMediaStatus(media({}))).toBeNull()
    expect(previewMediaStatus(media({ missing: true, file: null }))).toBe('Missing file')
    expect(previewMediaStatus(media({ enabled: false }))).toBe('Disabled link')
    expect(previewMediaStatus(media({ file: { ...media({}).file!, archived: true } }))).toBe('Archived')
    expect(previewMediaStatus(media({ file: { ...media({}).file!, is_public: false } }))).toBe('Not public')
  })
})
