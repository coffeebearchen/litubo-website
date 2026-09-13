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
import type { SpecificationProposal, SourceFileOutcome } from '../../utils/aiProposal'

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
  fileResults: [{ displayName: 'notes.txt', status: 'read' }] as SourceFileOutcome[],
  existingSpecGroups: [],
  applying: false,
  applyError: null,
  comparisonReady: true,
  proposalRef: 'test-proposal-ref',
  reused: false,
  alreadyApplied: false,
}

/**
 * PWS-AI-REVIEW-BATCH-01 — the header's "N accepted" badge was replaced by the
 * live statistics block, so these read the specific counter rather than
 * scanning the whole rendered string (which now always contains every label).
 */
const statOf = (wrapper: ReturnType<typeof mountReview>, kind: 'safe' | 'review' | 'accepted' | 'rejected') =>
  wrapper.find(`.ws-stat--${kind} .ws-stat-value`).text()

/** Row-level conflict markers only — not the always-present "Review required" statistic label. */
const reviewRequiredMarkers = (wrapper: ReturnType<typeof mountReview>) =>
  wrapper.findAll('.ws-review-required')

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
    expect(statOf(wrapper, 'accepted')).toBe('1')
    expect(wrapper.findAll('.ws-status-badge')[0].text()).toBe('accepted')
  })

  it('clicking Reject moves that row to rejected without touching the accepted count', async () => {
    const wrapper = mountReview()
    const rejectButtons = wrapper.findAll('button').filter(b => b.text() === 'Reject')
    await rejectButtons[0].trigger('click')
    expect(statOf(wrapper, 'accepted')).toBe('0')
    expect(statOf(wrapper, 'rejected')).toBe('1')
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
    expect(reviewRequiredMarkers(wrapper)).toHaveLength(0)
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
    expect(statOf(wrapper, 'accepted')).toBe('1')

    await wrapper.setProps({
      existingSpecGroups: [specGroup('Detection performance', [
        { id: 10, label: 'Detection sensitivity (Fe)', value: '0.5 mm' },
      ])] as never,
    })

    // The row's match state changed, but the reviewer's own decision did not.
    expect(statOf(wrapper, 'accepted')).toBe('1')
    expect(wrapper.text()).toContain('Review required')
  })
})

// ── PWS-AI-REVIEW-BATCH-01: batch review ──

/**
 * The acceptance scenario from the work order, built as real props: thirteen
 * proposals for one product, eleven of which are safe and two of which collide
 * with specifications the product already has.
 *
 * The two conflicts are deliberately the ones the real Beta produced — Power
 * supply and Rated power — because both already exist under General
 * Specifications, which is exactly what "Review required" is for.
 */
const BATCH_PROPOSAL: SpecificationProposal = {
  groups: [
    {
      group: 'General',
      items: [
        { parameter: 'Inspection type', value: 'Free-fall metal detection' },
        { parameter: 'Product flow', value: 'Gravity-fed' },
        { parameter: 'Installation orientation', value: 'Vertical' },
        { parameter: 'Test aperture diameter', value: '180 mm' },
      ],
    },
    {
      group: 'Electrical',
      items: [
        { parameter: 'Power supply', value: 'AC 220 V, 50 Hz' },
        { parameter: 'Rated power', value: '0.45 kW' },
      ],
    },
    {
      group: 'Outputs',
      items: [
        { parameter: 'Alarm output', value: 'Audible and visual alarm' },
        { parameter: 'Reject output', value: 'Relay signal' },
      ],
    },
    {
      group: 'User Interface',
      items: [{ parameter: 'Interface language', value: 'English' }],
    },
    {
      group: 'Environmental',
      items: [
        { parameter: 'Protection class', value: 'IP54' },
        { parameter: 'Operating temperature', value: '0–40 °C' },
      ],
    },
    {
      group: 'Mechanical',
      items: [
        { parameter: 'Frame material', value: 'Stainless steel 304' },
        { parameter: 'Approximate weight', value: '95 kg' },
      ],
    },
  ],
}

