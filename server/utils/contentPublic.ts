import type { FetchFn } from './mediaLifecycle'
import { archivedAmong } from './contentMediaRelations'
import { isValidCtaHref } from './contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { validateCanonicalPath } from '../../utils/contentSeo'
import { validateContentSlug } from '../../utils/contentSlug'
import { CONTENT_TYPE_IDS, getContentType, type ContentTypeDefinition, type ContentTypeId } from '../../utils/contentTypes'
import type { ContentPublishedSnapshot, ContentSnapshotFileRef } from '../../types/content-center'
import type {
  PublicContentBlock,
  PublicContentCard,
  PublicContentDetail,
  PublicContentImage,
  PublicContentLink,
  PublicContentList,
} from '../../types/content-public'

/**
 * CC-IMP-10 — the one Content Center public eligibility contract and the public
 * reader built on it (CONTENT-CENTER-BLUEPRINT-V1 §12, §15, §29–§31;
 * RELEASE-SAFETY-GATES RSG-01, RSG-02, RSG-05, RSG-06, RSG-07, §3.1, §3A; D-035).
 *
 * eligible(item, locale) =
 *       item.status = 'published' AND item.archived_at IS NULL
 *   AND the requested locale row has its own published_snapshot (for that locale, type and slug)
 *   AND locale ∈ runtimeConfig.public.publishedLocales
 *   AND the type is publicEnabled with a public route
 *
 * An item is `published` only while its default locale holds a snapshot (Publish /
 * Unpublish service), so a translation is never eligible without a
 * published default locale. There is no locale fallback of any kind.
 *
 * Detail, list, related content and the sitemap all use `publicLocalesQuery` +
 * `resolvePublicEligibility`; the sitemap only narrows further (`isSitemapEligible`:
 * sitemap-eligible type and snapshot noindex = false). noindex never makes content
 * unpublished. The Directus `nuxt-server` permissions (D-034) are a narrower second
 * layer; this code never relies on them alone.
 *
 * Every public payload is an explicit allowlist of snapshot values. Services return
 * `null` for "not publicly eligible" (route → 404) and let every upstream failure
 * throw (route → 503), so an infrastructure problem is never shown as 404 or empty.
 */

type Row = Record<string, unknown>

export const PUBLIC_CONTENT_LIST_LIMIT = 100

export interface PublicContentOptions {
  /** `runtimeConfig.public.publishedLocales`. */
  publishedLocales: readonly unknown[]
  /** Content Center public delivery reads Directus only when `CMS_MODE=directus`; there are no content fixtures. */
  contentFromDirectus: boolean
  /** Related products are rendered only when products are served from Directus (`CMS_MODE_PRODUCTS=directus`). */
  productsFromDirectus: boolean
  /** Content type registry lookup; tests may inject an isolated registry. Defaults to `utils/contentTypes`. */
  resolveType?: (id: unknown) => ContentTypeDefinition | null
}

export interface EligiblePublicContent {
  itemId: number
  type: ContentTypeDefinition
  locale: ContentLocale
  slug: string
  publishedAt: string | null
  snapshot: ContentPublishedSnapshot
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const typeResolver = (options: Pick<PublicContentOptions, 'resolveType'>) => options.resolveType ?? getContentType

/** The public content types of the registry: `publicEnabled` with a confirmed public route. */
export function publicContentTypes(options: Pick<PublicContentOptions, 'resolveType'> = {}): ContentTypeDefinition[] {
  const resolve = typeResolver(options)
  return CONTENT_TYPE_IDS
    .map(id => resolve(id))
    .filter((def): def is ContentTypeDefinition => Boolean(def?.publicEnabled && def.publicRoute))
}

/** A route or query type parameter that names a public content type; anything else is not public. */
export function publicContentType(raw: unknown, options: Pick<PublicContentOptions, 'resolveType'> = {}): ContentTypeDefinition | null {
  return publicContentTypes(options).find(def => def.id === raw) ?? null
}

/** `?locale=`: missing means the default locale; an unknown value is never coerced to another locale. */
export function parsePublicLocale(raw: unknown): ContentLocale | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null || value === '') return DEFAULT_CONTENT_LOCALE
  return isContentLocale(value) ? value : null
}

export function contentPublicPath(type: Pick<ContentTypeDefinition, 'publicRoute'>, locale: ContentLocale, slug: string): string {
  const prefix = locale === DEFAULT_CONTENT_LOCALE ? '' : `/${locale}`
  return `${prefix}${type.publicRoute}/${slug}`
}

// ── Eligibility ──────────────────────────────────────────────────────────────

