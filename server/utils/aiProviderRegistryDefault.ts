import { createAiProviderRegistry, parseAiProviderId, type AiProviderRegistry } from './aiProviderRegistry'
import { createOpenAiStructuredProvider } from './openaiStructuredProvider'
import { createDeepSeekStructuredProvider } from './deepseekStructuredProvider'

/**
 * PWS-AI-ENGINE-01R — wires the real, Target-neutral OpenAI and DeepSeek
 * adapters into the provider registry, for a `server/api/**` endpoint to
 * call with real `useRuntimeConfig()` values and whichever `TargetDefinition`
 * it needs for that request.
 *
 * Config is passed in as plain values (never `useRuntimeConfig()` called
 * directly inside this file), matching the existing `adminDirectusClient.ts`
 * convention — this keeps it fully unit-testable without a Nuxt runtime.
 */
export interface AiProviderRegistryConfig {
  /** Raw `runtimeConfig.aiDefaultProvider` — validated here, never trusted as-is. */
  defaultProvider: unknown
  openai: { apiKey: string, model: string }
  deepseek: { apiKey: string, model: string }
}

export function createDefaultAiProviderRegistry(config: AiProviderRegistryConfig): AiProviderRegistry {
  return createAiProviderRegistry({
    defaultProvider: parseAiProviderId(config.defaultProvider, 'deepseek'),
    providers: {
      openai: createOpenAiStructuredProvider(config.openai),
      deepseek: createDeepSeekStructuredProvider(config.deepseek),
    },
  })
}
