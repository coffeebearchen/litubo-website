#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-01 / 01A — executes the canonical provisioning order.
 *
 * The order itself lives in scripts/provisioning-manifest.json, which is the
 * executable expression of RELEASE-SAFETY-GATES §3A.8. This file only runs it,
 * in order, stopping at the first failure. It exists because "apply the schema,
 * then the SQL artifacts, then the identity, then the permission artifacts, then
 * verify" had been prose in three documents and nothing in Git actually performed
 * it — so a new environment depended on someone remembering the sequence, and on
 * one role, one policy, one access link and one service user that had been made
 * by hand in a single database years into the project.
 *
 * Safety posture:
 *   - The target is explicit and has no default. Nothing runs until a caller
 *     names a database, and a name that looks like production is refused
 *     outright: this script has no production mode to opt into.
 *   - It fails fast. No step is skipped, no error is swallowed, nothing is
 *     auto-repaired. A non-zero exit means the environment is NOT provisioned.
 *   - Exactly one step consumes a secret, and it takes the value from the
 *     environment. The value is passed to the container on stdin, so it never
 *     appears in a command line or a process listing, and it is redacted from
 *     everything this script prints — including the stdout and stderr of a
 *     failing step. Nothing else here reads, accepts or prints a credential:
 *     Postgres and Directus are addressed through `docker compose`, which passes
 *     the values already configured for those services; they are expanded inside
 *     the containers and never enter this process.
 *
 * Usage:
 *   node scripts/provision-directus.mjs --database <name> [--allow-existing]
 *                                       [--without-service-token]
 *
 * Environment:
 *   DIRECTUS_TOKEN              the nuxt-server service user's static token: the one secret,
 *                               which the Nuxt server also reads, so it is supplied once.
 *                               Required unless --without-service-token is given.
 *   PROVISION_PG_SERVICE        compose service for Postgres   (default: postgres)
 *   PROVISION_DIRECTUS_SERVICE  compose service for Directus   (default: directus)
 *   PROVISION_COMPOSE_FILES     colon-separated compose files  (default: docker-compose.yml)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const MANIFEST = join(HERE, 'provisioning-manifest.json')

/** Names that must never be provisioned by this script, however they are spelled. */
const PRODUCTION_MARKERS = ['prod', 'production', 'live']

/** Secret values seen this run. Every byte written to a stream is filtered through these. */
const secrets = []

function redact(text) {
  let out = String(text ?? '')
  for (const { value, name } of secrets) {
    if (value) out = out.split(value).join(`«${name}»`)
  }
  return out
}

function say(text) {
  process.stdout.write(redact(text))
}

