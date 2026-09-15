/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review page helpers (client).
 *
 * Review decisions are browser-local state: nothing is saved until "Apply approved
 * changes", and a reload starts again from the server-held proposal. Every rule here
 * is repeated by the server, which is the authority — the browser only ever sends
 * one decision per `proposalItemId` (accept / edit / reject / choose) and never a
 * target, an operation, a block type or a subject.
 */

import type {
  AdminContentAiBlockValue,
  AdminContentAiReview,
  AdminContentAiReviewConflict,
  AdminContentAiReviewItem,
  ContentAiApplyDecision,
  ContentAiApplyRequest,
} from '../types/content-center'
import { contentApiErrorStatus } from './contentCenter'

export const CONTENT_AI_REVIEW_DISCLOSURE = 'AI suggestions are reviewed before they are applied to the draft. Accept, edit or reject each proposal. AI cannot publish content or make files public.'
export const CONTENT_AI_REVIEW_UNAVAILABLE = 'Proposal expired or unavailable.'
export const CONTENT_AI_REVIEW_UNAVAILABLE_HINT = 'Return to AI Source Intake and analyze again.'
export const CONTENT_AI_REVIEW_DRAFT_ONLY = 'Changes are written to this language\'s draft only. Nothing is published.'
export const CONTENT_AI_REVIEW_LEAVE_MESSAGE = 'You have review decisions that are not applied. They are kept only on this page. Leave without applying?'
export const CONTENT_AI_REVIEW_MEMORY_NOTE = 'Review decisions are kept on this page only. The proposal is kept in server memory and expires after two hours or on a server restart.'

export type ReviewItemState =
  | { status: 'pending' }
  | { status: 'accepted' }
  | { status: 'edited', value?: string, blockData?: Record<string, unknown> }
  | { status: 'rejected' }

export type ReviewConflictState =
  | { status: 'unresolved' }
  | { status: 'chosen', index: number }
  | { status: 'edited', value: string }
  | { status: 'rejected' }

export interface ContentAiReviewState {
  items: Record<string, ReviewItemState>
  conflicts: Record<string, ReviewConflictState>
}

export type ContentAiProposalView = NonNullable<AdminContentAiReview['proposal']>

export function initialReviewState(proposal: ContentAiProposalView): ContentAiReviewState {
  return {
    items: Object.fromEntries(proposal.items.map(i => [i.proposalItemId, { status: 'pending' } as ReviewItemState])),
    conflicts: Object.fromEntries(proposal.conflicts.map(c => [c.proposalItemId, { status: 'unresolved' } as ReviewConflictState])),
  }
}

export function withItemState(state: ContentAiReviewState, id: string, next: ReviewItemState): ContentAiReviewState {
  return { items: { ...state.items, [id]: next }, conflicts: state.conflicts }
}

export function withConflictState(state: ContentAiReviewState, id: string, next: ReviewConflictState): ContentAiReviewState {
  return { items: state.items, conflicts: { ...state.conflicts, [id]: next } }
}

/** "Accept all safe": only pending, non-conflict proposal items. Conflicts, edited and rejected items stay as they are. */
export function acceptAllSafe(proposal: ContentAiProposalView, state: ContentAiReviewState): ContentAiReviewState {
  const items = { ...state.items }
  for (const item of proposal.items) {
    if ((items[item.proposalItemId] ?? { status: 'pending' }).status === 'pending') items[item.proposalItemId] = { status: 'accepted' }
  }
  return { items, conflicts: state.conflicts }
}

export function reviewCounts(proposal: ContentAiProposalView, state: ContentAiReviewState) {
  const itemStates = proposal.items.map(i => state.items[i.proposalItemId]?.status ?? 'pending')
  const conflictStates = proposal.conflicts.map(c => state.conflicts[c.proposalItemId]?.status ?? 'unresolved')
  const count = (list: string[], value: string) => list.filter(s => s === value).length
  const resolved = conflictStates.filter(s => s === 'chosen' || s === 'edited').length
  return {
    total: proposal.items.length + proposal.conflicts.length,
    pending: count(itemStates, 'pending'),
    accepted: count(itemStates, 'accepted'),
    edited: count(itemStates, 'edited') + count(conflictStates, 'edited'),
    rejected: count(itemStates, 'rejected') + count(conflictStates, 'rejected'),
    conflicts: proposal.conflicts.length,
    unresolved: count(conflictStates, 'unresolved'),
    approved: count(itemStates, 'accepted') + count(itemStates, 'edited') + resolved,
  }
}

