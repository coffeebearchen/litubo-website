// @vitest-environment happy-dom
/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — real component-mounting behavior tests
 * for `WorkspaceAiSourceIntake.vue`, using `@vue/test-utils` against the
 * actual mounted component (not `readFileSync` + string matching).
 *
 * The component now receives the AI-safe source DTO — an opaque `sourceRef`
 * plus already-sanitized display fields — so these tests double as the proof
 * that no Directus id, raw filename, caption or alt text is needed to render
 * this screen.
 */

import { describe, it, expect } from 'vitest'
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import WorkspaceAiSourceIntake from '../../components/admin/workspace/WorkspaceAiSourceIntake.vue'
import type { AiIntakeSource } from '../../utils/aiProposal'

function source(overrides: Partial<AiIntakeSource> & { sourceRef: string }): AiIntakeSource {
  return {
    displayName: 'notes.txt',
    typeLabel: 'Text',
    roleLabel: 'Role not set',
    analyzable: true,
    unavailableReason: null,
    ...overrides,
  }
}

const BASE_PROPS = {
  sources: [] as AiIntakeSource[],
  selectedRefs: [] as string[],
  mediaResourcesHref: '/admin/product-workspace/1/media-resources',
  providers: [{ id: 'deepseek', label: 'DeepSeek', configured: true, isDefault: true }],
  providersLoading: false,
  providersError: false,
  sourcesError: false,
  sourcesLoading: false,
  selectedProviderId: 'deepseek',
  analyzing: false,
  analyzeError: null,
  fileResults: [],
}

function mountIntake(props: ComponentMountingOptions<typeof WorkspaceAiSourceIntake>['props']) {
  return mount(WorkspaceAiSourceIntake, {
    props,
    global: { stubs: { NuxtLink: { template: '<a><slot/></a>' } } },
  })
}

describe('WorkspaceAiSourceIntake — real mounted component', () => {
  it('clicking an analyzable file\'s checkbox emits toggle with its opaque ref', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [source({ sourceRef: 'ref-abc' })] })
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('toggle')).toEqual([['ref-abc']])
  })

  it('a non-analyzable file\'s checkbox is really disabled in the DOM, with the server\'s reason shown', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({
        sourceRef: 'ref-img',
        displayName: 'photo.jpg',
        typeLabel: 'Image',
        analyzable: false,
        unavailableReason: 'Images are not supported for source analysis yet.',
      })],
    })
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Images are not supported for source analysis yet.')
  })

  it('renders whatever specific reason the server supplied, rather than deriving one in the browser', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({
        sourceRef: 'ref-xlsx',
        displayName: 'sheet.xlsx',
        typeLabel: 'Excel',
        analyzable: false,
        unavailableReason: 'Excel files are not supported for source analysis yet.',
      })],
    })
    expect(wrapper.text()).toContain('Excel files are not supported for source analysis yet.')
  })

  it('a disabled association shows the disabled reason and cannot be selected', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({
        sourceRef: 'ref-disabled',
        analyzable: false,
        unavailableReason: 'This file is disabled for this product, so it cannot be analyzed. Enable it in Media & resources first.',
      })],
    })
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('This file is disabled for this product')
  })

  it('shows the live "N / 5 selected" counter', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, selectedRefs: ['a', 'b'] })
    expect(wrapper.text()).toContain('2 / 5 selected')
  })

  it('once 5 files are selected, an unselected file\'s checkbox becomes disabled (cap enforced in the DOM)', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({ sourceRef: 'ref-6' })],
      selectedRefs: ['a', 'b', 'c', 'd', 'e'],
    })
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).disabled).toBe(true)
  })

  it('an already-selected file stays clickable (to deselect) even at the cap', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({ sourceRef: 'a' })],
      selectedRefs: ['a', 'b', 'c', 'd', 'e'],
    })
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).disabled).toBe(false)
  })

  it('clicking "Analyze selected sources" emits analyze — only when enabled', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [source({ sourceRef: 'a' })], selectedRefs: ['a'] })
    const button = wrapper.findAll('button').find(b => b.text().includes('Analyze selected sources'))!
    expect((button.element as HTMLButtonElement).disabled).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('analyze')).toHaveLength(1)
  })

  it('Analyze is really disabled in the DOM when no provider is configured, even with a valid selection', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({ sourceRef: 'a' })],
      selectedRefs: ['a'],
      providers: [{ id: 'deepseek', label: 'DeepSeek', configured: false, isDefault: true }],
      selectedProviderId: null,
    })
    const button = wrapper.findAll('button').find(b => b.text().includes('Analyze selected sources'))!
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('AI provider is not configured.')
  })

  it('a provider-status fetch failure shows "Could not read provider status." with a Retry button that emits retry-providers', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, providers: [], providersError: true })
    expect(wrapper.text()).toContain('Could not read provider status.')
    expect(wrapper.text()).not.toContain('AI provider is not configured.')
    const retryButton = wrapper.findAll('button').find(b => b.text() === 'Retry')!
    await retryButton.trigger('click')
    expect(wrapper.emitted('retry-providers')).toHaveLength(1)
  })

  it('a product with no analyzable files shows the honest explanation, the supported formats, and a link back to Media & resources', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [
        source({ sourceRef: 'a', typeLabel: 'Image', analyzable: false, unavailableReason: 'Images are not supported for source analysis yet.' }),
        source({ sourceRef: 'b', typeLabel: 'PDF', analyzable: false, unavailableReason: 'PDF is not supported for source analysis yet.' }),
      ],
    })
    // Derived from the shared format contract, so it lists exactly what the server reads today.
    expect(wrapper.text()).toContain('Supported formats: CSV, TSV, TXT.')
    // PDF is deliberately absent — the copy must not advertise a format the server refuses.
    expect(wrapper.text()).not.toContain('PDF (with extractable text)')
    expect(wrapper.find('a').exists()).toBe(true)
  })
})

