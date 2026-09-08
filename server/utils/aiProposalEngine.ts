import {
  extractTextFromFile,
  isSupportedTextSourceMime,
  capTotalCharacters,
  MAX_FILES_PER_REQUEST,
  MAX_TOTAL_EXTRACTED_CHARS,
  type ExtractedSource,
} from './aiTextExtraction'
import { isAiProviderId, type AiProviderId, type AiProviderRegistry, type GenerateSpecificationProposalInput } from './aiProviderRegistry'
import type { SpecificationProposal } from './aiSpecificationProposal'
import type { FetchFn } from './mediaLifecycle'

/**
 * PWS-AI-ENGINE-01 — reusable server-side AI Proposal Engine.
 *
 * Dependency-injected (`fetch: FetchFn`, `registry: AiProviderRegistry`) in
 * the same style as `mediaLifecycle.ts`/`productEvidenceLinks.ts`, so the
 * full engine — current-product validation, source↔product re-verification,
 * restricted text extraction, single-provider dispatch, structured-response
 * validation, safe error handling — is unit-testable with a mock Directus
 * fetch and a mock provider registry, without a real Nitro event or a real
 * network call anywhere in this module.
 *
 * Deliberately generic in shape even though only one Target —
 * `specifications` — is registered this round: a future Target would add
 * its own prompt-building + result shape here; the product/source/provider
 * plumbing below does not change.
 *
 * Nothing in this file ever returns a Directus file UUID, a storage path, a
 * download URL, a locator, an internal note, the raw extracted text, or a
 * provider's raw response to its caller — only the final validated
 * `SpecificationProposal` (or a short, safe error) and a per-file readable/
 * unsupported/unreadable summary keyed by display name.
 */

export type SourceFileStatus = 'read' | 'unsupported' | 'unreadable'

export interface SourceFileOutcome {
  displayName: string
  status: SourceFileStatus
  reason?: string
}

export type ProposalEngineResult =
  | { ok: true, proposal: SpecificationProposal, fileResults: SourceFileOutcome[] }
  | { ok: false, error: string, fileResults: SourceFileOutcome[] }

interface ProductsFilesRow {
  id: number
  directus_files_id: {
    id: string
    filename_download: string | null
    type: string | null
  } | null
}

async function assertProductExistsViaFetch(fetch: FetchFn, productId: number): Promise<boolean> {
  const result = await fetch<{ data: { id: number }[] }>(
    `/items/products?filter[id][_eq]=${productId}&fields=id&limit=1`,
  )
  return (result.data ?? []).length > 0
}

/**
 * Resolves the given `products_files` row ids (never a raw Directus file
 * UUID accepted from the client) to their linked file metadata, scoped
 * strictly to this product. Any id that does not belong to this product is
 * simply absent from the result — never leaked as "found but wrong owner".
 */
