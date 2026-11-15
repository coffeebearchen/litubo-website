#!/usr/bin/env node
// Build a review manifest from observed Wix URLs. Never installs live redirects.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)), 'private-product-source')
const plan = JSON.parse(await readFile(resolve(root, 'migration-plan/plan.json'), 'utf8'))
const candidates = new Map(plan.products.map(item => [item.source.split('/').slice(-2).join('/'), item]))
const rows = new Map()
const issues = []
const pathOnly = value => typeof value === 'string' && /^\/(?!\/)[^\s?#]*$/.test(value) && !value.includes('\\') && ![...value].some(ch => ch.charCodeAt(0) < 32)
for (const filename of (await readdir(resolve(root, 'wix'))).sort()) {
  if (!/^Import\d+-\d+\.json$/.test(filename)) continue
  const page = JSON.parse(await readFile(resolve(root, 'wix', filename), 'utf8'))
  for (const record of page.records) {
    const candidate = candidates.get(`${page.collectionId}/${record.id}`)
    if (!candidate) continue
    const target = `/products/${candidate.categorySlug}/${candidate.product.slug}`
    if (!candidate.categorySlug || !/^\/products\/[a-z0-9-]+\/[a-z0-9-]+$/.test(target)) throw new Error('Invalid target path')
    const sourceLinks = Object.entries(record.data).filter(([field]) => field.startsWith('link-'))
    if (!sourceLinks.length) issues.push({ source: candidate.source, issue: 'No observed Wix path; do not infer a URL from a slug.' })
    for (const [field, source] of sourceLinks) {
      if (!pathOnly(source)) {
        issues.push({ source: candidate.source, field, issue: 'Invalid or unsupported source path.' })
        continue
      }
      // Preserve percent-encoded paths exactly as returned by Wix.
      if (rows.has(source) && rows.get(source).to !== target) throw new Error(`Conflicting destination for ${source}`)
      rows.set(source, { from: source, to: target, proposedStatus: 301, state: 'WAIT_FOR_TARGET_PUBLICATION', evidence: candidate.source, field })
    }
  }
}
const output = resolve(root, 'redirect-review')
await mkdir(output, { recursive: true })
const manifest = { enabled: false, note: 'Review only. Check each destination is published and returns 200 before enabling at cutover.', redirects: [...rows.values()], issues }
await writeFile(resolve(output, 'redirects.json'), JSON.stringify(manifest, null, 2) + '\n')
const csv = value => `"${String(value).replaceAll('"', '""')}"`
await writeFile(resolve(output, 'redirects.csv'), ['from,to,proposed_status,state,evidence', ...manifest.redirects.map(row => [row.from, row.to, row.proposedStatus, row.state, row.evidence].map(csv).join(','))].join('\n') + '\n')
console.log(JSON.stringify({ observedPaths: rows.size, issues: issues.length, liveRedirectsInstalled: 0, output }))
