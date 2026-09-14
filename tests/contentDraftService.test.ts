/**
 * CC-IMP-01 — Content Center Draft Foundation service.
 *
 * Runs the real service against an in-memory Directus double that enforces the
 * same unique constraints as directus/schema/cc-imp-01-constraints.sql and
 * creates nested locales atomically. Covers create/get/list, locale creation,
 * optimistic draft revisions, slug rules (sequential, concurrent, cross-locale,
 * cross-type), mass assignment and cross-parent (IDOR) protection.
 * Real-database constraint and revision behaviour is verified separately
 * against the local Directus (recorded in CURRENT-STATE).
 */

import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createContentDraft,
  createLocaleDraft,
  getContentDraft,
  listContentDrafts,
  uniqueViolationField,
  updateLocaleDraft,
  validateContentSlug,
} from '../server/utils/contentDraft'
import type { FetchFn } from '../server/utils/mediaLifecycle'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION'

type Row = Record<string, unknown> & { id: number }

function uniqueError(field: string) {
  return Object.assign(new Error(`Value for field "${field}" has to be unique.`), {
    statusCode: 400,
    data: { errors: [{ message: 'unique', extensions: { code: 'RECORD_NOT_UNIQUE', field } }] },
  })
}

class FakeDirectus {
  items = new Map<number, Row>()
  locales = new Map<number, Row>()
  files = new Map<number, Row>()
  writes: Array<{ method: string, path: string }> = []
  /** Simulates a pre-check that read before a concurrent request committed. */
  staleSlugReads = false
  /** When set, locale reads return this earlier copy (both concurrent requests read revision N). */
  frozenLocales: Map<number, Row> | null = null
  /** When set, the next PATCH fails with this error (e.g. an unrelated Directus 500). */
  failNextPatchWith: unknown = null

  freezeLocaleReads(): void {
    this.frozenLocales = new Map([...this.locales].map(([id, row]) => [id, structuredClone(row)]))
  }

  /** Mirrors directus/schema/cc-imp-01-fix-01-revision-guard.sql. */
  private assertRevisionGuard(oldRow: Row, newRow: Row): void {
    const draftFields = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex']
    const changed = draftFields.some(f => JSON.stringify(oldRow[f] ?? null) !== JSON.stringify(newRow[f] ?? null))
    const oldRev = Number(oldRow.draft_revision)
    const newRev = Number(newRow.draft_revision)
    if ((newRev !== oldRev && newRev !== oldRev + 1) || (changed && newRev !== oldRev + 1)) {
      throw uniqueError('draft_revision')
    }
  }
  private nextItem = 1
  private nextLocale = 1

