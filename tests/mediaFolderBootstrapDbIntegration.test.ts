/**
 * MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01 — the Protected System Folder bootstrap
 * (directus/schema/directus-media-folders-01-bootstrap.sql and its .verify.sql) against the real local
 * PostgreSQL.
 *
 * Runs only against a local development database, and only when the Postgres container is named
 * explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/mediaFolderBootstrapDbIntegration.test.ts
 *
 * psql runs inside the container with the container's own environment; no credential is read or
 * printed.
 *
 * The development database's own folder tree is never written — not even inside a transaction. Every
 * case builds a private TEST ONLY copy of `directus_folders` (same columns, defaults and primary key,
 * plus the same parent foreign key) in a schema created inside one transaction that is always rolled
 * back, and points search_path at it, so the artifact's unqualified `directus_folders` is that copy. A
 * write spy — an AFTER trigger on the copy that reports each INSERT, UPDATE and DELETE as a NOTICE —
 * counts what the artifact actually wrote. A notice reaches the client even when the transaction then
 * aborts, so a refusal is shown to have written nothing at all. The real table is fingerprinted before
 * and after the whole file, and no schema is left behind.
 */

import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildFolderRegistry } from '../server/utils/folderRegistry'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const DIR = resolve(process.cwd(), 'directus/schema')
const APPLY_FILE = readFileSync(resolve(DIR, 'directus-media-folders-01-bootstrap.sql'), 'utf8')
/** The verify file is read-only and has no transaction control, so it runs whole, final OK line included. */
const VERIFY = readFileSync(resolve(DIR, 'directus-media-folders-01-bootstrap.verify.sql'), 'utf8')
const VERIFY_OK = 'directus_media_folders_verify: OK'

/** The apply block without the file's own BEGIN / COMMIT, so it runs inside the rolled-back transaction. */
const APPLY = (() => {
  const start = APPLY_FILE.indexOf('-- apply:begin')
  const end = APPLY_FILE.indexOf('-- apply:end')
  if (start < 0 || end < 0) throw new Error('apply markers missing')
  return APPLY_FILE.slice(start, end)
})()

/** A private schema for this run. It only ever exists inside a transaction that is rolled back. */
const SCHEMA = `litubo_folder_bootstrap_test_${randomBytes(4).toString('hex')}`

const CANONICAL = [
  'home', 'applications', 'company', 'products', 'resources',
  'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination', 'products/conveyor',
]
const NEVER_BOOTSTRAPPED = [
  'products/technical-docs', 'resources/insights', 'resources/case-studies', 'resources/downloads',
  'company/global-service', 'certifications', 'brand', 'resources/manuals', 'resources/certificates', 'test-only',
]

interface PsqlResult { ok: boolean, stdout: string, stderr: string }

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((done) => {
    const child = execFile(
      'docker',
      ['exec', '-i', CONTAINER, 'sh', '-c', 'psql -X -q -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { timeout: 60_000 },
      (error, stdout, stderr) => done({ ok: !error, stdout: String(stdout), stderr: String(stderr) }),
    )
    child.stdin?.end(sql)
  })
}

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`

/** Stand-in UUIDs for TEST ONLY fixture rows; no identifier from any environment. */
const testId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

interface Row { id: string, name: string, parent: string | null }
const insert = (rows: Row[]) => rows
  .map(row => `INSERT INTO directus_folders (id, name, parent) VALUES ('${row.id}', ${literal(row.name)}, ${row.parent ? `'${row.parent}'` : 'NULL'});`)
  .join('\n')

/** A tree given as paths, parents first, each with a fixed TEST id. */
function tree(paths: string[], firstId = 1): Row[] {
  const ids = new Map<string, string>()
  return paths.map((path, index) => {
    const cut = path.lastIndexOf('/')
    const id = testId(firstId + index)
    ids.set(path, id)
    const parent = cut < 0 ? null : ids.get(path.slice(0, cut))
    if (parent === undefined) throw new Error(`fixture lists ${path} before its parent`)
    return { id, name: path.slice(cut + 1), parent }
  })
}

const STANDARD_TABLE = `CREATE TABLE ${SCHEMA}.directus_folders (LIKE public.directus_folders INCLUDING ALL);
ALTER TABLE ${SCHEMA}.directus_folders ADD FOREIGN KEY (parent) REFERENCES ${SCHEMA}.directus_folders (id);`

const WRITE_SPY = `CREATE FUNCTION ${SCHEMA}.write_spy() RETURNS trigger LANGUAGE plpgsql AS $spy$
BEGIN
  RAISE NOTICE 'write-spy: % %', TG_OP, coalesce(NEW.name, OLD.name);
  RETURN NULL;