/** The product already has Power supply and Rated power, under a different group — so both proposals conflict. */
const EXISTING_CONFLICTS = [{
  id: 1,
  product_id: 3,
  title_en: 'General Specifications',
  title_es: null,
  title_pt: null,
  description_en: null,
  enabled: true,
  sort: null,
  items: [
    { id: 91, spec_group_id: 1, label_en: 'Power supply', label_es: null, label_pt: null, value_en: 'AC 220 V, 50 Hz', value_es: null, value_pt: null, note_en: null, note_es: null, note_pt: null, sort: null, enabled: true },
    { id: 92, spec_group_id: 1, label_en: 'Rated power', label_es: null, label_pt: null, value_en: '0.40 kW', value_es: null, value_pt: null, note_en: null, note_es: null, note_pt: null, sort: null, enabled: true },
  ],
}] as unknown as typeof BASE_PROPS.existingSpecGroups

function mountBatch(overrides: Partial<typeof BASE_PROPS> = {}) {
  return mountReview({ proposal: BATCH_PROPOSAL, existingSpecGroups: EXISTING_CONFLICTS, ...overrides })
}

const rowCheckboxes = (wrapper: ReturnType<typeof mountReview>) =>
  wrapper.findAll('td.ws-col-select input[type="checkbox"]')

const batchButton = (wrapper: ReturnType<typeof mountReview>, label: string) =>
  wrapper.findAll('button').find(b => b.text() === label)!

const statuses = (wrapper: ReturnType<typeof mountReview>) =>
  wrapper.findAll('.ws-status-badge').map(b => b.text())

const countBy = (wrapper: ReturnType<typeof mountReview>, status: string) =>
  statuses(wrapper).filter(s => s === status).length

