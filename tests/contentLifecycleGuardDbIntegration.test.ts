/**
 * CC-IMP-07 Review Fix 02 — lifecycle concurrency guard against the real local PostgreSQL
 * (directus/schema/cc-imp-07-fix-02-lifecycle-guard.sql).
 *
 * Runs only against a local development database, and only when the Postgres container is
 * named explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/contentLifecycleGuardDbIntegration.test.ts
 *
 * Two independent psql sessions (A and B) stand for two concurrent admin requests. Directus
 * runs every request in its own transaction, so each step below is one transaction writing
 * exactly the columns the admin BFF sends for that action. A third session only watches
 * pg_stat_activity: the barrier waits until the second session is really blocked on a lock
 * before the first one commits, so every interleaving is deterministic, not timing-based.
 *
 * psql runs inside the container with its own environment; no credential is read or printed.
 * Fixtures are TEST ONLY items with negative ids, deleted before and after the run.
 */

import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const PSQL = 'psql -X -q -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
const FIXTURE_FROM = -9599
const FIXTURE_TO = -9500
const TARGET_ID = -9500
const TITLE = 'TEST ONLY — NOT FOR PUBLICATION CC-IMP-07 Fix 02'
const GUARD_PREFIX = 'content_lifecycle_guard:'

interface Step { ok: boolean, sqlstate: string, message: string, rows: string[] }

/** One long-lived psql connection; `run` resolves when psql has finished the statement. */
class Session {
  private readonly child: ChildProcessWithoutNullStreams
  private buffer = ''
  private lines: string[] = []
  private seq = 0
  private readonly pending = new Map<number, (step: Step) => void>()
  pid = 0

  constructor() {
    this.child = spawn('docker', ['exec', '-i', CONTAINER, 'sh', '-c', PSQL])
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      let index = this.buffer.indexOf('\n')
      while (index >= 0) {
        const line = this.buffer.slice(0, index).replace(/\r$/, '')
        this.buffer = this.buffer.slice(index + 1)
        const marker = /^__step_(\d+)__\|(true|false)\|(\w{5})\|(.*)$/.exec(line)
        if (marker) {
          const resolve = this.pending.get(Number(marker[1]))
          this.pending.delete(Number(marker[1]))
          const ok = marker[2] === 'false'
          resolve?.({ ok, sqlstate: marker[3]!, message: ok ? '' : marker[4]!, rows: this.lines })
          this.lines = []
        } else {
          this.lines.push(line)
        }
        index = this.buffer.indexOf('\n')
      }
    })
    this.child.stderr.on('data', () => {})
  }

  async open(): Promise<void> {
    await this.run(`SET lock_timeout = '20s';`)
    this.pid = Number((await this.run('SELECT pg_backend_pid();')).rows[0])
  }

  run(sql: string): Promise<Step> {
    const n = ++this.seq
    const result = new Promise<Step>(resolve => this.pending.set(n, resolve))
    this.child.stdin.write(`${sql}\n\\echo __step_${n}__|:ERROR|:SQLSTATE|:LAST_ERROR_MESSAGE\n`)
    return result
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.child.once('exit', () => resolve())
      this.child.stdin.end()
    })
  }
}

function psqlOnce(sql: string): Promise<{ ok: boolean, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile('docker', ['exec', '-i', CONTAINER, 'sh', '-c', `${PSQL} -v ON_ERROR_STOP=1`], { timeout: 60_000 },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr) }))
    child.stdin?.end(sql)
  })
}

async function sqlOk(sql: string): Promise<string> {
  const result = await psqlOnce(sql)
  expect(result.ok, result.stderr).toBe(true)
  return result.stdout.trim()
}

let A: Session
let B: Session
let watcher: Session
let fileId = ''

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function ok(session: Session, sql: string): Promise<Step> {
  const step = await session.run(sql)
  expect(step.ok, `${sql} → ${step.message}`).toBe(true)
  return step
}

function expectGuard(step: Step, reason?: string) {
  expect(step.ok, 'expected the lifecycle guard to reject').toBe(false)
  expect(step.sqlstate).toBe('23505')
  expect(step.message.startsWith(GUARD_PREFIX), step.message).toBe(true)
  if (reason) expect(step.message).toContain(`(${reason})`)
}

