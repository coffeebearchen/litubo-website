// @vitest-environment happy-dom
/**
 * PWS-AI-ENGINE-01R — real component-mounting behavior tests for
 * `WorkspaceAiProposalReview.vue`: actual clicks on Accept/Reject/Edit,
 * a real (mocked-network) Apply call whose body is inspected to confirm
 * only accepted rows are sent, and the apply-success emit. `$fetch` is
 * stubbed globally — no real network call happens.
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

  it('Apply is disabled in the DOM until at least one row is accepted', async () => {
    const wrapper = mountReview()
    const applyButton = wrapper.findAll('button').find(b => b.text().includes('Apply accepted changes'))!
    expect((applyButton.element as HTMLButtonElement).disabled).toBe(true)
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click')
    expect((wrapper.findAll('button').find(b => b.text().includes('Apply accepted changes'))!.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('Apply sends ONLY the accepted rows in the request body — rejected/pending rows never appear', async () => {
    let capturedBody: unknown
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: { body: unknown }) => {
      capturedBody = opts.body
      return { message: '1 specification change was applied to Draft.' }
    }))

    const wrapper = mountReview()
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click') // accept only the FIRST item (Detection sensitivity)
    const applyButton = wrapper.findAll('button').find(b => b.text().includes('Apply accepted changes'))!
    await applyButton.trigger('click')
    await wrapper.vm.$nextTick()

    const changes = (capturedBody as { changes: Array<{ parameter?: string }> }).changes
    expect(changes).toHaveLength(1)
    expect(changes[0].parameter).toBe('Detection sensitivity (Fe)')
  })

  it('a successful Apply emits apply-success with the server\'s safe message', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ message: '1 specification change was applied to Draft.' })))
    const wrapper = mountReview()
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click')
    const applyButton = wrapper.findAll('button').find(b => b.text().includes('Apply accepted changes'))!
    await applyButton.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('apply-success')).toEqual([['1 specification change was applied to Draft.']])
  })

  it('a failed Apply emits apply-error with a safe message, never the raw thrown error', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw { data: { message: 'These changes could not be applied and have been rolled back. Nothing was saved.' } } }))
    const wrapper = mountReview()
    const acceptButtons = wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))
    await acceptButtons[0].trigger('click')
    const applyButton = wrapper.findAll('button').find(b => b.text().includes('Apply accepted changes'))!
    await applyButton.trigger('click')
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('apply-error')
    expect(emitted?.[emitted.length - 1]).toEqual(['These changes could not be applied and have been rolled back. Nothing was saved.'])
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
