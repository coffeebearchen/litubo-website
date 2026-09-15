import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import type { FetchFn } from './mediaLifecycle'
import { claimApply, findLatestProposal, readProposal, releaseApply, settleApply } from './aiProposalReplayGuard'
import { contentSubjectKey } from './aiSubject'
import type { ContentAiProposal, ContentAiProposalConflict, ContentAiProposalItem, ContentProposalBinding } from './aiContentIntake'
import { CONTENT_DRAFT_TARGET_ID, CONTENT_FIELD_TARGET_LIMITS, type ContentFieldTarget } from './aiTargets/contentDraftTarget'
import { validateBlocks } from './contentBlocks'
import { isDraftRevisionConflict, isLifecycleGuardRejection } from './contentDraft'
import { CONTENT_BLOCK_LABELS } from '../../utils/contentCenter'
import type { ContentBlock, ContentBlockType } from '../../utils/contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { getContentType, type ContentTypeId } from '../../utils/contentTypes'
import type {
  AdminContentAiApplyResult,
  AdminContentAiBlockValue,
  AdminContentAiReview,
  AdminContentAiReviewConflict,
  AdminContentAiReviewItem,
  ContentItemStatus,
} from '../../types/content-center'

/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review & Apply (CONTENT-CENTER-BLUEPRINT-V1 §17, §18;
 * RELEASE-SAFETY-GATES RSG-04 primary, RSG-03, RSG-05).
 *
 * Review reads the server-held proposal of the signed-in administrator for one content
 * item and one exact locale. Apply accepts only decisions: for every `proposalItemId`
 * of that proposal, accept / edit / reject (and choose for a conflict). Target,
 * operation, block type, block order and the subject are always taken from the stored
 * proposal and its binding — never from the request.
 *
 * Preconditions, all checked with zero writes: proposal available, owned by this admin
 * and bound to this item + locale, not applied or being applied; every item decided and
 * every conflict resolved; item not archived and its lifecycle marker unchanged since the
 * analysis (Archive / Restore / Publish status change invalidates the proposal); locale
 * row present with the draft revision the analysis read.
 *
 * Write: ONE PATCH of that locale's working copy — the approved fields, the whole
 * validated blocks array (replacements in place, inserts appended in stored proposal
 * order with server-generated ids), `draft_revision + 1` and `last_change_kind = ai_apply`.
 * The database draft revision guard and lifecycle guard are the final authority. Apply
 * never writes item status or any publication field and calls no publication or
 * lifecycle handler.
 *
 * Error convention (Blueprint §18): 400 unreadable body · 409 proposal unavailable,
 * expired, applied or in progress, binding / decision mismatch, incomplete review, stale
 * draft, archived or changed lifecycle · 422 an edited value fails validation, or nothing
 * was approved. No rejection writes anything.
 */

export const CONTENT_AI_APPLY_BODY_MAX_BYTES = 256 * 1024

export const CONTENT_AI_REVIEW_MESSAGES = {
  unavailable: 'Proposal expired or unavailable. Return to AI Source Intake and analyze again.',
  alreadyApplied: 'This proposal has already been applied to the draft. Analyze again for new suggestions.',
  inProgress: 'This proposal is already being applied.',
  stale: 'This draft changed since the analysis. Nothing was applied — analyze again.',
  lifecycleChanged: 'This content was archived, restored, published or unpublished since the analysis. Nothing was applied — analyze again.',
  lifecycleRace: 'This content was archived or restored while applying. Nothing was applied — reload to see its current state.',
  archived: 'This content item is archived. Nothing was applied.',
  mismatch: 'These decisions do not match the proposal. Nothing was applied — reload the review.',
  incomplete: 'Review every proposal and resolve every conflict before applying. Nothing was applied.',
  nothing: 'No change was approved. Nothing was applied.',
  duplicateTarget: 'Two approved changes set the same field. Reject one of them. Nothing was applied.',
  unreadable: 'These decisions could not be read. Nothing was applied.',
  writeFailed: 'The draft could not be updated right now. Nothing was applied — try again.',
  outcomeUnknown: 'The result of this Apply could not be confirmed. Open the Content editor to check the draft before doing anything else. This proposal cannot be applied again.',
} as const

