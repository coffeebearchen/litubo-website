/**
 * CC-IMP-05 — Content Center SEO & Locales: BFF, slug lock, Open Graph image,
 * locale start / isolation, shared SEO rules and page helpers.
 *
 * The real services run against an in-memory Directus double that enforces the
 * locale and junction unique indexes (cc-imp-01-constraints.sql) and the draft
 * revision guard (cc-imp-01-fix-01-revision-guard.sql), and records every write,
 * so "nothing was written" and "only this row was written" are checked.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createLocaleDraft, updateLocaleDraft } from '../server/utils/contentDraft'
import { saveContentMediaRelations, getContentMediaRelations } from '../server/utils/contentMediaRelations'
import { getContentSeoLocales, saveContentSeoLocales } from '../server/utils/contentSeoLocales'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import {
  contentSeoChecklist,
  effectiveSeoDescription,
  effectiveSeoTitle,
  isContentSlugLocked,
  socialImageSource,
  validateCanonicalPath,
} from '../utils/contentSeo'
import {
  buildSeoLocalesSaveBody,
  interpretSeoLocalesSaveError,
  localeStartBody,
  seoChangedFields,
  seoFormFromRow,
  seoLocaleTabs,
  suggestedLocaleSlug,
} from '../utils/contentSeoLocalesEditor'
import { contentEditorLocaleRoute, contentSeoLocalesRoute, parseContentLocaleQuery } from '../utils/contentCenter'
import { buildMediaRelationsSaveBody, mediaRelationsStateFrom } from '../utils/contentMediaRelationsEditor'

type Row = Record<string, unknown> & { id: number }

const ITEM = 6
const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION SEO'
const EN_TEXT = 'English body text that must never be copied into another language'
const HERO = '11111111-1111-4111-8111-111111111111'
const OG_A = '22222222-2222-4222-8222-222222222222'
const OG_B = '33333333-3333-4333-8333-333333333333'
const INLINE = '44444444-4444-4444-8444-444444444444'
const PDF = '55555555-5555-4555-8555-555555555555'
const SRC = '66666666-6666-4666-8666-666666666666'
const ARCHIVED = '77777777-7777-4777-8777-777777777777'
const MISSING = '88888888-8888-4888-8888-888888888888'
const BLOCK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PUBLISHED = ['en']

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

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

class FakeDirectus {
  item: Row = {
    id: ITEM, content_type: 'technical_article', status: 'draft', first_published_at: null, archived_at: null,
    date_created: '2026-09-15T00:00:00Z', date_updated: null,
  }

  locales = new Map<number, Row>()
  links = new Map<number, Row>()
  files = new Map<string, { id: string, type: string, filename_download: string, is_public: boolean }>([
    [HERO, { id: HERO, type: 'image/png', filename_download: 'hero.png', is_public: false }],
    [OG_A, { id: OG_A, type: 'image/png', filename_download: 'og-a.png', is_public: false }],
    [OG_B, { id: OG_B, type: 'image/webp', filename_download: 'og-b.webp', is_public: true }],
    [INLINE, { id: INLINE, type: 'image/jpeg', filename_download: 'inline.jpg', is_public: false }],
    [PDF, { id: PDF, type: 'application/pdf', filename_download: 'guide.pdf', is_public: false }],
    [SRC, { id: SRC, type: 'text/plain', filename_download: 'notes.txt', is_public: false }],
    [ARCHIVED, { id: ARCHIVED, type: 'image/png', filename_download: 'old.png', is_public: false }],
  ])

  archived = new Set([ARCHIVED])
  writes: Array<{ method: string, path: string, body: unknown }> = []
  /** Throws on the first write whose "METHOD /path" matches. */
  failWrite: RegExp | null = null
  private nextLocale = 20
  private nextLink = 100

  constructor() {
    this.addLocale({
      locale: 'en', title: TEST_TITLE, slug: 'test-only-seo', summary: 'English summary',
      blocks: [{ id: BLOCK_ID, type: 'text', data: { heading: 'Intro', paragraphs: [EN_TEXT] } }], draft_revision: 5,
    })
    this.addLink({ directus_files_id: HERO, file_role: 'hero' })
    this.addLink({ directus_files_id: INLINE, file_role: 'inline' })
    this.addLink({ directus_files_id: PDF, file_role: 'download', language: 'all' })
    this.addLink({ directus_files_id: SRC, file_role: 'source_document' })
  }

  addLocale(values: Partial<Row>): Row {
    const row = {
      id: this.nextLocale++, content_items_id: ITEM, locale: 'en', title: 'T', slug: 's', summary: null, blocks: [],
      seo_title: null, seo_description: null, canonical_path: null, noindex: false, draft_revision: 1,
      published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit', ...values,
    } as Row
    this.locales.set(row.id, row)
    return row
  }

  addLink(values: Partial<Row>): Row {
    const row = {
      id: this.nextLink++, content_items_id: ITEM, alt_en: null, alt_es: null, alt_pt: null, caption_en: null, caption_es: null, caption_pt: null,
      language: null, version_label: null, file_date: null, enabled: true, sort: 0, ...values,
    } as Row
    this.links.set(row.id, row)
    return row
  }

  localeRow(locale: string): Row | undefined {
    return [...this.locales.values()].find(r => r.locale === locale)
  }

  linksOf(role: string): Row[] {
    return [...this.links.values()].filter(r => r.file_role === role)
  }

  fetch: FetchFn = (async (path: string, options: Record<string, unknown> = {}) => {
    const method = String(options.method ?? 'GET')
    const url = new URL(path, 'http://directus.local')
    const q = (key: string) => url.searchParams.get(key)
    const ids = (key: string) => String(q(key) ?? '').split(',').filter(Boolean)
    const body = options.body as Row | Row[] | number[]
    if (method !== 'GET') {
      this.writes.push({ method, path: url.pathname, body: clone(body) })
      if (this.failWrite?.test(`${method} ${url.pathname}`)) {
        this.failWrite = null
        throw Object.assign(new Error('Directus unavailable'), { statusCode: 503 })
      }
    }

    if (url.pathname === '/items/content_items' && method === 'GET') {
      if (q('filter[id][_eq]')) {
        if (Number(q('filter[id][_eq]')) !== ITEM) return { data: [] }
        return { data: [{ ...clone(this.item), locales: [...this.locales.values()].map(r => clone(r)) }] }
      }
      return { data: ids('filter[id][_in]').map(Number).filter(id => id === ITEM).map(id => ({ id, status: this.item.status })) }
    }

    if (url.pathname === '/items/content_item_locales') {
      if (method === 'GET') {
        let rows = [...this.locales.values()]
        if (q('filter[content_items_id][_eq]')) rows = rows.filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
        if (q('filter[locale][_eq]')) rows = rows.filter(r => r.locale === q('filter[locale][_eq]'))
        if (q('filter[slug][_eq]')) rows = rows.filter(r => r.slug === q('filter[slug][_eq]'))
        return { data: rows.map(r => clone(r)) }
      }
      if (method === 'POST') {
        const row = body as Row
        const clash = [...this.locales.values()]
        if (clash.some(r => r.content_items_id === row.content_items_id && r.locale === row.locale)) throw uniqueError('content_items_id, locale')
        if (clash.some(r => r.locale === row.locale && r.slug === row.slug)) throw uniqueError('locale, slug')
        return { data: { id: this.addLocale(row).id } }
      }
    }

    const localeMatch = /^\/items\/content_item_locales\/(\d+)$/.exec(url.pathname)
    if (localeMatch && method === 'PATCH') {
      const old = this.locales.get(Number(localeMatch[1]))!
      const next = { ...old, ...(body as Row) }
      const draftFields = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex']
      const changed = draftFields.some(f => JSON.stringify(old[f] ?? null) !== JSON.stringify(next[f] ?? null))
      if ((changed || next.draft_revision !== old.draft_revision) && next.draft_revision !== Number(old.draft_revision) + 1) throw uniqueError('draft_revision')
      if ([...this.locales.values()].some(r => r.id !== old.id && r.locale === next.locale && r.slug === next.slug)) throw uniqueError('locale, slug')
      this.locales.set(old.id, next)
      return { data: { id: old.id } }
    }

    if (url.pathname === '/items/content_items_files') {
      if (method === 'GET') {
        let rows = [...this.links.values()].filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
        if (q('filter[file_role][_in]')) rows = rows.filter(r => ids('filter[file_role][_in]').includes(String(r.file_role)))
        return {
          data: rows.sort((a, b) => Number(a.sort) - Number(b.sort) || a.id - b.id)
            .map(r => ({ ...clone(r), directus_files_id: clone(this.files.get(String(r.directus_files_id))) })),
        }
      }
      if (method === 'POST') {
        const rows = Array.isArray(body) ? body as Row[] : [body as Row]
        for (const row of rows) {
          if ([...this.links.values()].some(l => l.content_items_id === row.content_items_id && l.directus_files_id === row.directus_files_id && l.file_role === row.file_role)) {
            throw uniqueError('content_items_id, directus_files_id, file_role')
          }
          this.addLink(row)
        }
        return { data: {} }
      }
      if (method === 'PATCH') {
        for (const row of body as Row[]) this.links.set(row.id, { ...this.links.get(row.id)!, ...row })
        return { data: [] }
      }
      if (method === 'DELETE') {
        for (const id of body as number[]) this.links.delete(id)
        return {}
      }
    }

    const linkMatch = /^\/items\/content_items_files\/(\d+)$/.exec(url.pathname)
    if (linkMatch && method === 'PATCH') {
      const id = Number(linkMatch[1])
      const next = { ...this.links.get(id)!, ...(body as Row) }
      if ([...this.links.values()].some(l => l.id !== id && l.directus_files_id === next.directus_files_id && l.file_role === next.file_role)) {
        throw uniqueError('content_items_id, directus_files_id, file_role')
      }
      this.links.set(id, next)
      return { data: { id } }
    }

    if (url.pathname === '/items/content_relations' && method === 'GET') return { data: [] }
    if (url.pathname === '/items/media_file_lifecycle' && method === 'GET') {
      return { data: ids('filter[file_id][_in]').filter(id => this.archived.has(id)).map(file_id => ({ file_id })) }
    }
    if (url.pathname === '/files' && method === 'GET') {
      return { data: ids('filter[id][_in]').filter(id => this.files.has(id)).map(id => ({ id, type: this.files.get(id)!.type })) }
    }
    throw new Error(`unexpected request ${method} ${path}`)
  }) as FetchFn
}