async function waitUntilBlocked(session: Session): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const step = await watcher.run(`SELECT coalesce(wait_event_type, '') FROM pg_stat_activity WHERE pid = ${session.pid};`)
    if (step.rows[0] === 'Lock') return
    await sleep(20)
  }
  throw new Error('the second session never waited on a lock')
}

/**
 * Barrier: `holder` runs `holderSql` inside an open transaction; `waiter` starts `waiterSql` and
 * must really block on the holder's lock; then the holder commits and the waiter's outcome is
 * returned (its transaction committed on success, rolled back on rejection).
 */
async function barrier(holder: Session, holderSql: string, waiter: Session, waiterSql: string): Promise<{ held: Step, waited: Step }> {
  await ok(holder, 'BEGIN;')
  const held = await ok(holder, holderSql)
  await ok(waiter, 'BEGIN;')
  let settled = false
  const pending = waiter.run(waiterSql).then((step) => { settled = true; return step })
  await waitUntilBlocked(waiter)
  expect(settled, 'the waiter must not finish before the holder commits').toBe(false)
  await ok(holder, 'COMMIT;')
  const waited = await pending
  await ok(waiter, waited.ok ? 'COMMIT;' : 'ROLLBACK;')
  return { held, waited }
}

/** A single request that is expected to be refused: its transaction is rolled back. */
async function refused(session: Session, sql: string, reason?: string): Promise<Step> {
  await ok(session, 'BEGIN;')
  const step = await session.run(sql)
  expectGuard(step, reason)
  await ok(session, 'ROLLBACK;')
  return step
}

// ── Write shapes: the columns the admin BFF sends through Directus ───────────────────────

const lit = (value: string) => `'${value.replace(/'/g, "''")}'`
const W = {
  archive: (id: number) => `UPDATE content_items SET status = 'archived', archived_at = now(), date_updated = now() WHERE id = ${id} RETURNING archived_at;`,
  restoreItem: (id: number) => `UPDATE content_items SET status = 'draft', archived_at = NULL, date_updated = now() WHERE id = ${id};`,
  restoreLocales: (ids: number[]) => ids.map(l => `UPDATE content_item_locales SET published_snapshot = NULL, published_revision = NULL, published_at = NULL, last_change_kind = 'restore' WHERE id = ${l};`).join('\n'),
  publishLocale: (localeId: number, revision: number) => `UPDATE content_item_locales SET published_snapshot = '{"title":"TEST ONLY snapshot"}'::json, published_revision = ${revision}, published_at = now(), first_published_at = coalesce(first_published_at, now()), last_change_kind = 'publish' WHERE id = ${localeId};`,
  publishItem: (id: number) => `UPDATE content_items SET status = 'published', first_published_at = coalesce(first_published_at, now()), date_updated = now() WHERE id = ${id};`,
  unpublishLocale: (localeId: number) => `UPDATE content_item_locales SET published_snapshot = NULL, published_revision = NULL, published_at = NULL, last_change_kind = 'unpublish' WHERE id = ${localeId};`,
  unpublishItem: (id: number) => `UPDATE content_items SET status = 'draft', date_updated = now() WHERE id = ${id};`,
  editor: (localeId: number, revision: number, title: string) => `UPDATE content_item_locales SET title = ${lit(title)}, draft_revision = ${revision}, last_change_kind = 'manual_edit' WHERE id = ${localeId};`,
  seo: (localeId: number, revision: number) => `UPDATE content_item_locales SET seo_title = 'TEST ONLY SEO title', seo_description = 'TEST ONLY SEO description', noindex = true, draft_revision = ${revision}, last_change_kind = 'manual_edit' WHERE id = ${localeId};`,
  startLocale: (id: number, locale: string) => `INSERT INTO content_item_locales (content_items_id, locale, title, slug, summary, blocks, noindex, draft_revision, last_change_kind) VALUES (${id}, '${locale}', ${lit(`${TITLE} ${locale}`)}, 'cc-imp-07-fix-02${id}-${locale}', 'TEST ONLY summary', '[]'::json, false, 1, 'manual_edit');`,
  linkMedia: (id: number, role: string) => `INSERT INTO content_items_files (content_items_id, directus_files_id, file_role, enabled, sort) VALUES (${id}, '${fileId}', '${role}', true, 0) RETURNING id;`,
  updateMedia: (linkId: number) => `UPDATE content_items_files SET alt_en = 'TEST ONLY alt v2', sort = 1 WHERE id = ${linkId};`,
  ogImage: (linkId: number) => `UPDATE content_items_files SET directus_files_id = '${fileId}', enabled = true WHERE id = ${linkId};`,
  unlinkMedia: (linkId: number) => `DELETE FROM content_items_files WHERE id = ${linkId};`,
  moveMedia: (linkId: number, to: number) => `UPDATE content_items_files SET content_items_id = ${to} WHERE id = ${linkId};`,
  addRelation: (id: number, target: number) => `INSERT INTO content_relations (content_items_id, relation_kind, related_content_id, sort) VALUES (${id}, 'content', ${target}, 0) RETURNING id;`,
  sortRelation: (relationId: number) => `UPDATE content_relations SET sort = 5 WHERE id = ${relationId};`,
  removeRelation: (relationId: number) => `DELETE FROM content_relations WHERE id = ${relationId};`,
  moveRelation: (relationId: number, to: number) => `UPDATE content_relations SET content_items_id = ${to} WHERE id = ${relationId};`,
}

