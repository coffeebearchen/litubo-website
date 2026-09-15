// @vitest-environment happy-dom
/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review panel, mounted, with `$fetch` stubbed. Review
 * decisions are local; the only request is "Apply approved changes", which sends one
 * decision per proposal item and never a target, operation, block type or subject.
 * All data is TEST ONLY — NOT FOR PUBLICATION.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentAiProposalReview from '../../components/admin/content/ContentAiProposalReview.vue'
import type { AdminContentAiReview } from '../../types/content-center'
import { acceptAllSafe, applyAvailability, initialReviewState, reviewCounts } from '../../utils/contentAiReview'

function review(extra: Partial<AdminContentAiReview> = {}, proposalExtra: Partial<NonNullable<AdminContentAiReview['proposal']>> = {}): AdminContentAiReview {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', title: 'TEST ONLY — NOT FOR PUBLICATION Guide' },
    locale: 'en',
    default_locale: 'en',
    site_locales: ['en', 'es', 'pt'],
    started_locales: ['en', 'es'],
    locale_started: true,
    draft_revision: 3,
    proposal: {
      proposalRef: 'opaque-ref',
      applyState: 'ready',
      expiresAt: '2026-09-15T12:00:00.000Z',
      draftRevision: 3,
      stale: false,
      lifecycleChanged: false,
      sources: [{ label: 'Source 1', displayName: 'TEST-ONLY-notes.txt' }],
      items: [
        { proposalItemId: 'item-1', target: 'field:title', targetLabel: 'Title', kind: 'field', operation: 'set', maxLength: 160, existingValue: 'TEST ONLY Guide', proposedValue: 'AI title', evidence: [{ label: 'Source 1', displayName: 'TEST-ONLY-notes.txt' }] },
        { proposalItemId: 'item-2', target: 'field:summary', targetLabel: 'Summary', kind: 'field', operation: 'set', maxLength: 400, existingValue: null, proposedValue: 'AI summary.', evidence: [] },
        { proposalItemId: 'item-3', target: 'block:new', targetLabel: 'New FAQ section', kind: 'block_insert', operation: 'insert', maxLength: null, existingValue: null, proposedValue: { type: 'faq', data: { heading: 'FAQ', items: [{ question: 'How often?', answer: 'Each shift.' }] } }, evidence: [{ label: 'Source 1', displayName: 'TEST-ONLY-notes.txt' }] },
      ],
      conflicts: [
        { proposalItemId: 'item-4', target: 'field:seo_title', targetLabel: 'SEO title', maxLength: 120, existingValue: null, candidateValues: ['Title A', 'Title B'] },
      ],
      ...proposalExtra,
    },
    ...extra,
  }
}

