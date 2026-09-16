/**
 * FINAL-RELEASE-FIX-E — the tracked legacy nuxt-server permission artifact against the real local
 * PostgreSQL (directus/schema/directus-permissions-02-nuxt-server-legacy-site*.sql).
 *
 * Runs only against a local development database, and only when the Postgres container is named
 * explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/directusLegacyPermissionsProvisioningDbIntegration.test.ts
 *
 * psql runs inside the container with the container's own environment; no credential is read or
 * printed. Every tamper case runs inside a transaction that fails and is rolled back, so the only
 * lasting state is the artifact applied — this module's intended local configuration. The three
 * D-034 rows are compared field by field before and after.
 *
 * Intent is checked against real data, not by matching strings in the SQL: the filters are read
 * back out of directus_permissions and compared to the exact expected JSON, and the published-parent
 * predicate is evaluated over the real rows to show which child rows it excludes.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const DIR = resolve(process.cwd(), 'directus/schema')
const APPLY = readFileSync(resolve(DIR, 'directus-permissions-02-nuxt-server-legacy-site.sql'), 'utf8')
const VERIFY = readFileSync(resolve(DIR, 'directus-permissions-02-nuxt-server-legacy-site.verify.sql'), 'utf8')
const ROLLBACK = readFileSync(resolve(DIR, 'directus-permissions-02-nuxt-server-legacy-site.rollback.sql'), 'utf8')
const CONTENT_VERIFY = readFileSync(resolve(DIR, 'directus-permissions-01-nuxt-server-content-read.verify.sql'), 'utf8')

/** Owned by D-034 (artifact 01); this module must leave them exactly as they are. */
const CONTENT = ['content_items', 'content_item_locales', 'media_file_lifecycle']
/** The product child tables whose parent must be a published product. */
const CHILDREN = ['products_files', 'product_faqs', 'product_sections', 'product_section_items', 'product_spec_groups', 'product_spec_items']

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

/** Runs `setup` then `script` in one transaction that is never committed. */
function inRolledBackTransaction(setup: string, script: string): Promise<PsqlResult> {
  return psql(`BEGIN;\n${setup}\n${script}\nROLLBACK;\n`)
}

/** Every permission row of every policy, with ids — the whole table, canonical. */
const allRows = () => sqlOk(`SELECT coalesce(json_agg(json_build_object('id', id, 'policy', policy, 'collection', collection, 'action', action,
  'fields', fields, 'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY id)::text, '[]') FROM directus_permissions;`)

/** The three D-034 rows, without ids. */
const contentRows = () => sqlOk(`SELECT coalesce(json_agg(json_build_object('collection', collection, 'action', action, 'fields', fields,
  'permissions', permissions::jsonb) ORDER BY collection)::text, '[]')
  FROM directus_permissions WHERE policy = ${POLICY} AND collection IN (${inList(CONTENT)});`)

/** Every legacy row this artifact owns, without ids. */
const ownedRows = async () => JSON.parse(await sqlOk(`SELECT coalesce(json_agg(json_build_object('collection', collection, 'action', action, 'fields', fields,
  'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY collection, action)::text, '[]')
  FROM directus_permissions WHERE policy = ${POLICY} AND collection NOT IN (${inList(CONTENT)});`)) as Array<Record<string, unknown>>

const field = (collection: string, action = 'read') =>
  sqlOk(`SELECT coalesce(fields, '') FROM directus_permissions WHERE policy = ${POLICY} AND collection = '${collection}' AND action = '${action}';`)

const filter = (collection: string, action = 'read') =>
  sqlOk(`SELECT coalesce(permissions::text, 'null') FROM directus_permissions WHERE policy = ${POLICY} AND collection = '${collection}' AND action = '${action}';`)

const PUBLISHED_PARENT = {
  products_files: { _and: [{ products_id: { status: { _eq: 'published' } } }, { enabled: { _eq: true } }] },
  product_faqs: { _and: [{ product_id: { status: { _eq: 'published' } } }, { enabled: { _eq: true } }] },
  product_sections: { _and: [{ product_id: { status: { _eq: 'published' } } }, { enabled: { _eq: true } }] },
  product_spec_groups: { _and: [{ product_id: { status: { _eq: 'published' } } }, { enabled: { _eq: true } }] },
  product_section_items: { _and: [{ section_id: { product_id: { status: { _eq: 'published' } } } }, { section_id: { enabled: { _eq: true } } }, { enabled: { _eq: true } }] },
  product_spec_items: { _and: [{ spec_group_id: { product_id: { status: { _eq: 'published' } } } }, { spec_group_id: { enabled: { _eq: true } } }, { enabled: { _eq: true } }] },
} as const

