/** Wix migration is an offline, source-bound draft importer, never a public publishing path. */
import { createHash } from 'node:crypto'
import sanitizeHtml from 'sanitize-html'

export interface WixExportPage {
  collectionId: string
  offset: number
  total: number
  records: Array<{ id: string; data: Record<string, unknown> }>
}

export interface MigrationIssue {
  code: string
  severity: 'error' | 'review'
  source: string
  detail: string
}

type Values = Record<string, string | number | boolean | null>
export interface WixProductCandidate {
  source: string
  sourceHash: string
  sourcePublished: boolean
  categoryName: string
  categorySlug: string | null
  product: Values
  sections: Values[]
  specifications: Array<{ label_en: string; value_en: string }>
  media: Array<{ role: string; sourceField: string; uri: string }>
  issues: MigrationIssue[]
}

export interface WixMigrationPlan {
  version: 1
  siteId: string
  products: WixProductCandidate[]
  issues: MigrationIssue[]
  collections: Array<{ id: string; expected: number; exported: number; complete: boolean }>
}

export function migrationHash(value: unknown): string {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable)
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)]))
    return v
  }
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
}

/** Decodes the entities retained by sanitize-html without interpreting anything as markup again. */
export function wixPlainText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const html = value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, '\n')
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? original
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : original
  }).replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const SECTION_FIELDS = [
  ['overviewEn', 'overview', 'Overview'],
  ['quickFactsEn', 'feature_list', 'Key facts'],
  ['typicalApplicationsEn', 'applications', 'Typical applications'],
  ['detectionTargetsEn', 'detection_targets', 'Detection targets'],
  ['customerBenefitsEn', 'benefits', 'Customer benefits'],
  ['workingPrincipleEn', 'working_principle', 'Working principle'],
  ['configurationOptionsEn', 'configuration_options', 'Configuration options'],
  ['lineIntegrationEn', 'line_integration', 'Line integration'],
  ['modelSelectionGuideEn', 'text', 'Model selection'],
  ['quotationReminderEn', 'quotation_reminder', 'Quotation information'],
] as const

function productCandidate(siteId: string, collectionId: string, item: WixExportPage['records'][number], categories: Record<string, string>): WixProductCandidate {
  const data = item.data
  const source = `wix://${siteId}/${encodeURIComponent(collectionId)}/${encodeURIComponent(item.id)}`
  const issues: MigrationIssue[] = []
  const flag = (code: string, detail: string, severity: MigrationIssue['severity'] = 'review') => issues.push({ code, detail, source, severity })
  const name = wixPlainText(data.productNameEn)
  const model = wixPlainText(data.lituboModel).replace(/^model\s*:\s*/i, '')
  const code = model.toUpperCase()
  const slug = wixPlainText(data.slug).toLowerCase()
  const categoryName = wixPlainText(data.categoryNameEn)
  const categorySlug = categories[`${collectionId}:${categoryName}`] ?? categories[categoryName] ?? null
  if (!name) flag('MISSING_NAME', 'productNameEn is empty; no invented name will be used.', 'error')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) flag('INVALID_SLUG', 'Source slug needs an explicit replacement.', 'error')
  if (!categorySlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) flag('CATEGORY_UNMAPPED', `Map the actual source category: ${categoryName}`, 'error')
  const validCode = /^[A-Z0-9](?:[A-Z0-9-]{0,98}[A-Z0-9])?$/.test(code)
  if (!validCode) flag('INVALID_MODEL_CODE', 'Model retained verbatim; product_code remains null pending review.')
  const summary = wixPlainText(data.shortDescriptionEn)
  if (!summary) flag('MISSING_SUMMARY', 'No source summary; keep empty pending editorial review.')
  const sections: Values[] = SECTION_FIELDS.flatMap(([field, type, title], sort) => {
    const body = wixPlainText(data[field])
    return body ? [{ type, title_en: title, body_en: body, enabled: true, sort }] : []
  })
  if (!sections.length) {
    const legacy = [data.detailContent, data.detailed_contents, data.details_contents].find(v => typeof v === 'string' && wixPlainText(v))
    const body = wixPlainText(legacy)
    if (body) sections.push({ type: 'overview', title_en: 'Overview', body_en: body, enabled: true, sort: 0 })
    flag('LEGACY_CONTENT_REVIEW', 'Legacy body retained as plain text; inspect product boundaries and completeness.')
  }

  const specs: WixProductCandidate['specifications'] = []
  if (typeof data.technicalSpecificationsHtml === 'string') {
    for (const match of data.technicalSpecificationsHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => wixPlainText(cell[1]))
      if (!cells.length || cells.every(cell => !cell)) continue
      if (/<th\b/i.test(match[1]) && !/<td\b/i.test(match[1])) continue
      if (/^(item|parameter|specification)$/i.test(cells[0]) && /^(specification|value)$/i.test(cells[1] ?? '')) continue
      if (cells.length !== 2 || /(?:rowspan|colspan)\s*=\s*["']?(?:[2-9]|[1-9]\d)/i.test(match[1])) {
        flag('SPEC_TABLE_REVIEW', 'Merged or multi-model table row retained in raw source; not guessed into one model.')
        continue
      }
      if (cells[0] && cells[1]) specs.push({ label_en: cells[0], value_en: cells[1] })
    }
  }
  if (!specs.length) flag('MISSING_STRUCTURED_SPECS', 'No unambiguous two-column technical specification rows.')
  if (specs.some(row => /to be (?:confirmed|configured)|tbd|not available/i.test(row.value_en))) flag('SOURCE_SPEC_UNCONFIRMED', 'Source contains unconfirmed/configuration-dependent values; retain wording for review.')
  const media = [
    ['mainImage', 'hero'], ['manualFile', 'manual'], ['datasheetFile', 'datasheet'], ['productDrawingFile', 'drawing'],
  ].flatMap(([field, role]) => typeof data[field] === 'string' && data[field] ? [{ sourceField: field, role, uri: data[field] as string }] : [])
  const gallery = data.mediaGallery ?? data.mediagallery
  if (Array.isArray(gallery)) for (const value of gallery) {
    if (value && typeof value === 'object' && 'src' in value && typeof value.src === 'string') media.push({ sourceField: 'mediaGallery', role: 'gallery', uri: value.src })
  }
  if (!media.some(file => file.role === 'hero')) flag('MISSING_HERO', 'No product hero; do not substitute an unrelated machine image.')
  const sourcePublished = data._publishStatus === 'PUBLISHED' && data.isVisible !== false
  if (!sourcePublished) flag('SOURCE_NOT_PUBLIC', 'Wix draft/hidden item: internal migration only, never auto-publish.')
  return {
    source, sourceHash: migrationHash(data), sourcePublished, categoryName, categorySlug,
    product: {
      status: 'draft', name_en: name, slug, model_or_series: model || null, product_code: validCode ? code : null,
      summary_en: summary || null, seo_title_en: name || null, seo_description_en: wixPlainText(data.seoDescription) || null,
      seo_noindex: true, review_notes: `${source}#sha256=${migrationHash(data)}`,
    },
    sections, specifications: specs, media, issues,
  }
}

