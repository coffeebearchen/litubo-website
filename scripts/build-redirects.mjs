#!/usr/bin/env node
// Generates server/utils/legacyRedirects.ts from the reviewed redirect manifest.
// The manifest is a REVIEW artefact (private-product-source/redirect-review/redirects.json);
// this script turns the rows into a typed map the server can serve as 301s.
//
// Every destination must return 200 before this is run (the review gate). Run:
//   node scripts/build-redirects.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifestPath = resolve(root, 'private-product-source/redirect-review/redirects.json')
const outPath = resolve(root, 'server/utils/legacyRedirects.ts')

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.enabled !== false && manifest.enabled !== true) {
  throw new Error('Unexpected manifest shape: `enabled` must be a boolean')
}

const rows = (manifest.redirects ?? []).filter(r => r && typeof r.from === 'string' && typeof r.to === 'string' && r.proposedStatus === 301)
if (rows.length === 0) throw new Error('No 301 rows in the manifest')

const seen = new Map()
for (const row of rows) {
  if (seen.has(row.from) && seen.get(row.from) !== row.to) {
    throw new Error(`Conflicting destination for ${row.from}`)
  }
  seen.set(row.from, row.to)
}

const body = [...seen.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([from, to]) => `  ${JSON.stringify(from)}: ${JSON.stringify(to)},`)
  .join('\n')

const out = `// GENERATED FILE — do not edit by hand.
// Source: private-product-source/redirect-review/redirects.json (${seen.size} reviewed 301s).
// Regenerate with: node scripts/build-redirects.mjs
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
${body}
}
`

await writeFile(outPath, out, 'utf8')
console.log(JSON.stringify({ written: outPath, redirects: seen.size }))
