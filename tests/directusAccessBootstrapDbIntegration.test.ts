/**
 * DIRECTUS-ACCESS-BOOTSTRAP-01 / 02 — the tracked Directus identity artifacts against the real
 * local PostgreSQL (directus/schema/directus-access-0*.sql).
 *
 * Runs only against a local development database, and only when the Postgres container is named
 * explicitly:
 *
 *   CONTENT_DB_TEST_CONTAINER=litubo-cms-postgres-1 npx vitest run tests/directusAccessBootstrapDbIntegration.test.ts
 *
 * psql runs inside the container with the container's own environment; no credential is read or
 * printed. The real service token is never selected, asserted or logged — only whether the column
 * is null. Every destructive or tampering case runs inside a transaction that is rolled back, so a
 * "fresh database" can be simulated on the development database (delete the identity, apply the
 * artifact, assert it rebuilt everything) without the development database ever changing. The only
 * statement that commits is the artifact applied to an environment that already matches it, which
 * is a no-op by construction and is asserted to be one, id by id.
 *
 * FINAL-RELEASE-PRODUCTION-READY-01B adds the single-secret contract: the service token has one
 * name, DIRECTUS_TOKEN, read both by provisioning and by the Nuxt server. Those checks read files
 * and run the orchestrator only as far as its secret check, so they need no database and run
 * everywhere, CI included. Every token used anywhere in this file is generated at random per run.
 *
 * FINAL-RELEASE-PRODUCTION-READY-01C pins where the server reads it: from its own process
 * environment at call time, never from `runtimeConfig`, which `nuxt build` serializes into the
 * build artifact. The behaviour itself is covered in tests/directusRuntimeToken.test.ts.
 */

import { execFile, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const CONTAINER = process.env.CONTENT_DB_TEST_CONTAINER ?? ''
const DIR = resolve(process.cwd(), 'directus/schema')
const APPLY = readFileSync(resolve(DIR, 'directus-access-01-nuxt-server-site-readonly.sql'), 'utf8')
const VERIFY = readFileSync(resolve(DIR, 'directus-access-01-nuxt-server-site-readonly.verify.sql'), 'utf8')
const ROLLBACK = readFileSync(resolve(DIR, 'directus-access-01-nuxt-server-site-readonly.rollback.sql'), 'utf8')
const TOKEN = readFileSync(resolve(DIR, 'directus-access-02-service-token.sql'), 'utf8')

const ROLE = 'nuxt-server'
const POLICY = 'site-readonly-policy'
/** A random TEST secret, fresh every run and long enough for the artifact's minimum. Never a real credential. */
const SYNTHETIC_TOKEN = `test-${randomBytes(24).toString('hex')}`
const ORCHESTRATOR = 'scripts/provision-directus.mjs'

function body(sql: string, name: 'apply' | 'verify' | 'rollback' | 'token'): string {
  const start = sql.indexOf(`-- ${name}:begin`)
  const end = sql.indexOf(`-- ${name}:end`)
  if (start < 0 || end < 0) throw new Error(`markers for ${name} missing`)
  return sql.slice(start, end)
}

/** The token body reads a psql variable that only the file's own \getenv preamble sets. */
const tokenBodyWith = (value: string) => `\\set service_token '${value}'\n${body(TOKEN, 'token')}`

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

/** Runs `setup` then `script` in one transaction that is never committed. */
async function inRolledBackTransaction(setup: string, script: string): Promise<PsqlResult> {
  return psql(`BEGIN;\n${setup}\n${script}\nROLLBACK;\n`)
}

/** Runs the provisioning orchestrator the way an operator would, with the given DIRECTUS_TOKEN. */
function runOrchestrator(database: string, token: string) {
  return spawnSync(process.execPath, [ORCHESTRATOR, '--database', database], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, DIRECTUS_TOKEN: token },
  })
}

/**
 * Removes the whole identity, in dependency order, so the artifact meets an empty database.
 * Only ever used inside a rolled-back transaction.
 */
