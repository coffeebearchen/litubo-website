import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { runSubjectProposalEngine, type AiSourceFileRow, type ProposalSubject } from './aiProposalEngine'
import type { AiProviderRegistry } from './aiProviderRegistry'
import { PROMPT_CONTRACT_VERSION, type ContentGenerationIdentity, type ContentGenerationInput } from './aiTargetContract'
import { contentSubjectKey } from './aiSubject'
import { createSourceRef, resolveSourceRefs, SourceRefUnavailableError } from './aiSourceRef'
import { claimGenerateSlot, releaseGenerateSlot } from './aiGenerateRateLimit'
import { buildContentAnalysisFingerprint, lookupAnalysis, readProposal, rememberAnalysis, type StoredProposal } from './aiProposalReplayGuard'
import { MAX_FILES_PER_REQUEST, MAX_IMAGES_PER_ANALYSIS, sanitizeDisplayNameForBrowser, type SourceReaders } from './aiTextExtraction'
import {
  CONTENT_DRAFT_TARGET_ID,
  createContentDraftTarget,
  type ContentBlockProposal,
  type ContentDraftModelOutput,
} from './aiTargets/contentDraftTarget'
import { assertJsonObject } from './contentDraft'
import { archivedAmong } from './contentMediaRelations'
import { aiSourceFormatFor, aiSourceFormatRefusal, aiSourceTypeLabel, sourceFailureMessage } from '../../utils/aiSourceFormats'
import { CONTENT_LOCALE_LABELS } from '../../utils/contentCenter'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale, type ContentLocale } from '../../utils/contentLocales'
import { CONTENT_MEDIA_ROLE_LABELS } from '../../utils/contentMediaRelations'
import { getContentType } from '../../utils/contentTypes'
import type {
  AdminContentAiAnalyzeResult,
  AdminContentAiSource,
  AdminContentAiSourceIntake,
  ContentAiSourceRole,
  ContentItemStatus,
} from '../../types/content-center'
import type { ContentTypeId } from '../../utils/contentTypes'

/**
 * CC-IMP-08 — Content AI Source Intake (CONTENT-CENTER-BLUEPRINT-V1 §16–§18;
 * Module Freeze §9, §14: CC-AI-01 is Analyze / session only).
 *
 * Reads, never writes content data. Every Content ↔ Media association is owned by
 * CC-03 Media & Relations; this module only lists the links that already exist
 * and lets one analysis read the selected ones:
 *
 *   eligible = a `content_items_files` row of THIS item · role source_document,
 *              download or inline · enabled · file exists · file not archived in
 *              the Media Library · format readable by the shared contract
 *
 * hero and og_image links, linked products' files, Product Workspace sources and
 * the rest of the Media Library are never sources.
 *
 * Analysis subject = content id + exact locale (`content:<id>:<locale>`), built on
 * the server from the route and the database. The browser sends only the locale
 * (validated against the site locales), a provider id and opaque source refs
 * minted for this admin and this subject. The single Proposal Engine does the
 * reading, limits, dedupe and the one provider call; the `content-draft` Target
 * validates the output; the proposal and its binding stay in the existing
 * in-memory replay guard. Nothing here writes `content_items`,
 * `content_item_locales`, `content_items_files`, `content_relations` or any
 * publication field, and there is no Apply.
 */

export const CONTENT_AI_SOURCE_ROLES: readonly ContentAiSourceRole[] = ['source_document', 'download', 'inline']
export const CONTENT_AI_ANALYZE_BODY_MAX_BYTES = 4 * 1024

const ANALYZE_KEYS = ['locale', 'providerId', 'sourceRefs']

const NOT_FOUND_ERROR = 'Content item not found.'
const ARCHIVED_ERROR = 'This content item is archived. Restore it to draft before analyzing sources.'
const LOCALE_NOT_STARTED_ERROR = 'This language has not been started yet. Start it in SEO & locales first.'
const SELECTION_INVALID_ERROR = 'This selection is no longer valid. Reload the page and choose the sources again.'
const SOURCES_UNAVAILABLE_ERROR = 'One or more selected sources are no longer available for analysis — they may have been unlinked, disabled or archived. Reload and choose again. Nothing was sent to the AI provider.'
const CHANGED_DURING_ANALYSIS_ERROR = 'This content item, its draft or its selected sources changed during the analysis. Nothing was prepared — reload and analyze again.'