const M = CONTENT_AI_REVIEW_MESSAGES

type Row = Record<string, unknown>
type FieldName = 'title' | 'summary' | 'seo_title' | 'seo_description'

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

const unavailable = (): never => fail(409, M.unavailable, { code: 'proposal_unavailable' })
const mismatch = (): never => fail(409, M.mismatch, { code: 'decision_mismatch' })

const FIELD_OF: Record<ContentFieldTarget, FieldName> = {
  'field:title': 'title',
  'field:summary': 'summary',
  'field:seo_title': 'seo_title',
  'field:seo_description': 'seo_description',
}

const FIELD_LABELS: Record<ContentFieldTarget, string> = {
  'field:title': 'Title',
  'field:summary': 'Summary',
  'field:seo_title': 'SEO title',
  'field:seo_description': 'SEO description',
}

function isFieldTarget(target: string): target is ContentFieldTarget {
  return Object.hasOwn(CONTENT_FIELD_TARGET_LIMITS, target)
}

// ── Request ─────────────────────────────────────────────────────────────────

const DecisionSchema = z.object({
  proposalItemId: z.string().regex(/^item-\d{1,4}$/),
  decision: z.enum(['accept', 'edit', 'reject', 'choose']),
  value: z.string().max(4000).optional(),
  blockData: z.record(z.string(), z.unknown()).optional(),
  candidateIndex: z.number().int().min(0).max(5).optional(),
  /** Optional echo only: compared with the stored proposal, never used as a value. */
  target: z.string().max(80).optional(),
  operation: z.string().max(20).optional(),
}).strict()

const ApplyBodySchema = z.object({
  locale: z.string().max(10),
  proposalRef: z.string().min(1).max(200),
  decisions: z.array(DecisionSchema).min(1).max(100),
}).strict()

export type ContentAiDecision = z.infer<typeof DecisionSchema>

// ── Loads (read only) ───────────────────────────────────────────────────────

interface LoadedItem {
  id: number
  content_type: string
  status: ContentItemStatus
  date_updated: string | null
}

interface LoadedRow {
  id: number
  title: string | null
  summary: string | null
  seo_title: string | null
  seo_description: string | null
  blocks: ContentBlock[]
  draft_revision: number
}

async function loadItem(fetch: FetchFn, itemId: number): Promise<LoadedItem | null> {
  const res = await fetch<{ data: Row[] }>(`/items/content_items?filter[id][_eq]=${itemId}&fields=id,content_type,status,date_updated&limit=1`)
  const row = (res.data ?? []).find(r => r.id === itemId)
  if (!row) return null
  return {
    id: itemId,
    content_type: String(row.content_type),
    status: row.status as ContentItemStatus,
    date_updated: typeof row.date_updated === 'string' ? row.date_updated : null,
  }
}

