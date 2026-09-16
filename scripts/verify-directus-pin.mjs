#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-01 — proves the running Directus is the pinned one.
 *
 * The tracked permission artifacts target the Directus 11.17.4 system-table
 * shape and fail closed against anything else, so an unnoticed version move does
 * not degrade gracefully — it breaks provisioning. A floating tag makes that
 * move invisible, which is why docker-compose.yml pins an exact version and an
 * immutable digest. This check confirms, without anyone reading a compose file
 * by eye, that three things still agree:
 *
 *   1. the compose declaration (exact version + digest, no floating tag),
 *   2. the image the running container was actually started from,
 *   3. the Directus version that container reports about itself.
 *
 * It reads image identity only: no environment variable, no secret, and no
 * container configuration beyond the image reference is inspected or printed.
 *
 * Usage:
 *   node scripts/verify-directus-pin.mjs [--container litubo-cms-directus-1]
 *   node scripts/verify-directus-pin.mjs --declaration-only   (no Docker needed)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const declarationOnly = process.argv.includes('--declaration-only')

function argValue(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  return fallback
}
const container = argValue('container', 'litubo-cms-directus-1')

const problems = []
const notes = []

// ── 1. compose declaration ──────────────────────────────────────────────────
const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8')
const declared = compose.match(/^\s*image:\s*(directus\/directus[^\s]*)\s*$/m)?.[1]
if (!declared) {
  problems.push('docker-compose.yml declares no directus/directus image.')
} else {
  notes.push(`declared   ${declared}`)
  if (!/^directus\/directus:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/.test(declared)) {
    problems.push(
      `docker-compose.yml declares ${declared}, which is not an exact version pinned to an immutable digest. `
      + 'A floating tag silently follows upstream releases.',
    )
  }
}
const declaredVersion = declared?.match(/:(\d+\.\d+\.\d+)@/)?.[1] ?? null
const declaredDigest = declared?.match(/@(sha256:[0-9a-f]{64})/)?.[1] ?? null

// ── 2 and 3. what is actually running ───────────────────────────────────────
if (!declarationOnly) {
  const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim()
  let runningImage = null
  try {
    runningImage = docker(['inspect', container, '--format', '{{.Config.Image}}'])
  } catch {
    problems.push(`container ${container} is not running, so the running image could not be compared with the pin.`)
  }

  if (runningImage) {
    notes.push(`running    ${runningImage}`)
    if (declared && runningImage !== declared) {
      problems.push(`the running container was started from ${runningImage}, not the declared ${declared}. Recreate the service.`)
    }

    try {
      const digests = JSON.parse(docker(['image', 'inspect', docker(['inspect', container, '--format', '{{.Image}}']), '--format', '{{json .RepoDigests}}']))
      const matches = digests.some(d => declaredDigest && d.endsWith(declaredDigest))
      notes.push(`digests    ${digests.join(', ') || '(none recorded)'}`)
      if (!matches) problems.push(`no repository digest of the running image matches the declared ${declaredDigest}.`)
    } catch {
      problems.push('the running image exposes no repository digest, so the pin could not be confirmed against it.')
    }

    try {
      const reported = docker(['exec', container, 'node', '-p', 'require("/directus/package.json").version'])
      notes.push(`reported   Directus ${reported}`)
      if (declaredVersion && reported !== declaredVersion) {
        problems.push(`the container reports Directus ${reported} but the pin declares ${declaredVersion}.`)
      }
    } catch {
      problems.push('the container did not report its Directus version.')
    }
  }
}

for (const note of notes) console.log(`  ${note}`)
if (problems.length > 0) {
  console.error('\nFAIL — Directus pin verification:')
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}
console.log(`\nOK — Directus is pinned to an exact version and immutable digest${declarationOnly ? ' (declaration checked; runtime not inspected)' : ', and the running container matches it'}.`)
