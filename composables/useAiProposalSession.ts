import type { AiProposalSession } from '~/utils/aiProposal'

/**
 * PWS-AI-ENGINE-01 — the in-memory-only handoff between AI Source Intake and
 * AI Proposal Review. Backed by Nuxt's `useState()`, so it lives only for
 * the current SPA session: opening the Review route directly, or a full
 * page refresh, always resets it to `null` — never persisted, never a query
 * parameter, never written to disk.
 */
export function useAiProposalSession() {
  return useState<AiProposalSession | null>('ai-proposal-session', () => null)
}