const EMPTY_DATABASE = `
DELETE FROM directus_permissions WHERE policy IN (SELECT id FROM directus_policies WHERE name = '${POLICY}');
DELETE FROM directus_access WHERE policy IN (SELECT id FROM directus_policies WHERE name = '${POLICY}');
DELETE FROM directus_users WHERE role IN (SELECT id FROM directus_roles WHERE name = '${ROLE}');
DELETE FROM directus_policies WHERE name = '${POLICY}';
DELETE FROM directus_roles WHERE name = '${ROLE}';
`

/** The four owned objects, canonically, without ids — ids differ between environments by design. */
const IDENTITY_SHAPE = `SELECT json_build_object(
  'roles', (SELECT coalesce(json_agg(json_build_object('name', name, 'icon', icon, 'description', description, 'parent', parent) ORDER BY name), '[]'::json)
              FROM directus_roles WHERE name = '${ROLE}'),
  'policies', (SELECT coalesce(json_agg(json_build_object('name', name, 'icon', icon, 'description', description,
                 'ip_access', ip_access, 'enforce_tfa', enforce_tfa, 'admin_access', admin_access, 'app_access', app_access) ORDER BY name), '[]'::json)
              FROM directus_policies WHERE name = '${POLICY}'),
  'access', (SELECT coalesce(json_agg(json_build_object('role', r.name, 'policy', p.name, 'user_is_null', a."user" IS NULL, 'sort', a.sort) ORDER BY r.name), '[]'::json)
              FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
             WHERE r.name = '${ROLE}' AND p.name = '${POLICY}'),
  'service_users', (SELECT coalesce(json_agg(json_build_object('first_name', u.first_name, 'status', u.status, 'provider', u.provider,
                      'password_is_null', u.password IS NULL, 'email_is_null', u.email IS NULL) ORDER BY u.first_name), '[]'::json)
              FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}')
)::text;`

/** Every identity row of the whole database, ids included — proves nothing unrelated moved. */
const IDENTITY_SNAPSHOT = `SELECT json_build_object(
  'roles', (SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'icon', icon, 'description', description, 'parent', parent) ORDER BY id), '[]'::json) FROM directus_roles),
  'policies', (SELECT coalesce(json_agg(json_build_object('id', id, 'name', name, 'icon', icon, 'description', description,
                 'ip_access', ip_access, 'enforce_tfa', enforce_tfa, 'admin_access', admin_access, 'app_access', app_access) ORDER BY id), '[]'::json) FROM directus_policies),
  'access', (SELECT coalesce(json_agg(json_build_object('id', id, 'role', role, 'user', "user", 'policy', policy, 'sort', sort) ORDER BY id), '[]'::json) FROM directus_access),
  'users', (SELECT coalesce(json_agg(json_build_object('id', id, 'first_name', first_name, 'status', status, 'role', role, 'provider', provider,
                 'token_is_null', token IS NULL, 'password_is_null', password IS NULL) ORDER BY id), '[]'::json) FROM directus_users)
)::text;`

/** Every permission row of every policy, ids included — D-034 and FIX-E ownership. */
const PERMISSION_SNAPSHOT = `SELECT coalesce(json_agg(json_build_object('id', id, 'policy', policy, 'collection', collection, 'action', action,
  'fields', fields, 'permissions', permissions::jsonb, 'validation', validation::jsonb, 'presets', presets::jsonb) ORDER BY id)::text, '[]')
  FROM directus_permissions;`

