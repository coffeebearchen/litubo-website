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
 * The assistant's SEO target: one article's search title and search description.
 *
 * Storage caps (the columns' real limits) and editorial lengths are different numbers on purpose. A
 * value can be storable but bad for search, so the target reports what it produced and the review
 * surface shows the counts; the parser refuses values that cannot be stored or that carry material a
 * search result must never contain (a URL, a path, a line break).
 */
export const SEO_META_TARGET_ID = 'seo-meta'

/** What the columns accept. */
export const SEO_TITLE_STORAGE_MAX = 120
export const SEO_DESCRIPTION_STORAGE_MAX = 320

/** What a search result actually shows. Used for prompt guidance and the UI counters. */
export const SEO_TITLE_IDEAL_MIN = 30
export const SEO_TITLE_IDEAL_MAX = 65
export const SEO_DESCRIPTION_IDEAL_MIN = 70
export const SEO_DESCRIPTION_IDEAL_MAX = 165

export interface SeoMetaProposal {
  seoTitle: string
  seoDescription: string
}

export interface SeoMetaInput extends AiGenerationInputBase {
  /** What kind of page this is, so the model writes for a guide, a FAQ entry or a product. */
  kind: string
  locale: string
  title: string
  excerpt: string
  /** Plain text, already stripped of HTML and truncated by the caller. */
  body: string
}

const ProposalSchema = z.object({
  seoTitle: z.string(),
  seoDescription: z.string(),
}).strict()

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['seoTitle', 'seoDescription'],
  properties: {
    seoTitle: { type: 'string', minLength: 1, maxLength: SEO_TITLE_STORAGE_MAX },
    seoDescription: { type: 'string', minLength: 1, maxLength: SEO_DESCRIPTION_STORAGE_MAX },
  },
}

function clean(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.length > max) return ''
  if (containsUnsafeSourceLeakage(trimmed)) return ''
  return trimmed
}

export function createSeoMetaTarget(): TargetDefinition<SeoMetaProposal, SeoMetaInput> {
  return {
    id: SEO_META_TARGET_ID,
    schemaName: 'seo_meta',
    jsonSchema: JSON_SCHEMA,
    systemInstructions: [
      UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
      'You write search metadata for an industrial B2B website: LITUBO, a manufacturer of food and',
      'packaging inspection equipment (metal detection, checkweighers, X-ray inspection, combination',
      'systems, conveyors and reject systems).',
      '',
      'Rules:',
      '- Use only the material provided. Never introduce a number, certification, customer name,',
      '  country, capacity or performance claim that is not in it.',
      '- seoTitle: a plain search title, roughly 30 to 65 characters, no trailing period, no site name',
      '  suffix, and not a verbatim copy of the working title - rewrite it the way someone would search',
      '  for this page, while staying accurate.',
      '- seoDescription: one or two sentences, roughly 70 to 165 characters, concrete and useful, no',
      '  hype (best, leading, number one, guaranteed), no call to action that promises a result.',
      '- Never write a URL, a file path, an email address or a line break into either field.',
      '- Write in the language given. If the material is too thin to describe the page honestly, still',
      '  return a title and description built only from what is there - never invent a topic.',
      '- A blog post, technical guide or FAQ entry is not a product: do not turn it into a product pitch.',
    ].join('\n'),
    buildUserInput(input: SeoMetaInput): string {
      return [
        'Page metadata to write.',
        '',
        `Locale: ${input.locale}`,
        `Page kind: ${input.kind}`,
        '',
        'Title:',
        input.title || '(none)',
        '',
        'Summary:',
        input.excerpt || '(none)',
        '',
        'Body excerpt:',
        input.body || '(none)',
      ].join('\n')
    },
    parseAndValidate(raw: unknown, _context: TargetValidationContext): TargetGenerationResult<SeoMetaProposal> {
      const parsed = ProposalSchema.safeParse(raw)
      if (!parsed.success) {
        return { ok: false, error: 'The AI provider returned a response that could not be safely used.' }
      }
      const seoTitle = clean(parsed.data.seoTitle, SEO_TITLE_STORAGE_MAX)
      const seoDescription = clean(parsed.data.seoDescription, SEO_DESCRIPTION_STORAGE_MAX)
      if (!seoTitle) {
        return { ok: false, error: 'The AI provider did not produce a usable search title.' }
      }
      if (!seoDescription) {
        return { ok: false, error: 'The AI provider did not produce a usable search description.' }
      }
      return { ok: true, output: { seoTitle, seoDescription } }
    },
  }
}