function mountReview(value = review()) {
  return mount(ContentAiProposalReview, {
    props: { review: value },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof mountReview>
const card = (w: Wrapper, id: string) => w.find(`[data-item="${id}"]`)
const button = (scope: { findAll: Wrapper['findAll'] }, label: string) => scope.findAll('button').find(b => b.text() === label)!
const applyButton = (w: Wrapper) => w.find('.cpr-apply-btn')

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentAiProposalReview — proposal display', () => {
  it('shows existing vs proposed values, real evidence labels, the sources and the conflict; no confidence, page citation or Publish', () => {
    const w = mountReview()
    expect(w.text()).toContain('AI cannot publish content or make files public.')
    expect(w.find('.cpr-chips').text()).toContain('Source 1 · TEST-ONLY-notes.txt')
    expect(w.text()).toContain('1 conflict needs confirmation')
    const title = card(w, 'item-1')
    expect(title.find('.cpr-target').text()).toBe('Title')
    expect(title.findAll('.cpr-col')[0]!.text()).toContain('TEST ONLY Guide')
    expect(title.findAll('.cpr-col')[1]!.text()).toContain('AI title')
    expect(title.find('.cpr-evidence').text()).toBe('Evidence: Source 1 · TEST-ONLY-notes.txt')
    expect(card(w, 'item-3').text()).toContain('Q: How often?')
    expect(card(w, 'item-4').text()).toContain('Review required')
    expect(w.text()).not.toMatch(/confidence|high|medium|low|p\. \d|page \d|%/i)
    expect(w.findAll('button').map(b => b.text()).some(t => /Publish/.test(t))).toBe(false)
    expect(w.find('input[type="file"]').exists()).toBe(false)
  })

  it('without a proposal: "Proposal expired or unavailable." and a way back to AI Source Intake', () => {
    const w = mountReview(review({ locale: 'es', proposal: null }))
    expect(w.find('.cpr-empty').text()).toContain('Proposal expired or unavailable.')
    expect(w.find('.cpr-empty').text()).toContain('Return to AI Source Intake and analyze again.')
    expect(w.find('.cpr-empty a').attributes('href')).toBe('/admin/content-center/6/ai-source-intake?locale=es')
    expect(w.find('.cpr-apply-btn').exists()).toBe(false)
  })

  it('a stale proposal is read-only with the reason shown', () => {
    const w = mountReview(review({}, { stale: true }))
    expect(w.text()).toContain('The draft changed since this analysis, so this proposal can no longer be applied.')
    expect(button(card(w, 'item-1'), 'Accept').attributes('disabled')).toBeDefined()
    expect(applyButton(w).attributes('disabled')).toBeDefined()
  })
})

describe('ContentAiProposalReview — decisions are local', () => {
  it('Accept all safe accepts pending changes only; the conflict stays unresolved and Apply stays disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountReview()
    expect(applyButton(w).attributes('disabled')).toBeDefined()
    expect(w.find('.cpr-reason').text()).toBe('Review 3 pending proposals first.')
    await button(w, 'Accept all safe').trigger('click')
    for (const id of ['item-1', 'item-2', 'item-3']) expect(card(w, id).find('.cpr-state').text()).toBe('Accepted')
    expect(card(w, 'item-4').find('.cpr-state').text()).toBe('Review required')
    expect(w.find('.cpr-reason').text()).toBe('Resolve 1 conflict first.')
    expect(applyButton(w).attributes('disabled')).toBeDefined()
    expect(w.emitted('dirty')!.at(-1)).toEqual([true])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('the pure rule agrees: a conflict is never accepted by "Accept all safe"', () => {
    const proposal = review().proposal!
    const state = acceptAllSafe(proposal, initialReviewState(proposal))
    expect(state.conflicts['item-4']).toEqual({ status: 'unresolved' })
    expect(reviewCounts(proposal, state)).toMatchObject({ pending: 0, accepted: 3, unresolved: 1, approved: 3 })
    expect(applyAvailability(review(), state)).toEqual({ canApply: false, reason: 'Resolve 1 conflict first.' })
  })

  it('Edit changes the value only; an empty value is refused locally', async () => {
    const w = mountReview()
    await button(card(w, 'item-2'), 'Edit').trigger('click')
    const textarea = card(w, 'item-2').find('textarea')
    expect(card(w, 'item-2').text()).toContain('Edit Summary (value only)')
    await textarea.setValue('   ')
    await button(card(w, 'item-2'), 'Save edit').trigger('click')
    expect(card(w, 'item-2').find('.cpr-error').text()).toBe('Summary cannot be empty.')
    await textarea.setValue('Human summary.')
    await button(card(w, 'item-2'), 'Save edit').trigger('click')
    expect(card(w, 'item-2').find('.cpr-state').text()).toBe('Edited')
    expect(card(w, 'item-2').findAll('.cpr-col')[1]!.text()).toContain('Human summary.')
  })

  it('rejecting everything leaves nothing to apply and sends no request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountReview()
    for (const id of ['item-1', 'item-2', 'item-3', 'item-4']) await button(card(w, id), 'Reject').trigger('click')
    expect(w.find('.cpr-reason').text()).toBe('Accept, edit or choose at least one change to apply.')
    expect(applyButton(w).attributes('disabled')).toBeDefined()
    await applyButton(w).trigger('click')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ContentAiProposalReview — Apply', () => {
  it('sends only decisions (accept, edit, section edit, conflict choice) and shows the Draft-only result', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, applied_count: 4, draft_revision: 4, new_blocks: [{ proposalItemId: 'item-3', blockId: 'b' }] }))
    vi.stubGlobal('$fetch', fetchMock)
    const w = mountReview()
    await button(card(w, 'item-1'), 'Accept').trigger('click')
    await button(card(w, 'item-2'), 'Edit').trigger('click')
    await card(w, 'item-2').find('textarea').setValue('Human summary.')
    await button(card(w, 'item-2'), 'Save edit').trigger('click')
    await button(card(w, 'item-3'), 'Edit').trigger('click')
    const answer = card(w, 'item-3').findAll('textarea')[0]!
    await answer.setValue('Every shift, before production.')
    await button(card(w, 'item-3'), 'Save edit').trigger('click')
    await card(w, 'item-4').findAll('input[type="radio"]')[1]!.setValue(true)
    await button(card(w, 'item-4'), 'Use selected value').trigger('click')
    expect(card(w, 'item-4').text()).toContain('Will apply: Title B')
    expect(applyButton(w).attributes('disabled')).toBeUndefined()

    await applyButton(w).trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/ai-proposal-review', {
      method: 'POST',
      body: {
        locale: 'en',
        proposalRef: 'opaque-ref',
        decisions: [
          { proposalItemId: 'item-1', decision: 'accept' },
          { proposalItemId: 'item-2', decision: 'edit', value: 'Human summary.' },
          { proposalItemId: 'item-3', decision: 'edit', blockData: { heading: 'FAQ', items: [{ question: 'How often?', answer: 'Every shift, before production.' }] } },
          { proposalItemId: 'item-4', decision: 'choose', candidateIndex: 1 },
        ],
      },
    })
    const sent = JSON.stringify((fetchMock.mock.calls[0] as unknown[])[1])
    expect(sent).not.toMatch(/"target"|"operation"|contentItemId|subject|draftRevision/)
    expect(w.find('.cpr-success').text()).toContain('Applied 4 approved changes to Draft.')
    expect(w.find('.cpr-success').text()).toContain('This proposal can no longer be applied. Nothing was published.')
    expect(w.find('.cpr-success a').attributes('href')).toBe('/admin/content-center/6/editor')
    expect(button(card(w, 'item-1'), 'Accept').attributes('disabled')).toBeDefined()
    expect(w.emitted('dirty')!.at(-1)).toEqual([false])
  })

  it('a refused Apply shows the server sentence and keeps the review', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => {
      throw Object.assign(new Error('409'), { statusCode: 409, data: { message: 'This draft changed since the analysis. Nothing was applied — analyze again.' } })
    }))
    const w = mountReview()
    await button(w, 'Accept all safe').trigger('click')
    await button(card(w, 'item-4'), 'Reject').trigger('click')
    await applyButton(w).trigger('click')
    await flushPromises()
    expect(w.find('.cpr-error').text()).toContain('This draft changed since the analysis. Nothing was applied')
    expect(w.find('.cpr-success').exists()).toBe(false)
    expect(card(w, 'item-1').find('.cpr-state').text()).toBe('Accepted')
  })

  it('a custom conflict value must be valid before it counts', async () => {
    const w = mountReview()
    await button(card(w, 'item-4'), 'Edit value').trigger('click')
    await card(w, 'item-4').find('textarea').setValue('x'.repeat(121))
    await button(card(w, 'item-4'), 'Save value').trigger('click')
    expect(card(w, 'item-4').find('.cpr-error').text()).toBe('SEO title must be at most 120 characters.')
    await card(w, 'item-4').find('textarea').setValue('Human SEO title')
    await button(card(w, 'item-4'), 'Save value').trigger('click')
    expect(card(w, 'item-4').find('.cpr-state').text()).toBe('Edited')
    expect(card(w, 'item-4').text()).toContain('Will apply: Human SEO title')
  })
})
