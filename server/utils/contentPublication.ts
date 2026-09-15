import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { assertJsonObject } from './contentDraft'
import { validateBlocks } from './contentBlocks'
import { archivedAmong } from './contentMediaRelations'
import { CONTENT_BLOCK_LABELS, CONTENT_LOCALE_LABELS, contentLocaleState } from '../../utils/contentCenter'
import type { ContentBlock, ContentBlockType } from '../../utils/contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { effectiveSeoDescription, effectiveSeoTitle } from '../../utils/contentSeo'
import { validateContentSlug } from '../../utils/contentSlug'
import { getContentType, type ContentTypeDefinition, type ContentTypeId } from '../../utils/contentTypes'
import type {
  AdminContentLocaleDraft,
  AdminContentPreview,
  AdminContentPreviewMedia,
  AdminContentPreviewPublish,
  AdminContentPreviewRelation,
  AdminContentPublicationResult,
  ContentItemStatus,
  ContentPublicationOutcome,
  ContentPublishedSnapshot,
  ContentReadiness,
  ContentReadinessCheck,
  ContentSnapshotDownloadRef,
  ContentSnapshotFileRef,
} from '../../types/content-center'

/**
 * CC-IMP-06 — Content Center Preview, Readiness & manual Publish
 * (CONTENT-CENTER-BLUEPRINT-V1 §8, §11, §14, §15, §21–§23, §25, §31;
 * docs/project/RELEASE-SAFETY-GATES.md RSG-01, RSG-03, RSG-05, RSG-06).
 *
 * Three layers, so every decision is made from one consistent read:
 *   1. `loadPublicationContext` reads the item, its locale rows, file links (with
 *      Media Library visibility and lifecycle) and relations — no writes.
 *   2. Pure functions: `computeContentReadiness` (deterministic hard / soft
 *      checklist), `buildPublishedSnapshot` (explicit allowlist), and
 *      `planPublish` / `planUnpublish`, which decide the writes.
 *   3. `executePublicationPlan` performs those writes in order with the admin's
 *      own Directus session, so Directus activity / revisions record the admin.
 *
 * Publish is reachable only from the two admin action routes
 * (`…/locales/:locale/publish`, `…/unpublish`). Save, AI, Apply, readiness and
 * preview never call it. Readiness is always recomputed on the server; the
 * client's view of readiness is never trusted.
 *
 * Error convention: 400 invalid id · 404 unknown locale / item / locale draft ·
 * 409 stale `expectedDraftRevision` (`changed_since_review`) or archived item on
 * unpublish · 422 invalid body or hard readiness failure (`not_ready`) ·
 * 500 `partial` when a multi-step write stopped part-way (safe to retry).
 */

export const PUBLICATION_BODY_MAX_BYTES = 1024

type Row = Record<string, unknown>

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

// ── Context ─────────────────────────────────────────────────────────────────

export interface PublicationLocaleRow extends AdminContentLocaleDraft {
  published_snapshot: unknown
}

export interface PublicationFile {
  type: string | null
  filename_download: string | null
  title: string | null
  width: number | null
  height: number | null
  is_public: boolean
}

export interface PublicationFileLink {
  id: number
  role: string
  enabled: boolean
  sort: number | null
  fileId: string
  /** `null` when the Media Library file no longer exists. */
  file: PublicationFile | null
  alt: Partial<Record<ContentLocale, string | null>>
  caption: Partial<Record<ContentLocale, string | null>>
  language: string | null
  version_label: string | null
  file_date: string | null
}

export interface PublicationRelation {
  id: number
  relation_kind: 'product' | 'content'
  sort: number | null
  productId: number | null
  contentId: number | null
  productName: string | null
  productCode: string | null
  productStatus: string | null
  contentStatus: string | null
  contentTitles: Partial<Record<ContentLocale, string | null>>
}

export interface PublicationContext {
  item: {
    id: number
    content_type: string
    status: ContentItemStatus
    first_published_at: string | null
    archived_at: string | null
  }
  locales: PublicationLocaleRow[]
  files: PublicationFileLink[]
  archivedFileIds: Set<string>
  relations: PublicationRelation[]
  /** Locales whose slug is already used by another row of the same language. */
  slugTaken: Set<ContentLocale>
}

const LOCALE_FIELDS = [
  'id', 'content_items_id', 'locale', 'title', 'slug', 'summary', 'blocks',
  'seo_title', 'seo_description', 'canonical_path', 'noindex',
  'draft_revision', 'published_revision', 'published_at', 'first_published_at', 'last_change_kind', 'published_snapshot',
] as const

const FILE_FIELDS = [
  'id', 'content_items_id', 'file_role', 'enabled', 'sort', 'language', 'version_label', 'file_date',
  ...CONTENT_LOCALES.flatMap(l => [`alt_${l}`, `caption_${l}`]),
  'directus_files_id.id', 'directus_files_id.type', 'directus_files_id.filename_download', 'directus_files_id.title',
  'directus_files_id.width', 'directus_files_id.height', 'directus_files_id.is_public',
].join(',')

const RELATION_FIELDS = [
  'id', 'content_items_id', 'relation_kind', 'sort',
  'product_id.id', 'product_id.name_en', 'product_id.product_code', 'product_id.status',
  'related_content_id.id', 'related_content_id.status', 'related_content_id.locales.locale', 'related_content_id.locales.title',
].join(',')