let db: FakeDirectus
beforeEach(() => { db = new FakeDirectus() })

const nonOgLinks = () => clone([...db.links.values()].filter(r => r.file_role !== 'og_image'))

async function load() {
  return getContentSeoLocales(db.fetch, ITEM, PUBLISHED)
}

// ── Read ────────────────────────────────────────────────────────────────────

describe('GET seo-locales', () => {
  it('returns configured locales, locale rows without blocks, the hero fallback and no Open Graph image yet', async () => {
    const value = await load()
    expect(value.site_locales).toEqual(['en', 'es', 'pt'])
    expect(value.default_locale).toBe('en')
    expect(value.published_locales).toEqual(['en'])
    expect(value.locales.map(l => l.locale)).toEqual(['en'])
    expect(value.locales[0]).not.toHaveProperty('blocks')
    expect(value.locales[0].block_count).toBe(1)
    expect(value.og_image).toBeNull()
    expect(value.hero?.directus_files_id).toBe(HERO)
    expect(value.og_version).toMatch(/^[0-9a-f]{32}$/)
    expect(db.writes).toHaveLength(0)
  })

  it('derives language states from the rows only (no stored status)', async () => {
    db.addLocale({ locale: 'es', slug: 'test-only-seo', draft_revision: 3, published_revision: 3 })
    db.addLocale({ locale: 'pt', slug: 'test-only-seo', draft_revision: 4, published_revision: 2 })
    const tabs = seoLocaleTabs(await load())
    expect(tabs.map(t => [t.code, t.state, t.isDefault, t.sitePublished])).toEqual([
      ['en', 'draft', true, true], ['es', 'published', false, false], ['pt', 'published_with_changes', false, false],
    ])
    const onlyEn = seoLocaleTabs({ ...(await load()), locales: [] })
    expect(onlyEn.every(t => t.stateLabel === 'Not started')).toBe(true)
  })
})

