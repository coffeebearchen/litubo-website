/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review & Apply (server).
 *
 * Proposals are seeded straight into the real in-memory replay guard, exactly as a
 * successful Analyze stores them (no provider, no API key). A fake Directus holds one
 * TEST ONLY content item with an English and a Spanish locale row and emulates the two
 * database authorities the Apply relies on: the draft revision guard (a working-copy
 * change must carry revision + 1) and the lifecycle guard (no locale write while the
 * item is archived). Every Directus call is recorded, so a write is always visible.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import {
  CONTENT_AI_REVIEW_MESSAGES as M,
  applyContentAiProposal,
  getContentAiProposalReview,
} from '../server/utils/aiContentApply'
import type { ContentAiProposal, ContentProposalBinding } from '../server/utils/aiContentIntake'
import { PROPOSAL_APPLY_TTL_MS, readProposal, rememberAnalysis, resetProposalGuard } from '../server/utils/aiProposalReplayGuard'
import { mapHistoryRevision } from '../server/utils/contentHistory'
import type { FetchFn } from '../server/utils/mediaLifecycle'

const ITEM = 6
const ADMIN = 'admin-1'
const MARK = 'TEST ONLY — NOT FOR PUBLICATION'
const BLOCK_TEXT = '11111111-2222-4333-8444-555555555555'
const BLOCK_FAQ = '22222222-3333-4444-8555-666666666666'
const WORKING = ['title', 'slug', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex']

type LocaleRow = Record<string, unknown> & { id: number, locale: string, draft_revision: number }

interface World {
  item: { id: number, content_type: string, status: string, date_updated: string | null }
  locales: Record<string, LocaleRow>
}

function world(): World {
  return {
    item: { id: ITEM, content_type: 'technical_article', status: 'draft', date_updated: null },
    locales: {
      en: {
        id: 60, content_items_id: ITEM, locale: 'en', slug: 'test-only-guide',
        title: `${MARK} Guide`, summary: 'Working summary.', seo_title: null, seo_description: null,
        canonical_path: null, noindex: false,
        blocks: [
          { id: BLOCK_TEXT, type: 'text', data: { heading: 'Introduction', paragraphs: ['Working paragraph.'] } },
          { id: BLOCK_FAQ, type: 'faq', data: { heading: 'FAQ', items: [{ question: 'Old question?', answer: 'Old answer.' }] } },
        ],
        draft_revision: 3, published_snapshot: null, published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit',
      },
      es: {
        id: 61, content_items_id: ITEM, locale: 'es', slug: 'test-only-guia', title: `${MARK} Guía`, summary: null, seo_title: null, seo_description: null,
        canonical_path: null, noindex: false, blocks: [], draft_revision: 2, published_snapshot: null, published_revision: null, published_at: null,
        first_published_at: null, last_change_kind: 'manual_edit',
      },
    },
  }
}

interface Hooks {
  beforePatch?: () => void
  failure?: 'network-before-write' | 'network-after-write'
}

function guardError(field: string) {
  return Object.assign(new Error('guard'), { data: { errors: [{ message: 'guard', extensions: { code: 'RECORD_NOT_UNIQUE', field } }] } })
}

function directus(w: World, hooks: Hooks = {}) {
  const calls: Array<{ path: string, method: string, body?: Record<string, unknown> }> = []
  const param = (path: string, key: string) => path.match(new RegExp(`filter\\[${key}\\]\\[_eq\\]=([^&]+)`))?.[1]
  const fetch = (async <T>(path: string, options?: { method?: string, body?: Record<string, unknown> }): Promise<T> => {
    const method = options?.method ?? 'GET'
    calls.push({ path, method, body: options?.body })
    if (method === 'PATCH') {
      const match = path.match(/^\/items\/content_item_locales\/(\d+)\?fields=id$/)
      if (!match) throw new Error(`unexpected PATCH ${path}`)
      hooks.beforePatch?.()
      if (hooks.failure === 'network-before-write') throw new Error('socket hang up')
      const row = Object.values(w.locales).find(r => r.id === Number(match[1]))!
      const body = options!.body!
      if (w.item.status === 'archived') throw guardError('content_lifecycle')
      const changed = WORKING.some(k => k in body && JSON.stringify(body[k]) !== JSON.stringify(row[k]))
      const revisionMoves = 'draft_revision' in body && body.draft_revision !== row.draft_revision
      if ((revisionMoves && body.draft_revision !== row.draft_revision + 1) || (changed && body.draft_revision !== row.draft_revision + 1)) throw guardError('draft_revision')
      Object.assign(row, JSON.parse(JSON.stringify(body)))
      if (hooks.failure === 'network-after-write') throw new Error('socket hang up')
      return { data: { id: row.id } } as T
    }
    if (method !== 'GET') throw new Error(`unexpected ${method} ${path}`)
    if (path.startsWith('/items/content_items?')) {
      return { data: Number(param(path, 'id')) === w.item.id ? [{ ...w.item }] : [] } as T
    }
    if (path.startsWith('/items/content_item_locales?')) {
      const itemId = Number(param(path, 'content_items_id'))
      const locale = param(path, 'locale')
      const rows = Object.values(w.locales).filter(r => r.content_items_id === itemId && (!locale || r.locale === locale))
      return { data: JSON.parse(JSON.stringify(rows)) } as T
    }
    throw new Error(`unexpected path ${path}`)
  }) as FetchFn
  const patches = () => calls.filter(c => c.method === 'PATCH')
  return { fetch, calls, patches }
}

function proposal(overrides: Partial<ContentAiProposal> = {}): ContentAiProposal {
  return {
    items: [
      { proposalItemId: 'item-1', target: 'field:title', operation: 'set', existingValue: `${MARK} Guide`, proposedValue: 'AI title', evidence: [{ label: 'Source 1', displayName: 'notes.txt' }] },
      { proposalItemId: 'item-2', target: 'field:summary', operation: 'set', existingValue: 'Working summary.', proposedValue: 'AI summary.', evidence: [{ label: 'Source 1', displayName: 'notes.txt' }] },
      { proposalItemId: 'item-3', target: 'field:seo_title', operation: 'set', existingValue: null, proposedValue: 'AI SEO title', evidence: [] },
      { proposalItemId: 'item-4', target: `block:${BLOCK_TEXT}`, operation: 'replace', existingValue: { type: 'text', data: { heading: 'Introduction', paragraphs: ['Working paragraph.'] } }, proposedValue: { type: 'text', data: { heading: 'Introduction', paragraphs: ['AI paragraph.'] } }, evidence: [{ label: 'Source 1', displayName: 'notes.txt' }] },
      { proposalItemId: 'item-5', target: 'block:new', operation: 'insert', existingValue: null, proposedValue: { type: 'faq', data: { heading: 'More questions', items: [{ question: 'How often?', answer: 'Each shift.' }] } }, evidence: [{ label: 'Source 1', displayName: 'notes.txt' }] },
      { proposalItemId: 'item-6', target: 'block:new', operation: 'insert', existingValue: null, proposedValue: { type: 'key_points', data: { heading: 'Key points', items: [{ title: 'Placement', body: 'After packaging.' }] } }, evidence: [] },
    ],
    conflicts: [
      { proposalItemId: 'item-7', target: 'field:seo_description', existingValue: null, candidateValues: ['Description A.', 'Description B.'] },
    ],
    sources: [{ label: 'Source 1', displayName: 'notes.txt' }],
    ...overrides,
  }
}

let fingerprintSeq = 0
function seed(options: { output?: ContentAiProposal, locale?: string, itemId?: number, admin?: string, draftRevision?: number, itemUpdatedAt?: string | null, now?: number } = {}): string {
  const output = options.output ?? proposal()
  const locale = options.locale ?? 'en'
  const itemId = options.itemId ?? ITEM
  const binding: ContentProposalBinding = {
    subject: { kind: 'content', id: itemId, locale: locale as 'en' },
    draftRevision: options.draftRevision ?? 3,
    itemUpdatedAt: options.itemUpdatedAt ?? null,
    targetId: 'content-draft',
    items: [...output.items, ...output.conflicts.map(c => ({ ...c, operation: 'set' as const }))].map(i => ({ proposalItemId: i.proposalItemId, target: i.target, operation: i.operation })),
    sourceFingerprint: 'test-fingerprint',
    promptContractVersion: 3,
  }
  const scope = { adminUserId: options.admin ?? ADMIN, subjectKey: `content:${itemId}:${locale}`, targetId: 'content-draft', providerId: 'deepseek', fingerprint: `fp-${++fingerprintSeq}` }
  return rememberAnalysis(scope, output, options.now ?? Date.now(), binding)
}

type Decision = Record<string, unknown>
const FULL_DECISIONS = (): Decision[] => [
  { proposalItemId: 'item-1', decision: 'accept' },
  { proposalItemId: 'item-2', decision: 'edit', value: '  Human summary.  ' },
  { proposalItemId: 'item-3', decision: 'reject' },
  { proposalItemId: 'item-4', decision: 'accept' },
  { proposalItemId: 'item-5', decision: 'accept' },
  { proposalItemId: 'item-6', decision: 'accept' },
  { proposalItemId: 'item-7', decision: 'choose', candidateIndex: 1 },
]

const body = (ref: string, decisions: Decision[] = FULL_DECISIONS(), extra: Record<string, unknown> = {}) => ({ locale: 'en', proposalRef: ref, decisions, ...extra })

async function refusal(run: () => Promise<unknown>): Promise<{ status: number, code?: string, message?: string }> {
  try {
    await run()
  } catch (err) {
    const e = err as { statusCode?: number, message?: string, data?: { code?: string } }
    return { status: e.statusCode ?? -1, code: e.data?.code, message: e.message }
  }
  throw new Error('expected a refusal')
}

let ids = 0
const newId = () => `aaaaaaaa-bbbb-4ccc-8ddd-${String(++ids).padStart(12, '0')}`

const stateOf = (ref: string, locale = 'en', admin = ADMIN) => readProposal(ref, { adminUserId: admin, subjectKey: `content:${ITEM}:${locale}` })?.applyState

beforeEach(() => {
  resetProposalGuard()
  ids = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ── Review read ─────────────────────────────────────────────────────────────

describe('GET review — the signed-in admin\'s newest proposal for this item and exact locale', () => {
  it('returns labels, existing vs proposed values, evidence and sources, with no binding internals and no write', async () => {
    const w = world()
    const { fetch, patches } = directus(w)
    seed()
    const newest = seed()
    const review = await getContentAiProposalReview(fetch, ITEM, 'en', ADMIN)
    expect(review.locale_started).toBe(true)
    expect(review.draft_revision).toBe(3)
    expect(review.proposal!.proposalRef).toBe(newest)
    expect(review.proposal).toMatchObject({ applyState: 'ready', draftRevision: 3, stale: false, lifecycleChanged: false })
    expect(review.proposal!.items.map(i => [i.targetLabel, i.kind, i.operation])).toEqual([
      ['Title', 'field', 'set'],
      ['Summary', 'field', 'set'],
      ['SEO title', 'field', 'set'],
      ['Text section 1', 'block_replace', 'replace'],
      ['New FAQ section', 'block_insert', 'insert'],
      ['New Key points section', 'block_insert', 'insert'],
    ])
    expect(review.proposal!.items[0]).toMatchObject({ existingValue: `${MARK} Guide`, proposedValue: 'AI title', maxLength: 160, evidence: [{ label: 'Source 1', displayName: 'notes.txt' }] })
    expect(review.proposal!.conflicts).toEqual([{ proposalItemId: 'item-7', target: 'field:seo_description', targetLabel: 'SEO description', maxLength: 320, existingValue: null, candidateValues: ['Description A.', 'Description B.'] }])
    expect(review.proposal!.sources).toEqual([{ label: 'Source 1', displayName: 'notes.txt' }])
    const json = JSON.stringify(review)
    expect(json).not.toMatch(/test-fingerprint|sourceFingerprint|promptContractVersion|itemUpdatedAt|confidence/i)
    expect(patches()).toHaveLength(0)
  })

  it('isolates by admin, content item and locale; an unstarted locale and a restart show no proposal', async () => {
    const { fetch } = directus(world())
    seed()
    expect((await getContentAiProposalReview(fetch, ITEM, 'en', 'admin-2')).proposal).toBeNull()
    expect((await getContentAiProposalReview(fetch, ITEM, 'es', ADMIN)).proposal).toBeNull()
    const pt = await getContentAiProposalReview(fetch, ITEM, 'pt', ADMIN)
    expect(pt).toMatchObject({ locale: 'pt', locale_started: false, draft_revision: null, proposal: null })
    resetProposalGuard()
    expect((await getContentAiProposalReview(fetch, ITEM, 'en', ADMIN)).proposal).toBeNull()
  })

  it('flags a stale draft and a changed lifecycle; refuses an unknown locale (422) and item (404)', async () => {
    const w = world()
    const { fetch } = directus(w)
    seed()
    w.locales.en!.draft_revision = 4
    expect((await getContentAiProposalReview(fetch, ITEM, 'en', ADMIN)).proposal).toMatchObject({ stale: true, lifecycleChanged: false })
    w.locales.en!.draft_revision = 3
    w.item.date_updated = '2026-09-15T10:00:00.000Z'
    expect((await getContentAiProposalReview(fetch, ITEM, 'en', ADMIN)).proposal).toMatchObject({ stale: false, lifecycleChanged: true })
    expect((await refusal(() => getContentAiProposalReview(fetch, ITEM, 'zh', ADMIN))).status).toBe(422)
    expect((await refusal(() => getContentAiProposalReview(fetch, 99, 'en', ADMIN))).status).toBe(404)
  })
})

// ── Valid Apply ─────────────────────────────────────────────────────────────

describe('Apply — approved changes to this locale\'s working draft in one PATCH', () => {
  it('accept / edit / reject / replace / two inserts / conflict choice → exact draft, revision +1 once, ai_apply', async () => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w))
    const { fetch, patches } = directus(w)
    const ref = seed()
    const result = await applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId })

    expect(result).toEqual({
      ok: true,
      applied_count: 6,
      draft_revision: 4,
      new_blocks: [
        { proposalItemId: 'item-5', blockId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' },
        { proposalItemId: 'item-6', blockId: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002' },
      ],
    })
    expect(patches()).toHaveLength(1)
    const patch = patches()[0]!
    expect(patch.path).toBe('/items/content_item_locales/60?fields=id')
    expect(Object.keys(patch.body!).sort()).toEqual(['blocks', 'draft_revision', 'last_change_kind', 'seo_description', 'summary', 'title'])
    const en = w.locales.en!
    expect(en).toMatchObject({ title: 'AI title', summary: 'Human summary.', seo_title: null, seo_description: 'Description B.', draft_revision: 4, last_change_kind: 'ai_apply' })
    expect(en.blocks).toEqual([
      { id: BLOCK_TEXT, type: 'text', data: { heading: 'Introduction', paragraphs: ['AI paragraph.'] } },
      before.locales.en.blocks[1],
      { id: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', type: 'faq', data: { heading: 'More questions', items: [{ question: 'How often?', answer: 'Each shift.' }] } },
      { id: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002', type: 'key_points', data: { heading: 'Key points', items: [{ title: 'Placement', body: 'After packaging.' }] } },
    ])
    // Draft only: item, publication fields, slug / canonical / noindex and the other locale are untouched.
    expect(w.item).toEqual(before.item)
    for (const key of ['slug', 'canonical_path', 'noindex', 'published_snapshot', 'published_revision', 'published_at', 'first_published_at']) expect(en[key]).toEqual(before.locales.en[key])
    expect(w.locales.es).toEqual(before.locales.es)
    expect(stateOf(ref)).toBe('applied')
  })

  it('a published item keeps its snapshot and status: Apply changes the working copy only', async () => {
    const w = world()
    w.item.status = 'published'
    Object.assign(w.locales.en!, { published_snapshot: { title: 'SNAPSHOT' }, published_revision: 3, published_at: '2026-09-01T00:00:00.000Z', first_published_at: '2026-09-01T00:00:00.000Z', last_change_kind: 'publish' })
    const { fetch } = directus(w)
    const ref = seed()
    await applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId })
    expect(w.item.status).toBe('published')
    expect(w.locales.en).toMatchObject({ published_snapshot: { title: 'SNAPSHOT' }, published_revision: 3, published_at: '2026-09-01T00:00:00.000Z', draft_revision: 4, last_change_kind: 'ai_apply' })
  })

  it('a custom conflict value and an edited section are validated and written', async () => {
    const w = world()
    const { fetch } = directus(w)
    const ref = seed()
    const decisions = FULL_DECISIONS().map(d => ({ ...d }))
    decisions[4] = { proposalItemId: 'item-5', decision: 'edit', blockData: { heading: 'Edited FAQ', items: [{ question: 'Edited?', answer: 'Yes.' }] } }
    decisions[6] = { proposalItemId: 'item-7', decision: 'edit', value: 'Human description.' }
    await applyContentAiProposal(fetch, ITEM, body(ref, decisions), ADMIN, { newId })
    expect(w.locales.en!.seo_description).toBe('Human description.')
    expect((w.locales.en!.blocks as Array<{ data: unknown }>)[2]!.data).toEqual({ heading: 'Edited FAQ', items: [{ question: 'Edited?', answer: 'Yes.' }] })
  })

  it('valid text, key_points, faq and cta sections pass the registry; image is never insertable', async () => {
    const w = world()
    const { fetch } = directus(w)
    const output = proposal({
      items: [
        { proposalItemId: 'item-1', target: 'block:new', operation: 'insert', existingValue: null, proposedValue: { type: 'text', data: { paragraphs: ['A.'] } }, evidence: [] },
        { proposalItemId: 'item-2', target: 'block:new', operation: 'insert', existingValue: null, proposedValue: { type: 'cta', data: { heading: 'Talk to us', label: 'Contact', href: '/contact' } }, evidence: [] },
      ],
      conflicts: [],
    })
    const ref = seed({ output })
    const result = await applyContentAiProposal(fetch, ITEM, body(ref, [{ proposalItemId: 'item-1', decision: 'accept' }, { proposalItemId: 'item-2', decision: 'accept' }]), ADMIN, { newId })
    expect(result.applied_count).toBe(2)
    expect((w.locales.en!.blocks as Array<{ type: string }>).map(b => b.type)).toEqual(['text', 'faq', 'text', 'cta'])

    const imageRef = seed({ output: proposal({ items: [{ proposalItemId: 'item-1', target: 'block:new', operation: 'insert', existingValue: null, proposedValue: { type: 'image', data: { fileLinkId: 1 } }, evidence: [] }], conflicts: [] }), draftRevision: 4 })
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(imageRef, [{ proposalItemId: 'item-1', decision: 'accept' }]), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'decision_mismatch' })
    expect(w.locales.en!.draft_revision).toBe(4)
  })
})

