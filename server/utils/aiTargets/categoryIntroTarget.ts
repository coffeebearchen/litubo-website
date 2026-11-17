import { z } from 'zod'
import {
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  containsUnsafeSourceLeakage,
  type AiGenerationInputBase,
  type TargetDefinition,
  type TargetGenerationResult,
  type TargetValidationContext,
} from '../aiTargetContract'

/**
 * A product category's introduction and search metadata.
 *
 * A category page is the first thing a buyer lands on from the mega menu, and its copy has to work at
 * the family level: what this class of inspection solves, which products sit in it, and what decides
 * the choice between them. The material is the category name plus the names and summaries of the
 * products an editor already put in it - no specifications are invented, because none are passed.
 */
export const CATEGORY_INTRO_TARGET_ID = 'category-intro'
export const INTRO_STORAGE_MAX = 400
export const INTRO_IDEAL_MAX = 320

export interface CategoryIntroProposal {
  intro: string
  seoTitle: string
  seoDescription: string
}

export interface CategoryIntroInput extends AiGenerationInputBase {
  categoryName: string
  locale: string
  products: Array<{ name: string, summary: string }>
}

const ProposalSchema = z.object({
  intro: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
}).strict()

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intro', 'seoTitle', 'seoDescription'],
  properties: {
    intro: { type: 'string', minLength: 1, maxLength: INTRO_STORAGE_MAX },
    seoTitle: { type: 'string', minLength: 1, maxLength: 120 },
    seoDescription: { type: 'string', minLength: 1, maxLength: 320 },
  },
}

function clean(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text || text.length > max) return ''
  if (containsUnsafeSourceLeakage(text)) return ''
  return text
}

export function createCategoryIntroTarget(): TargetDefinition<CategoryIntroProposal, CategoryIntroInput> {
  return {
    id: CATEGORY_INTRO_TARGET_ID,
    schemaName: 'category_intro',
    jsonSchema: JSON_SCHEMA,
    systemInstructions: [
      UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
      'You write category copy for an industrial B2B website: LITUBO, a manufacturer of food and',
      'packaging inspection equipment.',
      '',
      'Rules:',
      '- Use only the category name and the product names and summaries provided. Never invent a',
      '  specification, a certification, a customer or a performance number.',
      '- intro: 2 to 4 sentences, under 320 characters, written for a buyer comparing equipment. Say what',
      '  this family inspects and what usually decides the choice within it. No marketing filler.',
      '- seoTitle: under 65 characters, no trailing period, no site name suffix, not a verbatim copy of',
      '  the category name when that name is short.',
      '- seoDescription: 70 to 165 characters, concrete, no hype, no exclamation mark, no URL.',
      '- Write in English.',
    ].join('\n'),
    buildUserInput(input: CategoryIntroInput): string {
      const lines = [
        `Category: ${input.categoryName}`,
        `Locale: ${input.locale}`,
        '',
        'Products currently in this category:',
      ]
      if (input.products.length === 0) lines.push('(none)')
      for (const product of input.products) {
        lines.push(`- ${product.name}${product.summary ? `: ${product.summary}` : ''}`)
      }
      return lines.join('\n')
    },
    parseAndValidate(raw: unknown, _context: TargetValidationContext): TargetGenerationResult<CategoryIntroProposal> {
      const parsed = ProposalSchema.safeParse(raw)
      if (!parsed.success) {
        return { ok: false, error: 'The AI provider returned a response that could not be safely used.' }
      }
      const intro = clean(parsed.data.intro, INTRO_STORAGE_MAX)
      const seoTitle = clean(parsed.data.seoTitle, 120)
      const seoDescription = clean(parsed.data.seoDescription, 320)
      if (!intro) return { ok: false, error: 'The AI provider did not produce a usable introduction.' }
      if (!seoTitle) return { ok: false, error: 'The AI provider did not produce a usable search title.' }
      if (!seoDescription) return { ok: false, error: 'The AI provider did not produce a usable search description.' }
      return { ok: true, output: { intro, seoTitle, seoDescription } }
    },
  }
}
