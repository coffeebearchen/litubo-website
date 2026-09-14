/**
 * CC-IMP-04 — Content Center Media & Relations BFF, reference protection and page helpers.
 *
 * The real service runs against an in-memory Directus double that enforces the
 * junction unique indexes (directus/schema/cc-imp-01-constraints.sql) and records
 * every write, so "nothing was written" is checked, not assumed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getContentMediaRelations, saveContentMediaRelations } from '../server/utils/contentMediaRelations'
import { getFileReferences, type FetchFn } from '../server/utils/mediaLifecycle'
import { isImageMimeType, isIsoDate } from '../utils/contentMediaRelations'
import {
  buildMediaRelationsSaveBody,
  interpretMediaRelationsSaveError,
  isMediaRelationsDirty,
  mediaRelationsStateFrom,
  moveMediaWithinRole,
  cloneMediaRelationsState,
  saveBodyLabels,
  stagedMediaFromFile,
} from '../utils/contentMediaRelationsEditor'
import type { AdminContentMediaRelations } from '../types/content-center'

type Row = Record<string, unknown> & { id: number }

const ITEM = 6
const IMG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PDF = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ARCHIVED_IMG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OG = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const SRC = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function uniqueError(field: string) {
  return Object.assign(new Error('unique'), { statusCode: 400, data: { errors: [{ extensions: { code: 'RECORD_NOT_UNIQUE', field } }] } })
}

class FakeDirectus {
  item = {
    id: ITEM, content_type: 'technical_article', status: 'draft',
    locales: [
      { locale: 'en', title: 'TEST ONLY — NOT FOR PUBLICATION Media', blocks: [] as unknown[] },
      { locale: 'es', title: 'ES draft', blocks: [] as unknown[] },
    ],
  }

  files = new Map<string, { id: string, type: string, filename_download: string, is_public: boolean }>([
    [IMG_A, { id: IMG_A, type: 'image/png', filename_download: 'a.png', is_public: false }],
    [IMG_B, { id: IMG_B, type: 'image/jpeg', filename_download: 'b.jpg', is_public: true }],
    [PDF, { id: PDF, type: 'application/pdf', filename_download: 'guide.pdf', is_public: false }],
    [ARCHIVED_IMG, { id: ARCHIVED_IMG, type: 'image/png', filename_download: 'old.png', is_public: false }],
    [OG, { id: OG, type: 'image/png', filename_download: 'og.png', is_public: false }],
    [SRC, { id: SRC, type: 'text/plain', filename_download: 'notes.txt', is_public: false }],
  ])

  archived = new Set([ARCHIVED_IMG])
  links = new Map<number, Row>()
  relations = new Map<number, Row>()
  products = new Map<number, Row>([[3, { id: 3, name_en: '[TEST ONLY] LT-180C', product_code: null, status: 'draft' }]])
  contents = new Map<number, Row>([
    [2, { id: 2, content_type: 'resource_download', status: 'draft', locales: [{ locale: 'en', title: 'TEST ONLY resource' }] }],
    [9, { id: 9, content_type: 'news', status: 'archived', locales: [{ locale: 'en', title: 'Archived news' }] }],
  ])

  writes: Array<{ method: string, path: string, body: unknown }> = []
  failOnWrite: number | null = null
  private nextLink = 100
  private nextRelation = 200

  addLink(values: Partial<Row>): Row {
    const row = {
      id: this.nextLink++, content_items_id: ITEM, alt_en: null, alt_es: null, alt_pt: null, caption_en: null, caption_es: null, caption_pt: null,
      language: null, version_label: null, file_date: null, enabled: true, sort: 0, ...values,
    } as Row
    this.links.set(row.id, row)
    return row
  }

  addRelation(values: Partial<Row>): Row {
    const row = { id: this.nextRelation++, content_items_id: ITEM, product_id: null, related_content_id: null, sort: 0, ...values } as Row
    this.relations.set(row.id, row)
    return row
  }

  fetch: FetchFn = (async (path: string, options: Record<string, unknown> = {}) => {
    const method = String(options.method ?? 'GET')
    const url = new URL(path, 'http://directus.local')
    const q = (key: string) => url.searchParams.get(key)
    const ids = (key: string) => String(q(key) ?? '').split(',').filter(Boolean)
    if (method !== 'GET') {
      this.writes.push({ method, path: url.pathname, body: clone(options.body) })
      if (this.failOnWrite === this.writes.length) throw Object.assign(new Error('Directus unavailable'), { statusCode: 503 })
    }

    if (url.pathname === '/items/content_items' && method === 'GET') {
      if (q('filter[id][_eq]')) return { data: Number(q('filter[id][_eq]')) === this.item.id ? [clone(this.item)] : [] }
      const wanted = ids('filter[id][_in]').map(Number)
      const all = [{ id: this.item.id, status: this.item.status }, ...[...this.contents.values()].map(c => ({ id: c.id, status: c.status }))]
      return { data: all.filter(c => wanted.includes(c.id)) }
    }
    if (url.pathname === '/items/content_items_files' && method === 'GET') {
      const itemId = Number(q('filter[content_items_id][_eq]'))
      return {
        data: [...this.links.values()].filter(r => r.content_items_id === itemId)
          .sort((a, b) => Number(a.sort) - Number(b.sort) || a.id - b.id)
          .map(r => ({ ...clone(r), directus_files_id: clone(this.files.get(String(r.directus_files_id))) })),
      }
    }
    if (url.pathname === '/items/content_relations' && method === 'GET') {
      const itemId = Number(q('filter[content_items_id][_eq]'))
      return {
        data: [...this.relations.values()].filter(r => r.content_items_id === itemId).map(r => ({
          ...clone(r),
          product_id: r.product_id ? clone(this.products.get(Number(r.product_id))) : null,
          related_content_id: r.related_content_id ? clone(this.contents.get(Number(r.related_content_id))) : null,
        })),
      }
    }
    if (url.pathname === '/items/media_file_lifecycle' && method === 'GET') {
      return { data: ids('filter[file_id][_in]').filter(id => this.archived.has(id)).map(file_id => ({ file_id })) }
    }
    if (url.pathname === '/files' && method === 'GET') {
      return { data: ids('filter[id][_in]').filter(id => this.files.has(id)).map(id => ({ id, type: this.files.get(id)!.type })) }
    }
    if (url.pathname === '/items/products' && method === 'GET') {
      return { data: ids('filter[id][_in]').map(Number).filter(id => this.products.has(id)).map(id => ({ id })) }
    }

    const body = options.body as Row[] | number[]
    if (url.pathname === '/items/content_items_files') {
      if (method === 'POST') {
        for (const row of body as Row[]) {
          const clash = [...this.links.values()].some(l => l.content_items_id === row.content_items_id && l.directus_files_id === row.directus_files_id && l.file_role === row.file_role)
          if (clash) throw uniqueError('content_items_id, directus_files_id, file_role')
          this.addLink(row)
        }
        return { data: [] }
      }
      if (method === 'PATCH') { for (const row of body as Row[]) this.links.set(row.id, { ...this.links.get(row.id)!, ...row }); return { data: [] } }
      if (method === 'DELETE') { for (const id of body as number[]) this.links.delete(id); return {} }
    }
    if (url.pathname === '/items/content_relations') {
      if (method === 'POST') {
        for (const row of body as Row[]) this.addRelation(row)
        return { data: [] }
      }
      if (method === 'PATCH') { for (const row of body as Row[]) this.relations.set(row.id, { ...this.relations.get(row.id)!, ...row }); return { data: [] } }
      if (method === 'DELETE') { for (const id of body as number[]) this.relations.delete(id); return {} }
    }
    throw new Error(`unexpected Directus call: ${method} ${path}`)
  }) as unknown as FetchFn
}

let db: FakeDirectus

beforeEach(() => {
  db = new FakeDirectus()
})

async function expectRejected(promise: Promise<unknown>, statusCode: number, text?: RegExp) {
  const err = await promise.then(() => null, e => e) as { statusCode?: number, data?: { errors?: string[] }, message?: string } | null
  expect(err, 'expected a rejection').not.toBeNull()
  expect(err!.statusCode).toBe(statusCode)
  if (text) expect(JSON.stringify(err)).toMatch(text)
}

const load = () => getContentMediaRelations(db.fetch, ITEM)
const save = (value: AdminContentMediaRelations, media: unknown[], relations: unknown[] = [], extra: Record<string, unknown> = {}) =>
  saveContentMediaRelations(db.fetch, ITEM, { expectedInventoryVersion: value.inventory_version, media, relations, ...extra })

describe('read', () => {
  it('returns only the roles this module manages, with locale metadata, archived state and preserved counts', async () => {
    db.addLink({ directus_files_id: IMG_A, file_role: 'hero', alt_en: 'Hero alt', alt_es: 'Alt ES' })
    db.addLink({ directus_files_id: ARCHIVED_IMG, file_role: 'inline' })
    db.addLink({ directus_files_id: OG, file_role: 'og_image' })
    db.addLink({ directus_files_id: SRC, file_role: 'source_document' })
    db.addRelation({ relation_kind: 'product', product_id: 3 })
    db.addRelation({ relation_kind: 'content', related_content_id: 2 })
    const value = await load()
    expect(value.media.map(m => m.file_role)).toEqual(['hero', 'inline'])
    expect(value.media[0]).toMatchObject({ alt: 'Hero alt', file: { filename_download: 'a.png', archived: false, is_public: false } })
    expect(value.media[1].file.archived).toBe(true)
    expect(value.preserved_role_counts).toEqual({ og_image: 1, source_document: 1 })
    expect(value.relations.map(r => r.relation_kind)).toEqual(['product', 'content'])
    expect(value.relations[0].product).toMatchObject({ id: 3, status: 'draft' })
    expect(value.relations[1].content).toMatchObject({ id: 2, content_type: 'resource_download', title: 'TEST ONLY resource' })
    expect(value.inventory_version).toBe((await load()).inventory_version)
    expect((await getContentMediaRelations(db.fetch, ITEM, 'es')).media[0].alt).toBe('Alt ES')
    expect(db.writes).toHaveLength(0)
  })

  it('404 for a missing item and 422 for an unknown locale', async () => {
    await expectRejected(getContentMediaRelations(db.fetch, 999), 404)
    await expectRejected(getContentMediaRelations(db.fetch, ITEM, 'zh'), 422)
  })
})

describe('hero', () => {
  it('links, replaces and removes the hero; only one hero is ever accepted', async () => {
    let value = await save(await load(), [{ directus_files_id: IMG_A, file_role: 'hero', alt: 'Cover' }])
    expect(value.media).toHaveLength(1)
    expect(value.media[0]).toMatchObject({ file_role: 'hero', directus_files_id: IMG_A, alt: 'Cover' })

    value = await save(value, [{ directus_files_id: IMG_B, file_role: 'hero' }])
    expect(value.media.map(m => [m.file_role, m.directus_files_id])).toEqual([['hero', IMG_B]])

    const writesBefore = db.writes.length
    await expectRejected(save(value, [
      { directus_files_id: IMG_A, file_role: 'hero' }, { directus_files_id: IMG_B, file_role: 'hero', id: value.media[0].id },
    ]), 422, /Only one hero/)
    expect(db.writes).toHaveLength(writesBefore)

    value = await save(value, [])
    expect(value.media).toHaveLength(0)
  })

  it('rejects a hero or inline file that is not an image', async () => {
    await expectRejected(save(await load(), [{ directus_files_id: PDF, file_role: 'hero' }]), 422, /must be an image/)
    await expectRejected(save(await load(), [{ directus_files_id: PDF, file_role: 'inline' }]), 422, /must be an image/)
    expect(db.writes).toHaveLength(0)
  })
})

describe('archived and missing media', () => {
  it('rejects linking an archived file in any role and writes nothing', async () => {
    for (const role of ['hero', 'inline', 'download']) {
      await expectRejected(save(await load(), [{ directus_files_id: ARCHIVED_IMG, file_role: role }]), 422, /archived/)
    }
    expect(db.writes).toHaveLength(0)
    expect(db.links.size).toBe(0)
  })

  it('keeps a link whose file was archived after it was linked', async () => {
    const row = db.addLink({ directus_files_id: ARCHIVED_IMG, file_role: 'inline' })
    const value = await load()
    const saved = await save(value, [{ id: row.id, directus_files_id: ARCHIVED_IMG, file_role: 'inline', alt: 'Still here' }])
    expect(saved.media[0]).toMatchObject({ id: row.id, alt: 'Still here', file: { archived: true } })
  })

  it('rejects a file that is not in the Media Library', async () => {
    await expectRejected(save(await load(), [{ directus_files_id: '12345678-1234-4234-8234-123456789012', file_role: 'download' }]), 422, /does not exist/)
  })
})

describe('roles owned by other modules', () => {
  it('rejects og_image, source_document and unknown roles', async () => {
    await expectRejected(save(await load(), [{ directus_files_id: OG, file_role: 'og_image' }]), 422, /another workspace module/)
    await expectRejected(save(await load(), [{ directus_files_id: SRC, file_role: 'source_document' }]), 422, /another workspace module/)
    await expectRejected(save(await load(), [{ directus_files_id: IMG_A, file_role: 'gallery' }]), 422, /hero, inline or download/)
  })

  it('never removes or edits og_image and source_document links', async () => {
    const og = db.addLink({ directus_files_id: OG, file_role: 'og_image', alt_en: 'OG alt' })
    const src = db.addLink({ directus_files_id: SRC, file_role: 'source_document' })
    db.addLink({ directus_files_id: IMG_A, file_role: 'hero' })
    await save(await load(), [{ directus_files_id: IMG_B, file_role: 'inline' }])
    expect(db.links.get(og.id)).toMatchObject({ file_role: 'og_image', alt_en: 'OG alt' })
    expect(db.links.get(src.id)).toMatchObject({ file_role: 'source_document' })
    const deleted = db.writes.filter(w => w.method === 'DELETE').flatMap(w => w.body as number[])
    expect(deleted).not.toContain(og.id)
    expect(deleted).not.toContain(src.id)
  })

  it('rejects mass-assigned fields', async () => {
    await expectRejected(save(await load(), [], [], { status: 'published' }), 422, /cannot be set here/)
    await expectRejected(save(await load(), [{ directus_files_id: IMG_A, file_role: 'hero', content_items_id: 99 }]), 422, /cannot be set here/)
  })
})

describe('inline media and downloads', () => {
  it('adds, reorders and removes inline media with one batch per step', async () => {
    let value = await save(await load(), [{ directus_files_id: IMG_A, file_role: 'inline' }, { directus_files_id: IMG_B, file_role: 'inline' }])
    expect(value.media.map(m => [m.directus_files_id, m.sort])).toEqual([[IMG_A, 0], [IMG_B, 1]])
    const [a, b] = value.media
    db.writes = []
    value = await save(value, [{ id: b.id, directus_files_id: IMG_B, file_role: 'inline' }, { id: a.id, directus_files_id: IMG_A, file_role: 'inline' }])
    expect(value.media.map(m => m.directus_files_id)).toEqual([IMG_B, IMG_A])
    expect(db.writes.map(w => w.method)).toEqual(['PATCH'])
    value = await save(value, [{ id: b.id, directus_files_id: IMG_B, file_role: 'inline' }])
    expect(value.media.map(m => m.directus_files_id)).toEqual([IMG_B])
  })

  it('refuses to unlink an inline file an image block still uses', async () => {
    const row = db.addLink({ directus_files_id: IMG_A, file_role: 'inline' })
    db.item.locales[1].blocks = [{ id: 'x', type: 'image', data: { fileLinkId: row.id } }]
    const value = await load()
    expect(value.media[0].used_by_image_blocks).toBe(true)
    await expectRejected(save(value, []), 422, /used by an image section/)
    expect(db.links.has(row.id)).toBe(true)
  })

  it('saves download metadata and keeps other-locale alt text', async () => {
    const row = db.addLink({ directus_files_id: PDF, file_role: 'download', alt_es: 'Guía' })
    const saved = await save(await load(), [{
      id: row.id, directus_files_id: PDF, file_role: 'download', alt: 'Guide', language: 'en', version_label: 'v2', file_date: '2026-09-15', enabled: false,
    }])
    expect(saved.media[0]).toMatchObject({ alt: 'Guide', language: 'en', version_label: 'v2', file_date: '2026-09-15', enabled: false })
    expect(db.links.get(row.id)).toMatchObject({ alt_en: 'Guide', alt_es: 'Guía' })
  })

  it('validates download metadata and rejects it on other roles', async () => {
    await expectRejected(save(await load(), [{ directus_files_id: PDF, file_role: 'download', language: 'fr' }]), 422, /language/)
    await expectRejected(save(await load(), [{ directus_files_id: PDF, file_role: 'download', file_date: '2026-02-30' }]), 422, /file_date/)
    await expectRejected(save(await load(), [{ directus_files_id: IMG_A, file_role: 'hero', version_label: 'v1' }]), 422, /downloads only/)
    await expectRejected(save(await load(), [{ directus_files_id: IMG_A, file_role: 'hero', alt: 'x'.repeat(251) }]), 422, /at most 250/)
  })

  it('treats an entry without id that matches an existing link as that link (no duplicate)', async () => {
    db.addLink({ directus_files_id: IMG_A, file_role: 'inline' })
    await save(await load(), [{ directus_files_id: IMG_A, file_role: 'inline' }])
    expect(db.writes.filter(w => w.method === 'POST')).toHaveLength(0)
    expect(db.links.size).toBe(1)
    await expectRejected(save(await load(), [{ directus_files_id: IMG_A, file_role: 'inline' }, { directus_files_id: IMG_A, file_role: 'inline' }]), 422, /already linked/)
  })
})

describe('relations', () => {
  it('relates a product and a resource, orders them, and removes one', async () => {
    let value = await save(await load(), [], [
      { relation_kind: 'product', product_id: 3 },
      { relation_kind: 'content', related_content_id: 2 },
    ])
    expect(value.relations.map(r => [r.relation_kind, r.sort])).toEqual([['product', 0], ['content', 1]])
    expect(value.relations[1].content?.content_type).toBe('resource_download')
    const [product, resource] = value.relations
    value = await save(value, [], [
      { id: resource.id, relation_kind: 'content', related_content_id: 2 },
      { id: product.id, relation_kind: 'product', product_id: 3 },
    ])
    expect(value.relations.map(r => r.relation_kind).sort()).toEqual(['content', 'product'])
    expect([...db.relations.values()].find(r => r.id === resource.id)?.sort).toBe(0)
    value = await save(value, [], [{ id: product.id, relation_kind: 'product', product_id: 3 }])
    expect(value.relations).toHaveLength(1)
  })

  it('rejects self, duplicate, invalid kind, missing and archived targets without writing', async () => {
    const value = await load()
    await expectRejected(save(value, [], [{ relation_kind: 'content', related_content_id: ITEM }]), 422, /itself/)
    await expectRejected(save(value, [], [{ relation_kind: 'product', product_id: 3 }, { relation_kind: 'product', product_id: 3 }]), 422, /already related/)
    await expectRejected(save(value, [], [{ relation_kind: 'resource', related_content_id: 2 }]), 422, /relation_kind/)
    await expectRejected(save(value, [], [{ relation_kind: 'product', product_id: 404 }]), 422, /does not exist/)
    await expectRejected(save(value, [], [{ relation_kind: 'content', related_content_id: 9 }]), 422, /archived/)
    await expectRejected(save(value, [], [{ relation_kind: 'product', product_id: 3, related_content_id: 2 }]), 422, /exactly one/)
    expect(db.writes).toHaveLength(0)
  })
})

describe('save safety', () => {
  it('rejects a stale inventory version with 409 and writes nothing', async () => {
    const value = await load()
    db.addRelation({ relation_kind: 'product', product_id: 3 })
    await expectRejected(save(value, [{ directus_files_id: IMG_A, file_role: 'hero' }]), 409, /currentInventoryVersion/)
    expect(db.writes).toHaveLength(0)
  })

  it('refuses changes on an archived content item', async () => {
    db.item.status = 'archived'
    await expectRejected(save(await load(), []), 409, /archived/)
  })

  it('reports a failure after the first write as a partial save', async () => {
    db.addLink({ directus_files_id: IMG_A, file_role: 'inline' })
    const value = await load()
    db.failOnWrite = 2
    await expectRejected(save(value, [{ directus_files_id: IMG_B, file_role: 'hero' }], [{ relation_kind: 'product', product_id: 3 }]), 500, /"partial":true/)
  })

  it('never writes content status, blocks, file lifecycle or file visibility', async () => {
    await save(await load(), [{ directus_files_id: IMG_A, file_role: 'hero' }], [{ relation_kind: 'product', product_id: 3 }])
    expect(new Set(db.writes.map(w => w.path))).toEqual(new Set(['/items/content_items_files', '/items/content_relations']))
    expect(JSON.stringify(db.writes)).not.toMatch(/is_public|archived|status|blocks|published/)
  })
})

describe('getFileReferences includes Content Center links (Blueprint §11 P1)', () => {
  it('a content-linked file cannot be archived and names the content item', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [] }) // products_files
      .mockResolvedValueOnce({ data: [] }) // product_source_records
      .mockResolvedValueOnce({ data: [{ id: 1, file_role: 'hero', content_items_id: { id: 6, locales: [{ locale: 'en', title: 'TEST ONLY — NOT FOR PUBLICATION' }] } }] })
    const result = await getFileReferences(IMG_A, fetch)
    expect(result).toMatchObject({ total: 1, can_archive: false, content_count: 1, product_count: 0 })
    expect(result.content_references).toEqual([{ content_item_id: 6, content_title: 'TEST ONLY — NOT FOR PUBLICATION', file_role: 'hero' }])
    expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('/items/content_items_files?filter[directus_files_id][_eq]='))
  })

  it('product and source references still count, and an unreferenced file stays archivable', async () => {
    const product = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 10, file_role: 'hero', products_id: { id: 3, name_en: 'P' } }] })
      .mockResolvedValueOnce({ data: [], meta: { filter_count: 0 } })
      .mockResolvedValueOnce({ data: [{ id: 7, product_id: { id: 3, name_en: 'P' } }] })
      .mockResolvedValueOnce({ data: [{ id: 2, file_role: 'download', content_items_id: { id: 6, locales: [] } }] })
    const both = await getFileReferences(IMG_A, product)
    expect(both).toMatchObject({ total: 3, product_count: 1, source_count: 1, content_count: 1, can_archive: false })
    expect(both.content_references[0].content_title).toBe('Content item 6')

    const none = vi.fn().mockResolvedValue({ data: [] })
    expect(await getFileReferences(IMG_A, none)).toMatchObject({ total: 0, can_archive: true, content_references: [] })
  })

  it('a failed content lookup fails the check instead of allowing archive', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    await expect(getFileReferences(IMG_A, fetch)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('page helpers', () => {
  const response = (): AdminContentMediaRelations => ({
    item: { id: ITEM, content_type: 'technical_article', status: 'draft', title: 'T' },
    locale: 'en',
    media: [
      { id: 2, directus_files_id: IMG_B, file_role: 'inline', alt: null, caption: null, language: null, version_label: null, file_date: null, enabled: true, sort: 1, used_by_image_blocks: false, file: { filename_download: 'b.jpg', title: null, type: 'image/jpeg', filesize: 1, width: null, height: null, is_public: true, archived: false } },
      { id: 1, directus_files_id: IMG_A, file_role: 'inline', alt: null, caption: null, language: null, version_label: null, file_date: null, enabled: true, sort: 0, used_by_image_blocks: false, file: { filename_download: 'a.png', title: null, type: 'image/png', filesize: 1, width: null, height: null, is_public: false, archived: false } },
      { id: 3, directus_files_id: PDF, file_role: 'download', alt: null, caption: null, language: 'all', version_label: null, file_date: null, enabled: true, sort: 0, used_by_image_blocks: false, file: { filename_download: 'guide.pdf', title: null, type: 'application/pdf', filesize: 1, width: null, height: null, is_public: false, archived: false } },
    ],
    preserved_role_counts: { og_image: 0, source_document: 0 },
    relations: [{ id: 5, relation_kind: 'product', sort: 0, product: { id: 3, name_en: 'P', product_code: null, status: 'draft' }, content: null }],
    inventory_version: 'v1',
  })

  it('orders staged media by role and saved sort, and detects real changes only', () => {
    const original = mediaRelationsStateFrom(response())
    expect(original.media.map(m => m.id)).toEqual([1, 2, 3])
    const current = cloneMediaRelationsState(original)
    expect(isMediaRelationsDirty(original, current)).toBe(false)
    current.media[0].alt = '  '
    expect(isMediaRelationsDirty(original, current)).toBe(false)
    current.media = moveMediaWithinRole(current.media, current.media[1].key, -1)
    expect(isMediaRelationsDirty(original, current)).toBe(true)
    expect(current.media.map(m => m.id)).toEqual([2, 1, 3])
    expect(moveMediaWithinRole(current.media, current.media[2].key, -1).map(m => m.id)).toEqual([2, 1, 3])
  })

  it('builds the complete desired inventory with the loaded version', () => {
    const state = mediaRelationsStateFrom(response())
    state.media.push(stagedMediaFromFile({ id: IMG_A, filename_download: 'a.png', title: null, type: 'image/png', filesize: 1, width: null, height: null }, 'hero'))
    const body = buildMediaRelationsSaveBody(state, 'v1', 'en')
    expect(body.expectedInventoryVersion).toBe('v1')
    expect(body.media.map(m => [m.file_role, m.id])).toEqual([['hero', null], ['inline', 1], ['inline', 2], ['download', 3]])
    expect(body.media[3]).toMatchObject({ language: 'all', version_label: null, file_date: null })
    expect(body.media[0]).not.toHaveProperty('language')
    expect(body.relations).toEqual([{ id: 5, relation_kind: 'product', product_id: 3, related_content_id: null }])
    expect(JSON.stringify(body)).not.toMatch(/status|is_public|archived|blocks/)
  })

  it('explains conflicts, partial saves and validation errors with file names', () => {
    const state = mediaRelationsStateFrom(response())
    expect(interpretMediaRelationsSaveError({ statusCode: 409, data: { message: 'x', data: { currentInventoryVersion: 'v2' } } }).kind).toBe('conflict')
    expect(interpretMediaRelationsSaveError({ statusCode: 500, data: { message: 'Saving stopped part-way', data: { partial: true } } }).kind).toBe('partial')
    const invalid = interpretMediaRelationsSaveError(
      { statusCode: 422, data: { message: 'Some media or relation changes are not valid. Nothing was saved.', data: { errors: ['media[2]: the file is archived in the Media Library and cannot be linked.'] } } },
      saveBodyLabels(state),
    )
    expect(invalid.errors).toEqual(['"guide.pdf" (download): the file is archived in the Media Library and cannot be linked.'])
  })

  it('shared validators', () => {
    expect(isIsoDate('2026-09-15')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isImageMimeType('image/webp')).toBe(true)
    expect(isImageMimeType('application/pdf')).toBe(false)
  })
})

describe('source evidence — no second media system', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

  it('Content Center never uploads, archives, publishes or changes file visibility', () => {
    for (const file of ['components/admin/content/ContentMediaRelations.vue', 'components/admin/content/ContentRelationPicker.vue', 'pages/admin/content-center/[id]/media-relations.vue', 'server/utils/contentMediaRelations.ts']) {
      const source = read(file)
      expect(source, file).not.toMatch(/type="file"|\/media\/upload|\/archive|\/restore|is_public:\s*true|\/publish/)
    }
  })

  it('reuses the shared Media Library picker and browser, which ask the server to exclude archived files', () => {
    expect(read('components/admin/content/ContentMediaRelations.vue')).toContain('<MediaLibraryPicker')
    expect(read('components/admin/workspace/WorkspaceMediaResources.vue')).toContain('<MediaLibraryPicker')
    const browser = read('composables/useMediaLibraryBrowser.ts')
    expect(browser).toContain('buildLibraryFilesQuery(')
    expect(browser).toContain("'/api/admin/media/files'")
    expect(read('utils/mediaDisplay.ts')).toContain("archived: 'exclude'")
  })
})