const idOf = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  const id = (value as { id?: unknown } | null)?.id
  return typeof id === 'number' ? id : null
}

export async function loadPublicationContext(fetch: FetchFn, itemId: number): Promise<PublicationContext> {
  const fields = ['id', 'content_type', 'status', 'first_published_at', 'archived_at', ...LOCALE_FIELDS.map(f => `locales.${f}`)].join(',')
  const itemRes = await fetch<{ data: Array<Row & { locales?: Row[] }> }>(
    `/items/content_items?filter[id][_eq]=${itemId}&fields=${fields}&limit=1`,
  )
  const itemRow = (itemRes.data ?? [])[0]
  if (!itemRow) fail(404, `Content item ${itemId} not found.`)

  const locales = (itemRow.locales ?? [])
    .filter(row => row.content_items_id === itemId && isContentLocale(row.locale))
    .map((row) => {
      const out = {} as Row
      for (const key of LOCALE_FIELDS) out[key] = row[key] ?? null
      return out as unknown as PublicationLocaleRow
    })

  const [fileRes, relationRes] = await Promise.all([
    fetch<{ data: Row[] }>(`/items/content_items_files?filter[content_items_id][_eq]=${itemId}&fields=${FILE_FIELDS}&sort[]=sort&sort[]=id&limit=-1`),
    fetch<{ data: Row[] }>(`/items/content_relations?filter[content_items_id][_eq]=${itemId}&fields=${RELATION_FIELDS}&sort[]=sort&sort[]=id&limit=-1`),
  ])

  const files: PublicationFileLink[] = (fileRes.data ?? [])
    .filter(row => row.content_items_id === itemId || typeof row.content_items_id !== 'number')
    .map((row) => {
      const raw = row.directus_files_id
      const object = raw && typeof raw === 'object' ? raw as Row : null
      const fileId = String(typeof raw === 'string' ? raw : object?.id ?? '').toLowerCase()
      return {
        id: row.id as number,
        role: String(row.file_role),
        enabled: row.enabled !== false,
        sort: (row.sort as number | null) ?? null,
        fileId,
        file: object
          ? {
              type: (object.type as string | null) ?? null,
              filename_download: (object.filename_download as string | null) ?? null,
              title: (object.title as string | null) ?? null,
              width: (object.width as number | null) ?? null,
              height: (object.height as number | null) ?? null,
              is_public: object.is_public === true,
            }
          : null,
        alt: Object.fromEntries(CONTENT_LOCALES.map(l => [l, (row[`alt_${l}`] as string | null) ?? null])),
        caption: Object.fromEntries(CONTENT_LOCALES.map(l => [l, (row[`caption_${l}`] as string | null) ?? null])),
        language: (row.language as string | null) ?? null,
        version_label: (row.version_label as string | null) ?? null,
        file_date: (row.file_date as string | null) ?? null,
      }
    })

  const relations: PublicationRelation[] = (relationRes.data ?? [])
    .filter(row => row.content_items_id === itemId || typeof row.content_items_id !== 'number')
    .map((row) => {
      const product = row.product_id && typeof row.product_id === 'object' ? row.product_id as Row : null
      const content = row.related_content_id && typeof row.related_content_id === 'object' ? row.related_content_id as Row : null
      const titles = Array.isArray(content?.locales) ? content.locales as Array<{ locale: string, title: string | null }> : []
      return {
        id: row.id as number,
        relation_kind: row.relation_kind === 'content' ? 'content' : 'product',
        sort: (row.sort as number | null) ?? null,
        productId: row.relation_kind === 'product' ? idOf(row.product_id) : null,
        contentId: row.relation_kind === 'content' ? idOf(row.related_content_id) : null,
        productName: (product?.name_en as string | null) ?? null,
        productCode: (product?.product_code as string | null) ?? null,
        productStatus: (product?.status as string | null) ?? null,
        contentStatus: (content?.status as string | null) ?? null,
        contentTitles: Object.fromEntries(titles.filter(t => isContentLocale(t.locale)).map(t => [t.locale, t.title ?? null])),
      }
    })

  const referencedFileIds = files.filter(f => f.fileId).map(f => f.fileId)
  const archivedFileIds = await archivedAmong(fetch, referencedFileIds)

  const slugTaken = new Set<ContentLocale>()
  await Promise.all(locales.map(async (row) => {
    if (!validateContentSlug(row.slug).ok) return
    const res = await fetch<{ data: Array<{ id: number }> }>(
      `/items/content_item_locales?filter[locale][_eq]=${encodeURIComponent(row.locale)}`
      + `&filter[slug][_eq]=${encodeURIComponent(row.slug)}&fields=id&limit=2`,
    )
    if ((res.data ?? []).some(other => other.id !== row.id)) slugTaken.add(row.locale)
  }))

  return {
    item: {
      id: itemRow.id as number,
      content_type: String(itemRow.content_type),
      status: itemRow.status as ContentItemStatus,
      first_published_at: (itemRow.first_published_at as string | null) ?? null,
      archived_at: (itemRow.archived_at as string | null) ?? null,
    },
    locales,
    files,
    archivedFileIds,
    relations,
    slugTaken,
  }
}

// ── Media referenced by one language ─────────────────────────────────────────

export interface PublicationOptions {
  /** `runtimeConfig.public.publishedLocales`. */
  publishedLocales: readonly unknown[]
  /** Content type registry lookup; tests may inject an isolated registry. Defaults to `utils/contentTypes`. */
  resolveType?: (id: unknown) => ContentTypeDefinition | null
}