END
$spy$;
CREATE TRIGGER write_spy AFTER INSERT OR UPDATE OR DELETE ON ${SCHEMA}.directus_folders
  FOR EACH ROW EXECUTE FUNCTION ${SCHEMA}.write_spy();`

/** Prints the copy's rows with their paths, as one parseable line. */
const SNAPSHOT = `WITH RECURSIVE tree AS (
  SELECT id, parent, name::text AS path FROM directus_folders WHERE parent IS NULL
  UNION ALL
  SELECT f.id, f.parent, tree.path || '/' || f.name FROM directus_folders f JOIN tree ON f.parent = tree.id
)
SELECT 'SNAPSHOT ' || json_build_object(
  'count', (SELECT count(*) FROM directus_folders),
  'rows', coalesce((SELECT json_agg(json_build_object('id', id, 'parent', parent, 'path', path) ORDER BY path, id) FROM tree), '[]'::json)
)::text;`

/** Separates the write-spy notices of one run from the next. */
const phase = (name: string) => `DO $phase$ BEGIN RAISE NOTICE 'phase: %', ${literal(name)}; END $phase$;`

interface Snapshot { count: number, rows: Array<{ id: string, parent: string | null, path: string }> }
interface Run extends PsqlResult { snapshots: Snapshot[], writes: Array<{ phase: string, op: string, name: string }> }

/**
 * Builds the TEST ONLY copy, seeds it, arms the write spy, runs `script`, and rolls everything back.
 * Seed rows go in before the spy, so only what the script writes is counted.
 */
async function inScratch(script: string, { seed = '', table = STANDARD_TABLE }: { seed?: string, table?: string } = {}): Promise<Run> {
  const result = await psql(`BEGIN;