const DISABLED_REASON = 'This file link is disabled for this content item. Enable it in Media & Relations first.'
const ARCHIVED_FILE_REASON = 'This file is archived in the Media Library, so it cannot be analyzed.'
const MISSING_FILE_REASON = 'This linked file no longer exists in the Media Library.'

type Row = Record<string, unknown>

function fail(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

interface ContentAiDraft {
  /** `date_updated` changes with every item-level write (Archive, Restore, Publish status); CC-IMP-09 binds it. */
  item: { id: number, content_type: string, status: ContentItemStatus, date_updated: string | null }
  row: {
    id: number
    locale: ContentLocale
    title: string | null
    slug: string | null
    summary: string | null
    seo_title: string | null
    seo_description: string | null
    blocks: Array<{ id: string, type: string, data: Record<string, unknown> }>
    draft_revision: number
  } | null
}

interface ContentFileRow extends AiSourceFileRow {
  content_items_id: number
  file_role: ContentAiSourceRole
  enabled: boolean
}

function parseLocale(raw: unknown, required: boolean): ContentLocale {
  if ((raw === undefined || raw === null || raw === '') && !required) return DEFAULT_CONTENT_LOCALE
  if (!isContentLocale(raw)) fail(422, 'locale must be one of the site locales.', { field: 'locale' })
  return raw
}

/** The working copy of one locale — never the published snapshot. */
async function loadDraft(fetch: FetchFn, itemId: number, locale: ContentLocale): Promise<ContentAiDraft | null> {
  const items = await fetch<{ data: Array<Row> }>(`/items/content_items?filter[id][_eq]=${itemId}&fields=id,content_type,status,date_updated&limit=1`)
  const item = (items.data ?? []).find(r => r.id === itemId)
  if (!item) return null
  const rows = await fetch<{ data: Array<Row> }>(
    `/items/content_item_locales?filter[content_items_id][_eq]=${itemId}&filter[locale][_eq]=${locale}`
    + '&fields=id,content_items_id,locale,title,slug,summary,seo_title,seo_description,blocks,draft_revision&limit=1',
  )
  const row = (rows.data ?? []).find(r => r.content_items_id === itemId && r.locale === locale)
  return {
    item: {
      id: itemId,
      content_type: String(item.content_type),
      status: item.status as ContentItemStatus,
      date_updated: typeof item.date_updated === 'string' ? item.date_updated : null,
    },
    row: row
      ? {
          id: row.id as number,
          locale,
          title: (row.title as string | null) ?? null,
          slug: (row.slug as string | null) ?? null,
          summary: (row.summary as string | null) ?? null,
          seo_title: (row.seo_title as string | null) ?? null,
          seo_description: (row.seo_description as string | null) ?? null,
          blocks: Array.isArray(row.blocks) ? row.blocks as Array<{ id: string, type: string, data: Record<string, unknown> }> : [],
          draft_revision: Number(row.draft_revision),
        }
      : null,
  }
}

async function loadStartedLocales(fetch: FetchFn, itemId: number): Promise<ContentLocale[]> {
  const res = await fetch<{ data: Array<Row> }>(`/items/content_item_locales?filter[content_items_id][_eq]=${itemId}&fields=content_items_id,locale&limit=20`)
  const started = new Set((res.data ?? []).filter(r => r.content_items_id === itemId).map(r => r.locale))
  return CONTENT_LOCALES.filter(l => started.has(l))
}

/** Only this item's links in the three source roles; `ids` narrows to a selection. */
async function loadSourceLinks(fetch: FetchFn, itemId: number, ids?: number[]): Promise<ContentFileRow[]> {
  const idFilter = ids ? `&filter[id][_in]=${ids.join(',')}` : ''
  const res = await fetch<{ data: ContentFileRow[] }>(
    `/items/content_items_files?filter[content_items_id][_eq]=${itemId}&filter[file_role][_in]=${CONTENT_AI_SOURCE_ROLES.join(',')}${idFilter}`
    + '&fields=id,content_items_id,file_role,enabled,directus_files_id.id,directus_files_id.filename_download,directus_files_id.type,directus_files_id.filesize'
    + `&sort[]=sort&sort[]=id&limit=${ids ? ids.length : 200}`,
  )
  return (res.data ?? []).filter(row => row.content_items_id === itemId && CONTENT_AI_SOURCE_ROLES.includes(row.file_role))
}

async function archivedFilesOf(fetch: FetchFn, rows: ContentFileRow[]): Promise<Set<string>> {
  const ids = rows.map(r => r.directus_files_id?.id ?? '').filter(Boolean)
  const archived = await archivedAmong(fetch, ids)
  return new Set([...archived].map(id => id.toLowerCase()))
}

/** Why a linked file cannot be analyzed, or null when it can. Format wording comes from the shared contract. */
function unavailableReason(row: ContentFileRow, archived: Set<string>): string | null {
  const file = row.directus_files_id
  if (!file?.id) return MISSING_FILE_REASON
  if (archived.has(file.id.toLowerCase())) return ARCHIVED_FILE_REASON
  const refusal = aiSourceFormatRefusal(file.type)
  if (refusal) return sourceFailureMessage(refusal, file.type)
  if (row.enabled !== true) return DISABLED_REASON
  return null
}

async function loadLinkedProducts(fetch: FetchFn, itemId: number): Promise<Array<{ name: string, code: string | null }>> {
  const res = await fetch<{ data: Array<{ content_items_id: number, product_id: { id: number, name_en?: string | null, product_code?: unknown } | null }> }>(
    `/items/content_relations?filter[content_items_id][_eq]=${itemId}&filter[relation_kind][_eq]=product`
    + '&fields=content_items_id,product_id.id,product_id.name_en,product_id.product_code&sort[]=sort&sort[]=id&limit=-1',
  )
  return (res.data ?? [])
    .filter(r => r.content_items_id === itemId && r.product_id)
    .map(r => ({
      name: r.product_id!.name_en ?? `Product ${r.product_id!.id}`,
      code: typeof r.product_id!.product_code === 'string' && r.product_id!.product_code.trim() !== '' ? r.product_id!.product_code : null,
    }))
}

function textOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(textOf)
  if (value && typeof value === 'object') return Object.entries(value).filter(([k]) => k !== 'href').flatMap(([, v]) => textOf(v))
  return []
}

