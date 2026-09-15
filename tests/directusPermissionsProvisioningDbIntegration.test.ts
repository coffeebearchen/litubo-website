/**
 * DIRECTUS-PERMISSIONS-PROVISIONING-01 — the tracked nuxt-server permission artifact against the
 * real local PostgreSQL (directus/schema/directus-permissions-01-nuxt-server-content-read*.sql).
 *
 * Runs only against a local development database, and only when the Postgres container is named
 * explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/directusPermissionsProvisioningDbIntegration.test.ts
 *
 * psql runs inside the container with the container's own environment; no credential is read or
 * printed. Every tamper case runs inside a transaction that fails and is rolled back, so the only
 * lasting state is the artifact applied — which is this module's intended local configuration.
 * The legacy site-readonly permission rows are compared field by field before and after.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const DIR = resolve(process.cwd(), 'directus/schema')
const APPLY = readFileSync(resolve(DIR, 'directus-permissions-01-nuxt-server-content-read.sql'), 'utf8')
const VERIFY = readFileSync(resolve(DIR, 'directus-permissions-01-nuxt-server-content-read.verify.sql'), 'utf8')
const ROLLBACK = readFileSync(resolve(DIR, 'directus-permissions-01-nuxt-server-content-read.rollback.sql'), 'utf8')

const OWNED = ['content_items', 'content_item_locales', 'media_file_lifecycle']
const FORBIDDEN = ['content_items_files', 'content_relations', 'directus_revisions', 'directus_activity']

function body(sql: string, name: 'apply' | 'verify' | 'rollback'): string {
  const start = sql.indexOf(`-- ${name}:begin`)
  const end = sql.indexOf(`-- ${name}:end`)
  if (start < 0 || end < 0) throw new Error(`markers for ${name} missing`)
  return sql.slice(start, end)
}

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

async function sqlOk(sql: string): Promise<string> {
  const result = await psql(sql)
  expect(result.ok, result.stderr).toBe(true)
  return result.stdout.trim()
}

const POLICY = `(SELECT p.id FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
  WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy')`
const inList = (list: string[]) => list.map(c => `'${c}'`).join(',')

/** Every column of every non-owned row of the policy, with ids, as canonical JSON. */
const legacyRows = () => sqlOk(`SELECT coalesce(json_agg(json_build_object('id', id, 'collection', collection, 'action', action, 'fields', fields,
  'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY id)::text, '[]')
  FROM directus_permissions WHERE policy = ${POLICY} AND collection NOT IN (${inList(OWNED)});`)

/** Every permission row of every policy, with ids — the whole table, canonical. */
const allRows = () => sqlOk(`SELECT coalesce(json_agg(json_build_object('id', id, 'policy', policy, 'collection', collection, 'action', action, 'fields', fields,
  'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY id)::text, '[]') FROM directus_permissions;`)

const ownedRows = async () => JSON.parse(await sqlOk(`SELECT coalesce(json_agg(json_build_object('collection', collection, 'action', action, 'fields', fields,
  'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY collection)::text, '[]')
  FROM directus_permissions WHERE policy = ${POLICY} AND collection IN (${inList(OWNED)});`)) as Array<Record<string, unknown>>

const EXPECTED = [
  {
    collection: 'content_item_locales', action: 'read', fields: 'content_items_id,locale,slug,published_snapshot,published_at', validation: null, presets: null,
    permissions: { _and: [
      { published_snapshot: { _nnull: true } }, { locale: { _eq: 'en' } },
      { content_items_id: { status: { _eq: 'published' } } }, { content_items_id: { archived_at: { _null: true } } },
      { content_items_id: { content_type: { _in: ['technical_article', 'case_study'] } } },
    ] },
  },
  {
    collection: 'content_items', action: 'read', fields: 'id,content_type,status,archived_at', validation: null, presets: null,
    permissions: { _and: [{ status: { _eq: 'published' } }, { archived_at: { _null: true } }, { content_type: { _in: ['technical_article', 'case_study'] } }] },
  },
  { collection: 'media_file_lifecycle', action: 'read', fields: 'file_id,archived', validation: null, presets: null, permissions: { archived: { _eq: true } } },
]

/** Runs `setup` then `script` in one transaction that is never committed. */
async function inRolledBackTransaction(setup: string, script: string): Promise<PsqlResult> {
  return psql(`BEGIN;\n${setup}\n${script}\nROLLBACK;\n`)
}

