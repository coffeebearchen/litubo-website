import {
  extractTextFromFile,
  isFileSizeSafeToDownload,
  sanitizeDisplayNameForBrowser,
  capTotalCharacters,
  MAX_FILES_PER_REQUEST,
  MAX_IMAGES_PER_ANALYSIS,
  MAX_PER_FILE_CHARS,
  MAX_TOTAL_EXTRACTED_CHARS,
  type ExtractedSource,
  type SourceReaders,
} from './aiTextExtraction'
import { aiSourceFormatFor, aiSourceFormatRefusal, sourceFailureMessage, type SourceFailureCode } from '../../utils/aiSourceFormats'
import { digestSourceText, buildAnalysisFingerprint } from './aiProposalReplayGuard'
import { isAiProviderId, type AiProviderId, type AiProviderRegistry } from './aiProviderRegistry'
import { PROMPT_CONTRACT_VERSION, type AiGenerationInput, type AiGenerationInputBase, type TargetDefinition } from './aiTargetContract'
import { productSubjectKey } from './aiSubject'
import { archivedAmong } from './contentMediaRelations'
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
 *
 * AI-SOURCE-CONTRACT-01 — which formats may be read, how large each may be,
 * and the sentence a person sees when a source is not read all come from the
 * shared format contract (`utils/aiSourceFormats.ts`); this engine keeps no
 * format list and no refusal wording of its own. The reading stage of one
 * analysis also runs on a single clock (`MAX_TOTAL_EXTRACTION_MS`): a source
 * that clock does not reach is reported as not read, and whatever was read
 * still goes to the provider.
 *
 * AI-PDF-SOURCE-01 — a PDF is read by the document-extractor sidecar through
 * the `readers` the caller passes in. That read spends the same clock: it gets
 * no more time than the stage has left, and a PDF becomes one more
 * `ExtractedSource` in the same dedupe, the same character cap and the same
 * single provider call as every other source.
 *
 * AI-XLSX-SOURCE-01 — an .xlsx workbook is read in this process by a bounded
 * streaming reader that may narrow a sheet to the current product's exact code,
 * so the product's identity is fetched as soon as a workbook needs it — still
 * once per analysis. A workbook is also told the most text it may produce: its
 * share of the combined character cap. The combined cap would otherwise cut its
 * text, and a workbook's text is refused rather than cut.
 */

/**
 * PWS-AI-DUP-GUARD-01 — `duplicate` means the file WAS readable, but its
 * extracted text is byte-identical to another file already selected in this
 * same request, so it was left out of the prompt rather than paid for twice.
 * It is not an error and must not be presented as one.
 */
export type SourceFileStatus = 'read' | 'duplicate' | 'unsupported' | 'unreadable'

export interface SourceFileOutcome {
  displayName: string
  status: SourceFileStatus
  reason?: string
}

export type ProposalEngineResult<TOutput> =
  | {
      ok: true
      output: TOutput
      fileResults: SourceFileOutcome[]
      /** Server-only identity of this analysis; see `buildAnalysisFingerprint`. Never derived from a filename or a Directus id. */
      fingerprint: string
      /** True when the validated output came from the short-term cache and no provider was called. */
      reused: boolean
    }
  | { ok: false, error: string, fileResults: SourceFileOutcome[] }

/**
 * PWS-AI-DUP-GUARD-01 — lets the caller serve an identical analysis from its
 * own short-term cache instead of paying for it again. The engine still does
 * all the free work (download, extract, dedupe) because that is precisely how
 * it establishes the sources are unchanged; only the provider call is skipped.
 */
export interface ProposalReuseHooks<TOutput> {
  lookup(fingerprint: string): TOutput | null
  store(fingerprint: string, output: TOutput): void
}

/**
 * One association row the engine may read (`products_files` or, CC-IMP-08,
 * `content_items_files`): its id and the linked file's trusted metadata. A
 * content subject also returns the role and enabled state it resolved the row
 * with, so the analysis fingerprint can bind them.
 */