function isSnapshot(value: unknown): value is ContentPublishedSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as Row
  return s.version === 1
    && typeof s.title === 'string' && s.title.trim().length > 0
    && typeof s.slug === 'string'
    && typeof s.summary === 'string'
    && Array.isArray(s.blocks)
    && Boolean(s.seo) && typeof s.seo === 'object'
    && Boolean(s.media) && typeof s.media === 'object'
    && Boolean(s.relations) && typeof s.relations === 'object'
}

/**
 * The single eligibility decision for one locale row read by `publicLocalesQuery`.
 * Every condition is re-checked here, whatever the query or permissions already
 * filtered; anything unexpected is not eligible.
 */
export function resolvePublicEligibility(row: Row, requestedLocale: unknown, options: Pick<PublicContentOptions, 'publishedLocales' | 'resolveType'>): EligiblePublicContent | null {
  if (!isContentLocale(requestedLocale) || !options.publishedLocales.includes(requestedLocale)) return null
  if (row.locale !== requestedLocale) return null
  const item = row.content_items_id
  if (!item || typeof item !== 'object') return null
  const { id, content_type: contentType, status, archived_at: archivedAt } = item as Row
  if (typeof id !== 'number' || status !== 'published' || archivedAt !== null) return null
  const type = typeResolver(options)(contentType)
  if (!type || !type.publicEnabled || !type.publicRoute) return null
  const slug = row.slug
  if (typeof slug !== 'string' || !validateContentSlug(slug).ok) return null
  const snapshot = row.published_snapshot
  if (!isSnapshot(snapshot)) return null
  if (snapshot.locale !== requestedLocale || snapshot.contentType !== type.id || snapshot.slug !== slug) return null
  return {
    itemId: id,
    type,
    locale: requestedLocale,
    slug,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    snapshot,
  }
}

/** Sitemap / indexing narrowing on top of eligibility: sitemap-eligible type and noindex = false. */
export function isSitemapEligible(entry: EligiblePublicContent): boolean {
  return entry.type.sitemapEligible === true && entry.snapshot.seo?.noindex !== true
}

// ── Shared query ─────────────────────────────────────────────────────────────

export const PUBLIC_LOCALE_FIELDS = [
  'locale', 'slug', 'published_snapshot', 'published_at',
  'content_items_id.id', 'content_items_id.content_type', 'content_items_id.status', 'content_items_id.archived_at',
].join(',')

export interface PublicLocalesFilter {
  slug?: string
  itemIds?: number[]
  /** Default `PUBLIC_CONTENT_LIST_LIMIT`; the sitemap passes -1. */
  limit?: number
}

/** The one Directus read of public content (nuxt-server). Only snapshot-side columns are requested. */
export function publicLocalesQuery(locale: ContentLocale, types: readonly ContentTypeId[], filter: PublicLocalesFilter = {}): string {
  const parts = [
    `filter[locale][_eq]=${locale}`,
    'filter[published_snapshot][_nnull]=true',
    'filter[content_items_id][status][_eq]=published',
    'filter[content_items_id][archived_at][_null]=true',
    `filter[content_items_id][content_type][_in]=${types.join(',')}`,
  ]
  if (filter.slug !== undefined) parts.push(`filter[slug][_eq]=${encodeURIComponent(filter.slug)}`)
  if (filter.itemIds !== undefined) parts.push(`filter[content_items_id][_in]=${filter.itemIds.join(',')}`)
  parts.push(`fields=${PUBLIC_LOCALE_FIELDS}`, 'sort=-published_at', `limit=${filter.limit ?? PUBLIC_CONTENT_LIST_LIMIT}`)
  return `/items/content_item_locales?${parts.join('&')}`
}

/** Eligible entries of `types` in `locale`. A locale the site does not publish reads nothing. */
export async function loadEligiblePublicContent(
  fetch: FetchFn,
  locale: ContentLocale,
  types: readonly ContentTypeDefinition[],
  filter: PublicLocalesFilter,
  options: Pick<PublicContentOptions, 'publishedLocales' | 'resolveType'>,
): Promise<EligiblePublicContent[]> {
  if (!options.publishedLocales.includes(locale) || types.length === 0) return []
  if (filter.itemIds !== undefined && filter.itemIds.length === 0) return []
  const res = await fetch<{ data: Row[] }>(publicLocalesQuery(locale, types.map(t => t.id), filter))
  const allowed = new Set(types.map(t => t.id))
  return (res.data ?? [])
    .map(row => resolvePublicEligibility(row, locale, options))
    .filter((entry): entry is EligiblePublicContent => entry !== null && allowed.has(entry.type.id))
}

