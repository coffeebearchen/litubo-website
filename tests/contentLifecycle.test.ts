/**
 * CC-IMP-07 — Content Center Archive / Restore, archived write protection and Change History
 * (CONTENT-CENTER-BLUEPRINT-V1 §8, §14, §19, §23, §24; RELEASE-SAFETY-GATES RSG-01, RSG-03,
 * RSG-04, RSG-05, RSG-07).
 *
 * The real services run against an in-memory Directus double that emulates the draft
 * revision guard and records every write. Publishing a TEST ONLY item uses an isolated
 * registry injected into the call; the committed registry stays non-public.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocaleDraft, getContentDraft, isLifecycleGuardRejection, listContentDrafts, updateLocaleDraft } from '../server/utils/contentDraft'
import { getContentMediaRelations, saveContentMediaRelations } from '../server/utils/contentMediaRelations'
import { getContentPreviewPublish, publishContentLocale, unpublishContentLocale, type PublicationOptions } from '../server/utils/contentPublication'
import { getContentSeoLocales, saveContentSeoLocales } from '../server/utils/contentSeoLocales'
import { archiveContentItem, restoreContentItem } from '../server/utils/contentLifecycle'
import { getContentHistory, mapHistoryRevision, type HistoryLookups, type HistoryRevision } from '../server/utils/contentHistory'
import type { FetchFn } from '../server/utils/mediaLifecycle'
import { CONTENT_TYPES, getContentType } from '../utils/contentTypes'

type Row = Record<string, unknown> & { id: number }

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ITEM = 6
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION lifecycle'
const HERO = '11111111-1111-4111-8111-111111111111'
const PDF = '55555555-5555-4555-8555-555555555555'
const NOW = '2026-09-15T12:00:00.000Z'
const LATER = '2026-09-15T13:00:00.000Z'
const ADMIN = { first_name: 'TEST ONLY', last_name: 'Admin', email: 'admin@example.com' }

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const DRAFT_FIELDS = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex']

function publicRegistry(): PublicationOptions['resolveType'] {
  return (id: unknown) => {
    const def = getContentType(id)
    return def?.id === 'technical_article' ? { ...def, publicEnabled: true } : def
  }
}
const RUNTIME: PublicationOptions = { publishedLocales: ['en'] }
const TEST_PUBLIC_ES: PublicationOptions = { publishedLocales: ['en', 'es'], resolveType: publicRegistry() }

async function rejection(promise: Promise<unknown>): Promise<{ statusCode: number, message: string, data: Record<string, unknown> }> {
  try {
    await promise
  } catch (err) {
    return err as { statusCode: number, message: string, data: Record<string, unknown> }
  }
  throw new Error('expected a rejection')
}

function uniqueError(field: string) {
  return Object.assign(new Error('unique'), { statusCode: 400, data: { errors: [{ extensions: { code: 'RECORD_NOT_UNIQUE', field } }] } })
}

class FakeDirectus {
  item: Row = { id: ITEM, content_type: 'technical_article', status: 'draft', archived_at: null, first_published_at: null, date_created: '2026-09-15T00:00:00Z', date_updated: null }
  locales = new Map<number, Row>()
  links = new Map<number, Row>()
  files = new Map<string, Record<string, unknown>>([
    [HERO, { id: HERO, type: 'image/png', filename_download: 'hero.png', title: 'TEST ONLY hero', width: 1600, height: 900, filesize: 10, is_public: true }],
    [PDF, { id: PDF, type: 'application/pdf', filename_download: 'guide.pdf', title: null, width: null, height: null, filesize: 10, is_public: true }],
  ])

  relations: Row[] = [
    { id: 5, content_items_id: ITEM, relation_kind: 'product', sort: 0, product_id: { id: 3, name_en: 'TEST ONLY product', product_code: 'TEST-3', status: 'draft' }, related_content_id: null },
  ]

  revisions: Array<Record<string, unknown>> = []
  writes: Array<{ method: string, path: string, body: unknown }> = []
  failWrite: RegExp | null = null
  failWriteError: unknown = null
  private nextLocale = 30

  constructor() {
    this.locales.set(20, this.localeRow({
      id: 20, locale: 'en', title: TITLE, slug: 'test-only-lifecycle', summary: 'TEST ONLY summary', draft_revision: 4,
      blocks: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'text', data: { paragraphs: ['TEST ONLY paragraph.'] } }],
    }))
    this.locales.set(21, this.localeRow({
      id: 21, locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-ciclo', summary: 'TEST ONLY resumen', draft_revision: 2,
      blocks: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'text', data: { paragraphs: ['TEST ONLY párrafo.'] } }],
    }))
    this.links.set(101, this.linkRow({ id: 101, directus_files_id: HERO, file_role: 'hero', alt_en: 'TEST ONLY hero alt' }))
    this.links.set(102, this.linkRow({ id: 102, directus_files_id: PDF, file_role: 'download', language: 'all' }))
  }

  localeRow(values: Partial<Row>): Row {
    return {
      id: 0, content_items_id: ITEM, locale: 'en', title: 'T', slug: 's', summary: null, blocks: [], seo_title: null, seo_description: null,
      canonical_path: null, noindex: false, draft_revision: 1, published_revision: null, published_at: null, first_published_at: null,
      last_change_kind: 'manual_edit', published_snapshot: null, ...values,
    } as Row
  }

  linkRow(values: Partial<Row>): Row {
    return {
      id: 0, content_items_id: ITEM, alt_en: null, alt_es: null, alt_pt: null, caption_en: null, caption_es: null, caption_pt: null,
      language: null, version_label: null, file_date: null, enabled: true, sort: 0, ...values,
    } as Row
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
    const body = options.body as Row | Row[] | number[]
    if (method !== 'GET') {
      this.writes.push({ method, path: url.pathname, body: clone(body) })
      if (this.failWrite?.test(`${method} ${url.pathname}`)) {
        const error = this.failWriteError ?? Object.assign(new Error('Directus unavailable'), { statusCode: 503 })
        this.failWrite = null
        this.failWriteError = null
        throw error
      }
    }
    const p = url.pathname

    if (p === '/items/content_items' && method === 'GET') {
      if (q('filter[id][_eq]')) {
        return Number(q('filter[id][_eq]')) === ITEM ? { data: [{ ...clone(this.item), locales: [...this.locales.values()].map(r => clone(r)) }] } : { data: [] }
      }
      return { data: ids('filter[id][_in]').map(Number).filter(id => id === ITEM).map(id => ({ id, status: this.item.status })) }
    }
    if (p === `/items/content_items/${ITEM}` && method === 'PATCH') {
      this.item = { ...this.item, ...(body as Row) }
      return { data: { id: ITEM } }
    }
    if (p === '/items/content_item_locales') {
      if (method === 'GET') {
        let rows = [...this.locales.values()]
        if (q('filter[content_items_id][_eq]')) rows = rows.filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
        if (q('filter[locale][_eq]')) rows = rows.filter(r => r.locale === q('filter[locale][_eq]'))
        if (q('filter[slug][_eq]')) rows = rows.filter(r => r.slug === q('filter[slug][_eq]'))
        return { data: rows.map(r => clone(r)) }
      }
      if (method === 'POST') {
        const row = body as Row
        if ([...this.locales.values()].some(r => r.locale === row.locale && r.slug === row.slug)) throw uniqueError('locale, slug')
        const created = this.localeRow({ ...row, id: this.nextLocale++ })
        this.locales.set(created.id, created)
        return { data: { id: created.id } }
      }
      if (method === 'PATCH') {
        for (const patch of body as Row[]) this.patchLocale(patch.id, patch)
        return { data: [] }
      }
    }
    const localeMatch = /^\/items\/content_item_locales\/(\d+)$/.exec(p)
    if (localeMatch && method === 'PATCH') {
      this.patchLocale(Number(localeMatch[1]), body as Row)
      return { data: { id: Number(localeMatch[1]) } }
    }
    if (p === '/items/content_items_files') {
      if (method === 'GET') {
        let rows = [...this.links.values()].filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
        if (q('filter[id][_in]')) rows = rows.filter(r => ids('filter[id][_in]').map(Number).includes(r.id))
        if (q('filter[file_role][_eq]')) rows = rows.filter(r => r.file_role === q('filter[file_role][_eq]'))
        if (q('filter[file_role][_in]')) rows = rows.filter(r => ids('filter[file_role][_in]').includes(String(r.file_role)))
        return { data: rows.map(r => ({ ...clone(r), directus_files_id: clone(this.files.get(String(r.directus_files_id)) ?? null) })) }
      }
      if (method === 'PATCH') {
        for (const patch of body as Row[]) this.links.set(patch.id, { ...this.links.get(patch.id)!, ...patch })
        return { data: [] }
      }
    }
    if (p === '/items/content_relations' && method === 'GET') return { data: clone(this.relations) }
    if (p === '/items/media_file_lifecycle' && method === 'GET') return { data: [] }
    if (p === '/files' && method === 'GET') return { data: ids('filter[id][_in]').filter(id => this.files.has(id)).map(id => ({ id, type: this.files.get(id)!.type })) }
    if (p === '/revisions' && method === 'GET') {
      // Deliberately ignores the item filter: the service must keep only this item's rows itself.
      return { data: clone(this.revisions.filter(r => r.collection === q('filter[collection][_eq]'))) }
    }
    throw new Error(`unexpected request ${method} ${path}`)
  }) as FetchFn
}

let db: FakeDirectus
beforeEach(() => { db = new FakeDirectus() })

const lifecycle = async () => (await getContentHistory(db.fetch, ITEM, 1)).lifecycle
const archive = async (fingerprint?: string, now = NOW) =>
  archiveContentItem(db.fetch, ITEM, { expectedLifecycleFingerprint: fingerprint ?? (await lifecycle()).lifecycleFingerprint }, () => now)
const restore = async (fingerprint?: string) =>
  restoreContentItem(db.fetch, ITEM, { expectedLifecycleFingerprint: fingerprint ?? (await lifecycle()).lifecycleFingerprint })
const workingCopy = (row: Row) => clone(Object.fromEntries([...DRAFT_FIELDS, 'draft_revision', 'locale'].map(f => [f, row[f]])))

async function reviewed(locale: 'en' | 'es', options: PublicationOptions) {
  const state = await getContentPreviewPublish(db.fetch, ITEM, locale, options)
  return { expectedDraftRevision: state.locales.find(l => l.locale === locale)!.draft_revision!, expectedPublicationInputFingerprint: state.publicationInputFingerprint }
}

async function publishBoth() {
  await publishContentLocale(db.fetch, ITEM, 'en', await reviewed('en', TEST_PUBLIC_ES), { ...TEST_PUBLIC_ES, now: () => NOW })
  await publishContentLocale(db.fetch, ITEM, 'es', await reviewed('es', TEST_PUBLIC_ES), { ...TEST_PUBLIC_ES, now: () => NOW })
  db.writes = []
}

// ── Archive ──────────────────────────────────────────────────────────────────

describe('archive — explicit human action (Blueprint §24, RSG-03)', () => {
  it('draft → archived: one item write; locale rows, media links and relations untouched; nothing deleted', async () => {
    const before = { locales: clone([...db.locales.values()]), links: clone([...db.links.values()]), relations: clone(db.relations) }
    const res = await archive()
    expect(res.result).toBe('archived')
    expect(db.writes).toEqual([{ method: 'PATCH', path: '/items/content_items/6', body: { status: 'archived', archived_at: NOW } }])
    expect(res.lifecycle).toMatchObject({ status: 'archived', archived_at: NOW, can_archive: false, can_restore: true })
    expect({ locales: [...db.locales.values()], links: [...db.links.values()], relations: db.relations }).toEqual(before)
  })

  it('published → archived keeps every snapshot and first_published_at (unreadable while archived)', async () => {
    await publishBoth()
    const locales = clone([...db.locales.values()])
    const res = await archive()
    expect([...db.locales.values()]).toEqual(locales)
    expect(db.item).toMatchObject({ status: 'archived', first_published_at: NOW })
    expect(res.lifecycle.published_locales).toEqual(['en', 'es'])
  })

  it('a stale lifecycle fingerprint is 409 lifecycle_changed and writes nothing', async () => {
    const old = (await lifecycle()).lifecycleFingerprint
    db.row('es').published_at = LATER
    const err = await rejection(archive(old))
    expect(err.statusCode).toBe(409)
    expect(err.data.code).toBe('lifecycle_changed')
    expect(err.data.currentLifecycleFingerprint).not.toBe(old)

    db = new FakeDirectus()
    const beforeOther = (await lifecycle()).lifecycleFingerprint
    db.item.status = 'archived'
    expect((await rejection(archive(beforeOther))).data.code).toBe('lifecycle_changed')
    expect(db.writes).toHaveLength(0)
  })

  it('illegal transitions are 403 invalid_transition with no write: archive an archived item, restore a draft', async () => {
    await archive()
    db.writes = []
    const again = await rejection(archive())
    expect(again.statusCode).toBe(403)
    expect(again.data.code).toBe('invalid_transition')
    db = new FakeDirectus()
    const restoreDraft = await rejection(restore())
    expect(restoreDraft.statusCode).toBe(403)
    expect(db.writes).toHaveLength(0)
  })

  it('rejects invalid bodies and unknown items without writing', async () => {
    const valid = (await lifecycle()).lifecycleFingerprint
    expect((await rejection(archiveContentItem(db.fetch, ITEM, {}))).statusCode).toBe(422)
    expect((await rejection(archiveContentItem(db.fetch, ITEM, undefined))).statusCode).toBe(400)
    expect((await rejection(archiveContentItem(db.fetch, ITEM, { expectedLifecycleFingerprint: 'abc' }))).statusCode).toBe(422)
    expect((await rejection(archiveContentItem(db.fetch, ITEM, { expectedLifecycleFingerprint: valid, status: 'archived' }))).statusCode).toBe(422)
    expect((await rejection(archiveContentItem(db.fetch, 999, { expectedLifecycleFingerprint: valid }))).statusCode).toBe(404)
    expect((await rejection(restoreContentItem(db.fetch, ITEM, { expectedLifecycleFingerprint: valid, publish: true }))).statusCode).toBe(422)
    expect(db.writes).toHaveLength(0)
  })
})

// ── Restore ──────────────────────────────────────────────────────────────────

describe('restore — archived → draft, snapshots cleared, never published (Blueprint §24, RSG-01, RSG-05)', () => {
  it('clears every locale publication first, then returns the item to draft; drafts, media, relations and first_published_at are kept', async () => {
    await publishBoth()
    await archive()
    db.writes = []
    const drafts = [...db.locales.values()].map(workingCopy)
    const links = clone([...db.links.values()])

    const res = await restore()
    expect(res.result).toBe('restored')
    expect(db.writes.map(w => `${w.method} ${w.path}`)).toEqual(['PATCH /items/content_item_locales', 'PATCH /items/content_items/6'])
    expect(db.writes[0].body).toEqual([
      { id: 20, published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'restore' },
      { id: 21, published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'restore' },
    ])
    expect(db.writes[1].body).toEqual({ status: 'draft', archived_at: null })

    for (const row of db.locales.values()) {
      expect(row).toMatchObject({ published_snapshot: null, published_revision: null, published_at: null, first_published_at: NOW, last_change_kind: 'restore' })
    }
    expect([...db.locales.values()].map(workingCopy)).toEqual(drafts)
    expect([...db.links.values()]).toEqual(links)
    expect(db.relations).toHaveLength(1)
    expect(db.item).toMatchObject({ status: 'draft', archived_at: null, first_published_at: NOW })
    expect(res.lifecycle).toMatchObject({ status: 'draft', published_locales: [], can_archive: true, can_restore: false })

    // Slug lock survives (Blueprint §14).
    const locked = await rejection(updateLocaleDraft(db.fetch, ITEM, 'es', { expectedDraftRevision: 2, slug: 'another-slug' }))
    expect(locked.data).toMatchObject({ slugLocked: true })
  })

  it('does not publish: the runtime Publish is still blocked by readiness after restore', async () => {
    await archive()
    await restore()
    const state = await getContentPreviewPublish(db.fetch, ITEM, 'en', RUNTIME)
    expect(state.publication.has_snapshot).toBe(false)
    expect(state.readiness.hard.filter(c => c.state === 'fail').map(c => c.key)).toEqual(['type_public'])
    const err = await rejection(publishContentLocale(db.fetch, ITEM, 'en', await reviewed('en', RUNTIME), RUNTIME))
    expect(err.statusCode).toBe(422)
    expect(db.item.status).toBe('draft')
  })

  it('an interrupted restore leaves the item archived (not public) and a reload + retry finishes it', async () => {
    await publishBoth()
    await archive()
    db.failWrite = /^PATCH \/items\/content_items\/6$/
    const err = await rejection(restore())
    expect(err.statusCode).toBe(500)
    expect(err.data).toMatchObject({ partial: true, retryable: true, completedSteps: 1 })
    expect(db.item.status).toBe('archived')
    expect([...db.locales.values()].every(r => r.published_snapshot === null)).toBe(true)
    expect((await restore()).result).toBe('restored')
    expect(db.item.status).toBe('draft')
  })

  it('never leaves a draft item holding a published translation', async () => {
    await publishBoth()
    await archive()
    await restore()
    const published = [...db.locales.values()].filter(r => r.published_snapshot !== null)
    expect(db.item.status === 'draft' && published.length > 0).toBe(false)
    expect([...db.locales.values()].map(r => r.locale)).toEqual(['en', 'es'])
  })
})

// ── Archived write protection ───────────────────────────────────────────────

describe('archived content is read-only for every existing mutation (RSG-01, RSG-03)', () => {
  it('Editor, SEO, Open Graph, Start locale, Media & Relations, Publish and Unpublish all fail closed without writing', async () => {
    const review = await reviewed('en', { publishedLocales: ['en'], resolveType: publicRegistry() })
    await archive()
    db.writes = []
    const cases: Array<[string, Promise<unknown>, number]> = [
      ['editor save', updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: 'x' }), 409],
      ['SEO save', saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 4, fields: { seo_title: 'x' } }, ['en']), 409],
      ['Open Graph save', saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: { directus_files_id: HERO, expectedOgVersion: 'x' } }, ['en']), 409],
      ['start locale', createLocaleDraft(db.fetch, ITEM, { locale: 'pt', title: 'TEST ONLY PT', slug: 'test-only-pt' }), 409],
      ['media & relations save', saveContentMediaRelations(db.fetch, ITEM, { expectedInventoryVersion: 'x', media: [], relations: [] }), 409],
      ['unpublish', unpublishContentLocale(db.fetch, ITEM, 'en', {}, RUNTIME), 409],
    ]
    for (const [name, promise, status] of cases) {
      expect((await rejection(promise)).statusCode, name).toBe(status)
    }
    const publish = await rejection(publishContentLocale(db.fetch, ITEM, 'en', { ...review, expectedPublicationInputFingerprint: (await reviewed('en', { publishedLocales: ['en'], resolveType: publicRegistry() })).expectedPublicationInputFingerprint }, { publishedLocales: ['en'], resolveType: publicRegistry() }))
    expect(publish.statusCode).toBe(422)
    expect((publish.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['item_not_archived'])
    expect(db.writes).toHaveLength(0)
  })

  it('admin reads keep working while archived', async () => {
    await archive()
    expect((await getContentDraft(db.fetch, ITEM)).status).toBe('archived')
    expect((await getContentSeoLocales(db.fetch, ITEM, ['en'])).item.status).toBe('archived')
    expect((await getContentMediaRelations(db.fetch, ITEM)).item.status).toBe('archived')
    expect((await getContentPreviewPublish(db.fetch, ITEM, 'en', RUNTIME)).can_unpublish).toBe(false)
    expect((await getContentHistory(db.fetch, ITEM, 1)).lifecycle.can_restore).toBe(true)
  })

  it('restore makes the draft writable again', async () => {
    await archive()
    await restore()
    await updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: `${TITLE} v2` })
    expect(db.row('en')).toMatchObject({ title: `${TITLE} v2`, draft_revision: 5 })
    await createLocaleDraft(db.fetch, ITEM, { locale: 'pt', title: 'TEST ONLY PT', slug: 'test-only-pt' })
    const inventory = await getContentMediaRelations(db.fetch, ITEM)
    const saved = await saveContentMediaRelations(db.fetch, ITEM, {
      expectedInventoryVersion: inventory.inventory_version,
      media: inventory.media.map(m => ({ id: m.id, directus_files_id: m.directus_files_id, file_role: m.file_role, alt: m.file_role === 'hero' ? 'TEST ONLY hero alt v2' : m.alt })),
      relations: inventory.relations.map(r => ({ id: r.id, relation_kind: r.relation_kind, product_id: r.product?.id })),
    })
    expect(saved.media.find(m => m.file_role === 'hero')!.alt).toBe('TEST ONLY hero alt v2')
  })
})

// ── Publication review invalidation ─────────────────────────────────────────

describe('a publication review from before Archive / Restore is never accepted', () => {
  it('Publish with the old publication fingerprint is 409 after archive and after restore; a fresh review can publish', async () => {
    const options: PublicationOptions = { publishedLocales: ['en'], resolveType: publicRegistry() }
    const old = await reviewed('en', options)
    await archive()
    const afterArchive = await rejection(publishContentLocale(db.fetch, ITEM, 'en', old, options))
    expect(afterArchive.statusCode).toBe(409)
    expect(afterArchive.data.code).toBe('changed_since_review')
    await restore()
    const afterRestore = await rejection(publishContentLocale(db.fetch, ITEM, 'en', old, options))
    expect(afterRestore.statusCode).toBe(409)
    expect(db.row('en').published_snapshot).toBeNull()
    expect((await publishContentLocale(db.fetch, ITEM, 'en', await reviewed('en', options), options)).result).toBe('published')
  })
})

// ── Media untouched (RSG-06 NOT_TOUCHED) ────────────────────────────────────

describe('content Archive / Restore never archive or restore media', () => {
  it('writes only content_items and content_item_locales; the service has no media path', async () => {
    await publishBoth()
    await archive()
    await restore()
    expect(db.writes.every(w => w.path === '/items/content_items/6' || w.path === '/items/content_item_locales')).toBe(true)
    const source = readFileSync(join(ROOT, 'server/utils/contentLifecycle.ts'), 'utf8')
    expect(source).not.toMatch(/content_items_files|content_relations|media_file_lifecycle|\/files|is_public|DELETE/)
  })
})

// ── History ──────────────────────────────────────────────────────────────────

let nextRevision = 900
function addRevision(collection: string, item: number | string, action: string, delta: Record<string, unknown>, timestamp: string, user: unknown = ADMIN) {
  const id = nextRevision++
  db.revisions.push({
    id, collection, item: String(item), delta,
    data: { ...delta, secret: 'SECRET-DATA-VALUE' },
    activity: { id: id + 10_000, action, timestamp, user, ip: '192.168.77.77', user_agent: 'SECRET-USER-AGENT' },
  })
  return id
}

describe('change history — derived from Directus revisions, read-only', () => {
  const lookups: HistoryLookups = {
    itemId: ITEM,
    localeByRowId: new Map([['20', 'en'], ['21', 'es']]),
    fileByLinkId: new Map([['101', { role: 'hero', name: 'TEST ONLY hero' }]]),
    relationById: new Map([['5', { kind: 'product' }]]),
  }
  const map = (collection: string, item: string, action: string, delta: Record<string, unknown>, user: unknown = ADMIN) =>
    mapHistoryRevision({ id: 1, collection, item, delta, activity: { action, timestamp: NOW, user: user as never } } as HistoryRevision, lookups)

  it('maps only what a revision records', () => {
    expect(map('content_items', '6', 'create', { content_type: 'technical_article', status: 'draft' })).toMatchObject({ kind: 'created', label: 'Content created' })
    expect(map('content_items', '6', 'update', { status: 'archived', archived_at: NOW })).toMatchObject({ kind: 'archived', category: 'Lifecycle', label: 'Archived' })
    expect(map('content_items', '6', 'update', { status: 'draft', archived_at: null })).toMatchObject({ kind: 'restored', label: 'Restored to draft' })
    expect(map('content_items', '6', 'update', { status: 'published', first_published_at: NOW })).toMatchObject({ kind: 'status_changed', label: 'Content status set to Published' })
    expect(map('content_items', '6', 'update', { status: 'draft' })).toMatchObject({ kind: 'status_changed', label: 'Content status set to Draft' })
    expect(map('content_item_locales', '21', 'create', { locale: 'es', title: 'x', draft_revision: 1 })).toMatchObject({ kind: 'locale_started', locale: 'es', revision: 1 })
    expect(map('content_item_locales', '20', 'update', { title: 'x', summary: 'y', draft_revision: 5, last_change_kind: 'manual_edit' }))
      .toMatchObject({ kind: 'draft_updated', locale: 'en', changes: ['Title', 'Summary'], revision: 5 })
    expect(map('content_item_locales', '20', 'update', { seo_title: 'x', noindex: true, draft_revision: 6, last_change_kind: 'manual_edit' }))
      .toMatchObject({ kind: 'seo_updated', category: 'SEO', changes: ['SEO title', 'Search indexing'] })
    expect(map('content_item_locales', '20', 'update', { published_snapshot: {}, published_revision: 6, published_at: NOW, last_change_kind: 'publish' }))
      .toMatchObject({ kind: 'published', category: 'Publication', locale: 'en', revision: 6 })
    expect(map('content_item_locales', '21', 'update', { published_snapshot: null, last_change_kind: 'unpublish' })).toMatchObject({ kind: 'unpublished', locale: 'es' })
    expect(map('content_item_locales', '21', 'update', { published_snapshot: null, last_change_kind: 'restore' })).toMatchObject({ kind: 'restored', label: 'Publication cleared by restore' })
    expect(map('content_item_locales', '20', 'update', { title: 'x', draft_revision: 7, last_change_kind: 'ai_apply' })).toMatchObject({ kind: 'ai_applied', category: 'AI' })
    expect(map('content_items_files', '101', 'create', { file_role: 'hero', enabled: true, sort: 0 })).toMatchObject({ kind: 'media_linked', area: 'Hero image · TEST ONLY hero' })
    expect(map('content_items_files', '101', 'update', { version_label: 'v2' })).toMatchObject({ kind: 'media_updated', changes: ['Version'] })
    expect(map('content_relations', '5', 'create', { relation_kind: 'product', sort: 0 })).toMatchObject({ kind: 'relation_added', area: 'Product' })
    expect(map('content_relations', '5', 'update', { sort: 2 })).toMatchObject({ kind: 'relation_updated', changes: ['Order'] })
  })

  it('falls back to neutral labels and an unknown actor instead of guessing', () => {
    expect(map('content_item_locales', '20', 'update', { title: 'x' })).toMatchObject({ kind: 'updated', label: 'Content updated', changes: ['Title'] })
    expect(map('content_items', '6', 'revert', { anything: 1 })).toMatchObject({ kind: 'updated', changes: ['Other fields'] })
    expect(map('content_items', '6', 'create', {}, null).actor).toBe('System / Unknown')
    expect(map('content_items', '6', 'create', {}, 'a3f0-uuid-only').actor).toBe('System / Unknown')
    expect(map('content_items', '6', 'create', {}, { email: 'admin@example.com' }).actor).toBe('admin@example.com')
    expect(map('content_items', '6', 'create', {}, ADMIN).actor).toBe('TEST ONLY Admin')
  })

  it('is newest first with a stable order for equal timestamps, scoped to this item, safe and write-free', async () => {
    const created = addRevision('content_items', ITEM, 'create', { content_type: 'technical_article', status: 'draft' }, '2026-09-15T08:00:00Z')
    const tieA = addRevision('content_item_locales', 20, 'update', { title: 'SECRET-TITLE-VALUE', draft_revision: 5, last_change_kind: 'manual_edit' }, '2026-09-15T09:00:00Z')
    const tieB = addRevision('content_items_files', 101, 'update', { alt_en: 'SECRET-ALT-VALUE' }, '2026-09-15T09:00:00Z')
    const archived = addRevision('content_items', ITEM, 'update', { status: 'archived', archived_at: NOW }, '2026-09-15T10:00:00Z', null)
    addRevision('content_items', 7, 'update', { status: 'archived' }, '2026-09-15T11:00:00Z')
    addRevision('content_item_locales', 99, 'update', { title: 'other item' }, '2026-09-15T11:00:00Z')
    addRevision('content_items_files', 555, 'create', { file_role: 'hero' }, '2026-09-15T11:00:00Z')

    const history = await getContentHistory(db.fetch, ITEM, 1)
    expect(history.events.map(e => e.id)).toEqual([`rev-${archived}`, `rev-${tieB}`, `rev-${tieA}`, `rev-${created}`])
    expect(history.events.map(e => e.label)).toEqual(['Archived', 'Media details updated', 'Draft updated', 'Content created'])
    expect(history.events[0].actor).toBe('System / Unknown')
    expect(history.total).toBe(4)
    const text = JSON.stringify(history)
    for (const secret of ['SECRET-TITLE-VALUE', 'SECRET-ALT-VALUE', 'SECRET-DATA-VALUE', '192.168.77.77', 'SECRET-USER-AGENT', 'delta', 'other item']) {
      expect(text, secret).not.toContain(secret)
    }
    expect(history.limitations.join(' ')).toContain('Removed media links and relations are not listed')
    expect(db.writes).toHaveLength(0)
  })

  it('paginates 25 per page with stable pages', async () => {
    for (let i = 0; i < 30; i++) addRevision('content_item_locales', 20, 'update', { title: 't', draft_revision: i + 5, last_change_kind: 'manual_edit' }, `2026-09-15T09:${String(i).padStart(2, '0')}:00Z`)
    const first = await getContentHistory(db.fetch, ITEM, '1')
    const second = await getContentHistory(db.fetch, ITEM, 2)
    expect([first.events.length, second.events.length, first.total, first.pages]).toEqual([25, 5, 30, 2])
    expect(first.events[0].revision).toBe(34)
    expect(second.events.at(-1)!.revision).toBe(5)
    expect(new Set([...first.events, ...second.events].map(e => e.id)).size).toBe(30)
    expect((await getContentHistory(db.fetch, ITEM, 'abc')).page).toBe(1)
    expect((await getContentHistory(db.fetch, ITEM, 9)).events).toEqual([])
  })
})

// ── Default list (Blueprint §24) ────────────────────────────────────────────

describe('archived items are hidden from the default admin list, and found with the Archived filter', () => {
  it('adds status ≠ archived only when no status filter is chosen', async () => {
    const seen: string[] = []
    const spy = (async (path: string) => {
      seen.push(path)
      return { data: [], meta: { filter_count: 0 } }
    }) as unknown as FetchFn
    await listContentDrafts(spy, {})
    await listContentDrafts(spy, { status: 'archived' })
    const [defaults, archivedOnly] = seen.map(p => new URL(p, 'http://directus.local').searchParams)
    expect(defaults.get('filter[status][_neq]')).toBe('archived')
    expect(archivedOnly.get('filter[status][_eq]')).toBe('archived')
    expect(archivedOnly.get('filter[status][_neq]')).toBeNull()
  })
})

// ── Static boundaries ───────────────────────────────────────────────────────

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? (name === 'node_modules' || name.startsWith('.') ? [] : listFiles(full)) : [full]
  })
}
const rel = (file: string) => relative(ROOT, file).split('\\').join('/')

describe('static boundaries (RSG-03, RSG-04)', () => {
  const runtimeFiles = ['server', 'components', 'pages', 'utils', 'composables', 'layouts', 'plugins', 'middleware']
    .flatMap(dir => listFiles(join(ROOT, dir))).filter(f => /\.(ts|vue)$/.test(f)).map(rel)
  const text = (file: string) => readFileSync(join(ROOT, file), 'utf8')

  it('only the archive / restore routes and the history reader use the lifecycle service; only the history route uses the history reader', () => {
    expect(runtimeFiles.filter(f => text(f).includes('contentLifecycle')).sort()).toEqual([
      'server/api/admin/content-center/[id]/archive.post.ts',
      'server/api/admin/content-center/[id]/restore.post.ts',
      'server/utils/contentHistory.ts',
    ])
    expect(runtimeFiles.filter(f => /server\/utils\/contentHistory'/.test(text(f))).sort()).toEqual(['server/api/admin/content-center/[id]/history.get.ts'])
  })

  it('no AI module references Archive, Restore or the lifecycle / history services', () => {
    const aiFiles = runtimeFiles.filter(f => /(^|\/)ai[A-Z_/-]|\/ai\//.test(f) || /aiTargets\//.test(f))
    expect(aiFiles.length).toBeGreaterThan(5)
    for (const file of aiFiles) {
      expect(text(file), file).not.toMatch(/contentLifecycle|contentHistory|archiveContentItem|restoreContentItem|\/archive'|\/restore'/)
    }
  })

  it('Save and Publish paths never archive or restore, and the history route never writes', () => {
    for (const file of ['server/utils/contentDraft.ts', 'server/utils/contentSeoLocales.ts', 'server/utils/contentMediaRelations.ts', 'server/utils/contentPublication.ts']) {
      expect(text(file), file).not.toMatch(/status: 'archived'|archiveContentItem|restoreContentItem|last_change_kind: 'restore'/)
    }
    expect(text('server/utils/contentHistory.ts')).not.toMatch(/method:/)
    expect(text('server/api/admin/content-center/[id]/history.get.ts')).not.toMatch(/readJsonBody|method:/)
  })

  it('the committed registry keeps every content type non-public', () => {
    for (const def of Object.values(CONTENT_TYPES)) expect(def.publicEnabled).toBe(false)
  })

  it('only the lifecycle service writes archived_at or the restore marker — the database restore guards rely on it', () => {
    const contentServer = runtimeFiles.filter(f => f.startsWith('server/') && /content/i.test(f))
    expect(contentServer.filter(f => /archived_at: (null|now)\b/.test(text(f)))).toEqual(['server/utils/contentLifecycle.ts'])
    expect(contentServer.filter(f => /last_change_kind: 'restore'/.test(text(f)))).toEqual(['server/utils/contentLifecycle.ts'])
  })
})

// ── Review Fix 02: database lifecycle guard rejections (RSG-01, RSG-03) ─────────────────

const guardRejection = () => uniqueError('content_lifecycle')
/** Directus does not translate DELETE errors; an administrator receives the raw database message as knex formats it. */
const guardDeleteRejection = () => Object.assign(new Error('Internal'), {
  statusCode: 500,
  data: { errors: [{
    message: 'delete from "content_items_files" where "id" in ($1) - content_lifecycle_guard: content_items_files rejected for content item 6 (archived)',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  }] },
})