CREATE SCHEMA ${SCHEMA};
${table}
SET LOCAL search_path TO ${SCHEMA};
${seed}
${WRITE_SPY}
${phase('script')}
${script}
ROLLBACK;
`)
  const snapshots = result.stdout.split(/\r?\n/)
    .filter(line => line.startsWith('SNAPSHOT '))
    .map(line => JSON.parse(line.slice('SNAPSHOT '.length)) as Snapshot)
  const writes: Run['writes'] = []
  let current = ''
  for (const line of result.stderr.split(/\r?\n/)) {
    const marker = line.match(/NOTICE:\s+phase: (.*)$/)
    if (marker) current = marker[1]!
    const write = line.match(/NOTICE:\s+write-spy: (INSERT|UPDATE|DELETE) (.*)$/)
    if (write) writes.push({ phase: current, op: write[1]!, name: write[2]! })
  }
  return { ...result, snapshots, writes }
}

const paths = (snapshot: Snapshot) => snapshot.rows.map(row => row.path).sort()
const idAt = (snapshot: Snapshot, path: string) => snapshot.rows.find(row => row.path === path)?.id

/** Refused before any write: psql failed, the reason is in stderr, and the spy saw nothing. */
function expectRefused(run: Run, reason: string) {
  expect(run.ok, run.stdout).toBe(false)
  expect(run.stderr).toContain(reason)
  expect(run.stderr).not.toContain('directus_media_folders_bootstrap: created')
  expect(run.writes).toEqual([])
}

const PUBLIC_FINGERPRINT = `SELECT count(*) || ' ' || md5(coalesce(string_agg(id::text || '|' || name || '|' || coalesce(parent::text, ''), ',' ORDER BY id), ''))
  FROM public.directus_folders;`
const LEFTOVER_SCHEMAS = `SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'litubo_folder_bootstrap_test_%';`

describe.skipIf(!CONTAINER)('folder bootstrap against the real local PostgreSQL — TEST ONLY copies, always rolled back', () => {
  let publicBefore = ''

  beforeAll(async () => {
    const result = await psql(PUBLIC_FINGERPRINT)
    expect(result.ok, result.stderr).toBe(true)
    publicBefore = result.stdout.trim()
    expect((await psql(LEFTOVER_SCHEMAS)).stdout.trim()).toBe('0')
  })

  afterAll(async () => {
    // The development tree is byte-for-byte what it was, and no scratch schema survived.
    expect((await psql(PUBLIC_FINGERPRINT)).stdout.trim()).toBe(publicBefore)
    expect((await psql(LEFTOVER_SCHEMAS)).stdout.trim()).toBe('0')
  })

  describe('fresh, idempotent, partial, existing', () => {
    it('fresh: an empty table gets exactly the ten canonical folders, and verify passes', async () => {
      const run = await inScratch(`${APPLY}\n${SNAPSHOT}\n${VERIFY}`)
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes.filter(write => write.op === 'INSERT')).toHaveLength(10)
      expect(run.writes.filter(write => write.op !== 'INSERT')).toEqual([])
      const [snapshot] = run.snapshots
      expect(snapshot!.count).toBe(10)
      expect(paths(snapshot!)).toEqual([...CANONICAL].sort())
      for (const path of NEVER_BOOTSTRAPPED) expect(paths(snapshot!)).not.toContain(path)
      // Every category hangs from the one products folder that was just created.
      const products = idAt(snapshot!, 'products')
      for (const row of snapshot!.rows.filter(r => r.path.startsWith('products/'))) expect(row.parent).toBe(products)
      for (const row of snapshot!.rows.filter(r => !r.path.includes('/'))) expect(row.parent).toBeNull()
      expect(new Set(snapshot!.rows.map(row => row.id)).size).toBe(10)
      for (const row of snapshot!.rows) expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(run.stdout).toContain(VERIFY_OK)
    })

    it('the rows it creates read back as ten protected system folders, with the five product categories as customer zones', async () => {
      const run = await inScratch(`${APPLY}\n${SNAPSHOT}`)
      expect(run.ok, run.stderr).toBe(true)
      const rows = run.snapshots[0]!.rows.map(row => ({ id: row.id, name: row.path.slice(row.path.lastIndexOf('/') + 1), parent: row.parent }))
      const registry = buildFolderRegistry(rows)
      expect(registry.map(entry => entry.full_path).sort()).toEqual([...CANONICAL].sort())
      for (const entry of registry) expect(entry.management, entry.full_path).toBe('protected')
      expect(registry.filter(entry => entry.zone_root === entry.full_path).map(entry => entry.full_path).sort())
        .toEqual(CANONICAL.filter(path => path.startsWith('products/')).sort())
      expect(registry.find(entry => entry.full_path === 'products')!.policy_state).toBe('container-only')
      expect(registry.find(entry => entry.full_path === 'resources')!.policy_state).toBe('container-only')
    })

    it('idempotent: a second run writes nothing, and every UUID, parent and path is unchanged', async () => {
      const run = await inScratch(`${APPLY}\n${SNAPSHOT}\n${phase('second run')}\n${APPLY}\n${SNAPSHOT}\n${VERIFY}`)
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes.filter(write => write.phase === 'script')).toHaveLength(10)
      expect(run.writes.filter(write => write.phase === 'second run')).toEqual([])
      const [first, second] = run.snapshots
      expect(second).toEqual(first)
      expect(second!.count).toBe(10)
      expect(run.stderr).toContain('directus_media_folders_bootstrap: created [], kept [home, applications, company, products, resources, products/xray, products/metal-detection, products/checkweigher, products/combination, products/conveyor]')
      expect(run.stdout).toContain(VERIFY_OK)
    })

    it('partial: an existing products and products/xray keep their UUIDs, and only the missing eight are created', async () => {
      const seed = tree(['products', 'products/xray'])
      const run = await inScratch(`${APPLY}\n${SNAPSHOT}\n${VERIFY}`, { seed: insert(seed) })
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes.map(write => write.op)).toEqual(Array.from({ length: 8 }, () => 'INSERT'))
      expect(run.writes.map(write => write.name)).not.toContain('products')
      expect(run.writes.map(write => write.name)).not.toContain('xray')
      const snapshot = run.snapshots[0]!
      expect(paths(snapshot)).toEqual([...CANONICAL].sort())
      expect(idAt(snapshot, 'products')).toBe(testId(1))
      expect(idAt(snapshot, 'products/xray')).toBe(testId(2))
      for (const category of ['products/metal-detection', 'products/checkweigher', 'products/combination', 'products/conveyor']) {
        expect(snapshot.rows.find(row => row.path === category)!.parent).toBe(testId(1))
      }
      expect(run.stdout).toContain(VERIFY_OK)
    })

    it('an older environment — legacy, frozen and customer folders included — is left exactly as it is', async () => {
      const seed = tree([
        ...CANONICAL,
        'company/global-service', 'products/technical-docs', 'resources/case-studies', 'resources/downloads',
        'resources/insights', 'certifications',
        'products/xray/LT-180C TEST ONLY', 'products/xray/LT-180C TEST ONLY/manuals',
        // A customer folder that happens to carry a canonical name, inside a customer zone.
        'products/conveyor/spares TEST ONLY', 'products/conveyor/spares TEST ONLY/xray',
      ])
      const run = await inScratch(`${SNAPSHOT}\n${APPLY}\n${SNAPSHOT}\n${VERIFY}`, { seed: insert(seed) })
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes).toEqual([])
      const [before, after] = run.snapshots
      expect(after).toEqual(before)
      expect(after!.count).toBe(seed.length)
      for (const [index, path] of CANONICAL.entries()) expect(idAt(after!, path)).toBe(testId(index + 1))
      expect(run.stdout).toContain(VERIFY_OK)
    })

    it('the development database’s own tree, copied: recognised as complete, nothing written, verify passes', async () => {
      const run = await inScratch(`${SNAPSHOT}\n${APPLY}\n${SNAPSHOT}\n${VERIFY}`, {
        seed: 'INSERT INTO directus_folders SELECT * FROM public.directus_folders;',
      })
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes).toEqual([])
      const [before, after] = run.snapshots
      expect(after).toEqual(before)
      expect(after!.count).toBeGreaterThanOrEqual(CANONICAL.length)
      for (const path of CANONICAL) expect(after!.rows.filter(row => row.path === path)).toHaveLength(1)
      expect(run.stdout).toContain(VERIFY_OK)
    })

    it('a customer folder named like a category, inside another zone, is not taken for it: products/xray is created beside it', async () => {
      const seed = tree(['products', 'products/conveyor', 'products/conveyor/xray'])
      const run = await inScratch(`${APPLY}\n${SNAPSHOT}\n${VERIFY}`, { seed: insert(seed) })
      expect(run.ok, run.stderr).toBe(true)
      const snapshot = run.snapshots[0]!
      const xray = snapshot.rows.find(row => row.path === 'products/xray')!
      expect(xray.id).not.toBe(testId(3))
      expect(xray.parent).toBe(testId(1))
      expect(idAt(snapshot, 'products/conveyor/xray')).toBe(testId(3))
      expect(run.writes.map(write => write.op)).toEqual(Array.from({ length: 8 }, () => 'INSERT'))
      expect(run.stdout).toContain(VERIFY_OK)
    })
  })

  describe('refuses, writing nothing, when the tree is not what it expects', () => {
    it('wrong parent: xray at the root while products/xray is missing — never moved, never reused', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree(['products', 'xray'])) })
      expectRefused(run, `'xray' (canonical: products/xray)`)
    })

    it('wrong parent: xray under resources', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree(['products', 'resources', 'resources/xray'])) })
      expectRefused(run, `'resources/xray' (canonical: products/xray)`)
    })

    it('wrong parent: a canonical root name nested outside the zones', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree(['company', 'company/home'])) })
      expectRefused(run, `'company/home' (canonical: home)`)
    })

    it('a stray canonical name outside the zones is refused even when the canonical folder exists', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree([...CANONICAL, 'certifications', 'certifications/xray'])) })
      expectRefused(run, `'certifications/xray' (canonical: products/xray)`)
    })

    it('duplicate canonical root: two roots named products', async () => {
      const run = await inScratch(APPLY, { seed: insert([{ id: testId(1), name: 'products', parent: null }, { id: testId(2), name: 'products', parent: null }]) })
      expectRefused(run, 'canonical path(s) held by more than one folder: products (2 folders)')
    })

    it('duplicate canonical child: two xray under the one products', async () => {
      const run = await inScratch(APPLY, {
        seed: insert([
          { id: testId(1), name: 'products', parent: null },
          { id: testId(2), name: 'xray', parent: testId(1) },
          { id: testId(3), name: 'xray', parent: testId(1) },
        ]),
      })
      expectRefused(run, 'products/xray (2 folders)')
    })

    it('duplicate path through two products roots, each with its own xray', async () => {
      const run = await inScratch(APPLY, {
        seed: insert([
          { id: testId(1), name: 'products', parent: null },
          { id: testId(2), name: 'products', parent: null },
          { id: testId(3), name: 'xray', parent: testId(1) },
          { id: testId(4), name: 'xray', parent: testId(2) },
        ]),
      })
      expectRefused(run, 'products (2 folders), products/xray (2 folders)')
    })

    it('a root that differs from a canonical name only by case', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree(['Products'])) })
      expectRefused(run, `'Products' (for products)`)
    })

    it('a root that differs from a canonical name only by surrounding whitespace', async () => {
      const run = await inScratch(APPLY, { seed: insert([{ id: testId(1), name: ' home ', parent: null }]) })
      expectRefused(run, `' home ' (for home)`)
    })

    it('a category that differs from its canonical name only by case', async () => {
      const run = await inScratch(APPLY, { seed: insert(tree(['products', 'products/XRay'])) })
      expectRefused(run, `'products/XRay' (for products/xray)`)
    })

    it('a parent cycle, whose folders have no path', async () => {
      const seed = `${insert(tree(['cycle-a TEST ONLY', 'cycle-a TEST ONLY/cycle-b TEST ONLY']))}