function typeOf(ctx: PublicationContext, options: PublicationOptions): ContentTypeDefinition | null {
  return (options.resolveType ?? getContentType)(ctx.item.content_type)
}

const localeRowOf = (ctx: PublicationContext, locale: ContentLocale) => ctx.locales.find(row => row.locale === locale) ?? null
const blocksOf = (row: PublicationLocaleRow | null): Array<Partial<ContentBlock>> =>
  Array.isArray(row?.blocks) ? row.blocks as Array<Partial<ContentBlock>> : []
const hasPublication = (row: PublicationLocaleRow) =>
  row.published_snapshot !== null || row.published_revision !== null || row.published_at !== null

interface ReferencedMedia {
  hero: PublicationFileLink | null
  og: PublicationFileLink | null
  /** Image section → its inline link (null when the link is gone or has another role). */
  images: Array<{ blockIndex: number, linkId: number, link: PublicationFileLink | null }>
  downloads: PublicationFileLink[]
}

/**
 * Download links that belong to `locale` under the CC-IMP-04 download language
 * contract (`all | en | es | pt`, Blueprint §11): an exact language match, or
 * `all` ("All languages"). An unset language or another language never counts —
 * there is no fallback (RSG-05).
 */
export function localeDownloads(ctx: PublicationContext, locale: ContentLocale): PublicationFileLink[] {
  return ctx.files.filter(f => f.role === 'download' && f.enabled && (f.language === locale || f.language === 'all'))
}

/** What this language would publish: enabled hero / OG image, the inline links its image sections use, and its own enabled downloads when it has a downloads section. */
function referencedMedia(ctx: PublicationContext, row: PublicationLocaleRow | null): ReferencedMedia {
  const blocks = blocksOf(row)
  const images: ReferencedMedia['images'] = []
  blocks.forEach((block, blockIndex) => {
    if (block?.type !== 'image') return
    const linkId = Number((block.data as { fileLinkId?: unknown } | undefined)?.fileLinkId)
    const link = ctx.files.find(f => f.id === linkId && f.role === 'inline') ?? null
    images.push({ blockIndex, linkId, link })
  })
  const hasDownloadsBlock = blocks.some(block => block?.type === 'downloads')
  return {
    hero: ctx.files.find(f => f.role === 'hero' && f.enabled) ?? null,
    og: ctx.files.find(f => f.role === 'og_image' && f.enabled) ?? null,
    images,
    downloads: hasDownloadsBlock && row ? localeDownloads(ctx, row.locale) : [],
  }
}

const fileLabel = (link: PublicationFileLink) =>
  link.file?.title?.trim() || link.file?.filename_download || `file ${link.fileId.slice(0, 8)}`

const ROLE_LABELS: Record<string, string> = { hero: 'Hero image', og_image: 'Open Graph image', inline: 'Inline image', download: 'Download' }

/** Every public-eligibility problem of the media this language would publish (RSG-06). */
function mediaIssues(ctx: PublicationContext, media: ReferencedMedia): string[] {
  const issues: string[] = []
  const seen = new Set<number>()
  const check = (link: PublicationFileLink) => {
    if (seen.has(link.id)) return
    seen.add(link.id)
    const role = ROLE_LABELS[link.role] ?? link.role
    if (!link.file || !link.fileId) issues.push(`${role}: the Media Library file no longer exists.`)
    else if (ctx.archivedFileIds.has(link.fileId)) issues.push(`${role} “${fileLabel(link)}” is archived in the Media Library.`)
    else if (!link.file.is_public) issues.push(`${role} “${fileLabel(link)}” is not public in the Media Library.`)
  }
  if (media.hero) check(media.hero)
  if (media.og) check(media.og)
  for (const image of media.images) {
    if (!image.link) issues.push(`Image section ${image.blockIndex + 1} uses a media link that no longer exists.`)
    else if (!image.link.enabled) issues.push(`Image section ${image.blockIndex + 1} uses a disabled media link.`)
    else check(image.link)
  }
  for (const download of media.downloads) check(download)
  return issues
}

// ── Readiness (Blueprint §21) ────────────────────────────────────────────────

/** A required plain-text value of a section is empty. Structure validity is `validateBlocks`. */
function incompleteSection(block: ContentBlock): boolean {
  const blank = (value: unknown) => typeof value !== 'string' || value.trim().length === 0
  const data = block.data as Row
  switch (block.type) {
    case 'text': return (data.paragraphs as unknown[]).some(blank)
    case 'key_points': return (data.items as Row[]).some(item => blank(item.title))
    case 'faq': return (data.items as Row[]).some(item => blank(item.question) || blank(item.answer))
    case 'cta': return blank(data.label) || blank(data.href)
    default: return false
  }
}

function sectionName(blocks: ContentBlock[], index: number): string {
  const type = blocks[index].type
  const ordinal = blocks.slice(0, index + 1).filter(b => b.type === type).length
  return `${CONTENT_BLOCK_LABELS[type]} ${ordinal}`
}

const pass = (key: string, label: string, detail: string | null = null): ContentReadinessCheck => ({ key, state: 'pass', label, detail })
const failCheck = (key: string, label: string, detail: string | null = null): ContentReadinessCheck => ({ key, state: 'fail', label, detail })
const warn = (key: string, label: string, detail: string | null = null): ContentReadinessCheck => ({ key, state: 'warn', label, detail })

