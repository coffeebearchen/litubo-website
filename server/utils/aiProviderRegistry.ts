import type { SpecificationProposalResult } from './aiSpecificationProposal'

/**
 * PWS-AI-PROVIDER-02 — provider-neutral registry on top of the OpenAI
 * foundation from PWS-AI-PLATFORM-01 (commit c1e03ce, unmodified in
 * substance). Adds a second, fully independent DeepSeek adapter
 * (`deepseekSpecificationProvider.ts`) alongside the existing OpenAI one
 * (`openaiSpecificationProvider.ts`) — each owns its own request format,
 * Structured Output / JSON-mode strategy, error handling and capability
 * boundary. Both still validate their raw response through the one
 * canonical `SpecificationProposalSchema` in `aiSpecificationProposal.ts`,
 * so the business layer only ever sees the same `SpecificationProposal`
 * shape, whichever provider ran.
 *
 * This file itself never imports either adapter — it is pure registry
 * logic, dependency-injected with whatever `AiSpecificationProvider`
 * instances the caller supplies. That keeps it fully testable with mocks
 * and, more importantly, keeps it structurally incapable of ever calling
 * more than one provider for the same request: `generateSpecificationProposal()`
 * below resolves exactly one provider by id and returns exactly what that
 * one call produces. There is no fallback branch, no retry-with-another-
 * provider path, and no loop over `AI_PROVIDER_IDS` anywhere in this file.
 */

export type AiProviderId = 'deepseek' | 'openai'

export const AI_PROVIDER_IDS: AiProviderId[] = ['deepseek', 'openai']

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as string[]).includes(value)
}

/**
 * Never trusts raw input (env var, request body, etc.) past the two known
 * ids — anything else safely collapses to `fallback` instead of throwing or
 * silently picking an arbitrary provider.
 */
export function parseAiProviderId(raw: unknown, fallback: AiProviderId): AiProviderId {
  return isAiProviderId(raw) ? raw : fallback
}

/** Non-sensitive scope description for a Generate call — file names/types only, never raw content, a UUID, or a path. */
export interface GenerateSpecificationProposalInput {
  productName: string
  sourceFileSummaries: Array<{ displayName: string, fileType: string }>
  /** Optional, human-approved free text the admin typed in — never raw file content. */
  contextNote?: string
}

/** The one interface every provider adapter (OpenAI, DeepSeek, and any future one) implements. */
export interface AiSpecificationProvider {
  isConfigured(): boolean
  generateSpecificationProposal(input: GenerateSpecificationProposalInput): Promise<SpecificationProposalResult>
}

/** Safe summary only — never a key, model name, raw error, prompt, file content, or internal path. */
export interface AiProviderSummary {
  id: AiProviderId
  label: string
  configured: boolean
}

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
}

const UNKNOWN_PROVIDER_ERROR = 'AI provider is not configured.'

export interface AiProviderRegistry {
  getProvider(providerId: AiProviderId): AiSpecificationProvider
  listConfiguredProviders(): AiProviderSummary[]
  getDefaultProvider(): AiProviderId
  generateSpecificationProposal(
    providerId: AiProviderId,
    input: GenerateSpecificationProposalInput,
  ): Promise<SpecificationProposalResult>
}

/**
 * `providers` must supply exactly one adapter instance per `AiProviderId`,
 * dependency-injected by the caller — every test in this task passes mock
 * adapters here, never the real OpenAI/DeepSeek instances.
 */
export function createAiProviderRegistry(options: {
  defaultProvider: AiProviderId
  providers: Record<AiProviderId, AiSpecificationProvider>
}): AiProviderRegistry {
  function getProvider(providerId: AiProviderId): AiSpecificationProvider {
    return options.providers[providerId]
  }

  function listConfiguredProviders(): AiProviderSummary[] {
    return AI_PROVIDER_IDS.map(id => ({
      id,
      label: PROVIDER_LABELS[id],
      configured: options.providers[id].isConfigured(),
    }))
  }

  function getDefaultProvider(): AiProviderId {
    return options.defaultProvider
  }

  /**
   * The single generation entry point. A caller must explicitly name one
   * provider id; this function never chooses one on the caller's behalf,
   * never substitutes a different provider when the requested one fails or
   * is unconfigured, and never invokes more than one adapter per call.
   */
  async function generateSpecificationProposal(
    providerId: AiProviderId,
    input: GenerateSpecificationProposalInput,
  ): Promise<SpecificationProposalResult> {
    if (!isAiProviderId(providerId)) return { ok: false, error: UNKNOWN_PROVIDER_ERROR }
    const provider = getProvider(providerId)
    return provider.generateSpecificationProposal(input)
  }

  return { getProvider, listConfiguredProviders, getDefaultProvider, generateSpecificationProposal }
}