// ── Start a language ────────────────────────────────────────────────────────

describe('start locale (existing POST /locales)', () => {
  it('creates a Spanish Draft with the typed title and slug, empty section text and no English copy', async () => {
    const enBefore = clone(db.localeRow('en'))
    await createLocaleDraft(db.fetch, ITEM, localeStartBody('es', '  TEST ONLY ES title ', ' test-only-seo '))
    const es = db.localeRow('es')!
    expect(es).toMatchObject({ title: 'TEST ONLY ES title', slug: 'test-only-seo', summary: null, noindex: false, draft_revision: 1, published_revision: null })
    expect(es.seo_title ?? null).toBeNull()
    expect(JSON.stringify(es.blocks)).not.toContain(EN_TEXT)
    expect(es.blocks).toEqual([{ id: BLOCK_ID, type: 'text', data: { paragraphs: [''] } }])
    expect(db.localeRow('en')).toEqual(enBefore)
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['POST /items/content_item_locales'])
  })

  it('rejects a duplicate, the default and an unknown locale without writing', async () => {
    db.addLocale({ locale: 'es', slug: 'x' })
    expect((await rejection(createLocaleDraft(db.fetch, ITEM, { locale: 'es', title: 'T', slug: 'y' }))).statusCode).toBe(409)
    expect((await rejection(createLocaleDraft(db.fetch, ITEM, { locale: 'en', title: 'T', slug: 'y' }))).statusCode).toBe(422)
    expect((await rejection(createLocaleDraft(db.fetch, ITEM, { locale: 'zh', title: 'T', slug: 'y' }))).statusCode).toBe(422)
    expect((await rejection(createLocaleDraft(db.fetch, ITEM, { locale: 'pt', title: 'T', slug: 'y', blocks: [] }))).statusCode).toBe(422)
    expect(db.writes).toHaveLength(0)
  })

  it('page helpers suggest the default slug and send only locale, title and slug', async () => {
    expect(suggestedLocaleSlug(await load())).toBe('test-only-seo')
    expect(localeStartBody('pt', ' Título ', ' slug-pt ')).toEqual({ locale: 'pt', title: 'Título', slug: 'slug-pt' })
  })
})