// ── Media (RSG-06) ───────────────────────────────────────────────────────────

export interface PublicFile {
  id: string
  type: string | null
  title: string | null
  filename_download: string | null
}

/**
 * Files that may appear in public output right now: they exist, `is_public = true`
 * and are not archived in the Media Library. Checked at request time, not trusted
 * from Publish.
 */
export async function resolvePublicFiles(fetch: FetchFn, fileIds: readonly string[]): Promise<Map<string, PublicFile>> {
  const ids = [...new Set(fileIds.map(id => String(id).toLowerCase()).filter(id => UUID_RE.test(id)))]
  if (ids.length === 0) return new Map()
  const [fileRes, archived] = await Promise.all([
    fetch<{ data: Row[] }>(`/files?filter[id][_in]=${ids.join(',')}&filter[is_public][_eq]=true&fields=id,is_public,type,title,filename_download&limit=-1`),
    archivedAmong(fetch, ids),
  ])
  const out = new Map<string, PublicFile>()
  for (const row of fileRes.data ?? []) {
    const id = String(row.id ?? '').toLowerCase()
    if (!ids.includes(id) || row.is_public !== true || archived.has(id)) continue
    out.set(id, {
      id,
      type: typeof row.type === 'string' ? row.type : null,
      title: typeof row.title === 'string' ? row.title : null,
      filename_download: typeof row.filename_download === 'string' ? row.filename_download : null,
    })
  }
  return out
}

/** The id under which `fileId` may be linked publicly, per a `resolvePublicFiles` result; null when it may not. */
export const publicFileId = (files: ReadonlyMap<string, PublicFile>, fileId: string | null | undefined): string | null =>
  (typeof fileId === 'string' ? files.get(fileId.toLowerCase())?.id : undefined) ?? null

export const publicMediaUrl = (fileId: string, download = false) => `/api/cms/media/${fileId}${download ? '?download=true' : ''}`

function imageOf(ref: ContentSnapshotFileRef | null | undefined, files: Map<string, PublicFile>): PublicContentImage | null {
  if (!ref || typeof ref.fileId !== 'string') return null
  const file = files.get(ref.fileId.toLowerCase())
  if (!file) return null
  return {
    url: publicMediaUrl(file.id),
    alt: (typeof ref.alt === 'string' && ref.alt.trim()) ? ref.alt : (file.title ?? ''),
    caption: typeof ref.caption === 'string' && ref.caption.trim() ? ref.caption : null,
  }
}

const snapshotFileIds = (snapshot: ContentPublishedSnapshot): string[] => {
  const media = snapshot.media ?? ({} as ContentPublishedSnapshot['media'])
  return [media.hero, media.ogImage, ...(media.inline ?? []), ...(media.downloads ?? [])]
    .filter((ref): ref is ContentSnapshotFileRef => typeof ref?.fileId === 'string')
    .map(ref => ref.fileId)
}

// ── Blocks (allowlist, plain text only) ─────────────────────────────────────

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const optStr = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const items = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((entry): entry is Row => Boolean(entry) && typeof entry === 'object') : []

function publicBlocks(snapshot: ContentPublishedSnapshot, inlineOrdinal: Map<number, number>): PublicContentBlock[] {
  const out: PublicContentBlock[] = []
  for (const raw of snapshot.blocks as unknown[]) {
    const block = raw && typeof raw === 'object' ? raw as Row : null
    const data = block?.data && typeof block.data === 'object' ? block.data as Row : null
    if (!block || !data) continue
    const id = `block-${out.length + 1}`
    switch (block.type) {
      case 'text':
        if (Array.isArray(data.paragraphs)) out.push({ id, type: 'text', data: { heading: optStr(data.heading), paragraphs: data.paragraphs.map(str) } })
        break
      case 'key_points':
        out.push({ id, type: 'key_points', data: { heading: optStr(data.heading), items: items(data.items).map(i => ({ title: str(i.title), body: optStr(i.body) })) } })
        break
      case 'faq':
        out.push({ id, type: 'faq', data: { heading: optStr(data.heading), items: items(data.items).map(i => ({ question: str(i.question), answer: str(i.answer) })) } })
        break
      case 'cta': {
        // A call to action without a label or a safe link (internal path or https://) is not rendered publicly.
        const href = str(data.href).trim()
        const label = str(data.label).trim()
        if (label && href && isValidCtaHref(href)) out.push({ id, type: 'cta', data: { heading: optStr(data.heading), body: optStr(data.body), label, href } })
        break
      }
      case 'image': {
        const ordinal = inlineOrdinal.get(Number(data.fileLinkId))
        if (ordinal !== undefined) out.push({ id, type: 'image', data: { fileLinkId: ordinal, caption: optStr(data.caption) } })
        break
      }
      case 'related_content':
        out.push({ id, type: 'related_content', data: { heading: optStr(data.heading) } })
        break
      case 'downloads':
        out.push({ id, type: 'downloads', data: { heading: optStr(data.heading) } })
        break
      default:
        // Unknown or unsupported block types are never rendered.
        break
    }
  }
  return out
}