export function isReviewDirty(state: ContentAiReviewState): boolean {
  return Object.values(state.items).some(s => s.status !== 'pending') || Object.values(state.conflicts).some(s => s.status !== 'unresolved')
}

export function editedFieldProblem(value: string, maxLength: number | null, label: string): string | null {
  const text = value.trim()
  if (!text) return `${label} cannot be empty.`
  if (maxLength !== null && text.length > maxLength) return `${label} must be at most ${maxLength} characters.`
  return null
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const list = (data: Record<string, unknown>, key: string) => (Array.isArray(data[key]) ? data[key] as Array<Record<string, unknown>> : [])

/** A quick completeness check of an edited section; the server's block registry is the authority. */
export function editedBlockProblem(value: AdminContentAiBlockValue): string | null {
  const { type, data } = value
  if (type === 'text') {
    const paragraphs = Array.isArray(data.paragraphs) ? data.paragraphs.filter(p => str(p).trim()) : []
    return paragraphs.length === 0 ? 'A text section needs at least one paragraph.' : null
  }
  if (type === 'key_points') {
    const items = list(data, 'items')
    return items.length === 0 || items.some(i => !str(i.title).trim()) ? 'Every key point needs a title.' : null
  }
  if (type === 'faq') {
    const items = list(data, 'items')
    return items.length === 0 || items.some(i => !str(i.question).trim() || !str(i.answer).trim()) ? 'Every question needs a question and an answer.' : null
  }
  if (type === 'cta') return str(data.label).trim() ? null : 'A call to action needs a button label.'
  return null
}

export function paragraphsFromText(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

/** Plain-text lines of a section value, for side-by-side display (never HTML). */
export function blockValueLines(value: AdminContentAiBlockValue): string[] {
  const { type, data } = value
  const lines: string[] = []
  if (str(data.heading)) lines.push(str(data.heading))
  if (type === 'text' && Array.isArray(data.paragraphs)) lines.push(...data.paragraphs.map(str).filter(Boolean))
  if (type === 'key_points') for (const i of list(data, 'items')) lines.push([str(i.title), str(i.body)].filter(Boolean).join(' — '))
  if (type === 'faq') for (const i of list(data, 'items')) lines.push(`Q: ${str(i.question)}`, `A: ${str(i.answer)}`)
  if (type === 'cta') lines.push(...[str(data.body), str(data.label) && `Button: ${str(data.label)}`, str(data.href) && `Link: ${str(data.href)}`].filter(Boolean))
  return lines
}

function itemProblem(item: AdminContentAiReviewItem, state: ReviewItemState | undefined): string | null {
  if (state?.status !== 'edited') return null
  if (item.kind === 'field') return editedFieldProblem(state.value ?? '', item.maxLength, item.targetLabel)
  const proposed = item.proposedValue as AdminContentAiBlockValue
  return editedBlockProblem({ type: proposed.type, data: state.blockData ?? {} })
}

function conflictProblem(conflict: AdminContentAiReviewConflict, state: ReviewConflictState | undefined): string | null {
  return state?.status === 'edited' ? editedFieldProblem(state.value, conflict.maxLength, conflict.targetLabel) : null
}

export interface ApplyAvailability {
  canApply: boolean
  reason: string | null
}

export function applyAvailability(review: AdminContentAiReview, state: ContentAiReviewState): ApplyAvailability {
  const proposal = review.proposal
  const no = (reason: string): ApplyAvailability => ({ canApply: false, reason })
  if (!proposal) return no(CONTENT_AI_REVIEW_UNAVAILABLE)
  if (review.item.status === 'archived') return no('This content item is archived.')
  if (proposal.applyState === 'applied' || proposal.applyState === 'partial') return no('This proposal has already been applied.')
  if (proposal.applyState === 'applying') return no('This proposal is being applied.')
  if (proposal.stale) return no('The draft changed since this analysis. Analyze again.')
  if (proposal.lifecycleChanged) return no('This content was archived, restored, published or unpublished since the analysis. Analyze again.')
  const counts = reviewCounts(proposal, state)
  if (counts.pending > 0) return no(`Review ${counts.pending} pending proposal${counts.pending === 1 ? '' : 's'} first.`)
  if (counts.unresolved > 0) return no(`Resolve ${counts.unresolved} conflict${counts.unresolved === 1 ? '' : 's'} first.`)
  const invalid = proposal.items.some(i => itemProblem(i, state.items[i.proposalItemId]))
    || proposal.conflicts.some(c => conflictProblem(c, state.conflicts[c.proposalItemId]))
  if (invalid) return no('Fix the edited values first.')
  if (counts.approved === 0) return no('Accept, edit or choose at least one change to apply.')
  return { canApply: true, reason: null }
}

export function itemEditProblem(item: AdminContentAiReviewItem, state: ContentAiReviewState): string | null {
  return itemProblem(item, state.items[item.proposalItemId])
}

export function conflictEditProblem(conflict: AdminContentAiReviewConflict, state: ContentAiReviewState): string | null {
  return conflictProblem(conflict, state.conflicts[conflict.proposalItemId])
}

/** One decision per proposal item and conflict — nothing else. Call only when `applyAvailability` allows it. */
export function buildApplyRequest(review: AdminContentAiReview, state: ContentAiReviewState): ContentAiApplyRequest {
  const proposal = review.proposal!
  const decisions: ContentAiApplyDecision[] = []
  for (const item of proposal.items) {
    const s = state.items[item.proposalItemId]
    if (!s || s.status === 'pending') continue
    if (s.status === 'accepted') decisions.push({ proposalItemId: item.proposalItemId, decision: 'accept' })
    else if (s.status === 'rejected') decisions.push({ proposalItemId: item.proposalItemId, decision: 'reject' })
    else if (item.kind === 'field') decisions.push({ proposalItemId: item.proposalItemId, decision: 'edit', value: s.value ?? '' })
    else decisions.push({ proposalItemId: item.proposalItemId, decision: 'edit', blockData: s.blockData ?? {} })
  }
  for (const conflict of proposal.conflicts) {
    const s = state.conflicts[conflict.proposalItemId]
    if (!s || s.status === 'unresolved') continue
    if (s.status === 'chosen') decisions.push({ proposalItemId: conflict.proposalItemId, decision: 'choose', candidateIndex: s.index })
    else if (s.status === 'edited') decisions.push({ proposalItemId: conflict.proposalItemId, decision: 'edit', value: s.value })
    else decisions.push({ proposalItemId: conflict.proposalItemId, decision: 'reject' })
  }
  return { locale: review.locale, proposalRef: proposal.proposalRef, decisions }
}

export function appliedMessage(count: number): string {
  return `Applied ${count} approved change${count === 1 ? '' : 's'} to Draft.`
}

/** A safe sentence for a refused Apply; nothing internal is shown. */
export function interpretContentAiApplyError(err: unknown): string {
  const status = contentApiErrorStatus(err)
  const message = (err as { data?: { message?: unknown } } | null)?.data?.message
  const serverMessage = typeof message === 'string' && message.trim() ? message : null
  if (status === 400 || status === 409 || status === 422 || status === 500 || status === 502) return serverMessage ?? 'These changes could not be applied. Nothing was applied — reload and try again.'
  if (status === 401) return 'Your session has expired. Sign in again, then apply.'
  if (status === 403) return 'You do not have permission to apply changes to this content item.'
  if (status === 404) return 'This content item was not found.'
  if (status === 413) return 'These changes are too large to apply at once.'
  return 'The changes could not be applied right now. Try again.'
}