  fetch: FetchFn = (async (path: string, options: Record<string, unknown> = {}) => {
    const method = String(options.method ?? 'GET')
    const url = new URL(path, 'http://directus.local')
    const q = (key: string) => url.searchParams.get(key)
    const body = (options.body ?? {}) as Record<string, unknown>
    if (method !== 'GET') this.writes.push({ method, path: url.pathname })

    if (url.pathname === '/items/content_items' && method === 'POST') {
      const locales = (body.locales as Row[] | undefined) ?? []
      const itemId = this.nextItem
      const staged = locales.map(l => ({ ...l, content_items_id: itemId }))
      staged.forEach((row, i) => this.assertLocaleUnique(row, undefined, staged.slice(0, i)))
      this.items.set(itemId, {
        id: itemId, content_type: body.content_type, status: body.status,
        first_published_at: null, archived_at: null, date_created: new Date(Date.UTC(2026, 8, 14, 0, itemId)).toISOString(), date_updated: null,
      })
      this.nextItem++
      for (const row of staged) this.insertLocale(row)
      return { data: { id: itemId } }
    }

    if (url.pathname === '/items/content_items' && method === 'GET') {
      let rows = [...this.items.values()]
      if (q('filter[id][_eq]')) rows = rows.filter(r => r.id === Number(q('filter[id][_eq]')))
      if (q('filter[content_type][_eq]')) rows = rows.filter(r => r.content_type === q('filter[content_type][_eq]'))
      if (q('filter[status][_eq]')) rows = rows.filter(r => r.status === q('filter[status][_eq]'))
      rows.sort((a, b) => String(b.date_created).localeCompare(String(a.date_created)))
      const limit = Number(q('limit') ?? 100)
      const page = Number(q('page') ?? 1)
      const data = rows.slice((page - 1) * limit, page * limit).map(r => ({
        ...r,
        locales: [...this.locales.values()].filter(l => l.content_items_id === r.id),
      }))
      return { data, meta: { filter_count: rows.length } }
    }

    if (url.pathname === '/items/content_item_locales' && method === 'GET') {
      let rows = [...(this.frozenLocales ?? this.locales).values()]
      if (q('filter[content_items_id][_eq]')) rows = rows.filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
      if (q('filter[locale][_eq]')) rows = rows.filter(r => r.locale === q('filter[locale][_eq]'))
      if (q('filter[slug][_eq]')) {
        if (this.staleSlugReads) return { data: [] }
        rows = rows.filter(r => r.slug === q('filter[slug][_eq]'))
      }
      return { data: rows.map(r => ({ ...r })) }
    }

    if (url.pathname === '/items/content_item_locales' && method === 'POST') {
      const row = { ...body } as Row
      this.assertLocaleUnique(row)
      const id = this.insertLocale(row)
      return { data: { id } }
    }

    const patchMatch = url.pathname.match(/^\/items\/content_item_locales\/(\d+)$/)
    if (patchMatch && method === 'PATCH') {
      const id = Number(patchMatch[1])
      const existing = this.locales.get(id)
      if (!existing) throw Object.assign(new Error('forbidden'), { statusCode: 403 })
      if (this.failNextPatchWith) {
        const error = this.failNextPatchWith
        this.failNextPatchWith = null
        throw error
      }
      const next = { ...existing, ...body, id }
      this.assertRevisionGuard(existing, next)
      this.assertLocaleUnique(next, id)
      this.locales.set(id, next)
      return { data: { id } }
    }

    if (url.pathname === '/items/content_items_files' && method === 'GET') {
      let rows = [...this.files.values()]
      if (q('filter[id][_in]')) {
        const ids = String(q('filter[id][_in]')).split(',').map(Number)
        rows = rows.filter(r => ids.includes(r.id))
      }
      if (q('filter[content_items_id][_eq]')) rows = rows.filter(r => r.content_items_id === Number(q('filter[content_items_id][_eq]')))
      if (q('filter[file_role][_eq]')) rows = rows.filter(r => r.file_role === q('filter[file_role][_eq]'))
      return { data: rows }
    }

    throw new Error(`unexpected Directus call: ${method} ${path}`)
  }) as unknown as FetchFn

  private insertLocale(row: Row | Record<string, unknown>): number {
    const id = this.nextLocale++
    this.locales.set(id, {
      seo_title: null, seo_description: null, canonical_path: null,
      published_snapshot: null, published_revision: null, published_at: null, first_published_at: null,
      ...row, id,
    })
    return id
  }

  private assertLocaleUnique(row: Record<string, unknown>, ownId?: number, extra: Record<string, unknown>[] = []): void {
    for (const other of [...this.locales.values(), ...extra]) {
      if (ownId !== undefined && other.id === ownId) continue
      if (other.content_items_id === row.content_items_id && other.locale === row.locale) throw uniqueError('content_items_id, locale')
      if (other.locale === row.locale && other.slug === row.slug) throw uniqueError('locale, slug')
    }
  }
}

let db: FakeDirectus

beforeEach(() => {
  db = new FakeDirectus()
})

const create = (overrides: Record<string, unknown> = {}) =>
  createContentDraft(db.fetch, { content_type: 'technical_article', title: TEST_TITLE, slug: `test-only-${randomUUID().slice(0, 8)}`, ...overrides })

