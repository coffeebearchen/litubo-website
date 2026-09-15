// @vitest-environment happy-dom
/**
 * CC-IMP-05 — the CC-03 Content Editor on a non-default language: it saves that
 * language's row only, shows a safe state for a language that has not been
 * started (never creating it), and keeps a published language's slug locked.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentEditor from '../../components/admin/content/ContentEditor.vue'
import type { AdminContentDraft, AdminContentLocaleDraft } from '../../types/content-center'

function row(overrides: Partial<AdminContentLocaleDraft>): AdminContentLocaleDraft {
  return {
    id: 13, content_items_id: 5, locale: 'en', title: 'TEST ONLY EN', slug: 'test-only-en', summary: 'EN summary', blocks: [],
    seo_title: null, seo_description: null, canonical_path: null, noindex: false,
    draft_revision: 4, published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit',
    ...overrides,
  }
}

function draft(locales: AdminContentLocaleDraft[]): AdminContentDraft {
  return {
    id: 5, content_type: 'technical_article', status: 'draft', first_published_at: null, archived_at: null,
    date_created: '2026-09-15T00:00:00Z', date_updated: null, locales,
  }
}

const both = () => draft([row({}), row({ id: 14, locale: 'es', title: 'TEST ONLY ES', slug: 'test-only-es', summary: null, draft_revision: 2 })])

function mountEditor(value: AdminContentDraft, locale: 'en' | 'es' | 'pt') {
  return mount(ContentEditor, {
    props: { draft: value, locale },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    attachTo: document.body,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentEditor — language', () => {
  it('edits the Spanish draft and saves only to the Spanish locale row with its own revision', async () => {
    const fetchMock = vi.fn(async () => draft([row({}), row({ id: 14, locale: 'es', title: 'TEST ONLY ES edited', slug: 'test-only-es', summary: null, draft_revision: 3 })]))
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountEditor(both(), 'es')
    expect((w.find('#cce-title').element as HTMLInputElement).value).toBe('TEST ONLY ES')
    expect(w.text()).toContain('Spanish draft · revision 2')
    await w.find('#cce-title').setValue('TEST ONLY ES edited')
    await w.find('.cce-save').trigger('click')
    await flushPromises()
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, { method: string, body: Record<string, unknown> }]
    expect(url).toBe('/api/admin/content-center/5/locales/es')
    expect(options).toEqual({ method: 'PATCH', body: { expectedDraftRevision: 2, title: 'TEST ONLY ES edited' } })
    expect(w.text()).toContain('Spanish draft · revision 3')
  })

  it('a language without a draft shows Not started and links to SEO & locales; nothing is requested', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountEditor(both(), 'pt')
    expect(w.find('.cce-notice').text()).toContain('Portuguese has not been started')
    expect(w.find('.cce-notice').text()).toContain('none is created here')
    expect(w.find('.cce-notice a').attributes('href')).toBe('/admin/content-center/5/seo-locales?locale=pt')
    expect(w.find('#cce-title').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a published language keeps its slug locked while other fields stay editable', async () => {
    const w = mountEditor(draft([row({ first_published_at: '2026-09-15T01:00:00Z', published_revision: 4 })]), 'en')
    expect(w.find('#cce-slug').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Locked — this language has been published.')
    expect(w.find('#cce-title').attributes('disabled')).toBeUndefined()
  })
})