describe('PWS-AI-REVIEW-BATCH-01 — Accept all safe', () => {
  it('starts at 13 total, 11 safe pending, 2 review required, 0 accepted, 0 rejected', () => {
    const wrapper = mountBatch()

    expect(wrapper.find('.ws-stat .ws-stat-value').text()).toBe('13')
    expect(statOf(wrapper, 'safe')).toBe('11')
    expect(statOf(wrapper, 'review')).toBe('2')
    expect(statOf(wrapper, 'accepted')).toBe('0')
    expect(statOf(wrapper, 'rejected')).toBe('0')
    expect(reviewRequiredMarkers(wrapper)).toHaveLength(2)
  })

  it('accepts the eleven safe rows and leaves both conflicts pending', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountBatch()
    await batchButton(wrapper, 'Accept all safe').trigger('click')

    expect(statOf(wrapper, 'safe')).toBe('0')
    expect(statOf(wrapper, 'review')).toBe('2')
    expect(statOf(wrapper, 'accepted')).toBe('11')
    expect(statOf(wrapper, 'rejected')).toBe('0')

    expect(countBy(wrapper, 'accepted')).toBe(11)
    expect(countBy(wrapper, 'pending')).toBe(2)

    // Review state only: nothing was written anywhere.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('the two accepted-nothing conflicts are exactly the Review required rows', async () => {
    const wrapper = mountBatch()
    await batchButton(wrapper, 'Accept all safe').trigger('click')

    // Every row still marked "Review required" is still Pending.
    const conflictRows = wrapper.findAll('tr').filter(tr => tr.find('.ws-review-required').exists())
    expect(conflictRows).toHaveLength(2)
    for (const row of conflictRows) {
      expect(row.find('.ws-status-badge').text()).toBe('pending')
    }
  })

  it('does not re-accept a row the reviewer already rejected', async () => {
    const wrapper = mountBatch()
    await wrapper.findAll('button').filter(b => b.text() === 'Reject')[0].trigger('click')
    expect(statOf(wrapper, 'rejected')).toBe('1')

    await batchButton(wrapper, 'Accept all safe').trigger('click')

    expect(statOf(wrapper, 'rejected')).toBe('1')
    expect(statOf(wrapper, 'accepted')).toBe('10')
    expect(countBy(wrapper, 'rejected')).toBe(1)
  })

  it('does not sweep up a row the reviewer edited by hand', async () => {
    const wrapper = mountBatch()

    await wrapper.findAll('button').filter(b => b.text() === 'Edit')[0].trigger('click')
    await wrapper.findAll('.ws-form-input')[0].setValue('Edited by the reviewer')
    await wrapper.findAll('button').filter(b => b.text() === 'Save')[0].trigger('click')

    // The edited row leaves the safe set and says so.
    expect(statOf(wrapper, 'safe')).toBe('10')
    expect(wrapper.text()).toContain('Edited')

    await batchButton(wrapper, 'Accept all safe').trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('10')
    // ...and it is still Pending, waiting for a deliberate decision.
    const editedRow = wrapper.findAll('tr').find(tr => tr.find('.ws-edited-badge').exists())!
    expect(editedRow.find('.ws-status-badge').text()).toBe('pending')
  })

  it('is disabled once there is nothing safe left to accept', async () => {
    const wrapper = mountBatch()
    expect((batchButton(wrapper, 'Accept all safe').element as HTMLButtonElement).disabled).toBe(false)

    await batchButton(wrapper, 'Accept all safe').trigger('click')
    expect((batchButton(wrapper, 'Accept all safe').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('PWS-AI-REVIEW-BATCH-01 — selection', () => {
  it('Accept selected changes only the rows that were ticked', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountBatch()
    const boxes = rowCheckboxes(wrapper)
    await boxes[0].setValue(true)
    await boxes[3].setValue(true)
    expect(wrapper.text()).toContain('2 selected')

    await batchButton(wrapper, 'Accept selected').trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('2')
    expect(countBy(wrapper, 'accepted')).toBe(2)
    expect(statuses(wrapper)[0]).toBe('accepted')
    expect(statuses(wrapper)[3]).toBe('accepted')
    expect(statuses(wrapper)[1]).toBe('pending')
    // Selection is cleared so the same action cannot be fired twice by accident.
    expect(wrapper.text()).toContain('0 selected')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Reject selected changes only the rows that were ticked', async () => {
    const wrapper = mountBatch()
    const boxes = rowCheckboxes(wrapper)
    await boxes[1].setValue(true)

    await batchButton(wrapper, 'Reject selected').trigger('click')

    expect(statOf(wrapper, 'rejected')).toBe('1')
    expect(statuses(wrapper)[1]).toBe('rejected')
    expect(statuses(wrapper)[0]).toBe('pending')
  })

  it('a deliberately selected conflict can be accepted — as an Add, never a merge', async () => {
    const wrapper = mountBatch()
    const conflictRow = wrapper.findAll('tr').filter(tr => tr.find('.ws-review-required').exists())[0]
    await conflictRow.find('td.ws-col-select input').setValue(true)

    await batchButton(wrapper, 'Accept selected').trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('1')
    expect(statOf(wrapper, 'review')).toBe('2')
    // The row still carries the "added as a new item, not merged" wording.
    expect(wrapper.text()).toContain('not merged automatically')
  })

  it('both selected actions are disabled while nothing is selected', () => {
    const wrapper = mountBatch()
    expect((batchButton(wrapper, 'Accept selected').element as HTMLButtonElement).disabled).toBe(true)
    expect((batchButton(wrapper, 'Reject selected').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Select all safe ticks the safe rows and no others', async () => {
    const wrapper = mountBatch()
    const selectAll = wrapper.find('.ws-select-all input')
    await selectAll.setValue(true)

    expect(wrapper.text()).toContain('11 selected')

    const conflictRow = wrapper.findAll('tr').filter(tr => tr.find('.ws-review-required').exists())[0]
    expect((conflictRow.find('td.ws-col-select input').element as HTMLInputElement).checked).toBe(false)
  })
})

describe('PWS-AI-REVIEW-BATCH-01 — group selection', () => {
  it("a group's header checkbox selects that group's rows and leaves other groups alone", async () => {
    const wrapper = mountBatch()

    // The second table is the Electrical group — the two conflicting rows.
    const groupHeaderBoxes = wrapper.findAll('th.ws-col-select input[type="checkbox"]')
    expect(groupHeaderBoxes.length).toBe(6)
    await groupHeaderBoxes[1].setValue(true)

    expect(wrapper.text()).toContain('2 selected')

    // Rows in the first group are untouched.
    const boxes = rowCheckboxes(wrapper)
    expect((boxes[0].element as HTMLInputElement).checked).toBe(false)
  })

  it('unticking a group header clears only that group', async () => {
    const wrapper = mountBatch()
    const groupHeaderBoxes = wrapper.findAll('th.ws-col-select input[type="checkbox"]')

    await groupHeaderBoxes[0].setValue(true)
    await groupHeaderBoxes[2].setValue(true)
    expect(wrapper.text()).toContain('6 selected')

    await groupHeaderBoxes[0].setValue(false)
    expect(wrapper.text()).toContain('2 selected')
  })
})

describe('PWS-AI-REVIEW-BATCH-01 — batch review never writes, and Apply still does', () => {
  it('no batch action sends a request of any kind', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountBatch()
    await batchButton(wrapper, 'Accept all safe').trigger('click')
    await rowCheckboxes(wrapper)[0].setValue(true)
    await batchButton(wrapper, 'Accept selected').trigger('click')
    await rowCheckboxes(wrapper)[1].setValue(true)
    await batchButton(wrapper, 'Reject selected').trigger('click')
    await wrapper.find('.ws-select-all input').setValue(true)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('apply-success')).toBeUndefined()
  })

  it('Apply is disabled at zero accepted and enabled once a batch action accepts something', async () => {
    const wrapper = mountBatch()
    expect((applyButtonOf(wrapper).element as HTMLButtonElement).disabled).toBe(true)

    await batchButton(wrapper, 'Accept all safe').trigger('click')

    const apply = applyButtonOf(wrapper)
    expect((apply.element as HTMLButtonElement).disabled).toBe(false)
    expect(apply.text()).toBe('Apply 11 accepted changes to Draft')
  })

  it('the Apply payload carries the accepted rows only — never pending or rejected', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 11, totalCount: 11, partial: false, message: 'Applied 11 accepted changes to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountBatch()
    await batchButton(wrapper, 'Accept all safe').trigger('click')
    // Reject one conflict; accept nothing else.
    const conflictRows = wrapper.findAll('tr').filter(tr => tr.find('.ws-review-required').exists())
    await conflictRows[0].findAll('button').find(b => b.text() === 'Reject')!.trigger('click')

    await applyButtonOf(wrapper).trigger('click')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const changes = fetchMock.mock.calls[0][1]!.body!.changes
    expect(changes).toHaveLength(11)
    // The rejected conflict and the still-pending conflict are both absent.
    const parameters = changes.map(c => c.parameter)
    expect(parameters).not.toContain('Power supply')
    expect(parameters).not.toContain('Rated power')
  })

  it('an edited-then-accepted row is applied with the edited value', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'Applied 1 accepted change to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountBatch()
    await wrapper.findAll('button').filter(b => b.text() === 'Edit')[0].trigger('click')
    await wrapper.findAll('.ws-form-input')[0].setValue('Edited value for Draft')
    await wrapper.findAll('button').filter(b => b.text() === 'Save')[0].trigger('click')
    // Edited rows are excluded from the bulk action, so accept it explicitly.
    await wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))[0].trigger('click')

    await applyButtonOf(wrapper).trigger('click')

    const changes = fetchMock.mock.calls[0][1]!.body!.changes
    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('Edited value for Draft')
  })
})

