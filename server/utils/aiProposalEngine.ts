import {
  extractTextFromFile,
  isSupportedTextSourceMime,
  isFormerlyUnsupportedTextSourceMime,
  isFileSizeSafeToDownload,
  sanitizeDisplayNameForBrowser,
  capTotalCharacters,
  MAX_FILES_PER_REQUEST,
  MAX_FILE_BYTES,
  MAX_TOTAL_EXTRACTED_CHARS,
  type ExtractedSource,
} from './aiTextExtraction'
import { isAiProviderId, type AiProviderId, type AiProviderRegistry } from './aiProviderRegistry'
import type { AiGenerationInput, TargetDefinition } from './aiTargetContract'
import type { FetchFn } from './mediaLifecycle'

/**
 * PWS-AI-ENGINE-01R — reusable server-side AI Proposal Engine, Target-neutral.
 *
 * Dependency-injected (`fetch: FetchFn`, `registry: AiProviderRegistry`) in
 * the same style as `mediaLifecycle.ts`/`productEvidenceLinks.ts`, so the
 * full engine — current-product validation, source↔product re-verification,
 * restricted text extraction, single-provider dispatch, structured-response
 * validation, safe error handling — is unit-testable with a mock Directus
 * fetch and a mock provider registry, without a real Nitro event or a real
 * network call anywhere in this module.
 *
 * Genuinely Target-neutral: `runProposalEngine()` takes a `TargetDefinition<T>`
 * as a parameter and never imports or references `specifications` (or any
 * other Target) by name. See `tests/aiTargetContract.test.ts` for a
 * purely test-only second Target proving this — that test never touches
 * this file, `aiTextExtraction.ts`, or the provider registry.
 *
 * Nothing in this file ever returns a Directus file UUID, a storage path, a
 * download URL, a locator, an internal note, the raw extracted text, or a
 * provider's raw response to its caller — only the final validated Target
 * output (or a short, safe error) and a per-file readable/unsupported/
 * unreadable summary keyed by a sanitized display name (see
 * `sanitizeDisplayNameForBrowser()`). A media id that does not resolve to an
 * enabled row of the current product is reported with a generic reason and
 * never echoes the requested id back to the caller.
 *
 * PWS-AI-ENGINE-01R2-SAFETY-01 — the real Directus `filename_download` never
 * reaches the AI provider at all, regardless of how safe it looks: every
 * source handed to a Target's `buildUserInput()`/`buildSourceMaterialBlock()`
 * is labeled with a neutral, server-generated position label ("Source 1",
 * "Source 2", ...) instead, so a crafted filename can never act as a prompt
 * instruction or a `--- Source: ... ---` delimiter-injection vector. The
 * (separately sanitized) real name is only ever used for the browser-facing
 * `fileResults` summary, never for anything sent to a model.
 */

export type SourceFileStatus = 'read' | 'unsupported' | 'unreadable'

export interface SourceFileOutcome {
  displayName: string
  status: SourceFileStatus
  reason?: string
}

export type ProposalEngineResult<TOutput> =
  | { ok: true, output: TOutput, fileResults: SourceFileOutcome[] }
  | { ok: false, error: string, fileResults: SourceFileOutcome[] }

