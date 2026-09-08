/**
 * PWS-AI-ENGINE-01 — client-side helpers shared by AI Source Intake and AI
 * Proposal Review. `isTextSourceMime()` mirrors the server's supported-type
 * allowlist (`server/utils/aiTextExtraction.ts`) for display purposes only —
 * it decides which checkboxes are enabled, never what the server actually
 * accepts; the server independently re-validates every file regardless of
 * what the client sends.
 */

const TEXT_SOURCE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
])

export function isTextSourceMime(mimeType: string | null): boolean {
  if (!mimeType) return false
  return TEXT_SOURCE_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())
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
  status: 'read' | 'unsupported' | 'unreadable'
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
}
