// @vitest-environment happy-dom
/**
 * CC-IMP-08 — CC-AI-01 AI Source Intake panel, mounted, with `$fetch` stubbed:
 * already-linked sources with their real roles, browser-local selection with the
 * 5-source / 3-image limits, empty / not-started / archived states, the one
 * explicit Analyze request, and a prepared state without any review or apply
 * control. Nothing here links, unlinks or uploads a file.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentAiSourceIntake from '../../components/admin/content/ContentAiSourceIntake.vue'
import type { AdminContentAiSource, AdminContentAiSourceIntake } from '../../types/content-center'

const source = (n: number, extra: Partial<AdminContentAiSource> = {}): AdminContentAiSource => ({
  sourceRef: `ref-${n}`,
  displayName: `TEST ONLY source ${n}.txt`,
  typeLabel: 'Text',
  role: 'source_document',
  roleLabel: 'Source document',
  analyzable: true,
  unavailableReason: null,
  isImage: false,
  ...extra,
})

function intake(extra: Partial<AdminContentAiSourceIntake> = {}): AdminContentAiSourceIntake {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', title: 'TEST ONLY — NOT FOR PUBLICATION Guide' },
    locale: 'en',
    default_locale: 'en',
    site_locales: ['en', 'es', 'pt'],
    started_locales: ['en', 'es'],
    locale_started: true,
    draft_revision: 3,
    sources: [
      source(1),
      source(2, { displayName: 'TEST ONLY brochure.pdf', typeLabel: 'PDF', role: 'download', roleLabel: 'Download' }),
      source(3, { displayName: 'TEST ONLY label.png', typeLabel: 'Image', role: 'inline', roleLabel: 'Inline media', isImage: true }),
      source(4, { displayName: 'TEST ONLY archived.txt', analyzable: false, unavailableReason: 'This file is archived in the Media Library, so it cannot be analyzed.' }),
    ],
    limits: { max_files: 5, max_images: 3 },
    ...extra,
  }
}

const PROVIDERS = [{ id: 'deepseek', label: 'DeepSeek', configured: true, isDefault: true }]

function mountIntake(value = intake()) {
  return mount(ContentAiSourceIntake, {
    props: { intake: value, providers: PROVIDERS, providersError: false },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof mountIntake>
const checkbox = (w: Wrapper, name: string) => w.findAll('.cai-source').find(li => li.text().includes(name))!.find('input[type="checkbox"]')
const analyzeButton = (w: Wrapper) => w.findAll('button').find(b => /Analyze/.test(b.text()))!

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentAiSourceIntake — already-linked sources', () => {
  it('lists linked sources with their real role and readability, and offers no link / upload / review control', () => {
    const w = mountIntake()
    const rows = w.findAll('.cai-source').map(li => li.text())
    expect(rows[0]).toContain('Source document')
    expect(rows[1]).toContain('Download')
    expect(rows[2]).toContain('Inline media')
    expect(rows[3]).toContain('Unavailable')
    expect(rows[3]).toContain('archived in the Media Library')
    expect(w.text()).toContain('Links are added or removed in Media & Relations.')
    expect(w.text()).toContain('Selecting a source never calls an AI model or writes anything.')
    expect(w.text()).toContain('Only clicking "Analyze selected sources" sends text extracted from the selected sources to the configured AI provider.')
    expect(w.text()).toContain('Up to 5 sources and 3 images per analysis.')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    const buttons = w.findAll('button').map(b => b.text())
    expect(buttons.some(t => /Add source|Remove|Upload|Accept|Reject|Apply|Edit/.test(t))).toBe(false)
    expect(checkbox(w, 'archived').attributes('disabled')).toBeDefined()
  })

  it('selecting and clearing sources is browser-local: the count changes and no request is issued', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountIntake()
    expect(w.find('.cai-count').text()).toBe('0 / 5 selected')
    expect(analyzeButton(w).attributes('disabled')).toBeDefined()
    await checkbox(w, 'source 1').setValue(true)
    await checkbox(w, 'brochure').setValue(true)
    expect(w.find('.cai-count').text()).toBe('2 / 5 selected')
    expect(w.text()).toContain('Original files are not sent to the AI provider. Nothing will be written or published.')
    expect(analyzeButton(w).attributes('disabled')).toBeUndefined()
    await checkbox(w, 'source 1').setValue(false)
    expect(w.find('.cai-count').text()).toBe('1 / 5 selected')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('enforces the 5-source and 3-image limits in the browser', async () => {
    const sources = [
      ...[1, 2, 3, 4, 5, 6].map(n => source(n)),
      ...[7, 8, 9, 10].map(n => source(n, { displayName: `TEST ONLY image ${n}.png`, isImage: true, typeLabel: 'Image', role: 'inline', roleLabel: 'Inline media' })),
    ]
    const w = mountIntake(intake({ sources }))
    for (const n of [1, 2, 3, 4, 5]) await checkbox(w, `source ${n}.txt`).setValue(true)
    expect(w.find('.cai-count').text()).toBe('5 / 5 selected')
    expect(checkbox(w, 'source 6.txt').attributes('disabled')).toBeDefined()

    const images = mountIntake(intake({ sources }))
    for (const n of [7, 8, 9]) await checkbox(images, `image ${n}.png`).setValue(true)
    expect(images.text()).toContain('The image limit is reached')
    expect(checkbox(images, 'image 10.png').attributes('disabled')).toBeDefined()
    expect(checkbox(images, 'source 1.txt').attributes('disabled')).toBeUndefined()
  })
})

describe('ContentAiSourceIntake — states', () => {
  it('without readable linked sources it points to Media & Relations and cannot analyze', () => {
    const w = mountIntake(intake({ sources: [source(4, { analyzable: false, unavailableReason: 'This file type is not supported for source analysis.' })] }))
    expect(w.text()).toContain('No AI-readable linked sources.')
    expect(w.find('.cai-empty a').attributes('href')).toBe('/admin/content-center/6/media-relations')
    expect(w.find('.cai-empty a').text()).toBe('Manage files in Media & Relations')
    expect(analyzeButton(w).attributes('disabled')).toBeDefined()
  })

  it('a language that has not been started is not created and not replaced by English', () => {
    const w = mountIntake(intake({ locale: 'pt', locale_started: false, draft_revision: null, sources: [] }))
    expect(w.text()).toContain('This language has not been started yet. Go to SEO & locales to start it.')
    expect(w.find('a[href="/admin/content-center/6/seo-locales?locale=pt"]').exists()).toBe(true)
    expect(w.findAll('button').some(b => /Analyze/.test(b.text()))).toBe(false)
  })

  it('an archived item is read-only: no selection and no Analyze', () => {
    const w = mountIntake(intake({ item: { id: 6, content_type: 'technical_article', status: 'archived', title: 'TEST ONLY archived' } }))
    expect(w.text()).toContain('This content item is archived.')
    expect(checkbox(w, 'source 1').attributes('disabled')).toBeDefined()
    expect(analyzeButton(w).attributes('disabled')).toBeDefined()
  })

  it('switching language asks the page to reload that locale and issues no request itself', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountIntake()
    const spanish = w.findAll('.cai-locale').find(b => b.text().startsWith('Spanish'))!
    await spanish.trigger('click')
    expect(w.emitted('locale')).toEqual([['es']])
    expect(w.findAll('.cai-locale').find(b => b.text().startsWith('Portuguese'))!.text()).toContain('Not started')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ContentAiSourceIntake — Analyze', () => {
  it('one explicit Analyze sends one POST with the locale, provider and selected refs, and shows a prepared proposal without review controls', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, proposalRef: 'opaque', reused: false, alreadyApplied: false, item_count: 4, conflict_count: 1, draft_revision: 3,
      fileResults: [{ displayName: 'TEST ONLY source 1.txt', status: 'read' }],
    }))
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountIntake()
    await checkbox(w, 'source 1').setValue(true)
    await checkbox(w, 'label.png').setValue(true)
    await analyzeButton(w).trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/ai-source-intake', {
      method: 'POST',
      body: { locale: 'en', providerId: 'deepseek', sourceRefs: ['ref-1', 'ref-3'] },
    })
    const prepared = w.find('.cai-prepared')
    expect(prepared.text()).toContain('Proposal prepared')
    expect(prepared.text()).toContain('4 suggested change(s) and 1 conflict(s)')
    expect(prepared.text()).toContain('Nothing was written to the draft.')
    expect(prepared.text()).toContain('Proposal Review is not available yet')
    expect(w.findAll('button').map(b => b.text()).some(t => /Accept|Reject|Apply|Edit/.test(t))).toBe(false)
  })

  it('a refused analysis shows the server sentence and which files were not read', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({
      ok: false,
      error: 'None of the selected files could be read as text. Nothing was sent to the AI provider.',
      fileResults: [{ displayName: 'TEST ONLY source 1.txt', status: 'unreadable', reason: 'No extractable text was found in this file.' }],
    })))
    const w = mountIntake()
    await checkbox(w, 'source 1').setValue(true)
    await analyzeButton(w).trigger('click')
    await flushPromises()
    expect(w.find('.cai-error').text()).toContain('Nothing was sent to the AI provider.')
    expect(w.find('.cai-file-results').text()).toContain('No extractable text was found in this file.')
    expect(w.find('.cai-prepared').exists()).toBe(false)
  })
})