export function buildWixMigrationPlan(pages: WixExportPage[], options: { siteId: string; categories?: Record<string, string> }): WixMigrationPlan {
  if (!/^[a-zA-Z0-9-]+$/.test(options.siteId)) throw new Error('Invalid site ID')
  const issues: MigrationIssue[] = []
  const collections: WixMigrationPlan['collections'] = []
  const items = new Map<string, { collectionId: string; item: WixExportPage['records'][number] }>()
  for (const id of new Set(pages.map(page => page.collectionId))) {
    const subset = pages.filter(page => page.collectionId === id)
    const totals = new Set(subset.map(page => page.total))
    const expected = subset[0].total
    const offsets = new Map<number, string>()
    for (const page of subset) {
      if (!Number.isInteger(page.offset) || page.offset < 0 || !Number.isInteger(page.total) || page.total < 0 || !Array.isArray(page.records)) throw new Error('Malformed export page')
      page.records.forEach((item, index) => {
        if (!item.id || !item.data || typeof item.data !== 'object') throw new Error('Malformed export item')
        const key = `${id}/${item.id}`
        const prior = items.get(key)
        if (prior && migrationHash(prior.item.data) !== migrationHash(item.data)) issues.push({ code: 'SOURCE_CHANGED', source: key, severity: 'error', detail: 'Same source ID changed during export; take a consistent snapshot.' })
        if (offsets.has(page.offset + index) && offsets.get(page.offset + index) !== item.id) issues.push({ code: 'PAGING_SHIFT', source: id, severity: 'error', detail: 'An offset returned a different ID during export.' })
        offsets.set(page.offset + index, item.id)
        items.set(key, { collectionId: id, item })
      })
    }
    const exported = [...items.values()].filter(item => item.collectionId === id).length
    const complete = totals.size === 1 && expected === exported && offsets.size === expected && [...offsets.keys()].every(offset => offset < expected)
    collections.push({ id, expected, exported, complete })
    if (!complete) issues.push({ code: 'INCOMPLETE_EXPORT', source: id, severity: 'error', detail: `Expected ${expected}, exported ${exported}; no import until pagination is complete.` })
  }
  const products = [...items.values()].map(({ collectionId, item }) => productCandidate(options.siteId, collectionId, item, options.categories ?? {}))
  for (const field of ['slug', 'product_code']) {
    const seen = new Map<unknown, WixProductCandidate>()
    for (const candidate of products) {
      const value = candidate.product[field]
      if (!value) continue
      const previous = seen.get(value)
      if (previous) {
        for (const item of [previous, candidate]) item.issues.push({ code: 'IDENTITY_CONFLICT', source: item.source, severity: 'error', detail: `Duplicate ${field}: ${value}; resolve explicitly, never fuzzy-merge.` })
      } else seen.set(value, candidate)
    }
  }
  return { version: 1, siteId: options.siteId, products, issues, collections }
}

