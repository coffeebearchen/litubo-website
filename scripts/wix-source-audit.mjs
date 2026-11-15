#!/usr/bin/env node
// Audit saved Wix export pages without contacting Wix or modifying a database.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const privateRoot = resolve(projectRoot, 'private-product-source')
const outputRoot = resolve(privateRoot, 'source-audit')

const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const visibleFields = data => Object.fromEntries(
  Object.entries(data).filter(([field]) => !field.startsWith('_')),
)

async function auditCollection(directory, expectedCollection) {
  const pages = []
  for (const filename of (await readdir(directory)).sort()) {
    if (!/^Import\d+-\d+\.json$/.test(filename)) continue
    pages.push({ filename, page: JSON.parse(await readFile(resolve(directory, filename), 'utf8')) })
  }
  if (!pages.length) throw new Error(`No Wix pages found in ${directory}`)
  if (pages.some(({ page }) => page.collectionId !== expectedCollection)) throw new Error(`Unexpected collection in ${directory}`)

  pages.sort((a, b) => a.page.offset - b.page.offset)
  const records = pages.flatMap(({ page }) => page.records)
  const totals = new Set(pages.map(({ page }) => page.total))
  const offsets = pages.map(({ page }) => page.offset)
  let expectedOffset = 0
  const continuous = pages.every(({ page }) => {
    const matches = page.offset === expectedOffset
    expectedOffset += page.records.length
    return matches
  })
  const uniqueIds = new Set(records.map(record => record.id))
  const total = totals.size === 1 ? [...totals][0] : null
  return {
    collectionId: expectedCollection,
    pageCount: pages.length,
    offsets,
    declaredTotal: total,
    recordCount: records.length,
    uniqueRecordIds: uniqueIds.size,
    paginationComplete: continuous && total === records.length && uniqueIds.size === records.length,
    recordsWithBody: records.filter(record => {
      const body = record.data.detailContent ?? record.data.details_contents
      return typeof body === 'string' && body.trim().length > 0
    }).length,
    sourceRecords: records,
  }
}

const legacy = await auditCollection(resolve(privateRoot, 'wix-legacy-content'), 'Import114')
const filtration = await auditCollection(resolve(privateRoot, 'wix-filtration-content'), 'Import123')
const withoutSourceRecords = collection => Object.fromEntries(
  Object.entries(collection).filter(([field]) => field !== 'sourceRecords'),
)

const identities = new Map()
for (const record of legacy.sourceRecords) {
  const key = `${record.data.lituboModel ?? ''}\u0000${record.data.slug ?? ''}`
  const group = identities.get(key) ?? []
  group.push(record)
  identities.set(key, group)
}

const conflicts = []
for (const [identity, records] of identities) {
  if (records.length < 2) continue
  const [model, slug] = identity.split('\u0000')
  const allFields = new Set(records.flatMap(record => Object.keys(visibleFields(record.data))))
  const differingFields = [...allFields].filter(field => {
    const values = records.map(record => JSON.stringify(visibleFields(record.data)[field] ?? null))
    return new Set(values).size > 1
  }).sort()
  conflicts.push({ model, slug, recordIds: records.map(record => record.id), differingFields })
}

const summary = {
  generatedAt: new Date().toISOString(),
  sourceOnly: true,
  writesToWixOrDatabase: 0,
  collections: [legacy, filtration].map(withoutSourceRecords),
  legacyIdentityConflictGroups: conflicts.length,
  legacyIdentityConflictRecords: conflicts.reduce((count, group) => count + group.recordIds.length, 0),
  filtrationScopeDecision: 'EXCLUDED_BY_OWNER',
  note: 'Import123 is retained only as private source evidence. It must not enter the site taxonomy, navigation, SEO, migration plan, or Directus import.',
}

await mkdir(outputRoot, { recursive: true, mode: 0o700 })
await writeFile(resolve(outputRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
await writeFile(resolve(outputRoot, 'legacy-identity-conflicts.csv'), [
  'model,slug,record_ids,differing_fields,recommended_action',
  ...conflicts.map(group => [
    group.model,
    group.slug,
    group.recordIds.join(' | '),
    group.differingFields.join(' | '),
    'Keep both source records; manually choose or reconcile before import.',
  ].map(csv).join(',')),
].join('\n') + '\n', { mode: 0o600 })

console.log(JSON.stringify(summary, null, 2))
