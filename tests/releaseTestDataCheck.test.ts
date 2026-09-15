/**
 * FINAL-RELEASE-FIX-B — the release data safety check for published TEST data.
 *
 * The decision tests drive the runner (scripts/release-check-test-data.mjs) through its query boundary:
 * only the psql call is replaced; parsing and the release decision are real. The real PostgreSQL tests run
 * the tracked query (scripts/release-check-test-data.sql) against TEST ONLY fixtures with negative ids
 * inside a transaction that is always rolled back, so no real record is ever published, changed or left
 * behind. They run only when the Postgres container is named explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/releaseTestDataCheck.test.ts
 *
 * psql runs inside the container with its own environment; no credential is read or printed.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CHECK_SQL_PATH,
  EXIT_BLOCKED,
  EXIT_CHECK_FAILED,
  EXIT_PASS,
  buildCheckScript,
  execPsql,
  parseCheckOutput,
  readCheckQuery,
  runReleaseTestDataCheck,
} from '../scripts/release-check-test-data.mjs'

const answer = (stdout: string, code = 0) => async () => ({ code, stdout })
const run = (exec: (script: string) => Promise<{ code: number, stdout: string }>) => runReleaseTestDataCheck({ exec, loadQuery: () => 'SELECT 1' })

describe('release data safety check — decision at the query boundary', () => {
  it('passes only when the check completed and found nothing', async () => {
    const report = await run(answer('CHECKED\t0\n'))
    expect(report.exitCode).toBe(EXIT_PASS)
    expect(report.findings).toEqual([])
    expect(report.lines.join('\n')).toContain('PASS')
  })

  it('a published [TEST] post blocks the release; the report names only collection, id, status, marker and slug', async () => {
    const report = await run(answer('FINDING\tposts\t2\tpublished\t[TEST]\ttest-metal-detector-sensitivity-guide\nCHECKED\t1\n'))
    expect(report.exitCode).toBe(EXIT_BLOCKED)
    expect(report.findings).toEqual([
      { collection: 'posts', id: '2', status: 'published', marker: '[TEST]', slug: 'test-metal-detector-sensitivity-guide' },
    ])
    expect(report.lines).toEqual([
      'RELEASE BLOCKED — 1 published record(s) carry a TEST marker:',
      '  posts #2  status=published  marker=[TEST]  slug=test-metal-detector-sensitivity-guide',
      'Take these records out of the published state (never delete them), then run the check again.',
    ])
  })

  it('published TEST ONLY products, categories and content snapshots block the release too', async () => {
    const report = await run(answer([
      'FINDING\tcontent_item_locales\t41\tpublished\tTEST ONLY\ttest-only-article',
      'FINDING\tproduct_categories\t9\tpublished\t[TEST]\ttest-category',
      'FINDING\tproducts\t3\tpublished\tTEST ONLY\ttest-only-product',
      'FINDING\tproducts\t7\tpublished\tNOT FOR PUBLICATION\tinternal-product',
      'CHECKED\t4',
      '',
    ].join('\n')))
    expect(report.exitCode).toBe(EXIT_BLOCKED)
    expect(report.findings.map(f => `${f.collection}#${f.id}`)).toEqual(['content_item_locales#41', 'product_categories#9', 'products#3', 'products#7'])
  })

  it('fails closed when the check cannot run, exits non-zero or answers with anything but a complete result', async () => {
    const failures = [
      async () => { throw new Error('spawn docker ENOENT') },
      answer('', 1),
      answer('CHECKED\t0\n', 3),
      answer(''),
      answer('\n\n'),
      answer('ERROR:  relation "posts" does not exist\n'),
      answer('FINDING\tposts\t2\tpublished\t[TEST]\tslug\n'),
      answer('CHECKED\t0\nFINDING\tposts\t2\tpublished\t[TEST]\tslug\n'),
      answer('CHECKED\t0\nCHECKED\t0\n'),
      answer('FINDING\tposts\t2\tpublished\t[TEST]\tslug\nCHECKED\t2\n'),
      answer('FINDING\tposts\t2\tpublished\t[TEST]\tslug\textra\nCHECKED\t1\n'),
      answer('FINDING\tdirectus_users\t2\tpublished\t[TEST]\tslug\nCHECKED\t1\n'),
      answer('FINDING\tposts\t2\tpublished\ttest\tslug\nCHECKED\t1\n'),
      answer('FINDING\tposts\tabc\tpublished\t[TEST]\tslug\nCHECKED\t1\n'),
      answer('CHECKED\t-1\n'),
      answer(' CHECKED\t0\n'),
    ]
    for (const exec of failures) {
      const report = await run(exec)
      expect(report.exitCode).toBe(EXIT_CHECK_FAILED)
      expect(report.findings).toEqual([])
      expect(report.lines.join('\n')).toContain('RELEASE CHECK FAILED')
    }
  })

  it('a missing query file fails closed', async () => {
    const report = await runReleaseTestDataCheck({ exec: answer('CHECKED\t0\n'), loadQuery: () => { throw new Error('ENOENT') } })
    expect(report.exitCode).toBe(EXIT_CHECK_FAILED)
  })

  it('a failure report never echoes what the database or docker printed', async () => {
    const leaky = 'psql: error: connection to server at "db.internal" (10.0.0.5), port 5432 failed: password authentication failed for user "directus"'
    const report = await run(answer(leaky, 2))
    expect(report.exitCode).toBe(EXIT_CHECK_FAILED)
    expect(report.lines.join('\n')).not.toMatch(/password|directus|db\.internal|10\.0\.0\.5|5432/)
  })

  it('always runs the tracked query inside a READ ONLY transaction', async () => {
    let script = ''
    const report = await runReleaseTestDataCheck({ exec: async (s: string) => { script = s; return { code: 0, stdout: 'CHECKED\t0\n' } } })
    expect(report.exitCode).toBe(EXIT_PASS)
    expect(script.startsWith('BEGIN TRANSACTION READ ONLY;\n')).toBe(true)
    expect(script.trimEnd().endsWith('COMMIT;')).toBe(true)
    expect(script).toContain(readCheckQuery().trim())
  })

  it('the tracked query writes nothing, controls no transaction and matches only exact, case-sensitive markers', () => {
    const code = readFileSync(CHECK_SQL_PATH, 'utf8').replace(/--.*$/gm, '')
    expect(code).not.toMatch(/\b(insert|update|delete|merge|upsert|truncate|drop|alter|create|grant|revoke|copy|call|do|begin|commit|rollback|savepoint|set|lock)\b/i)
    expect(code).not.toMatch(/ilike|lower\s*\(|upper\s*\(|~\*|similar\s+to|'%test%'/i)
    expect(code).toContain('strpos(')
    for (const marker of ['\'[TEST]\'', '\'TEST ONLY\'', '\'NOT FOR PUBLICATION\'']) expect(code).toContain(marker)
  })

  it('fails closed against a database container that does not exist (real docker call)', async () => {
    const report = await runReleaseTestDataCheck({ exec: script => execPsql(script, { container: 'litubo-fix-b-no-such-container' }) })
    expect(report.exitCode).toBe(EXIT_CHECK_FAILED)
  }, 30_000)
})

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
// Real PostgreSQL through `docker exec psql`, one call per test; 15 s leaves headroom in a loaded full suite.
const REAL_DB_TEST_TIMEOUT_MS = 15_000
const MARK = 'TEST ONLY — NOT FOR PUBLICATION'

interface PsqlResult { ok: boolean, stdout: string, stderr: string }

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'docker',
      ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -X -q -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { timeout: 60_000 },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr) }),
    )
    child.stdin?.end(sql)
  })
}

/**
 * TEST ONLY fixtures with negative ids, created and checked inside one transaction that is rolled back.
 * The rows without a marker stand for real published content that merely talks about testing; they exist
 * only inside this transaction.
 */
