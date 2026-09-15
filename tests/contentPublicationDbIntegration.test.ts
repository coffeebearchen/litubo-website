/**
 * CC-IMP-06 — isolated positive Publish lifecycle against the real local PostgreSQL
 * (content_item_locales draft revision guard, json storage, constraints).
 *
 * Runs only against a local development database, and only when the Postgres
 * container is named explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/contentPublicationDbIntegration.test.ts
 *
 * psql runs inside that container with the container's own environment, so no
 * credential is read or printed. The fixture is a TEST ONLY item with a negative
 * id and no media links; it is deleted before and after the run. The real plan
 * functions (readiness, snapshot builder, publish / unpublish plans) decide every
 * write; this file only executes those planned writes with SQL, the way the admin
 * route executes them through Directus. The TEST ONLY public registry exists only
 * inside this test; the committed registry keeps every type non-public.
 */

import { execFile } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildPreviewPublishState,
  buildPublishedSnapshot,
  planPublish,
  publicationInputFingerprint,
  planUnpublish,
  snapshotsEqual,
  type PublicationContext,
  type PublicationOptions,
  type PublicationPlan,
} from '../server/utils/contentPublication'
import { CONTENT_TYPES, getContentType } from '../utils/contentTypes'
import type { ContentLocale } from '../utils/contentLocales'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const ITEM_ID = -9301
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION CC-IMP-06 lifecycle'

const TEST_ONLY_PUBLIC_REGISTRY: PublicationOptions['resolveType'] = (id: unknown) => {
  const def = getContentType(id)
  return def?.id === 'technical_article' ? { ...def, publicEnabled: true } : def
}
const RUNTIME: PublicationOptions = { publishedLocales: ['en'] }
const TEST_PUBLIC: PublicationOptions = { publishedLocales: ['en'], resolveType: TEST_ONLY_PUBLIC_REGISTRY }
const TEST_PUBLIC_ES: PublicationOptions = { publishedLocales: ['en', 'es'], resolveType: TEST_ONLY_PUBLIC_REGISTRY }

interface PsqlResult { ok: boolean, stdout: string, stderr: string }

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'docker',
      ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -X -q -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr) }),
    )
    child.stdin?.end(sql)
  })
}

async function sqlOk(sql: string): Promise<string> {
  const result = await psql(sql)
  expect(result.ok, result.stderr).toBe(true)
  return result.stdout.trim()
}

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return `$json$${JSON.stringify(value)}$json$::json`
  return `'${String(value).replace(/'/g, "''")}'`
}

const setClause = (patch: Record<string, unknown>) => Object.entries(patch).map(([k, v]) => `${k} = ${literal(v)}`).join(', ')

/** Executes a plan's steps in order, the same order the admin route uses; `stopAfter` simulates an interrupted request. */
async function execute(plan: PublicationPlan, stopAfter?: number): Promise<void> {
  for (const [index, step] of plan.steps.entries()) {
    if (stopAfter !== undefined && index >= stopAfter) return
    const table = step.collection
    if ('rows' in step) {
      await sqlOk(`BEGIN;\n${step.rows.map(({ id, ...patch }) => `UPDATE ${table} SET ${setClause(patch)} WHERE id = ${id};`).join('\n')}\nCOMMIT;`)
    } else {
      await sqlOk(`UPDATE ${table} SET ${setClause(step.patch)} WHERE id = ${step.id};`)
    }
  }
}

async function context(): Promise<PublicationContext> {
  const raw = await sqlOk(`
    SELECT json_build_object(
      'item', (SELECT row_to_json(i) FROM (SELECT id, content_type, status, first_published_at, archived_at FROM content_items WHERE id = ${ITEM_ID}) i),
      'locales', (SELECT coalesce(json_agg(l ORDER BY l.locale), '[]'::json) FROM (
        SELECT id, content_items_id, locale, title, slug, summary, blocks, seo_title, seo_description, canonical_path, noindex,
               draft_revision, published_revision, published_at, first_published_at, last_change_kind, published_snapshot
        FROM content_item_locales WHERE content_items_id = ${ITEM_ID}) l),
      'slugTaken', (SELECT coalesce(json_agg(DISTINCT a.locale), '[]'::json) FROM content_item_locales a
        JOIN content_item_locales b ON a.locale = b.locale AND a.slug = b.slug AND a.id <> b.id
        WHERE a.content_items_id = ${ITEM_ID})
    );`)
  const parsed = JSON.parse(raw) as { item: PublicationContext['item'], locales: PublicationContext['locales'], slugTaken: ContentLocale[] }
  return { item: parsed.item, locales: parsed.locales, files: [], archivedFileIds: new Set(), relations: [], slugTaken: new Set(parsed.slugTaken) }
}

