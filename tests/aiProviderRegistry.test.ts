/**
 * PWS-AI-ENGINE-01R — provider-neutral, Target-neutral registry. Verifies
 * single dispatch, zero fallback, zero dual-dispatch, and safe provider
 * summaries — independent of which Target is passed to `generateStructured()`.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createAiProviderRegistry,
  isAiProviderId,
  parseAiProviderId,
  AI_PROVIDER_IDS,
  type AiStructuredProvider,
} from '../server/utils/aiProviderRegistry'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import type { AiGenerationInput } from '../server/utils/aiTargetContract'

const SAMPLE_INPUT: AiGenerationInput = {
  productName: 'X',
  sourceFileSummaries: [],
  extractedSourceTexts: [],
}
const VALID_OUTPUT = { groups: [{ group: 'G', items: [{ parameter: 'P', value: 'V' }] }] }

function fakeProvider(configured: boolean, generateStructured?: unknown): AiStructuredProvider {
  const fn = (generateStructured ?? vi.fn(async () => ({ ok: true as const, output: VALID_OUTPUT }))) as AiStructuredProvider['generateStructured']
  return { isConfigured: () => configured, generateStructured: fn }
}

describe('isAiProviderId / parseAiProviderId', () => {
  it('accepts exactly the two known ids', () => {
    expect(isAiProviderId('deepseek')).toBe(true)
    expect(isAiProviderId('openai')).toBe(true)
    expect(isAiProviderId('anthropic')).toBe(false)
    expect(isAiProviderId(null)).toBe(false)
    expect(isAiProviderId(42)).toBe(false)
  })

  it('parseAiProviderId falls back safely instead of throwing or guessing', () => {
    expect(parseAiProviderId('openai', 'deepseek')).toBe('openai')
    expect(parseAiProviderId('bogus', 'deepseek')).toBe('deepseek')
    expect(parseAiProviderId(undefined, 'deepseek')).toBe('deepseek')
  })

  it('AI_PROVIDER_IDS is exactly deepseek and openai', () => {
    expect(AI_PROVIDER_IDS).toEqual(['deepseek', 'openai'])
  })
})

describe('createAiProviderRegistry — listConfiguredProviders / getDefaultProvider', () => {
  it('maps each provider to a safe summary only', () => {
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: fakeProvider(true), openai: fakeProvider(false) },
    })
    expect(registry.listConfiguredProviders()).toEqual([
      { id: 'deepseek', label: 'DeepSeek', configured: true },
      { id: 'openai', label: 'OpenAI', configured: false },
    ])
    expect(registry.getDefaultProvider()).toBe('deepseek')
  })
})

describe('createAiProviderRegistry — single dispatch, zero fallback, zero dual-dispatch', () => {
  it('generateStructured() calls exactly the one requested provider', async () => {
    const deepseekGenerate = vi.fn(async () => ({ ok: true as const, output: VALID_OUTPUT }))
    const openaiGenerate = vi.fn(async () => ({ ok: true as const, output: VALID_OUTPUT }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: fakeProvider(true, deepseekGenerate), openai: fakeProvider(true, openaiGenerate) },
    })
    await registry.generateStructured('openai', specificationsTarget, SAMPLE_INPUT)
    expect(openaiGenerate).toHaveBeenCalledTimes(1)
    expect(deepseekGenerate).not.toHaveBeenCalled()
  })

  it('never falls back to another provider when the requested one is unconfigured', async () => {
    const openaiGenerate = vi.fn()
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: fakeProvider(false), openai: fakeProvider(true, openaiGenerate) },
    })
    const result = await registry.generateStructured('deepseek', specificationsTarget, SAMPLE_INPUT)
    // The registry itself doesn't check `configured` (the Engine does, before calling) —
    // it dispatches to whatever provider instance is registered for that id, once, and
    // never substitutes a different one. Assert the "once, this provider only" contract.
    expect(result.ok).toBe(true)
    expect(openaiGenerate).not.toHaveBeenCalled()
  })

  it('rejects an invalid provider id without calling any provider', async () => {
    const deepseekGenerate = vi.fn()
    const openaiGenerate = vi.fn()
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: fakeProvider(true, deepseekGenerate), openai: fakeProvider(true, openaiGenerate) },
    })
    // @ts-expect-error deliberately invalid id
    const result = await registry.generateStructured('anthropic', specificationsTarget, SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(deepseekGenerate).not.toHaveBeenCalled()
    expect(openaiGenerate).not.toHaveBeenCalled()
  })

  it('passes the exact Target object through to the provider unchanged', async () => {
    const generate = vi.fn(async () => ({ ok: true as const, output: VALID_OUTPUT }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: fakeProvider(true, generate), openai: fakeProvider(true) },
    })
    await registry.generateStructured('deepseek', specificationsTarget, SAMPLE_INPUT)
    expect(generate).toHaveBeenCalledWith(specificationsTarget, SAMPLE_INPUT)
  })
})