interface Fixture { id: number, en: number, es: number, link: number, relation: number }
let nextId = TARGET_ID - 1

async function fixture(options: { published?: boolean, archived?: boolean } = {}): Promise<Fixture> {
  const id = nextId--
  const out = await sqlOk(`
    INSERT INTO content_items (id, content_type, status) VALUES (${id}, 'technical_article', 'draft');
    INSERT INTO content_item_locales (content_items_id, locale, title, slug, summary, blocks, draft_revision) VALUES
      (${id}, 'en', ${lit(`${TITLE} ${id}`)}, 'cc-imp-07-fix-02${id}-en', 'TEST ONLY summary', '[]'::json, 1),
      (${id}, 'es', ${lit(`${TITLE} ${id} ES`)}, 'cc-imp-07-fix-02${id}-es', 'TEST ONLY resumen', '[]'::json, 1);
    INSERT INTO content_items_files (content_items_id, directus_files_id, file_role, alt_en, enabled, sort) VALUES (${id}, '${fileId}', 'hero', 'TEST ONLY alt', true, 0);
    INSERT INTO content_relations (content_items_id, relation_kind, related_content_id, sort) VALUES (${id}, 'content', ${TARGET_ID}, 0);
    SELECT json_build_object(
      'en', (SELECT id FROM content_item_locales WHERE content_items_id = ${id} AND locale = 'en'),
      'es', (SELECT id FROM content_item_locales WHERE content_items_id = ${id} AND locale = 'es'),
      'link', (SELECT id FROM content_items_files WHERE content_items_id = ${id}),
      'relation', (SELECT id FROM content_relations WHERE content_items_id = ${id}));`)
  const ids = JSON.parse(out.split('\n').pop()!) as Omit<Fixture, 'id'>
  const f = { id, ...ids }
  if (options.published) {
    await sqlOk(`${W.publishLocale(f.en, 1)}\n${W.publishItem(id)}\n${W.publishLocale(f.es, 1)}`)
  }
  if (options.archived) await sqlOk(W.archive(id))
  return f
}

interface State {
  status: string
  archived: boolean
  first_published_at: string | null
  locales: Record<string, { title: string, draft_revision: number, seo_title: string | null, has_snapshot: boolean, last_change_kind: string }>
  files: Array<{ id: number, alt_en: string | null, sort: number | null }>
  relations: Array<{ id: number, sort: number | null }>
}

async function state(id: number): Promise<State> {
  const raw = await sqlOk(`SELECT json_build_object(
    'status', (SELECT status FROM content_items WHERE id = ${id}),
    'archived', (SELECT archived_at IS NOT NULL FROM content_items WHERE id = ${id}),
    'first_published_at', (SELECT first_published_at FROM content_items WHERE id = ${id}),
    'locales', (SELECT coalesce(json_object_agg(locale, json_build_object('title', title, 'draft_revision', draft_revision, 'seo_title', seo_title,
       'has_snapshot', published_snapshot IS NOT NULL, 'last_change_kind', last_change_kind)), '{}'::json) FROM content_item_locales WHERE content_items_id = ${id}),
    'files', (SELECT coalesce(json_agg(json_build_object('id', id, 'alt_en', alt_en, 'sort', sort) ORDER BY id), '[]'::json) FROM content_items_files WHERE content_items_id = ${id}),
    'relations', (SELECT coalesce(json_agg(json_build_object('id', id, 'sort', sort) ORDER BY id), '[]'::json) FROM content_relations WHERE content_items_id = ${id}));`)
  return JSON.parse(raw) as State
}

