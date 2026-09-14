// @vitest-environment happy-dom
/**
 * CC-IMP-03 — Content Editor, mounted, with `$fetch` stubbed: fields, dirty
 * tracking, block add / edit / remove / reorder, outline, one-PATCH save,
 * stale 409 conflict, validation errors, limits and preserved future blocks.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentEditor from '../../components/admin/content/ContentEditor.vue'
import type { AdminContentDraft, AdminContentLocaleDraft } from '../../types/content-center'
import type { ContentBlock } from '../../utils/contentBlocks'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION Editor'
const ID = {
  text: '11111111-1111-4111-8111-111111111111',
  keyPoints: '22222222-2222-4222-8222-222222222222',
  faq: '33333333-3333-4333-8333-333333333333',
  cta: '44444444-4444-4444-8444-444444444444',
  related: '55555555-5555-4555-8555-555555555555',
}

function blocks(): ContentBlock[] {
  return [
    { id: ID.text, type: 'text', data: { heading: 'Introduction', paragraphs: ['First paragraph'] } },
    { id: ID.keyPoints, type: 'key_points', data: { items: [{ title: 'Fast' }] } },
    { id: ID.faq, type: 'faq', data: { items: [{ question: 'Why?', answer: 'Because.' }] } },
    { id: ID.cta, type: 'cta', data: { label: 'Contact', href: '/contact' } },
    { id: ID.related, type: 'related_content', data: { heading: 'Related' } },
  ]
}

function locale(overrides: Partial<AdminContentLocaleDraft> = {}): AdminContentLocaleDraft {
  return {
    id: 13, content_items_id: 5, locale: 'en', title: TEST_TITLE, slug: 'test-only-editor', summary: 'Summary',
    blocks: blocks(), seo_title: null, seo_description: null, canonical_path: null, noindex: false,
    draft_revision: 4, published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit',
    ...overrides,
  }
}

function draft(en: Partial<AdminContentLocaleDraft> = {}, extra: Partial<AdminContentDraft> = {}): AdminContentDraft {
  return {
    id: 5, content_type: 'technical_article', status: 'draft', first_published_at: null, archived_at: null,
    date_created: '2026-09-14T16:25:00Z', date_updated: '2026-09-15T00:30:00Z',
    locales: [locale(en), locale({ id: 14, locale: 'es', title: 'ES draft', slug: 'test-only-editor-es', draft_revision: 1 })],
    ...extra,
  }
}

let idCounter = 0
const newId = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++idCounter).padStart(12, '0')}`

function mountEditor(value: AdminContentDraft = draft()) {
  return mount(ContentEditor, {
    props: { draft: value, newId },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    attachTo: document.body,
  })
}

type Editor = ReturnType<typeof mountEditor>
const saveButton = (w: Editor) => w.find('.cce-save')
const outlineLabels = (w: Editor) => w.findAll('.cco-label').map(e => e.text())
const lastStatus = (w: Editor) => (w.emitted('status') ?? []).at(-1)?.[0] as { dirty: boolean, revision: number }

async function expand(w: Editor, id: string) {
  await w.find(`#ccb-${id} button[aria-expanded]`).trigger('click')
}

const apiError = (statusCode: number, message?: string, data?: Record<string, unknown>) =>
  Object.assign(new Error('fetch failed'), { statusCode, data: { statusCode, message, data } })

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentEditor — fields and dirty state', () => {
  it('renders the default-locale draft with a read-only content type and a derived outline', () => {
    const w = mountEditor()
    expect((w.find('#cce-title').element as HTMLInputElement).value).toBe(TEST_TITLE)
    expect((w.find('#cce-slug').element as HTMLInputElement).value).toBe('test-only-editor')
    expect((w.find('#cce-summary').element as HTMLTextAreaElement).value).toBe('Summary')
    expect(w.find('.cce-readonly').text()).toBe('Technical Article')
    expect(w.findAll('select')).toHaveLength(0)
    expect(w.findAll('section.ccb')).toHaveLength(5)
    expect(outlineLabels(w)).toEqual(['Introduction', 'Fast', 'Why?', 'Contact', 'Related'])
    expect(w.text()).toContain('revision 4')
    expect(w.text()).not.toMatch(/Publish|AI suggestions|Reading time|%/)
  })

  it('is clean on load — no save bar, Save not possible — and becomes dirty on edit', async () => {
    const w = mountEditor()
    expect(saveButton(w).exists()).toBe(false)
    expect(lastStatus(w).dirty).toBe(false)
    expect((w.vm as unknown as { canSave: boolean }).canSave).toBe(false)
    await w.find('#cce-title').setValue(`${TEST_TITLE} v2`)
    expect(lastStatus(w).dirty).toBe(true)
    expect(saveButton(w).attributes('disabled')).toBeUndefined()
    expect(w.find('.cce-savebar-status').text()).toBe('Unsaved changes')
    await w.find('#cce-title').setValue(TEST_TITLE)
    expect(lastStatus(w).dirty).toBe(false)
  })
})

describe('ContentEditor — sections', () => {
  it('adds only editable types, with a UUID, and lists media/relation types as unavailable', async () => {
    const w = mountEditor()
    await w.find('.cce-add').trigger('click')
    const options = w.findAll('.cce-add-option')
    expect(options.filter(o => o.attributes('disabled') === undefined).map(o => o.text())).toEqual(['Text', 'Key points', 'FAQ', 'Call to action'])
    const disabled = options.filter(o => o.attributes('disabled') !== undefined)
    expect(disabled.map(o => o.text())).toEqual([
      'Image Available in Media & relations', 'Related content Available in Media & relations', 'Downloads Available in Media & relations',
    ])
    await options.find(o => o.text() === 'FAQ')!.trigger('click')
    expect(w.findAll('section.ccb')).toHaveLength(6)
    expect(w.find('#ccb-aaaaaaaa-aaaa-4aaa-8aaa-000000000001').exists()).toBe(true)
    expect(outlineLabels(w).at(-1)).toBe('FAQ')
    expect(lastStatus(w).dirty).toBe(true)
  })

  it('edits paragraphs, key points, FAQ and CTA fields', async () => {
    const w = mountEditor()
    for (const id of [ID.text, ID.keyPoints, ID.faq, ID.cta]) await expand(w, id)
    await w.find(`#ccb-${ID.text}-p0`).setValue('Edited paragraph')
    await w.findAll(`#ccb-${ID.text} .ccb-add`)[0].trigger('click')
    await w.find(`#ccb-${ID.text}-p1`).setValue('Second paragraph')
    await w.find(`#ccb-${ID.keyPoints}-kp0-title`).setValue('Faster')
    await w.find(`#ccb-${ID.faq}-faq0-a`).setValue('Because it works.')
    await w.find(`#ccb-${ID.cta}-cta-href`).setValue('https://example.com/contact')
    expect(outlineLabels(w).slice(0, 2)).toEqual(['Introduction', 'Faster'])
    const fetchMock = vi.fn(async () => draft())
    vi.stubGlobal('$fetch', fetchMock)
    await saveButton(w).trigger('click')
    await flushPromises()
    const body = (fetchMock.mock.calls[0] as unknown as [string, { body: { blocks: ContentBlock[] } }])[1].body
    expect(body.blocks[0].data).toEqual({ heading: 'Introduction', paragraphs: ['Edited paragraph', 'Second paragraph'] })
    expect(body.blocks[1].data).toEqual({ items: [{ title: 'Faster' }] })
    expect(body.blocks[2].data).toEqual({ items: [{ question: 'Why?', answer: 'Because it works.' }] })
    expect(body.blocks[3].data).toEqual({ label: 'Contact', href: 'https://example.com/contact' })
  })

  it('keeps every change when several edits to one section happen before a re-render', async () => {
    const w = mountEditor()
    await expand(w, ID.faq)
    await expand(w, ID.text)
    const fire = (selector: string, value: string) => {
      const el = w.find(selector).element as HTMLInputElement
      el.value = value
      el.dispatchEvent(new Event('input'))
    }
    // No await between these: all four land in the same tick.
    fire(`#ccb-${ID.text}-heading`, 'New heading')
    fire(`#ccb-${ID.text}-p0`, 'New paragraph')
    fire(`#ccb-${ID.faq}-faq0-q`, 'New question?')
    fire(`#ccb-${ID.faq}-faq0-a`, 'New answer.')
    const fetchMock = vi.fn(async () => draft())
    vi.stubGlobal('$fetch', fetchMock)
    await flushPromises()
    await saveButton(w).trigger('click')
    await flushPromises()
    const body = (fetchMock.mock.calls[0] as unknown as [string, { body: { blocks: ContentBlock[] } }])[1].body
    expect(body.blocks[0].data).toEqual({ heading: 'New heading', paragraphs: ['New paragraph'] })
    expect(body.blocks[2].data).toEqual({ items: [{ question: 'New question?', answer: 'New answer.' }] })
  })

  it('removes a section only after confirmation; future-managed sections cannot be removed', async () => {
    const w = mountEditor()
    expect(w.find(`#ccb-${ID.related} .ccb-btn--danger`).exists()).toBe(false)
    await w.find(`#ccb-${ID.faq} .ccb-btn--danger`).trigger('click')
    expect(w.findAll('section.ccb')).toHaveLength(5)
    expect(w.find(`#ccb-${ID.faq} .ccb-confirm`).text()).toContain('Remove this FAQ section?')
    await w.findAll(`#ccb-${ID.faq} .ccb-confirm button`).find(b => b.text() === 'Cancel')!.trigger('click')
    expect(w.findAll('section.ccb')).toHaveLength(5)
    await w.find(`#ccb-${ID.faq} .ccb-btn--danger`).trigger('click')
    await w.findAll(`#ccb-${ID.faq} .ccb-confirm button`).find(b => b.text() === 'Remove section')!.trigger('click')
    expect(w.findAll('section.ccb')).toHaveLength(4)
    expect(outlineLabels(w)).toEqual(['Introduction', 'Fast', 'Contact', 'Related'])
  })

  it('reorders with accessible move buttons, and the outline follows', async () => {
    const w = mountEditor()
    await w.find(`#ccb-${ID.cta} button[aria-label="Move Call to action section 4 up"]`).trigger('click')
    expect(outlineLabels(w)).toEqual(['Introduction', 'Fast', 'Contact', 'Why?', 'Related'])
    expect(w.find(`#ccb-${ID.text} button[aria-label^="Move Text section 1 up"]`).attributes('disabled')).toBeDefined()
    await w.find(`#ccb-${ID.related} button[aria-label="Move Related content section 5 up"]`).trigger('click')
    expect(outlineLabels(w)).toEqual(['Introduction', 'Fast', 'Contact', 'Related', 'Why?'])
  })

  it('selecting an outline entry opens that section', async () => {
    const w = mountEditor()
    expect(w.find(`#ccb-${ID.faq}-body`).exists()).toBe(false)
    await w.findAll('.cco-item')[2].trigger('click')
    await flushPromises()
    expect(w.find(`#ccb-${ID.faq}-body`).exists()).toBe(true)
  })

  it('prevents a 61st section', async () => {
    const sixty = Array.from({ length: 60 }, (_, i) => ({ id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`, type: 'text' as const, data: { paragraphs: [''] } }))
    const w = mountEditor(draft({ blocks: sixty }))
    expect(w.find('.cce-add').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('A draft can have at most 60 sections.')
  })
})

describe('ContentEditor — save contract', () => {
  it('one Save sends one PATCH with expectedDraftRevision and only the changed fields', async () => {
    const saved = draft({ title: `${TEST_TITLE} v2`, summary: 'New summary', draft_revision: 5 }, { date_updated: '2026-09-15T08:00:00Z' })
    const fetchMock = vi.fn(async () => saved)
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountEditor()
    await w.find('#cce-title').setValue(`${TEST_TITLE} v2`)
    await w.find('#cce-summary').setValue('New summary')
    await w.find(`#ccb-${ID.cta} button[aria-label="Move Call to action section 4 up"]`).trigger('click')
    await saveButton(w).trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, { method: string, body: Record<string, unknown> }]
    expect(url).toBe('/api/admin/content-center/5/locales/en')
    expect(options.method).toBe('PATCH')
    expect(Object.keys(options.body).sort()).toEqual(['blocks', 'expectedDraftRevision', 'summary', 'title'])
    expect(options.body.expectedDraftRevision).toBe(4)
    expect((options.body.blocks as ContentBlock[]).map(b => b.id)).toEqual([ID.text, ID.keyPoints, ID.cta, ID.faq, ID.related])
    expect(JSON.stringify(options.body)).not.toMatch(/status|published|content_type|seo_|noindex|"locale"/)

    expect(w.emitted('saved')).toHaveLength(1)
    expect(lastStatus(w)).toMatchObject({ dirty: false, revision: 5 })
    expect(w.text()).toContain('revision 5')
    expect(w.find('.cce-savebar-status').text()).toBe('Saved')
  })

  it('preserves future-managed blocks and other locales when saving other fields', async () => {
    const fetchMock = vi.fn(async () => draft())
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountEditor()
    await expand(w, ID.text)
    await w.find(`#ccb-${ID.text}-p0`).setValue('Changed')
    await saveButton(w).trigger('click')
    await flushPromises()
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, { body: { blocks: ContentBlock[] } }]
    expect(url.endsWith('/locales/en')).toBe(true)
    expect(options.body.blocks[4]).toEqual({ id: ID.related, type: 'related_content', data: { heading: 'Related' } })
  })

  it('a stale 409 keeps local edits, shows the conflict and never retries or reloads by itself', async () => {
    const fetchMock = vi.fn(async () => { throw apiError(409, 'This draft was changed since it was loaded. Reload it before saving.', { currentDraftRevision: 5 }) })
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountEditor()
    await w.find('#cce-title').setValue('My local unsaved title')
    await saveButton(w).trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const alert = w.find('.cce-conflict')
    expect(alert.text()).toContain('This draft changed since you opened it.')
    expect(alert.text()).toContain('revision 5')
    expect((w.find('#cce-title').element as HTMLInputElement).value).toBe('My local unsaved title')
    expect(lastStatus(w)).toMatchObject({ dirty: true, revision: 4 })

    await alert.findAll('button').find(b => b.text() === 'Reload latest')!.trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(w.find('.cce-conflict').text()).toContain('discards your unsaved changes')

    const latest = draft({ title: 'Saved elsewhere', draft_revision: 5 })
    const reloadMock = vi.fn(async () => latest)
    vi.stubGlobal('$fetch', reloadMock)
    await w.find('.cce-conflict').findAll('button').find(b => b.text() === 'Discard my changes and reload')!.trigger('click')
    await flushPromises()
    expect(reloadMock).toHaveBeenCalledWith('/api/admin/content-center/5')
    expect((w.find('#cce-title').element as HTMLInputElement).value).toBe('Saved elsewhere')
    expect(w.find('.cce-conflict').exists()).toBe(false)
    expect(lastStatus(w)).toMatchObject({ dirty: false, revision: 5 })
  })

  it('Keep editing dismisses the conflict notice without touching local edits', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(409, 'stale', { currentDraftRevision: 5 }) }))
    const w = mountEditor()
    await w.find('#cce-summary').setValue('Local summary')
    await saveButton(w).trigger('click')
    await flushPromises()
    await w.find('.cce-conflict').findAll('button').find(b => b.text() === 'Keep editing')!.trigger('click')
    expect(w.find('.cce-conflict').exists()).toBe(false)
    expect((w.find('#cce-summary').element as HTMLTextAreaElement).value).toBe('Local summary')
    expect(lastStatus(w).dirty).toBe(true)
  })

  it('shows slug and block validation errors where they belong', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(409, 'This slug is already used for this language.', { field: 'slug' }) }))
    const w = mountEditor()
    await w.find('#cce-slug').setValue('taken-slug')
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(w.find('#cce-slug-error').text()).toBe('This slug is already used for this language.')

    vi.stubGlobal('$fetch', vi.fn(async () => {
      throw apiError(422, 'blocks are not valid.', { field: 'blocks', errors: ['blocks[3].data.href: href must be empty, an internal path starting with "/", or an https:// URL'] })
    }))
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(w.find('.cce-error').text()).toContain('Some sections are not valid')
    expect(w.find(`#ccb-${ID.cta} .ccb-errors`).text()).toContain('href must be empty')
    expect(w.find(`#ccb-${ID.cta}-body`).exists()).toBe(true)
    expect(lastStatus(w).dirty).toBe(true)
  })

  it('an archived record is read-only', () => {
    const w = mountEditor(draft({}, { status: 'archived' }))
    expect(w.text()).toContain('archived and cannot be edited')
    expect(w.find('fieldset').attributes('disabled')).toBeDefined()
  })
})