function identityOf(draft: ContentAiDraft, locale: ContentLocale, linkedProducts: Array<{ name: string, code: string | null }>): ContentGenerationIdentity {
  const row = draft.row!
  return {
    contentTypeLabel: getContentType(draft.item.content_type)?.label ?? draft.item.content_type,
    locale,
    localeLabel: CONTENT_LOCALE_LABELS[locale],
    title: row.title ?? '',
    slug: row.slug ?? '',
    summary: row.summary,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    blocks: row.blocks.map(b => ({ id: String(b.id), type: String(b.type), preview: textOf(b.data).join(' ').slice(0, 300) })),
    linkedProducts,
  }
}

// ── Stored proposal and its binding (Blueprint §18) ─────────────────────────

export interface ContentAiProposalItem {
  proposalItemId: string
  target: string
  operation: 'set' | 'replace' | 'insert'
  /** Captured by the server from the working copy at analysis time; null for an inserted section. */
  existingValue: string | ContentBlockProposal | null
  proposedValue: string | ContentBlockProposal
  /** `Source N` → display name only; no page, row or cell locator. */
  evidence: Array<{ label: string, displayName: string | null }>
}

export interface ContentAiProposalConflict {
  proposalItemId: string
  target: string
  existingValue: string | null
  candidateValues: string[]
}

export interface ContentAiProposal {
  items: ContentAiProposalItem[]
  conflicts: ContentAiProposalConflict[]
  /** CC-IMP-09 — every source read in this analysis (`Source N` → display name), for the Review page. */
  sources: Array<{ label: string, displayName: string | null }>
}

/** Server-held binding CC-IMP-09 Apply must match (subject, locale, draft revision, items, fingerprint, prompt version). */
export interface ContentProposalBinding {
  subject: { kind: 'content', id: number, locale: ContentLocale }
  draftRevision: number
  /** CC-IMP-09 — the item's `date_updated` at analysis; Archive / Restore / Publish status changes invalidate the proposal. */
  itemUpdatedAt: string | null
  targetId: typeof CONTENT_DRAFT_TARGET_ID
  items: Array<{ proposalItemId: string, target: string, operation: 'set' | 'replace' | 'insert' }>
  sourceFingerprint: string
  promptContractVersion: number
}