function fail(message) {
  process.stderr.write(redact(`\nPROVISION FAILED: ${message}\n`))
  process.exit(1)
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find(a => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : null
}

const database = arg('database')
const allowExisting = process.argv.includes('--allow-existing')

if (!database) {
  fail('no target. Pass --database <name>. There is no default: a provisioning run must name the database it is about to change.')
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
  fail(`database name ${JSON.stringify(database)} is not a plain PostgreSQL identifier. Refusing to interpolate it.`)
}
const lowered = database.toLowerCase()
for (const marker of PRODUCTION_MARKERS) {
  if (lowered.includes(marker)) {
    fail(`database name "${database}" contains "${marker}". This script provisions local and scratch environments only; production provisioning is a separate, authorized activity.`)
  }
}

const composeFiles = (process.env.PROVISION_COMPOSE_FILES ?? 'docker-compose.yml').split(':').filter(Boolean)
const pgService = process.env.PROVISION_PG_SERVICE ?? 'postgres'
const directusService = process.env.PROVISION_DIRECTUS_SERVICE ?? 'directus'
const composeArgs = composeFiles.flatMap(f => ['-f', f])

function compose(args, { input, label }) {
  try {
    return execFileSync('docker', ['compose', ...composeArgs, ...args], {
      cwd: ROOT,
      input,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stdout = (error.stdout ?? '').trim()
    const stderr = (error.stderr ?? '').trim()
    fail(`${label} did not succeed.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`)
  }
}

/**
 * Runs SQL in the Postgres container. The SQL text arrives on stdin, so no file
 * needs to be mounted and no argument can leak. `$POSTGRES_USER` is expanded by
 * the container's own shell — the value is never visible here.
 */
function psql(sql, label) {
  return compose(
    ['exec', '-T', pgService, 'sh', '-c',
      `psql -U "$POSTGRES_USER" -d ${database} -X -At -v ON_ERROR_STOP=1`],
    { input: sql, label },
  )
}

/**
 * Same, for SQL that needs one secret. The value is the first line on stdin: the
 * container's shell reads it into an environment variable and the SQL picks it up
 * with psql's \getenv. It is therefore never an argument to docker, to sh or to
 * psql, so it cannot appear in a host or container process listing, and `redact`
 * keeps it out of anything this script prints.
 */
function psqlWithSecret(sql, label, secretName, secretValue) {
  return compose(
    ['exec', '-T', pgService, 'sh', '-c',
      `IFS= read -r ${secretName}; export ${secretName}; psql -U "$POSTGRES_USER" -d ${database} -X -At -v ON_ERROR_STOP=1 -f -`],
    { input: `${secretValue}\n${sql}`, label },
  )
}

function psqlMaintenance(sql, label) {
  return compose(
    ['exec', '-T', pgService, 'sh', '-c',
      'psql -U "$POSTGRES_USER" -d postgres -X -At -v ON_ERROR_STOP=1'],
    { input: sql, label },
  )
}

/**
 * Runs the Directus CLI against the target database in a disposable container.
 * `-e DB_DATABASE` is the only override; every other value — secret, admin
 * credentials, storage paths — comes from the compose service definition as
 * already configured, and is never read by this process.
 *
 * The CLI is started as `node cli.js` from the image's working directory
 * (/directus), the same entry the image's own docker-entrypoint.cjs uses. The
 * Directus 12.1+ image no longer ships npm or npx, so `npx directus` fails there
 * (FINAL-RELEASE-SECURITY-REMEDIATION-01).
 */
function directusCli(args, label) {
  return compose(
    ['run', '--rm', '--no-deps', '-e', `DB_DATABASE=${database}`, directusService, 'node', 'cli.js', ...args],
    { label },
  )
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const steps = manifest.steps ?? []
if (steps.length === 0) fail('the manifest declares no steps.')

// Resolve every secret the manifest asks for before touching the database, so a
// missing one fails before the run starts rather than half way through it.
const skipped = []
for (const step of steps) {
  if (step.kind !== 'psql-secret') continue
  const name = step.secretEnv
  if (!name) fail(`${step.id} is a secret step but names no secretEnv.`)
  const value = process.env[name] ?? ''
  if (value === '') {
    if (step.skipFlag && process.argv.includes(step.skipFlag)) {
      skipped.push(step)
      continue
    }
    fail(
      `${step.id} needs the environment variable ${name}, which is not set.\n`
      + '  It is the nuxt-server static token, and the Nuxt server reads this same variable:\n'
      + '  one secret, one name, supplied once.\n'
      + '  Set it from your secret manager and run again. This script never stores, prints or\n'
      + '  generates the value.\n'
      + (step.skipFlag
        ? `  To build the structure WITHOUT runtime authentication — an environment that cannot\n    serve — pass ${step.skipFlag} deliberately.`
        : ''),
    )
  }
  if (/[\r\n]/.test(value)) {
    fail(`${name} contains a line break, which cannot be passed safely. Refusing to continue (the value is not shown).`)
  }
  secrets.push({ name, value })
}

say(`\nProvisioning "${database}"\n`)
say(`  contract         ${manifest.contract}\n`)
say(`  Directus         ${manifest.runtime?.directusVersion}\n`)
say(`  steps            ${steps.length}${skipped.length > 0 ? ` (${skipped.length} deliberately skipped)` : ''}\n\n`)

// A fresh provision expects an empty database. Refusing a populated one by
// default is what keeps a mistyped name from running artifacts over real data.
const existingTables = psqlMaintenance(
  `SELECT count(*) FROM pg_database WHERE datname = '${database}';`,
  'database existence check',
).trim()
if (existingTables !== '1') fail(`database "${database}" does not exist. Create it first; this script does not create databases.`)

const tableCount = Number(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';", 'table count').trim())
if (Number.isNaN(tableCount)) fail('could not count existing tables.')
if (tableCount > 0 && !allowExisting) {
  fail(`database "${database}" already has ${tableCount} table(s) in public. Provisioning is designed for an empty database. Re-run with --allow-existing only to re-apply the (idempotent) artifacts over a previously provisioned environment.`)
}
say(`  existing tables  ${tableCount}${tableCount > 0 ? ' (re-apply mode)' : ''}\n\n`)

function expect(step, out) {
  if (!out.includes(step.expect)) {
    fail(`${step.id} did not report ${JSON.stringify(step.expect)}.\n--- output ---\n${out.trim()}`)
  }
  say(`   ${step.expect}\n`)
}

for (const step of steps) {
  if (skipped.includes(step)) {
    say(`→ ${step.id}\n   SKIPPED — ${step.secretEnv} was not supplied and ${step.skipFlag} was passed.\n`)
    continue
  }
  say(`→ ${step.id}\n`)
  if (step.kind === 'directus-cli') {
    directusCli(step.args, step.id)
  } else if (step.kind === 'psql') {
    psql(readFileSync(join(ROOT, step.file), 'utf8'), step.id)
  } else if (step.kind === 'psql-expect') {
    const sql = step.inline ?? readFileSync(join(ROOT, step.file), 'utf8')
    expect(step, psql(sql, step.id))
  } else if (step.kind === 'psql-secret') {
    const out = psqlWithSecret(
      readFileSync(join(ROOT, step.file), 'utf8'),
      step.id,
      step.secretEnv,
      process.env[step.secretEnv],
    )
    if (step.expect) expect(step, out)
  } else {
    fail(`unknown step kind ${JSON.stringify(step.kind)} in ${step.id}.`)
  }
}

const ran = steps.length - skipped.length
say(`\nProvisioned "${database}" — ${ran} of ${steps.length} steps, every verification passed.\n`)
if (skipped.length > 0) {
  say('\n  WARNING — this environment has no runtime credential and cannot serve.\n')
  for (const step of skipped) {
    say(`  · ${step.id} was skipped; ${step.secretEnv} was not supplied.\n`)
  }
  say('  Set the variable and re-run with --allow-existing before treating it as provisioned.\n')
}
for (const note of manifest.postSteps ?? []) say(`  · ${note}\n`)
say('\n')