interface ProductsFilesRow {
  id: number
  directus_files_id: {
    id: string
    filename_download: string | null
    type: string | null
    filesize: number | string | null
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
 * strictly to this product AND to rows the editor itself would treat as
 * usable (`enabled = true`). Any id that does not belong to this product,
 * or belongs to it but is disabled, is simply absent from the result —
 * never leaked as "found but wrong owner/disabled".
 */
async function resolveProductSourceFiles(
  fetch: FetchFn,
  productId: number,
  mediaIds: number[],
): Promise<ProductsFilesRow[]> {
  const idsParam = mediaIds.join(',')
  const result = await fetch<{ data: ProductsFilesRow[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}&filter[id][_in]=${idsParam}&filter[enabled][_eq]=true` +
    '&fields=id,directus_files_id.id,directus_files_id.filename_download,directus_files_id.type,directus_files_id.filesize' +
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

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — a single asset download may not run
 * longer than this. The trusted-metadata size check still runs BEFORE any
 * byte is requested and remains the first line of defence; this deadline
 * bounds what that check cannot see — a response that is slow, stalled, or
 * endless.
 */
export const MAX_ASSET_DOWNLOAD_MS = 15_000

/**
 * Streams an asset, counting bytes as they arrive and aborting the request
 * the instant the ceiling is passed or the deadline expires.
 *
 * The previous version awaited a complete `arrayBuffer` and only then checked
 * its length, so a server that ignored its own declared `filesize` could make
 * this process buffer an arbitrarily large response before anything objected;
 * the "deadline" likewise only stopped the caller waiting, while the transfer
 * continued in the background. Now an `AbortController` cancels the HTTP
 * request itself in both cases, and no more than `MAX_FILE_BYTES` is ever
 * held. `tests/aiProposalEngine.test.ts` asserts the abort signal actually
 * fires and that reading stops mid-stream rather than draining the source.
 */
const DOWNLOAD_TIMED_OUT = Symbol('asset-download-timed-out')

async function downloadSourceBytes(fetch: FetchFn, fileUuid: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  // Resolves once, at the deadline. Raced against every await below so the
  // deadline holds even if the transport ignores the abort signal — aborting
  // a controller does not, on its own, settle a pending read.
  const timedOut = new Promise<typeof DOWNLOAD_TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(DOWNLOAD_TIMED_OUT)
    }, MAX_ASSET_DOWNLOAD_MS)
  })

  try {
    const stream = await Promise.race([
      fetch<ReadableStream<Uint8Array>>(`/assets/${fileUuid}`, {
        responseType: 'stream',
        signal: controller.signal,
      }),
      timedOut,
    ])
    if (stream === DOWNLOAD_TIMED_OUT) return null
    if (!stream || typeof stream.getReader !== 'function') return null

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    try {
      for (;;) {
        const next = await Promise.race([reader.read(), timedOut])
        if (next === DOWNLOAD_TIMED_OUT) {
          await reader.cancel().catch(() => {})
          return null
        }
        const { done, value } = next
        if (done) break
        if (!value) continue
        received += value.byteLength
        if (received > MAX_FILE_BYTES) {
          // Stop the transfer rather than read on to discover how big it was.
          controller.abort()
          await reader.cancel().catch(() => {})
          return null
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock?.()
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return merged.buffer as ArrayBuffer
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const NOT_FOUND_ERROR = 'Product not found.'
const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const NO_SELECTION_ERROR = 'Select at least one source file to analyze.'
const NO_READABLE_SOURCES_ERROR = 'None of the selected files could be read as text. Nothing was sent to the AI provider.'
const NOT_ASSOCIATED_REASON = 'One of the selected files could not be used for this product.'

/**
 * The single generation entry point, for whichever `TargetDefinition` the
 * caller supplies. `mediaIds` are `products_files.id` values only — this
 * function never accepts, trusts, or forwards a raw Directus file UUID from
 * the caller.
 */
export async function runProposalEngine<TOutput>(
  fetch: FetchFn,
  registry: AiProviderRegistry,
  target: TargetDefinition<TOutput>,
  params: { productId: number, providerId: unknown, mediaIds: unknown },
): Promise<ProposalEngineResult<TOutput>> {
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
  // Reject an oversized raw array BEFORE any Set/filter work runs over it —
  // a client sending an enormous mediaIds array must not spend server CPU
  // deduping/filtering it first just to be told it was too long anyway.
  if (params.mediaIds.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `You can analyze at most ${MAX_FILES_PER_REQUEST} files at a time.`, fileResults: [] }
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
  // Assigned only to files that actually reach extraction — a neutral,
  // positional label ("Source 1", "Source 2", ...) is what the AI provider
  // sees in place of the real filename; see the module docstring above.
  let promptSourceCounter = 0

  for (const mediaId of mediaIds) {
    const row = rowById.get(mediaId)
    if (!row || !row.directus_files_id) {
      // Deliberately generic — never echoes the requested media id back to the caller.
      fileResults.push({ displayName: 'Selected file', status: 'unreadable', reason: NOT_ASSOCIATED_REASON })
      continue
    }
    // Browser-facing only — sanitized real name (or a generic fallback for
    // anything anomalous). Never passed to `extractTextFromFile()` /
    // the AI provider; see `promptLabel` below.
    const browserDisplayName = sanitizeDisplayNameForBrowser(row.directus_files_id.filename_download)
    const mime = row.directus_files_id.type

    if (isFormerlyUnsupportedTextSourceMime(mime)) {
      fileResults.push({ displayName: browserDisplayName, status: 'unsupported', reason: 'Excel files are not supported for text-source analysis yet.' })
      continue
    }
    if (!isSupportedTextSourceMime(mime)) {
      fileResults.push({ displayName: browserDisplayName, status: 'unsupported', reason: 'Not available for text-source analysis yet.' })
      continue
    }

    // Trusted-metadata size pre-check — happens BEFORE any byte is downloaded.
    const knownSize = row.directus_files_id.filesize == null ? null : Number(row.directus_files_id.filesize)
    if (!isFileSizeSafeToDownload(knownSize)) {
      fileResults.push({ displayName: browserDisplayName, status: 'unreadable', reason: 'This file is too large to analyze, or its size could not be confirmed.' })
      continue
    }

    let bytes: ArrayBuffer | null
    try {
      bytes = await downloadSourceBytes(fetch, row.directus_files_id.id)
    } catch {
      bytes = null
    }
    if (!bytes) {
      fileResults.push({ displayName: browserDisplayName, status: 'unreadable', reason: 'This file could not be read.' })
      continue
    }

    promptSourceCounter += 1
    const promptLabel = `Source ${promptSourceCounter}`
    const extraction = await extractTextFromFile(bytes, mime, promptLabel)
    if (!extraction.ok) {
      fileResults.push({ displayName: browserDisplayName, status: 'unreadable', reason: extraction.reason })
      continue
    }
    fileResults.push({ displayName: browserDisplayName, status: 'read' })
    readableSources.push(extraction.source)
  }

  if (readableSources.length === 0) {
    return { ok: false, error: NO_READABLE_SOURCES_ERROR, fileResults }
  }

  const cappedSources = capTotalCharacters(readableSources, MAX_TOTAL_EXTRACTED_CHARS)
  const productName = await fetchProductName(fetch, params.productId)

  const input: AiGenerationInput = {
    productName,
    sourceFileSummaries: cappedSources.map(s => ({ displayName: s.displayName, fileType: s.fileType })),
    extractedSourceTexts: cappedSources.map(s => ({ displayName: s.displayName, text: s.text })),
  }

  const result = await registry.generateStructured(providerId, target, input)
  if (!result.ok) return { ok: false, error: result.error, fileResults }
  return { ok: true, output: result.output, fileResults }
}
