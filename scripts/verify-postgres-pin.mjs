#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-03 — proves the running PostgreSQL is the pinned one.
 *
 * `postgres:16-alpine` is a floating tag: the official image is rebuilt for every PostgreSQL minor
 * release and for base-image updates, so a redeploy could move the database server to a different
 * minor version or build than the one backups, provisioning and the capacity baseline were measured
 * against, and nothing would say so. docker-compose.yml therefore pins an exact version and the
 * immutable multi-architecture index digest. This check confirms, without anyone reading a compose
 * file by eye, that four things still agree:
 *
 *   1. the compose declaration (exact major.minor version + digest, no floating tag),
 *   2. the image the running container was actually started from,
 *   3. a repository digest of that image,
 *   4. the server_version the running PostgreSQL reports about itself.
 *
 * It reads image identity and the server version only. The version query runs inside the container
 * as psql -U "$POSTGRES_USER", expanded by the container's own shell, so no environment variable,
 * password or connection string is read, passed or printed here.
 *
 * Usage:
 *   node scripts/verify-postgres-pin.mjs [--container litubo-cms-postgres-1]
 *   node scripts/verify-postgres-pin.mjs --declaration-only   (no Docker needed)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** `postgres:<major.minor>-alpine[<alpine major.minor>]@sha256:<64 hex>` — nothing floating. */
export const POSTGRES_PIN_PATTERN = /^postgres:(\d+\.\d+)-alpine(?:\d+\.\d+)?@(sha256:[0-9a-f]{64})$/

export const SERVER_VERSION_COMMAND = 'psql -X -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SHOW server_version"'

/** Every `image: postgres…` declaration in a compose file, in order. */
export function findPostgresDeclarations(composeText) {
  return [...String(composeText).matchAll(/^\s*image:\s*["']?(postgres[^\s"'#]*)["']?\s*(?:#.*)?$/gm)].map(m => m[1])
}

/** Checks one declaration; `version` and `digest` are null unless it is a proper pin. */
export function checkPostgresDeclaration(declared) {
  const match = typeof declared === 'string' ? declared.match(POSTGRES_PIN_PATTERN) : null
  if (!match) {
    return {
      version: null,
      digest: null,
      problems: [
        `docker-compose.yml declares ${JSON.stringify(declared)}, which is not an exact PostgreSQL version pinned to an immutable digest. `
        + 'A floating tag silently follows upstream rebuilds and minor releases.',
      ],
    }
  }
  return { version: match[1], digest: match[2], problems: [] }
}

/** Compares what is running with the declaration. Every argument is a plain value; no I/O here. */
export function compareRunningPostgres({ declared, version, digest, runningImage, repoDigests, serverVersion }) {
  const problems = []
  if (runningImage !== declared) {
    problems.push(`the running container was started from ${runningImage}, not the declared ${declared}. Recreate the service.`)
  }
  if (!Array.isArray(repoDigests) || !repoDigests.some(d => typeof d === 'string' && d.endsWith(`@${digest}`))) {
    problems.push(`no repository digest of the running image matches the declared ${digest}.`)
  }
  const reported = String(serverVersion ?? '').trim().split(/\s+/)[0]
  if (reported !== version) {
    problems.push(`the running server reports PostgreSQL ${reported || '(nothing)'} but the pin declares ${version}.`)
  }
  return problems
}

function argValue(argv, name, fallback) {
  const i = argv.indexOf(`--${name}`)
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return fallback
}

export function main(argv = process.argv.slice(2)) {
  const declarationOnly = argv.includes('--declaration-only')
  const container = argValue(argv, 'container', 'litubo-cms-postgres-1')
  const problems = []
  const notes = []

  // ── 1. compose declaration ────────────────────────────────────────────────
  const declarations = findPostgresDeclarations(readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8'))
  let checked = { version: null, digest: null, problems: [] }
  if (declarations.length !== 1) {
    problems.push(`docker-compose.yml must declare exactly one postgres image, found ${declarations.length}.`)
  } else {
    notes.push(`declared   ${declarations[0]}`)
    checked = checkPostgresDeclaration(declarations[0])
    problems.push(...checked.problems)
  }

  // ── 2–4. what is actually running ─────────────────────────────────────────
  if (!declarationOnly && problems.length === 0) {
    const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    let runningImage = null
    let repoDigests = null
    let serverVersion = null
    try {
      runningImage = docker(['inspect', '--type', 'container', container, '--format', '{{.Config.Image}}'])
      notes.push(`running    ${runningImage}`)
    } catch {
      problems.push(`container ${container} is not running, so the running image could not be compared with the pin.`)
    }
    if (runningImage) {
      try {
        const imageId = docker(['inspect', '--type', 'container', container, '--format', '{{.Image}}'])
        repoDigests = JSON.parse(docker(['image', 'inspect', imageId, '--format', '{{json .RepoDigests}}']))
        notes.push(`digests    ${repoDigests.join(', ') || '(none recorded)'}`)
      } catch {
        repoDigests = []
      }
      try {
        serverVersion = docker(['exec', container, 'sh', '-c', SERVER_VERSION_COMMAND])
        notes.push(`reported   PostgreSQL ${serverVersion}`)
      } catch {
        serverVersion = ''
      }
      problems.push(...compareRunningPostgres({
        declared: declarations[0],
        version: checked.version,
        digest: checked.digest,
        runningImage,
        repoDigests,
        serverVersion,
      }))
    }
  }

  for (const note of notes) console.log(`  ${note}`)
  if (problems.length > 0) {
    console.error('\nFAIL — PostgreSQL pin verification:')
    for (const p of problems) console.error(`  · ${p}`)
    return 1
  }
  console.log(`\nOK — PostgreSQL is pinned to an exact version and immutable digest${declarationOnly ? ' (declaration checked; runtime not inspected)' : ', and the running server matches it'}.`)
  return 0
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
if (invokedDirectly) process.exit(main())