const FIELD_OF: Record<string, 'title' | 'summary' | 'seo_title' | 'seo_description'> = {
  'field:title': 'title',
  'field:summary': 'summary',
  'field:seo_title': 'seo_title',
  'field:seo_description': 'seo_description',
}

function buildStoredProposal(output: ContentDraftModelOutput, draft: ContentAiDraft, readNames: string[]): ContentAiProposal {
  const row = draft.row!
  const evidenceOf = (labels: string[]) => labels.map(label => ({ label, displayName: readNames[Number(label.slice('Source '.length)) - 1] ?? null }))
  let n = 0
  const nextId = () => `item-${++n}`
  const items: ContentAiProposalItem[] = output.changes.map((change) => {
    if (change.operation === 'set') {
      return { proposalItemId: nextId(), target: change.target, operation: 'set', existingValue: row[FIELD_OF[change.target]!] ?? null, proposedValue: change.value, evidence: evidenceOf(change.sources) }
    }
    if (change.operation === 'replace') {
      const id = change.target.slice('block:'.length)
      const existing = row.blocks.find(b => String(b.id).toLowerCase() === id)
      return {
        proposalItemId: nextId(), target: change.target, operation: 'replace',
        existingValue: existing ? { type: existing.type as ContentBlockProposal['type'], data: existing.data } : null,
        proposedValue: change.block, evidence: evidenceOf(change.sources),
      }
    }
    return { proposalItemId: nextId(), target: 'block:new', operation: 'insert', existingValue: null, proposedValue: change.block, evidence: evidenceOf(change.sources) }
  })
  const conflicts = output.conflicts.map(c => ({
    proposalItemId: nextId(), target: c.target, existingValue: row[FIELD_OF[c.target]!] ?? null, candidateValues: c.candidateValues,
  }))
  const sources = readNames.map((displayName, index) => ({ label: `Source ${index + 1}`, displayName }))
  return { items, conflicts, sources }
}

// ── Subject ─────────────────────────────────────────────────────────────────

function createContentProposalSubject(
  fetch: FetchFn,
  itemId: number,
  locale: ContentLocale,
  draft: ContentAiDraft,
  identity: ContentGenerationIdentity,
): ProposalSubject<ContentGenerationInput> {
  const draftRevision = draft.row!.draft_revision
  let resolved: ContentFileRow[] = []

  async function eligibleLinks(ids: number[]): Promise<ContentFileRow[]> {
    const rows = await loadSourceLinks(fetch, itemId, ids)
    const archived = await archivedFilesOf(fetch, rows)
    return rows.filter(row => unavailableReason(row, archived) === null)
  }

  return {
    key: contentSubjectKey(itemId, locale),
    missingSourcesError: SOURCES_UNAVAILABLE_ERROR,
    async precheck() {
      const current = await loadDraft(fetch, itemId, locale)
      if (!current) return NOT_FOUND_ERROR
      if (current.item.status === 'archived') return ARCHIVED_ERROR
      if (!current.row) return LOCALE_NOT_STARTED_ERROR
      if (current.row.draft_revision !== draftRevision) return CHANGED_DURING_ANALYSIS_ERROR
      if (current.item.date_updated !== draft.item.date_updated) return CHANGED_DURING_ANALYSIS_ERROR
      return null
    },
    async resolveSources(ids) {
      resolved = await eligibleLinks(ids)
      return resolved
    },
    async buildInput(sources) {
      return {
        content: identity,
        sourceFileSummaries: sources.map(s => ({ displayName: s.displayName, fileType: s.fileType })),
        extractedSourceTexts: sources.map(s => ({ displayName: s.displayName, text: s.text })),
      }
    },
    async fingerprint({ targetId, providerId, sourceDigests, rows }) {
      return buildContentAnalysisFingerprint({
        contentItemId: itemId,
        locale,
        draftRevision,
        targetId,
        providerId,
        promptContractVersion: PROMPT_CONTRACT_VERSION,
        identity: { content: identity, itemUpdatedAt: draft.item.date_updated },
        sources: rows.map(r => ({
          linkId: r.id,
          fileId: r.directus_files_id?.id ?? '',
          role: String(r.file_role),
          enabled: r.enabled === true,
          archived: false,
          type: r.directus_files_id?.type ?? null,
          filesize: r.directus_files_id?.filesize == null ? null : Number(r.directus_files_id.filesize),
        })),
        sourceDigests,
      })
    },
    async verifyUnchanged() {
      const current = await loadDraft(fetch, itemId, locale)
      if (!current || current.item.status === 'archived' || !current.row || current.row.draft_revision !== draftRevision
        || current.item.date_updated !== draft.item.date_updated) {
        return CHANGED_DURING_ANALYSIS_ERROR
      }
      if (resolved.length === 0) return null
      const now = new Map((await eligibleLinks(resolved.map(r => r.id))).map(r => [r.id, r]))
      for (const before of resolved) {
        const after = now.get(before.id)
        if (!after || after.file_role !== before.file_role || after.enabled !== before.enabled
          || after.directus_files_id?.id !== before.directus_files_id?.id) {
          return CHANGED_DURING_ANALYSIS_ERROR
        }
      }
      return null
    },
  }
}