function rejectNextWrite(pattern: RegExp, error: unknown) {
  db.failWrite = pattern
  db.failWriteError = error
}

describe('Review Fix 02 — a write refused by the database lifecycle guard is 409 lifecycle_changed, never 500', () => {
  // In each case the BFF read the item as draft and Archive (or another Restore) committed before this
  // request's write reached PostgreSQL; the guard refused the write and nothing was stored.
  it('Editor, SEO, Start locale and Open Graph', async () => {
    rejectNextWrite(/^PATCH \/items\/content_item_locales\/20$/, guardRejection())
    const editor = await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: 'x' }))
    expect(editor).toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })
    expect(editor.data.partial).toBeUndefined()

    rejectNextWrite(/^PATCH \/items\/content_item_locales\/20$/, guardRejection())
    expect(await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', expectedDraftRevision: 4, fields: { seo_title: 'x' } }, ['en'])))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })

    rejectNextWrite(/^POST \/items\/content_item_locales$/, guardRejection())
    expect(await rejection(createLocaleDraft(db.fetch, ITEM, { locale: 'pt', title: 'TEST ONLY PT', slug: 'test-only-pt' })))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })

    const ogVersion = (await getContentSeoLocales(db.fetch, ITEM, ['en'])).og_version
    rejectNextWrite(/^POST \/items\/content_items_files$/, guardRejection())
    expect(await rejection(saveContentSeoLocales(db.fetch, ITEM, { locale: 'en', og_image: { directus_files_id: HERO, expectedOgVersion: ogVersion } }, ['en'])))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })

    rejectNextWrite(/^POST \/items\/content_items_files$/, guardRejection())
    expect(await rejection(saveContentSeoLocales(db.fetch, ITEM, {
      locale: 'en', expectedDraftRevision: 4, fields: { seo_title: 'TEST ONLY SEO' }, og_image: { directus_files_id: HERO, expectedOgVersion: ogVersion },
    }, ['en']))).toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed', partial: true, completedSteps: 1, totalSteps: 2 } })
  })

  it('Media & Relations: a refused DELETE (untranslated by Directus) is 409; after a saved step it is 409 partial', async () => {
    const inventory = await getContentMediaRelations(db.fetch, ITEM)
    const body = (heroAlt: string) => ({
      expectedInventoryVersion: inventory.inventory_version,
      media: inventory.media.filter(m => m.file_role !== 'download')
        .map(m => ({ id: m.id, directus_files_id: m.directus_files_id, file_role: m.file_role, alt: m.file_role === 'hero' ? heroAlt : m.alt })),
      relations: inventory.relations.map(r => ({ id: r.id, relation_kind: r.relation_kind, product_id: r.product?.id })),
    })
    rejectNextWrite(/^DELETE \/items\/content_items_files$/, guardDeleteRejection())
    const first = await rejection(saveContentMediaRelations(db.fetch, ITEM, body('TEST ONLY hero alt')))
    expect(first).toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })
    expect(first.data.partial).toBeUndefined()

    rejectNextWrite(/^DELETE \/items\/content_items_files$/, guardDeleteRejection())
    expect(await rejection(saveContentMediaRelations(db.fetch, ITEM, body('TEST ONLY hero alt v2'))))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed', partial: true, completedSteps: 1, totalSteps: 2 } })
  })

  it('Publish: snapshot step saved, item step refused (Archive won) → 409 partial, not 500', async () => {
    const options: PublicationOptions = { publishedLocales: ['en'], resolveType: publicRegistry() }
    const review = await reviewed('en', options)
    rejectNextWrite(new RegExp(`^PATCH /items/content_items/${ITEM}$`), guardRejection())
    expect(await rejection(publishContentLocale(db.fetch, ITEM, 'en', review, { ...options, now: () => NOW })))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed', partial: true, completedSteps: 1, totalSteps: 2 } })
    expect(db.item.status).toBe('draft')
  })

  it('duplicate Archive and duplicate Restore refused by the guard are 409 lifecycle_changed, not 500 partial', async () => {
    rejectNextWrite(new RegExp(`^PATCH /items/content_items/${ITEM}$`), guardRejection())
    const duplicateArchive = await rejection(archive())
    expect(duplicateArchive).toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed' } })
    expect(duplicateArchive.data.partial).toBeUndefined()

    await archive()
    rejectNextWrite(new RegExp(`^PATCH /items/content_items/${ITEM}$`), guardRejection())
    expect(await rejection(restore()))
      .toMatchObject({ statusCode: 409, data: { code: 'lifecycle_changed', partial: true, completedSteps: 1, totalSteps: 2 } })
    expect(db.item.status).toBe('archived')
  })

  it('only the guard marker maps to lifecycle_changed; revision, slug and unexpected errors keep their meaning', async () => {
    expect(isLifecycleGuardRejection(guardRejection())).toBe(true)
    expect(isLifecycleGuardRejection(guardDeleteRejection())).toBe(true)
    expect(isLifecycleGuardRejection(uniqueError('draft_revision'))).toBe(false)
    expect(isLifecycleGuardRejection(uniqueError('locale, slug'))).toBe(false)
    expect(isLifecycleGuardRejection({ data: { errors: [{ message: 'An unexpected error occurred.', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] } })).toBe(false)
    expect(isLifecycleGuardRejection({ data: { errors: [{ message: 'content_lifecycle_guard: x', extensions: { code: 'FORBIDDEN' } }] } })).toBe(false)

    rejectNextWrite(/^PATCH \/items\/content_item_locales\/20$/, uniqueError('draft_revision'))
    expect(await rejection(updateLocaleDraft(db.fetch, ITEM, 'en', { expectedDraftRevision: 4, title: 'x' })))
      .toMatchObject({ statusCode: 409, data: { currentDraftRevision: 4 } })

    await archive()
    db.failWrite = new RegExp(`^PATCH /items/content_items/${ITEM}$`)
    expect(await rejection(restore())).toMatchObject({ statusCode: 500, data: { partial: true, retryable: true } })
  })
})