export interface AiSourceFileRow {
  id: number
  file_role?: string | null
  enabled?: boolean | null
  directus_files_id: {
    id: string
    filename_download: string | null
    type: string | null
    filesize: number | string | null
  } | null
}

/**
 * CC-IMP-08 — the subject of one analysis (Blueprint §17: one engine, generalized
 * subject). Everything the engine used to hard-code for a product — does the
 * subject exist, which association rows it owns, who it is in the prompt, what
 * the fingerprint binds — is supplied here, built on the server from the route
 * and the database. The reading pipeline, limits, dedupe, provider dispatch and
 * validation below stay one shared implementation.
 */
export interface ProposalSubject<TInput extends AiGenerationInputBase> {
  /** `product:<id>` or `content:<id>:<locale>`. */
  key: string
  /** Null when this subject can be analyzed now; otherwise a short, safe error. Runs before anything else. */
  precheck(): Promise<string | null>
  /** Resolves requested association ids to rows of THIS subject only. Rows it does not own are simply absent. */
  resolveSources(ids: number[]): Promise<AiSourceFileRow[]>
  /**
   * When set, a requested id that does not resolve (another item, disabled, wrong role, archived, unreadable)
   * refuses the whole analysis with this message before anything is downloaded.
   */
  missingSourcesError?: string
  /** A workbook may be narrowed to this code while it is read (product subject only). */
  extractionProductCode?: () => Promise<string | null>
  /** The provider input for the readable, capped sources. */
  buildInput(sources: ExtractedSource[]): Promise<TInput>
  /** The analysis fingerprint (see `buildAnalysisFingerprint` / `buildContentAnalysisFingerprint`). */
  fingerprint(parts: { targetId: string, providerId: AiProviderId, sourceDigests: string[], rows: AiSourceFileRow[] }): Promise<string>
  /** Re-checked right before the provider call and again before a result is returned; a non-null error fails closed. */
  verifyUnchanged?(): Promise<string | null>
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
 *
 * FINAL-RELEASE-FIX-F — a file ARCHIVED in the Media Library is excluded too.
 * Content AI has always applied that rule; Product AI did not, so a file a
 * person had archived could still be selected, downloaded and sent to a paid
 * provider. `media_file_lifecycle.archived` is the one archive state there is,
 * and this reads it through the same helper the Media Library and Content AI
 * use. Exported because Apply re-runs exactly this resolution before writing.
 */
export async function resolveProductSourceFiles(
  fetch: FetchFn,
  productId: number,
  mediaIds: number[],
): Promise<AiSourceFileRow[]> {
  if (mediaIds.length === 0) return []
  const idsParam = mediaIds.join(',')
  const result = await fetch<{ data: AiSourceFileRow[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}&filter[id][_in]=${idsParam}&filter[enabled][_eq]=true` +
    '&fields=id,directus_files_id.id,directus_files_id.filename_download,directus_files_id.type,directus_files_id.filesize' +
    `&limit=${mediaIds.length}`,
  )
  const rows = result.data ?? []
  const archived = await archivedAmong(fetch, rows.map(row => row.directus_files_id?.id ?? '').filter(Boolean))
  return archived.size === 0 ? rows : rows.filter(row => !archived.has(row.directus_files_id?.id ?? ''))
}

/**
 * PRODUCT-MODEL-RELEVANCE-GUARD-01 — the current product's identity as the
 * prompt and the fingerprint see it: its English name, and its product code
 * when it has one.
 *
 * Read-only, and only these two columns. The code is taken exactly as stored —
 * never created, filled in or corrected here — and a blank or non-string code
 * counts as no code. `model_or_series` is deliberately not read: it can name a
 * series or platform shared by several models, which must never pass for this
 * one product's identity.
 */
async function fetchProductIdentity(
  fetch: FetchFn,
  productId: number,
): Promise<{ productName: string, productCode: string | null }> {
  const result = await fetch<{ data: { name_en?: string | null, product_code?: unknown } | null }>(
    `/items/products/${productId}?fields=name_en,product_code`,
  )
  const rawCode = result.data?.product_code
  return {
    productName: result.data?.name_en ?? 'This product',
    productCode: typeof rawCode === 'string' && rawCode.trim() !== '' ? rawCode : null,
  }
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
 * AI-SOURCE-CONTRACT-01 — the reading stage of one analysis, taken as a whole,
 * may not run longer than this.
 *
 * Sources are downloaded and read one after another, and each download already
 * has its own deadline — but five of them back to back could still outlast the
 * Generate endpoint's single-flight slot (`MAX_INFLIGHT_MS`, 120 s). Once that
 * slot counts as abandoned, a second paid analysis of the same product can
 * start while the first is still running. Sixty seconds of reading plus the
 * provider's own call deadline stays inside the slot with room to spare, a
 * relationship `tests/aiProposalEngine.test.ts` checks against both provider
 * adapters.
 *
 * A source the clock does not reach is reported as not read; the sources that
 * were read still go to the analysis, exactly as with any other unreadable file.
 */
export const MAX_TOTAL_EXTRACTION_MS = 60_000

export interface ExtractionBudget {
  /** Milliseconds left in this analysis's reading stage — zero once spent, never negative. */
  remainingMs(): number
}

/** Starts the reading-stage clock. `now` is injectable so the arithmetic can be tested without waiting. */
export function createExtractionBudget(
  totalMs: number = MAX_TOTAL_EXTRACTION_MS,
  now: () => number = () => Date.now(),
): ExtractionBudget {
  const deadline = now() + totalMs
  return { remainingMs: () => Math.max(0, deadline - now()) }
}

/**
 * Streams an asset, counting bytes as they arrive and aborting the request
 * the instant the ceiling is passed or the deadline expires.
 *
 * The previous version awaited a complete `arrayBuffer` and only then checked
 * its length, so a server that ignored its own declared `filesize` could make
 * this process buffer an arbitrarily large response before anything objected;
 * the "deadline" likewise only stopped the caller waiting, while the transfer
 * continued in the background. Now an `AbortController` cancels the HTTP
 * request itself in both cases, and no more than the format's own `maxBytes`
 * is ever held. `tests/aiProposalEngine.test.ts` asserts the abort signal
 * actually fires and that reading stops mid-stream rather than draining the
 * source.
 */
const DOWNLOAD_TIMED_OUT = Symbol('asset-download-timed-out')

async function downloadSourceBytes(
  fetch: FetchFn,
  fileUuid: string,
  limits: { maxBytes: number, timeoutMs: number },
): Promise<ArrayBuffer | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  // Resolves once, at the deadline. Raced against every await below so the
  // deadline holds even if the transport ignores the abort signal — aborting
  // a controller does not, on its own, settle a pending read.
  const timedOut = new Promise<typeof DOWNLOAD_TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(DOWNLOAD_TIMED_OUT)
    }, limits.timeoutMs)
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
          // Deliberately NOT awaited: `cancel()` is itself a call into the
          // transport, and a transport that has already stopped responding can
          // leave it pending forever — which would make the deadline that just
          // fired meaningless. Ask it to stop, then return.
          void reader.cancel().catch(() => {})
          return null
        }
        const { done, value } = next
        if (done) break
        if (!value) continue
        received += value.byteLength
        if (received > limits.maxBytes) {
          // Stop the transfer rather than read on to discover how big it was.
          // `cancel()` is not awaited for the same reason as above.
          controller.abort()
          void reader.cancel().catch(() => {})
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
const IMAGE_LIMIT_ERROR = `Select up to ${MAX_IMAGES_PER_ANALYSIS} images per analysis.`
const DUPLICATE_CONTENT_REASON = 'Duplicate content excluded from analysis.'

/**
 * A source that did not reach the analysis. Its reason is worded by the shared
 * contract, never here; a format refusal reads as `unsupported`, anything else
 * as `unreadable`.
 */
function notAnalyzed(displayName: string, code: SourceFailureCode, mimeType?: string | null): SourceFileOutcome {
  return {
    displayName,
    status: code === 'unsupported' || code === 'not_enabled' ? 'unsupported' : 'unreadable',
    reason: sourceFailureMessage(code, mimeType),
  }
}

/**
 * The Product AI subject — exactly the product behaviour the engine had before
 * CC-IMP-08: existence check, `products_files` rows of this product that are
 * enabled, `name_en` / `product_code` read once, the product fingerprint, and the
 * workbook narrowed to the product code.
 */
export function createProductProposalSubject(fetch: FetchFn, productId: number): ProposalSubject<AiGenerationInput> {
  // AI-XLSX-SOURCE-01 — read once, when first needed: a workbook asks for the
  // code while it is being read, and the prompt needs the identity afterwards.
  let identity: ReturnType<typeof fetchProductIdentity> | null = null
  const productIdentity = () => (identity ??= fetchProductIdentity(fetch, productId))
  return {
    key: productSubjectKey(productId),
    precheck: async () => (await assertProductExistsViaFetch(fetch, productId)) ? null : NOT_FOUND_ERROR,
    resolveSources: ids => resolveProductSourceFiles(fetch, productId, ids),
    extractionProductCode: async () => (await productIdentity()).productCode,
    async buildInput(sources) {
      const { productName, productCode } = await productIdentity()
      return {
        productName,
        productCode,
        sourceFileSummaries: sources.map(s => ({ displayName: s.displayName, fileType: s.fileType })),
        extractedSourceTexts: sources.map(s => ({ displayName: s.displayName, text: s.text })),
      }
    },
    /**
     * The identity of this analysis, computed from what will actually be sent:
     * the product, the Target, the provider, the product name and code, the
     * version of the shared prompt contract, and the content digests of the
     * unique sources. It carries no filename, no Directus id, no sourceRef and no
     * source text.
     *
     * PRODUCT-MODEL-RELEVANCE-GUARD-01 — the code and the contract version are
     * both part of it: a product whose code changes is a different analysis, and
     * an analysis made before the relevance guard existed can never be served as
     * though it had been made with it.
     */
    async fingerprint({ targetId, providerId, sourceDigests }) {
      const { productName, productCode } = await productIdentity()
      return buildAnalysisFingerprint({
        productId,
        targetId,
        providerId,
        productName,
        productCode,
        promptContractVersion: PROMPT_CONTRACT_VERSION,
        sourceDigests,
      })
    },
  }
}

/**
 * The single Product AI generation entry point, unchanged for its callers.
 * `mediaIds` are `products_files.id` values only — this function never accepts,
 * trusts, or forwards a raw Directus file UUID from the caller.
 */
export async function runProposalEngine<TOutput>(
  fetch: FetchFn,
  registry: AiProviderRegistry,
  target: TargetDefinition<TOutput>,
  params: { productId: number, providerId: unknown, mediaIds: unknown },
  reuse?: ProposalReuseHooks<TOutput>,
  readers?: SourceReaders,
): Promise<ProposalEngineResult<TOutput>> {
  return runSubjectProposalEngine(
    fetch, registry, target, createProductProposalSubject(fetch, params.productId),
    { providerId: params.providerId, mediaIds: params.mediaIds }, reuse, readers,
  )
}

/**
 * CC-IMP-08 — the one engine, for whichever subject and Target the caller
 * supplies. `mediaIds` are association row ids of that subject only.
 */
export async function runSubjectProposalEngine<TOutput, TInput extends AiGenerationInputBase>(
  fetch: FetchFn,
  registry: AiProviderRegistry,
  target: TargetDefinition<TOutput, TInput>,
  subject: ProposalSubject<TInput>,
  params: { providerId: unknown, mediaIds: unknown },
  reuse?: ProposalReuseHooks<TOutput>,
  readers?: SourceReaders,
): Promise<ProposalEngineResult<TOutput>> {
  const precheckError = await subject.precheck()
  if (precheckError) {
    return { ok: false, error: precheckError, fileResults: [] }
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

  const rows = await subject.resolveSources(mediaIds)
  const rowById = new Map(rows.map(r => [r.id, r]))

  // CC-IMP-08 — a subject that requires every selected source (Content AI) refuses a
  // selection it cannot fully resolve before anything is downloaded or sent.
  if (subject.missingSourcesError && mediaIds.some(mediaId => !rowById.get(mediaId)?.directus_files_id)) {
    return { ok: false, error: subject.missingSourcesError, fileResults: [] }
  }

  // AI-IMAGE-OCR-SOURCE-01 — the image limit is the server's, whatever the browser
  // allowed. It is counted from the files' own stored types before anything is
  // downloaded, and an analysis over it does not start at all.
  const selectedImages = mediaIds.filter(mediaId => aiSourceFormatFor(rowById.get(mediaId)?.directus_files_id?.type)?.key === 'image').length
  if (selectedImages > MAX_IMAGES_PER_ANALYSIS) {
    return { ok: false, error: IMAGE_LIMIT_ERROR, fileResults: [] }
  }

  const fileResults: SourceFileOutcome[] = []
  /** Content digests already accepted into this request's prompt. Memory only. */
  const seenDigests = new Set<string>()
  const readableSources: ExtractedSource[] = []
  // Assigned only to files that actually reach extraction — a neutral,
  // positional label ("Source 1", "Source 2", ...) is what the AI provider
  // sees in place of the real filename; see the module docstring above.
  let promptSourceCounter = 0
  // AI-SOURCE-CONTRACT-01 — one clock for the whole reading stage; see MAX_TOTAL_EXTRACTION_MS.
  const budget = createExtractionBudget()
  // Each selected source's share of the combined cap. There are never more
  // readable sources than selected ones, so text within this share is never cut.
  const perSourceChars = Math.min(MAX_PER_FILE_CHARS, Math.floor(MAX_TOTAL_EXTRACTED_CHARS / mediaIds.length))

  for (const mediaId of mediaIds) {
    const row = rowById.get(mediaId)
    if (!row || !row.directus_files_id) {
      // Deliberately generic — never echoes the requested media id back to the caller.
      fileResults.push(notAnalyzed('Selected file', 'not_associated'))
      continue
    }
    // Browser-facing only — sanitized real name (or a generic fallback for
    // anything anomalous). Never passed to `extractTextFromFile()` /
    // the AI provider; see `promptLabel` below.
    const browserDisplayName = sanitizeDisplayNameForBrowser(row.directus_files_id.filename_download)
    const mime = row.directus_files_id.type

    // The format decides first: a file that could never be analyzed says so,
    // however much reading time is left.
    const refusal = aiSourceFormatRefusal(mime)
    if (refusal) {
      fileResults.push(notAnalyzed(browserDisplayName, refusal, mime))
      continue
    }
    // A format the contract does not refuse is always one of its entries.
    const format = aiSourceFormatFor(mime)!

    // Trusted-metadata size pre-check — happens BEFORE any byte is downloaded.
    const knownSize = row.directus_files_id.filesize == null ? null : Number(row.directus_files_id.filesize)
    if (!isFileSizeSafeToDownload(knownSize, format.maxBytes)) {
      fileResults.push(notAnalyzed(browserDisplayName, 'too_large'))
      continue
    }

    const remainingMs = budget.remainingMs()
    if (remainingMs === 0) {
      fileResults.push(notAnalyzed(browserDisplayName, 'time_budget_exhausted'))
      continue
    }

    let bytes: ArrayBuffer | null
    try {
      // A download never outlives the reading stage: its deadline is its own
      // limit or the time the stage has left, whichever comes first.
      bytes = await downloadSourceBytes(fetch, row.directus_files_id.id, {
        maxBytes: format.maxBytes,
        timeoutMs: Math.min(MAX_ASSET_DOWNLOAD_MS, remainingMs),
      })
    } catch {
      bytes = null
    }
    // Once the stage's time is spent nothing more is read — not even bytes
    // that happened to arrive at the last moment.
    if (budget.remainingMs() === 0) {
      fileResults.push(notAnalyzed(browserDisplayName, 'time_budget_exhausted'))
      continue
    }
    if (!bytes) {
      fileResults.push(notAnalyzed(browserDisplayName, 'unreadable'))
      continue
    }

    // The label is only consumed once the source is actually going into the
    // prompt, so a skipped duplicate does not leave a gap in "Source 1, 2, 3".
    const promptLabel = `Source ${promptSourceCounter + 1}`
    // A reader outside this process (a PDF) gets no more than what the stage has
    // left, and neither does a workbook read inside it.
    const extraction = await extractTextFromFile(bytes, mime, promptLabel, {
      readers,
      timeoutMs: budget.remainingMs(),
      productCode: subject.extractionProductCode,
      maxChars: perSourceChars,
    })
    // A read that ran into the end of the stage used up the analysis's time,
    // not its own: it is reported exactly like a download that did.
    if (budget.remainingMs() === 0) {
      fileResults.push(notAnalyzed(browserDisplayName, 'time_budget_exhausted'))
      continue
    }
    if (!extraction.ok) {
      fileResults.push(notAnalyzed(browserDisplayName, extraction.code, mime))
      continue
    }

    /**
     * PWS-AI-DUP-GUARD-01 — content-level dedupe. Two files can carry the same
     * text under different names and different Directus ids
     * (`LT180C-spec.txt`, `LT180C-spec-copy.txt`), and id-level dedupe cannot
     * see that. Sending both doubles the prompt for no added information.
     *
     * The digest is computed in memory and stays there: it is never written to
     * disk, never logged, never returned to the browser, and never stored on
     * the product.
     */
    const digest = digestSourceText(extraction.source.text)
    if (seenDigests.has(digest)) {
      fileResults.push({
        displayName: browserDisplayName,
        status: 'duplicate',
        reason: DUPLICATE_CONTENT_REASON,
      })
      continue
    }
    seenDigests.add(digest)

    promptSourceCounter += 1
    fileResults.push({ displayName: browserDisplayName, status: 'read' })
    readableSources.push(extraction.source)
  }

  if (readableSources.length === 0) {
    return { ok: false, error: NO_READABLE_SOURCES_ERROR, fileResults }
  }

  const cappedSources = capTotalCharacters(readableSources, MAX_TOTAL_EXTRACTED_CHARS)
  const input = await subject.buildInput(cappedSources)

  // Never derived from a filename or a Directus id supplied by the caller; see each subject's fingerprint.
  const fingerprint = await subject.fingerprint({
    targetId: target.id,
    providerId,
    sourceDigests: [...seenDigests],
    rows: mediaIds.map(mediaId => rowById.get(mediaId)).filter((row): row is AiSourceFileRow => Boolean(row)),
  })

  // CC-IMP-08 — the subject and its selected sources are checked again after the
  // reading stage: a content item archived, a Draft saved, or a source unlinked,
  // disabled or archived while the files were being read fails closed here, before
  // any provider call.
  const changedBefore = subject.verifyUnchanged ? await subject.verifyUnchanged() : null
  if (changedBefore) return { ok: false, error: changedBefore, fileResults }

  // A validated result for exactly these sources is still good. Nothing is
  // sent to the provider, and no bill is incurred.
  const cached = reuse?.lookup(fingerprint) ?? null
  if (cached !== null) {
    return { ok: true, output: cached, fileResults, fingerprint, reused: true }
  }

  const result = await registry.generateStructured(providerId, target, input)
  if (!result.ok) return { ok: false, error: result.error, fileResults }

  // CC-IMP-08 — and once more before a result is returned: a proposal is never
  // bound to a subject or a source set that changed during the provider call.
  const changedAfter = subject.verifyUnchanged ? await subject.verifyUnchanged() : null
  if (changedAfter) return { ok: false, error: changedAfter, fileResults }

  // Only a result that passed the Target's own validation is ever cached; a
  // failure must never be replayed as though it had succeeded.
  reuse?.store(fingerprint, result.output)
  return { ok: true, output: result.output, fileResults, fingerprint, reused: false }
}