// ── Related content and products (RSG §3A.4) ─────────────────────────────────

const numberIds = (value: unknown): number[] =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))] : []

async function relatedContent(fetch: FetchFn, entry: EligiblePublicContent, options: PublicContentOptions): Promise<PublicContentLink[]> {
  const ids = numberIds(entry.snapshot.relations?.content).filter(id => id !== entry.itemId)
  if (ids.length === 0) return []
  const targets = await loadEligiblePublicContent(fetch, entry.locale, publicContentTypes(options), { itemIds: ids }, options)
  const byId = new Map(targets.map(t => [t.itemId, t]))
  return ids.flatMap((id) => {
    const target = byId.get(id)
    return target
      ? [{ key: `content-${ids.indexOf(id) + 1}`, label: target.snapshot.title.trim(), meta: target.type.label, href: contentPublicPath(target.type, target.locale, target.slug) }]
      : []
  })
}

/** Existing product public semantics: product `published` in a `published` category, with its own name in the locale. */
async function relatedProducts(fetch: FetchFn, entry: EligiblePublicContent, options: PublicContentOptions): Promise<PublicContentLink[]> {
  const ids = numberIds(entry.snapshot.relations?.products)
  if (ids.length === 0 || !options.productsFromDirectus) return []
  const nameField = `name_${entry.locale}`
  const productRes = await fetch<{ data: Row[] }>(
    `/items/products?filter[id][_in]=${ids.join(',')}&filter[status][_eq]=published&fields=id,slug,category_id,${nameField}&limit=-1`,
  )
  const products = (productRes.data ?? []).filter(p => typeof p.id === 'number' && typeof p.slug === 'string' && typeof p.category_id === 'number')
  const categoryIds = [...new Set(products.map(p => p.category_id as number))]
  if (categoryIds.length === 0) return []
  const categoryRes = await fetch<{ data: Row[] }>(
    `/items/product_categories?filter[id][_in]=${categoryIds.join(',')}&filter[status][_eq]=published&fields=id,slug&limit=-1`,
  )
  const categorySlug = new Map((categoryRes.data ?? []).filter(c => typeof c.slug === 'string').map(c => [c.id as number, c.slug as string]))
  const prefix = entry.locale === DEFAULT_CONTENT_LOCALE ? '' : `/${entry.locale}`
  const byId = new Map(products.map(p => [p.id as number, p]))
  return ids.flatMap((id) => {
    const product = byId.get(id)
    const slug = product ? categorySlug.get(product.category_id as number) : undefined
    const name = product ? optStr(product[nameField]) : undefined
    return product && slug && name
      ? [{ key: `product-${ids.indexOf(id) + 1}`, label: name.trim(), meta: 'Product', href: `${prefix}/products/${slug}/${product.slug as string}` }]
      : []
  })
}

// ── Payloads ─────────────────────────────────────────────────────────────────

function cardOf(entry: EligiblePublicContent, files: Map<string, PublicFile>): PublicContentCard {
  return {
    type: entry.type.id,
    typeLabel: entry.type.label,
    title: entry.snapshot.title.trim(),
    summary: str(entry.snapshot.summary).trim(),
    href: contentPublicPath(entry.type, entry.locale, entry.slug),
    publishedAt: entry.publishedAt,
    image: imageOf(entry.snapshot.media?.hero, files),
  }
}