// ── Admin middleware (RSG-07) ───────────────────────────────────────────────

function mockEvent(url: string, method: string, opts: { cookies?: Record<string, string>, headers?: Record<string, string> } = {}) {
  const cookie = Object.entries(opts.cookies ?? {}).map(([k, v]) => `${k}=${v}`).join('; ')
  const req = Object.assign(new Readable({ read() { this.push(null) } }), {
    url, method, headers: { host: 'localhost:3000', ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
  })
  return {
    path: url,
    method,
    node: { req, res: { setHeader: () => {}, getHeader: () => undefined, end: () => {}, writableEnded: false, statusCode: 200 } },
    context: { params: {} } as Record<string, unknown>,
  } as unknown as Parameters<typeof import('h3').getRequestURL>[0]
}

async function statusOf(run: () => Promise<unknown>): Promise<number | 'passed'> {
  try {
    await run()
    return 'passed'
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1
  }
}

describe('admin-auth middleware on the lifecycle and history routes', () => {
  const ARCHIVE = '/api/admin/content-center/6/archive'
  const RESTORE = '/api/admin/content-center/6/restore'
  const HISTORY = '/api/admin/content-center/6/history?page=1'

  function install(role: string | null) {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useRuntimeConfig', () => ({ directusUrl: 'http://directus.test' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.includes('/users/me') && role) return { data: { id: 'admin-1', role: { name: role } } }
      throw Object.assign(new Error('unauthorized'), { statusCode: 401 })
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('unauthenticated → 401; non-administrator → 403; missing or foreign Origin → 403; administrator with Origin passes', async () => {
    install(null)
    const middleware = (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>
    for (const [url, method] of [[ARCHIVE, 'POST'], [RESTORE, 'POST'], [HISTORY, 'GET']]) {
      expect(await statusOf(() => middleware(mockEvent(url, method)))).toBe(401)
    }
    install('Editor')
    for (const url of [ARCHIVE, RESTORE]) {
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 't' }, headers: { origin: 'http://localhost:3000' } })))).toBe(403)
    }
    install('Administrator')
    for (const url of [ARCHIVE, RESTORE]) {
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 't' } })))).toBe(403)
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 't' }, headers: { origin: 'https://evil.example' } })))).toBe(403)
      expect(await statusOf(() => middleware(mockEvent(url, 'POST', { cookies: { admin_at: 't' }, headers: { origin: 'http://localhost:3000' } })))).toBe('passed')
    }
  })
})