/** Stable JSON, so a stored snapshot compares equal to a rebuilt one regardless of key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Row).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Row)[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b)
}

/**
 * Deterministic readiness of one language. Hard checks block Publish; soft checks
 * only warn. Evaluating it never writes and never publishes.
 */
export function computeContentReadiness(ctx: PublicationContext, locale: ContentLocale, options: PublicationOptions): ContentReadiness {
  const type = typeOf(ctx, options)
  const row = localeRowOf(ctx, locale)
  const localeLabel = CONTENT_LOCALE_LABELS[locale]
  const defaultLabel = CONTENT_LOCALE_LABELS[DEFAULT_CONTENT_LOCALE]
  const hard: ContentReadinessCheck[] = []
  const soft: ContentReadinessCheck[] = []
  /** Empty plain-text values the schema allows — a warning only (Review Fix 01: no hard rule the contract does not define). */
  let emptySections: string[] | null = null

  hard.push(ctx.item.status === 'archived'
    ? failCheck('item_not_archived', 'Content is archived', 'Archived content cannot be published.')
    : pass('item_not_archived', 'Content is not archived'))

  if (!row) {
    hard.push(failCheck('locale_started', `${localeLabel} has not been started`, 'Start this language in SEO & locales. Another language is never shown instead.'))
  } else {
    hard.push(row.title?.trim() ? pass('title', 'Title is present') : failCheck('title', 'Title is missing'))
    hard.push(row.summary?.trim() ? pass('summary', 'Summary is present') : failCheck('summary', 'Summary is missing', 'A summary is required to publish.'))

    const slug = validateContentSlug(row.slug)
    hard.push(!slug.ok
      ? failCheck('slug', 'URL slug is not valid', slug.message)
      : ctx.slugTaken.has(locale)
        ? failCheck('slug', 'URL slug is already used', `Another ${localeLabel} content item uses “${row.slug}”.`)
        : pass('slug', 'URL slug is valid and unique'))

    const validation = type ? validateBlocks(row.blocks, type.allowedBlocks) : { ok: false as const, errors: ['This content item has an unknown content type.'] }
    if (!validation.ok) {
      hard.push(failCheck('sections_valid', 'Sections are not valid', validation.errors.slice(0, 3).join(' ')))
    } else {
      hard.push(pass('sections_valid', 'Sections are valid'))
      emptySections = validation.blocks
        .map((block, index) => (incompleteSection(block) ? sectionName(validation.blocks, index) : null))
        .filter((name): name is string => Boolean(name))
      // Registry rule (Blueprint §7): the required block types are present.
      const missing = (type?.requiredBlocks ?? [])
        .filter(rule => validation.blocks.filter(block => block.type === rule.type).length < rule.min)
        .map(rule => `at least ${rule.min} ${CONTENT_BLOCK_LABELS[rule.type as ContentBlockType]} section${rule.min > 1 ? 's' : ''}`)
      hard.push(missing.length > 0
        ? failCheck('required_sections', 'Required sections are missing', `${type?.label ?? 'This type'} needs ${missing.join(' and ')}.`)
        : pass('required_sections', 'Required sections are present'))
    }

    const media = referencedMedia(ctx, row)
    if (type?.heroRequired) {
      hard.push(media.hero
        ? pass('hero', 'Hero image is linked')
        : failCheck('hero', 'Hero image is missing', `${type.label} requires an enabled hero image (Media & relations).`))
    }
    const issues = mediaIssues(ctx, media)
    hard.push(issues.length > 0
      ? failCheck('media_public', 'Some media cannot be published', issues.join(' '))
      : pass('media_public', 'Media to publish is public and active'))
    if (type?.requiresDownloadFile) {
      // This language's own enabled, publicly eligible download; another language's download never counts.
      const eligible = localeDownloads(ctx, locale).filter(f => f.file && f.fileId && f.file.is_public && !ctx.archivedFileIds.has(f.fileId))
      hard.push(eligible.length > 0
        ? pass('download_file', `An eligible ${localeLabel} download is linked`)
        : failCheck('download_file', `No eligible ${localeLabel} download`, `Resource / Download content needs at least one enabled, public download for ${localeLabel} or all languages.`))
    }
  }

  hard.push(type?.publicEnabled
    ? pass('type_public', `Public delivery is enabled for ${type.label}`)
    : failCheck('type_public', 'This content type is not enabled for public delivery yet.', 'Publishing stays blocked until public delivery for this content type is authorized.'))

  hard.push(options.publishedLocales.includes(locale)
    ? pass('locale_site_published', `${localeLabel} is published on the public site`)
    : failCheck('locale_site_published', `${localeLabel} is not enabled on the public site yet`, 'Languages are published only when the site publishes them.'))

  if (locale !== DEFAULT_CONTENT_LOCALE) {
    const defaultRow = localeRowOf(ctx, DEFAULT_CONTENT_LOCALE)
    hard.push(defaultRow?.published_snapshot && ctx.item.status === 'published'
      ? pass('default_locale_published', `The ${defaultLabel} version is published`)
      : failCheck('default_locale_published', `The ${defaultLabel} version is not published`, `Publish the ${defaultLabel} version first.`))
  }

  if (row) {
    const title = effectiveSeoTitle(row)
    const description = effectiveSeoDescription(row)
    if (emptySections) {
      soft.push(emptySections.length > 0
        ? warn('sections_complete', 'Some sections have empty text', `Check: ${emptySections.join(', ')}.`)
        : pass('sections_complete', 'Every section has text'))
    }
    soft.push(title.source === 'seo' ? pass('seo_title', 'SEO title set') : warn('seo_title', 'SEO title missing', 'The title is used instead.'))
    soft.push(description.source === 'seo' ? pass('seo_description', 'Meta description set') : warn('seo_description', 'Meta description missing', 'The summary is used instead.'))
    const media = referencedMedia(ctx, row)
    soft.push(media.og
      ? pass('og_image', 'Open Graph image set')
      : warn('og_image', 'No Open Graph image', media.hero ? 'The hero image is used for social previews.' : 'Social previews will have no image.'))
    soft.push(ctx.relations.length > 0 ? pass('relations', 'Related products or content linked') : warn('relations', 'No related products or content'))
    // Best-effort only (Blueprint §18): Content AI proposals do not exist yet, so none can be pending.
    soft.push(pass('ai_proposal', 'No unapplied AI proposal', 'Content AI is not available yet. This check never blocks publishing.'))
    soft.push(row.noindex ? warn('noindex', 'Noindex is on', 'Search engines will be asked not to index this page.') : pass('noindex', 'Indexing allowed'))
    const notStarted = CONTENT_LOCALES.filter(l => l !== locale && options.publishedLocales.includes(l) && !localeRowOf(ctx, l))
    soft.push(notStarted.length > 0
      ? warn('site_locales', 'Other site languages not started', notStarted.map(l => CONTENT_LOCALE_LABELS[l]).join(', '))
      : pass('site_locales', 'Every site language is started'))
    soft.push(hasUnpublishedChanges(ctx, row, options)
      ? warn('unpublished_changes', 'Unpublished changes exist', 'The published version stays unchanged until you publish again.')
      : pass('unpublished_changes', row.published_snapshot ? 'Published version is up to date' : 'Not published yet'))
  }

  return { locale, ready: hard.every(check => check.state === 'pass'), hard, soft }
}

