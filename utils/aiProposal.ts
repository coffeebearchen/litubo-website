/**
 * PWS-AI-ENGINE-01 — client-side helpers shared by AI Source Intake and AI
 * Proposal Review. `isTextSourceMime()` mirrors the server's supported-type
 * allowlist (`server/utils/aiTextExtraction.ts`) for display purposes only —
 * it decides which checkboxes are enabled, never what the server actually
 * accepts; the server independently re-validates every file regardless of
 * what the client sends.
 */

const TEXT_SOURCE_MIME_TYPES = new Set([
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

/**
 * Formats that were supported once and are deliberately refused now, each with
 * its own honest reason rather than "never supported".
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — PDF joined the deliberately-dropped list:
 * its parser could not be given a real memory ceiling in-process, so it is
 * refused with its own reason rather than supported unsafely. Mirrors
 * `server/utils/aiTextExtraction.ts`.
 */
const FORMERLY_TEXT_SOURCE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
])

export function isTextSourceMime(mimeType: string | null): boolean {
  if (!mimeType) return false
  return TEXT_SOURCE_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

export function isFormerlyTextSourceMime(mimeType: string | null): boolean {
  if (!mimeType) return false
  return FORMERLY_TEXT_SOURCE_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
}

/** Mirrors `server/utils/aiTextExtraction.ts`'s `MAX_FILES_PER_REQUEST` for client-side display/gating only — the server independently re-enforces this. */
export const MAX_FILES_PER_REQUEST = 5

/** Human-readable list of currently-supported text-source formats, for empty-state and help copy. */
export const SUPPORTED_TEXT_SOURCE_FORMATS_LABEL = 'CSV, TSV, TXT'

/** A filename this long is anomalous regardless of content. Mirrors the server's own ceiling. */
const MAX_SAFE_DISPLAY_NAME_LENGTH = 120

const UNSAFE_FILENAME_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\bwww\./i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /[/\\]/,
]

/** Zero-width, format, control and bidirectional-override characters. Mirrors the server exactly. */
const INVISIBLE_CHARACTER_PATTERN = /[\p{Cf}\p{Cc}]/u

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the client mirror of the server's
 * `sanitizeDisplayNameForBrowser()`. Same rule, same order, including the
 * invisible-character check both before and after NFKC:
 * `tests/aiSourceIntakeReview.test.ts` asserts the two agree on a shared table
 * of hostile names, so they cannot drift apart.
 */
export function safeSourceDisplayName(rawName: string | null | undefined): string {
  const name = (rawName ?? '').trim()
  if (!name) return 'Untitled file'
  if (name.length > MAX_SAFE_DISPLAY_NAME_LENGTH) return 'Source file'
  if (INVISIBLE_CHARACTER_PATTERN.test(name)) return 'Source file'

  const normalized = name.normalize('NFKC')
  if (INVISIBLE_CHARACTER_PATTERN.test(normalized)) return 'Source file'
  if (UNSAFE_FILENAME_PATTERNS.some(pattern => pattern.test(normalized))) return 'Source file'

  return name
}


/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the minimal product context the AI screens
 * receive, mirroring the server's `AiProductContext`.
 *
 * The AI screens deliberately do NOT load the general product record: it
 * carries the hero image's Directus UUID, internal review notes, SEO fields and
 * highlights. `thumbnailUrl` is a product-scoped route, never an assets URL and
 * never a file UUID.
 */
export interface AiProductContext {
  productId: number
  productName: string
  productCode: string | null
  lifecycleStatus: string
  thumbnailUrl: string | null
}

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — exactly what the browser receives per
 * source file from `/api/admin/products/:id/ai/sources`. Mirrors the server's
 * `AiIntakeSource`.
 *
 * Deliberately minimal: no Directus file UUID, no raw `filename_download`, no
 * caption or alt text, no path, no URL. `sourceRef` is an opaque, signed,
 * short-lived handle that only the server can resolve, and only for the admin
 * and product it was minted for.
 */
export interface AiIntakeSource {
  sourceRef: string
  displayName: string
  typeLabel: string
  roleLabel: string
  analyzable: boolean
  unavailableReason: string | null
}

// ── Canonical proposal shape — mirrors the server's Zod-validated output ────

export interface SpecificationProposalItem {
  parameter: string
  value: string
  note?: string
}

export interface SpecificationProposalGroup {
  group: string
  items: SpecificationProposalItem[]
}

export interface SpecificationProposal {
  groups: SpecificationProposalGroup[]
}

export interface SourceFileOutcome {
  displayName: string
  /**
   * PWS-AI-DUP-GUARD-01 — `duplicate` means the file read fine but its text is
   * identical to another selected file, so it was left out of the prompt
   * rather than paid for twice. It is not an error.
   */
  status: 'read' | 'duplicate' | 'unsupported' | 'unreadable'
  reason?: string
}

/**
 * The in-memory-only session handed from AI Source Intake to AI Proposal
 * Review via `useState()`. Never persisted, never written to a query
 * string, and reset to `null` on every full page load — opening the Review
 * route directly, or refreshing it, always shows the honest empty state.
 */
export interface AiProposalSession {
  productId: number
  proposal: SpecificationProposal
  fileResults: SourceFileOutcome[]
  /**
   * PWS-AI-DUP-GUARD-01 — the server-minted handle for this proposal. Apply
   * sends it back so the server can tell a replayed request from a first one.
   * Opaque: nothing about the product, the files or the analysis can be read
   * out of it.
   */
  proposalRef: string
  /** True when the server served a still-valid analysis of unchanged sources instead of calling the provider. */
  reused: boolean
  /** True when this exact analysis has already been written to the Draft, so Apply must stay closed. */
  alreadyApplied: boolean
}