async function expectStatus(promise: Promise<unknown>, statusCode: number) {
  await expect(promise).rejects.toMatchObject({ statusCode })
}

describe('create and read drafts', () => {
  it('creates a draft item with its default-locale draft in one request', async () => {
    const draft = await create({ slug: 'test-only-first', summary: 'Summary' })
    expect(draft.status).toBe('draft')
    expect(draft.content_type).toBe('technical_article')
    expect(draft.locales).toHaveLength(1)
    const en = draft.locales[0]
    expect(en).toMatchObject({ locale: 'en', title: TEST_TITLE, slug: 'test-only-first', summary: 'Summary', draft_revision: 1, last_change_kind: 'manual_edit', noindex: false, published_revision: null, published_at: null, first_published_at: null })
    expect(en.blocks.map(b => b.type)).toEqual(['text', 'key_points', 'faq', 'cta', 'related_content'])
    expect(db.writes).toEqual([{ method: 'POST', path: '/items/content_items' }])
  })

  it('never exposes published_snapshot through the admin read', async () => {
    const draft = await create()
    expect(Object.keys(draft.locales[0])).not.toContain('published_snapshot')
  })

  it('rejects an unknown content type', async () => {
    await expectStatus(create({ content_type: 'insight' }), 422)
    await expectStatus(create({ content_type: undefined }), 422)
    expect(db.items.size).toBe(0)
  })

  it('requires a title', async () => {
    await expectStatus(create({ title: '   ' }), 422)
  })

  it('rejects a non-object body', async () => {
    await expectStatus(createContentDraft(db.fetch, [1, 2]), 400)
    await expectStatus(createContentDraft(db.fetch, null), 400)
  })

  it('returns 404 for a missing item', async () => {
    await expectStatus(getContentDraft(db.fetch, 999), 404)
  })

  it('lists items with filters and a bounded limit', async () => {
    await create({ content_type: 'news' })
    await create({ content_type: 'case_study' })
    const all = await listContentDrafts(db.fetch, { limit: '500' })
    expect(all.limit).toBe(100)
    expect(all.total).toBe(2)
    const news = await listContentDrafts(db.fetch, { content_type: 'news' })
    expect(news.data.map(i => i.content_type)).toEqual(['news'])
    await expectStatus(listContentDrafts(db.fetch, { content_type: 'blog' }), 422)
    await expectStatus(listContentDrafts(db.fetch, { status: 'live' }), 422)
  })
})

describe('locale drafts', () => {
  it('creates a non-default locale from the default block structure', async () => {
    const draft = await create()
    const withEs = await createLocaleDraft(db.fetch, draft.id, { locale: 'es', title: TEST_TITLE, slug: 'test-only-es' })
    const en = withEs.locales.find(l => l.locale === 'en')!
    const es = withEs.locales.find(l => l.locale === 'es')!
    expect(es.draft_revision).toBe(1)
    expect(es.blocks.map(b => [b.id, b.type])).toEqual(en.blocks.map(b => [b.id, b.type]))
  })

  it('rejects the default locale, unknown locales and a second draft for the same locale', async () => {
    const draft = await create()
    await expectStatus(createLocaleDraft(db.fetch, draft.id, { locale: 'en', title: TEST_TITLE, slug: 'x-en' }), 422)
    await expectStatus(createLocaleDraft(db.fetch, draft.id, { locale: 'zh', title: TEST_TITLE, slug: 'x-zh' }), 422)
    await createLocaleDraft(db.fetch, draft.id, { locale: 'pt', title: TEST_TITLE, slug: 'x-pt' })
    await expectStatus(createLocaleDraft(db.fetch, draft.id, { locale: 'pt', title: TEST_TITLE, slug: 'x-pt-2' }), 409)
  })

  it('refuses to edit an archived item', async () => {
    const draft = await create()
    db.items.get(draft.id)!.status = 'archived'
    await expectStatus(createLocaleDraft(db.fetch, draft.id, { locale: 'es', title: TEST_TITLE, slug: 'x-es' }), 409)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'New' }), 409)
  })
})