// ── SEO fields ──────────────────────────────────────────────────────────────

describe('save SEO fields', () => {
  it('writes only the changed SEO fields of this locale with revision +1', async () => {
    const saved = await saveContentSeoLocales(db.fetch, ITEM, {
      locale: 'en', expectedDraftRevision: 5,
      fields: { seo_title: ' TEST ONLY SEO title ', seo_description: 'TEST ONLY meta', canonical_path: '/resources/insights/test-only', noindex: true },
    }, PUBLISHED)
    expect(db.writes).toHaveLength(1)
    const [write] = db.writes
    expect(write.path).toBe(`/items/content_item_locales/${db.localeRow('en')!.id}`)
    expect(write.body).toEqual({
      seo_title: 'TEST ONLY SEO title', seo_description: 'TEST ONLY meta', canonical_path: '/resources/insights/test-only', noindex: true,
      draft_revision: 6, last_change_kind: 'manual_edit',
    })
    expect(saved.locales[0]).toMatchObject({ seo_title: 'TEST ONLY SEO title', noindex: true, draft_revision: 6, title: TEST_TITLE })
  })

  it('clears an optional field to null and never touches title, summary or blocks', async () => {
    db.localeRow('en')!.seo_title = 'Old'
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: { seo_title: '' } }, PUBLISHED)
    expect(db.writes[0].body).toEqual({ seo_title: null, draft_revision: 6, last_change_kind: 'manual_edit' })
    expect(db.localeRow('en')).toMatchObject({ title: TEST_TITLE, summary: 'English summary' })
  })

  it('requires expectedDraftRevision and rejects a stale one with the current revision; nothing is written', async () => {
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', fields: { noindex: true } }, PUBLISHED))).statusCode).toBe(422)
    const stale = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 4, fields: { noindex: true } }, PUBLISHED))
    expect(stale.statusCode).toBe(409)
    expect(stale.data.currentDraftRevision).toBe(5)
    expect(db.writes).toHaveLength(0)
  })

  it('rejects external, protocol-relative, scheme and malformed canonical paths', async () => {
    for (const bad of ['https://example.com/x', 'http://litubo.com/x', '//evil.example/x', 'javascript:alert(1)', 'resources/x', '/\\evil.example', '/has space']) {
      const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: { canonical_path: bad } }, PUBLISHED))
      expect(err.statusCode, bad).toBe(422)
      expect(err.data.field).toBe('canonical_path')
    }
    expect(db.writes).toHaveLength(0)
  })

  it('accepts only SEO fields and known keys (no title, blocks, status or publication fields)', async () => {
    for (const fields of [{ title: 'x' }, { blocks: [] }, { status: 'published' }, { published_snapshot: {} }, { first_published_at: '2026-01-01' }, { draft_revision: 9 }]) {
      const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields }, PUBLISHED))
      expect(err.statusCode, JSON.stringify(fields)).toBe(422)
    }
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: {}, publish: true }, PUBLISHED))).statusCode).toBe(422)
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'xx', expectedDraftRevision: 5, fields: { noindex: true } }, PUBLISHED))).statusCode).toBe(422)
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en' }, PUBLISHED))).statusCode).toBe(400)
    expect(db.writes).toHaveLength(0)
  })

  it('a not-started locale cannot be saved (404) and is not created', async () => {
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'es', expectedDraftRevision: 1, fields: { noindex: true } }, PUBLISHED))
    expect(err.statusCode).toBe(404)
    expect(db.localeRow('es')).toBeUndefined()
    expect(db.writes).toHaveLength(0)
  })

  it('an archived item cannot be changed', async () => {
    db.item.status = 'archived'
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: { noindex: true } }, PUBLISHED))).statusCode).toBe(409)
    expect((await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: { directus_files_id: OG_A, expectedOgVersion: (await load()).og_version } }, PUBLISHED))).statusCode).toBe(409)
    expect(db.writes).toHaveLength(0)
  })
})