describe('PWS-AI-REVIEW-BATCH-01 — review state stays reversible', () => {
  it('a batch-accepted row can still be rejected from its own row control', async () => {
    const wrapper = mountBatch()
    await batchButton(wrapper, 'Accept all safe').trigger('click')
    expect(statOf(wrapper, 'accepted')).toBe('11')

    await wrapper.findAll('button').filter(b => b.text() === 'Reject')[0].trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('10')
    expect(statOf(wrapper, 'rejected')).toBe('1')
  })

  it('a batch-rejected row can be accepted again from its own row control', async () => {
    const wrapper = mountBatch()
    await rowCheckboxes(wrapper)[0].setValue(true)
    await batchButton(wrapper, 'Reject selected').trigger('click')
    expect(statuses(wrapper)[0]).toBe('rejected')

    await wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))[0].trigger('click')
    expect(statuses(wrapper)[0]).toBe('accepted')
  })

  it('the single-row Accept / Reject / Edit controls are all still present on every row', () => {
    const wrapper = mountBatch()
    expect(wrapper.findAll('button').filter(b => b.text().startsWith('Accept as'))).toHaveLength(13)
    expect(wrapper.findAll('button').filter(b => b.text() === 'Reject')).toHaveLength(13)
    expect(wrapper.findAll('button').filter(b => b.text() === 'Edit')).toHaveLength(13)
  })
})