// ── Read: already-linked sources for one locale ─────────────────────────────

export async function getContentAiSourceIntake(
  fetch: FetchFn,
  itemId: number,
  rawLocale: unknown,
  adminUserId: string,
): Promise<AdminContentAiSourceIntake> {
  const locale = parseLocale(rawLocale, false)
  const draft = await loadDraft(fetch, itemId, locale)
  if (!draft) fail(404, `Content item ${itemId} not found.`)
  const startedLocales = await loadStartedLocales(fetch, itemId)

  let sources: AdminContentAiSource[] = []
  if (draft.row) {
    const links = await loadSourceLinks(fetch, itemId)
    const archived = await archivedFilesOf(fetch, links)
    const subjectKey = contentSubjectKey(itemId, locale)
    try {
      sources = links.map((row) => {
        const reason = unavailableReason(row, archived)
        return {
          sourceRef: createSourceRef(row.id, { subjectKey, adminUserId }),
          displayName: sanitizeDisplayNameForBrowser(row.directus_files_id?.filename_download ?? null),
          typeLabel: aiSourceTypeLabel(row.directus_files_id?.type ?? null),
          role: row.file_role,
          roleLabel: CONTENT_MEDIA_ROLE_LABELS[row.file_role],
          analyzable: reason === null,
          unavailableReason: reason,
          isImage: aiSourceFormatFor(row.directus_files_id?.type ?? null)?.key === 'image',
        }
      })
    } catch (error) {
      if (error instanceof SourceRefUnavailableError) fail(503, 'AI source selection is unavailable on this server.')
      throw error
    }
  }

  return {
    item: {
      id: itemId,
      content_type: draft.item.content_type as ContentTypeId,
      status: draft.item.status,
      title: draft.row?.title ?? null,
    },
    locale,
    default_locale: DEFAULT_CONTENT_LOCALE,
    site_locales: [...CONTENT_LOCALES],
    started_locales: startedLocales,
    locale_started: draft.row !== null,
    draft_revision: draft.row?.draft_revision ?? null,
    sources,
    limits: { max_files: MAX_FILES_PER_REQUEST, max_images: MAX_IMAGES_PER_ANALYSIS },
  }
}

// ── Analyze: one analysis, one provider call, one in-memory proposal ────────

export interface ContentAiAnalyzeOptions {
  readers?: SourceReaders
}

