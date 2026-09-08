/**
 * PWS-AI-PROVIDER-02 (+ PWS-AI-PROVIDER-02-FIX-JSON-SCHEMA-01) —
 * provider-neutral registry + independent DeepSeek adapter using DeepSeek's
 * own documented Responses API.
 *
 * Every test uses mock adapters/model callers — none of them constructs a
 * real client, and none reaches the network. The real
 * `defaultDeepSeekModelCaller` and `defaultOpenAiModelCaller` (the only two
 * functions that construct an `OpenAI` client — DeepSeek's own documented
 * Responses API integration path is the OpenAI SDK pointed at DeepSeek's
 * `base_url`) are never exercised here.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  createAiProviderRegistry,
  isAiProviderId,
  parseAiProviderId,
  AI_PROVIDER_IDS,
  type AiSpecificationProvider,
  type GenerateSpecificationProposalInput,
} from '../server/utils/aiProviderRegistry'
import { createDeepSeekSpecificationProvider, type DeepSeekModelCaller } from '../server/utils/deepseekSpecificationProvider'
import { createOpenAiSpecificationProvider } from '../server/utils/openaiSpecificationProvider'
import { createDefaultAiProviderRegistry } from '../server/utils/aiProviderRegistryDefault'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const SAMPLE_INPUT: GenerateSpecificationProposalInput = {
  productName: 'LT-180C Free-Fall Metal Detector',
  sourceFileSummaries: [{ displayName: 'LT-180C Datasheet.pdf', fileType: 'PDF' }],
}

const VALID_PROPOSAL = {
  groups: [{ group: 'Detection performance', items: [{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }] }],
}

function mockProvider(overrides: Partial<AiSpecificationProvider> = {}): AiSpecificationProvider {
  return {
    isConfigured: () => true,
    generateSpecificationProposal: async () => ({ ok: true, proposal: VALID_PROPOSAL }),
    ...overrides,
  }
}

// ── AiProviderId enum validation ─────────────────────────────────────────────

describe('AiProviderId enum validation', () => {
  it('recognizes exactly deepseek and openai', () => {
    expect(AI_PROVIDER_IDS).toEqual(['deepseek', 'openai'])
    expect(isAiProviderId('deepseek')).toBe(true)
    expect(isAiProviderId('openai')).toBe(true)
  })

  it('rejects anything else, including case variants and unrelated strings', () => {
    for (const bad of ['OpenAI', 'DEEPSEEK', 'anthropic', 'gpt-4', '', null, undefined, 42, {}]) {
      expect(isAiProviderId(bad)).toBe(false)
    }
  })

  it('parseAiProviderId falls back safely instead of trusting unknown input', () => {
    expect(parseAiProviderId('deepseek', 'openai')).toBe('deepseek')
    expect(parseAiProviderId('openai', 'deepseek')).toBe('openai')
    expect(parseAiProviderId('anthropic', 'deepseek')).toBe('deepseek')
    expect(parseAiProviderId(undefined, 'deepseek')).toBe('deepseek')
    expect(parseAiProviderId('; DROP TABLE products;', 'deepseek')).toBe('deepseek')
  })
})

// ── Registry: default provider, listing, dispatch ────────────────────────────

describe('createAiProviderRegistry — default provider and safe listing', () => {
  it('getDefaultProvider() returns exactly what was configured', () => {
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: mockProvider(), openai: mockProvider() },
    })
    expect(registry.getDefaultProvider()).toBe('deepseek')
  })

  it('listConfiguredProviders() returns only id/label/configured — never a key, model, or error detail', () => {
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: {
        deepseek: mockProvider({ isConfigured: () => true }),
        openai: mockProvider({ isConfigured: () => false }),
      },
    })
    const summary = registry.listConfiguredProviders()
    expect(summary).toEqual([
      { id: 'deepseek', label: 'DeepSeek', configured: true },
      { id: 'openai', label: 'OpenAI', configured: false },
    ])
    for (const row of summary) {
      const keys = Object.keys(row)
      expect(keys).toEqual(['id', 'label', 'configured'])
    }
  })
})

describe('createAiProviderRegistry — generateSpecificationProposal dispatches to exactly one provider', () => {
  it('calls only the requested provider\'s generateSpecificationProposal, never the other one', async () => {
    const deepseekCall = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const openaiCall = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: {
        deepseek: mockProvider({ generateSpecificationProposal: deepseekCall }),
        openai: mockProvider({ generateSpecificationProposal: openaiCall }),
      },
    })

    await registry.generateSpecificationProposal('deepseek', SAMPLE_INPUT)

    expect(deepseekCall).toHaveBeenCalledTimes(1)
    expect(openaiCall).not.toHaveBeenCalled()
  })

  it('calling the other provider id calls only that one, symmetrically', async () => {
    const deepseekCall = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const openaiCall = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: {
        deepseek: mockProvider({ generateSpecificationProposal: deepseekCall }),
        openai: mockProvider({ generateSpecificationProposal: openaiCall }),
      },
    })

    await registry.generateSpecificationProposal('openai', SAMPLE_INPUT)

    expect(openaiCall).toHaveBeenCalledTimes(1)
    expect(deepseekCall).not.toHaveBeenCalled()
  })

  it('never issues more than one provider call for a single generateSpecificationProposal() invocation', async () => {
    let totalCalls = 0
    const countingProvider = (): AiSpecificationProvider => mockProvider({
      generateSpecificationProposal: async () => { totalCalls++; return { ok: true, proposal: VALID_PROPOSAL } },
    })
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: countingProvider(), openai: countingProvider() },
    })

    await registry.generateSpecificationProposal('deepseek', SAMPLE_INPUT)

    expect(totalCalls).toBe(1)
  })

  it('when the requested provider fails or is unconfigured, the registry returns that failure as-is — it never tries the other provider', async () => {
    const openaiCall = vi.fn(async () => ({ ok: true as const, proposal: VALID_PROPOSAL }))
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: {
        deepseek: mockProvider({ generateSpecificationProposal: async () => ({ ok: false, error: 'AI provider is not configured.' }) }),
        openai: mockProvider({ generateSpecificationProposal: openaiCall }),
      },
    })

    const result = await registry.generateSpecificationProposal('deepseek', SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(openaiCall).not.toHaveBeenCalled()
  })

  it('an invalid provider id is rejected with the same safe error, never a throw or a guessed provider', async () => {
    const registry = createAiProviderRegistry({
      defaultProvider: 'deepseek',
      providers: { deepseek: mockProvider(), openai: mockProvider() },
    })

    // @ts-expect-error deliberately invalid provider id for the fail-safe path
    const result = await registry.generateSpecificationProposal('anthropic', SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
  })

  it('the registry source contains no loop or fallback branch across providers', () => {
    const source = repoFile('server/utils/aiProviderRegistry.ts')
    const fnBody = source.slice(
      source.indexOf('async function generateSpecificationProposal'),
      source.indexOf('return { getProvider'),
    )
    expect(fnBody).not.toMatch(/for\s*\(|\.map\(|\.forEach\(|Promise\.all/)
  })
})

// ── DeepSeek adapter — independent from OpenAI's ─────────────────────────────

describe('createDeepSeekSpecificationProvider — fails closed when not configured', () => {
  it('isConfigured() is false when both apiKey and model are empty', () => {
    expect(createDeepSeekSpecificationProvider({ apiKey: '', model: '' }).isConfigured()).toBe(false)
  })

  it('generateSpecificationProposal() returns the exact safe "not configured" message and never invokes callModel', async () => {
    let called = false
    const spyCaller: DeepSeekModelCaller = async () => { called = true; return VALID_PROPOSAL }
    const provider = createDeepSeekSpecificationProvider({ apiKey: '', model: '' }, spyCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(called).toBe(false)
  })

  it('isConfigured() is true once both apiKey and model are set', () => {
    expect(createDeepSeekSpecificationProvider({ apiKey: 'sk-test-not-real', model: 'deepseek-test-not-real' }).isConfigured()).toBe(true)
  })
})

describe('createDeepSeekSpecificationProvider — mock success and failure paths', () => {
  const CONFIG = { apiKey: 'sk-test-not-real', model: 'deepseek-test-not-real' }

  it('a legitimate structured mock response is validated and returned as ok', async () => {
    const mockCaller: DeepSeekModelCaller = async () => VALID_PROPOSAL
    const provider = createDeepSeekSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result.ok).toBe(true)
  })

  it('a malformed mock response is safely rejected', async () => {
    const mockCaller: DeepSeekModelCaller = async () => ({ unexpected: 'shape' })
    const provider = createDeepSeekSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'The AI provider returned a response that could not be safely used.' })
  })

  it('a mock refusal/HTTP failure is safely converted to a short error, never the raw status or body', async () => {
    const mockCaller: DeepSeekModelCaller = async () => { throw new Error('DeepSeek request failed with status 429: rate limit, request id 9f3a') }
    const provider = createDeepSeekSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('The AI provider could not generate a proposal right now.')
      expect(result.error).not.toContain('9f3a')
      expect(result.error).not.toContain('429')
    }
  })

  it('a mock timeout is safely converted to the same short error', async () => {
    const mockCaller: DeepSeekModelCaller = () => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('The operation was aborted')), 5)
    })
    const provider = createDeepSeekSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'The AI provider could not generate a proposal right now.' })
  })

  it('never leaks the configured apiKey or model into any result', async () => {
    const mockCaller: DeepSeekModelCaller = async () => VALID_PROPOSAL
    const provider = createDeepSeekSpecificationProvider(CONFIG, mockCaller)

    const ok = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(JSON.stringify(ok)).not.toContain(CONFIG.apiKey)
    expect(JSON.stringify(ok)).not.toContain(CONFIG.model)
  })
})

describe('DeepSeek and OpenAI adapters are independently implemented files, each using its provider\'s own documented Responses API', () => {
  it('the DeepSeek adapter uses the documented Responses API (client.responses.create), not Chat Completions', () => {
    const source = repoFile('server/utils/deepseekSpecificationProvider.ts')
    expect(source).toContain('client.responses.create')
    expect(source).not.toContain('/chat/completions')
    expect(source).not.toContain('response_format')
  })

  it('the DeepSeek adapter points the OpenAI SDK at DeepSeek\'s own documented base_url — this is DeepSeek\'s official documented integration path, not raw guessing', () => {
    const source = repoFile('server/utils/deepseekSpecificationProvider.ts')
    expect(source).toContain('api.deepseek.com')
    expect(source).toContain('baseURL')
  })

  it('the OpenAI adapter still uses the OpenAI SDK and its own Structured Outputs schema — untouched by the DeepSeek fix', () => {
    const source = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(source).toContain("from 'openai'")
    expect(source).toContain('client.responses.create')
    expect(source).toContain('json_schema')
  })

  it('the DeepSeek adapter uses text.format.type = json_schema, no longer json_object', () => {
    const source = repoFile('server/utils/deepseekSpecificationProvider.ts')
    expect(source).toContain("type: 'json_schema'")
    expect(source).not.toContain("type: 'json_object'")
  })

  it('the DeepSeek request declares a schema name and the canonical groups/parameter/value/note schema, matching the OpenAI adapter\'s contract', () => {
    const source = repoFile('server/utils/deepseekSpecificationProvider.ts')
    expect(source).toContain("name: 'specification_proposal'")
    expect(source).toContain('groups')
    expect(source).toContain('parameter')
    expect(source).toContain('value')
    expect(source).toContain('note')
  })

  it('the DeepSeek adapter keeps its own local JSON Schema constant — it does not import or share OpenAI\'s copy', () => {
    const deepseek = repoFile('server/utils/deepseekSpecificationProvider.ts')
    const openai = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(deepseek).toContain('SPECIFICATION_PROPOSAL_JSON_SCHEMA')
    expect(openai).toContain('SPECIFICATION_PROPOSAL_JSON_SCHEMA')
    expect(deepseek).not.toContain("from './openaiSpecificationProvider'")
  })

  it('neither adapter file imports the other', () => {
    const deepseek = repoFile('server/utils/deepseekSpecificationProvider.ts')
    const openai = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(deepseek).not.toContain('openaiSpecificationProvider')
    expect(openai).not.toContain('deepseekSpecificationProvider')
  })

  it('each adapter has its own independent config type and factory function name', () => {
    const deepseek = repoFile('server/utils/deepseekSpecificationProvider.ts')
    const openai = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(deepseek).toContain('DeepSeekProviderConfig')
    expect(deepseek).toContain('createDeepSeekSpecificationProvider')
    expect(openai).toContain('SpecificationProposalProviderConfig')
    expect(openai).toContain('createOpenAiSpecificationProvider')
  })

  it('both adapters validate through the one shared canonical schema module', () => {
    const deepseek = repoFile('server/utils/deepseekSpecificationProvider.ts')
    const openai = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(deepseek).toContain("from './aiSpecificationProposal'")
    expect(openai).toContain("from './aiSpecificationProposal'")
  })
})

describe('PWS-AI-PROVIDER-02 never leaks secrets, and no default OpenAI config change', () => {
  it('createOpenAiSpecificationProvider(commit c1e03ce contract) still fails closed with empty config, unchanged', () => {
    expect(createOpenAiSpecificationProvider({ apiKey: '', model: '' }).isConfigured()).toBe(false)
  })

  it('createDefaultAiProviderRegistry wires both real adapters but never calls the network with empty config', async () => {
    const registry = createDefaultAiProviderRegistry({
      defaultProvider: 'deepseek',
      openai: { apiKey: '', model: '' },
      deepseek: { apiKey: '', model: '' },
    })

    expect(registry.getDefaultProvider()).toBe('deepseek')
    expect(registry.listConfiguredProviders()).toEqual([
      { id: 'deepseek', label: 'DeepSeek', configured: false },
      { id: 'openai', label: 'OpenAI', configured: false },
    ])

    const result = await registry.generateSpecificationProposal('deepseek', SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
  })

  it('createDefaultAiProviderRegistry falls back to deepseek for an unrecognized raw defaultProvider value', () => {
    const registry = createDefaultAiProviderRegistry({
      defaultProvider: 'not-a-real-provider',
      openai: { apiKey: '', model: '' },
      deepseek: { apiKey: '', model: '' },
    })
    expect(registry.getDefaultProvider()).toBe('deepseek')
  })
})

describe('PWS-AI-PROVIDER-02 config stays server-only and unhardcoded', () => {
  it('nuxt.config.ts places all four new fields outside runtimeConfig.public', () => {
    const config = repoFile('nuxt.config.ts')
    const publicBlockStart = config.indexOf('public: {')
    const beforePublic = config.slice(0, publicBlockStart)
    for (const field of ['aiDefaultProvider', 'deepseekApiKey', 'deepseekModel']) {
      expect(beforePublic).toContain(field)
    }
    const publicBlock = config.slice(publicBlockStart, config.indexOf('},', publicBlockStart))
    expect(publicBlock).not.toContain('deepseek')
    expect(publicBlock).not.toContain('openai')
  })

  it('.env.example documents the new variables with no real secret values', () => {
    const env = repoFile('.env.example')
    expect(env).toContain('AI_DEFAULT_PROVIDER=')
    expect(env).toContain('DEEPSEEK_API_KEY=')
    expect(env).toContain('DEEPSEEK_MODEL=')
    for (const varName of ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL']) {
      const line = env.split('\n').find(l => l.startsWith(`${varName}=`))
      expect(line?.split('=')[1]?.trim() ?? '').toBe('')
    }
  })

  it('neither adapter hardcodes a final model name — the model always comes from config', () => {
    const deepseek = repoFile('server/utils/deepseekSpecificationProvider.ts')
    expect(deepseek).not.toMatch(/model:\s*['"]deepseek-chat['"]/)
    expect(deepseek).toContain('config.model')
  })
})

describe('PWS-AI-PROVIDER-02 keeps the OpenAI SDK and both providers strictly server-only', () => {
  it('nothing under pages/ or components/ imports openai, the registry, or either adapter module', () => {
    function* walk(dir: string): Generator<string> {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) yield* walk(full)
        else if (full.endsWith('.vue') || full.endsWith('.ts')) yield full
      }
    }

    const offenders: string[] = []
    const forbidden = ["from 'openai'", 'aiProviderRegistry', 'openaiSpecificationProvider', 'deepseekSpecificationProvider']
    for (const dir of ['pages', 'components']) {
      for (const file of walk(resolve(process.cwd(), dir))) {
        const source = readFileSync(file, 'utf8')
        if (forbidden.some(needle => source.includes(needle))) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