// ── Tampering and incomplete review ─────────────────────────────────────────

describe('Apply — tampered, incomplete or invalid decisions write nothing', () => {
  const replace = (index: number, decision: Decision) => {
    const list = FULL_DECISIONS()
    list[index] = decision
    return list
  }

  const cases: Array<[string, (ref: string) => Record<string, unknown>, number, string | undefined]> = [
    ['unknown proposalItemId', ref => body(ref, [...FULL_DECISIONS(), { proposalItemId: 'item-99', decision: 'accept' }]), 409, 'decision_mismatch'],
    ['duplicate proposalItemId', ref => body(ref, [...FULL_DECISIONS(), { proposalItemId: 'item-1', decision: 'reject' }]), 409, 'decision_mismatch'],
    ['missing proposalItemId', ref => body(ref, FULL_DECISIONS().slice(1)), 409, 'review_incomplete'],
    ['target tampering (title → status)', ref => body(ref, replace(0, { proposalItemId: 'item-1', decision: 'accept', target: 'field:status' })), 409, 'decision_mismatch'],
    ['field target tampering (title → slug)', ref => body(ref, replace(0, { proposalItemId: 'item-1', decision: 'accept', target: 'field:slug' })), 409, 'decision_mismatch'],
    ['operation tampering', ref => body(ref, replace(3, { proposalItemId: 'item-4', decision: 'accept', operation: 'insert' })), 409, 'decision_mismatch'],
    ['block id tampering', ref => body(ref, replace(3, { proposalItemId: 'item-4', decision: 'accept', target: `block:${BLOCK_FAQ}` })), 409, 'decision_mismatch'],
    ['extra unproposed change in the body', ref => body(ref, FULL_DECISIONS(), { changes: [{ target: 'field:slug', value: 'x' }] }), 400, undefined],
    ['client-supplied subject', ref => body(ref, FULL_DECISIONS(), { contentItemId: 7 }), 400, undefined],
    ['conflict auto-accept attempt', ref => body(ref, replace(6, { proposalItemId: 'item-7', decision: 'accept' })), 409, 'decision_mismatch'],
    ['conflict candidate out of range', ref => body(ref, replace(6, { proposalItemId: 'item-7', decision: 'choose', candidateIndex: 4 })), 409, 'decision_mismatch'],
    ['block payload on a field item', ref => body(ref, replace(0, { proposalItemId: 'item-1', decision: 'edit', blockData: { paragraphs: ['x'] } })), 409, 'decision_mismatch'],
    ['field value on a section item', ref => body(ref, replace(3, { proposalItemId: 'item-4', decision: 'edit', value: 'text' })), 409, 'decision_mismatch'],
    ['invalid edited section', ref => body(ref, replace(3, { proposalItemId: 'item-4', decision: 'edit', blockData: { paragraphs: [] } })), 422, 'invalid_value'],
    ['unknown key inside an edited section', ref => body(ref, replace(4, { proposalItemId: 'item-5', decision: 'edit', blockData: { items: [{ question: 'q', answer: 'a' }], html: '<b>x</b>' } })), 422, 'invalid_value'],
    ['empty edited title', ref => body(ref, replace(0, { proposalItemId: 'item-1', decision: 'edit', value: '   ' })), 422, 'invalid_value'],
    ['edited title over 160 characters', ref => body(ref, replace(0, { proposalItemId: 'item-1', decision: 'edit', value: 'x'.repeat(161) })), 422, 'invalid_value'],
    ['every change rejected', ref => body(ref, FULL_DECISIONS().map(d => ({ proposalItemId: d.proposalItemId, decision: 'reject' }))), 422, 'nothing_to_apply'],
    ['unreadable locale', ref => ({ ...body(ref), locale: 'fr' }), 400, undefined],
  ]

  it.each(cases)('%s', async (_label, makeBody, status, code) => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w))
    const { fetch, patches } = directus(w)
    const ref = seed()
    const result = await refusal(() => applyContentAiProposal(fetch, ITEM, makeBody(ref), ADMIN, { newId }))
    expect(result.status).toBe(status)
    if (code) expect(result.code).toBe(code)
    expect(patches()).toHaveLength(0)
    expect(w).toEqual(before)
    expect(stateOf(ref)).toBe('ready')
  })

  it('two approved changes for the same field (a direct change and a conflict) are refused (422)', async () => {
    const w = world()
    const { fetch, patches } = directus(w)
    const output = proposal()
    output.conflicts = [{ proposalItemId: 'item-7', target: 'field:title', existingValue: `${MARK} Guide`, candidateValues: ['Title A', 'Title B'] }]
    const ref = seed({ output })
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 422, code: 'duplicate_target' })
    expect(patches()).toHaveLength(0)
  })
})