export async function analyzeContentAiSources(
  fetch: FetchFn,
  registry: AiProviderRegistry,
  itemId: number,
  rawBody: unknown,
  adminUserId: string,
  options: ContentAiAnalyzeOptions = {},
): Promise<AdminContentAiAnalyzeResult> {
  const body = assertJsonObject(rawBody)
  const extra = Object.keys(body).filter(key => !ANALYZE_KEYS.includes(key))
  if (extra.length > 0) fail(422, `These fields cannot be set here: ${extra.join(', ')}.`, { rejectedFields: extra })
  const locale = parseLocale(body.locale, true)

  const draft = await loadDraft(fetch, itemId, locale)
  if (!draft) fail(404, `Content item ${itemId} not found.`)
  if (draft.item.status === 'archived') fail(409, ARCHIVED_ERROR, { code: 'archived' })
  if (!draft.row) fail(409, LOCALE_NOT_STARTED_ERROR, { code: 'locale_not_started' })
  const type = getContentType(draft.item.content_type)
  if (!type) fail(409, 'This content item has an unknown content type.')

  const subjectKey = contentSubjectKey(itemId, locale)
  let mediaIds: number[] | null
  try {
    mediaIds = resolveSourceRefs(body.sourceRefs, { subjectKey, adminUserId }, MAX_FILES_PER_REQUEST)
  } catch (error) {
    if (error instanceof SourceRefUnavailableError) fail(503, 'AI source selection is unavailable on this server.')
    throw error
  }
  if (mediaIds === null) return { ok: false, error: SELECTION_INVALID_ERROR, fileResults: [] }

  const slot = claimGenerateSlot(adminUserId, subjectKey)
  if (!slot.allowed) {
    fail(429, slot.reason === 'in-flight'
      ? 'An analysis is already running for this content language. Wait for it to finish.'
      : 'Please wait a moment before analyzing this content language again.', { retryAfterSeconds: slot.retryAfterSeconds })
  }

  try {
    const identity = identityOf(draft, locale, await loadLinkedProducts(fetch, itemId))
    const target = createContentDraftTarget({
      allowedBlocks: type.allowedBlocks,
      blocks: draft.row.blocks.map(b => ({ id: String(b.id), type: String(b.type) })),
    })
    const subject = createContentProposalSubject(fetch, itemId, locale, draft, identity)
    const providerId = String(body.providerId ?? '')
    const scopeFor = (fingerprint: string) => ({ adminUserId, subjectKey, targetId: CONTENT_DRAFT_TARGET_ID, providerId, fingerprint })
    const hit: { value: { proposalRef: string, proposal: ContentAiProposal, alreadyApplied: boolean } | null } = { value: null }

    const result = await runSubjectProposalEngine(fetch, registry, target, subject, { providerId: body.providerId, mediaIds }, {
      lookup: (fingerprint) => {
        const found = lookupAnalysis<ContentAiProposal>(scopeFor(fingerprint))
        if (!found) return null
        hit.value = { proposalRef: found.proposalRef, proposal: found.output, alreadyApplied: found.alreadyApplied }
        return found.output as unknown as ContentDraftModelOutput
      },
      // The proposal and its reference are stored together below.
      store: () => {},
    }, options.readers)

    if (!result.ok) return { ok: false, error: result.error, fileResults: result.fileResults }

    let proposalRef: string
    let proposal: ContentAiProposal
    if (hit.value) {
      proposalRef = hit.value.proposalRef
      proposal = hit.value.proposal
    } else {
      const readNames = result.fileResults.filter(f => f.status === 'read').map(f => f.displayName)
      proposal = buildStoredProposal(result.output, draft, readNames)
      const binding: ContentProposalBinding = {
        subject: { kind: 'content', id: itemId, locale },
        draftRevision: draft.row.draft_revision,
        itemUpdatedAt: draft.item.date_updated,
        targetId: CONTENT_DRAFT_TARGET_ID,
        items: [...proposal.items, ...proposal.conflicts.map(c => ({ ...c, operation: 'set' as const }))]
          .map(i => ({ proposalItemId: i.proposalItemId, target: i.target, operation: i.operation })),
        sourceFingerprint: result.fingerprint,
        promptContractVersion: PROMPT_CONTRACT_VERSION,
      }
      proposalRef = rememberAnalysis(scopeFor(result.fingerprint), proposal, Date.now(), binding)
    }

    return {
      ok: true,
      proposalRef,
      reused: result.reused,
      alreadyApplied: hit.value?.alreadyApplied ?? false,
      item_count: proposal.items.length,
      conflict_count: proposal.conflicts.length,
      draft_revision: draft.row.draft_revision,
      fileResults: result.fileResults,
    }
  } finally {
    releaseGenerateSlot(adminUserId, subjectKey)
  }
}

/**
 * A stored content proposal for the same admin, content item and locale only —
 * the read path CC-IMP-09 builds on. `null` for anything else (unknown, expired,
 * restart, another admin, item or locale).
 */
export function getContentAiProposal(
  proposalRef: unknown,
  access: { adminUserId: string, itemId: number, locale: ContentLocale },
): StoredProposal<ContentAiProposal, ContentProposalBinding> | null {
  return readProposal<ContentAiProposal, ContentProposalBinding>(proposalRef, {
    adminUserId: access.adminUserId,
    subjectKey: contentSubjectKey(access.itemId, access.locale),
  })
}