describe('Directus service token contract — one secret, one name', () => {
  const RUNTIME_NAME = 'DIRECTUS_TOKEN'
  // Assembled from parts so that this file never carries the retired name as a literal of its own.
  const RETIRED_NAME = ['DIRECTUS', 'SERVICE', 'TOKEN'].join('_')
  const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  /** Every TypeScript source under server/, as repo-relative forward-slash paths. */
  const serverSources = (dir = resolve(process.cwd(), 'server')): Array<{ path: string, text: string }> =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) return serverSources(full)
      if (!entry.name.endsWith('.ts')) return []
      return [{ path: relative(process.cwd(), full).split(sep).join('/'), text: readFileSync(full, 'utf8') }]
    })

  it('the running Nuxt server reads DIRECTUS_TOKEN from its process environment, in exactly one place', () => {
    // FINAL-RELEASE-PRODUCTION-READY-01C — read at call time, never through runtimeConfig.
    const readers = serverSources().filter(({ text }) => /process\.env\.DIRECTUS_TOKEN\b/.test(text)).map(({ path }) => path)
    expect(readers).toEqual(['server/utils/directusServiceToken.ts'])
    for (const consumer of ['server/utils/directus.ts', 'server/utils/aiSourceRef.ts', 'server/api/cms/media/[id].get.ts']) {
      expect(repoFile(consumer), consumer).toContain('readDirectusToken()')
    }
  })

  it('the build configuration does not declare the token, so no build can serialize it', () => {
    // `nuxt build` evaluates runtimeConfig and writes it into .output (measured in 01B, removed in 01C).
    const config = repoFile('nuxt.config.ts')
    expect(config).not.toMatch(/process\.env\.DIRECTUS_TOKEN\b/)
    expect(config).not.toMatch(/\bdirectusToken\b/)
    // Nor does any server code still look for it in runtimeConfig.
    expect(serverSources().filter(({ text }) => /\bdirectusToken\b/.test(text)).map(({ path }) => path)).toEqual([])
  })

  it('the framework override name is not a second way to supply the secret', () => {
    // Assembled from parts, like RETIRED_NAME, so this file carries no literal of it.
    const OVERRIDE_NAME = ['NUXT', 'DIRECTUS', 'TOKEN'].join('_')
    for (const { path, text } of serverSources()) expect(text, path).not.toContain(OVERRIDE_NAME)
    for (const path of ['nuxt.config.ts', 'scripts/provision-directus.mjs', 'scripts/provisioning-manifest.json', '.env.example']) {
      expect(repoFile(path), path).not.toContain(OVERRIDE_NAME)
    }
  })

  it('provisioning installs the token from that same variable, and declares no other secret', () => {
    const manifest = JSON.parse(repoFile('scripts/provisioning-manifest.json')) as { steps: Array<{ kind: string, secretEnv?: string }> }
    expect(manifest.steps.filter(step => step.kind === 'psql-secret').map(step => step.secretEnv)).toEqual([RUNTIME_NAME])
    expect(manifest.steps.filter(step => step.kind !== 'psql-secret' && step.secretEnv !== undefined)).toEqual([])
    expect(TOKEN).toMatch(/^\\getenv service_token DIRECTUS_TOKEN$/m)
  })

  it('no current provisioning artifact, runbook or env template names a second secret variable', () => {
    for (const path of [
      'scripts/provisioning-manifest.json',
      'scripts/provision-directus.mjs',
      'directus/schema/directus-access-01-nuxt-server-site-readonly.sql',
      'directus/schema/directus-access-01-nuxt-server-site-readonly.verify.sql',
      'directus/schema/directus-access-01-nuxt-server-site-readonly.rollback.sql',
      'directus/schema/directus-access-02-service-token.sql',
      'docs/project/PRODUCTION-PROVISIONING-RUNBOOK.md',
      '.env.example',
    ]) {
      expect(repoFile(path), path).not.toContain(RETIRED_NAME)
    }
    // The template declares the secret exactly once.
    expect(repoFile('.env.example').match(/^DIRECTUS_TOKEN=/gm)).toHaveLength(1)
  })

  it('the secret step holds a reference to the variable and never a value', () => {
    const code = TOKEN.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n')
    expect(code).toContain(":'service_token'")
    // No quoted literal long enough to be a credential.
    expect(code).not.toMatch(/'[A-Za-z0-9_-]{32,}'/)
  })

  it('provisioning refuses to start without DIRECTUS_TOKEN, before it touches any database', () => {
    const run = runOrchestrator('litubo_provisioning_test_contract', '')
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('needs the environment variable DIRECTUS_TOKEN')
    // It stopped at the secret check: the provisioning header was never printed.
    expect(run.stdout).not.toContain('Provisioning "')
  })
})