describe('locale isolation', () => {
  beforeEach(() => {
    db.addLocale({ locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-seo', draft_revision: 2 })
    db.addLocale({ locale: 'pt', title: 'TEST ONLY PT', slug: 'test-only-seo', draft_revision: 7 })
  })

  it('an ES save writes the ES row only; EN and PT are unchanged', async () => {
    const en = clone(db.localeRow('en'))
    const pt = clone(db.localeRow('pt'))
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'es', expectedDraftRevision: 2, fields: { seo_title: 'TEST ONLY ES SEO', slug: 'test-only-seo-es' } }, PUBLISHED)
    expect(db.writes.map(w => w.path)).toEqual([`/items/content_item_locales/${db.localeRow('es')!.id}`])
    expect(db.localeRow('es')).toMatchObject({ seo_title: 'TEST ONLY ES SEO', slug: 'test-only-seo-es', draft_revision: 3 })
    expect(db.localeRow('en')).toEqual(en)
    expect(db.localeRow('pt')).toEqual(pt)
  })

  it('a PT save does not touch EN or ES, and the Editor PATCH path is isolated the same way', async () => {
    const en = clone(db.localeRow('en'))
    const es = clone(db.localeRow('es'))
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'pt', expectedDraftRevision: 7, fields: { noindex: true } }, PUBLISHED)
    await updateLocaleDraft(db.fetch, ITEM, 'pt', { expectedDraftRevision: 8, title: 'TEST ONLY PT edited' })
    expect(db.writes.every(w => w.path === `/items/content_item_locales/${db.localeRow('pt')!.id}`)).toBe(true)
    expect(db.localeRow('pt')).toMatchObject({ noindex: true, title: 'TEST ONLY PT edited', draft_revision: 9 })
    expect(db.localeRow('en')).toEqual(en)
    expect(db.localeRow('es')).toEqual(es)
  })

  it('a revision from another locale is stale for this one', async () => {
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'es', expectedDraftRevision: 5, fields: { noindex: true } }, PUBLISHED))
    expect(err.statusCode).toBe(409)
    expect(err.data.currentDraftRevision).toBe(2)
  })
})

// ── Slug lock ───────────────────────────────────────────────────────────────

describe('slug lock after first publication (Blueprint §14)', () => {
  it('an unpublished locale slug is editable', async () => {
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: { slug: 'test-only-seo-renamed' } }, PUBLISHED)
    expect(db.localeRow('en')!.slug).toBe('test-only-seo-renamed')
  })

  it('once first_published_at is set, a slug change is rejected on both save paths; nothing is written', async () => {
    db.localeRow('en')!.first_published_at = '2026-09-15T01:00:00Z'
    const seo = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 5, fields: { slug: 'test-only-other' } }, PUBLISHED))
    expect(seo.statusCode).toBe(422)
    expect(seo.data).toMatchObject({ field: 'slug', slugLocked: true })
    const editor = await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 5, slug: 'test-only-other', title: 'x' }))
    expect(editor.statusCode).toBe(422)
    expect(editor.data).toMatchObject({ field: 'slug', slugLocked: true })
    expect(db.writes).toHaveLength(0)
    expect(db.localeRow('en')!.slug).toBe('test-only-seo')
  })

  it('other SEO and content fields stay editable, and resending the same slug is not a change', async () => {
    db.localeRow('en')!.first_published_at = '2026-09-15T01:00:00Z'
    await saveContentSeoLocales(db.fetch, ITEM, {
      locale: 'en', expectedDraftRevision: 5,
      fields: { slug: 'test-only-seo', seo_title: 'TEST ONLY locked', seo_description: 'd', canonical_path: '/x', noindex: true },
    }, PUBLISHED)
    await updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 6, title: 'TEST ONLY title after publish', summary: 's' })
    expect(db.localeRow('en')).toMatchObject({ slug: 'test-only-seo', seo_title: 'TEST ONLY locked', noindex: true, title: 'TEST ONLY title after publish', draft_revision: 7 })
    expect(isContentSlugLocked(db.localeRow('en') as never)).toBe(true)
    expect(isContentSlugLocked({ first_published_at: null })).toBe(false)
  })

  it('the UI locks the slug input from the same row fact (source evidence)', () => {
    const seo = readFileSync(resolve(process.cwd(), 'components/admin/content/ContentSeoLocales.vue'), 'utf8')
    const editor = readFileSync(resolve(process.cwd(), 'components/admin/content/ContentEditor.vue'), 'utf8')
    expect(seo).toContain(':disabled="slugLocked"')
    expect(editor).toContain(':disabled="slugLocked"')
    expect(editor).toContain('isContentSlugLocked(row)')
  })
})

// ── Open Graph image ────────────────────────────────────────────────────────

