#!/usr/bin/env node
/** Node 22.22.2 strips types from the source-shared offline migration module. */
import { readFile, readdir, mkdir, writeFile, open, unlink } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWixMigrationPlan, importWixDraft, migrationHash } from '../server/utils/wixMigration.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const privateRoot = resolve(root, 'private-product-source')
const siteId = 'a2f78c10-cc08-4913-8174-fcd326b9511d'

function argumentsFrom(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if (!['--input-dir', '--output-dir', '--categories', '--apply-isolated', '--confirm-target'].includes(key) || !value || value.startsWith('--') || result[key]) throw new Error('Use explicit, non-repeated option/value pairs.')
    result[key] = value
  }
  return result
}

function privateOutput(path) {
  const output = resolve(path)
  const rel = relative(privateRoot, output)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Output must be inside ignored private-product-source/.')
  return output
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2))
  if (!options['--input-dir'] || !options['--output-dir']) throw new Error('Required: --input-dir <export pages> --output-dir <private-product-source/...>. Default is dry-run; no credentials needed.')
  const input = resolve(options['--input-dir'])
  const output = privateOutput(options['--output-dir'])
  const pages = []
  for (const name of (await readdir(input)).sort()) {
    if (!/^Import\d+-\d+\.json$/.test(name)) continue
    pages.push(JSON.parse(await readFile(resolve(input, name), 'utf8')))
  }
  if (!pages.length) throw new Error('No Wix export pages found.')
  const categories = options['--categories'] ? JSON.parse(await readFile(resolve(options['--categories']), 'utf8')) : {}
  const plan = buildWixMigrationPlan(pages, { siteId, categories })
  await mkdir(output, { recursive: true, mode: 0o700 })
  await writeFile(resolve(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 })
  const summary = {
    mode: options['--apply-isolated'] ? 'isolated-apply' : 'dry-run',
    planHash: migrationHash(plan),
    collections: plan.collections,
    products: plan.products.length,
    readyDrafts: plan.products.filter(p => !p.issues.some(i => i.severity === 'error')).length,
    errors: plan.issues.filter(i => i.severity === 'error').length + plan.products.reduce((n, p) => n + p.issues.filter(i => i.severity === 'error').length, 0),
    reviewItems: plan.products.reduce((n, p) => n + p.issues.filter(i => i.severity === 'review').length, 0),
    mediaTransferred: false,
    publiclyPublished: 0,
  }
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify(summary, null, 2))
  if (!options['--apply-isolated']) return
  if (plan.issues.some(i => i.severity === 'error')) throw new Error('Global export errors: apply refused; fix source snapshot first.')

  const target = new URL(options['--apply-isolated'])
  if (!['127.0.0.1', '[::1]'].includes(target.hostname) || target.protocol !== 'http:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash || !target.port) throw new Error('Apply accepts only an explicit HTTP loopback target and port, with no credentials/path/query.')
  if (options['--confirm-target'] !== target.origin) throw new Error('--confirm-target must exactly repeat the isolated target origin.')
  // New, isolated admin token injected by the operator/process. Never reads .env or public service token.
  const token = process.env.WIX_MIGRATION_ISOLATED_TOKEN
  if (!token) throw new Error('Isolated write token not configured; no network call made.')
  await mkdir(privateRoot, { recursive: true, mode: 0o700 })
  const lockPath = resolve(privateRoot, `.wix-import-${migrationHash(target.origin)}.lock`)
  const lock = await open(lockPath, 'wx', 0o600)
  const outcomes = []
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, target: target.origin, planHash: summary.planHash }))
    const fetch = async (path, operation) => {
      if (!path.startsWith('/items/') || path.includes('://')) throw new Error('Invalid migration request path')
      const response = await globalThis.fetch(target.origin + path, {
        method: operation?.method ?? 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: operation ? JSON.stringify(operation.body) : undefined,
      })
      if (!response.ok) throw new Error(`Directus migration request failed (${response.status}); inspect isolated logs, not credentials.`)
      return response.status === 204 ? {} : response.json()
    }
    for (const candidate of plan.products) {
      try {
        outcomes.push({ source: candidate.source, ...(await importWixDraft(candidate, fetch)) })
      } catch {
        outcomes.push({ source: candidate.source, outcome: 'failed', detail: 'Stopped after a failed request; partial draft may exist. Rerun with the same source snapshot to resume.' })
        await writeFile(resolve(output, 'outcomes.json'), JSON.stringify(outcomes, null, 2) + '\n', { mode: 0o600 })
        throw new Error('Import stopped on an infrastructure failure; checkpoint saved.')
      }
      await writeFile(resolve(output, 'outcomes.json'), JSON.stringify(outcomes, null, 2) + '\n', { mode: 0o600 })
    }
    console.log(JSON.stringify({ finished: true, outcomes: outcomes.reduce((acc, row) => ({ ...acc, [row.outcome]: (acc[row.outcome] ?? 0) + 1 }), {}) }))
    if (outcomes.some(row => !['created', 'resumed'].includes(row.outcome))) process.exitCode = 2
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
