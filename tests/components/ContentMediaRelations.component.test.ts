// @vitest-environment happy-dom
/**
 * CC-IMP-04 — Media & Relations page panel, mounted, with `$fetch` stubbed:
 * rendering, staged picks through the shared Media Library picker (archived
 * excluded by the query), staged removal / reorder / relation link, one PUT
 * save, conflict and validation errors.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentMediaRelations from '../../components/admin/content/ContentMediaRelations.vue'
import type { AdminContentMediaRelations } from '../../types/content-center'

const IMG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const IMG_NEW = '99999999-9999-4999-8999-999999999999'
const PDF = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const file = (name: string, type: string, extra: Record<string, unknown> = {}) => ({
  filename_download: name, title: null, type, filesize: 2048, width: 1200, height: 800, is_public: false, archived: false, ...extra,
})

function initial(): AdminContentMediaRelations {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', title: 'TEST ONLY — NOT FOR PUBLICATION Media' },
    locale: 'en',
    media: [
      { id: 1, directus_files_id: IMG_A, file_role: 'hero', alt: 'Cover', caption: null, language: null, version_label: null, file_date: null, enabled: true, sort: 0, used_by_image_blocks: false, file: file('hero.png', 'image/png') },
      { id: 2, directus_files_id: IMG_B, file_role: 'inline', alt: null, caption: null, language: null, version_label: null, file_date: null, enabled: true, sort: 0, used_by_image_blocks: true, file: file('inline-b.jpg', 'image/jpeg') },
      { id: 4, directus_files_id: IMG_A, file_role: 'inline', alt: null, caption: null, language: null, version_label: null, file_date: null, enabled: true, sort: 1, used_by_image_blocks: false, file: file('hero.png', 'image/png', { archived: true }) },
      { id: 3, directus_files_id: PDF, file_role: 'download', alt: null, caption: null, language: 'all', version_label: 'v1', file_date: null, enabled: true, sort: 0, used_by_image_blocks: false, file: file('guide.pdf', 'application/pdf') },
    ],
    preserved_role_counts: { og_image: 1, source_document: 0 },
    relations: [{ id: 5, relation_kind: 'content', sort: 0, product: null, content: { id: 2, title: 'TEST ONLY resource', content_type: 'resource_download', status: 'draft' } }],
    inventory_version: 'inv-1',
  }
}

type Wrapper = ReturnType<typeof mountPanel>

function mountPanel(value = initial()) {
  return mount(ContentMediaRelations, {
    props: { initial: value },
    global: { stubs: { teleport: true } },
    attachTo: document.body,
  })
}

const lastStatus = (w: Wrapper) => (w.emitted('status') ?? []).at(-1)?.[0] as { dirty: boolean }
const button = (w: Wrapper, scope: string, text: string) => w.find(scope).findAll('button').find(b => b.text() === text)!

function routedFetch(overrides: Record<string, (options: Record<string, unknown>) => unknown> = {}) {
  return vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
    const key = `${String(options.method ?? 'GET')} ${url}`
    if (overrides[key]) return overrides[key](options)
    if (url === '/api/admin/media/folders') return []
    if (url === '/api/admin/media/files') {
      return { data: [{ id: IMG_NEW, filename_download: 'new-hero.webp', title: null, type: 'image/webp', filesize: 100, width: 10, height: 10, folder: null }], meta: { filter_count: 1 } }
    }
    if (url === '/api/admin/products') return { data: [{ id: 3, name_en: '[TEST ONLY] LT-180C', product_code: null, status: 'draft' }] }
    throw new Error(`unexpected request ${key}`)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentMediaRelations — rendering', () => {
  it('shows hero, inline, downloads, relations and a real summary', () => {
    const w = mountPanel()
    expect(w.find('.cmr-hero').text()).toContain('hero.png')
    expect(w.findAll('.cmr-tile')).toHaveLength(2)
    expect(w.text()).toContain('guide.pdf')
    expect(w.text()).toContain('TEST ONLY resource')
    expect(w.find('.cmr-kind-badge').text()).toBe('Resource / Download')
    const facts = w.find('.cmr-aside .cmr-facts').text()
    expect(facts).toMatch(/Hero media\s*1/)
    expect(facts).toMatch(/Inline media\s*2/)
    expect(facts).toMatch(/Related resources\s*1/)
    expect(w.text()).toContain('Kept unchanged here: 1 Open Graph image link(s)')
    expect(w.text()).toContain('Archived')
    expect(w.text()).not.toMatch(/Ready|%|AI suggestions|Upload/)
    expect(w.find('input[type="file"]').exists()).toBe(false)
  })

  it('an inline file used by an image section cannot be removed', () => {
    const w = mountPanel()
    const tile = w.findAll('.cmr-tile')[0]
    expect(tile.text()).toContain('Used by an image section')
    expect(tile.findAll('button').find(b => b.text() === 'Remove')!.attributes('disabled')).toBeDefined()
  })
})

describe('ContentMediaRelations — staging', () => {
  it('is clean until a change is staged; nothing is requested while staging', async () => {
    const fetchMock = routedFetch()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    expect(lastStatus(w).dirty).toBe(false)
    expect(w.find('.cmr-savebar').exists()).toBe(false)
    await w.findAll('.cmr-tile')[1].findAll('button').find(b => b.text() === 'Remove')!.trigger('click')
    expect(lastStatus(w).dirty).toBe(true)
    expect(w.findAll('.cmr-tile')).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('replacing the hero opens the shared picker narrowed to images with archived files excluded', async () => {
    const fetchMock = routedFetch()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await button(w, '.cmr-card', 'Replace').trigger('click')
    await flushPromises()
    const filesCall = fetchMock.mock.calls.find(c => c[0] === '/api/admin/media/files') as unknown as [string, { query: Record<string, string> }]
    expect(filesCall[1].query).toMatchObject({ archived: 'exclude', type: 'image' })
    expect(w.find('.ws-lib-modal').exists()).toBe(true)
    await w.find('.ws-lib-card').trigger('click')
    expect(w.find('.ws-lib-modal').exists()).toBe(false)
    expect(w.find('.cmr-hero').text()).toContain('new-hero.webp')
    expect(w.find('.cmr-hero').text()).toContain('New — not saved yet')
    expect(w.text()).toMatch(/Hero media\s*1/)
    expect(fetchMock.mock.calls.every(c => (c[1] as { method?: string } | undefined)?.method === undefined)).toBe(true)
  })

  it('links a product through the relation picker and reorders relations', async () => {
    vi.stubGlobal('$fetch', routedFetch())
    const w = mountPanel()
    await button(w, '.cmr-main', 'Link product').trigger('click')
    await flushPromises()
    await w.find('.crp-item').trigger('click')
    const rows = () => w.findAll('.cmr-card')[3].findAll('.cmr-row').map(r => r.find('.cmr-file-name').text())
    expect(rows()).toEqual(['TEST ONLY resource', '[TEST ONLY] LT-180C'])
    await w.findAll('.cmr-card')[3].find('button[aria-label="Move [TEST ONLY] LT-180C up"]').trigger('click')
    expect(rows()).toEqual(['[TEST ONLY] LT-180C', 'TEST ONLY resource'])
    expect(lastStatus(w).dirty).toBe(true)
  })

  it('edits download metadata in the selected asset panel', async () => {
    vi.stubGlobal('$fetch', routedFetch())
    const w = mountPanel()
    await w.find('.cmr-row-main').trigger('click')
    await w.find('#cmr-version').setValue('v2')
    await w.find('#cmr-language').setValue('en')
    expect(w.find('.cmr-row').text()).toMatch(/English\s+·\s+v2/)
    expect(lastStatus(w).dirty).toBe(true)
  })
})

describe('ContentMediaRelations — save', () => {
  it('one Save sends one PUT with the loaded inventory version and the whole desired inventory', async () => {
    const saved = { ...initial(), inventory_version: 'inv-2' }
    const fetchMock = routedFetch({ 'PUT /api/admin/content-center/6/media-relations': () => saved })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await w.findAll('.cmr-tile')[1].findAll('button').find(b => b.text() === 'Remove')!.trigger('click')
    await w.find('.cmr-save').trigger('click')
    await flushPromises()
    const puts = fetchMock.mock.calls.filter(c => (c[1] as { method?: string })?.method === 'PUT')
    expect(puts).toHaveLength(1)
    const body = (puts[0][1] as { body: Record<string, unknown> }).body as { expectedInventoryVersion: string, media: Array<{ id: number }>, relations: unknown[] }
    expect(body.expectedInventoryVersion).toBe('inv-1')
    expect(body.media.map(m => m.id)).toEqual([1, 2, 3])
    expect(body.relations).toEqual([{ id: 5, relation_kind: 'content', product_id: null, related_content_id: 2 }])
    expect(w.emitted('saved')).toHaveLength(1)
    expect(lastStatus(w).dirty).toBe(false)
  })

  it('a stale inventory keeps staged changes and needs a confirmed reload', async () => {
    const fetchMock = routedFetch({
      'PUT /api/admin/content-center/6/media-relations': () => { throw Object.assign(new Error('x'), { statusCode: 409, data: { message: 'changed', data: { currentInventoryVersion: 'inv-9' } } }) },
      'GET /api/admin/content-center/6/media-relations': () => ({ ...initial(), inventory_version: 'inv-9', media: [] }),
    })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await w.findAll('.cmr-tile')[1].findAll('button').find(b => b.text() === 'Remove')!.trigger('click')
    await w.find('.cmr-save').trigger('click')
    await flushPromises()
    expect(w.find('.cmr-conflict').text()).toContain('Media or relations changed since you opened this page.')
    expect(w.findAll('.cmr-tile')).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('media-relations'))).toHaveLength(1)
    await button(w, '.cmr-conflict', 'Reload latest').trigger('click')
    await button(w, '.cmr-conflict', 'Discard my changes and reload').trigger('click')
    await flushPromises()
    expect(w.find('.cmr-conflict').exists()).toBe(false)
    expect(w.find('.cmr-hero').exists()).toBe(false)
    expect(lastStatus(w).dirty).toBe(false)
  })

  it('shows server validation errors with file names and keeps the staged state', async () => {
    vi.stubGlobal('$fetch', routedFetch({
      'PUT /api/admin/content-center/6/media-relations': () => {
        throw Object.assign(new Error('x'), { statusCode: 422, data: { message: 'Some media or relation changes are not valid. Nothing was saved.', data: { errors: ['media[0]: the file is archived in the Media Library and cannot be linked.'] } } })
      },
    }))
    const w = mountPanel()
    await w.find('.cmr-row-main').trigger('click')
    await w.find('#cmr-version').setValue('v3')
    await w.find('.cmr-save').trigger('click')
    await flushPromises()
    expect(w.find('.cmr-error').text()).toContain('Nothing was saved.')
    expect(w.find('.cmr-error-list').text()).toContain('"hero.png" (hero): the file is archived')
    expect(lastStatus(w).dirty).toBe(true)
  })
})