const row = (ctx: PublicationContext, locale: ContentLocale) => ctx.locales.find(l => l.locale === locale)!
const now = () => new Date().toISOString()
/** The real plan, with the draft revision and publication input fingerprint a reviewer would have loaded just now. */
const reviewedPlan = (ctx: PublicationContext, locale: ContentLocale, revision: number, options: PublicationOptions) =>
  planPublish(ctx, locale, { expectedDraftRevision: revision, expectedPublicationInputFingerprint: publicationInputFingerprint(ctx, locale) }, options, now())

async function refusal(run: () => unknown): Promise<{ statusCode: number, data: Record<string, unknown> }> {
  try {
    run()
  } catch (err) {
    return err as { statusCode: number, data: Record<string, unknown> }
  }
  throw new Error('expected a refusal')
}

describe.skipIf(!CONTAINER)('publish lifecycle — real PostgreSQL, TEST ONLY fixture', () => {
  let snapshotsBefore = ''

  beforeAll(async () => {
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
    snapshotsBefore = await sqlOk('SELECT count(*) FROM content_item_locales WHERE published_snapshot IS NOT NULL AND content_items_id >= 0;')
    const blocks = JSON.stringify([
      { id: '0b6f0f8e-0000-4000-8000-000000000001', type: 'text', data: { heading: 'TEST ONLY intro', paragraphs: ['TEST ONLY paragraph.'] } },
      { id: '0b6f0f8e-0000-4000-8000-000000000002', type: 'faq', data: { items: [{ question: 'TEST ONLY question?', answer: 'TEST ONLY answer.' }] } },
    ])
    await sqlOk(`
      INSERT INTO content_items (id, content_type, status) VALUES (${ITEM_ID}, 'technical_article', 'draft');
      INSERT INTO content_item_locales (content_items_id, locale, title, slug, summary, blocks, draft_revision)
        VALUES (${ITEM_ID}, 'en', '${TITLE}', 'cc-imp-06-lifecycle-test-en', 'TEST ONLY summary', $json$${blocks}$json$, 3),
               (${ITEM_ID}, 'es', 'TEST ONLY ES lifecycle', 'cc-imp-06-lifecycle-test-es', 'TEST ONLY resumen', $json$${blocks}$json$, 1);
    `)
  })

  afterAll(async () => {
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
    const left = await psql(`SELECT count(*) FROM content_items WHERE id = ${ITEM_ID};`)
    expect(left.stdout.trim()).toBe('0')
    const snapshotsAfter = await psql('SELECT count(*) FROM content_item_locales WHERE published_snapshot IS NOT NULL AND content_items_id >= 0;')
    expect(snapshotsAfter.stdout.trim()).toBe(snapshotsBefore)
    // The committed registry never changed.
    expect(Object.values(CONTENT_TYPES).every(def => def.publicEnabled === false)).toBe(true)
  })

  it('the normal runtime registry refuses to publish and nothing is written', async () => {
    const ctx = await context()
    const err = await refusal(() => reviewedPlan(ctx, 'en', 3, RUNTIME))
    expect(err.statusCode).toBe(422)
    expect((err.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['type_public'])
    expect(row(await context(), 'en').published_snapshot).toBeNull()
  })

  it('Draft → Publish: the database accepts the publication-only write; revision unchanged; item published', async () => {
    const ctx = await context()
    const expected = buildPublishedSnapshot(ctx, 'en', TEST_PUBLIC)
    const plan = reviewedPlan(ctx, 'en', 3, TEST_PUBLIC)
    expect(plan.result).toBe('published')
    await execute(plan)

    const after = await context()
    const en = row(after, 'en')
    expect(snapshotsEqual(en.published_snapshot, expected)).toBe(true)
    expect(en).toMatchObject({ draft_revision: 3, published_revision: 3, last_change_kind: 'publish', title: TITLE })
    expect(en.first_published_at).not.toBeNull()
    expect(after.item.status).toBe('published')
    expect(row(after, 'es').published_snapshot).toBeNull()
    expect(reviewedPlan(after, 'en', 3, TEST_PUBLIC)).toMatchObject({ result: 'already_published', steps: [] })
    expect(buildPreviewPublishState(after, 'en', TEST_PUBLIC).locales.find(l => l.locale === 'en')!.state).toBe('published')
  })

  it('a later Draft save leaves the snapshot unchanged; the stale revision cannot publish; republishing keeps first_published_at', async () => {
    const before = await context()
    const firstPublished = row(before, 'en').first_published_at
    const snapshot = row(before, 'en').published_snapshot
    // A Draft save must increment the revision (the database guard).
    expect((await psql(`UPDATE content_item_locales SET title = 'no increment' WHERE content_items_id = ${ITEM_ID} AND locale = 'en';`)).ok).toBe(false)
    await sqlOk(`UPDATE content_item_locales SET title = '${TITLE} v2', draft_revision = 4, last_change_kind = 'manual_edit' WHERE content_items_id = ${ITEM_ID} AND locale = 'en';`)

    const edited = await context()
    expect(snapshotsEqual(row(edited, 'en').published_snapshot, snapshot)).toBe(true)
    expect(buildPreviewPublishState(edited, 'en', TEST_PUBLIC).publication.unpublished_changes).toBe(true)
    expect((await refusal(() => reviewedPlan(edited, 'en', 3, TEST_PUBLIC))).data.code).toBe('changed_since_review')

    await execute(reviewedPlan(edited, 'en', 4, TEST_PUBLIC))
    const republished = row(await context(), 'en')
    expect(republished).toMatchObject({ published_revision: 4, draft_revision: 4 })
    expect((republished.published_snapshot as { title: string }).title).toBe(`${TITLE} v2`)
    expect(new Date(republished.first_published_at!).getTime()).toBe(new Date(firstPublished!).getTime())
  })

  it('Spanish stays unpublished while the site does not publish it, then publishes on its own and unpublishes on its own', async () => {
    const ctx = await context()
    const refused = await refusal(() => reviewedPlan(ctx, 'es', 1, TEST_PUBLIC))
    expect((refused.data.blockers as Array<{ key: string }>).map(b => b.key)).toEqual(['locale_site_published'])

    const plan = reviewedPlan(ctx, 'es', 1, TEST_PUBLIC_ES)
    expect(plan.steps.map(s => s.collection)).toEqual(['content_item_locales'])
    await execute(plan)
    const both = await context()
    expect(row(both, 'es').published_snapshot).not.toBeNull()

    await execute(planUnpublish(both, 'es'))
    const esOff = await context()
    expect(row(esOff, 'es')).toMatchObject({ published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'unpublish' })
    expect(row(esOff, 'es').first_published_at).not.toBeNull()
    expect(row(esOff, 'en').published_snapshot).not.toBeNull()
    expect(esOff.item.status).toBe('published')

    // Leave Spanish published again for the default-language unpublish below.
    await execute(reviewedPlan(esOff, 'es', 1, TEST_PUBLIC_ES))
  })

  it('an interrupted default-language unpublish exposes nothing; the retry clears every language and keeps the Draft', async () => {
    const ctx = await context()
    const drafts = ctx.locales.map(l => ({ locale: l.locale, title: l.title, blocks: l.blocks, draft_revision: l.draft_revision }))
    const plan = planUnpublish(ctx, 'en')
    expect(plan.steps.map(s => s.collection)).toEqual(['content_items', 'content_item_locales'])

    await execute(plan, 1)
    const interrupted = await context()
    expect(interrupted.item.status).toBe('draft')
    expect(interrupted.locales.some(l => l.published_snapshot !== null)).toBe(true)

    const retry = planUnpublish(interrupted, 'en')
    expect(retry.steps.map(s => s.collection)).toEqual(['content_item_locales'])
    await execute(retry)

    const safe = await context()
    expect(safe.item.status).toBe('draft')
    expect(safe.locales.every(l => l.published_snapshot === null && l.published_revision === null && l.published_at === null)).toBe(true)
    expect(safe.locales.map(l => ({ locale: l.locale, title: l.title, blocks: l.blocks, draft_revision: l.draft_revision }))).toEqual(drafts)
    expect(safe.locales.every(l => l.first_published_at !== null)).toBe(true)
    expect(planUnpublish(safe, 'en')).toMatchObject({ result: 'already_unpublished', steps: [] })
  })
})