describe('Open Graph image', () => {
  const og = async (directus_files_id: string | null) => ({ directus_files_id, expectedOgVersion: (await load()).og_version })

  it('select creates one og_image link and never touches hero, inline, download or source_document', async () => {
    const before = nonOgLinks()
    const saved = await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: await og(OG_A) }, PUBLISHED)
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['POST /items/content_items_files'])
    expect(db.writes[0].body).toEqual({ content_items_id: ITEM, directus_files_id: OG_A, file_role: 'og_image', enabled: true, sort: 0 })
    expect(saved.og_image?.directus_files_id).toBe(OG_A)
    expect(saved.hero?.directus_files_id).toBe(HERO)
    expect(nonOgLinks()).toEqual(before)
    expect(db.localeRow('en')!.draft_revision).toBe(5)
  })

  it('replace updates the one link in place; remove deletes it', async () => {
    const link = db.addLink({ directus_files_id: OG_A, file_role: 'og_image' })
    const before = nonOgLinks()
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: await og(OG_B) }, PUBLISHED)
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual([`PATCH /items/content_items_files/${link.id}`])
    expect(db.linksOf('og_image').map(r => r.directus_files_id)).toEqual([OG_B])
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: await og(null) }, PUBLISHED)
    expect(db.writes.at(-1)).toMatchObject({ method: 'DELETE', body: [link.id] })
    expect(db.linksOf('og_image')).toHaveLength(0)
    expect(nonOgLinks()).toEqual(before)
  })

  it('keeps at most one og_image link', async () => {
    db.addLink({ directus_files_id: OG_A, file_role: 'og_image' })
    const extra = db.addLink({ directus_files_id: OG_B, file_role: 'og_image', sort: 1 })
    await saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: await og(OG_A) }, PUBLISHED)
    expect(db.writes.map(w => w.method)).toEqual(['DELETE'])
    expect(db.writes[0].body).toEqual([extra.id])
    expect(db.linksOf('og_image').map(r => r.directus_files_id)).toEqual([OG_A])
  })

  it('rejects archived, non-image, missing and malformed files — a crafted request writes nothing', async () => {
    for (const [fileId, pattern] of [[ARCHIVED, /archived/], [PDF, /must be an image/], [MISSING, /does not exist/], ['not-a-uuid', /file id or null/]] as const) {
      const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: await og(fileId) }, PUBLISHED))
      expect(err.statusCode, fileId).toBe(422)
      expect(err.message).toMatch(pattern)
    }
    expect(db.writes).toHaveLength(0)
  })

  it('a stale Open Graph version is a 409 and nothing is written', async () => {
    const stale = await og(OG_A)
    db.addLink({ directus_files_id: OG_B, file_role: 'og_image' })
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: stale }, PUBLISHED))
    expect(err.statusCode).toBe(409)
    expect(err.data).toHaveProperty('currentOgVersion')
    expect(db.writes).toHaveLength(0)
  })

  it('an image change is validated before the SEO fields are written', async () => {
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, {
      locale: 'en', expectedDraftRevision: 5, fields: { seo_title: 'x' }, og_image: await og(ARCHIVED),
    }, PUBLISHED))
    expect(err.statusCode).toBe(422)
    expect(db.writes).toHaveLength(0)
    expect(db.localeRow('en')!.seo_title).toBeNull()
  })

  it('a Media & Relations save keeps the og_image link (and a hero change never writes it)', async () => {
    const ogLink = db.addLink({ directus_files_id: OG_A, file_role: 'og_image' })
    const current = await getContentMediaRelations(db.fetch, ITEM, 'en')
    const state = mediaRelationsStateFrom(current)
    state.media = state.media.filter(m => m.file_role !== 'hero')
    await saveContentMediaRelations(db.fetch, ITEM, buildMediaRelationsSaveBody(state, current.inventory_version, 'en'))
    expect(db.linksOf('hero')).toHaveLength(0)
    expect(db.links.get(ogLink.id)).toMatchObject({ directus_files_id: OG_A, file_role: 'og_image' })
    expect(JSON.stringify(db.writes)).not.toContain(String(OG_A))
  })
})

// ── Cross-collection partial failure ────────────────────────────────────────

