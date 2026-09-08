import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'

/**
 * PWS-AI-ENGINE-01 — read-only, admin-only AI provider status. Covered by
 * the global `server/middleware/admin-auth.ts` (all `/api/admin/**` routes
 * require a valid Administrator session; no separate check needed here).
 *
 * Returns only `{ id, label, configured, isDefault }` per provider — never
 * an API key, model name, environment variable name, raw error, prompt, or
 * file content. `useRuntimeConfig()` values are read here and nowhere else
 * in this response; only their *presence* (via `configured`) is exposed.
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()

  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: config.openaiApiKey, model: config.openaiModel },
    deepseek: { apiKey: config.deepseekApiKey, model: config.deepseekModel },
  })

  const defaultProvider = registry.getDefaultProvider()

  return registry.listConfiguredProviders().map(p => ({
    id: p.id,
    label: p.label,
    configured: p.configured,
    isDefault: p.id === defaultProvider,
  }))
})