export type MigrationFetch = <T>(path: string, options?: { method: 'POST'; body: unknown }) => Promise<T>
type ExistingRow = Record<string, unknown> & { id: number }

function queryFilter(collection: string, filter: unknown, fields = '*'): string {
  return `/items/${collection}?filter=${encodeURIComponent(JSON.stringify(filter))}&fields=${fields}&limit=2`
}

function sameValues(row: ExistingRow, wanted: Values): boolean {
  return Object.entries(wanted).every(([field, value]) => (row[field] ?? null) === value)
}

/** Create-only import: existing/manual values are never patched, published or deleted. */
export async function importWixDraft(candidate: WixProductCandidate, fetch: MigrationFetch): Promise<{ outcome: 'created' | 'resumed' | 'conflict' | 'blocked'; productId?: number; detail?: string }> {
  if (!candidate.categorySlug || candidate.issues.some(issue => issue.severity === 'error')) return { outcome: 'blocked', detail: 'Resolve candidate errors first.' }
  const category = await fetch<{ data: ExistingRow[] }>(queryFilter('product_categories', { slug: { _eq: candidate.categorySlug } }, 'id'))
  if (category.data.length !== 1) return { outcome: 'blocked', detail: 'Target category must exist exactly once.' }
  const payload: Values = { ...candidate.product, status: 'draft', seo_noindex: true, category_id: category.data[0].id }
  const marked = await fetch<{ data: ExistingRow[] }>(queryFilter('products', { review_notes: { _eq: candidate.product.review_notes } }))
  if (marked.data.length > 1) return { outcome: 'conflict', detail: 'Duplicate source markers; no writes.' }
  let product = marked.data[0]
  let created = false
  if (product) {
    if (!sameValues(product, payload)) return { outcome: 'conflict', productId: product.id, detail: 'Existing product changed or is not draft; preserve manual data.' }
  } else {
    const identity: Record<string, unknown>[] = [{ slug: { _eq: payload.slug } }]
    if (payload.product_code) identity.push({ product_code: { _eq: payload.product_code } })
    const clashes = await fetch<{ data: ExistingRow[] }>(queryFilter('products', { _or: identity }, 'id'))
    if (clashes.data.length) return { outcome: 'conflict', detail: 'Existing slug/model belongs to another source; no writes.' }
    product = (await fetch<{ data: ExistingRow }>('/items/products', { method: 'POST', body: payload })).data
    created = true
  }
  const productId = product.id
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error('Directus did not return a valid product ID')
  const ensure = async (collection: string, filter: unknown, values: Values) => {
    const result = await fetch<{ data: ExistingRow[] }>(queryFilter(collection, filter))
    if (result.data.length > 1 || (result.data.length === 1 && !sameValues(result.data[0], values))) return false
    if (!result.data.length) await fetch(`/items/${collection}`, { method: 'POST', body: values })
    return true
  }
  for (const section of candidate.sections) {
    if (!await ensure('product_sections', { product_id: { _eq: productId }, sort: { _eq: section.sort } }, { ...section, product_id: productId })) return { outcome: 'conflict', productId, detail: 'Section was changed; partial draft retained, no overwrite.' }
  }
  if (candidate.specifications.length) {
    const title = 'Technical specifications'
    const groups = await fetch<{ data: ExistingRow[] }>(queryFilter('product_spec_groups', { product_id: { _eq: productId }, title_en: { _eq: title } }))
    if (groups.data.length > 1) return { outcome: 'conflict', productId, detail: 'Duplicate specification groups.' }
    const group = groups.data[0] ?? (await fetch<{ data: ExistingRow }>('/items/product_spec_groups', { method: 'POST', body: { product_id: productId, title_en: title, enabled: true, sort: 0 } })).data
    for (const [sort, spec] of candidate.specifications.entries()) {
      if (!await ensure('product_spec_items', { spec_group_id: { _eq: group.id }, sort: { _eq: sort } }, { ...spec, spec_group_id: group.id, sort, enabled: true })) return { outcome: 'conflict', productId, detail: 'Specification was changed; partial draft retained, no overwrite.' }
    }
  }
  const factKey = `wix_import:${candidate.sourceHash}`
  if (!await ensure('product_source_records', { product_id: { _eq: productId }, source_locator: { _eq: candidate.source }, fact_key: { _eq: factKey } }, {
    product_id: productId, source_locator: candidate.source, fact_key: factKey, review_status: 'needs_review', archived: false,
    note: 'Imported from Wix into an isolated draft. Product facts and source visibility require human review. Media files remain in the migration manifest.',
  })) return { outcome: 'conflict', productId, detail: 'Source evidence was modified.' }
  return { outcome: created ? 'created' : 'resumed', productId }
}
