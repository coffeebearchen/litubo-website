import { randomBytes, createHash } from 'node:crypto'

/**
 * PWS-AI-DUP-GUARD-01 — stops the same analysis being paid for twice, and the
 * same proposal being written to a Draft twice.
 *
 * The guards that already existed stop the easy cases: the Analyze button
 * disables itself while a request is in flight, the server allows one
 * generation per administrator per product at a time with a cooldown, and a
 * media association id is only ever processed once per request. None of them
 * helps with the cases this module is about:
 *
 *  - two different files whose CONTENT is identical, so id-level dedupe sees
 *    nothing to collapse;
 *  - the same analysis run again a minute later over unchanged sources, which
 *    is a fresh request by every existing measure and a second bill;
 *  - an Apply that reaches the server twice — a double click that beat the
 *    disable, a second tab, or a browser that never saw the first response and
 *    tried again.
 *
 * The last one is the reason this is server-side. A disabled button cannot
 * help a request that has already left the browser.
 *
 * Everything here is single-instance in-memory state, deliberately, and the
 * same MVP position `aiGenerateRateLimit.ts` takes: no Redis, no new Directus
 * collection, no table, no queue. Under Charter FD-004 that is proportionate
 * to a single-product Draft-only workflow, and it is documented as such rather
 * than described as a distributed guarantee.
 */

/** How long a validated analysis stays reusable. */
export const SUCCESS_REUSE_TTL_MS = 10 * 60 * 1000

/**
 * Ten minutes, not five. The window has to cover the way this screen is
 * actually used: a reviewer analyses a product, works through thirteen
 * proposals, gets interrupted, comes back and re-runs the analysis because the
 * page was refreshed and the in-memory session is gone. Five minutes expires
 * inside that gap and bills again for an identical result. Ten covers it while
 * still being short enough that a genuinely changed source is never served
 * from cache — and a changed source changes the fingerprint anyway, so the TTL
 * is a bound on staleness, not the thing that detects change.
 */

/**
 * PWS-AI-DUP-GUARD-01-MIN-01 — how long a PROPOSAL stays applicable, which is
 * a different question from how long an ANALYSIS stays reusable.
 *
 * These were one value, and that was wrong. Reuse is about not paying for the
 * same model call twice, so ten minutes is generous. Applying is about a
 * person: they analyse a product, work down thirty proposed parameters,
 * check two conflicts against the real specifications, get interrupted, come
 * back. Ten minutes does not cover that, and under the old shared deadline
 * their reviewed work simply stopped being applicable — the proposal was still
 * on screen, every decision still made, and the server had quietly forgotten
 * the reference it needed.
 *
 * Two hours covers a real review with interruptions. It is still short-term
 * in-memory state; it is not a Proposal history and nothing is persisted.
 */
export const PROPOSAL_APPLY_TTL_MS = 2 * 60 * 60 * 1000

/**
 * Hard ceiling on the REUSE cache only. Reaching it drops the analyses closest
 * to expiring, so a later identical request pays for the model again — an
 * acceptable cost. It deliberately does NOT touch proposal records: evicting
 * one of those would break an Apply that a person is still working towards.
 */
export const MAX_CACHED_ANALYSES = 50

/**
 * A memory backstop on tracked proposals, far above any real review workload
 * (the Generate cooldown alone caps how many can be created). It exists so the
 * map cannot grow without limit, not as a workflow limit, and it evicts the
 * proposals closest to their own apply deadline rather than the newest work.
 */
export const MAX_TRACKED_PROPOSALS = 500

/**
 * Where a proposal is in its one and only write.
 *
 *   ready    — never applied; an Apply may claim it
 *   applying — an Apply is running right now; a second one must not write
 *   applied  — written; it can never be written again
 *   partial  — a write started and stopped part way; also terminal, because
 *              replaying it would re-add whatever already landed
 */
export type ProposalApplyState = 'ready' | 'applying' | 'applied' | 'partial'

/** The result shape Apply reports back, kept structural so this file does not depend on the writer. */
export interface RecordedApplyResult {
  ok: boolean
  appliedCount: number
  totalCount: number
  partial: boolean
  message: string
}

interface ProposalRecord {
  proposalRef: string
  scopeKey: string
  adminUserId: string
  productId: number
  output: unknown
  applyState: ProposalApplyState
  /** The outcome of the write that reached a terminal state, replayed verbatim to a duplicate request. */
  appliedResult: RecordedApplyResult | null
  /** When this analysis stops being reusable — the cheap, short deadline. */
  reuseExpiresAt: number
  /** When this proposal stops being applicable — the one a person's review time depends on. */
  applyExpiresAt: number
}

