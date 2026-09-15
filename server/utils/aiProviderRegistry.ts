import type { AiGenerationInput, AiGenerationInputBase, TargetDefinition, TargetGenerationResult } from './aiTargetContract'

/**
 * PWS-AI-ENGINE-01R — provider-neutral, Target-neutral registry. Neither
 * this file nor the two provider adapters (`openaiStructuredProvider.ts`,
 * `deepseekStructuredProvider.ts`) import or reference `specifications` (or
 * any other Target) by name — every call carries a `TargetDefinition` value
 * supplied by the caller, so registering a new Target never requires
 * touching this file. This keeps the single-provider, zero-fallback,
 * zero-dual-dispatch guarantee from PWS-AI-PROVIDER-02 unchanged:
 * `generateStructured()` resolves exactly one provider by id and returns
 * exactly what that one call produces — no fallback branch, no
 * retry-with-another-provider path, no loop over `AI_PROVIDER_IDS`.
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

/** The one interface every provider adapter (OpenAI, DeepSeek, and any future one) implements. Target-neutral. */
export interface AiStructuredProvider {
  isConfigured(): boolean
  /** CC-IMP-08 — generic over the subject's input shape; the adapter only hands `input` to `target.buildUserInput()`. */
  generateStructured<TOutput, TInput extends AiGenerationInputBase = AiGenerationInput>(
    target: TargetDefinition<TOutput, TInput>,
    input: TInput,
  ): Promise<TargetGenerationResult<TOutput>>
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
  getProvider(providerId: AiProviderId): AiStructuredProvider
  listConfiguredProviders(): AiProviderSummary[]
  getDefaultProvider(): AiProviderId
  generateStructured<TOutput, TInput extends AiGenerationInputBase = AiGenerationInput>(
    providerId: AiProviderId,
    target: TargetDefinition<TOutput, TInput>,
    input: TInput,
  ): Promise<TargetGenerationResult<TOutput>>
}

/**
 * `providers` must supply exactly one adapter instance per `AiProviderId`,
 * dependency-injected by the caller — every test in this task passes mock
 * adapters here, never the real OpenAI/DeepSeek instances.
 */
export function createAiProviderRegistry(options: {
  defaultProvider: AiProviderId
  providers: Record<AiProviderId, AiStructuredProvider>
}): AiProviderRegistry {
  function getProvider(providerId: AiProviderId): AiStructuredProvider {
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
   * provider id and one Target; this function never chooses either on the
   * caller's behalf, never substitutes a different provider when the
   * requested one fails or is unconfigured, and never invokes more than one
   * adapter per call.
   */
  async function generateStructured<TOutput, TInput extends AiGenerationInputBase = AiGenerationInput>(
    providerId: AiProviderId,
    target: TargetDefinition<TOutput, TInput>,
    input: TInput,
  ): Promise<TargetGenerationResult<TOutput>> {
    if (!isAiProviderId(providerId)) return { ok: false, error: UNKNOWN_PROVIDER_ERROR }
    const provider = getProvider(providerId)
    return provider.generateStructured(target, input)
  }

  return { getProvider, listConfiguredProviders, getDefaultProvider, generateStructured }
}