function hasUnpublishedChanges(ctx: PublicationContext, row: PublicationLocaleRow, options: PublicationOptions): boolean {
  if (!row.published_snapshot) return false
  if (row.published_revision !== row.draft_revision) return true
  const type = typeOf(ctx, options)
  const validation = type ? validateBlocks(row.blocks, type.allowedBlocks) : null
  if (!validation?.ok) return true
  return !snapshotsEqual(row.published_snapshot, buildPublishedSnapshot(ctx, row.locale, options))
}

// ── Publication review fingerprint (Review Fix 01) ──────────────────────────

/**
 * Deterministic fingerprint of every stored input that decides this language's
 * readiness or published snapshot: item identity / lifecycle / type, the locale
 * working copy and its revision, slug availability, (for a translation) whether
 * the default language is published, publication-relevant media links with their
 * file visibility, lifecycle and download metadata, and relations. Media and
 * relation edits do not change `draft_revision`, so Publish must also match this
 * value — what a human reviewed is what gets published. No UI state is included;
 * `source_document` links are not a publication input.
 */
export function publicationInputFingerprint(ctx: PublicationContext, locale: ContentLocale): string {
  const row = localeRowOf(ctx, locale)
  const defaultRow = localeRowOf(ctx, DEFAULT_CONTENT_LOCALE)
  const input = {
    item: { id: ctx.item.id, contentType: ctx.item.content_type, status: ctx.item.status },
    locale,
    draft: row
      ? {
          title: row.title, slug: row.slug, summary: row.summary, blocks: row.blocks, seoTitle: row.seo_title,
          seoDescription: row.seo_description, canonicalPath: row.canonical_path, noindex: row.noindex, draftRevision: row.draft_revision,
        }
      : null,
    slugTaken: ctx.slugTaken.has(locale),
    defaultLocalePublished: locale === DEFAULT_CONTENT_LOCALE ? null : Boolean(defaultRow?.published_snapshot) && ctx.item.status === 'published',
    files: ctx.files
      .filter(f => f.role !== 'source_document')
      .sort((a, b) => a.id - b.id)
      .map(f => ({
        id: f.id, role: f.role, enabled: f.enabled, sort: f.sort, fileId: f.fileId, missing: !f.file,
        type: f.file?.type ?? null, isPublic: f.file?.is_public ?? null, archived: ctx.archivedFileIds.has(f.fileId),
        alt: f.alt[locale] ?? null, caption: f.caption[locale] ?? null,
        language: f.language, versionLabel: f.version_label, fileDate: f.file_date,
      })),
    relations: [...ctx.relations]
      .sort((a, b) => a.id - b.id)
      .map(r => ({ id: r.id, kind: r.relation_kind, productId: r.productId, contentId: r.contentId, sort: r.sort })),
  }
  return createHash('sha256').update(stableJson(input)).digest('hex').slice(0, 32)
}

// ── Snapshot (Blueprint §23) ─────────────────────────────────────────────────

function fileRef(link: PublicationFileLink, locale: ContentLocale): ContentSnapshotFileRef {
  return { linkId: link.id, fileId: link.fileId, alt: link.alt[locale] ?? null, caption: link.caption[locale] ?? null }
}

/**
 * The published snapshot of one language, built only from explicitly listed
 * fields of the current rows. Excluded by construction: `source_document` and
 * disabled links, draft revision / change-kind metadata, dates, users, AI,
 * readiness, history and any other Directus field. Call only after readiness
 * passed (blocks are valid for the type).
 */