/** Everything a reuse lookup is scoped by. Two analyses are the same only if all of it matches. */
export interface AnalysisScope {
  adminUserId: string
  productId: number
  targetId: string
  providerId: string
  fingerprint: string
}

const byScope = new Map<string, ProposalRecord>()
const byRef = new Map<string, ProposalRecord>()

function scopeKeyOf(scope: AnalysisScope): string {
  // Every field is length-prefixed so no combination of values can collide by
  // running into the separator.
  return [scope.adminUserId, String(scope.productId), scope.targetId, scope.providerId, scope.fingerprint]
    .map(part => `${part.length}:${part}`)
    .join('|')
}

/** Still worth serving from the reuse cache. */
function isReusable(record: ProposalRecord, now: number): boolean {
  return record.reuseExpiresAt > now
}

/** Still applicable by the person who reviewed it. Outlives reusability by design. */
function isApplicable(record: ProposalRecord, now: number): boolean {
  return record.applyExpiresAt > now
}

/**
 * PWS-AI-DUP-GUARD-01-MIN-01 — the two maps expire independently.
 *
 * An analysis leaves the reuse cache after ten minutes; its proposal stays
 * applicable for two hours. Deleting the reference alongside the cache entry
 * is exactly the bug this fixes: it made a reviewer's finished work
 * unapplyable while it was still on their screen.
 */
function dropExpired(now: number): void {
  for (const [key, record] of byScope) {
    if (!isReusable(record, now)) byScope.delete(key)
  }
  for (const [ref, record] of byRef) {
    if (!isApplicable(record, now)) byRef.delete(ref)
  }
}

/**
 * Trims the REUSE cache only. A dropped entry costs a future identical request
 * one model call; it must never cost a reviewer their pending Apply, so the
 * proposal reference is deliberately left in place.
 */
function enforceReuseCeiling(): void {
  if (byScope.size <= MAX_CACHED_ANALYSES) return
  const ordered = [...byScope.values()].sort((a, b) => a.reuseExpiresAt - b.reuseExpiresAt)
  for (const record of ordered.slice(0, byScope.size - MAX_CACHED_ANALYSES)) {
    byScope.delete(record.scopeKey)
  }
}

/** Memory backstop on tracked proposals; drops those closest to their own apply deadline. */
function enforceProposalCeiling(): void {
  if (byRef.size <= MAX_TRACKED_PROPOSALS) return
  const ordered = [...byRef.values()].sort((a, b) => a.applyExpiresAt - b.applyExpiresAt)
  for (const record of ordered.slice(0, byRef.size - MAX_TRACKED_PROPOSALS)) {
    byRef.delete(record.proposalRef)
    byScope.delete(record.scopeKey)
  }
}

/**
 * Derives the analysis fingerprint.
 *
 * The source digests are sorted, so picking the same three files in a
 * different order is the same analysis — the order files were clicked in is
 * not a business input, and letting it change the fingerprint would bill twice
 * for identical work.
 *
 * The digests themselves are content hashes computed by the caller; the source
 * text never reaches this module.
 *
 * PRODUCT-MODEL-RELEVANCE-GUARD-01 — the product code and the prompt contract
 * version are part of the identity too. A cached analysis answers the question
 * that was asked: once the current product's code changes, or the shared prompt
 * contract asks the model something different, an analysis made under the old
 * question must not be replayed as the answer to the new one. Every input is a
 * plain value from the caller; nothing time-, random- or session-dependent is
 * ever part of a fingerprint.
 */
