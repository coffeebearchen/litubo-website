/**
 * CC-IMP-01-FIX-01-R1 — the real PostgreSQL draft revision guard
 * (directus/schema/cc-imp-01-fix-01-revision-guard.sql).
 *
 * Runs only against a local development database, and only when the Postgres
 * container is named explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/contentRevisionGuardIntegration.test.ts
 *
 * psql runs inside that container with the container's own environment, so no
 * credential is read or printed here. Rows are TEST ONLY drafts with a negative
 * id and are removed afterwards; no publication-only update is ever committed.
 */

import { execFile } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const ITEM_ID = -9201
// Real PostgreSQL through `docker exec psql`: the concurrent test deliberately holds a row
// lock for 4 s (≈ 4.7 s alone) and every statement pays a docker exec start-up, which reached
// ≈ 8.3 s in a loaded full suite. Vitest's 5 s default sits below that design floor; 15 s
// leaves headroom while still failing a real hang long before the helper's 60 s kill.
const REAL_DB_TEST_TIMEOUT_MS = 15_000
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION guard'

interface PsqlResult {
  ok: boolean
  stdout: string
  stderr: string
  ms: number
}

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = execFile(
      'docker',
      ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { timeout: 60_000 },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr), ms: Date.now() - started }),
    )
    child.stdin?.end(sql)
  })
}

const where = `content_items_id = ${ITEM_ID} AND locale = 'en'`

async function currentRow(): Promise<{ title: string, summary: string, revision: number, snapshot: string }> {
  const result = await psql(`SELECT title, coalesce(summary, ''), draft_revision, (published_snapshot IS NOT NULL)::text FROM content_item_locales WHERE ${where};`)
  const [title, summary, revision, snapshot] = result.stdout.trim().split('|')
  return { title, summary, revision: Number(revision), snapshot }
}

describe.skipIf(!CONTAINER)('draft revision guard — real PostgreSQL', { timeout: REAL_DB_TEST_TIMEOUT_MS }, () => {
  beforeAll(async () => {
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
    const setup = await psql(`
      INSERT INTO content_items (id, content_type, status) VALUES (${ITEM_ID}, 'technical_article', 'draft');
      INSERT INTO content_item_locales (content_items_id, locale, title, slug, blocks)
        VALUES (${ITEM_ID}, 'en', '${TITLE}', 'cc-imp-01-fix-guard-test', '[]');
    `)
    expect(setup.ok, setup.stderr).toBe(true)
  })

  afterAll(async () => {
    await psql(`DELETE FROM content_items WHERE id = ${ITEM_ID};`)
  })

  it('the trigger exists on content_item_locales only, BEFORE UPDATE, enabled', async () => {
    const result = await psql(`
      SELECT c.relname, t.tgenabled, (t.tgtype & 2) <> 0 AS before, (t.tgtype & 16) <> 0 AS on_update
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname = 'content_item_locales_draft_revision_guard_trg';
    `)
    expect(result.stdout.trim()).toBe('content_item_locales|O|t|t')
  })

  it('accepts a draft change that increments the revision by exactly one', async () => {
    const result = await psql(`UPDATE content_item_locales SET title = '${TITLE} v2', draft_revision = 2, last_change_kind = 'manual_edit' WHERE ${where};`)
    expect(result.ok, result.stderr).toBe(true)
    expect(await currentRow()).toMatchObject({ title: `${TITLE} v2`, revision: 2 })
  })

  it('rejects a stale save of an already-used revision and writes nothing', async () => {
    const result = await psql(`UPDATE content_item_locales SET title = 'stale', draft_revision = 2 WHERE ${where};`)
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('23505')
    expect(result.stderr).toContain('draft revision conflict')
    expect(result.stderr).toContain('Key (draft_revision)=')
    expect(await currentRow()).toMatchObject({ title: `${TITLE} v2`, revision: 2 })
  })

  it('rejects a revision jump, a decrease, and a draft change without an increment', async () => {
    for (const sql of [
      `UPDATE content_item_locales SET draft_revision = 4 WHERE ${where};`,
      `UPDATE content_item_locales SET draft_revision = 1 WHERE ${where};`,
      `UPDATE content_item_locales SET summary = 'no increment' WHERE ${where};`,
      `UPDATE content_item_locales SET blocks = '[{"id":"x"}]' WHERE ${where};`,
      `UPDATE content_item_locales SET noindex = true WHERE ${where};`,
    ]) {
      const result = await psql(sql)
      expect(result.ok, sql).toBe(false)
      expect(result.stderr).toContain('draft revision conflict')
    }
    expect((await currentRow()).revision).toBe(2)
  })

  it('allows publication-only and change-kind-only updates without a revision change (rolled back)', async () => {
    const result = await psql(`
      BEGIN;
      UPDATE content_item_locales
        SET published_snapshot = '{"test":"TEST ONLY"}', published_revision = 2, published_at = now(), first_published_at = now()
        WHERE ${where};
      UPDATE content_item_locales SET last_change_kind = 'publish' WHERE ${where};
      ROLLBACK;
    `)
    expect(result.ok, result.stderr).toBe(true)
    expect(await currentRow()).toMatchObject({ revision: 2, snapshot: 'false' })
  })

  it('two concurrent saves of the same revision: exactly one succeeds and the final row is the winner only', async () => {
    const save = (label: string, holdSeconds: number) => psql(`
      BEGIN;
      UPDATE content_item_locales SET title = 'Concurrent ${label}', summary = 'Summary ${label}', draft_revision = 3, last_change_kind = 'manual_edit' WHERE ${where};
      SELECT pg_sleep(${holdSeconds});
      COMMIT;
    `)
    // A holds its row lock for 4 s; B starts while A is holding it.
    const first = save('A', 4)
    await new Promise(resolve => setTimeout(resolve, 2000))
    const second = save('B', 0)
    const [a, b] = await Promise.all([first, second])

    const outcomes = [a, b]
    expect(outcomes.filter(r => r.ok)).toHaveLength(1)
    const loser = outcomes.find(r => !r.ok)!
    expect(loser.stderr).toContain('draft revision conflict')

    const winner = a.ok ? 'A' : 'B'
    // When B loses it must have waited on A's row lock rather than failing up front.
    if (winner === 'A') expect(b.ms).toBeGreaterThan(1000)
    expect(await currentRow()).toMatchObject({ title: `Concurrent ${winner}`, summary: `Summary ${winner}`, revision: 3 })
  })
})