export function buildPublishedSnapshot(ctx: PublicationContext, locale: ContentLocale, options: PublicationOptions): ContentPublishedSnapshot {
  const row = localeRowOf(ctx, locale)
  const type = typeOf(ctx, options)
  if (!row || !type) fail(422, 'This language cannot be published.', { code: 'not_ready' })
  const validation = validateBlocks(row.blocks, type.allowedBlocks)
  if (!validation.ok) fail(422, 'This language cannot be published.', { code: 'not_ready' })

  const media = referencedMedia(ctx, row)
  const hero = media.hero ? fileRef(media.hero, locale) : null
  const blocks = validation.blocks.map(block => ({ id: block.id, type: block.type, data: JSON.parse(JSON.stringify(block.data)) as Row }))
  const inlineSeen = new Set<number>()
  const inline: ContentSnapshotFileRef[] = []
  for (const image of media.images) {
    if (image.link && image.link.enabled && !inlineSeen.has(image.link.id)) {
      inlineSeen.add(image.link.id)
      inline.push(fileRef(image.link, locale))
    }
  }
  const downloads: ContentSnapshotDownloadRef[] = media.downloads.map(link => ({
    ...fileRef(link, locale),
    language: link.language,
    versionLabel: link.version_label,
    fileDate: link.file_date,
  }))
  const sorted = [...ctx.relations].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)

  return {
    version: 1,
    contentType: type.id as ContentTypeId,
    locale,
    publishedRevision: row.draft_revision,
    title: row.title.trim(),
    slug: row.slug,
    summary: (row.summary ?? '').trim(),
    blocks,
    seo: {
      title: effectiveSeoTitle(row).text,
      description: effectiveSeoDescription(row).text,
      canonicalPath: row.canonical_path ?? null,
      noindex: row.noindex === true,
    },
    media: { hero, ogImage: media.og ? fileRef(media.og, locale) : hero, inline, downloads },
    relations: {
      products: sorted.filter(r => r.relation_kind === 'product' && r.productId !== null).map(r => r.productId!),
      content: sorted.filter(r => r.relation_kind === 'content' && r.contentId !== null).map(r => r.contentId!),
    },
  }
}

// ── Plans ────────────────────────────────────────────────────────────────────

export type PublicationStep =
  | { collection: 'content_item_locales' | 'content_items', id: number, patch: Row }
  | { collection: 'content_item_locales', rows: Array<Row & { id: number }> }

export interface PublicationPlan {
  kind: 'publish' | 'unpublish'
  result: ContentPublicationOutcome
  steps: PublicationStep[]
}

const CLEARED_PUBLICATION = { published_snapshot: null, published_revision: null, published_at: null, last_change_kind: 'unpublish' }

export interface PublishReview {
  expectedDraftRevision: number
  expectedPublicationInputFingerprint: string
}

export function parsePublishBody(rawBody: unknown): PublishReview {
  const body = assertJsonObject(rawBody)
  const extra = Object.keys(body).filter(key => key !== 'expectedDraftRevision' && key !== 'expectedPublicationInputFingerprint')
  if (extra.length > 0) fail(422, `These fields cannot be set here: ${extra.join(', ')}.`, { rejectedFields: extra })
  const expected = body.expectedDraftRevision
  if (!Number.isInteger(expected) || (expected as number) < 1) {
    fail(422, 'expectedDraftRevision is required.', { field: 'expectedDraftRevision' })
  }
  const fingerprint = body.expectedPublicationInputFingerprint
  if (typeof fingerprint !== 'string' || !/^[0-9a-f]{32}$/.test(fingerprint)) {
    fail(422, 'expectedPublicationInputFingerprint is required.', { field: 'expectedPublicationInputFingerprint' })
  }
  return { expectedDraftRevision: expected as number, expectedPublicationInputFingerprint: fingerprint }
}

export function parseUnpublishBody(rawBody: unknown): void {
  if (rawBody === undefined || rawBody === null) return
  const body = assertJsonObject(rawBody)
  const extra = Object.keys(body)
  if (extra.length > 0) fail(422, `These fields cannot be set here: ${extra.join(', ')}.`, { rejectedFields: extra })
}

/**
 * Blueprint §23 write order: (1) the locale row's snapshot and publication
 * fields, then (2) for the default language the item status. Public exposure
 * needs both, so a failure between them exposes nothing and a retry finishes (2).
 * The same draft revision with an identical snapshot is `already_published`: no
 * second snapshot write, but (2) is still ensured.
 */
