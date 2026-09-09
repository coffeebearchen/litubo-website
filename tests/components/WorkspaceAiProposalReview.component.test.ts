// @vitest-environment happy-dom
/**
 * PWS-AI-APPLY-DRAFT-01 — real component-mounting behaviour tests for
 * `WorkspaceAiProposalReview.vue`: actual clicks on Accept / Reject / Edit,
 * and the Apply gate now that Apply really writes.
 *
 * `$fetch` is stubbed globally, so what the component sends is asserted
 * directly — in particular that only accepted rows ever reach the request
 * body, and that nothing is sent at all while Apply is disabled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceAiProposalReview from '../../components/admin/workspace/WorkspaceAiProposalReview.vue'
import type { SpecificationProposal } from '../../utils/aiProposal'

const PROPOSAL: SpecificationProposal = {
  groups: [
    {
      group: 'Detection performance',
      items: [
        { parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' },
        { parameter: 'Rated power', value: '220V' },
      ],
    },
  ],
}

const BASE_PROPS = {
  productId: 3,
  proposal: PROPOSAL,
  fileResults: [{ displayName: 'notes.txt', status: 'read' as const }],
  existingSpecGroups: [],
  applying: false,
  applyError: null,
  comparisonReady: true,
}

const applyButtonOf = (wrapper: ReturnType<typeof mountReview>) =>
  wrapper.findAll('button').find(b => b.text().includes('Apply') && b.text().includes('Draft'))!

const acceptFirstRow = async (wrapper: ReturnType<typeof mountReview>) => {
  const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
  await acceptButtons[0].trigger('click')
}

function mountReview(props: Partial<typeof BASE_PROPS> = {}) {
  return mount(WorkspaceAiProposalReview, { props: { ...BASE_PROPS, ...props } })
}

describe('WorkspaceAiProposalReview — real mounted component', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('every row starts Pending — nothing pre-accepted', () => {
    const wrapper = mountReview()
    const badges = wrapper.findAll('.ws-status-badge')
    expect(badges.length).toBeGreaterThan(0)
    for (const badge of badges) expect(badge.text()).toBe('pending')
  })

  it('clicking Accept moves that row to accepted and updates the visible accepted count', async () => {
    const wrapper = mountReview()
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click')
    expect(wrapper.text()).toContain('1 accepted')
    expect(wrapper.findAll('.ws-status-badge')[0].text()).toBe('accepted')
  })

  it('clicking Reject moves that row to rejected without touching the accepted count', async () => {
    const wrapper = mountReview()
    const rejectButtons = wrapper.findAll('button').filter(b => b.text() === 'Reject')
    await rejectButtons[0].trigger('click')
    expect(wrapper.text()).toContain('0 accepted')
    expect(wrapper.findAll('.ws-status-badge')[0].text()).toBe('rejected')
  })

  it('clicking Edit reveals editable inputs, and Save commits the new value', async () => {
    const wrapper = mountReview()
    const editButtons = wrapper.findAll('button').filter(b => b.text() === 'Edit')
    await editButtons[0].trigger('click')
    const valueInput = wrapper.find('input.ws-form-input')
    await valueInput.setValue('1.0 mm')
    const saveButton = wrapper.findAll('button').find(b => b.text() === 'Save')!
    await saveButton.trigger('click')
    expect(wrapper.text()).toContain('1.0 mm')
  })

  // ── PWS-AI-APPLY-DRAFT-01: the Apply gate ──

  it('Apply is disabled with nothing accepted, and sends no request if clicked anyway', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountReview()
    const button = applyButtonOf(wrapper)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)

    await button.trigger('click')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Apply becomes enabled once at least one row is accepted, and names the count', async () => {
    const wrapper = mountReview()
    await acceptFirstRow(wrapper)

    const button = applyButtonOf(wrapper)
    expect((button.element as HTMLButtonElement).disabled).toBe(false)
    expect(button.text()).toBe('Apply 1 accepted change to Draft')
  })

  it('Apply stays disabled when the existing specifications could not be loaded', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountReview({ comparisonReady: false })
    await acceptFirstRow(wrapper)

    expect((applyButtonOf(wrapper).element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain("Apply is unavailable until this product's existing specifications load")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends ONLY accepted rows — pending and rejected never reach the request body', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'Applied 1 accepted change to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountReview()
    const buttons = wrapper.findAll('button')
    // Row 1 accepted, row 2 rejected. (The proposal has exactly two rows.)
    await buttons.filter(b => b.text().startsWith('Accept as'))[0].trigger('click')
    await wrapper.findAll('button').filter(b => b.text() === 'Reject')[1].trigger('click')

    await applyButtonOf(wrapper).trigger('click')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = fetchMock.mock.calls[0][1]!.body!
    expect(body.changes).toHaveLength(1)
    expect(body.changes[0]).toMatchObject({ action: 'add', parameter: 'Detection sensitivity (Fe)' })
  })

  it('a fully successful apply emits the server message as apply-success', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({
      ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'Applied 1 accepted change to Draft.',
    })))

    const wrapper = mountReview()
    await acceptFirstRow(wrapper)
    await applyButtonOf(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('apply-success')?.[0]).toEqual(['Applied 1 accepted change to Draft.'])
  })

  it('a partial apply shows the real count, locks Apply, and does not emit success', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      appliedCount: 2,
      totalCount: 4,
      partial: true,
      message: 'Applied 2 of 4 accepted changes before a save error. Review Specifications before starting a new AI proposal.',
    }))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountReview()
    await acceptFirstRow(wrapper)
    await applyButtonOf(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('apply-success')).toBeUndefined()
    expect(wrapper.text()).toContain('Applied 2 of 4 accepted changes')
    expect(wrapper.text()).toContain('Open Specifications to check what was saved')

    // Terminal state: no second Apply of the same proposal.
    expect((applyButtonOf(wrapper).element as HTMLButtonElement).disabled).toBe(true)
    await applyButtonOf(wrapper).trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tells the reviewer plainly that only accepted changes are written', () => {
    const wrapper = mountReview()
    expect(wrapper.text()).toContain('Only changes you explicitly accepted will be written to this product Draft')
    expect(wrapper.text()).not.toContain('temporarily unavailable')
    expect(wrapper.text()).not.toContain('atomic database transaction')
  })

  it('an exact group+parameter match against an existing item suggests Update, with the current value visible', () => {
    const wrapper = mountReview({
      existingSpecGroups: [{
        id: 1, product_id: 3, title_en: 'Detection performance', title_es: null, title_pt: null,
        description_en: null, enabled: true, sort: null,
        items: [{ id: 10, spec_group_id: 1, label_en: 'Detection sensitivity (Fe)', label_es: null, label_pt: null, value_en: '0.5 mm', value_es: null, value_pt: null, note_en: null, note_es: null, note_pt: null, sort: null, enabled: true }],
      }] as never,
    })
    expect(wrapper.text()).toContain('Review required')
    expect(wrapper.text()).toContain('Current value: 0.5 mm')
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(acceptButtons[0].text()).toBe('Accept as Update')
  })

  it('a same-named item in a DIFFERENT existing group is flagged Review required but offered as Add, not a silent Update', () => {
    const wrapper = mountReview({
      existingSpecGroups: [{
        id: 2, product_id: 3, title_en: 'A totally different group', title_es: null, title_pt: null,
        description_en: null, enabled: true, sort: null,
        items: [{ id: 20, spec_group_id: 2, label_en: 'Detection sensitivity (Fe)', label_es: null, label_pt: null, value_en: '9.9 mm', value_es: null, value_pt: null, note_en: null, note_es: null, note_pt: null, sort: null, enabled: true }],
      }] as never,
    })
    expect(wrapper.text()).toContain('Review required')
    expect(wrapper.text()).toContain('already exists in')
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(acceptButtons[0].text()).toBe('Accept as Add')
  })

  it('a proposal with two same-named groups renders the group heading and its rows only once (no duplicate render)', () => {
    const duplicateGroupProposal: SpecificationProposal = {
      groups: [
        { group: 'Detection performance', items: [{ parameter: 'A', value: '1' }] },
        { group: 'Detection performance', items: [{ parameter: 'B', value: '2' }] },
      ],
    }
    const wrapper = mountReview({ proposal: duplicateGroupProposal })
    const headings = wrapper.findAll('.ws-group-title').filter(h => h.text() === 'Detection performance')
    expect(headings).toHaveLength(1)
    expect(wrapper.findAll('.ws-status-badge')).toHaveLength(2) // both rows rendered, under the single heading
  })
})

// ── PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — conflict state must be real ──

function specGroup(title: string, items: Array<{ id: number, label: string, value: string }>) {
  return {
    id: 1, product_id: 3, title_en: title, title_es: null, title_pt: null,
    description_en: null, enabled: true, sort: null,
    items: items.map(i => ({
      id: i.id, spec_group_id: 1, label_en: i.label, label_es: null, label_pt: null,
      value_en: i.value, value_es: null, value_pt: null,
      note_en: null, note_es: null, note_pt: null, sort: null, enabled: true,
    })),
  }
}

describe('WorkspaceAiProposalReview — duplicates inside one group are ambiguous, never auto-picked', () => {
  it('two existing items with the same parameter in the SAME group are flagged ambiguous with no Update target', () => {
    const wrapper = mountReview({
      existingSpecGroups: [specGroup('Detection performance', [
        { id: 10, label: 'Detection sensitivity (Fe)', value: '0.5 mm' },
        { id: 11, label: 'Detection sensitivity (Fe)', value: '0.9 mm' },
      ])] as never,
    })

    expect(wrapper.text()).toContain('Review required')
    // Offered as an Add, because no single Update target can be chosen honestly.
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(acceptButtons[0].text()).toBe('Accept as Add')
    expect(wrapper.text()).toContain('2 items in this group')
  })

  it('a single existing item in the same group is still a clean Update target', () => {
    const wrapper = mountReview({
      existingSpecGroups: [specGroup('Detection performance', [
        { id: 10, label: 'Detection sensitivity (Fe)', value: '0.5 mm' },
      ])] as never,
    })
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(acceptButtons[0].text()).toBe('Accept as Update')
  })
})

describe('WorkspaceAiProposalReview — a late specifications load recomputes every row', () => {
  it('rows built with no existing specifications are re-evaluated when Retry supplies them', async () => {
    // First load failed: the component starts with nothing to compare against.
    const wrapper = mountReview({ existingSpecGroups: [] })
    expect(wrapper.text()).not.toContain('Review required')
    const before = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(before[0].text()).toBe('Accept as Add')

    // Retry succeeds and the conflicting specification arrives.
    await wrapper.setProps({
      existingSpecGroups: [specGroup('Detection performance', [
        { id: 10, label: 'Detection sensitivity (Fe)', value: '0.5 mm' },
      ])] as never,
    })

    expect(wrapper.text()).toContain('Review required')
    expect(wrapper.text()).toContain('Current value: 0.5 mm')
    const after = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    expect(after[0].text()).toBe('Accept as Update')
  })

  it('a decision already made is preserved when the comparison is refreshed', async () => {
    const wrapper = mountReview({ existingSpecGroups: [] })
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click')
    expect(wrapper.text()).toContain('1 accepted')

    await wrapper.setProps({
      existingSpecGroups: [specGroup('Detection performance', [
        { id: 10, label: 'Detection sensitivity (Fe)', value: '0.5 mm' },
      ])] as never,
    })

    // The row's match state changed, but the reviewer's own decision did not.
    expect(wrapper.text()).toContain('1 accepted')
    expect(wrapper.text()).toContain('Review required')
  })
})
