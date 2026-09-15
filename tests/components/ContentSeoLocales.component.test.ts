// @vitest-environment happy-dom
/**
 * CC-IMP-05 — SEO & Locales panel, mounted, with `$fetch` stubbed: language
 * tabs and states, SEO field editing with Draft previews, one PUT save with only
 * the changed fields, stale conflict, locked slug, dirty language switch, the
 * explicit untranslated "Start locale", and the shared Media Library picker for
 * the Open Graph image.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentSeoLocales from '../../components/admin/content/ContentSeoLocales.vue'
import type { AdminContentSeoLocaleRow, AdminContentSeoLocales } from '../../types/content-center'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION SEO'
const HERO = '11111111-1111-4111-8111-111111111111'
const OG_NEW = '99999999-9999-4999-8999-999999999999'

function localeRow(overrides: Partial<AdminContentSeoLocaleRow> = {}): AdminContentSeoLocaleRow {
  return {
    id: 20, content_items_id: 6, locale: 'en', title: TEST_TITLE, slug: 'test-only-seo', summary: 'TEST ONLY summary',
    seo_title: null, seo_description: null, canonical_path: null, noindex: false,
    draft_revision: 5, published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit',
    block_count: 3, ...overrides,
  }
}

function initial(overrides: Partial<AdminContentSeoLocales> = {}): AdminContentSeoLocales {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', title: TEST_TITLE },
    default_locale: 'en',
    site_locales: ['en', 'es', 'pt'],
    published_locales: ['en'],
    locales: [localeRow()],
    og_image: null,
    hero: {
      link_id: 1, directus_files_id: HERO, enabled: true,
      file: { filename_download: 'hero.png', title: null, type: 'image/png', width: 1200, height: 630, filesize: 2048, is_public: false, archived: false },
    },
    og_version: 'og-1',
    ...overrides,
  }
}

function mountPanel(value = initial(), locale: 'en' | 'es' | 'pt' = 'en') {
  return mount(ContentSeoLocales, {
    props: { initial: value, locale },
    global: {
      stubs: {
        teleport: true,
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' },
      },
    },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof mountPanel>
const lastStatus = (w: Wrapper) => (w.emitted('status') ?? []).at(-1)?.[0] as { dirty: boolean, conflict: boolean }
const tab = (w: Wrapper, label: string) => w.findAll('[role="tab"]').find(t => t.text().startsWith(label))!
const buttonText = (w: Wrapper, text: string) => w.findAll('button').find(b => b.text() === text)!

const apiError = (statusCode: number, message: string, data: Record<string, unknown>) =>
  Object.assign(new Error('fetch failed'), { statusCode, data: { statusCode, message, data } })

function routedFetch(overrides: Record<string, (options: Record<string, unknown>) => unknown> = {}) {
  return vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
    const key = `${String(options.method ?? 'GET')} ${url}`
    if (overrides[key]) return overrides[key](options)
    if (url === '/api/admin/media/folders') return []
    if (url === '/api/admin/media/files') {
      return { data: [{ id: OG_NEW, filename_download: 'og-new.webp', title: null, type: 'image/webp', filesize: 100, width: 1200, height: 630, folder: null }], meta: { filter_count: 1 } }
    }
    throw new Error(`unexpected request ${key}`)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('ContentSeoLocales — rendering', () => {
  it('shows one tab per site language with its real state and no fake AI, score or public URL', () => {
    const w = mountPanel()
    expect(w.findAll('[role="tab"]').map(t => [t.find('.csl-tab-label').text(), t.find('.csl-pill').text()])).toEqual([
      ['English (default)', 'Draft'], ['Spanish', 'Not started'], ['Portuguese', 'Not started'],
    ])
    expect(tab(w, 'English').attributes('aria-selected')).toBe('true')
    expect(w.find('#csl-slug').element).toHaveProperty('value', 'test-only-seo')
    expect(w.text()).not.toMatch(/Improve with AI|AI Fill|Focus terms|Social title|%|score|https?:\/\//i)
    expect(w.text()).toContain('Draft preview — public route not enabled')
    expect(w.text()).toContain('Default public canonical will be resolved when Public Delivery is enabled.')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    expect(w.find('.csl-content-link a').attributes('href')).toBe('/admin/content-center/6/editor')
  })

  it('previews fall back to title, summary and the hero image; typing updates the Draft preview', async () => {
    const w = mountPanel()
    expect(w.find('.csl-serp-title').text()).toBe(TEST_TITLE)
    expect(w.find('.csl-serp-description').text()).toBe('TEST ONLY summary')
    expect(w.text()).toContain('hero image (fallback)')
    expect(w.find('.csl-empty').text()).toContain('Previews use the hero image.')
    await w.find('#csl-seo-title').setValue('TEST ONLY SEO title')
    await w.find('#csl-noindex').setValue(true)
    expect(w.find('.csl-serp-title').text()).toBe('TEST ONLY SEO title')
    expect(w.find('.csl-serp-noindex').exists()).toBe(true)
    expect(w.find('.csl-count').text()).toBe('19 / 120')
    const checks = w.findAll('.csl-check-item').map(li => li.find('.csl-check-label').text())
    expect(checks).toEqual(['URL slug is valid', 'SEO title set', 'Meta description uses the summary', 'Default canonical', 'Social preview uses the hero image', 'Noindex is on'])
    expect(lastStatus(w).dirty).toBe(true)
  })

  it('a published language keeps its slug locked in the UI', () => {
    const w = mountPanel(initial({ locales: [localeRow({ first_published_at: '2026-09-15T01:00:00Z', published_revision: 5 })] }))
    expect(w.find('#csl-slug').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Locked — this language has been published.')
    expect(tab(w, 'English').text()).toContain('Published')
  })
})

describe('ContentSeoLocales — save', () => {
  it('one Save sends one PUT with only the changed fields and the loaded revision', async () => {
    const saved = initial({ locales: [localeRow({ seo_title: 'TEST ONLY SEO title', canonical_path: '/test-only', draft_revision: 6 })] })
    const fetchMock = routedFetch({ 'PUT /api/admin/content-center/6/seo-locales': () => saved })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await w.find('#csl-seo-title').setValue('  TEST ONLY SEO title ')
    await w.find('#csl-canonical').setValue('/test-only')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, { method: string, body: Record<string, unknown> }]
    expect(options.method).toBe('PUT')
    expect(options.body).toEqual({ locale: 'en', expectedDraftRevision: 5, fields: { seo_title: 'TEST ONLY SEO title', canonical_path: '/test-only' } })
    expect(w.text()).toContain('English draft · revision 6')
    expect(lastStatus(w).dirty).toBe(false)
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('an external canonical URL is flagged and not sent', async () => {
    const fetchMock = routedFetch()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await w.find('#csl-canonical').setValue('https://example.com/page')
    expect(w.text()).toContain('Use a path on this site that starts with “/”')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a stale revision keeps the local SEO edits and needs a confirmed reload', async () => {
    const fetchMock = routedFetch({
      'PUT /api/admin/content-center/6/seo-locales': () => { throw apiError(409, 'changed', { currentDraftRevision: 6 }) },
      'GET /api/admin/content-center/6/seo-locales': () => initial({ locales: [localeRow({ seo_title: 'Saved elsewhere', draft_revision: 6 })] }),
    })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await w.find('#csl-seo-description').setValue('TEST ONLY local description')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    expect(w.find('.csl-conflict').text()).toContain('This language draft changed since you opened it.')
    expect(w.find('.csl-conflict').text()).toContain('revision 6')
    expect((w.find('#csl-seo-description').element as HTMLTextAreaElement).value).toBe('TEST ONLY local description')
    expect(lastStatus(w)).toMatchObject({ dirty: true, conflict: true })
    await buttonText(w, 'Reload latest').trigger('click')
    await buttonText(w, 'Discard my changes and reload').trigger('click')
    await flushPromises()
    expect((w.find('#csl-seo-title').element as HTMLInputElement).value).toBe('Saved elsewhere')
    expect(lastStatus(w)).toMatchObject({ dirty: false, conflict: false })
  })

  it('a locked-slug rejection is shown on the slug field', async () => {
    vi.stubGlobal('$fetch', routedFetch({
      'PUT /api/admin/content-center/6/seo-locales': () => { throw apiError(422, 'The slug is locked because this language has been published.', { field: 'slug', slugLocked: true }) },
    }))
    const w = mountPanel()
    await w.find('#csl-slug').setValue('test-only-renamed')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    expect(w.find('#csl-slug').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('The slug is locked because this language has been published.')
    expect(lastStatus(w).dirty).toBe(true)
  })
})

describe('ContentSeoLocales — languages', () => {
  it('switching language with unsaved changes asks first; Cancel keeps the edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = mountPanel()
    await w.find('#csl-seo-title').setValue('TEST ONLY unsaved')
    await tab(w, 'Spanish').trigger('click')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(tab(w, 'English').attributes('aria-selected')).toBe('true')
    expect((w.find('#csl-seo-title').element as HTMLInputElement).value).toBe('TEST ONLY unsaved')
    expect(w.emitted('locale')).toBeUndefined()

    confirm.mockReturnValue(true)
    await tab(w, 'Spanish').trigger('click')
    expect(tab(w, 'Spanish').attributes('aria-selected')).toBe('true')
    expect(w.emitted('locale')).toEqual([['es']])
    expect(lastStatus(w).dirty).toBe(false)
  })

  it('a not-started language shows Not started and inherits nothing from English', async () => {
    const w = mountPanel(initial(), 'es')
    expect(w.find('.csl-start-title').text()).toBe('Spanish has not been started')
    expect(w.text()).toContain('Start locale creates an empty Draft for this language. Nothing is translated or published automatically.')
    expect(w.find('#csl-slug').exists()).toBe(false)
    expect(w.find('.csl-serp-title').text()).toBe('No title yet')
    expect((w.find('#csl-start-title').element as HTMLInputElement).value).toBe('')
    expect((w.find('#csl-start-slug').element as HTMLInputElement).value).toBe('test-only-seo')
    expect(w.findAll('.csl-check-item')).toHaveLength(0)
  })

  it('Start locale sends one POST with the typed title and editable slug, then shows the new Draft', async () => {
    const started = initial({ locales: [localeRow(), localeRow({ id: 21, locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-seo-es', summary: null, draft_revision: 1 })] })
    const fetchMock = routedFetch({
      'POST /api/admin/content-center/6/locales': () => ({}),
      'GET /api/admin/content-center/6/seo-locales': () => started,
    })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel(initial(), 'es')
    await buttonText(w, 'Start Spanish draft').trigger('click')
    expect(w.text()).toContain('Enter a Spanish title.')
    expect(fetchMock).not.toHaveBeenCalled()

    await w.find('#csl-start-title').setValue(' TEST ONLY ES ')
    await w.find('#csl-start-slug').setValue('test-only-seo-es')
    await buttonText(w, 'Start Spanish draft').trigger('click')
    await flushPromises()
    const posts = fetchMock.mock.calls.filter(c => (c[1] as { method?: string } | undefined)?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect((posts[0][1] as { body: unknown }).body).toEqual({ locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-seo-es' })
    expect(tab(w, 'Spanish').text()).toContain('Draft')
    expect((w.find('#csl-slug').element as HTMLInputElement).value).toBe('test-only-seo-es')
    expect(w.find('.csl-content-link a').attributes('href')).toBe('/admin/content-center/6/editor?locale=es')
  })

  it('Start is blocked while the page has unsaved changes', async () => {
    const fetchMock = routedFetch()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel(initial(), 'es')
    expect(w.find('.csl-start-form').attributes('disabled')).toBeUndefined()
    await buttonText(w, 'Select from Media Library').trigger('click')
    await flushPromises()
    await w.find('.ws-lib-card').trigger('click')
    expect(lastStatus(w).dirty).toBe(true)
    expect(w.find('.csl-start-form').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Save or discard your changes before starting a language.')
    expect(fetchMock.mock.calls.every(c => (c[1] as { method?: string } | undefined)?.method === undefined)).toBe(true)
  })
})

describe('ContentSeoLocales — Open Graph image', () => {
  it('uses the shared picker for images with archived files excluded, and stages the pick', async () => {
    const fetchMock = routedFetch({ 'PUT /api/admin/content-center/6/seo-locales': () => initial({ og_version: 'og-2' }) })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel()
    await buttonText(w, 'Select from Media Library').trigger('click')
    await flushPromises()
    const filesCall = fetchMock.mock.calls.find(c => c[0] === '/api/admin/media/files') as unknown as [string, { query: Record<string, string> }]
    expect(filesCall[1].query).toMatchObject({ archived: 'exclude', type: 'image' })
    await w.find('.ws-lib-card').trigger('click')
    expect(w.find('.ws-lib-modal').exists()).toBe(false)
    expect(w.find('.csl-og').text()).toContain('og-new.webp')
    expect(w.find('.csl-og').text()).toContain('New — not saved yet')
    expect(w.text()).toContain('Image: Open Graph image')
    expect(lastStatus(w).dirty).toBe(true)
    expect(w.find('.csl-start-form').exists()).toBe(false)

    await w.find('.csl-save').trigger('click')
    await flushPromises()
    const put = fetchMock.mock.calls.find(c => (c[1] as { method?: string } | undefined)?.method === 'PUT') as unknown as [string, { body: Record<string, unknown> }]
    expect(put[1].body).toEqual({ locale: 'en', og_image: { directus_files_id: OG_NEW, expectedOgVersion: 'og-1' } })
  })

  it('removing the Open Graph image stages null and never touches the hero', async () => {
    const withOg = initial({
      og_image: { link_id: 9, directus_files_id: OG_NEW, enabled: true, file: { filename_download: 'og.png', title: null, type: 'image/png', width: 1, height: 1, filesize: 1, is_public: false, archived: true } },
    })
    const fetchMock = routedFetch({ 'PUT /api/admin/content-center/6/seo-locales': () => initial() })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountPanel(withOg)
    expect(w.find('.csl-og').text()).toContain('Archived in Media Library — replace or remove')
    expect(w.findAll('.csl-check-item').find(li => li.text().includes('archived'))).toBeTruthy()
    await buttonText(w, 'Remove').trigger('click')
    expect(w.find('.csl-empty').text()).toContain('Previews use the hero image.')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    const put = fetchMock.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }]
    expect(put[1].body).toEqual({ locale: 'en', og_image: { directus_files_id: null, expectedOgVersion: 'og-1' } })
    expect(JSON.stringify(put[1].body)).not.toContain(HERO)
  })

  it('switching language with a staged image asks before discarding it', async () => {
    vi.stubGlobal('$fetch', routedFetch())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = mountPanel()
    await buttonText(w, 'Select from Media Library').trigger('click')
    await flushPromises()
    await w.find('.ws-lib-card').trigger('click')
    await tab(w, 'Portuguese').trigger('click')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(w.find('.csl-og').text()).toContain('og-new.webp')
  })

  it('a partial save keeps the image staged and records the saved SEO revision', async () => {
    vi.stubGlobal('$fetch', routedFetch({
      'PUT /api/admin/content-center/6/seo-locales': () => {
        throw apiError(500, 'Search settings were saved, but the Open Graph image was not.', { partial: true, saved: ['seo'], notSaved: ['og_image'], ogImageRetryable: true, currentDraftRevision: 6 })
      },
    }))
    const w = mountPanel()
    await w.find('#csl-seo-title').setValue('TEST ONLY partial')
    await buttonText(w, 'Select from Media Library').trigger('click')
    await flushPromises()
    await w.find('.ws-lib-card').trigger('click')
    await w.find('.csl-save').trigger('click')
    await flushPromises()
    expect(w.find('.csl-partial').text()).toContain('Search settings saved — the Open Graph image was not.')
    expect(w.text()).toContain('English draft · revision 6')
    expect(w.find('.csl-og').text()).toContain('New — not saved yet')
    expect(lastStatus(w)).toMatchObject({ dirty: true, conflict: false })
  })
})