export function planPublish(
  ctx: PublicationContext,
  locale: ContentLocale,
  review: PublishReview,
  options: PublicationOptions,
  now: string,
): PublicationPlan {
  const row = localeRowOf(ctx, locale)
  if (!row) fail(404, `No ${locale} draft exists for content item ${ctx.item.id}.`)
  if (row.draft_revision !== review.expectedDraftRevision) {
    fail(409, 'This draft changed since it was reviewed. Reload and check it again before publishing.', {
      code: 'changed_since_review', currentDraftRevision: row.draft_revision,
    })
  }
  // Media, downloads, relations and file visibility can change without a new draft revision.
  const currentFingerprint = publicationInputFingerprint(ctx, locale)
  if (currentFingerprint !== review.expectedPublicationInputFingerprint) {
    fail(409, 'This content changed since it was reviewed (text, media or relations). Reload and check it again before publishing.', {
      code: 'changed_since_review', currentDraftRevision: row.draft_revision, currentPublicationInputFingerprint: currentFingerprint,
    })
  }
  const readiness = computeContentReadiness(ctx, locale, options)
  if (!readiness.ready) {
    fail(422, 'This language is not ready to publish.', { code: 'not_ready', blockers: readiness.hard.filter(check => check.state === 'fail') })
  }

  const snapshot = buildPublishedSnapshot(ctx, locale, options)
  const alreadyPublished = row.published_snapshot !== null
    && row.published_revision === row.draft_revision
    && snapshotsEqual(row.published_snapshot, snapshot)

  const steps: PublicationStep[] = []
  if (!alreadyPublished) {
    steps.push({
      collection: 'content_item_locales',
      id: row.id,
      patch: {
        published_snapshot: snapshot,
        published_revision: row.draft_revision,
        published_at: now,
        first_published_at: row.first_published_at ?? now,
        last_change_kind: 'publish',
      },
    })
  }
  if (locale === DEFAULT_CONTENT_LOCALE && (ctx.item.status !== 'published' || !ctx.item.first_published_at)) {
    steps.push({ collection: 'content_items', id: ctx.item.id, patch: { status: 'published', first_published_at: ctx.item.first_published_at ?? now } })
  }
  return { kind: 'publish', result: alreadyPublished ? 'already_published' : 'published', steps }
}

/**
 * Non-default language: clear only its publication fields. Default language:
 * set the item to `draft` first (nothing of the item is public from then on),
 * then clear every language's publication fields in one request, so a published
 * translation can never remain without a published default language.
 * The working copy, slug lock (`first_published_at`), media links and relations are kept.
 */
export function planUnpublish(ctx: PublicationContext, locale: ContentLocale): PublicationPlan {
  if (ctx.item.status === 'archived') fail(409, 'This content item is archived. Archived content is not public and cannot be unpublished here.')
  const row = localeRowOf(ctx, locale)
  if (!row) fail(404, `No ${locale} draft exists for content item ${ctx.item.id}.`)

  const steps: PublicationStep[] = []
  if (locale !== DEFAULT_CONTENT_LOCALE) {
    if (hasPublication(row)) steps.push({ collection: 'content_item_locales', id: row.id, patch: { ...CLEARED_PUBLICATION } })
  } else {
    if (ctx.item.status === 'published') steps.push({ collection: 'content_items', id: ctx.item.id, patch: { status: 'draft' } })
    const published = ctx.locales.filter(hasPublication)
    if (published.length > 0) {
      steps.push({ collection: 'content_item_locales', rows: published.map(r => ({ id: r.id, ...CLEARED_PUBLICATION })) })
    }
  }
  return { kind: 'unpublish', result: steps.length > 0 ? 'unpublished' : 'already_unpublished', steps }
}

/** Runs the plan in order. A failure after the first write is a 500 `partial` that a retry completes. */
export async function executePublicationPlan(fetch: FetchFn, plan: PublicationPlan): Promise<void> {
  let completed = 0
  try {
    for (const step of plan.steps) {
      if ('rows' in step) {
        await fetch(`/items/${step.collection}?fields=id`, { method: 'PATCH', body: step.rows })
      } else {
        await fetch(`/items/${step.collection}/${step.id}?fields=id`, { method: 'PATCH', body: step.patch })
      }
      completed++
    }
  } catch (err) {
    if (completed === 0) throw err
    fail(500, plan.kind === 'publish'
      ? 'Publishing stopped part-way. Nothing new is public yet — publish again to finish.'
      : 'Unpublishing stopped part-way. The content is no longer public — unpublish again to finish clearing it.', {
      partial: true, retryable: true, completedSteps: completed, totalSteps: plan.steps.length,
    })
  }
}

// ── Admin preview state ──────────────────────────────────────────────────────

function previewMedia(ctx: PublicationContext, link: PublicationFileLink, locale: ContentLocale): AdminContentPreviewMedia {
  return {
    link_id: link.id,
    role: link.role as AdminContentPreviewMedia['role'],
    directus_files_id: link.fileId,
    alt: link.alt[locale] ?? null,
    caption: link.caption[locale] ?? null,
    enabled: link.enabled,
    language: link.language,
    version_label: link.version_label,
    file_date: link.file_date,
    missing: !link.file || !link.fileId,
    file: link.file
      ? {
          filename_download: link.file.filename_download,
          title: link.file.title,
          type: link.file.type,
          width: link.file.width,
          height: link.file.height,
          is_public: link.file.is_public,
          archived: ctx.archivedFileIds.has(link.fileId),
        }
      : null,
  }
}