// ── Binding, lifecycle and replay ───────────────────────────────────────────

describe('Apply — binding, draft revision, expiry, restart, replay and lifecycle', () => {
  it('A/en proposal → A/es, → B/en and → another admin: unavailable, nothing written', async () => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w))
    const { fetch, patches } = directus(w)
    const ref = seed()
    for (const [itemId, locale, admin] of [[ITEM, 'es', ADMIN], [7, 'en', ADMIN], [ITEM, 'en', 'admin-2']] as const) {
      const r = await refusal(() => applyContentAiProposal(fetch, itemId, { ...body(ref), locale }, admin, { newId }))
      expect(r).toMatchObject({ status: 409, code: 'proposal_unavailable', message: M.unavailable })
    }
    expect(patches()).toHaveLength(0)
    expect(w).toEqual(before)
    expect(stateOf(ref)).toBe('ready')
  })

  it('a stale draft revision is refused (409) and the proposal is not consumed', async () => {
    const w = world()
    w.locales.en!.draft_revision = 4
    const { fetch, patches } = directus(w)
    const ref = seed()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'stale_draft' })
    expect(patches()).toHaveLength(0)
    expect(stateOf(ref)).toBe('ready')
  })

  it('an expired Content proposal is unavailable (409) and the draft is unchanged', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T08:00:00.000Z'))
    const w = world()
    const before = JSON.parse(JSON.stringify(w))
    const { fetch, patches } = directus(w)
    const ref = seed()
    vi.setSystemTime(new Date(Date.now() + PROPOSAL_APPLY_TTL_MS + 1000))
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'proposal_unavailable' })
    expect(patches()).toHaveLength(0)
    expect(w).toEqual(before)
  })

  it('a lost proposal after a restart (fresh replay guard) is unavailable (409) and nothing is reconstructed', async () => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w))
    const { fetch, patches } = directus(w)
    const ref = seed()
    resetProposalGuard()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'proposal_unavailable' })
    expect(patches()).toHaveLength(0)
    expect(w).toEqual(before)
    expect(stateOf(ref)).toBeUndefined()
  })

  it('an applied proposal cannot be applied again: revision increments once', async () => {
    const w = world()
    const { fetch, patches } = directus(w)
    const ref = seed()
    await applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId })
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'already_applied' })
    expect(patches()).toHaveLength(1)
    expect(w.locales.en!.draft_revision).toBe(4)
  })

  it('two concurrent Applies of the same proposal: one wins, one is refused, the draft changes once', async () => {
    const w = world()
    const { fetch, patches } = directus(w)
    const ref = seed()
    const results = await Promise.allSettled([
      applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }),
      applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult
    expect((rejected.reason as { statusCode: number }).statusCode).toBe(409)
    expect(patches()).toHaveLength(1)
    expect(w.locales.en!.draft_revision).toBe(4)
  })

  it('two different proposals from the same revision: the second is stale after the first applies', async () => {
    const w = world()
    const { fetch, patches } = directus(w)
    const first = seed()
    const second = seed()
    await applyContentAiProposal(fetch, ITEM, body(first), ADMIN, { newId })
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(second), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'stale_draft' })
    expect(patches()).toHaveLength(1)
  })

  it('an Editor save that commits between the check and the write wins; the stale Apply is refused by the guard', async () => {
    const w = world()
    const { fetch, patches } = directus(w, {
      beforePatch: () => {
        Object.assign(w.locales.en!, { title: 'Editor wins', draft_revision: 4, last_change_kind: 'manual_edit' })
      },
    })
    const ref = seed()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'stale_draft' })
    expect(patches()).toHaveLength(1)
    expect(w.locales.en).toMatchObject({ title: 'Editor wins', draft_revision: 4, last_change_kind: 'manual_edit' })
    expect(stateOf(ref)).toBe('ready')
  })

  it('an archived item is refused before any write, even at the analysed revision', async () => {
    const w = world()
    w.item.status = 'archived'
    const { fetch, patches } = directus(w)
    const ref = seed()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'archived' })
    expect(patches()).toHaveLength(0)
  })

  it('an Archive that commits during the Apply is refused by the lifecycle guard (409 lifecycle_changed)', async () => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w.locales))
    const { fetch } = directus(w, { beforePatch: () => { w.item.status = 'archived' } })
    const ref = seed()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'lifecycle_changed' })
    expect(w.locales).toEqual(before)
  })

  it('Archive → Restore after the analysis invalidates the proposal although the draft revision is unchanged', async () => {
    const w = world()
    const before = JSON.parse(JSON.stringify(w.locales))
    const { fetch, patches } = directus(w)
    const ref = seed({ itemUpdatedAt: null })
    // Restore returns the item to draft and leaves draft_revision as it was; the item row was updated twice.
    w.item.date_updated = '2026-09-15T11:00:00.000Z'
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'lifecycle_changed' })
    expect(patches()).toHaveLength(0)
    expect(w.locales).toEqual(before)
  })

  it('a failed write that provably wrote nothing keeps the proposal reviewable; an unconfirmed write locks it, never marks success', async () => {
    const w = world()
    const { fetch } = directus(w, { failure: 'network-before-write' })
    const ref = seed()
    expect(await refusal(() => applyContentAiProposal(fetch, ITEM, body(ref), ADMIN, { newId }))).toMatchObject({ status: 502, code: 'apply_failed' })
    expect(w.locales.en!.draft_revision).toBe(3)
    expect(stateOf(ref)).toBe('ready')

    const w2 = world()
    const { fetch: fetch2 } = directus(w2, { failure: 'network-after-write' })
    const ref2 = seed()
    expect(await refusal(() => applyContentAiProposal(fetch2, ITEM, body(ref2), ADMIN, { newId }))).toMatchObject({ status: 500, code: 'apply_outcome_unknown' })
    expect(stateOf(ref2)).toBe('partial')
    expect(await refusal(() => applyContentAiProposal(fetch2, ITEM, body(ref2), ADMIN, { newId }))).toMatchObject({ status: 409, code: 'already_applied' })
    expect(w2.locales.en!.draft_revision).toBe(4)
  })
})