/** Winner / loser / final state per matrix case, printed once for the module report. */
const matrix: Array<Record<string, unknown>> = []
const record = (row: Record<string, unknown>) => matrix.push(row)

let baseline = ''
/** Non-fixture rows only (id ≥ 0), so another TEST ONLY integration file running in parallel does not affect it. */
const COUNTS = `SELECT concat_ws('|',
  (SELECT count(*) FROM content_item_locales WHERE published_snapshot IS NOT NULL AND content_items_id >= 0),
  (SELECT count(*) FROM content_items WHERE status = 'published' AND id >= 0),
  (SELECT count(*) FROM content_items WHERE status = 'archived' AND id >= 0),
  (SELECT count(*) FROM content_items_files WHERE content_items_id >= 0),
  (SELECT count(*) FROM content_relations WHERE content_items_id >= 0));`

describe.skipIf(!CONTAINER)('lifecycle concurrency guard — real PostgreSQL, TEST ONLY fixtures', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await psqlOnce(`DELETE FROM content_items WHERE id BETWEEN ${FIXTURE_FROM} AND ${FIXTURE_TO};`)
    baseline = await sqlOk(COUNTS)
    fileId = await sqlOk('SELECT id FROM directus_files ORDER BY uploaded_on LIMIT 1;')
    expect(fileId).toMatch(/^[0-9a-f-]{36}$/)
    await sqlOk(`INSERT INTO content_items (id, content_type, status) VALUES (${TARGET_ID}, 'technical_article', 'draft');`)
    A = new Session()
    B = new Session()
    watcher = new Session()
    await Promise.all([A.open(), B.open(), watcher.open()])
  }, 60_000)

  // A failed assertion must not leave a session inside an aborted transaction for the next case.
  beforeEach(async () => {
    await Promise.all([A.run('ROLLBACK;'), B.run('ROLLBACK;')])
  })

  afterAll(async () => {
    await Promise.all([A?.close(), B?.close(), watcher?.close()])
    await psqlOnce(`DELETE FROM content_items WHERE id BETWEEN ${FIXTURE_FROM} AND ${FIXTURE_TO};`)
    expect(await sqlOk(`SELECT count(*) FROM content_items WHERE id BETWEEN ${FIXTURE_FROM} AND ${FIXTURE_TO};`)).toBe('0')
    expect(await sqlOk(COUNTS)).toBe(baseline)
    console.info(`[CC-IMP-07 Fix 02 concurrency matrix]\n${matrix.map(r => JSON.stringify(r)).join('\n')}`)
  }, 60_000)

  it('the guard is installed; on content_item_locales the revision guard fires first by name order', async () => {
    const triggers = (await sqlOk(`SELECT tgrelid::regclass || ':' || tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'content_%' ORDER BY tgrelid::regclass::text, tgname;`)).split('\n')
    expect(triggers).toEqual([
      'content_item_locales:content_item_locales_draft_revision_guard_trg',
      'content_item_locales:content_item_locales_lifecycle_guard_trg',
      'content_item_locales:content_item_locales_lifecycle_marker_guard_trg',
      'content_items:content_items_lifecycle_guard_trg',
      'content_items:content_items_lifecycle_restore_guard_trg',
      'content_items_files:content_items_files_lifecycle_guard_trg',
      'content_relations:content_relations_lifecycle_guard_trg',
    ])
  })

  it('the error carries the transport Directus translates: 23505, DETAIL "Key (content_lifecycle)=…", table and column', async () => {
    const f = await fixture({ archived: true })
    await ok(A, `DO $$ DECLARE d text; c text; t text; BEGIN
      UPDATE content_items SET status = 'published' WHERE id = ${f.id};
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, c = COLUMN_NAME, t = TABLE_NAME;
      PERFORM set_config('fix02.transport', concat_ws('|', d, c, t), false);
    END $$;`)
    const transport = (await ok(A, `SELECT current_setting('fix02.transport');`)).rows[0]!
    expect(transport).toBe(`Key (content_lifecycle)=(archived) rejected for content item ${f.id}.|content_lifecycle|content_items`)
  })

  it('normal Draft / Published work is unchanged on items that are not archived', async () => {
    const f = await fixture()
    const other = await fixture()
    await ok(A, W.editor(f.en, 2, `${TITLE} edited`))
    await ok(A, W.seo(f.en, 3))
    await ok(A, W.publishLocale(f.en, 3))
    await ok(A, W.publishItem(f.id))
    await ok(A, W.editor(f.en, 4, `${TITLE} edited after publish`))
    await ok(A, W.publishLocale(f.es, 1))
    await ok(A, W.unpublishLocale(f.es))
    await ok(A, W.startLocale(f.id, 'pt'))
    const link = Number((await ok(A, W.linkMedia(f.id, 'og_image'))).rows[0])
    await ok(A, W.updateMedia(link))
    await ok(A, W.unlinkMedia(link))
    const inline = Number((await ok(A, W.linkMedia(f.id, 'inline'))).rows[0])
    await ok(A, W.moveMedia(inline, other.id))
    const relation = Number((await ok(A, W.addRelation(f.id, other.id))).rows[0])
    await ok(A, W.sortRelation(relation))
    await ok(A, W.removeRelation(relation))
    await ok(A, W.unpublishItem(f.id))
    await ok(A, W.unpublishLocale(f.en))
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'draft', archived: false })
    expect(after.locales.en).toMatchObject({ draft_revision: 4, has_snapshot: false, last_change_kind: 'unpublish' })
    expect(Object.keys(after.locales).sort()).toEqual(['en', 'es', 'pt'])
    expect(after.first_published_at).not.toBeNull()
    // status and archived_at stay consistent.
    expectGuard((await A.run(`UPDATE content_items SET archived_at = now() WHERE id = ${f.id};`)), 'archived_at_without_archive')
    expectGuard((await A.run(`UPDATE content_items SET status = 'archived' WHERE id = ${f.id};`)), 'archive_without_archived_at')
  })

  // ── A. Archive vs Publish ──────────────────────────────────────────────────────────────

  it('A1. Archive vs Publish — the locale snapshot is written first, Archive waits for it, then the late item transition is refused', async () => {
    const f = await fixture()
    const { waited } = await barrier(A, W.publishLocale(f.en, 1), B, W.archive(f.id))
    expect(waited.ok).toBe(true)
    const late = await refused(A, W.publishItem(f.id), 'archived')
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'archived', archived: true, first_published_at: null })
    expect(after.locales.en!.has_snapshot).toBe(true)
    record({ case: 'A1 Archive vs Publish (partial publish)', winner: 'Archive (after publish locale step committed)', loser: 'Publish item step', loserError: `${late.sqlstate} ${late.message}`, final: 'archived; en snapshot kept (unreadable); item never published' })
  })

  it('A2. Archive vs Publish — Archive first; the waiting publish locale write is refused and writes nothing', async () => {
    const f = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.publishLocale(f.en, 1))
    expectGuard(waited, 'archived')
    await refused(A, W.publishItem(f.id), 'archived')
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'archived', archived: true })
    expect(after.locales.en).toMatchObject({ has_snapshot: false, last_change_kind: 'manual_edit' })
    record({ case: 'A2 Archive vs Publish (archive first)', winner: 'Archive', loser: 'Publish locale step (waited on lock)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; no snapshot' })
  })

  // ── B. Archive vs Editor (both lock orders) ────────────────────────────────────────────

  it('B1. Editor first — Archive waits for the edit, then archives the edited draft', async () => {
    const f = await fixture()
    const { waited } = await barrier(A, W.editor(f.en, 2, `${TITLE} edit`), B, W.archive(f.id))
    expect(waited.ok).toBe(true)
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'archived', archived: true })
    expect(after.locales.en).toMatchObject({ title: `${TITLE} edit`, draft_revision: 2 })
    record({ case: 'B1 Editor first vs Archive', winner: 'both, serialized (edit commits, then Archive)', loser: 'none', final: 'archived; edit kept (rev 2)' })
  })

  it('B2. Archive first — the waiting Editor save is refused after Archive commits; revision guard stays compatible', async () => {
    const f = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.editor(f.en, 2, `${TITLE} late edit`))
    expectGuard(waited, 'archived')
    const after = await state(f.id)
    expect(after.locales.en).toMatchObject({ title: `${TITLE} ${f.id}`, draft_revision: 1 })
    // Combined behaviour: a stale revision is still reported by the revision guard (it fires first) …
    await ok(A, 'BEGIN;')
    const stale = await A.run(W.editor(f.en, 7, 'stale'))
    expect(stale).toMatchObject({ ok: false, sqlstate: '23505' })
    expect(stale.message).toContain('content_item_locales_draft_revision_guard')
    await ok(A, 'ROLLBACK;')
    // … and a correct revision on an archived item is refused by the lifecycle guard.
    await refused(A, W.editor(f.en, 2, 'correct revision'), 'archived')
    record({ case: 'B2 Archive first vs Editor', winner: 'Archive', loser: 'Editor save (waited on parent FOR SHARE)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; title and revision unchanged' })
  })

  // ── C. Archive vs SEO ──────────────────────────────────────────────────────────────────

  it('C. Archive vs SEO — SEO first is serialized before Archive; after Archive the SEO save is refused', async () => {
    const first = await fixture()
    expect((await barrier(A, W.seo(first.en, 2), B, W.archive(first.id))).waited.ok).toBe(true)
    expect((await state(first.id)).locales.en).toMatchObject({ seo_title: 'TEST ONLY SEO title', draft_revision: 2 })

    const f = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.seo(f.en, 2))
    expectGuard(waited, 'archived')
    expect((await state(f.id)).locales.en).toMatchObject({ seo_title: null, draft_revision: 1 })
    record({ case: 'C Archive vs SEO', winner: 'Archive', loser: 'SEO save', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; SEO unchanged (SEO-first order: serialized, archived with SEO kept)' })
  })

  // ── D. Archive vs Media (and Open Graph) ───────────────────────────────────────────────

  it('D. Archive vs Media — link / update / unlink / move are refused on an archived item; link first is serialized', async () => {
    const first = await fixture()
    expect((await barrier(A, W.linkMedia(first.id, 'inline'), B, W.archive(first.id))).waited.ok).toBe(true)
    expect((await state(first.id)).files).toHaveLength(2)

    const f = await fixture()
    const draft = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.linkMedia(f.id, 'inline'))
    expectGuard(waited, 'archived')
    await refused(A, W.updateMedia(f.link), 'archived')
    const unlink = await refused(A, W.unlinkMedia(f.link), 'archived')
    await refused(A, W.moveMedia(f.link, draft.id), 'archived')
    await refused(A, W.moveMedia(draft.link, f.id), 'archived')
    const after = await state(f.id)
    expect(after.files).toEqual([{ id: f.link, alt_en: 'TEST ONLY alt', sort: 0 }])
    expect((await state(draft.id)).files).toHaveLength(1)
    record({ case: 'D Archive vs Media', winner: 'Archive', loser: 'media link (waited) / update / delete / re-parent in and out', loserError: `${waited.sqlstate} ${waited.message}; delete: ${unlink.message}`, final: 'archived; links unchanged' })
  })

  it('OG. Archive vs Open Graph image — add, replace and remove are refused after Archive (media regression)', async () => {
    const f = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.linkMedia(f.id, 'og_image'))
    expectGuard(waited, 'archived')
    expect((await state(f.id)).files.map(r => r.id)).toEqual([f.link])

    const withOg = await fixture()
    const og = Number((await ok(A, W.linkMedia(withOg.id, 'og_image'))).rows[0])
    await ok(B, W.archive(withOg.id))
    await refused(A, W.ogImage(og), 'archived')
    await refused(A, W.unlinkMedia(og), 'archived')
    expect((await state(withOg.id)).files.map(r => r.id)).toEqual([withOg.link, og])
    record({ case: 'OG Archive vs Open Graph', winner: 'Archive', loser: 'OG add (waited) / replace / remove', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; OG link unchanged' })
  })

  // ── E. Archive vs Relations ────────────────────────────────────────────────────────────

  it('E. Archive vs Relations — add / reorder / remove / move are refused for an archived owner; targets get no new rule', async () => {
    const first = await fixture()
    const extra = await fixture()
    expect((await barrier(A, W.addRelation(first.id, extra.id), B, W.archive(first.id))).waited.ok).toBe(true)

    const f = await fixture()
    const draft = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.addRelation(f.id, draft.id))
    expectGuard(waited, 'archived')
    await refused(A, W.sortRelation(f.relation), 'archived')
    await refused(A, W.removeRelation(f.relation), 'archived')
    await refused(A, W.moveRelation(f.relation, draft.id), 'archived')
    await refused(A, W.moveRelation(draft.relation, f.id), 'archived')
    expect((await state(f.id)).relations).toEqual([{ id: f.relation, sort: 0 }])
    // A draft owner may still reference an archived item (no new relation-target rule).
    await ok(A, W.addRelation(draft.id, f.id))
    // Foreign-key cascades are not edits: deleting a relation target removes the archived owner's relation.
    await ok(A, `DELETE FROM content_items WHERE id = ${extra.id};`)
    expect((await state(first.id)).relations).toEqual([{ id: first.relation, sort: 0 }])
    record({ case: 'E Archive vs Relations', winner: 'Archive', loser: 'relation add (waited) / sort / delete / re-parent', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; relations unchanged; FK cascade still works' })
  })

  // ── F. Archive vs Start Locale ─────────────────────────────────────────────────────────

  it('F. Archive vs Start locale — a new locale waits for Archive and is refused; locale first is serialized', async () => {
    const first = await fixture()
    expect((await barrier(A, W.startLocale(first.id, 'pt'), B, W.archive(first.id))).waited.ok).toBe(true)
    expect(Object.keys((await state(first.id)).locales).sort()).toEqual(['en', 'es', 'pt'])

    const f = await fixture()
    const { waited } = await barrier(B, W.archive(f.id), A, W.startLocale(f.id, 'pt'))
    expectGuard(waited, 'archived')
    expect(Object.keys((await state(f.id)).locales).sort()).toEqual(['en', 'es'])
    record({ case: 'F Archive vs Start locale', winner: 'Archive', loser: 'locale INSERT (waited)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; no pt row' })
  })

  // ── G. Archive vs Unpublish ────────────────────────────────────────────────────────────

  it('G. Archive vs Unpublish — a stale Unpublish never passes after Archive; only the Restore clear is allowed', async () => {
    const f = await fixture({ published: true })
    const { waited } = await barrier(B, W.archive(f.id), A, W.unpublishLocale(f.es))
    expectGuard(waited, 'archived')
    await refused(A, W.unpublishItem(f.id), 'archived')
    await refused(A, W.unpublishLocale(f.en), 'archived')
    let after = await state(f.id)
    expect(after).toMatchObject({ status: 'archived', archived: true })
    expect(after.locales.es).toMatchObject({ has_snapshot: true, last_change_kind: 'publish' })

    // Default-locale Unpublish interrupted by Archive: the item step ran before Archive, the locale clear after.
    const d = await fixture({ published: true })
    await ok(A, W.unpublishItem(d.id))
    await ok(B, W.archive(d.id))
    await refused(A, W.unpublishLocale(d.en), 'archived')
    after = await state(d.id)
    expect(after).toMatchObject({ status: 'archived' })
    expect(after.locales.en!.has_snapshot).toBe(true)

    // The narrow Restore exception: publication fields to NULL, marker restore, nothing else.
    await refused(A, `UPDATE content_item_locales SET published_snapshot = NULL, published_revision = NULL, published_at = NULL, last_change_kind = 'restore', title = 'changed', draft_revision = 2 WHERE id = ${f.en};`, 'archived')
    await refused(A, `UPDATE content_item_locales SET published_snapshot = NULL, published_revision = NULL, published_at = NULL, last_change_kind = 'restore', draft_revision = 2 WHERE id = ${f.en};`, 'archived')
    await refused(A, `UPDATE content_item_locales SET published_revision = 1, last_change_kind = 'restore' WHERE id = ${f.en};`, 'archived')
    await refused(A, `UPDATE content_item_locales SET published_snapshot = '{"title":"x"}'::json, published_revision = NULL, published_at = NULL, last_change_kind = 'restore' WHERE id = ${f.en};`, 'archived')
    await ok(A, W.restoreLocales([f.en, f.es]))
    record({ case: 'G Archive vs Unpublish', winner: 'Archive', loser: 'Unpublish (non-default waited; default item step; late locale clear)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; snapshots kept until Restore clears them' })
  })

  // ── H. Duplicate Archive ───────────────────────────────────────────────────────────────

  it('H. Duplicate Archive — the second Archive waits and is refused; archived_at keeps the first value', async () => {
    const f = await fixture()
    const { held, waited } = await barrier(A, W.archive(f.id), B, W.archive(f.id))
    expectGuard(waited, 'archived')
    const archivedAt = await sqlOk(`SELECT archived_at FROM content_items WHERE id = ${f.id};`)
    expect(new Date(archivedAt).getTime()).toBe(new Date(held.rows[0]!).getTime())
    await refused(A, `UPDATE content_items SET date_updated = now() WHERE id = ${f.id};`, 'archived')
    record({ case: 'H Duplicate Archive', winner: 'first Archive', loser: 'second Archive (waited)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'archived; archived_at of the winner' })
  })

  // ── I. Duplicate Restore ───────────────────────────────────────────────────────────────

  it('I1. Duplicate Restore, both locale steps before either item step — the second item step is refused', async () => {
    const f = await fixture({ published: true, archived: true })
    await ok(A, `BEGIN;\n${W.restoreLocales([f.en, f.es])}\nCOMMIT;`)
    await ok(B, `BEGIN;\n${W.restoreLocales([f.en, f.es])}\nCOMMIT;`)
    await ok(A, W.restoreItem(f.id))
    const second = await refused(B, W.restoreItem(f.id), 'not_archived')
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'draft', archived: false })
    expect(Object.values(after.locales).every(l => !l.has_snapshot && l.last_change_kind === 'restore')).toBe(true)
    record({ case: 'I1 Duplicate Restore (interleaved steps)', winner: 'first Restore', loser: 'second Restore item step', loserError: `${second.sqlstate} ${second.message}`, final: 'draft; archived_at null; snapshots cleared' })
  })

  it('I2. Duplicate Restore after the first finished — the second locale step is refused by the restore marker guard', async () => {
    const f = await fixture({ published: true, archived: true })
    await ok(A, `BEGIN;\n${W.restoreLocales([f.en, f.es])}\nCOMMIT;`)
    await ok(A, W.restoreItem(f.id))
    const second = await refused(B, W.restoreLocales([f.en]), 'not_archived')
    expect(await state(f.id)).toMatchObject({ status: 'draft', archived: false })
    record({ case: 'I2 Duplicate Restore (sequential)', winner: 'first Restore', loser: 'second Restore locale step', loserError: `${second.sqlstate} ${second.message}`, final: 'draft' })
  })

  it('I3. Duplicate Restore item steps racing — the second waits and is refused; Restore needs cleared snapshots', async () => {
    const f = await fixture({ published: true, archived: true })
    await refused(A, W.restoreItem(f.id), 'restore_before_publication_cleared')
    await refused(A, W.publishItem(f.id), 'archived')
    await ok(A, `BEGIN;\n${W.restoreLocales([f.en, f.es])}\nCOMMIT;`)
    const { waited } = await barrier(A, W.restoreItem(f.id), B, W.restoreItem(f.id))
    expectGuard(waited, 'not_archived')
    expect(await state(f.id)).toMatchObject({ status: 'draft', archived: false })
    record({ case: 'I3 Duplicate Restore (item step race)', winner: 'first Restore', loser: 'second Restore item step (waited)', loserError: `${waited.sqlstate} ${waited.message}`, final: 'draft' })
  })

  // ── J. Restore vs Editor ───────────────────────────────────────────────────────────────

  it('J. Restore vs Editor — refused while the item is still archived; allowed once Restore has committed', async () => {
    const f = await fixture({ published: true, archived: true })
    const { waited: duringLocaleStep } = await barrier(A, W.restoreLocales([f.en, f.es]), B, W.editor(f.en, 2, `${TITLE} during restore`))
    expectGuard(duringLocaleStep, 'archived')
    const { waited: afterItemStep } = await barrier(A, W.restoreItem(f.id), B, W.editor(f.en, 2, `${TITLE} after restore`))
    expect(afterItemStep.ok).toBe(true)
    const after = await state(f.id)
    expect(after).toMatchObject({ status: 'draft', archived: false })
    expect(after.locales.en).toMatchObject({ title: `${TITLE} after restore`, draft_revision: 2, has_snapshot: false })
    record({ case: 'J Restore vs Editor', winner: 'Restore', loser: 'Editor save while archived (waited on locale row lock)', loserError: `${duringLocaleStep.sqlstate} ${duringLocaleStep.message}`, final: 'draft; the edit that waited for the item step succeeded on the restored draft' })
  })

  it('cascade: deleting an archived item or a relation target is not blocked by the guard', async () => {
    const f = await fixture({ published: true, archived: true })
    await ok(A, `DELETE FROM content_items WHERE id = ${f.id};`)
    expect(await sqlOk(`SELECT count(*) FROM content_items_files WHERE content_items_id = ${f.id};`)).toBe('0')
  })
})