export async function buildPublicContentDetail(fetch: FetchFn, entry: EligiblePublicContent, options: PublicContentOptions): Promise<PublicContentDetail> {
  const { snapshot } = entry
  const [files, relatedItems, relatedProductLinks] = await Promise.all([
    resolvePublicFiles(fetch, snapshotFileIds(snapshot)),
    relatedContent(fetch, entry, options),
    relatedProducts(fetch, entry, options),
  ])

  const inlineOrdinal = new Map<number, number>()
  const images: Record<string, PublicContentImage> = {}
  for (const ref of snapshot.media?.inline ?? []) {
    const image = imageOf(ref, files)
    if (!image || inlineOrdinal.has(ref.linkId)) continue
    const ordinal = inlineOrdinal.size + 1
    inlineOrdinal.set(ref.linkId, ordinal)
    images[String(ordinal)] = image
  }

  const downloads: PublicContentLink[] = []
  for (const ref of snapshot.media?.downloads ?? []) {
    const file = typeof ref?.fileId === 'string' ? files.get(ref.fileId.toLowerCase()) : undefined
    if (!file) continue
    const meta = [optStr(ref.versionLabel), optStr(ref.fileDate)].filter(Boolean).join(' · ')
    downloads.push({
      key: `download-${downloads.length + 1}`,
      label: file.title?.trim() || file.filename_download || 'Download',
      meta: meta || null,
      href: publicMediaUrl(file.id, true),
    })
  }

  const ownPath = contentPublicPath(entry.type, entry.locale, entry.slug)
  const canonical = validateCanonicalPath(snapshot.seo?.canonicalPath)
  const hero = imageOf(snapshot.media?.hero, files)
  const og = imageOf(snapshot.media?.ogImage, files) ?? hero
  const related = [...relatedItems, ...relatedProductLinks]
  // A related / downloads section with nothing public to list is not rendered (no empty heading).
  const blocks = publicBlocks(snapshot, inlineOrdinal)
    .filter(block => (block.type !== 'related_content' || related.length > 0) && (block.type !== 'downloads' || downloads.length > 0))
    .map((block, index) => ({ ...block, id: `block-${index + 1}` }))

  return {
    type: entry.type.id,
    typeLabel: entry.type.label,
    locale: entry.locale,
    slug: entry.slug,
    title: snapshot.title.trim(),
    summary: str(snapshot.summary).trim(),
    publishedAt: entry.publishedAt,
    hero,
    blocks,
    images,
    downloads,
    related,
    seo: {
      title: optStr(snapshot.seo?.title)?.trim() ?? snapshot.title.trim(),
      description: optStr(snapshot.seo?.description)?.trim() ?? str(snapshot.summary).trim(),
      canonicalPath: canonical.ok && canonical.path ? canonical.path : ownPath,
      noindex: snapshot.seo?.noindex === true,
      ogImageUrl: og?.url ?? null,
    },
  }
}

/** `GET /api/cms/content/:type` — `null` means not public (404). Upstream failures throw (503). */
export async function listPublicContent(fetch: FetchFn, rawType: unknown, rawLocale: unknown, options: PublicContentOptions): Promise<PublicContentList | null> {
  const type = publicContentType(rawType, options)
  const locale = parsePublicLocale(rawLocale)
  if (!type || !locale) return null
  if (!options.contentFromDirectus) return { items: [] }
  const entries = await loadEligiblePublicContent(fetch, locale, [type], {}, options)
  const files = await resolvePublicFiles(fetch, entries.map(e => e.snapshot.media?.hero?.fileId).filter((id): id is string => typeof id === 'string'))
  return { items: entries.map(entry => cardOf(entry, files)) }
}

/** `GET /api/cms/content/:type/:slug` — exact type, exact locale, exact slug; `null` means 404. Upstream failures throw (503). */
export async function getPublicContentDetail(
  fetch: FetchFn,
  rawType: unknown,
  rawSlug: unknown,
  rawLocale: unknown,
  options: PublicContentOptions,
): Promise<PublicContentDetail | null> {
  const type = publicContentType(rawType, options)
  const locale = parsePublicLocale(rawLocale)
  if (!type || !locale || typeof rawSlug !== 'string' || !validateContentSlug(rawSlug).ok) return null
  if (!options.contentFromDirectus) return null
  const entries = await loadEligiblePublicContent(fetch, locale, [type], { slug: rawSlug, limit: 2 }, options)
  const entry = entries.find(e => e.slug === rawSlug)
  return entry ? buildPublicContentDetail(fetch, entry, options) : null
}

/** Public reader options from Nuxt runtime config (server-side only). */
export function publicContentOptionsFromConfig(config: { cmsMode?: unknown, productsCmsMode?: unknown, public?: { publishedLocales?: unknown } }): PublicContentOptions {
  const published = config.public?.publishedLocales
  return {
    publishedLocales: Array.isArray(published) ? published : [],
    contentFromDirectus: config.cmsMode === 'directus',
    productsFromDirectus: config.productsCmsMode === 'directus',
  }
}

/** Every site-published content locale, in registry order. */
export function publishedContentLocales(options: Pick<PublicContentOptions, 'publishedLocales'>): ContentLocale[] {
  return CONTENT_LOCALES.filter(locale => options.publishedLocales.includes(locale))
}
