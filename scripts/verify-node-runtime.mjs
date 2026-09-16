#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-01 — refuses a release step on the wrong Node.
 *
 * `.nvmrc` and `package.json` engines already declare Node 22.22.2, but neither
 * blocks anything: npm prints an EBADENGINE warning and carries on, and a
 * warning in a long build log is not a gate. This check turns the declaration
 * into something that fails closed, so a release sequence cannot be validated on
 * a runtime the release will not use. (The repository has no .npmrc, so
 * engine-strict is not in force; this file does not change that, because
 * engine-strict would also block ordinary local development on a near-enough
 * Node, which is not the risk being managed here.)
 *
 * `.nvmrc` is the single source of truth — the same file GitHub Actions reads
 * through `node-version-file`. Nothing is hard-coded here.
 *
 * Usage:
 *   node scripts/verify-node-runtime.mjs          exact match required
 *   node scripts/verify-node-runtime.mjs --major  major line only (looser)
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const majorOnly = process.argv.includes('--major')

let expected
try {
  expected = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim().replace(/^v/, '')
} catch {
  console.error('FAIL — .nvmrc is missing. The Node contract has no source of truth.')
  process.exit(2)
}
if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`FAIL — .nvmrc must pin an exact version, found ${JSON.stringify(expected)}.`)
  process.exit(2)
}

const actual = process.version.replace(/^v/, '')
const sameMajor = actual.split('.')[0] === expected.split('.')[0]
const ok = majorOnly ? sameMajor : actual === expected

if (!ok) {
  console.error(
    `FAIL — this project runs on Node ${expected}${majorOnly ? ' (major line)' : ''}, but this process is Node ${actual}.\n`
    + 'Release validation must run on the runtime the release targets; a pass on another version proves nothing about it.\n'
    + `Switch with your version manager (the repository pins ${expected} in .nvmrc) and run the command again.`,
  )
  process.exit(1)
}

console.log(`OK — Node ${actual} matches the contract in .nvmrc${majorOnly ? ' (major line)' : ''}.`)