describe.skipIf(!CONTAINER)('Directus permission provisioning artifact — real PostgreSQL', () => {
  let legacyBefore = ''

  beforeAll(async () => {
    legacyBefore = await legacyRows()
  }, 60_000)

  it('the three artifact files carry their markers and never reference secrets, users or tokens', () => {
    for (const sql of [APPLY, VERIFY, ROLLBACK]) {
      const code = sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n')
      expect(code).not.toMatch(/directus_users|token|password|secret|\bINSERT INTO directus_(policies|roles|access)\b|UPDATE directus_(policies|roles|access)\b|DELETE FROM directus_(policies|roles|access)\b/i)
    }
    expect(body(APPLY, 'apply')).toContain('LOOP')
    expect(body(VERIFY, 'verify')).toContain('RAISE EXCEPTION')
    expect(body(ROLLBACK, 'rollback')).toContain('DELETE FROM directus_permissions WHERE id = existing.id')
  })

  it('apply twice is idempotent: the whole permission table, ids included, is identical after the second run', async () => {
    await sqlOk(APPLY)
    const first = await allRows()
    const seqFirst = await sqlOk('SELECT last_value FROM directus_permissions_id_seq;')
    await sqlOk(APPLY)
    expect(await allRows()).toBe(first)
    expect(await sqlOk('SELECT last_value FROM directus_permissions_id_seq;')).toBe(seqFirst)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_verify: OK')
  }, 120_000)

  it('grants exactly the minimum read rows, nothing forbidden, and no Content permission on any public policy', async () => {
    expect(await ownedRows()).toEqual(EXPECTED)
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY} AND collection IN (${inList(FORBIDDEN)});`)).toBe('0')
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY} AND collection IN (${inList(OWNED)}) AND action <> 'read';`)).toBe('0')
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE collection IN (${inList([...OWNED, ...FORBIDDEN])})
      AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL);`)).toBe('0')
    expect(await sqlOk(`SELECT count(*) FROM (SELECT collection, action FROM directus_permissions WHERE policy = ${POLICY} GROUP BY 1, 2 HAVING count(*) > 1) d;`)).toBe('0')
    // The working-copy columns are not in any readable field list.
    const localeFields = String(EXPECTED[0]!.fields).split(',')
    for (const column of ['title', 'summary', 'blocks', 'seo_title', 'seo_description', 'canonical_path', 'noindex', 'draft_revision', 'last_change_kind', 'published_revision', 'user_created', 'user_updated']) {
      expect(localeFields).not.toContain(column)
    }
  }, 60_000)

  it('the legacy site-readonly rows are unchanged, field by field and id by id', async () => {
    expect(await legacyRows()).toBe(legacyBefore)
  }, 60_000)

  it('normalizes a drifted owned row in place (same id) and changes nothing else', async () => {
    const result = await inRolledBackTransaction(
      `UPDATE directus_permissions SET fields = '*', permissions = '{}' WHERE policy = ${POLICY} AND collection = 'content_items';`,
      `${body(APPLY, 'apply')}
       SELECT fields || '|' || (permissions::jsonb = '{"_and":[{"status":{"_eq":"published"}},{"archived_at":{"_null":true}},{"content_type":{"_in":["technical_article","case_study"]}}]}'::jsonb)::text
         FROM directus_permissions WHERE policy = ${POLICY} AND collection = 'content_items';`,
    )
    expect(result.ok, result.stderr).toBe(true)
    expect(result.stdout.trim().split('\n').at(-1)).toBe('id,content_type,status,archived_at|true')
    expect(await ownedRows()).toEqual(EXPECTED)
  }, 60_000)

  it.each([
    ['a second policy with the same name', `INSERT INTO directus_policies (id, name, icon, admin_access, app_access, enforce_tfa) VALUES (gen_random_uuid(), 'site-readonly-policy', 'badge', false, false, false);`, 'expected exactly one policy'],
    ['a second access link to the policy', `INSERT INTO directus_access (id, role, policy) SELECT gen_random_uuid(), r.id, p.id FROM directus_roles r, directus_policies p WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';`, 'expected exactly one access link'],
    ['the policy gaining app access', `UPDATE directus_policies SET app_access = true WHERE name = 'site-readonly-policy';`, 'neither admin nor app access'],
    ['a non-read permission on an owned collection', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('content_items', 'update', 'status', ${POLICY});`, 'non-read permission'],
    ['a duplicate read row on an owned collection', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('content_item_locales', 'read', '*', ${POLICY});`, 'read permissions exist'],
    ['a permission on a forbidden junction', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('content_items_files', 'read', '*', ${POLICY});`, 'forbidden collection'],
    ['a Content permission on the public policy', `INSERT INTO directus_permissions (collection, action, fields, policy) SELECT 'content_item_locales', 'read', '*', policy FROM directus_access WHERE role IS NULL AND "user" IS NULL LIMIT 1;`, 'public policy'],
  ])('apply fails closed on %s and writes nothing', async (_label, tamper, message) => {
    const before = await allRows()
    const result = await inRolledBackTransaction(tamper, body(APPLY, 'apply'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
    expect(await allRows()).toBe(before)
  }, 60_000)

  it('verify fails on a drifted row and on a public Content permission (transactions rolled back)', async () => {
    const drift = await inRolledBackTransaction(`UPDATE directus_permissions SET fields = fields || ',title' WHERE policy = ${POLICY} AND collection = 'content_item_locales';`, body(VERIFY, 'verify'))
    expect(drift.ok).toBe(false)
    expect(drift.stderr).toContain('does not match the artifact')
    const publicGrant = await inRolledBackTransaction(
      `INSERT INTO directus_permissions (collection, action, fields, policy) SELECT 'content_items', 'read', 'id', policy FROM directus_access WHERE role IS NULL AND "user" IS NULL LIMIT 1;`,
      body(VERIFY, 'verify'),
    )
    expect(publicGrant.ok).toBe(false)
    expect(publicGrant.stderr).toContain('public policy')
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_verify: OK')
  }, 60_000)

  it('rollback refuses to delete a drifted owned row', async () => {
    const result = await inRolledBackTransaction(`UPDATE directus_permissions SET fields = 'file_id' WHERE policy = ${POLICY} AND collection = 'media_file_lifecycle';`, body(ROLLBACK, 'rollback'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('not deleted')
    expect(await ownedRows()).toEqual(EXPECTED)
  }, 60_000)

  it('rollback removes only the owned rows; verify then fails; re-apply restores them and verify passes', async () => {
    await sqlOk(ROLLBACK)
    expect(await ownedRows()).toEqual([])
    expect(await legacyRows()).toBe(legacyBefore)
    const failed = await psql(VERIFY)
    expect(failed.ok).toBe(false)
    await sqlOk(APPLY)
    expect(await ownedRows()).toEqual(EXPECTED)
    expect(await legacyRows()).toBe(legacyBefore)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_verify: OK')
  }, 120_000)
})