// ── PWS-AI-SINGLE-PRODUCT-MULTI-SOURCE-01: conflicts and source summary in review ──

const CONFLICT_PROPOSAL: SpecificationProposal = {
  groups: [
    { group: 'Environmental', items: [{ parameter: 'Protection class', value: 'IP54' }, { parameter: 'Operating temperature', value: '0–40 °C' }] },
  ],
  conflicts: [
    { group: 'Electrical', parameter: 'Power supply', candidateValues: ['220 V', '380 V'] },
  ],
}

const MIXED_FILE_RESULTS: SourceFileOutcome[] = [
  { displayName: 'LT-180C-spec.txt', status: 'read' },
  { displayName: 'LT-180C-electrical.txt', status: 'read' },
  { displayName: 'LT-180C-spec-copy.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' },
  { displayName: 'LT-180C-photo.jpg', status: 'unsupported', reason: 'Images are not supported for source analysis yet.' },
]

function mountConflict(overrides: Partial<typeof BASE_PROPS> = {}) {
  return mountReview({ proposal: CONFLICT_PROPOSAL, fileResults: MIXED_FILE_RESULTS, ...overrides })
}

const conflictCard = (wrapper: ReturnType<typeof mountReview>) => wrapper.find('.ws-card--conflict')
const useSelectedButton = (wrapper: ReturnType<typeof mountReview>) =>
  wrapper.findAll('button').find(b => b.text() === 'Use selected value')!

describe('source conflicts are decided by a person, never by the model', () => {
  it('a conflict is shown in its own Review required section', () => {
    const wrapper = mountConflict()
    expect(conflictCard(wrapper).exists()).toBe(true)
    expect(conflictCard(wrapper).text()).toContain('Source conflicts')
    expect(conflictCard(wrapper).text()).toContain('Power supply')
    expect(conflictCard(wrapper).text()).toContain('220 V')
    expect(conflictCard(wrapper).text()).toContain('380 V')
  })

  it('it counts as Review required, and never as safe pending', () => {
    const wrapper = mountConflict()
    // Two ordinary proposals plus one conflict.
    expect(statOf(wrapper, 'safe')).toBe('2')
    expect(statOf(wrapper, 'review')).toBe('1')
  })

  it('Accept all safe leaves the conflict alone', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountConflict()
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('2')
    // The conflict is still waiting for a person.
    expect(conflictCard(wrapper).find('.ws-status-badge').text()).toBe('pending')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Use selected value is unavailable until a candidate is chosen', async () => {
    const wrapper = mountConflict()
    expect((useSelectedButton(wrapper).element as HTMLButtonElement).disabled).toBe(true)
    expect(conflictCard(wrapper).text()).toContain('Select a value to enable')

    await conflictCard(wrapper).findAll('input[type="radio"]')[0].setValue()
    expect((useSelectedButton(wrapper).element as HTMLButtonElement).disabled).toBe(false)
  })

  it('choosing a value and confirming it moves the conflict to accepted', async () => {
    const wrapper = mountConflict()
    await conflictCard(wrapper).findAll('input[type="radio"]')[1].setValue()
    await useSelectedButton(wrapper).trigger('click')

    expect(conflictCard(wrapper).find('.ws-status-badge').text()).toBe('accepted')
    expect(statOf(wrapper, 'accepted')).toBe('1')
  })

  it('the Apply payload carries the value the person chose, and only that one', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'Applied 1 accepted change to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountConflict()
    // Choose 380 V — the second candidate.
    await conflictCard(wrapper).findAll('input[type="radio"]')[1].setValue()
    await useSelectedButton(wrapper).trigger('click')
    await applyButtonOf(wrapper).trigger('click')

    const changes = fetchMock.mock.calls[0][1]!.body!.changes
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ parameter: 'Power supply', value: '380 V' })
    // The value the reviewer did not choose is nowhere in the request.
    expect(JSON.stringify(changes)).not.toContain('220 V')
  })

  it('a rejected conflict never reaches Apply', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 2, totalCount: 2, partial: false, message: 'Applied 2 accepted changes to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountConflict()
    await conflictCard(wrapper).findAll('button').find(b => b.text() === 'Reject')!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')
    await applyButtonOf(wrapper).trigger('click')

    const changes = fetchMock.mock.calls[0][1]!.body!.changes
    expect(changes).toHaveLength(2)
    expect(JSON.stringify(changes)).not.toContain('Power supply')
  })

  it('ordinary batch review is unchanged when there are no conflicts at all', async () => {
    const wrapper = mountReview()
    expect(wrapper.find('.ws-card--conflict').exists()).toBe(false)
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')
    expect(statOf(wrapper, 'accepted')).toBe('2')
  })
})

