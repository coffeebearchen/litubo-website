import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { assertJsonObject, failLifecycleChanged, isLifecycleGuardRejection } from './contentDraft'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import type {
  AdminContentLifecycle,
  AdminContentLifecycleResult,
  ContentItemStatus,
  ContentLifecycleOutcome,
} from '../../types/content-center'

/**
 * CC-IMP-07 — Content Center Archive / Restore (CONTENT-CENTER-BLUEPRINT-V1 §8, §14, §23, §24;
 * docs/project/RELEASE-SAFETY-GATES.md RSG-01, RSG-03, RSG-05).
 *
 * Transitions (server-enforced; anything else is 403 `invalid_transition`):
 *   draft | published ──archive──▶ archived   status = archived, archived_at set; snapshots kept but unreadable
 *   archived ──restore──▶ draft               every locale's snapshot / published revision / published_at cleared
 *                                             with last_change_kind = restore, then status = draft, archived_at cleared
 *
 * `first_published_at` is never cleared, so a published slug stays locked (Blueprint §14).
 * Media links, relations, locale rows and working copies are never changed, and no Media
 * Library file, visibility or lifecycle is touched. Writes go through the admin's own
 * Directus session, so Directus activity / revisions record the admin.
 *
 * Concurrency: the request must carry the `lifecycleFingerprint` it was shown. The
 * lifecycle and publication state is read again immediately before the plan; a different
 * fingerprint is 409 `lifecycle_changed` with no write.
 */

export const LIFECYCLE_BODY_MAX_BYTES = 1024
const FINGERPRINT_RE = /^[0-9a-f]{32}$/

type Row = Record<string, unknown>

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

export interface LifecycleLocaleRow {
  id: number
  locale: ContentLocale
  title: string | null
  published_revision: number | null
  published_at: string | null
  first_published_at: string | null
  last_change_kind: string | null
  has_snapshot: boolean
}

export interface LifecycleContext {
  item: {
    id: number
    content_type: string
    status: ContentItemStatus
    archived_at: string | null
    first_published_at: string | null
  }
  locales: LifecycleLocaleRow[]
}

const LOCALE_FIELDS = ['id', 'content_items_id', 'locale', 'title', 'published_revision', 'published_at', 'first_published_at', 'last_change_kind', 'published_snapshot']

export async function loadLifecycleContext(fetch: FetchFn, itemId: number): Promise<LifecycleContext> {
  const fields = ['id', 'content_type', 'status', 'archived_at', 'first_published_at', ...LOCALE_FIELDS.map(f => `locales.${f}`)].join(',')
  const res = await fetch<{ data: Array<Row & { locales?: Row[] }> }>(`/items/content_items?filter[id][_eq]=${itemId}&fields=${fields}&limit=1`)
  const row = (res.data ?? [])[0]
  if (!row) fail(404, `Content item ${itemId} not found.`)
  const locales = (Array.isArray(row.locales) ? row.locales : [])
    .filter(l => l.content_items_id === itemId && isContentLocale(l.locale))
    .map(l => ({
      id: l.id as number,
      locale: l.locale as ContentLocale,
      title: (l.title as string | null) ?? null,
      published_revision: (l.published_revision as number | null) ?? null,
      published_at: (l.published_at as string | null) ?? null,
      first_published_at: (l.first_published_at as string | null) ?? null,
      last_change_kind: (l.last_change_kind as string | null) ?? null,
      has_snapshot: l.published_snapshot !== null && l.published_snapshot !== undefined,
    }))
    .sort((a, b) => CONTENT_LOCALES.indexOf(a.locale) - CONTENT_LOCALES.indexOf(b.locale))
  return {
    item: {
      id: row.id as number,
      content_type: String(row.content_type),
      status: row.status as ContentItemStatus,
      archived_at: (row.archived_at as string | null) ?? null,
      first_published_at: (row.first_published_at as string | null) ?? null,
    },
    locales,
  }
}

/**
 * Item id, status, archive / first-publish dates and every locale's publication state and change
 * kind. Draft text is not included. The change kind makes a concurrent Restore's locale cleanup
 * visible even when no publication field changes (Review Fix 03).
 */
export function lifecycleFingerprint(ctx: LifecycleContext): string {
  const input = {
    id: ctx.item.id,
    status: ctx.item.status,
    archivedAt: ctx.item.archived_at,
    firstPublishedAt: ctx.item.first_published_at,
    locales: ctx.locales.map(l => [l.id, l.locale, l.published_revision, l.published_at, l.first_published_at, l.has_snapshot, l.last_change_kind]),
  }
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32)
}

export function buildLifecycleState(ctx: LifecycleContext): AdminContentLifecycle {
  return {
    status: ctx.item.status,
    archived_at: ctx.item.archived_at,
    first_published_at: ctx.item.first_published_at,
    published_locales: ctx.locales.filter(l => l.has_snapshot).map(l => l.locale),
    lifecycleFingerprint: lifecycleFingerprint(ctx),
    can_archive: ctx.item.status === 'draft' || ctx.item.status === 'published',
    can_restore: ctx.item.status === 'archived',
  }
}

