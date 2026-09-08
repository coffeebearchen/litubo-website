import { createAiProviderRegistry, parseAiProviderId, type AiProviderRegistry } from './aiProviderRegistry'
import { createOpenAiSpecificationProvider } from './openaiSpecificationProvider'
import { createDeepSeekSpecificationProvider } from './deepseekSpecificationProvider'

/**
 * PWS-AI-PROVIDER-02 — wires the real OpenAI and DeepSeek adapters into the
 * provider-neutral registry, for a future `server/api/**` endpoint to call
 * with real `useRuntimeConfig()` values. This module is the only place that
 * constructs both real adapters together; no PWS-AI-02 endpoint calls it
 * yet, so it is never exercised against a real network in this task.
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
      openai: createOpenAiSpecificationProvider(config.openai),
      deepseek: createDeepSeekSpecificationProvider(config.deepseek),
    },
  })
}