describe('the source summary says what this analysis actually used', () => {
  it('lists every source with its own status', () => {
    const wrapper = mountConflict()
    const summary = wrapper.find('.ws-source-summary')

    expect(summary.text()).toContain('LT-180C-spec.txt')
    expect(summary.text()).toContain('LT-180C-electrical.txt')
    expect(summary.text()).toContain('LT-180C-spec-copy.txt')
    expect(summary.text()).toContain('LT-180C-photo.jpg')
    expect(summary.text()).toContain('Analyzed')
    expect(summary.text()).toContain('Duplicate excluded')
  })

  it('counts analysed, duplicate-excluded and not-analysed correctly', () => {
    const wrapper = mountConflict()
    const values = wrapper.findAll('.ws-source-counts dd').map(d => d.text())
    expect(values).toEqual(['2', '1', '1'])
  })

  it('carries no identifier, path, hash or raw content', () => {
    const wrapper = mountConflict()
    const summary = wrapper.find('.ws-source-summary').html()

    expect(summary).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(summary).not.toMatch(/[0-9a-f]{64}/)
    expect(summary).not.toContain('/assets/')
    expect(summary).not.toContain('directus_files_id')
  })
})

/**
 * AI-SOURCE-CONTRACT-01 — disagreements are only found among the sources that
 * were actually read. When one was not, the reviewer is told so where the
 * sources are summarised, so an empty conflict list is never taken to mean that
 * every selected document agreed.
 */