// ── History ─────────────────────────────────────────────────────────────────

describe('History — the Apply PATCH is recorded as "AI proposal applied to draft"', () => {
  it('maps the locale revision the Apply produces', () => {
    const event = mapHistoryRevision(
      { id: 901, collection: 'content_item_locales', item: '60', delta: { title: 'AI title', blocks: [], draft_revision: 4, last_change_kind: 'ai_apply' }, activity: { action: 'update', timestamp: '2026-09-15T12:00:00.000Z', user: { email: 'dev@litubo.com' } } },
      { itemId: ITEM, localeByRowId: new Map([['60', 'en']]), fileByLinkId: new Map(), relationById: new Map() },
    )
    expect(event).toMatchObject({ kind: 'ai_applied', category: 'AI', label: 'AI proposal applied to draft', locale: 'en', revision: 4, changes: ['Title', 'Sections'] })
  })
})

// ── Static boundaries ───────────────────────────────────────────────────────

describe('static boundaries — Apply writes one working copy and never publishes', () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')
  const code = (rel: string) => read(rel).split(/\r?\n/).filter(l => !/^\s*(\*|\/\/|\/\*\*)/.test(l)).join('\n')
  const FILES = [
    'server/utils/aiContentApply.ts',
    'server/api/admin/content-center/[id]/ai-proposal-review.get.ts',
    'server/api/admin/content-center/[id]/ai-proposal-review.post.ts',
    'components/admin/content/ContentAiProposalReview.vue',
    'pages/admin/content-center/[id]/ai-proposal-review.vue',
    'utils/contentAiReview.ts',
  ]

  it('imports no publication, lifecycle or history service and calls no publish / archive / restore route', () => {
    for (const file of FILES) {
      const source = code(file)
      expect(source, file).not.toMatch(/contentPublication|contentLifecycle|contentHistory|publishContentLocale|unpublishContentLocale|archiveContentItem|restoreContentItem/)
      expect(source, file).not.toMatch(/\/publish['"`]|\/unpublish['"`]|\/archive['"`]|\/restore['"`]/)
      expect(source, file).not.toMatch(/published_snapshot|published_revision|published_at|first_published_at|archived_at/)
    }
  })

  it('the only write is one PATCH of a content_item_locales row; item status is never sent', () => {
    const apply = code('server/utils/aiContentApply.ts')
    expect(apply.match(/method:/g)).toHaveLength(1)
    expect(apply).toMatch(/fetch\(`\/items\/content_item_locales\/\$\{rowId\}\?fields=id`, \{ method: 'PATCH', body: prepared\.patch \}\)/)
    expect(apply).not.toMatch(/\/items\/content_items\/|content_items_files|content_relations/)
    expect(apply).not.toMatch(/patch\.status|status:\s*'/)
    expect(apply).toContain("prepared.patch.last_change_kind = 'ai_apply'")
    const panel = code('components/admin/content/ContentAiProposalReview.vue')
    expect(panel.match(/\$fetch/g)).toHaveLength(1)
    expect(panel).not.toMatch(/>\s*Publish\s*</)
    const template = panel.slice(panel.indexOf('<template>'), panel.lastIndexOf('</template>'))
    expect(template).not.toMatch(/confidence|\d\s*%|p\.\s*\d|page \d/i)
  })

  it('exposes exactly the intake and review routes under the content AI surface', () => {
    const dir = resolve(process.cwd(), 'server/api/admin/content-center/[id]')
    expect(readdirSync(dir).filter(f => f.startsWith('ai')).sort()).toEqual([
      'ai-proposal-review.get.ts', 'ai-proposal-review.post.ts', 'ai-source-intake.get.ts', 'ai-source-intake.post.ts',
    ])
  })
})

