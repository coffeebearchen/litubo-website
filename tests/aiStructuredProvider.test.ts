/**
 * PWS-AI-ENGINE-01R — Target-neutral OpenAI and DeepSeek structured
 * providers. Every test injects a mock `ModelCaller`/`DeepSeekModelCaller` —
 * no real network call, no real OpenAI/DeepSeek SDK client is ever
 * constructed with a real key in this file. Uses the real
 * `specificationsTarget` as the Target under test, but asserts on the
 * generic (Target-neutral) call shape, not on anything specifications-only.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createOpenAiStructuredProvider, type ModelCaller } from '../server/utils/openaiStructuredProvider'
import { createDeepSeekStructuredProvider, type DeepSeekModelCaller } from '../server/utils/deepseekStructuredProvider'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'
import type { AiGenerationInput } from '../server/utils/aiTargetContract'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const SAMPLE_INPUT: AiGenerationInput = {
  productName: 'LT-180C Free-Fall Metal Detector',
  sourceFileSummaries: [{ displayName: 'LT-180C Datasheet.pdf', fileType: 'PDF' }],
  extractedSourceTexts: [{ displayName: 'LT-180C Datasheet.pdf', text: 'Detection sensitivity (Fe): 0.8 mm' }],
}

const VALID_RAW = { groups: [{ group: 'Detection performance', items: [{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }] }] }

describe('createOpenAiStructuredProvider — fail-closed and mock success/failure paths', () => {
  it('isConfigured() is false when apiKey or model is blank', () => {
    expect(createOpenAiStructuredProvider({ apiKey: '', model: 'gpt-x' }).isConfigured()).toBe(false)
    expect(createOpenAiStructuredProvider({ apiKey: 'sk-x', model: '' }).isConfigured()).toBe(false)
    expect(createOpenAiStructuredProvider({ apiKey: 'sk-x', model: 'gpt-x' }).isConfigured()).toBe(true)
  })

  it('generateStructured() fails closed without calling the model when not configured', async () => {
    const callModel: ModelCaller = vi.fn()
    const provider = createOpenAiStructuredProvider({ apiKey: '', model: '' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(callModel).not.toHaveBeenCalled()
  })

  it('a mock success response is validated by the Target, not trusted blindly', async () => {
    const callModel: ModelCaller = vi.fn(async () => VALID_RAW)
    const provider = createOpenAiStructuredProvider({ apiKey: 'sk-x', model: 'gpt-x' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toEqual(VALID_RAW)
  })

  it('a malformed mock response is rejected by the Target\'s own validation', async () => {
    const callModel: ModelCaller = vi.fn(async () => ({ not: 'the right shape' }))
    const provider = createOpenAiStructuredProvider({ apiKey: 'sk-x', model: 'gpt-x' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result.ok).toBe(false)
  })

  it('a thrown/rejected model call becomes a short, safe error — never the raw error text', async () => {
    const callModel: ModelCaller = vi.fn(async () => { throw new Error('socket hang up: sk-supersecretkey123') })
    const provider = createOpenAiStructuredProvider({ apiKey: 'sk-x', model: 'gpt-x' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'The AI provider could not generate a proposal right now.' })
  })

  it('the default model caller passes the Target\'s own schemaName/jsonSchema/systemInstructions through to the request, with strict:true', () => {
    const source = repoFile('server/utils/openaiStructuredProvider.ts')
    expect(source).toContain('name: target.schemaName')
    expect(source).toContain('schema: target.jsonSchema')
    expect(source).toContain('strict: true')
    expect(source).toContain('content: target.systemInstructions')
    expect(source).toContain('content: target.buildUserInput(input)')
  })

  it('the runtime call itself never hardcodes a specifications-only schema/prompt — it is built entirely from the Target argument', () => {
    const source = repoFile('server/utils/openaiStructuredProvider.ts')
    const callBlock = source.slice(source.indexOf('async function defaultOpenAiModelCaller'), source.indexOf('/**\n * Factory'))
    expect(callBlock).not.toMatch(/specification_proposal|SPECIFICATION_PROPOSAL/)
  })
})

describe('createDeepSeekStructuredProvider — fail-closed, mock paths, and the strict:true prohibition', () => {
  it('isConfigured() is false when apiKey or model is blank', () => {
    expect(createDeepSeekStructuredProvider({ apiKey: '', model: 'deepseek-chat' }).isConfigured()).toBe(false)
    expect(createDeepSeekStructuredProvider({ apiKey: 'ds-x', model: '' }).isConfigured()).toBe(false)
  })

  it('generateStructured() fails closed without calling the model when not configured', async () => {
    const callModel: DeepSeekModelCaller = vi.fn()
    const provider = createDeepSeekStructuredProvider({ apiKey: '', model: '' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(callModel).not.toHaveBeenCalled()
  })

  it('a mock success response is validated by the Target', async () => {
    const callModel: DeepSeekModelCaller = vi.fn(async () => VALID_RAW)
    const provider = createDeepSeekStructuredProvider({ apiKey: 'ds-x', model: 'deepseek-chat' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result.ok).toBe(true)
  })

  it('a rejected model call becomes a short, safe error', async () => {
    const callModel: DeepSeekModelCaller = vi.fn(async () => { throw new Error('timeout') })
    const provider = createDeepSeekStructuredProvider({ apiKey: 'ds-x', model: 'deepseek-chat' }, callModel)
    const result = await provider.generateStructured(specificationsTarget, SAMPLE_INPUT)
    expect(result).toEqual({ ok: false, error: 'The AI provider could not generate a proposal right now.' })
  })

  it('never sends strict:true — only the officially documented type/name/schema fields', () => {
    const source = repoFile('server/utils/deepseekStructuredProvider.ts')
    const formatBlock = source.slice(source.indexOf('text: {'), source.indexOf('})', source.indexOf('text: {')))
    expect(formatBlock).toContain("type: 'json_schema'")
    expect(formatBlock).toContain('name: target.schemaName')
    expect(formatBlock).toContain('schema: target.jsonSchema')
    expect(formatBlock).not.toContain('strict')
  })

  it('uses the documented Responses API (client.responses.create), not chat completions', () => {
    const source = repoFile('server/utils/deepseekStructuredProvider.ts')
    expect(source).toContain('client.responses.create')
    expect(source).not.toContain('/chat/completions')
  })

  it('the runtime call itself never hardcodes a specifications-only schema/prompt — it is built entirely from the Target argument', () => {
    const source = repoFile('server/utils/deepseekStructuredProvider.ts')
    const callBlock = source.slice(source.indexOf('async function defaultDeepSeekModelCaller'), source.indexOf('/**\n * Factory'))
    expect(callBlock).not.toMatch(/specification_proposal|SPECIFICATION_PROPOSAL/)
  })

  it('remains a fully independent file from the OpenAI adapter — no shared import between the two adapters', () => {
    const deepseekSource = repoFile('server/utils/deepseekStructuredProvider.ts')
    const openaiSource = repoFile('server/utils/openaiStructuredProvider.ts')
    expect(deepseekSource).not.toContain('openaiStructuredProvider')
    expect(openaiSource).not.toContain('deepseekStructuredProvider')
  })
})
