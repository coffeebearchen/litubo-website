/**
 * CC-IMP-09 — the AI Apply write against the real local PostgreSQL guards
 * (directus/schema/cc-imp-01-fix-01-revision-guard.sql, cc-imp-07-fix-02-lifecycle-guard.sql).
 *
 * The Content AI Apply issues exactly one UPDATE of one `content_item_locales` row: the
 * approved working-copy fields, `draft_revision = analysed + 1` and
 * `last_change_kind = 'ai_apply'`. Each statement below is that UPDATE, so the database
 * authorities it depends on are exercised for real: atomic single-row write, stale
 * revision refusal, one winner under concurrency, the Editor winning a race, the archived
 * refusal, untouched publication columns and an untouched second locale.
 *
 * Runs only against a local development database, and only when the Postgres container is
 * named explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/contentAiApplyDbIntegration.test.ts
 *
 * psql runs inside the container with its own environment; no credential is read or printed.
 * Fixtures are TEST ONLY items with negative ids, deleted before and after the run.
 */

import { execFile } from 'node:child_process'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const ITEM_ID = -9901
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION CC-IMP-09 apply'
const SNAPSHOT = '{"title":"TEST ONLY — NOT FOR PUBLICATION snapshot"}'

interface PsqlResult { ok: boolean, stdout: string, stderr: string }

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'docker',
      ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { timeout: 60_000 },
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

const where = (locale: string) => `content_items_id = ${ITEM_ID} AND locale = '${locale}'`

/** The exact statement shape of one Content AI Apply. */
function aiApply(fromRevision: number, title: string): string {
  const blocks = JSON.stringify([
    { id: '11111111-2222-4333-8444-555555555555', type: 'text', data: { heading: 'Introduction', paragraphs: ['AI paragraph.'] } },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', type: 'faq', data: { items: [{ question: 'How often?', answer: 'Each shift.' }] } },
  ])
  return `UPDATE content_item_locales SET title = '${title}', summary = 'AI summary.', seo_title = 'AI SEO title', blocks = '${blocks}'::json,
    draft_revision = ${fromRevision + 1}, last_change_kind = 'ai_apply' WHERE ${where('en')};`
}

const rowState = (locale: string) => sqlOk(
  `SELECT title, coalesce(summary, ''), draft_revision, last_change_kind, coalesce(published_snapshot::text, ''), coalesce(published_revision::text, ''),
     coalesce(published_at::text, ''), coalesce(first_published_at::text, ''), slug, noindex::text FROM content_item_locales WHERE ${where(locale)};`,
)

describe.skipIf(!CONTAINER)('Content AI Apply write — real PostgreSQL guards', () => {
  beforeEach(async () => {
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
    await sqlOk(`
      INSERT INTO content_items (id, content_type, status, first_published_at) VALUES (${ITEM_ID}, 'technical_article', 'published', now());
      INSERT INTO content_item_locales (content_items_id, locale, title, slug, summary, blocks, draft_revision, last_change_kind, published_snapshot, published_revision, published_at, first_published_at)
        VALUES (${ITEM_ID}, 'en', '${TITLE}', 'cc-imp-09-apply-en-test', 'Working summary.',
          '[{"id":"11111111-2222-4333-8444-555555555555","type":"text","data":{"paragraphs":["Working paragraph."]}}]', 3, 'publish', '${SNAPSHOT}', 3, now(), now());
      INSERT INTO content_item_locales (content_items_id, locale, title, slug, blocks, draft_revision, last_change_kind)
        VALUES (${ITEM_ID}, 'es', '${TITLE} ES', 'cc-imp-09-apply-es-test', '[]', 2, 'manual_edit');
    `)
  })

  afterAll(async () => {
    if (!CONTAINER) return
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
    const left = await psql(`SELECT count(*) FROM content_items WHERE id = ${ITEM_ID};`)
    expect(left.stdout.trim()).toBe('0')
  })

  it('one UPDATE writes every approved field, revision +1 and ai_apply; publication columns, item status and the other locale are unchanged', async () => {
    const enBefore = (await rowState('en')).split('|')
    const esBefore = await rowState('es')
    await sqlOk(aiApply(3, 'AI title'))
    const enAfter = (await rowState('en')).split('|')
    expect(enAfter.slice(0, 4)).toEqual(['AI title', 'AI summary.', '4', 'ai_apply'])
    expect(enAfter.slice(4)).toEqual(enBefore.slice(4))
    expect(await rowState('es')).toBe(esBefore)
    expect(await sqlOk(`SELECT status FROM content_items WHERE id = ${ITEM_ID};`)).toBe('published')
    expect(await sqlOk(`SELECT jsonb_array_length(blocks::jsonb) FROM content_item_locales WHERE ${where('en')};`)).toBe('2')
  })

  it('replaying the same Apply after it committed is refused by the revision guard and writes nothing', async () => {
    await sqlOk(aiApply(3, 'AI title'))
    const after = await rowState('en')
    const replay = await psql(aiApply(3, 'AI title again'))
    expect(replay.ok).toBe(false)
    expect(replay.stderr).toContain('23505')
    expect(replay.stderr).toContain('draft_revision')
    expect(await rowState('en')).toBe(after)
  })

  it('two concurrent Applies from the same revision: exactly one commits, the revision moves once', async () => {
    const results = await Promise.all([psql(aiApply(3, 'AI title one')), psql(aiApply(3, 'AI title two'))])
    expect(results.filter(r => r.ok)).toHaveLength(1)
    const winner = results[0]!.ok ? 'AI title one' : 'AI title two'
    const [title, , revision, kind] = (await rowState('en')).split('|')
    expect([title, revision, kind]).toEqual([winner, '4', 'ai_apply'])
  })

  it('an Editor save that commits first wins; the stale Apply is refused and does not overwrite it', async () => {
    await sqlOk(`UPDATE content_item_locales SET title = 'Editor wins', draft_revision = 4, last_change_kind = 'manual_edit' WHERE ${where('en')};`)
    const stale = await psql(aiApply(3, 'AI title'))
    expect(stale.ok).toBe(false)
    expect(stale.stderr).toContain('draft_revision')
    const [title, , revision, kind] = (await rowState('en')).split('|')
    expect([title, revision, kind]).toEqual(['Editor wins', '4', 'manual_edit'])
  })

  it('an archived item refuses the Apply at the analysed revision (lifecycle guard) and writes nothing', async () => {
    await sqlOk(`UPDATE content_items SET status = 'archived', archived_at = now() WHERE id = ${ITEM_ID};`)
    const before = await rowState('en')
    const refused = await psql(aiApply(3, 'AI title'))
    expect(refused.ok).toBe(false)
    expect(refused.stderr).toContain('content_lifecycle_guard')
    expect(await rowState('en')).toBe(before)
  })
})