async function resolveProductSourceFiles(
  fetch: FetchFn,
  productId: number,
  mediaIds: number[],
): Promise<ProductsFilesRow[]> {
  const idsParam = mediaIds.join(',')
  const result = await fetch<{ data: ProductsFilesRow[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}&filter[id][_in]=${idsParam}` +
    '&fields=id,directus_files_id.id,directus_files_id.filename_download,directus_files_id.type' +
    `&limit=${mediaIds.length}`,
  )
  return result.data ?? []
}

async function fetchProductName(fetch: FetchFn, productId: number): Promise<string> {
  const result = await fetch<{ data: { name_en: string } | null }>(
    `/items/products/${productId}?fields=name_en`,
  )
  return result.data?.name_en ?? 'This product'
}

const NOT_FOUND_ERROR = 'Product not found.'
const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const NO_SELECTION_ERROR = 'Select at least one source file to analyze.'
const NO_READABLE_SOURCES_ERROR = 'None of the selected files could be read as text. Nothing was sent to the AI provider.'

/**
 * The single generation entry point for the `specifications` Target.
 * `mediaIds` are `products_files.id` values only — this function never
 * accepts, trusts, or forwards a raw Directus file UUID from the caller.
 */
export async function runSpecificationProposalEngine(
  fetch: FetchFn,
  registry: AiProviderRegistry,
  params: { productId: number, providerId: unknown, mediaIds: unknown },
): Promise<ProposalEngineResult> {
  const productExists = await assertProductExistsViaFetch(fetch, params.productId)
  if (!productExists) {
    return { ok: false, error: NOT_FOUND_ERROR, fileResults: [] }
  }

  if (!isAiProviderId(params.providerId)) {
    return { ok: false, error: NOT_CONFIGURED_ERROR, fileResults: [] }
  }
  const providerId: AiProviderId = params.providerId

  if (!Array.isArray(params.mediaIds) || params.mediaIds.length === 0) {
    return { ok: false, error: NO_SELECTION_ERROR, fileResults: [] }
  }
  const mediaIds = [...new Set(
    params.mediaIds.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0),
  )]
  if (mediaIds.length === 0) {
    return { ok: false, error: NO_SELECTION_ERROR, fileResults: [] }
  }
  if (mediaIds.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `You can analyze at most ${MAX_FILES_PER_REQUEST} files at a time.`, fileResults: [] }
  }

  // Re-verify server-side that the requested provider is actually configured
  // and allowed — never trust the client's own claim, and check this before
  // doing any file work so an unconfigured provider never triggers extraction.
  const summary = registry.listConfiguredProviders().find(p => p.id === providerId)
  if (!summary || !summary.configured) {
    return { ok: false, error: NOT_CONFIGURED_ERROR, fileResults: [] }
  }

  const rows = await resolveProductSourceFiles(fetch, params.productId, mediaIds)
  const rowById = new Map(rows.map(r => [r.id, r]))

  const fileResults: SourceFileOutcome[] = []
  const readableSources: ExtractedSource[] = []

  for (const mediaId of mediaIds) {
    const row = rowById.get(mediaId)
    if (!row || !row.directus_files_id) {
      fileResults.push({
        displayName: `Selection #${mediaId}`,
        status: 'unreadable',
        reason: 'This file is not associated with this product.',
      })
      continue
    }
    const displayName = row.directus_files_id.filename_download ?? 'Untitled file'
    const mime = row.directus_files_id.type

    if (!isSupportedTextSourceMime(mime)) {
      fileResults.push({ displayName, status: 'unsupported', reason: 'Not available for text-source analysis yet.' })
      continue
    }

    let bytes: ArrayBuffer
    try {
      bytes = await fetch<ArrayBuffer>(`/assets/${row.directus_files_id.id}`, { responseType: 'arrayBuffer' })
    } catch {
      fileResults.push({ displayName, status: 'unreadable', reason: 'This file could not be read.' })
      continue
    }

    const extraction = await extractTextFromFile(bytes, mime, displayName)
    if (!extraction.ok) {
      fileResults.push({ displayName, status: 'unreadable', reason: extraction.reason })
      continue
    }
    fileResults.push({ displayName, status: 'read' })
    readableSources.push(extraction.source)
  }

  if (readableSources.length === 0) {
    return { ok: false, error: NO_READABLE_SOURCES_ERROR, fileResults }
  }

  const cappedSources = capTotalCharacters(readableSources, MAX_TOTAL_EXTRACTED_CHARS)
  const productName = await fetchProductName(fetch, params.productId)

  const input: GenerateSpecificationProposalInput = {
    productName,
    sourceFileSummaries: cappedSources.map(s => ({ displayName: s.displayName, fileType: s.fileType })),
    extractedSourceTexts: cappedSources.map(s => ({ displayName: s.displayName, text: s.text })),
  }

  const result = await registry.generateSpecificationProposal(providerId, input)
  if (!result.ok) return { ok: false, error: result.error, fileResults }
  return { ok: true, proposal: result.proposal, fileResults }
}