function previewOf(ctx: PublicationContext, row: PublicationLocaleRow): AdminContentPreview {
  const locale = row.locale
  const media = referencedMedia(ctx, row)
  const inlineSeen = new Set<number>()
  const inline: AdminContentPreviewMedia[] = []
  for (const image of media.images) {
    if (image.link && !inlineSeen.has(image.link.id)) {
      inlineSeen.add(image.link.id)
      inline.push(previewMedia(ctx, image.link, locale))
    }
  }
  const title = effectiveSeoTitle(row)
  const description = effectiveSeoDescription(row)
  const relations: AdminContentPreviewRelation[] = [...ctx.relations]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    .map(r => r.relation_kind === 'product'
      ? {
          id: r.id,
          relation_kind: 'product',
          label: [r.productName, r.productCode].filter(Boolean).join(' · ') || null,
          target_id: r.productId,
          status: r.productStatus,
        }
      : {
          id: r.id,
          relation_kind: 'content',
          // Only the previewed language's title — never another language's (RSG-05).
          label: r.contentTitles[locale] ?? null,
          target_id: r.contentId,
          status: r.contentStatus,
        })

  return {
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    blocks: blocksOf(row),
    seo: {
      title: title.text,
      title_source: title.source,
      description: description.text,
      description_source: description.source,
      canonical_path: row.canonical_path,
      noindex: row.noindex === true,
    },
    hero: media.hero ? previewMedia(ctx, media.hero, locale) : null,
    og_image: media.og ? previewMedia(ctx, media.og, locale) : null,
    inline,
    downloads: media.downloads.map(link => previewMedia(ctx, link, locale)),
    relations,
  }
}

export function buildPreviewPublishState(ctx: PublicationContext, locale: ContentLocale, options: PublicationOptions): AdminContentPreviewPublish {
  const type = typeOf(ctx, options)
  const row = localeRowOf(ctx, locale)
  const defaultRow = localeRowOf(ctx, DEFAULT_CONTENT_LOCALE)
  const canUnpublish = ctx.item.status !== 'archived' && Boolean(row) && (locale === DEFAULT_CONTENT_LOCALE
    ? ctx.item.status === 'published' || ctx.locales.some(hasPublication)
    : hasPublication(row!))

  return {
    item: {
      id: ctx.item.id,
      content_type: ctx.item.content_type as ContentTypeId,
      status: ctx.item.status,
      first_published_at: ctx.item.first_published_at,
      archived_at: ctx.item.archived_at,
      title: defaultRow?.title ?? ctx.locales[0]?.title ?? null,
    },
    type: {
      label: type?.label ?? 'Unknown type',
      public_enabled: type?.publicEnabled === true,
      hero_required: type?.heroRequired === true,
      requires_download_file: type?.requiresDownloadFile === true,
    },
    default_locale: DEFAULT_CONTENT_LOCALE,
    site_locales: [...CONTENT_LOCALES],
    published_locales: CONTENT_LOCALES.filter(l => options.publishedLocales.includes(l)),
    locale,
    locales: CONTENT_LOCALES.map((code) => {
      const r = localeRowOf(ctx, code)
      return {
        locale: code,
        started: Boolean(r),
        state: contentLocaleState(r),
        draft_revision: r?.draft_revision ?? null,
        published_revision: r?.published_revision ?? null,
        published_at: r?.published_at ?? null,
        first_published_at: r?.first_published_at ?? null,
      }
    }),
    preview: row ? previewOf(ctx, row) : null,
    readiness: computeContentReadiness(ctx, locale, options),
    publicationInputFingerprint: publicationInputFingerprint(ctx, locale),
    publication: {
      has_snapshot: Boolean(row?.published_snapshot),
      published_revision: row?.published_revision ?? null,
      published_at: row?.published_at ?? null,
      first_published_at: row?.first_published_at ?? null,
      unpublished_changes: row ? hasUnpublishedChanges(ctx, row, options) : false,
    },
    can_unpublish: canUnpublish,
  }
}

// ── Services used by the admin routes ────────────────────────────────────────

/** `?locale=` of the preview read: missing means the default language; anything else must be a site language. */
export function parsePreviewLocale(raw: unknown): ContentLocale {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null || value === '') return DEFAULT_CONTENT_LOCALE
  if (!isContentLocale(value)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })
  return value
}

function routeLocale(raw: unknown): ContentLocale {
  if (!isContentLocale(raw)) fail(404, 'Unknown locale.')
  return raw
}

export async function getContentPreviewPublish(fetch: FetchFn, itemId: number, rawLocale: unknown, options: PublicationOptions): Promise<AdminContentPreviewPublish> {
  const locale = parsePreviewLocale(rawLocale)
  return buildPreviewPublishState(await loadPublicationContext(fetch, itemId), locale, options)
}

export async function publishContentLocale(
  fetch: FetchFn,
  itemId: number,
  rawLocale: unknown,
  rawBody: unknown,
  options: PublicationOptions & { now?: () => string },
): Promise<AdminContentPublicationResult> {
  const locale = routeLocale(rawLocale)
  const review = parsePublishBody(rawBody)
  // Publication inputs are read again here, immediately before the plan and its writes.
  const ctx = await loadPublicationContext(fetch, itemId)
  const plan = planPublish(ctx, locale, review, options, (options.now ?? (() => new Date().toISOString()))())
  await executePublicationPlan(fetch, plan)
  return { result: plan.result, state: buildPreviewPublishState(await loadPublicationContext(fetch, itemId), locale, options) }
}

export async function unpublishContentLocale(
  fetch: FetchFn,
  itemId: number,
  rawLocale: unknown,
  rawBody: unknown,
  options: PublicationOptions,
): Promise<AdminContentPublicationResult> {
  const locale = routeLocale(rawLocale)
  parseUnpublishBody(rawBody)
  const ctx = await loadPublicationContext(fetch, itemId)
  const plan = planUnpublish(ctx, locale)
  await executePublicationPlan(fetch, plan)
  return { result: plan.result, state: buildPreviewPublishState(await loadPublicationContext(fetch, itemId), locale, options) }
}