describe.skipIf(!CONTAINER)('Directus access bootstrap artifacts — real PostgreSQL', () => {
  let identityBefore = ''
  let permissionsBefore = ''

  beforeAll(async () => {
    identityBefore = await sqlOk(IDENTITY_SNAPSHOT)
    permissionsBefore = await sqlOk(PERMISSION_SNAPSHOT)
  }, 60_000)

  it('the structural artifacts carry their markers and contain no credential material', () => {
    for (const sql of [APPLY, VERIFY, ROLLBACK]) {
      const code = sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n')
      // The structure artifacts must never read or write a secret column.
      expect(code).not.toMatch(/\btoken\s*=/i)
      expect(code).not.toMatch(/SET\s+password/i)
      expect(code).not.toMatch(/tfa_secret|auth_data/i)
      // Nor may they carry an identifier copied from the current development database.
      expect(code).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    }
    // The structural artifact must never write a permission row: that is D-034 / FIX-E territory.
    const applyCode = body(APPLY, 'apply')
    expect(applyCode).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM)\s+directus_permissions/i)
    // And the secret artifact must never contain a literal token.
    const tokenCode = body(TOKEN, 'token')
    expect(tokenCode).toContain(":'service_token'")
    expect(TOKEN).toContain('\\getenv service_token DIRECTUS_TOKEN')
    expect(tokenCode).not.toMatch(/(INSERT INTO|DELETE FROM)\s+directus_users/i)
  })

  it('builds the role, the policy, the access link and the service user on an empty database', async () => {
    const result = await inRolledBackTransaction(
      EMPTY_DATABASE,
      `${body(APPLY, 'apply')}\n${IDENTITY_SHAPE}`,
    )
    expect(result.ok, result.stderr).toBe(true)
    const shape = JSON.parse(result.stdout.trim().split('\n').at(-1)!) as Record<string, unknown[]>

    expect(shape.roles).toEqual([{
      name: ROLE,
      icon: 'supervised_user_circle',
      description: 'Nuxt frontend read-only access — published content and public files only',
      parent: null,
    }])
    expect(shape.policies).toEqual([{
      name: POLICY,
      icon: 'badge',
      description: 'Read-only access for Nuxt frontend',
      ip_access: null,
      enforce_tfa: false,
      admin_access: false,
      app_access: false,
    }])
    expect(shape.access).toEqual([{ role: ROLE, policy: POLICY, user_is_null: true, sort: null }])
    expect(shape.service_users).toEqual([{
      first_name: ROLE,
      status: 'active',
      provider: 'default',
      password_is_null: true,
      email_is_null: true,
    }])
  }, 120_000)

  it('the rebuilt identity then satisfies its own verification and carries no token', async () => {
    const result = await inRolledBackTransaction(
      EMPTY_DATABASE,
      `${body(APPLY, 'apply')}\n${body(VERIFY, 'verify')}\n`
      + `SELECT 'token_is_null=' || (SELECT (token IS NULL)::text FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}');`,
    )
    expect(result.ok, result.stderr).toBe(true)
    // The structural artifact leaves the credential to the separate secret step.
    expect(result.stdout.trim().split('\n').at(-1)).toBe('token_is_null=true')
  }, 120_000)

  it('apply twice is idempotent: every identity row of the database, ids included, is identical', async () => {
    await sqlOk(APPLY)
    const first = await sqlOk(IDENTITY_SNAPSHOT)
    await sqlOk(APPLY)
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(first)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_access_verify: OK')
    // Applying it to an environment that already matches must change nothing at all.
    expect(first).toBe(identityBefore)
  }, 120_000)

  it('creates no duplicate when it meets an environment it has already built', async () => {
    const result = await inRolledBackTransaction(
      EMPTY_DATABASE,
      `${body(APPLY, 'apply')}\n${body(APPLY, 'apply')}\n${body(APPLY, 'apply')}\n`
      + `SELECT (SELECT count(*) FROM directus_roles WHERE name = '${ROLE}')::text || '|'
            || (SELECT count(*) FROM directus_policies WHERE name = '${POLICY}')::text || '|'
            || (SELECT count(*) FROM directus_access a JOIN directus_roles r ON r.id = a.role WHERE r.name = '${ROLE}')::text || '|'
            || (SELECT count(*) FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}')::text;`,
    )
    expect(result.ok, result.stderr).toBe(true)
    expect(result.stdout.trim().split('\n').at(-1)).toBe('1|1|1|1')
  }, 120_000)

  it.each([
    ['a duplicate role name', `INSERT INTO directus_roles (id, name, icon) VALUES (gen_random_uuid(), '${ROLE}', 'badge');`, `2 roles are named ${ROLE}`],
    ['a duplicate policy name', `INSERT INTO directus_policies (id, name, icon, admin_access, app_access, enforce_tfa) VALUES (gen_random_uuid(), '${POLICY}', 'badge', false, false, false);`, `2 policies are named ${POLICY}`],
    ['an ambiguous access link', `INSERT INTO directus_access (id, role, policy) SELECT gen_random_uuid(), r.id, p.id FROM directus_roles r, directus_policies p WHERE r.name = '${ROLE}' AND p.name = '${POLICY}';`, 'access rows already link'],
    ['the role carrying a second policy', `INSERT INTO directus_access (id, role, policy) SELECT gen_random_uuid(), r.id, p.id FROM directus_roles r, directus_policies p WHERE r.name = '${ROLE}' AND p.name = 'Administrator';`, 'carries a policy other than'],
    ['the policy gaining admin access', `UPDATE directus_policies SET admin_access = true WHERE name = '${POLICY}';`, 'already has admin or app access'],
    ['the policy enforcing TFA', `UPDATE directus_policies SET enforce_tfa = true WHERE name = '${POLICY}';`, 'enforces TFA'],
    ['the role gaining a parent', `UPDATE directus_roles SET parent = (SELECT id FROM directus_roles WHERE name = 'Administrator') WHERE name = '${ROLE}';`, 'has a parent role'],
    ['a second user in the role', `INSERT INTO directus_users (id, first_name, role) SELECT gen_random_uuid(), 'intruder', id FROM directus_roles WHERE name = '${ROLE}';`, `users hold the role ${ROLE}`],
    ['the service user gaining a password', `UPDATE directus_users SET password = 'x' WHERE role = (SELECT id FROM directus_roles WHERE name = '${ROLE}');`, 'has a password'],
    ['the policy attached to the public access row', `INSERT INTO directus_access (id, role, "user", policy) SELECT gen_random_uuid(), NULL, NULL, id FROM directus_policies WHERE name = '${POLICY}';`, 'reachable from an identity other than'],
  ])('apply fails closed on %s and writes nothing', async (_label, tamper, message) => {
    const before = await sqlOk(IDENTITY_SNAPSHOT)
    const result = await inRolledBackTransaction(tamper, body(APPLY, 'apply'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(before)
  }, 60_000)

  it.each([
    ['a tampered policy (app access)', `UPDATE directus_policies SET app_access = true WHERE name = '${POLICY}';`, 'not least privilege'],
    ['a tampered policy (ip restriction)', `UPDATE directus_policies SET ip_access = '10.0.0.0/8' WHERE name = '${POLICY}';`, 'not least privilege'],
    ['a tampered access row (user attached)', `UPDATE directus_access SET "user" = (SELECT u.id FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}') WHERE role = (SELECT id FROM directus_roles WHERE name = '${ROLE}');`, 'also names a user'],
    ['a deleted access row', `DELETE FROM directus_access WHERE role = (SELECT id FROM directus_roles WHERE name = '${ROLE}');`, 'expected exactly one access row'],
    ['the service user suspended', `UPDATE directus_users SET status = 'suspended' WHERE role = (SELECT id FROM directus_roles WHERE name = '${ROLE}');`, 'not active'],
    ['the service user given its own policy', `INSERT INTO directus_access (id, role, "user", policy) SELECT gen_random_uuid(), NULL, u.id, p.id FROM directus_users u JOIN directus_roles r ON r.id = u.role, directus_policies p WHERE r.name = '${ROLE}' AND p.name = 'Administrator';`, 'carries a policy of its own'],
  ])('verify fails on %s (transaction rolled back)', async (_label, tamper, message) => {
    const result = await inRolledBackTransaction(tamper, body(VERIFY, 'verify'))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_access_verify: OK')
  }, 60_000)

  it('leaves the Administrator identity and the public policy exactly as they were', async () => {
    await sqlOk(APPLY)
    const admin = await sqlOk(`SELECT json_build_object(
      'role', (SELECT json_build_object('id', id, 'name', name) FROM directus_roles WHERE name = 'Administrator'),
      'policy', (SELECT json_build_object('id', id, 'admin_access', admin_access, 'app_access', app_access) FROM directus_policies WHERE name = 'Administrator'),
      'public_access_rows', (SELECT count(*) FROM directus_access WHERE role IS NULL AND "user" IS NULL),
      'public_policy_is_readonly_policy', (SELECT count(*) FROM directus_access a JOIN directus_policies p ON p.id = a.policy
                                            WHERE a.role IS NULL AND a."user" IS NULL AND p.name = '${POLICY}')
    )::text;`)
    const parsed = JSON.parse(admin) as Record<string, unknown>
    expect((parsed.policy as Record<string, unknown>).admin_access).toBe(true)
    expect(parsed.public_access_rows).toBe(1)
    expect(parsed.public_policy_is_readonly_policy).toBe(0)
    // The whole identity table, ids included, is still what it was before this file ran.
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(identityBefore)
  }, 60_000)

  it('never touches a permission row: D-034 and FINAL-RELEASE-FIX-E ownership is intact', async () => {
    await sqlOk(APPLY)
    expect(await sqlOk(PERMISSION_SNAPSHOT)).toBe(permissionsBefore)
    expect(await sqlOk(`SELECT count(*) FROM directus_permissions pm JOIN directus_policies p ON p.id = pm.policy WHERE p.name = '${POLICY}';`)).toBe('19')
  }, 60_000)

  it('rollback refuses while permission rows still exist on the policy', async () => {
    // The real safety property: directus_permissions.policy is ON DELETE CASCADE, so a rollback
    // that did not refuse would silently delete rows two other artifacts own.
    const result = await psql(`BEGIN;\n${body(ROLLBACK, 'rollback')}\nROLLBACK;\n`)
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('would cascade and silently destroy rows owned by')
    expect(await sqlOk(PERMISSION_SNAPSHOT)).toBe(permissionsBefore)
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(identityBefore)
  }, 60_000)

  it('rollback removes exactly the four owned objects once the permissions are gone', async () => {
    const result = await inRolledBackTransaction(
      `DELETE FROM directus_permissions WHERE policy IN (SELECT id FROM directus_policies WHERE name = '${POLICY}');`,
      `${body(ROLLBACK, 'rollback')}\n`
      + `SELECT (SELECT count(*) FROM directus_roles WHERE name = '${ROLE}')::text || '|'
            || (SELECT count(*) FROM directus_policies WHERE name = '${POLICY}')::text || '|'
            || (SELECT count(*) FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}')::text || '|'
            || (SELECT count(*) FROM directus_roles WHERE name = 'Administrator')::text;`,
    )
    expect(result.ok, result.stderr).toBe(true)
    expect(result.stdout.trim().split('\n').at(-1)).toBe('0|0|0|1')
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(identityBefore)
  }, 60_000)

  it('the token artifact installs the supplied token on the service user, idempotently, without echoing it', async () => {
    const result = await inRolledBackTransaction(
      EMPTY_DATABASE + body(APPLY, 'apply'),
      `${tokenBodyWith(SYNTHETIC_TOKEN)}\n${tokenBodyWith(SYNTHETIC_TOKEN)}\n`
      + `SELECT (SELECT count(*) FROM directus_users WHERE token = '${SYNTHETIC_TOKEN}')::text || '|'
            || (SELECT count(*) FROM directus_users u JOIN directus_roles r ON r.id = u.role WHERE r.name = '${ROLE}' AND u.token = '${SYNTHETIC_TOKEN}')::text;`,
    )
    expect(result.ok, result.stderr).toBe(true)
    // Exactly one row holds it, and that row is the nuxt-server service user.
    expect(result.stdout.trim().split('\n').at(-1)).toBe('1|1')
    // psql reported only whether a value arrived, never the value itself.
    expect(`${result.stdout}${result.stderr}`).not.toContain(SYNTHETIC_TOKEN)
  }, 120_000)

  it.each([
    ['no value at all', '', 'absent, empty or shorter than 32 characters'],
    ['a short value', 'too-short', 'absent, empty or shorter than 32 characters'],
  ])('the token artifact fails closed on %s', async (_label, value, message) => {
    const result = await inRolledBackTransaction(EMPTY_DATABASE + body(APPLY, 'apply'), tokenBodyWith(value))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(message)
  }, 120_000)

  it('a refused token is never echoed back, even in the error', async () => {
    const refused = `short-${randomBytes(6).toString('hex')}`
    const result = await inRolledBackTransaction(EMPTY_DATABASE + body(APPLY, 'apply'), tokenBodyWith(refused))
    expect(result.ok).toBe(false)
    expect(`${result.stdout}${result.stderr}`).not.toContain(refused)
  }, 120_000)

  it('the token artifact refuses a value another user already holds, without echoing it', async () => {
    const result = await inRolledBackTransaction(
      `${EMPTY_DATABASE}${body(APPLY, 'apply')}
       UPDATE directus_users SET token = '${SYNTHETIC_TOKEN}' WHERE role = (SELECT id FROM directus_roles WHERE name = 'Administrator');`,
      tokenBodyWith(SYNTHETIC_TOKEN),
    )
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain('already held by a different user')
    // A unique-constraint violation would print the key in its DETAIL; the artifact refuses first.
    expect(`${result.stdout}${result.stderr}`).not.toContain(SYNTHETIC_TOKEN)
  }, 120_000)

  it('the token artifact refuses to run before the identity structure exists', async () => {
    const result = await inRolledBackTransaction(EMPTY_DATABASE, tokenBodyWith(SYNTHETIC_TOKEN))
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain(`expected exactly one role ${ROLE}`)
  }, 60_000)

  it('the orchestrator redacts DIRECTUS_TOKEN from everything it prints, including a failure', () => {
    // The secret is deliberately made part of the database name, which the orchestrator prints in
    // its header and again in the error when that database does not exist. That forces the value
    // into printed text, so the test proves masking happened rather than that the value simply
    // never came up. The run stops at the existence check; nothing is created.
    const secret = randomBytes(24).toString('hex')
    const run = runOrchestrator(`litubo_provisioning_test_${secret}`, secret)
    const printed = `${run.stdout}${run.stderr}`
    expect(run.status).toBe(1)
    expect(printed).toContain('does not exist')
    expect(printed).toContain('«DIRECTUS_TOKEN»')
    expect(printed).not.toContain(secret)
  }, 60_000)

  it('the development database is byte-identical to how this file found it', async () => {
    expect(await sqlOk(IDENTITY_SNAPSHOT)).toBe(identityBefore)
    expect(await sqlOk(PERMISSION_SNAPSHOT)).toBe(permissionsBefore)
    expect((await sqlOk(VERIFY)).split('\n').at(-1)).toBe('directus_access_verify: OK')
  }, 60_000)
})
