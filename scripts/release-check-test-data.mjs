/**
 * FINAL-RELEASE-FIX-B — release data safety check: published TEST data.
 *
 *   npm run release:check-test-data
 *
 * Runs the tracked query in `release-check-test-data.sql` inside a READ ONLY transaction and blocks the
 * release when any published record carries an explicit TEST marker:
 *
 *   exit 0  PASS          the check completed and found nothing
 *   exit 1  BLOCKED       published TEST data exists; each finding is listed
 *   exit 2  CHECK FAILED  the database could not be queried or answered unexpectedly; never a pass
 *
 * psql runs inside the Postgres container with the container's own environment, so no credential is
 * read, passed or printed. The report names only collection, id, status, marker and slug; database error
 * output is never echoed.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const CHECK_SQL_PATH = fileURLToPath(new URL('./release-check-test-data.sql', import.meta.url))

export const EXIT_PASS = 0
export const EXIT_BLOCKED = 1
export const EXIT_CHECK_FAILED = 2

const COLLECTIONS = ['posts', 'products', 'product_categories', 'content_item_locales']
const MARKERS = ['[TEST]', 'TEST ONLY', 'NOT FOR PUBLICATION']
const PSQL = 'psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

/**
 * @typedef {{ code: number, stdout: string }} ExecResult
 * @typedef {(script: string) => Promise<ExecResult>} Exec
 * @typedef {{ collection: string, id: string, status: string, marker: string, slug: string }} Finding
 * @typedef {{ exitCode: number, findings: Finding[], lines: string[] }} Report
 */

/** @returns {string} */
export function readCheckQuery() {
  return readFileSync(CHECK_SQL_PATH, 'utf8')
}

/**
 * Wraps the query in a READ ONLY transaction, so the database itself refuses any write.
 * @param {string} query
 * @returns {string}
 */
export function buildCheckScript(query) {
  return `BEGIN TRANSACTION READ ONLY;\n${query.trim()}\nCOMMIT;\n`
}

/**
 * Runs a psql script in the local Postgres container: the one named by `RELEASE_CHECK_DB_CONTAINER`,
 * otherwise the `postgres` service of this repository's Docker Compose project. Resolves with the exit
 * code and stdout only.
 * @param {string} script
 * @param {{ container?: string }} [options]
 * @returns {Promise<ExecResult>}
 */
export function execPsql(script, { container = process.env.RELEASE_CHECK_DB_CONTAINER } = {}) {
  const args = container
    ? ['exec', '-i', container, 'sh', '-c', PSQL]
    : ['compose', 'exec', '-T', 'postgres', 'sh', '-c', PSQL]
  return new Promise((done) => {
    const child = execFile('docker', args, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
      done({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout: String(stdout ?? '') })
    })
    child.stdin?.on('error', () => {})
    child.stdin?.end(script)
  })
}

/**
 * Reads the check's psql output. Only finding lines followed by exactly one completion line with a
 * matching count are a complete answer. No output, error text, an extra column, an unknown collection or
 * marker, output after the completion line or a count mismatch is not.
 * @param {string} stdout
 * @returns {{ ok: true, findings: Finding[] } | { ok: false, reason: string }}
 */
export function parseCheckOutput(stdout) {
  /** @type {Finding[]} */
  const findings = []
  /** @type {number | null} */
  let checked = null
  for (const line of String(stdout).split(/\r?\n/)) {
    if (line === '') continue
    if (checked !== null) return { ok: false, reason: 'output after the completion line' }
    const parts = line.split('\t')
    if (parts[0] === 'FINDING' && parts.length === 6 && COLLECTIONS.includes(parts[1]) && /^-?\d+$/.test(parts[2]) && MARKERS.includes(parts[4])) {
      findings.push({ collection: parts[1], id: parts[2], status: parts[3], marker: parts[4], slug: parts[5] })
    }
    else if (parts[0] === 'CHECKED' && parts.length === 2 && /^\d+$/.test(parts[1])) {
      checked = Number(parts[1])
    }
    else {
      return { ok: false, reason: 'an unrecognised output line' }
    }
  }
  if (checked === null) return { ok: false, reason: 'no completion line' }
  if (checked !== findings.length) return { ok: false, reason: 'a finding count that does not match its completion line' }
  return { ok: true, findings }
}

/**
 * @param {string} reason
 * @returns {Report}
 */
function checkFailed(reason) {
  return {
    exitCode: EXIT_CHECK_FAILED,
    findings: [],
    lines: [`RELEASE CHECK FAILED — ${reason}. The release stays blocked until the check completes.`],
  }
}

/**
 * Runs the check and decides. Never throws: anything short of a complete answer is EXIT_CHECK_FAILED.
 * @param {{ exec?: Exec, loadQuery?: () => string }} [options]
 * @returns {Promise<Report>}
 */
export async function runReleaseTestDataCheck({ exec = execPsql, loadQuery = readCheckQuery } = {}) {
  let result
  try {
    result = await exec(buildCheckScript(loadQuery()))
  }
  catch {
    return checkFailed('the database check could not be run')
  }
  if (!result || result.code !== 0) return checkFailed(`the database check exited with code ${result?.code ?? 'unknown'}`)
  const parsed = parseCheckOutput(result.stdout)
  if (!parsed.ok) return checkFailed(`the database answered with ${parsed.reason}`)
  if (parsed.findings.length === 0) {
    return { exitCode: EXIT_PASS, findings: [], lines: [`PASS — no published TEST data in ${COLLECTIONS.join(', ')}.`] }
  }
  return {
    exitCode: EXIT_BLOCKED,
    findings: parsed.findings,
    lines: [
      `RELEASE BLOCKED — ${parsed.findings.length} published record(s) carry a TEST marker:`,
      ...parsed.findings.map(f => `  ${f.collection} #${f.id}  status=${f.status}  marker=${f.marker}  slug=${f.slug}`),
      'Take these records out of the published state (never delete them), then run the check again.',
    ],
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runReleaseTestDataCheck()
  const write = report.exitCode === EXIT_PASS ? console.log : console.error
  for (const line of report.lines) write(line)
  process.exitCode = report.exitCode
}