const FIXTURES = `
  INSERT INTO posts (id, status, content_type, slug, title_en) VALUES
    (-9801, 'published', 'technical_guide', 'fix-b-check-published-test-marker', 'FIX-B check post [TEST]'),
    (-9802, 'published', 'faq', 'fix-b-check-published-test-only', '${MARK} FIX-B check FAQ'),
    (-9803, 'draft', 'technical_guide', 'fix-b-check-draft-test-marker', 'FIX-B check draft post [TEST]'),
    (-9804, 'published', 'technical_guide', 'fix-b-check-real-test-word', 'How to Test Metal Detector Sensitivity'),
    (-9805, 'published', 'faq', 'fix-b-check-real-testing-only', 'Testing only works with calibrated test pieces');
  INSERT INTO product_categories (id, status, slug, name_en) VALUES
    (-9831, 'published', 'fix-b-check-test-category', '[TEST] FIX-B check category'),
    (-9832, 'published', 'fix-b-check-real-category', 'Leak Testing Systems');
  INSERT INTO products (id, status, slug, name_en, category_id) VALUES
    (-9811, 'published', 'fix-b-check-test-only-product', '${MARK} FIX-B check product', -9832),
    (-9812, 'draft', 'fix-b-check-draft-product', '[TEST] FIX-B check draft product', -9832),
    (-9813, 'published', 'fix-b-check-real-product', 'Glass Container Test Kit', -9832),
    (-9814, 'published', 'fix-b-check-not-for-publication', 'FIX-B check product NOT FOR PUBLICATION', -9832);
  INSERT INTO content_items (id, content_type, status, first_published_at) VALUES
    (-9821, 'technical_article', 'published', now()),
    (-9822, 'technical_article', 'draft', NULL),
    (-9823, 'case_study', 'published', now()),
    (-9824, 'technical_article', 'published', now());
  INSERT INTO content_item_locales (id, content_items_id, locale, title, slug, blocks, draft_revision, last_change_kind, published_snapshot, published_revision, published_at, first_published_at) VALUES
    (-9821, -9821, 'en', 'FIX-B check article working copy', 'fix-b-check-test-article', '[]', 1, 'publish', '{"title":"${MARK} FIX-B check article"}', 1, now(), now()),
    (-9823, -9823, 'en', 'Testing Glass Contamination', 'fix-b-check-real-article', '[]', 1, 'publish', '{"title":"Testing Glass Contamination"}', 1, now(), now()),
    (-9824, -9824, 'en', '${MARK} FIX-B check archived article', 'fix-b-check-archived-article', '[]', 1, 'publish', '{"title":"${MARK} FIX-B check archived article"}', 1, now(), now());
  INSERT INTO content_item_locales (id, content_items_id, locale, title, slug, blocks) VALUES
    (-9822, -9822, 'en', '${MARK} FIX-B check draft article', 'fix-b-check-draft-article', '[]');
  UPDATE content_items SET status = 'archived', archived_at = now() WHERE id = -9824;
`