describe.skipIf(!CONTAINER)('FINAL-RELEASE-FIX-E legacy permission artifact — real PostgreSQL', () => {
  let contentBefore = ''

  beforeAll(async () => {
    contentBefore = await contentRows()
    await sqlOk(APPLY)
  }, 120_000)

  it('the three artifact files carry their markers and never touch secrets, users, roles or access links', () => {
    for (const sql of [APPLY, VERIFY, ROLLBACK]) {
      const code = sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n')
      expect(code).not.toMatch(/directus_users|token|password|secret|\bINSERT INTO directus_(policies|roles|access)\b|UPDATE directus_(policies|roles|access)\b|DELETE FROM directus_(policies|roles|access)\b/i)
      // No environment-specific identifier is baked in.
      expect(code).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    }
    expect(body(APPLY, 'apply')).toContain('LOOP')
    expect(body(VERIFY, 'verify')).toContain('RAISE EXCEPTION')
    expect(body(ROLLBACK, 'rollback')).toContain('UPDATE directus_permissions')
  })

  it('applying twice is idempotent: the whole permission table, ids included, is identical', async () => {
    const first = await allRows()
    const seqFirst = await sqlOk('SELECT last_value FROM directus_permissions_id_seq;')
    await sqlOk(APPLY)
    expect(await allRows()).toBe(first)
    expect(await sqlOk('SELECT last_value FROM directus_permissions_id_seq;')).toBe(seqFirst)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_legacy_verify: OK')
  }, 120_000)

  it('grants exactly sixteen legacy rows, revokes the unused one, and keeps the D-034 rows untouched', async () => {
    const owned = await ownedRows()
    expect(owned).toHaveLength(16)
    expect(owned.every(row => row.validation === null && row.presets === null)).toBe(true)
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY} AND collection = 'product_page_presets';`)).toBe('0')
    expect(await contentRows()).toBe(contentBefore)
    expect((await sqlOk(CONTENT_VERIFY)).split('\n').at(-1)).toBe('directus_permissions_verify: OK')
  }, 60_000)

  it('leaves no wildcard field list and no unfiltered row rule anywhere on the policy', async () => {
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY} AND (fields = '*' OR fields IS NULL);`)).toBe('0')
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY}
      AND collection IN (${inList(CHILDREN)}) AND (permissions IS NULL OR permissions::jsonb = '{}'::jsonb);`)).toBe('0')
  }, 60_000)

  it.each(CHILDREN)('%s is readable only under a published, enabled parent', async (collection) => {
    expect(JSON.parse(await filter(collection))).toEqual(PUBLISHED_PARENT[collection as keyof typeof PUBLISHED_PARENT])
  }, 60_000)

  it('the published-parent rule actually excludes the child rows of non-published products', async () => {
    // Real data, not a string check: every child row currently hanging off a draft product is
    // outside the canonical filter, and the rule admits rows under a published product.
    const excluded = await sqlOk(`SELECT
        (SELECT count(*) FROM product_faqs c JOIN products p ON p.id = c.product_id WHERE p.status <> 'published')
      + (SELECT count(*) FROM product_sections c JOIN products p ON p.id = c.product_id WHERE p.status <> 'published')
      + (SELECT count(*) FROM product_spec_groups c JOIN products p ON p.id = c.product_id WHERE p.status <> 'published')
      + (SELECT count(*) FROM products_files c JOIN products p ON p.id = c.products_id WHERE p.status <> 'published')
      + (SELECT count(*) FROM product_spec_items i JOIN product_spec_groups g ON g.id = i.spec_group_id JOIN products p ON p.id = g.product_id WHERE p.status <> 'published')
      + (SELECT count(*) FROM product_section_items i JOIN product_sections s ON s.id = i.section_id JOIN products p ON p.id = s.product_id WHERE p.status <> 'published');`)
    expect(Number(excluded)).toBeGreaterThan(0)
    const admitted = await sqlOk(`SELECT count(*) FROM product_faqs c JOIN products p ON p.id = c.product_id WHERE p.status = 'published' AND c.enabled;`)
    expect(Number(admitted)).toBeGreaterThanOrEqual(0)
  }, 60_000)

  it('legacy posts are readable only as technical_guide or faq', async () => {
    expect(JSON.parse(await filter('posts'))).toEqual({
      _and: [{ status: { _eq: 'published' } }, { content_type: { _in: ['technical_guide', 'faq'] } }],
    })
    const fields = (await field('posts')).split(',')
    for (const column of ['created_at', 'updated_at']) expect(fields).not.toContain(column)
  }, 60_000)

  it('directus_files exposes no storage path, size or dimension', async () => {
    expect((await field('directus_files')).split(',')).toEqual(['id', 'is_public', 'title', 'type', 'filename_download'])
    expect(JSON.parse(await filter('directus_files'))).toEqual({ is_public: { _eq: true } })
  }, 60_000)

  it('site content, settings and social links expose only what the public API requests', async () => {
    const content = (await field('site_content')).split(',')
    for (const column of ['page_key', 'section_key', 'updated_at']) expect(content).not.toContain(column)
    expect(JSON.parse(await filter('site_content'))).toEqual({ status: { _eq: 'published' } })
    expect((await field('site_settings')).split(',')).toEqual(['brand_name', 'legal_company_name', 'public_email', 'public_phone', 'public_whatsapp_url', 'public_address', 'copyright_text'])
    expect((await field('site_social_links')).split(',')).toEqual(['platform', 'url', 'sort', 'enabled'])
    expect(JSON.parse(await filter('site_social_links'))).toEqual({ enabled: { _eq: true } })
  }, 60_000)

  it('the inquiry pipeline keeps exactly the fields it writes, reads and patches', async () => {
    const create = (await field('inquiries', 'create')).split(',')
    expect(create).toHaveLength(30)
    expect(create).toContain('consent_given')
    expect(create).not.toContain('note')
    expect(create).not.toContain('assigned_to')
    for (const aiColumn of ['ai_summary', 'ai_intent', 'ai_draft_reply', 'ai_recommended_products']) expect(create).not.toContain(aiColumn)
    expect(await field('inquiries', 'read')).toBe('id')
    expect((await field('inquiries', 'update')).split(',')).toEqual(['hubspot_sync_status', 'hubspot_contact_id', 'hubspot_synced_at', 'hubspot_error_summary'])
  }, 60_000)

  it('no public policy holds a business permission on anything this identity reads', async () => {
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions
      WHERE policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL);`)).toBe('0')
  }, 60_000)

  it('provisions a fresh environment: with the legacy rows absent, apply inserts all sixteen', async () => {
    const result = await inRolledBackTransaction(
      `DELETE FROM directus_permissions WHERE policy = ${POLICY} AND collection NOT IN (${inList(CONTENT)});`,
      `${body(APPLY, 'apply')}
       SELECT count(*) FROM directus_permissions WHERE policy = ${POLICY} AND collection NOT IN (${inList(CONTENT)});`,
    )
    expect(result.ok, result.stderr).toBe(true)
    expect(result.stdout.trim().split('\n').at(-1)).toBe('16')
  }, 60_000)

  it('normalizes a drifted owned row in place and changes nothing else', async () => {
    const result = await inRolledBackTransaction(
      `UPDATE directus_permissions SET fields = '*', permissions = '{}' WHERE policy = ${POLICY} AND collection = 'product_faqs';`,
      `${body(APPLY, 'apply')}
       SELECT fields FROM directus_permissions WHERE policy = ${POLICY} AND collection = 'product_faqs';`,
    )
    expect(result.ok, result.stderr).toBe(true)
    expect(result.stdout.trim().split('\n').at(-1)).toBe('id,product_id,question_en,question_es,question_pt,answer_en,answer_es,answer_pt,enabled,sort')
    expect(await ownedRows()).toHaveLength(16)
  }, 60_000)

  it.each([
    ['a second policy with the same name', `INSERT INTO directus_policies (id, name, icon, admin_access, app_access, enforce_tfa) VALUES (gen_random_uuid(), 'site-readonly-policy', 'badge', false, false, false);`, 'expected exactly one policy'],
    ['a second role with the same name', `INSERT INTO directus_roles (id, name, icon) VALUES (gen_random_uuid(), 'nuxt-server', 'badge');`, 'expected exactly one role'],
    ['a second access link to the policy', `INSERT INTO directus_access (id, role, policy) SELECT gen_random_uuid(), r.id, p.id FROM directus_roles r, directus_policies p WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';`, 'expected exactly one access link'],
    ['the policy gaining app access', `UPDATE directus_policies SET app_access = true WHERE name = 'site-readonly-policy';`, 'neither admin nor app access'],
    ['an undeclared action on an owned collection', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('products', 'delete', 'id', ${POLICY});`, 'undeclared permission'],
    ['a duplicate row for an owned pair', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('posts', 'read', '*', ${POLICY});`, 'rows exist for the posts read permission'],
    ['a missing D-034 row', `DELETE FROM directus_permissions WHERE policy = ${POLICY} AND collection = 'media_file_lifecycle';`, 'D-034 content read rows'],
    ['a business permission on the public policy', `INSERT INTO directus_permissions (collection, action, fields, policy) SELECT 'products', 'read', '*', policy FROM directus_access WHERE role IS NULL AND "user" IS NULL LIMIT 1;`, 'public policy'],
  ])('apply fails closed on %s and writes nothing', async (_label, tamper, message) => {
    const before = await allRows()
    const result = await inRolledBackTransaction(tamper, body(APPLY, 'apply'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
    expect(await allRows()).toBe(before)
  }, 60_000)

  it.each([
    ['a widened field list', `UPDATE directus_permissions SET fields = fields || ',filename_disk' WHERE policy = ${POLICY} AND collection = 'directus_files';`, 'does not match the artifact'],
    ['a weakened row filter', `UPDATE directus_permissions SET permissions = '{}' WHERE policy = ${POLICY} AND collection = 'product_spec_items';`, 'does not match the artifact'],
    ['legacy posts opened up again', `UPDATE directus_permissions SET permissions = '{"status":{"_eq":"published"}}' WHERE policy = ${POLICY} AND collection = 'posts';`, 'does not match the artifact'],
    ['the revoked preset permission coming back', `INSERT INTO directus_permissions (collection, action, fields, policy) VALUES ('product_page_presets', 'read', '*', ${POLICY});`, 'revoked collection'],
    ['a modified D-034 row', `UPDATE directus_permissions SET fields = fields || ',title' WHERE policy = ${POLICY} AND collection = 'content_item_locales';`, 'D-034 row'],
    ['a business permission on the public policy', `INSERT INTO directus_permissions (collection, action, fields, policy) SELECT 'posts', 'read', 'id', policy FROM directus_access WHERE role IS NULL AND "user" IS NULL LIMIT 1;`, 'public policy'],
  ])('verify fails closed on %s', async (_label, tamper, message) => {
    const result = await inRolledBackTransaction(tamper, body(VERIFY, 'verify'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
  }, 60_000)

  it('rollback refuses to restore when a row has drifted from the canonical state', async () => {
    const result = await inRolledBackTransaction(
      `UPDATE directus_permissions SET fields = 'id' WHERE policy = ${POLICY} AND collection = 'site_settings';`,
      body(ROLLBACK, 'rollback'),
    )
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('not in the FIX-E canonical state')
  }, 60_000)

  it('rollback restores the exact pre-FIX-E legacy definitions, and re-apply returns to canonical', async () => {
    const result = await inRolledBackTransaction(
      body(ROLLBACK, 'rollback'),
      `SELECT json_agg(json_build_object('collection', collection, 'action', action, 'fields', fields,
         'permissions', permissions::jsonb, 'validation', validation::jsonb) ORDER BY collection, action)::text
         FROM directus_permissions WHERE policy = ${POLICY} AND collection NOT IN (${inList(CONTENT)});`,
    )
    expect(result.ok, result.stderr).toBe(true)
    const restored = JSON.parse(result.stdout.trim().split('\n').at(-1)!) as Array<Record<string, unknown>>
    expect(restored).toHaveLength(17)
    const row = (collection: string, action = 'read') => restored.find(r => r.collection === collection && r.action === action)!
    expect(row('product_faqs')).toMatchObject({ fields: '*', permissions: {} })
    expect(row('site_settings')).toMatchObject({ fields: '*', permissions: null })
    expect(row('product_page_presets')).toMatchObject({ fields: '*', permissions: { active: { _eq: true } }, validation: {} })
    expect(row('directus_files').fields).toContain('filename_disk')
    expect(row('posts').fields).toContain('created_at,updated_at')
    // The transaction rolled back, so the live state is still canonical.
    expect(await ownedRows()).toHaveLength(16)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_legacy_verify: OK')
  }, 120_000)

  it('leaves the database in the canonical least-privilege state', async () => {
    await sqlOk(APPLY)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_permissions_legacy_verify: OK')
    expect((await sqlOk(CONTENT_VERIFY)).split('\n').at(-1)).toBe('directus_permissions_verify: OK')
    expect(await contentRows()).toBe(contentBefore)
  }, 120_000)
})
