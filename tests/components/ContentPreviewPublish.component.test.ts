// @vitest-environment happy-dom
/**
 * CC-IMP-06 — Preview & Publish Readiness panel and the safe block renderer, mounted,
 * with `$fetch` stubbed: Draft-only banner, plain-text rendering, inert call to
 * action, no fallback for a language that was not started, a blocked Publish with
 * its reason, confirmed Publish / Unpublish requests, stale conflict and a
 * refused publish that reloads the server's readiness.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentPreviewPublish from '../../components/admin/content/ContentPreviewPublish.vue'
import ContentBlocksRenderer from '../../components/content/ContentBlocksRenderer.vue'
import type { AdminContentPreviewPublish, ContentReadinessCheck } from '../../types/content-center'

const TITLE = 'TEST ONLY — NOT FOR PUBLICATION CC-IMP-06'
const HERO = '11111111-1111-4111-8111-111111111111'

const pass = (key: string, label: string): ContentReadinessCheck => ({ key, state: 'pass', label, detail: null })

function state(overrides: Partial<AdminContentPreviewPublish> = {}): AdminContentPreviewPublish {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', first_published_at: null, archived_at: null, title: TITLE },
    type: { label: 'Technical Article', public_enabled: false, hero_required: false, requires_download_file: false },
    default_locale: 'en',
    site_locales: ['en', 'es', 'pt'],
    published_locales: ['en'],
    locale: 'en',
    locales: [
      { locale: 'en', started: true, state: 'draft', draft_revision: 4, published_revision: null, published_at: null, first_published_at: null },
      { locale: 'es', started: true, state: 'draft', draft_revision: 2, published_revision: null, published_at: null, first_published_at: null },
      { locale: 'pt', started: false, state: 'not_started', draft_revision: null, published_revision: null, published_at: null, first_published_at: null },
    ],
    preview: {
      title: TITLE,
      slug: 'test-only-cc-imp-06',
      summary: 'TEST ONLY summary',
      blocks: [
        { id: 'a', type: 'text', data: { heading: 'TEST ONLY intro', paragraphs: ['<script>alert(1)</script> TEST ONLY paragraph', ''] } },
        { id: 'b', type: 'faq', data: { items: [{ question: 'TEST ONLY question?', answer: 'TEST ONLY answer.' }] } },
        { id: 'c', type: 'cta', data: { label: 'Contact us', href: 'https://example.com/contact' } },
        { id: 'd', type: 'widget', data: { anything: true } },
      ],
      seo: { title: TITLE, title_source: 'fallback', description: 'TEST ONLY meta', description_source: 'seo', canonical_path: null, noindex: false },
      hero: {
        link_id: 1, role: 'hero', directus_files_id: HERO, alt: 'TEST ONLY hero', caption: null, enabled: true, language: null, version_label: null, file_date: null, missing: false,
        file: { filename_download: 'hero.png', title: null, type: 'image/png', width: 1600, height: 900, is_public: false, archived: false },
      },
      og_image: null,
      inline: [],
      downloads: [],
      relations: [],
    },
    readiness: {
      locale: 'en',
      ready: false,
      hard: [
        pass('title', 'Title is present'),
        { key: 'media_public', state: 'fail', label: 'Some media cannot be published', detail: 'Hero image “hero.png” is not public in the Media Library.' },
        { key: 'type_public', state: 'fail', label: 'This content type is not enabled for public delivery yet.', detail: 'Publishing stays blocked.' },
      ],
      soft: [{ key: 'seo_title', state: 'warn', label: 'SEO title missing', detail: 'The title is used instead.' }, pass('noindex', 'Indexing allowed')],
    },
    publication: { has_snapshot: false, published_revision: null, published_at: null, first_published_at: null, unpublished_changes: false },
    can_unpublish: false,
    ...overrides,
  }
}

function readyState(overrides: Partial<AdminContentPreviewPublish> = {}): AdminContentPreviewPublish {
  const base = state()
  return state({ readiness: { ...base.readiness, ready: true, hard: [pass('title', 'Title is present')] }, ...overrides })
}

function mountPanel(initial = state()) {
  return mount(ContentPreviewPublish, {
    props: { initial },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    attachTo: document.body,
  })
}

const apiError = (statusCode: number, message: string, data: Record<string, unknown>) =>
  Object.assign(new Error('fetch failed'), { statusCode, data: { statusCode, message, data } })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('ContentPreviewPublish — Draft preview and readiness', () => {
  it('marks the preview as a Draft that is not public and renders stored text as plain text', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.cpp-banner').text()).toBe('Draft preview · Not public')
    expect(wrapper.find('.cpp-page-title').text()).toBe(TITLE)
    expect(wrapper.text()).toContain('<script>alert(1)</script> TEST ONLY paragraph')
    expect(document.querySelectorAll('.cpp-page script')).toHaveLength(0)
    expect(wrapper.text()).toContain('Empty paragraph')
    expect(wrapper.find('details summary').text()).toBe('TEST ONLY question?')
    expect(wrapper.text()).toContain('Unsupported section (widget) — not rendered.')
    expect(wrapper.find('.cpp-media-status').text()).toBe('Hero image: Not public')
  })

  it('never follows the call to action from the preview', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.cbr-cta-button--inert').text()).toBe('Contact us')
    expect(wrapper.findAll('.cpp-page a').some(a => a.attributes('href')?.includes('example.com'))).toBe(false)
    expect(wrapper.find('.cbr-cta-href').text()).toContain('not followed in preview')
  })

  it('shows hard and soft results without scores, percentages or out-of-scope workflows', () => {
    const wrapper = mountPanel()
    const badges = wrapper.findAll('.cpp-check-badge').map(b => b.text())
    expect(badges).toEqual(['Pass', 'Blocker', 'Blocker', 'Warning', 'Pass'])
    expect(wrapper.find('.cpp-headline').text()).toBe('Blocked')
    expect(wrapper.text()).toMatch(/2\s*blockers\s*·\s*1\s*warning/)
    expect(wrapper.text()).not.toMatch(/%|score|confidence|legal|brand|QR|share|distribution/i)
  })

  it('blocks Publish with a clear reason and offers no Unpublish when nothing is published', () => {
    const wrapper = mountPanel()
    const button = wrapper.find('.cpp-publish')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.cpp-blocked').text()).toContain('Some media cannot be published (+1 more)')
    expect(wrapper.find('.cpp-unpublish').exists()).toBe(false)
    expect(wrapper.emitted('status')!.at(-1)![0]).toMatchObject({ enabled: false, label: 'Publish English' })
  })

  it('a language that was not started shows no other language in its place', () => {
    const base = state()
    const wrapper = mountPanel(state({
      locale: 'pt',
      preview: null,
      readiness: { locale: 'pt', ready: false, hard: [{ key: 'locale_started', state: 'fail', label: 'Portuguese has not been started', detail: null }], soft: [] },
      locales: base.locales,
    }))
    expect(wrapper.find('.cpp-empty').text()).toContain('Portuguese has not been started')
    expect(wrapper.find('.cpp-page').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('TEST ONLY intro')
    expect(wrapper.find('.cpp-empty a').attributes('href')).toBe('/admin/content-center/6/seo-locales?locale=pt')
  })

  it('switches language through the server and reports it for the URL', async () => {
    const es = state({ locale: 'es', preview: { ...state().preview!, title: 'TEST ONLY ES' } })
    const fetchMock = vi.fn(async () => es)
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountPanel()
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/preview-publish', { query: { locale: 'es' } })
    expect(wrapper.emitted('locale')!.at(-1)).toEqual(['es'])
    expect(wrapper.find('.cpp-page-title').text()).toBe('TEST ONLY ES')
  })
})

describe('ContentPreviewPublish — manual actions', () => {
  it('publishes only after confirmation, sending just the loaded draft revision', async () => {
    const published = readyState({ item: { ...state().item, status: 'published', first_published_at: '2026-09-15T10:00:00Z' }, publication: { has_snapshot: true, published_revision: 4, published_at: '2026-09-15T10:00:00Z', first_published_at: '2026-09-15T10:00:00Z', unpublished_changes: false }, can_unpublish: true })
    const fetchMock = vi.fn(async () => ({ result: 'published', state: published }))
    vi.stubGlobal('$fetch', fetchMock)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const wrapper = mountPanel(readyState())

    await wrapper.find('.cpp-publish').trigger('click')
    expect(fetchMock).not.toHaveBeenCalled()

    await wrapper.find('.cpp-publish').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/locales/en/publish', { method: 'POST', body: { expectedDraftRevision: 4 } })
    expect(wrapper.find('.cpp-notice--success').text()).toBe('English was published.')
    expect(wrapper.find('.cpp-publish').text()).toBe('Published')
    expect(wrapper.find('.cpp-unpublish').exists()).toBe(true)
  })

  it('a stale draft shows a conflict with Reload; a refused publish reloads the server readiness', async () => {
    const reloaded = state()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(apiError(409, 'changed', { code: 'changed_since_review', currentDraftRevision: 5 }))
      .mockRejectedValueOnce(apiError(422, 'not ready', { code: 'not_ready', blockers: [] }))
      .mockResolvedValueOnce(reloaded)
    vi.stubGlobal('$fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountPanel(readyState())

    await wrapper.find('.cpp-publish').trigger('click')
    await flushPromises()
    expect(wrapper.find('.cpp-notice--error').text()).toContain('This draft changed since the page was loaded')
    expect(wrapper.find('.cpp-notice button').text()).toBe('Reload')

    await wrapper.find('.cpp-publish').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/content-center/6/preview-publish', { query: { locale: 'en' } })
    expect(wrapper.find('.cpp-notice--error').text()).toContain('readiness checks failed')
    expect(wrapper.find('.cpp-publish').attributes('disabled')).toBeDefined()
  })

  it('unpublishes only after confirmation, with an empty body', async () => {
    const published = readyState({ item: { ...state().item, status: 'published', first_published_at: '2026-09-15T10:00:00Z' }, publication: { has_snapshot: true, published_revision: 4, published_at: '2026-09-15T10:00:00Z', first_published_at: '2026-09-15T10:00:00Z', unpublished_changes: false }, can_unpublish: true })
    const fetchMock = vi.fn(async () => ({ result: 'unpublished', state: readyState() }))
    vi.stubGlobal('$fetch', fetchMock)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountPanel(published)
    expect(wrapper.find('.cpp-card-hint').exists()).toBe(true)
    expect(wrapper.text()).toContain('Unpublishing English unpublishes every language')

    await wrapper.find('.cpp-unpublish').trigger('click')
    await flushPromises()
    expect(String(confirm.mock.calls[0][0])).toContain('Every language of this content is unpublished')
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/locales/en/unpublish', { method: 'POST', body: {} })
    expect(wrapper.find('.cpp-notice--success').text()).toBe('All languages were unpublished. The content is a Draft again.')
    expect(wrapper.find('.cpp-unpublish').exists()).toBe(false)
  })
})

describe('ContentBlocksRenderer — outside preview mode', () => {
  it('skips empty text and unknown sections silently and only links safe call-to-action targets', () => {
    const wrapper = mount(ContentBlocksRenderer, {
      props: {
        blocks: [
          { id: 'a', type: 'text', data: { paragraphs: ['', 'Visible'] } },
          { id: 'b', type: 'widget', data: {} },
          { id: 'c', type: 'cta', data: { label: 'Go', href: 'javascript:alert(1)' } },
          { id: 'd', type: 'cta', data: { label: 'Contact', href: '/contact' } },
          null,
        ],
      },
    })
    expect(wrapper.findAll('p.cbr-paragraph').map(p => p.text())).toEqual(['Visible'])
    expect(wrapper.text()).not.toMatch(/Unsupported|Empty/)
    expect(wrapper.findAll('a').map(a => a.attributes('href'))).toEqual(['/contact'])
  })
})