describe('SEO + image save atomicity', () => {
  it('writes the locale row first; an image failure afterwards is reported as partial with what was saved', async () => {
    db.failWrite = /^POST \/items\/content_items_files$/
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, {
      locale: 'en', expectedDraftRevision: 5, fields: { seo_title: 'TEST ONLY partial' }, og_image: { directus_files_id: OG_A, expectedOgVersion: (await load()).og_version },
    }, PUBLISHED))
    expect(err.statusCode).toBe(500)
    expect(err.data).toMatchObject({ partial: true, saved: ['seo'], notSaved: ['og_image'], ogImageRetryable: true, currentDraftRevision: 6 })
    expect(db.localeRow('en')).toMatchObject({ seo_title: 'TEST ONLY partial', draft_revision: 6 })
    expect(db.linksOf('og_image')).toHaveLength(0)
    // What the page receives from `$fetch`: `{ statusCode, data: { message, data } }`.
    const view = interpretSeoLocalesSaveError({ statusCode: err.statusCode, data: { message: err.message, data: err.data } })
    expect(view).toMatchObject({ kind: 'partial', seoSaved: true, ogImageRetryable: true, currentDraftRevision: 6 })
  })

  it('an image-only failure before any write is not a partial save', async () => {
    db.failWrite = /^POST \/items\/content_items_files$/
    const err = await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: { directus_files_id: OG_A, expectedOgVersion: (await load()).og_version } }, PUBLISHED))
    expect(err.statusCode).toBe(503)
    expect(err.data?.partial).toBeUndefined()
  })
})

// ── Shared SEO rules and page helpers ───────────────────────────────────────

describe('shared SEO rules', () => {
  it('canonical path: same-site path or empty only', () => {
    expect(validateCanonicalPath('')).toEqual({ ok: true, path: null })
    expect(validateCanonicalPath(null)).toEqual({ ok: true, path: null })
    expect(validateCanonicalPath(' /resources/insights/x ')).toEqual({ ok: true, path: '/resources/insights/x' })
    expect(validateCanonicalPath('/a-b_c/d?e=1')).toMatchObject({ ok: true })
    for (const bad of ['https://x.com', '//x.com', 'javascript:x', 'x/y', '/a\\b', '/a b', '/a b', 1, `/${'a'.repeat(255)}`]) {
      expect(validateCanonicalPath(bad).ok, String(bad)).toBe(false)
    }
  })

  it('previews fall back to title / summary and to the hero image', () => {
    const base = { title: 'Page title', summary: 'Summary', seo_title: null, seo_description: '  ' }
    expect(effectiveSeoTitle(base)).toEqual({ text: 'Page title', source: 'fallback' })
    expect(effectiveSeoTitle({ ...base, seo_title: 'SEO' })).toEqual({ text: 'SEO', source: 'seo' })
    expect(effectiveSeoDescription(base)).toEqual({ text: 'Summary', source: 'fallback' })
    expect(effectiveSeoDescription({ ...base, summary: null })).toEqual({ text: '', source: 'none' })
    expect(socialImageSource({}, {})).toBe('og_image')
    expect(socialImageSource(null, {})).toBe('hero')
    expect(socialImageSource(null, null)).toBe('none')
  })

  it('the checklist is a fixed, deterministic list with no score or percentage', () => {
    const input = { title: 'T', summary: null, seo_title: null, seo_description: null, slug: 'new', canonical_path: '//x', noindex: true, slugLocked: false, ogImage: null, hero: { archived: false } }
    const items = contentSeoChecklist(input)
    expect(items.map(i => i.key)).toEqual(['slug', 'title', 'description', 'canonical', 'image', 'indexing'])
    expect(items.map(i => i.state)).toEqual(['attention', 'note', 'attention', 'attention', 'note', 'note'])
    expect(contentSeoChecklist(input)).toEqual(items)
    expect(JSON.stringify(items)).not.toMatch(/%|score|confidence/i)
    const good = contentSeoChecklist({ ...input, slug: 'ok-slug', seo_title: 'S', seo_description: 'D', canonical_path: null, noindex: false, ogImage: { archived: false } })
    expect(good.every(i => i.state === 'ok')).toBe(true)
    expect(contentSeoChecklist({ ...input, ogImage: { archived: true } }).find(i => i.key === 'image')?.state).toBe('attention')
  })
})