describe('draft revision guard', () => {
  it('increments the revision on every successful save', async () => {
    const draft = await create()
    const first = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: `${TEST_TITLE} v2` })
    expect(first.locales[0]).toMatchObject({ draft_revision: 2, title: `${TEST_TITLE} v2`, last_change_kind: 'manual_edit' })
    const second = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 2, summary: 'Updated summary' })
    expect(second.locales[0].draft_revision).toBe(3)
  })

  it('rejects a stale expectedDraftRevision with 409 and writes nothing', async () => {
    const draft = await create()
    await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'Saved by A' })
    const writesBefore = db.writes.length
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'Saved by B' }), 409)
    expect(db.writes.length).toBe(writesBefore)
    const current = await getContentDraft(db.fetch, draft.id)
    expect(current.locales[0]).toMatchObject({ title: 'Saved by A', draft_revision: 2 })
  })

  it('requires expectedDraftRevision and at least one field', async () => {
    const draft = await create()
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { title: 'x' }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 0, title: 'x' }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1 }), 400)
  })

  it('validates blocks against the content type and saves valid blocks', async () => {
    const draft = await create({ content_type: 'news' })
    const text = { id: randomUUID(), type: 'text', data: { paragraphs: ['Body'] } }
    const faq = { id: randomUUID(), type: 'faq', data: { items: [{ question: 'q', answer: 'a' }] } }
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, blocks: [text, faq] }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, blocks: [{ ...text, data: { html: '<p>x</p>' } }] }), 422)
    const saved = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, blocks: [text] })
    expect(saved.locales[0].blocks).toEqual([text])
  })

  it('validates SEO, canonical and noindex values', async () => {
    const draft = await create()
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, canonical_path: 'https://evil.example/x' }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, noindex: 'yes' }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, seo_title: 't'.repeat(121) }), 422)
    const saved = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, canonical_path: '/resources/x', noindex: true, seo_title: 'SEO' })
    expect(saved.locales[0]).toMatchObject({ canonical_path: '/resources/x', noindex: true, seo_title: 'SEO' })
  })
})

describe('slug rules', () => {
  it('validates format, length and reserved words', () => {
    expect(validateContentSlug('test-only-slug-1').ok).toBe(true)
    for (const bad of ['Upper', 'has space', '-leading', 'trailing-', 'double--hyphen', 'under_score', '', 'a'.repeat(101), 'ümlaut']) {
      expect(validateContentSlug(bad).ok).toBe(false)
    }
    for (const reserved of ['new', 'index', 'preview', 'draft', 'edit', 'admin', 'api', 'search', 'page', 'all']) {
      expect(validateContentSlug(reserved).ok).toBe(false)
    }
    expect(validateContentSlug('a'.repeat(100)).ok).toBe(true)
  })

  it('rejects an invalid or reserved slug with 422', async () => {
    await expectStatus(create({ slug: 'Bad Slug' }), 422)
    await expectStatus(create({ slug: 'preview' }), 422)
  })

  it('sequential duplicate in the same locale → 409', async () => {
    await create({ slug: 'test-only-dup' })
    await expectStatus(create({ slug: 'test-only-dup' }), 409)
    expect(db.items.size).toBe(1)
  })

  it('a different content type does not bypass the locale + slug uniqueness', async () => {
    await create({ slug: 'test-only-cross-type', content_type: 'technical_article' })
    await expectStatus(create({ slug: 'test-only-cross-type', content_type: 'case_study' }), 409)
  })

  it('the same slug in a different locale is allowed', async () => {
    await create({ slug: 'test-only-shared' })
    const other = await create({ slug: 'test-only-other' })
    const withEs = await createLocaleDraft(db.fetch, other.id, { locale: 'es', title: TEST_TITLE, slug: 'test-only-shared' })
    expect(withEs.locales.find(l => l.locale === 'es')?.slug).toBe('test-only-shared')
  })

  it('concurrent duplicate creates → exactly one succeeds; the database constraint maps to 409', async () => {
    db.staleSlugReads = true
    const results = await Promise.allSettled([
      create({ slug: 'test-only-race' }),
      create({ slug: 'test-only-race' }),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 })
    expect(db.items.size).toBe(1)
    expect([...db.locales.values()].filter(l => l.slug === 'test-only-race')).toHaveLength(1)
  })

  it('renaming to a slug already used in the locale → 409; keeping the own slug is fine', async () => {
    await create({ slug: 'test-only-taken' })
    const draft = await create({ slug: 'test-only-mine' })
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, slug: 'test-only-taken' }), 409)
    const kept = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, slug: 'test-only-mine', title: 'Same slug' })
    expect(kept.locales[0].slug).toBe('test-only-mine')
  })

  it('reads the unique-violation field from a Directus error', () => {
    expect(uniqueViolationField(uniqueError('locale, slug'))).toBe('locale, slug')
    expect(uniqueViolationField(new Error('other'))).toBeNull()
  })
})

