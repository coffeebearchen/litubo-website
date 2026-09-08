import { z } from 'zod'

/**
 * PWS-AI-PLATFORM-01 — the one structured shape an AI-generated specification
 * proposal is ever allowed to take: group name / parameter name / value /
 * optional note. Zod's object schemas strip any key that is not explicitly
 * declared here, so nothing else a model response tries to include — a raw
 * excerpt, a file path, a UUID, an internal note field, or anything else —
 * can ever survive into a parsed proposal. This module has no network
 * dependency and no Directus dependency; it only validates already-parsed
 * JSON.
 */

export const SpecificationProposalItemSchema = z.object({
  parameter: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional(),
})

export const SpecificationProposalGroupSchema = z.object({
  group: z.string().trim().min(1).max(200),
  items: z.array(SpecificationProposalItemSchema).min(1).max(100),
})

export const SpecificationProposalSchema = z.object({
  groups: z.array(SpecificationProposalGroupSchema).min(1).max(50),
})

export type SpecificationProposalItem = z.infer<typeof SpecificationProposalItemSchema>
export type SpecificationProposalGroup = z.infer<typeof SpecificationProposalGroupSchema>
export type SpecificationProposal = z.infer<typeof SpecificationProposalSchema>

export type SpecificationProposalResult =
  | { ok: true, proposal: SpecificationProposal }
  | { ok: false, error: string }

/** Deliberately generic — never echoes the raw response, a Zod issue path, or any provider-specific detail. */
const MALFORMED_RESPONSE_ERROR = 'The AI provider returned a response that could not be safely used.'

/**
 * Validates and strips an untrusted, already-JSON-parsed provider response
 * down to exactly the safe shape. Never throws; a malformed, empty, or
 * unexpected shape always produces a short, safe `{ ok: false }` result.
 */
export function parseSpecificationProposalResponse(raw: unknown): SpecificationProposalResult {
  const result = SpecificationProposalSchema.safeParse(raw)
  if (!result.success) return { ok: false, error: MALFORMED_RESPONSE_ERROR }
  return { ok: true, proposal: result.data }
}