describe('page helpers', () => {
  const form = seoFormFromRow({ slug: 's', seo_title: null, seo_description: 'd', canonical_path: null, noindex: false })

  it('sends only changed fields, with the revision; image changes carry the image version only', () => {
    expect(seoChangedFields(form, { ...form, seo_title: '  ' })).toEqual({})
    expect(seoChangedFields(form, { ...form, seo_title: ' New ', seo_description: '', noindex: true })).toEqual({ seo_title: 'New', seo_description: null, noindex: true })
    const input = { locale: 'en' as const, revision: 5, original: form, current: form, originalOg: null, currentOg: null, ogVersion: 'v1' }
    expect(buildSeoLocalesSaveBody(input)).toBeNull()
    expect(buildSeoLocalesSaveBody({ ...input, current: { ...form, canonical_path: '/x' } })).toEqual({ locale: 'en', expectedDraftRevision: 5, fields: { canonical_path: '/x' } })
    const pick = { directus_files_id: OG_A, file: { filename_download: 'a', title: null, type: 'image/png', width: 1, height: 1, filesize: 1, is_public: false, archived: false } }
    expect(buildSeoLocalesSaveBody({ ...input, currentOg: pick })).toEqual({ locale: 'en', og_image: { directus_files_id: OG_A, expectedOgVersion: 'v1' } })
    expect(buildSeoLocalesSaveBody({ ...input, originalOg: pick })).toEqual({ locale: 'en', og_image: { directus_files_id: null, expectedOgVersion: 'v1' } })
  })

  it('explains conflicts, locked slugs, image errors and partial saves', () => {
    const e = (statusCode: number, message: string, data: Record<string, unknown>) => ({ statusCode, data: { message, data } })
    expect(interpretSeoLocalesSaveError(e(409, 'x', { currentDraftRevision: 8 }))).toMatchObject({ kind: 'conflict', currentDraftRevision: 8 })
    expect(interpretSeoLocalesSaveError(e(409, 'x', { field: 'og_image', currentOgVersion: 'v2' })).kind).toBe('og_conflict')
    expect(interpretSeoLocalesSaveError(e(422, 'The slug is locked', { field: 'slug', slugLocked: true }))).toMatchObject({ kind: 'field', field: 'slug', message: 'The slug is locked' })
    expect(interpretSeoLocalesSaveError(e(422, 'archived', { field: 'og_image' })).kind).toBe('image')
    expect(interpretSeoLocalesSaveError(e(500, 'part', { partial: true, saved: [], ogImageRetryable: false }))).toMatchObject({ kind: 'partial', seoSaved: false })
    expect(interpretSeoLocalesSaveError(new Error('net')).kind).toBe('unavailable')
  })

  it('locale query and routes: default needs no query, unknown values are rejected, never created', () => {
    expect(parseContentLocaleQuery(undefined)).toBe('en')
    expect(parseContentLocaleQuery('')).toBe('en')
    expect(parseContentLocaleQuery('es')).toBe('es')
    expect(parseContentLocaleQuery(['pt', 'es'])).toBe('pt')
    expect(parseContentLocaleQuery('xx')).toBeNull()
    expect(parseContentLocaleQuery('EN')).toBeNull()
    expect(contentEditorLocaleRoute(6, 'en')).toBe('/admin/content-center/6/editor')
    expect(contentEditorLocaleRoute(6, 'es')).toBe('/admin/content-center/6/editor?locale=es')
    expect(contentSeoLocalesRoute(6)).toBe('/admin/content-center/6/seo-locales')
    expect(contentSeoLocalesRoute(6, 'pt')).toBe('/admin/content-center/6/seo-locales?locale=pt')
  })
})

describe('source evidence — scope', () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

  it('no AI, translation, fake score, public URL or publish action on the SEO page', () => {
    const withoutStyles = (source: string) => source.split('<style')[0]
    const page = withoutStyles(read('components/admin/content/ContentSeoLocales.vue')) + withoutStyles(read('pages/admin/content-center/[id]/seo-locales.vue'))
    expect(page).not.toMatch(/Improve with AI|AI Fill|translate\(|\/ai\/|provider|score|%/i)
    expect(page).not.toMatch(/https?:\/\/(www\.)?litubo/i)
    expect(page).not.toMatch(/\/publish|\/unpublish|sitemap/i)
    expect(page).toContain('Nothing is translated or published automatically.')
    expect(page).toContain('Draft preview — public route not enabled')
    expect(page).toContain('Default public canonical will be resolved when Public Delivery is enabled.')
    expect(page).toContain('MediaLibraryPicker')
    expect(page).toContain('useMediaLibraryBrowser')
    expect(page).not.toMatch(/type="file"|upload/i)
  })

  it('the Content Editor never creates a language', () => {
    const editor = read('components/admin/content/ContentEditor.vue') + read('pages/admin/content-center/[id]/editor.vue')
    expect(editor).not.toMatch(/method:\s*'POST'/)
    expect(editor).toContain('parseContentLocaleQuery(route.query.locale)')
    expect(editor).toContain('Go to SEO &amp; locales to start this language')
  })

  it('the SEO BFF writes only locale rows and og_image links; no public or schema surface', () => {
    const bff = read('server/utils/contentSeoLocales.ts')
    expect(bff).not.toMatch(/published_snapshot|\/items\/content_items\b(?!_files)|\/items\/content_relations|\/fields|\/collections|permissions/)
    expect(bff.match(/file_role: 'og_image'/g)).toHaveLength(1)
  })
})