describe('mass assignment protection', () => {
  const FORBIDDEN_ON_CREATE = {
    status: 'published', archived_at: '2026-01-01T00:00:00Z', published_snapshot: { title: 'x' }, published_revision: 1,
    published_at: '2026-01-01T00:00:00Z', first_published_at: '2026-01-01T00:00:00Z', draft_revision: 9, last_change_kind: 'publish',
    id: 77, date_created: '2020-01-01T00:00:00Z', user_created: randomUUID(), locales: [], locale: 'es', blocks: [],
  }

  it.each(Object.entries(FORBIDDEN_ON_CREATE))('create rejects %s with 422 and creates nothing', async (key, value) => {
    await expectStatus(create({ [key]: value }), 422)
    expect(db.items.size).toBe(0)
  })

  const FORBIDDEN_ON_UPDATE = {
    status: 'published', archived_at: '2026-01-01T00:00:00Z', published_snapshot: { title: 'x' }, published_revision: 1,
    published_at: '2026-01-01T00:00:00Z', first_published_at: '2026-01-01T00:00:00Z', draft_revision: 9, last_change_kind: 'publish',
    content_type: 'news', content_items_id: 2, locale: 'es', id: 5,
    date_created: '2020-01-01T00:00:00Z', date_updated: '2020-01-01T00:00:00Z', user_created: randomUUID(), user_updated: randomUUID(),
  }

  it.each(Object.entries(FORBIDDEN_ON_UPDATE))('update rejects %s with 422 and writes nothing', async (key, value) => {
    const draft = await create()
    const writesBefore = db.writes.length
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'x', [key]: value }), 422)
    expect(db.writes.length).toBe(writesBefore)
    const current = await getContentDraft(db.fetch, draft.id)
    expect(current.content_type).toBe('technical_article')
    expect(current.status).toBe('draft')
    expect(current.locales[0].draft_revision).toBe(1)
  })

  it('locale creation rejects publication fields', async () => {
    const draft = await create()
    await expectStatus(createLocaleDraft(db.fetch, draft.id, { locale: 'es', title: TEST_TITLE, slug: 'x-es', published_snapshot: {} }), 422)
  })
})