// ── Admin auth ──────────────────────────────────────────────────────────────

describe('global admin-auth middleware — /api/admin/content-center/:id/ai-proposal-review', () => {
  const PATH = '/api/admin/content-center/6/ai-proposal-review'

  function mockEvent(opts: { method?: string, cookies?: Record<string, string>, headers?: Record<string, string> }) {
    const cookie = Object.entries(opts.cookies ?? {}).map(([k, v]) => `${k}=${v}`).join('; ')
    const req = Object.assign(new Readable({ read() { this.push(null) } }), {
      url: PATH,
      method: opts.method ?? 'GET',
      headers: { host: 'localhost:3000', ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
    })
    return {
      path: PATH,
      method: opts.method ?? 'GET',
      node: { req, res: { setHeader: () => {}, getHeader: () => undefined, end: () => {}, writableEnded: false, statusCode: 200 } },
      context: { params: {} } as Record<string, unknown>,
    }
  }

  function install(role: string | null) {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useRuntimeConfig', () => ({ directusUrl: 'http://directus.test', directusToken: 'server-token' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.includes('/users/me') && role) return { data: { id: 'u1', role: { name: role } } }
      throw Object.assign(new Error('unauthorized'), { statusCode: 401 })
    }))
  }

  async function status(run: () => Promise<unknown>) {
    try {
      await run()
      return 'no-error'
    } catch (err) {
      return (err as { statusCode?: number }).statusCode ?? -1
    }
  }

  const middleware = async () => (await import('../server/middleware/admin-auth')).default as (e: unknown) => Promise<unknown>

  it('refuses an unauthenticated GET and POST (401) and a non-administrator (403)', async () => {
    install(null)
    let run = await middleware()
    for (const method of ['GET', 'POST']) expect(await status(() => run(mockEvent({ method })))).toBe(401)
    install('nuxt-server')
    run = await middleware()
    for (const method of ['GET', 'POST']) expect(await status(() => run(mockEvent({ method, cookies: { admin_at: 'x' }, headers: { origin: 'http://localhost:3000' } })))).toBe(403)
  })

  it('refuses an Apply POST without a same-site Origin (403) and lets an Administrator through', async () => {
    install('Administrator')
    const run = await middleware()
    expect(await status(() => run(mockEvent({ method: 'POST', cookies: { admin_at: 'admin' } })))).toBe(403)
    expect(await status(() => run(mockEvent({ method: 'POST', cookies: { admin_at: 'admin' }, headers: { origin: 'http://evil.test' } })))).toBe(403)
    expect(await status(() => run(mockEvent({ method: 'POST', cookies: { admin_at: 'admin' }, headers: { origin: 'http://localhost:3000' } })))).toBe('no-error')
    expect(await status(() => run(mockEvent({ cookies: { admin_at: 'admin' } })))).toBe('no-error')
  })
})