const fixtureCount = () => psql(`
  SELECT (SELECT count(*) FROM posts WHERE id < 0) + (SELECT count(*) FROM products WHERE id < 0)
       + (SELECT count(*) FROM product_categories WHERE id < 0) + (SELECT count(*) FROM content_items WHERE id < 0)
       + (SELECT count(*) FROM content_item_locales WHERE id < 0);
`)

describe.skipIf(!CONTAINER)('release data safety check — real PostgreSQL, rolled-back fixtures', { timeout: REAL_DB_TEST_TIMEOUT_MS }, () => {
  it('reports exactly the published marked fixtures: [TEST], TEST ONLY and NOT FOR PUBLICATION; drafts, archived content and real "test" wording pass', async () => {
    const result = await psql(`BEGIN;\n${FIXTURES}\n${readCheckQuery()}\nROLLBACK;\n`)
    expect(result.ok, result.stderr).toBe(true)
    const parsed = parseCheckOutput(result.stdout)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const fixtureFindings = parsed.findings.filter(f => Number(f.id) < 0).map(f => `${f.collection}#${f.id}:${f.marker}`).sort()
    expect(fixtureFindings).toEqual([
      'content_item_locales#-9821:TEST ONLY',
      'posts#-9801:[TEST]',
      'posts#-9802:TEST ONLY',
      'product_categories#-9831:[TEST]',
      'products#-9811:TEST ONLY',
      'products#-9814:NOT FOR PUBLICATION',
    ])

    const decision = await runReleaseTestDataCheck({ exec: async () => ({ code: 0, stdout: result.stdout }) })
    expect(decision.exitCode).toBe(EXIT_BLOCKED)
    expect(decision.lines.join('\n')).not.toMatch(/FIX-B check|Testing Glass|Leak Testing/)

    expect((await fixtureCount()).stdout.trim()).toBe('0')
  })

  it('the READ ONLY wrapper makes the database itself refuse a write', async () => {
    const result = await psql(buildCheckScript('UPDATE posts SET status = status WHERE id = -1;'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('read-only transaction')
  })

  it('the runner completes against the real schema through its own psql call', async () => {
    const report = await runReleaseTestDataCheck({ exec: script => execPsql(script, { container: CONTAINER }) })
    expect(report.exitCode).not.toBe(EXIT_CHECK_FAILED)
    expect((await fixtureCount()).stdout.trim()).toBe('0')
  })
})