describe('cross-parent (IDOR) protection', () => {
  it('a route for item A can never write a locale row of item B', async () => {
    const a = await create({ slug: 'test-only-a' })
    const b = await create({ slug: 'test-only-b' })
    await createLocaleDraft(db.fetch, b.id, { locale: 'es', title: TEST_TITLE, slug: 'test-only-b-es' })
    const bEsBefore = { ...[...db.locales.values()].find(l => l.content_items_id === b.id && l.locale === 'es') }

    // A has no es draft: the row of B is not addressable through A's route.
    await expectStatus(updateLocaleDraft(db.fetch, a.id, 'es', { expectedDraftRevision: 1, title: 'hijack' }), 404)
    // Re-parenting through the body is refused.
    await expectStatus(updateLocaleDraft(db.fetch, a.id, 'en', { expectedDraftRevision: 1, content_items_id: b.id }), 422)

    const bEsAfter = [...db.locales.values()].find(l => l.content_items_id === b.id && l.locale === 'es')
    expect(bEsAfter).toEqual(bEsBefore)

    // A valid save through A's route patches only A's own row.
    await updateLocaleDraft(db.fetch, a.id, 'en', { expectedDraftRevision: 1, title: 'A only' })
    const aEnRowId = [...db.locales.values()].find(l => l.content_items_id === a.id && l.locale === 'en')!.id
    expect(db.writes.at(-1)).toEqual({ method: 'PATCH', path: `/items/content_item_locales/${aEnRowId}` })
    expect((await getContentDraft(db.fetch, a.id)).locales.every(l => l.content_items_id === a.id)).toBe(true)
  })

  it('image blocks may only reference inline file links of the same item', async () => {
    const a = await create({ content_type: 'news', slug: 'test-only-img-a' })
    const b = await create({ content_type: 'news', slug: 'test-only-img-b' })
    db.files.set(1, { id: 1, content_items_id: b.id, file_role: 'inline' })
    db.files.set(2, { id: 2, content_items_id: a.id, file_role: 'inline' })
    db.files.set(3, { id: 3, content_items_id: a.id, file_role: 'source_document' })
    const image = (fileLinkId: number) => ({ id: randomUUID(), type: 'image', data: { fileLinkId } })

    await expectStatus(updateLocaleDraft(db.fetch, a.id, 'en', { expectedDraftRevision: 1, blocks: [image(1)] }), 422)
    await expectStatus(updateLocaleDraft(db.fetch, a.id, 'en', { expectedDraftRevision: 1, blocks: [image(3)] }), 422)
    const saved = await updateLocaleDraft(db.fetch, a.id, 'en', { expectedDraftRevision: 1, blocks: [image(2)] })
    expect(saved.locales[0].blocks[0].data).toEqual({ fileLinkId: 2 })
  })
})

describe('database revision guard mapping (CC-IMP-01-FIX-01-R1)', () => {
  it('two concurrent saves that both pass the pre-check → exactly one succeeds, one 409, no mixed fields', async () => {
    const draft = await create()
    db.freezeLocaleReads() // both requests read revision 1 before either writes
    const results = await Promise.allSettled([
      updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'Concurrent A', summary: 'Summary A' }),
      updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'Concurrent B', summary: 'Summary B' }),
    ])
    db.frozenLocales = null

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 })
    expect(String(rejected[0].reason.message)).toContain('changed since it was loaded')

    const final = (await getContentDraft(db.fetch, draft.id)).locales[0]
    expect(final.draft_revision).toBe(2)
    const winner = final.title === 'Concurrent A' ? 'A' : 'B'
    expect(final).toMatchObject({ title: `Concurrent ${winner}`, summary: `Summary ${winner}` })
  })

  it('maps only the draft_revision guard to 409; an unrelated Directus 500 keeps its status', async () => {
    const draft = await create()
    db.failNextPatchWith = Object.assign(new Error('boom'), {
      statusCode: 500,
      data: { errors: [{ message: 'An unexpected error occurred.', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] },
    })
    await expectStatus(updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'x' }), 500)
    expect((await getContentDraft(db.fetch, draft.id)).locales[0].draft_revision).toBe(1)
  })

  it('a draft_revision guard error is never reported as a duplicate locale', async () => {
    const draft = await create()
    db.failNextPatchWith = uniqueError('draft_revision')
    const error = await updateLocaleDraft(db.fetch, draft.id, 'en', { expectedDraftRevision: 1, title: 'x' }).catch(e => e)
    expect(error).toMatchObject({ statusCode: 409 })
    expect(String(error.message)).toContain('changed since it was loaded')
  })
})