export function lifecycleItemTitle(ctx: LifecycleContext): string | null {
  return ctx.locales.find(l => l.locale === DEFAULT_CONTENT_LOCALE)?.title ?? ctx.locales[0]?.title ?? null
}

export function parseLifecycleBody(rawBody: unknown): string {
  const body = assertJsonObject(rawBody)
  const extra = Object.keys(body).filter(key => key !== 'expectedLifecycleFingerprint')
  if (extra.length > 0) fail(422, `These fields cannot be set here: ${extra.join(', ')}.`, { rejectedFields: extra })
  const fingerprint = body.expectedLifecycleFingerprint
  if (typeof fingerprint !== 'string' || !FINGERPRINT_RE.test(fingerprint)) {
    fail(422, 'expectedLifecycleFingerprint is required.', { field: 'expectedLifecycleFingerprint' })
  }
  return fingerprint
}

export type LifecycleStep =
  | { collection: 'content_items', id: number, patch: Row }
  | { collection: 'content_item_locales', rows: Array<Row & { id: number }> }

export interface LifecyclePlan {
  kind: ContentLifecycleOutcome
  steps: LifecycleStep[]
}

function assertFresh(ctx: LifecycleContext, expected: string): void {
  const current = lifecycleFingerprint(ctx)
  if (current !== expected) {
    fail(409, 'This content changed since the page was loaded. Reload to see its current state.', {
      code: 'lifecycle_changed', currentLifecycleFingerprint: current,
    })
  }
}

export function planArchive(ctx: LifecycleContext, expectedFingerprint: string, now: string): LifecyclePlan {
  assertFresh(ctx, expectedFingerprint)
  if (ctx.item.status !== 'draft' && ctx.item.status !== 'published') {
    fail(403, 'Only draft or published content can be archived.', { code: 'invalid_transition', status: ctx.item.status })
  }
  return { kind: 'archived', steps: [{ collection: 'content_items', id: ctx.item.id, patch: { status: 'archived', archived_at: now } }] }
}

export function isRestoreCleared(l: LifecycleLocaleRow): boolean {
  return !l.has_snapshot && l.published_revision === null && l.published_at === null && l.last_change_kind === 'restore'
}

/**
 * Locale publication fields are cleared first while the item is still archived (not public),
 * then the item returns to draft. An interrupted restore leaves the item archived — never a
 * draft item that still holds a published translation — and a reload + retry completes it.
 */
export function planRestore(ctx: LifecycleContext, expectedFingerprint: string): LifecyclePlan {
  assertFresh(ctx, expectedFingerprint)
  if (ctx.item.status !== 'archived') {
    fail(403, 'Only archived content can be restored.', { code: 'invalid_transition', status: ctx.item.status })
  }
  const steps: LifecycleStep[] = []
  // Review Fix 03 — only rows that still need the cleanup are written. A row already cleared with
  // the restore marker (an interrupted earlier Restore) is skipped, so a retry finishes the rest and
  // no request records a no-op "Publication cleared by restore" revision.
  const pending = ctx.locales.filter(l => !isRestoreCleared(l))
  if (pending.length > 0) {
    steps.push({
      collection: 'content_item_locales',
      rows: pending.map(l => ({ id: l.id, published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'restore' })),
    })
  }
  steps.push({ collection: 'content_items', id: ctx.item.id, patch: { status: 'draft', archived_at: null } })
  return { kind: 'restored', steps }
}

export async function executeLifecyclePlan(fetch: FetchFn, plan: LifecyclePlan): Promise<void> {
  let completed = 0
  try {
    for (const step of plan.steps) {
      if ('rows' in step) await fetch(`/items/${step.collection}?fields=id`, { method: 'PATCH', body: step.rows })
      else await fetch(`/items/${step.collection}/${step.id}?fields=id`, { method: 'PATCH', body: step.patch })
      completed++
    }
  } catch (err) {
    // Review Fix 02 — another Archive / Restore committed first; the database refused this one.
    if (isLifecycleGuardRejection(err)) failLifecycleChanged({ completedSteps: completed, totalSteps: plan.steps.length })
    if (completed === 0) throw err
    fail(500, 'Restoring stopped part-way. The content is still archived and not public — reload and restore again to finish.', {
      partial: true, retryable: true, completedSteps: completed, totalSteps: plan.steps.length,
    })
  }
}

export async function archiveContentItem(
  fetch: FetchFn,
  itemId: number,
  rawBody: unknown,
  now: () => string = () => new Date().toISOString(),
): Promise<AdminContentLifecycleResult> {
  const expected = parseLifecycleBody(rawBody)
  const plan = planArchive(await loadLifecycleContext(fetch, itemId), expected, now())
  await executeLifecyclePlan(fetch, plan)
  return { result: plan.kind, lifecycle: buildLifecycleState(await loadLifecycleContext(fetch, itemId)) }
}

export async function restoreContentItem(fetch: FetchFn, itemId: number, rawBody: unknown): Promise<AdminContentLifecycleResult> {
  const expected = parseLifecycleBody(rawBody)
  const plan = planRestore(await loadLifecycleContext(fetch, itemId), expected)
  await executeLifecyclePlan(fetch, plan)
  return { result: plan.kind, lifecycle: buildLifecycleState(await loadLifecycleContext(fetch, itemId)) }
}