describe('a source that was not analyzed is called out beside the source summary', () => {
  const WARNING = 'Some selected sources were not analyzed — any conflicting values they contain are not shown.'

  it('shows the warning when at least one selected source was not analyzed', () => {
    const summary = mountConflict().find('.ws-source-summary')
    expect(summary.find('.ws-source-warning').exists()).toBe(true)
    expect(summary.find('.ws-source-warning').text()).toBe(WARNING)
  })

  it('stays hidden when every selected source was analyzed', () => {
    const wrapper = mountReview()
    expect(wrapper.find('.ws-source-warning').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(WARNING)
  })

  it('stays hidden when the only other source was a duplicate — a duplicate was read, not skipped', () => {
    const wrapper = mountReview({
      fileResults: [
        { displayName: 'LT-180C-spec.txt', status: 'read' },
        { displayName: 'LT-180C-spec-copy.txt', status: 'duplicate', reason: 'Duplicate content excluded from analysis.' },
      ],
    })
    expect(wrapper.find('.ws-source-warning').exists()).toBe(false)
  })

  it('also appears when a source was left unread by the reading time limit', () => {
    const wrapper = mountReview({
      fileResults: [
        { displayName: 'LT-180C-spec.txt', status: 'read' },
        { displayName: 'LT-180C-manual.txt', status: 'unreadable', reason: 'Not read: the time limit for reading sources was reached.' },
      ],
    })
    expect(wrapper.find('.ws-source-warning').text()).toBe(WARNING)
  })
})

/**
 * PWS-AI-MULTI-SOURCE-REAL-BETA-01 — the ONE real DeepSeek run, pinned.
 *
 * The fixture below is not invented: it is exactly what the single authorised
 * paid call returned for TEST ONLY product 3 from three approved sources
 * (LT180C-test-general / -electrical / -environment), and the existing
 * specifications are the real rows the product carried at that moment.
 *
 * A second real Analyze is forbidden, so this is the only durable record of
 * what the model actually produced. It exists so a future refactor cannot
 * quietly break the three properties the Beta was run to prove:
 *
 *   - the 220 V / 380 V disagreement is surfaced as a conflict, never settled;
 *   - "Accept all safe" cannot sweep that conflict up;
 *   - the values the sources refused to state (Net weight: UNKNOWN, Detection
 *     sensitivity: NOT VERIFIED) are absent rather than guessed.
 */
const REAL_BETA_PROPOSAL: SpecificationProposal = {
  groups: [
    { group: 'General', items: [{ parameter: 'Product model', value: 'LT180C' }] },
    {
      group: 'Mechanical',
      items: [
        { parameter: 'Aperture', value: '180 mm' },
        { parameter: 'Material', value: 'SUS304' },
      ],
    },
    { group: 'Electrical', items: [{ parameter: 'Rated power', value: '0.45 kW' }] },
    {
      group: 'Environmental',
      items: [
        { parameter: 'Ingress protection', value: 'IP54' },
        { parameter: 'Operating temperature', value: '0–40 °C' },
      ],
    },
  ],
  conflicts: [
    {
      group: 'Electrical',
      parameter: 'Power supply',
      candidateValues: ['AC 220 V, 50 Hz', 'AC 380 V, 50 Hz'],
    },
  ],
}

/** The real rows product 3 already had — ids included, because the Apply payload is asserted against them. */
const REAL_BETA_EXISTING = [
  {
    id: 4,
    title_en: 'Electrical',
    items: [
      { id: 24, label_en: 'Power supply', value_en: 'AC 220 V, 50 Hz' },
      { id: 25, label_en: 'Rated power', value_en: '0.45 kW' },
    ],
  },
  {
    id: 5,
    title_en: 'Environmental',
    items: [{ id: 27, label_en: 'Operating temperature', value_en: '0–40 °C' }],
  },
] as unknown as typeof BASE_PROPS['existingSpecGroups']

const REAL_BETA_FILES: SourceFileOutcome[] = [
  { displayName: 'LT180C-test-general.txt', status: 'read' },
  { displayName: 'LT180C-test-electrical.txt', status: 'read' },
  { displayName: 'LT180C-test-environment.txt', status: 'read' },
]

const mountRealBeta = () => mountReview({
  proposal: REAL_BETA_PROPOSAL,
  fileResults: REAL_BETA_FILES,
  existingSpecGroups: REAL_BETA_EXISTING,
})

describe('PWS-AI-MULTI-SOURCE-REAL-BETA-01 — the real run, as it was reviewed', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('Gate A — three sources produce ONE combined proposal, all three analyzed', () => {
    const wrapper = mountRealBeta()
    const summary = wrapper.text()
    expect(summary).toContain('LT180C-test-general.txt')
    expect(summary).toContain('LT180C-test-electrical.txt')
    expect(summary).toContain('LT180C-test-environment.txt')
    // One conflict + six proposed items, reviewed on one screen.
    expect(statOf(wrapper, 'safe')).toBe('4')
    expect(statOf(wrapper, 'review')).toBe('3')
  })

  it('Gate B — every safe fact survives review with its value and unit intact', () => {
    const text = mountRealBeta().text()
    for (const fact of ['180 mm', 'IP54', '0.45 kW', '0–40 °C', 'SUS304']) {
      expect(text).toContain(fact)
    }
  })

  it('Gate C — the power-supply disagreement is a conflict, with both real values and no third one', () => {
    const wrapper = mountRealBeta()
    const conflict = wrapper.find('.ws-card--conflict')
    expect(conflict.exists()).toBe(true)
    expect(conflict.text()).toContain('Power supply')
    expect(conflict.text()).toContain('AC 220 V, 50 Hz')
    expect(conflict.text()).toContain('AC 380 V, 50 Hz')

    // Exactly two candidates — the model neither chose nor averaged.
    const candidates = conflict.findAll('input[type="radio"]')
    expect(candidates).toHaveLength(2)
    expect(candidates.every(c => !(c.element as HTMLInputElement).checked)).toBe(true)

    // And it is not sitting in the ordinary proposal list as an ordinary row.
    const proposalRows = wrapper.findAll('tbody tr').map(r => r.text())
    expect(proposalRows.some(r => r.includes('Power supply'))).toBe(false)
  })

  it('Gate D — what the sources refused to state is absent, not guessed', () => {
    const text = mountRealBeta().text()
    expect(text).not.toContain('Net weight')
    expect(text).not.toContain('Detection sensitivity')
    // No invented mass figure crept in under another name.
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s?(kg|lb|lbs)\b/i)
  })

  it('"Accept all safe" accepts the four safe rows and leaves the conflict pending', async () => {
    const wrapper = mountRealBeta()
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('4')
    expect(statOf(wrapper, 'safe')).toBe('0')
    /**
     * The conflict row itself is still pending — this is the whole point.
     * The badge is written lowercase in the DOM and capitalised by CSS, so
     * the assertion reads the badge element rather than the rendered casing.
     */
    const conflictBadge = wrapper.find('.ws-card--conflict .ws-status-badge')
    expect(conflictBadge.text()).toBe('pending')
  })

  it('the human choice of 220 V is what makes the conflict acceptable', async () => {
    const wrapper = mountRealBeta()
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')

    const useSelected = () => wrapper.findAll('button').find(b => b.text() === 'Use selected value')!
    expect((useSelected().element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('.ws-card--conflict input[type="radio"]').setValue()
    await useSelected().trigger('click')

    expect(statOf(wrapper, 'accepted')).toBe('5')
    expect(wrapper.find('.ws-card--conflict .ws-status-badge').text()).toBe('accepted')
  })

  it('Apply writes the four new facts as adds and the chosen 220 V as an UPDATE of the existing row', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: { body?: { changes: Array<Record<string, unknown>> } }) => (
      { ok: true, appliedCount: 5, totalCount: 5, partial: false, message: 'Applied 5 accepted changes to Draft.' }
    ))
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountRealBeta()
    await wrapper.findAll('button').find(b => b.text() === 'Accept all safe')!.trigger('click')
    await wrapper.find('.ws-card--conflict input[type="radio"]').setValue()
    await wrapper.findAll('button').find(b => b.text() === 'Use selected value')!.trigger('click')
    await applyButtonOf(wrapper).trigger('click')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const changes = fetchMock.mock.calls[0][1]!.body!.changes
    expect(changes).toHaveLength(5)

    const adds = changes.filter(c => c.action === 'add')
    expect(adds.map(c => c.parameter).sort()).toEqual(
      ['Aperture', 'Ingress protection', 'Material', 'Product model'],
    )

    /**
     * The conflict resolves against the row the product already had, so
     * accepting 220 V updates spec item 24 rather than adding a SECOND
     * "Power supply" to the Electrical group.
     */
    const updates = changes.filter(c => c.action === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ action: 'update', specItemId: 24, value: 'AC 220 V, 50 Hz' })

    // Nothing the sources declined to state is written under any action.
    const written = JSON.stringify(changes)
    expect(written).not.toContain('Net weight')
    expect(written).not.toContain('Detection sensitivity')
    expect(written).not.toContain('380')
  })
})
