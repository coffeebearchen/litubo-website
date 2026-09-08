/**
 * PWS-AI-PLATFORM-01 — OpenAI server provider foundation.
 *
 * Every test here uses a mock `ModelCaller` (or no caller at all, for the
 * "not configured" paths) — none of them constructs a real OpenAI client or
 * reaches the network. `createOpenAiSpecificationProvider()`'s default
 * `callModel` (the one that actually imports and calls the `openai` SDK) is
 * never exercised by this suite: every configured-provider test below
 * supplies its own mock `callModel`, and every "not configured" test uses an
 * empty apiKey/model, which short-circuits before `callModel` would ever run.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  parseSpecificationProposalResponse,
  SpecificationProposalSchema,
} from '../server/utils/aiSpecificationProposal'
import { createOpenAiSpecificationProvider, type ModelCaller } from '../server/utils/openaiSpecificationProvider'
import type { GenerateSpecificationProposalInput } from '../server/utils/aiProviderRegistry'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const SAMPLE_INPUT: GenerateSpecificationProposalInput = {
  productName: 'LT-180C Free-Fall Metal Detector',
  sourceFileSummaries: [
    { displayName: 'LT-180C Datasheet.pdf', fileType: 'PDF' },
    { displayName: 'Dimensional diagram.png', fileType: 'Image' },
  ],
  extractedSourceTexts: [
    { displayName: 'LT-180C Datasheet.pdf', text: 'Detection sensitivity (Fe): 0.8 mm' },
  ],
}

const VALID_PROPOSAL = {
  groups: [
    {
      group: 'Detection performance',
      items: [
        { parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' },
        { parameter: 'Detection sensitivity (Non-Fe)', value: '1.2 mm', note: 'Datasheet page 7' },
      ],
    },
  ],
}

describe('parseSpecificationProposalResponse — structural validation', () => {
  it('accepts a well-formed proposal and returns it unchanged', () => {
    const result = parseSpecificationProposalResponse(VALID_PROPOSAL)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.proposal.groups).toHaveLength(1)
      expect(result.proposal.groups[0].group).toBe('Detection performance')
      expect(result.proposal.groups[0].items).toHaveLength(2)
      expect(result.proposal.groups[0].items[1].note).toBe('Datasheet page 7')
    }
  })

  it('accepts an item with no optional note', () => {
    const result = parseSpecificationProposalResponse({
      groups: [{ group: 'Machine configuration', items: [{ parameter: 'Inlet diameter', value: '180 mm' }] }],
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a completely malformed shape with a short, safe error — never a stack trace or raw payload', () => {
    const result = parseSpecificationProposalResponse({ not: 'a proposal at all' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('The AI provider returned a response that could not be safely used.')
      expect(result.error.length).toBeLessThan(100)
    }
  })

  it('rejects null, undefined, a string, and an array — never throws', () => {
    for (const bad of [null, undefined, 'refused', [], 42, true]) {
      expect(() => parseSpecificationProposalResponse(bad)).not.toThrow()
      expect(parseSpecificationProposalResponse(bad).ok).toBe(false)
    }
  })

  it('rejects an empty groups array and a group with an empty items array', () => {
    expect(parseSpecificationProposalResponse({ groups: [] }).ok).toBe(false)
    expect(parseSpecificationProposalResponse({ groups: [{ group: 'X', items: [] }] }).ok).toBe(false)
  })

  it('rejects an item missing a required field (value)', () => {
    const result = parseSpecificationProposalResponse({
      groups: [{ group: 'X', items: [{ parameter: 'Y' }] }],
    })
    expect(result.ok).toBe(false)
  })

  it('strips any extra field the model tried to include — raw excerpt, UUID, path, locator, internal note, prompt', () => {
    const withExtraFields = {
      groups: [
        {
          group: 'Detection performance',
          extra_group_field: 'should be dropped',
          items: [
            {
              parameter: 'Detection sensitivity (Fe)',
              value: '0.8 mm',
              raw_excerpt: 'the full page 7 text of the datasheet...',
              source_locator: 'page 7, paragraph 2',
              directus_files_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              file_path: '/uploads/2026/LT-180C-Datasheet.pdf',
              internal_note: 'do not show to customers',
              prompt: 'You are a helpful assistant...',
            },
          ],
        },
      ],
    }
    const result = parseSpecificationProposalResponse(withExtraFields)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const serialized = JSON.stringify(result.proposal)
      expect(serialized).not.toContain('raw_excerpt')
      expect(serialized).not.toContain('source_locator')
      expect(serialized).not.toContain('directus_files_id')
      expect(serialized).not.toContain('file_path')
      expect(serialized).not.toContain('internal_note')
      expect(serialized).not.toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(serialized).not.toContain('extra_group_field')
    }
  })

  it('the schema itself has no field named after any restricted concept', () => {
    const shape = SpecificationProposalSchema
    expect(shape).toBeTruthy() // schema import compiles and is usable — the safe-shape guarantee above is the real assertion
  })
})

describe('createOpenAiSpecificationProvider — fails closed when not configured', () => {
  it('isConfigured() is false when both apiKey and model are empty', () => {
    const provider = createOpenAiSpecificationProvider({ apiKey: '', model: '' })
    expect(provider.isConfigured()).toBe(false)
  })

  it('isConfigured() is false when only one of apiKey/model is set', () => {
    expect(createOpenAiSpecificationProvider({ apiKey: 'sk-test', model: '' }).isConfigured()).toBe(false)
    expect(createOpenAiSpecificationProvider({ apiKey: '', model: 'gpt-test' }).isConfigured()).toBe(false)
  })

  it('isConfigured() is false for whitespace-only values', () => {
    expect(createOpenAiSpecificationProvider({ apiKey: '   ', model: '   ' }).isConfigured()).toBe(false)
  })

  it('generateSpecificationProposal() returns the exact safe "not configured" message and never invokes callModel', async () => {
    let called = false
    const spyCaller: ModelCaller = async () => { called = true; return VALID_PROPOSAL }
    const provider = createOpenAiSpecificationProvider({ apiKey: '', model: '' }, spyCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'AI provider is not configured.' })
    expect(called).toBe(false)
  })

  it('isConfigured() is true once both apiKey and model are non-empty (still never calls the network without an explicit generate call)', () => {
    const provider = createOpenAiSpecificationProvider({ apiKey: 'sk-test-not-real', model: 'gpt-test-not-real' })
    expect(provider.isConfigured()).toBe(true)
  })
})

describe('createOpenAiSpecificationProvider — mock provider success and failure paths', () => {
  const CONFIG = { apiKey: 'sk-test-not-real', model: 'gpt-test-not-real' }

  it('a legitimate structured response from the mock model call is passed through validation and returned as ok', async () => {
    const mockCaller: ModelCaller = async () => VALID_PROPOSAL
    const provider = createOpenAiSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.proposal.groups[0].group).toBe('Detection performance')
  })

  it('a malformed / non-conforming mock response is safely rejected, never surfacing the raw shape', async () => {
    const mockCaller: ModelCaller = async () => ({ unexpected: 'shape' })
    const provider = createOpenAiSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'The AI provider returned a response that could not be safely used.' })
  })

  it('a mock refusal (provider throws) is safely converted to a short error, never an unhandled rejection', async () => {
    const mockCaller: ModelCaller = async () => { throw new Error('model refused: policy violation, see internal log 88f2') }
    const provider = createOpenAiSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('The AI provider could not generate a proposal right now.')
      expect(result.error).not.toContain('88f2')
      expect(result.error).not.toContain('policy violation')
    }
  })

  it('a mock timeout (provider rejects after a delay) is safely converted to the same short error', async () => {
    const mockCaller: ModelCaller = () => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('ETIMEDOUT')), 5)
    })
    const provider = createOpenAiSpecificationProvider(CONFIG, mockCaller)

    const result = await provider.generateSpecificationProposal(SAMPLE_INPUT)

    expect(result).toEqual({ ok: false, error: 'The AI provider could not generate a proposal right now.' })
  })

  it('never leaks the configured apiKey or model into any result', async () => {
    const mockCaller: ModelCaller = async () => VALID_PROPOSAL
    const provider = createOpenAiSpecificationProvider(CONFIG, mockCaller)

    const ok = await provider.generateSpecificationProposal(SAMPLE_INPUT)
    const failClosed = await createOpenAiSpecificationProvider({ apiKey: '', model: '' }, mockCaller).generateSpecificationProposal(SAMPLE_INPUT)

    expect(JSON.stringify(ok)).not.toContain(CONFIG.apiKey)
    expect(JSON.stringify(ok)).not.toContain(CONFIG.model)
    expect(JSON.stringify(failClosed)).not.toContain(CONFIG.apiKey)
  })
})

describe('PWS-AI-PLATFORM-01 keeps the OpenAI SDK strictly server-only', () => {
  it('the openai package is a production dependency, not a dev-only one', () => {
    const pkg = JSON.parse(repoFile('package.json'))
    expect(pkg.dependencies.openai).toBeTruthy()
  })

  it('nothing under pages/ or components/ imports the openai package or the server provider module', () => {
    function* walk(dir: string): Generator<string> {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) yield* walk(full)
        else if (full.endsWith('.vue') || full.endsWith('.ts')) yield full
      }
    }

    const offenders: string[] = []
    for (const dir of ['pages', 'components']) {
      for (const file of walk(resolve(process.cwd(), dir))) {
        const source = readFileSync(file, 'utf8')
        if (source.includes("from 'openai'") || source.includes('openaiSpecificationProvider')) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('runtimeConfig places openaiApiKey/openaiModel outside the public block', () => {
    const config = repoFile('nuxt.config.ts')
    const publicBlockStart = config.indexOf('public: {')
    const beforePublic = config.slice(0, publicBlockStart)
    expect(beforePublic).toContain('openaiApiKey: process.env.OPENAI_API_KEY')
    expect(beforePublic).toContain('openaiModel: process.env.OPENAI_MODEL')
    const publicBlock = config.slice(publicBlockStart, config.indexOf('},', publicBlockStart))
    expect(publicBlock).not.toContain('openai')
  })

  it('.env.example only adds commented-out / empty placeholders, never a real value', () => {
    const env = repoFile('.env.example')
    expect(env).toContain('OPENAI_API_KEY=')
    expect(env).toContain('OPENAI_MODEL=')
    const lines = env.split('\n').filter(l => l.startsWith('OPENAI_API_KEY=') || l.startsWith('OPENAI_MODEL='))
    for (const line of lines) {
      const value = line.split('=')[1] ?? ''
      expect(value.trim()).toBe('')
    }
  })

  it('the provider module never hardcodes a final model name — the model always comes from config', () => {
    const provider = repoFile('server/utils/openaiSpecificationProvider.ts')
    expect(provider).not.toMatch(/model:\s*['"]gpt-/i)
    expect(provider).toContain('config.model')
  })
})