describe('WorkspaceAiSourceIntake — load failures are shown honestly', () => {
  it('a failed source load shows an error and a Retry, never "this product has no associated files"', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [], sourcesError: true })

    expect(wrapper.text()).toContain('Could not load this product\'s files')
    expect(wrapper.text()).not.toContain('This product has no associated files yet')
    expect(wrapper.text()).not.toContain('None of this product\'s linked files can be analyzed')

    const retry = wrapper.findAll('button').find(b => b.text() === 'Retry')!
    await retry.trigger('click')
    expect(wrapper.emitted('retry-sources')).toHaveLength(1)
  })

  it('a genuinely empty product still says so', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [], sourcesError: false })
    expect(wrapper.text()).toContain('This product has no associated files yet')
  })

  it('while sources are loading it says loading, not empty', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [], sourcesLoading: true })
    expect(wrapper.text()).toContain('Loading this product\'s files…')
    expect(wrapper.text()).not.toContain('This product has no associated files yet')
  })
})

describe('WorkspaceAiSourceIntake — nothing sensitive is required to render it', () => {
  it('renders a full file card from the safe DTO alone — no id, filename, caption or alt is available to it', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      sources: [source({ sourceRef: 'opaque-ref-1', displayName: 'Source file', typeLabel: 'Text', roleLabel: 'Datasheet' })],
    })

    const html = wrapper.html()
    expect(html).toContain('Source file')
    expect(html).toContain('Datasheet')
    // The opaque ref is a value, never rendered as user-facing text.
    expect(wrapper.text()).not.toContain('opaque-ref-1')
    // Nothing resembling a Directus identifier can appear, because none is passed.
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(html).not.toContain('directus_files_id')
  })
})

/**
 * AI-SOURCE-CONTRACT-01 — what Analyze sends has to be described in terms that
 * stay true for every format.
 *
 * The old sentence ("Selected text sources will be sent…") only held while
 * every readable file was a text file. What actually leaves the server is the
 * text extracted from each selected file — for a TXT file today, and for a PDF,
 * a workbook or an image once their modules exist. The original file is never
 * sent to the provider.
 */
describe('WorkspaceAiSourceIntake — Analyze discloses exactly what is sent', () => {
  function mountWithSelection() {
    return mountIntake({ ...BASE_PROPS, sources: [source({ sourceRef: 'a' })], selectedRefs: ['a'] })
  }

  it('says extracted text is sent, original files are not, and nothing is written', () => {
    const note = mountWithSelection().find('.ws-analyze-note')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('Extracted text from the selected sources will be sent to the configured AI provider for analysis.')
    expect(note.text()).toContain('Original files are not sent to the AI provider.')
    expect(note.text()).toContain('Nothing will be written or published.')
  })

  it('the page intro describes the same thing — text extracted from the sources, not the sources themselves', () => {
    const wrapper = mountWithSelection()
    expect(wrapper.find('.ws-scope-hint').text()).toContain('sends text extracted from the selected sources to the configured AI provider')
    expect(wrapper.text()).not.toContain('Selected text sources will be sent')
    expect(wrapper.text()).not.toContain('sends the selected text sources')
  })

  it('with nothing selected there is nothing to disclose yet', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, sources: [source({ sourceRef: 'a' })], selectedRefs: [] })
    expect(wrapper.find('.ws-analyze-note').exists()).toBe(false)
  })
})

/**
 * PWS-AI-MULTI-SOURCE-REAL-BETA-01 — the four-step indicator has to describe
 * the workflow that actually exists.
 *
 * Step 4 read "Apply to Draft (temporarily unavailable)" from the round when
 * Apply really was disabled (`fix(admin): disable AI specification Apply`).
 * PWS-AI-APPLY-DRAFT-01 re-enabled it and wired the Apply button, but this
 * label was never updated — so the first screen of the flow told the reviewer
 * their accepted changes could not be written, while the review screen offered
 * exactly that button. Whichever way a reader resolved that, the screen was
 * lying to them.
 */
describe('WorkspaceAiSourceIntake — the step indicator matches the shipped workflow', () => {
  it('does not claim Apply to Draft is unavailable, because it is not', () => {
    const wrapper = mountIntake({ ...BASE_PROPS })
    expect(wrapper.text()).toContain('Apply to Draft')
    expect(wrapper.text()).not.toContain('temporarily unavailable')
  })

  it('still names all four steps in order', () => {
    const steps = mountIntake({ ...BASE_PROPS }).findAll('.ws-step').map(s => s.text())
    expect(steps).toHaveLength(4)
    expect(steps[0]).toContain('Select sources')
    expect(steps[1]).toContain('Analyze')
    expect(steps[2]).toContain('Review proposals')
    expect(steps[3]).toContain('Apply to Draft')
  })
})