/** The working copy of one locale; the published copy is never requested. */
async function loadLocaleRow(fetch: FetchFn, itemId: number, locale: ContentLocale): Promise<LoadedRow | null> {
  const res = await fetch<{ data: Row[] }>(
    `/items/content_item_locales?filter[content_items_id][_eq]=${itemId}&filter[locale][_eq]=${locale}`
    + '&fields=id,content_items_id,locale,title,summary,seo_title,seo_description,blocks,draft_revision&limit=1',
  )
  const row = (res.data ?? []).find(r => r.content_items_id === itemId && r.locale === locale)
  if (!row) return null
  return {
    id: row.id as number,
    title: (row.title as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    seo_title: (row.seo_title as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    blocks: Array.isArray(row.blocks) ? row.blocks as ContentBlock[] : [],
    draft_revision: Number(row.draft_revision),
  }
}

async function loadStartedLocales(fetch: FetchFn, itemId: number): Promise<ContentLocale[]> {
  const res = await fetch<{ data: Row[] }>(`/items/content_item_locales?filter[content_items_id][_eq]=${itemId}&fields=content_items_id,locale&limit=20`)
  const started = new Set((res.data ?? []).filter(r => r.content_items_id === itemId).map(r => r.locale))
  return CONTENT_LOCALES.filter(l => started.has(l))
}

/** A stored proposal only when it is bound to exactly this content item and locale. */
function boundProposal(proposalRef: unknown, adminUserId: string, itemId: number, locale: ContentLocale) {
  const stored = readProposal<ContentAiProposal, ContentProposalBinding>(proposalRef, { adminUserId, subjectKey: contentSubjectKey(itemId, locale) })
  return stored && isBoundTo(stored.binding, itemId, locale) ? stored : null
}

function isBoundTo(binding: ContentProposalBinding | null | undefined, itemId: number, locale: ContentLocale): binding is ContentProposalBinding {
  return !!binding && binding.subject?.kind === 'content' && binding.subject.id === itemId && binding.subject.locale === locale
    && binding.targetId === CONTENT_DRAFT_TARGET_ID && Number.isInteger(binding.draftRevision)
}

// ── Review read ─────────────────────────────────────────────────────────────

function blockLabel(type: string): string {
  return CONTENT_BLOCK_LABELS[type as ContentBlockType] ?? 'Section'
}

function targetLabel(target: string, proposed: ContentAiProposalItem['proposedValue'] | null, blocks: readonly ContentBlock[]): string {
  if (isFieldTarget(target)) return FIELD_LABELS[target]
  if (target === 'block:new') return `New ${blockLabel(typeof proposed === 'object' && proposed ? proposed.type : '')} section`
  const id = target.slice('block:'.length).toLowerCase()
  const index = blocks.findIndex(b => String(b.id).toLowerCase() === id)
  const type = index >= 0 ? blocks[index]!.type : typeof proposed === 'object' && proposed ? proposed.type : ''
  return index >= 0 ? `${blockLabel(type)} section ${index + 1}` : `${blockLabel(type)} section`
}

function blockValue(value: { type: string, data: Record<string, unknown> }): AdminContentAiBlockValue {
  return { type: value.type as ContentBlockType, data: value.data }
}

function reviewItem(item: ContentAiProposalItem, blocks: readonly ContentBlock[]): AdminContentAiReviewItem {
  const field = isFieldTarget(item.target)
  return {
    proposalItemId: item.proposalItemId,
    target: item.target,
    targetLabel: targetLabel(item.target, item.proposedValue, blocks),
    kind: field ? 'field' : item.operation === 'insert' ? 'block_insert' : 'block_replace',
    operation: item.operation,
    maxLength: field ? CONTENT_FIELD_TARGET_LIMITS[item.target as ContentFieldTarget] : null,
    existingValue: item.existingValue === null ? null : typeof item.existingValue === 'string' ? item.existingValue : blockValue(item.existingValue),
    proposedValue: typeof item.proposedValue === 'string' ? item.proposedValue : blockValue(item.proposedValue),
    evidence: item.evidence.map(e => ({ label: e.label, displayName: e.displayName })),
  }
}

function reviewConflict(conflict: ContentAiProposalConflict): AdminContentAiReviewConflict {
  const target = conflict.target as ContentFieldTarget
  return {
    proposalItemId: conflict.proposalItemId,
    target: conflict.target,
    targetLabel: FIELD_LABELS[target] ?? 'Field',
    maxLength: CONTENT_FIELD_TARGET_LIMITS[target] ?? 0,
    existingValue: conflict.existingValue,
    candidateValues: [...conflict.candidateValues],
  }
}

/**
 * The newest proposal of this admin for this item and exact locale, as a safe DTO. No
 * Directus id, file id, fingerprint or prompt; the reference is returned only so this
 * admin's page can submit decisions for it.
 */
export async function getContentAiProposalReview(
  fetch: FetchFn,
  itemId: number,
  rawLocale: unknown,
  adminUserId: string,
  now = Date.now(),
): Promise<AdminContentAiReview> {
  const locale = rawLocale === undefined || rawLocale === null || rawLocale === '' ? DEFAULT_CONTENT_LOCALE : rawLocale
  if (!isContentLocale(locale)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })

  const item = await loadItem(fetch, itemId)
  if (!item) fail(404, `Content item ${itemId} not found.`)
  const [row, startedLocales] = await Promise.all([loadLocaleRow(fetch, itemId, locale), loadStartedLocales(fetch, itemId)])

  const latest = row ? findLatestProposal<ContentAiProposal, ContentProposalBinding>({ adminUserId, subjectKey: contentSubjectKey(itemId, locale) }, now) : null
  const proposal = latest && isBoundTo(latest.binding, itemId, locale) && row
    ? {
        proposalRef: latest.proposalRef,
        applyState: latest.applyState,
        expiresAt: new Date(latest.applyExpiresAt).toISOString(),
        draftRevision: latest.binding.draftRevision,
        stale: row.draft_revision !== latest.binding.draftRevision,
        lifecycleChanged: item.date_updated !== (latest.binding.itemUpdatedAt ?? null),
        sources: (latest.output.sources ?? []).map(s => ({ label: s.label, displayName: s.displayName })),
        items: latest.output.items.map(i => reviewItem(i, row.blocks)),
        conflicts: latest.output.conflicts.map(reviewConflict),
      }
    : null

  return {
    item: { id: itemId, content_type: item.content_type as ContentTypeId, status: item.status, title: row?.title ?? null },
    locale,
    default_locale: DEFAULT_CONTENT_LOCALE,
    site_locales: [...CONTENT_LOCALES],
    started_locales: startedLocales,
    locale_started: row !== null,
    draft_revision: row?.draft_revision ?? null,
    proposal,
  }
}

// ── Decisions → approved changes (pure) ─────────────────────────────────────

export type ApprovedChange =
  | { proposalItemId: string, kind: 'field', target: ContentFieldTarget, field: FieldName, value: string }
  | { proposalItemId: string, kind: 'replace', blockId: string, type: ContentBlockType, data: Record<string, unknown> }
  | { proposalItemId: string, kind: 'insert', type: ContentBlockType, data: Record<string, unknown> }

function fieldValue(target: ContentFieldTarget, raw: string, proposalItemId: string): string {
  const value = raw.trim()
  const label = FIELD_LABELS[target]
  const limit = CONTENT_FIELD_TARGET_LIMITS[target]
  if (!value) fail(422, `${label} cannot be empty.`, { code: 'invalid_value', proposalItemId })
  if (value.length > limit) fail(422, `${label} must be at most ${limit} characters.`, { code: 'invalid_value', proposalItemId })
  return value
}

const hasPayload = (d: ContentAiDecision) => d.value !== undefined || d.blockData !== undefined || d.candidateIndex !== undefined

/**
 * Maps the submitted decisions onto the stored proposal. Every stored item and conflict
 * must be decided exactly once; an unknown or repeated id, a decision that does not fit
 * the item's class (a conflict can never be simply accepted), or a target / operation
 * echo that differs from the stored one is a mismatch. Returns the approved changes in
 * the stored proposal order.
 */
export function planContentAiDecisions(proposal: ContentAiProposal, decisions: readonly ContentAiDecision[]): ApprovedChange[] {
  const items = new Map(proposal.items.map(i => [i.proposalItemId, i]))
  const conflicts = new Map(proposal.conflicts.map(c => [c.proposalItemId, c]))
  const byId = new Map<string, ContentAiDecision>()
  for (const decision of decisions) {
    const id = decision.proposalItemId
    if (byId.has(id) || (!items.has(id) && !conflicts.has(id))) mismatch()
    const stored = items.get(id) ?? conflicts.get(id)!
    const storedOperation = items.get(id)?.operation ?? 'set'
    if (decision.target !== undefined && decision.target !== stored.target) mismatch()
    if (decision.operation !== undefined && decision.operation !== storedOperation) mismatch()
    byId.set(id, decision)
  }
  if (byId.size !== items.size + conflicts.size) fail(409, M.incomplete, { code: 'review_incomplete' })

  const approved: ApprovedChange[] = []
  for (const item of proposal.items) {
    const d = byId.get(item.proposalItemId)!
    if (d.decision === 'reject') {
      if (hasPayload(d)) mismatch()
      continue
    }
    if (d.decision === 'choose') mismatch()
    const field = isFieldTarget(item.target)
    if (d.decision === 'accept' && hasPayload(d)) mismatch()
    if (d.decision === 'edit') {
      if (d.candidateIndex !== undefined) mismatch()
      if (field ? (d.value === undefined || d.blockData !== undefined) : (d.blockData === undefined || d.value !== undefined)) mismatch()
    }
    if (field) {
      const target = item.target as ContentFieldTarget
      const raw = d.decision === 'edit' ? d.value! : typeof item.proposedValue === 'string' ? item.proposedValue : mismatch()
      approved.push({ proposalItemId: item.proposalItemId, kind: 'field', target, field: FIELD_OF[target], value: fieldValue(target, raw, item.proposalItemId) })
      continue
    }
    if (typeof item.proposedValue === 'string') mismatch()
    const proposed = item.proposedValue as { type: ContentBlockType, data: Record<string, unknown> }
    const data = d.decision === 'edit' ? d.blockData! : proposed.data
    if (item.operation === 'insert' && item.target === 'block:new') {
      approved.push({ proposalItemId: item.proposalItemId, kind: 'insert', type: proposed.type, data })
    } else if (item.operation === 'replace' && item.target.startsWith('block:') && item.target !== 'block:new') {
      approved.push({ proposalItemId: item.proposalItemId, kind: 'replace', blockId: item.target.slice('block:'.length).toLowerCase(), type: proposed.type, data })
    } else {
      mismatch()
    }
  }
  for (const conflict of proposal.conflicts) {
    const d = byId.get(conflict.proposalItemId)!
    if (!isFieldTarget(conflict.target)) mismatch()
    const target = conflict.target as ContentFieldTarget
    if (d.decision === 'reject') {
      if (hasPayload(d)) mismatch()
      continue
    }
    let raw: string
    if (d.decision === 'choose') {
      if (d.candidateIndex === undefined || d.value !== undefined || d.blockData !== undefined) mismatch()
      raw = conflict.candidateValues[d.candidateIndex!] ?? mismatch()
    } else if (d.decision === 'edit') {
      if (d.value === undefined || d.blockData !== undefined || d.candidateIndex !== undefined) mismatch()
      raw = d.value!
    } else {
      // A conflict is resolved only by an explicit choice, an edit or a rejection — never accepted as is.
      mismatch()
    }
    approved.push({ proposalItemId: conflict.proposalItemId, kind: 'field', target, field: FIELD_OF[target], value: fieldValue(target, raw!, conflict.proposalItemId) })
  }

  const targets = new Set<string>()
  for (const change of approved) {
    if (change.kind === 'insert') continue
    const key = change.kind === 'field' ? change.target : `block:${change.blockId}`
    if (targets.has(key)) fail(422, M.duplicateTarget, { code: 'duplicate_target', proposalItemId: change.proposalItemId })
    targets.add(key)
  }
  if (approved.length === 0) fail(422, M.nothing, { code: 'nothing_to_apply' })
  return approved
}

/** The next working copy for the approved changes; validated as a whole, exactly like a human save. */
export function buildContentAiDraftPatch(
  row: Pick<LoadedRow, 'blocks'>,
  approved: readonly ApprovedChange[],
  allowedBlocks: readonly ContentBlockType[],
  newId: () => string,
): { patch: Row, newBlocks: Array<{ proposalItemId: string, blockId: string }> } {
  const patch: Row = {}
  const blocks: ContentBlock[] = row.blocks.map(b => ({ ...b }))
  const newBlocks: Array<{ proposalItemId: string, blockId: string }> = []
  let blocksChanged = false
  for (const change of approved) {
    if (change.kind === 'field') {
      patch[change.field] = change.value
    } else if (change.kind === 'replace') {
      const index = blocks.findIndex(b => String(b.id).toLowerCase() === change.blockId)
      if (index < 0 || blocks[index]!.type !== change.type || change.type === 'image') mismatch()
      blocks[index] = { id: blocks[index]!.id, type: change.type, data: change.data }
      blocksChanged = true
    } else {
      if (change.type === 'image' || !allowedBlocks.includes(change.type)) mismatch()
      const blockId = newId()
      blocks.push({ id: blockId, type: change.type, data: change.data })
      newBlocks.push({ proposalItemId: change.proposalItemId, blockId })
      blocksChanged = true
    }
  }
  if (blocksChanged) {
    const checked = validateBlocks(blocks, allowedBlocks)
    if (!checked.ok) fail(422, 'An approved section is not valid. Edit or reject it. Nothing was applied.', { code: 'invalid_value', field: 'blocks', errors: checked.errors })
    patch.blocks = checked.blocks
  }
  return { patch, newBlocks }
}

// ── Apply ───────────────────────────────────────────────────────────────────

export interface ContentAiApplyOptions {
  newId?: () => string
}

export async function applyContentAiProposal(
  fetch: FetchFn,
  itemId: number,
  rawBody: unknown,
  adminUserId: string,
  options: ContentAiApplyOptions = {},
): Promise<AdminContentAiApplyResult> {
  const parsed = ApplyBodySchema.safeParse(rawBody)
  if (!parsed.success || !isContentLocale(parsed.data.locale)) fail(400, M.unreadable)
  const { proposalRef, decisions } = parsed.data
  const locale = parsed.data.locale as ContentLocale
  const access = { adminUserId, subjectKey: contentSubjectKey(itemId, locale) }

  const stored = boundProposal(proposalRef, adminUserId, itemId, locale)
  if (!stored) unavailable()
  const binding = stored!.binding
  if (stored!.applyState === 'applied' || stored!.applyState === 'partial') fail(409, M.alreadyApplied, { code: 'already_applied' })
  if (stored!.applyState === 'applying') fail(409, M.inProgress, { code: 'apply_in_progress' })

  const approved = planContentAiDecisions(stored!.output, decisions)

  // The one write this proposal is allowed, claimed before any database read or write.
  const claim = claimApply(proposalRef, access)
  if (!claim.ok) {
    if (claim.reason === 'in-progress') fail(409, M.inProgress, { code: 'apply_in_progress' })
    if (claim.reason === 'terminal') fail(409, M.alreadyApplied, { code: 'already_applied' })
    unavailable()
  }

  let rowId: number
  let prepared: ReturnType<typeof buildContentAiDraftPatch>
  try {
    const item = await loadItem(fetch, itemId)
    if (!item) unavailable()
    if (item!.status === 'archived') fail(409, M.archived, { code: 'archived' })
    if (item!.date_updated !== (binding.itemUpdatedAt ?? null)) fail(409, M.lifecycleChanged, { code: 'lifecycle_changed' })
    const row = await loadLocaleRow(fetch, itemId, locale)
    if (!row) unavailable()
    if (row!.draft_revision !== binding.draftRevision) fail(409, M.stale, { code: 'stale_draft', currentDraftRevision: row!.draft_revision })
    const type = getContentType(item!.content_type)
    if (!type) mismatch()
    prepared = buildContentAiDraftPatch(row!, approved, type!.allowedBlocks, options.newId ?? randomUUID)
    prepared.patch.draft_revision = binding.draftRevision + 1
    prepared.patch.last_change_kind = 'ai_apply'
    rowId = row!.id
  } catch (err) {
    releaseApply(proposalRef)
    throw err
  }

  try {
    await fetch(`/items/content_item_locales/${rowId}?fields=id`, { method: 'PATCH', body: prepared.patch })
  } catch (err) {
    // The database refused the whole statement: nothing was written and the proposal stays reviewable.
    if (isDraftRevisionConflict(err)) {
      releaseApply(proposalRef)
      fail(409, M.stale, { code: 'stale_draft' })
    }
    if (isLifecycleGuardRejection(err)) {
      releaseApply(proposalRef)
      fail(409, M.lifecycleRace, { code: 'lifecycle_changed' })
    }
    // Unknown outcome: only a read-back that still shows the analysed revision proves nothing was written.
    let unchanged = false
    try {
      unchanged = (await loadLocaleRow(fetch, itemId, locale))?.draft_revision === binding.draftRevision
    } catch {
      unchanged = false
    }
    if (unchanged) {
      releaseApply(proposalRef)
      fail(502, M.writeFailed, { code: 'apply_failed' })
    }
    settleApply(proposalRef, { ok: false, appliedCount: 0, totalCount: approved.length, partial: true, message: M.outcomeUnknown })
    fail(500, M.outcomeUnknown, { code: 'apply_outcome_unknown' })
  }

  settleApply(proposalRef, { ok: true, appliedCount: approved.length, totalCount: approved.length, partial: false, message: 'Applied to draft.' })
  return { ok: true, applied_count: approved.length, draft_revision: binding.draftRevision + 1, new_blocks: prepared.newBlocks }
}