UPDATE directus_folders SET parent = '${testId(2)}' WHERE id = '${testId(1)}';`
      const run = await inScratch(APPLY, { seed })
      expectRefused(run, '2 folder(s) cannot be reached from a root')
    })

    it('a folder name containing "/", which would make paths ambiguous', async () => {
      const run = await inScratch(APPLY, { seed: insert([{ id: testId(1), name: 'products/xray', parent: null }]) })
      expectRefused(run, `folder name(s) containing "/" make folder paths ambiguous: 'products/xray'`)
    })

    it('a directus_folders table of another shape', async () => {
      const table = `CREATE TABLE ${SCHEMA}.directus_folders (id uuid PRIMARY KEY, name varchar(255) NOT NULL);`
      const run = await inScratch(APPLY, { table })
      expectRefused(run, 'directus_folders does not have the expected Directus 12.3.1 shape (2 of 3 columns)')
    })
  })

  describe('verify fails closed on the same conditions, and on a missing folder', () => {
    it('a canonical folder is missing', async () => {
      const run = await inScratch(VERIFY, { seed: insert(tree(CANONICAL.filter(path => path !== 'resources'))) })
      expect(run.ok).toBe(false)
      expect(run.stderr).toContain('expected exactly one folder at each canonical path: resources (0 found)')
      expect(run.stdout).not.toContain(VERIFY_OK)
    })

    it('an empty table', async () => {
      const run = await inScratch(VERIFY)
      expect(run.ok).toBe(false)
      expect(run.stderr).toContain('applications (0 found)')
    })

    it('a canonical folder is duplicated', async () => {
      const run = await inScratch(VERIFY, { seed: insert([...tree(CANONICAL), { id: testId(99), name: 'home', parent: null }]) })
      expect(run.ok).toBe(false)
      expect(run.stderr).toContain('home (2 found)')
    })

    it('a canonical name sits outside the zones', async () => {
      const run = await inScratch(VERIFY, { seed: insert(tree([...CANONICAL, 'resources/conveyor'])) })
      expect(run.ok).toBe(false)
      expect(run.stderr).toContain(`'resources/conveyor' (canonical: products/conveyor)`)
    })

    it('a case variant sits beside the canonical position', async () => {
      const run = await inScratch(VERIFY, { seed: insert(tree([...CANONICAL, 'Resources'])) })
      expect(run.ok).toBe(false)
      expect(run.stderr).toContain(`'Resources' (for resources)`)
    })

    it('verify itself writes nothing', async () => {
      const run = await inScratch(`${VERIFY}\n${SNAPSHOT}`, { seed: insert(tree(CANONICAL)) })
      expect(run.ok, run.stderr).toBe(true)
      expect(run.writes).toEqual([])
      expect(run.stdout).toContain(VERIFY_OK)
    })
  })
})