export function buildAnalysisFingerprint(parts: {
  productId: number
  targetId: string
  providerId: string
  productName: string
  /** The current product's code as stored, or null when it has none. */
  productCode: string | null
  /** `PROMPT_CONTRACT_VERSION` of the prompt contract the analysis was made under. */
  promptContractVersion: number
  sourceDigests: string[]
}): string {
  const canonical = JSON.stringify({
    p: parts.productId,
    t: parts.targetId,
    v: parts.providerId,
    n: parts.productName,
    c: parts.productCode,
    pv: parts.promptContractVersion,
    d: [...parts.sourceDigests].sort(),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

/** SHA-256 of one extracted source's text. Used only to compare and to build the fingerprint. */
export function digestSourceText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export interface ReusableAnalysis<TOutput> {
  proposalRef: string
  output: TOutput
  /** True when this analysis has already been written to the Draft, so Apply must stay closed. */
  alreadyApplied: boolean
}

/**
 * Returns a still-valid analysis for this exact scope, or null.
 *
 * A cache hit deliberately returns the ORIGINAL `proposalRef`. Minting a fresh
 * one here would hand the caller a clean slate and let a re-analysis walk
 * straight past the Apply guard — which is the single most valuable thing this
 * module does.
 */
export function lookupAnalysis<TOutput>(scope: AnalysisScope, now = Date.now()): ReusableAnalysis<TOutput> | null {
  dropExpired(now)
  const record = byScope.get(scopeKeyOf(scope))
  if (!record || !isReusable(record, now)) return null
  return {
    proposalRef: record.proposalRef,
    output: record.output as TOutput,
    alreadyApplied: record.applyState === 'applied' || record.applyState === 'partial',
  }
}

/** Records a freshly validated analysis and mints its proposal reference. */
export function rememberAnalysis(scope: AnalysisScope, output: unknown, now = Date.now()): string {
  dropExpired(now)
  const existing = byScope.get(scopeKeyOf(scope))
  // Should not normally happen (the caller looks first), but never replace a
  // reusable record: its proposalRef may already be mid-Apply.
  if (existing && isReusable(existing, now)) return existing.proposalRef

  const record: ProposalRecord = {
    // 32 random bytes: unguessable, and carrying nothing derivable — not a
    // product id, not a Directus id, not the fingerprint.
    proposalRef: randomBytes(32).toString('base64url'),
    scopeKey: scopeKeyOf(scope),
    adminUserId: scope.adminUserId,
    productId: scope.productId,
    output,
    applyState: 'ready',
    appliedResult: null,
    reuseExpiresAt: now + SUCCESS_REUSE_TTL_MS,
    applyExpiresAt: now + PROPOSAL_APPLY_TTL_MS,
  }
  byScope.set(record.scopeKey, record)
  byRef.set(record.proposalRef, record)
  enforceReuseCeiling()
  enforceProposalCeiling()
  return record.proposalRef
}

export type ApplyClaim =
  | { ok: true }
  | { ok: false, reason: 'unknown' }
  | { ok: false, reason: 'in-progress' }
  | { ok: false, reason: 'terminal', state: ProposalApplyState, appliedResult: RecordedApplyResult | null }

/**
 * Claims the one write this proposal is allowed.
 *
 * The reference must belong to this administrator AND this product: a
 * reference is a handle to a specific person's work on a specific Draft, never
 * a token that works anywhere.
 */
export function claimApply(
  proposalRef: unknown,
  binding: { adminUserId: string, productId: number },
  now = Date.now(),
): ApplyClaim {
  if (typeof proposalRef !== 'string' || proposalRef.length === 0) return { ok: false, reason: 'unknown' }
  dropExpired(now)

  const record = byRef.get(proposalRef)
  if (!record || !isApplicable(record, now)) return { ok: false, reason: 'unknown' }
  if (record.adminUserId !== binding.adminUserId) return { ok: false, reason: 'unknown' }
  if (record.productId !== binding.productId) return { ok: false, reason: 'unknown' }

  if (record.applyState === 'applying') return { ok: false, reason: 'in-progress' }
  if (record.applyState === 'applied' || record.applyState === 'partial') {
    return { ok: false, reason: 'terminal', state: record.applyState, appliedResult: record.appliedResult }
  }

  record.applyState = 'applying'
  return { ok: true }
}

/**
 * Records how the claimed write ended.
 *
 * Anything that actually changed the Draft is terminal — including a batch
 * that stopped part way, and including R1's case where a new group was created
 * but its item was not. Replaying either would duplicate rows that already
 * exist. Only a run that provably wrote nothing returns the reference to
 * `ready`, so the reviewer can correct the request and try again.
 */
export function settleApply(proposalRef: string, result: RecordedApplyResult, now = Date.now()): void {
  const record = byRef.get(proposalRef)
  if (!record || !isApplicable(record, now)) return

  const wroteSomething = result.appliedCount > 0 || result.partial
  if (result.ok) {
    record.applyState = 'applied'
    record.appliedResult = result
    return
  }
  if (wroteSomething) {
    record.applyState = 'partial'
    record.appliedResult = result
    return
  }
  record.applyState = 'ready'
  record.appliedResult = null
}

/** Returns a claimed reference to `ready` after a refusal that wrote nothing at all. */
export function releaseApply(proposalRef: string, now = Date.now()): void {
  const record = byRef.get(proposalRef)
  if (!record || !isApplicable(record, now)) return
  if (record.applyState === 'applying') record.applyState = 'ready'
}

/** Test-only reset. Never called by a request handler. */
export function resetProposalGuard(): void {
  byScope.clear()
  byRef.clear()
}
