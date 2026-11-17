import { z } from 'zod'
import {
  containsUnsafeSourceLeakage,
  sanitizeModelInputText,
  type AiGenerationInputBase,
  type TargetDefinition,
  type TargetGenerationResult,
} from '../aiTargetContract'

/**
 * Product Centre — AI assistance for the listing copy of one product: its short summary, its SEO
 * title and description, and which of the existing technical categories it belongs to.
 *
 * This is deliberately a *suggestion* target. It writes nothing itself; the caller stores the
 * proposal against a one-time reference and a person accepts items field by field. The product must
 * be a Draft for either step, so AI can never touch something under review or already published
 * (RSG-04).
 *
 * What it cannot do, by grammar rather than by instruction:
 *
 *  - It cannot rename the product, change its slug or code, change its status, publish it, archive
 *    it, or attach media. Those fields are not in the output.
 *  - It cannot invent a category: `categoryId` must be one of the ids the server put in the prompt,
 *    and anything else is dropped before the proposal is returned.
 *  - It cannot state specifications, certifications, throughput, accuracy or lead times. The prompt
 *    forbids them and the values are re-read from the record, not asked for.
 */
export const PRODUCT_LISTING_TARGET_ID = 'product-listing'

/** The same limits the manual editors enforce, so a proposal cannot write what a form would refuse. */
export const LISTING_LIMITS = { summary: 600, seoTitle: 120, seoDescription: 320 } as const

export interface ProductListingProposal {
  summary: string
  seoTitle: string
  seoDescription: string
  /** An id from the supplied category list, or null for "leave the category alone". */
  categoryId: number | null
}

export interface ProductListingInput extends AiGenerationInputBase {
  product: {
    name: string
    code: string | null
    modelOrSeries: string | null
    summary: string | null
    currentCategory: string | null
  }
  categories: Array<{ id: number, name: string }>
}

export const PRODUCT_LISTING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    categoryId: { type: 'integer' },
  },
  required: ['summary', 'seoTitle', 'seoDescription', 'categoryId'],
} as const

const RawSchema = z.object({
  summary: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  categoryId: z.number().int(),
}).strict()

const MALFORMED = 'The AI provider returned a response that could not be safely used.'
const NO_SUMMARY = 'The AI provider did not return a usable summary.'

/** Trimmed, capped, and refused if it carries a link, a path or a line break. */
function clean(value: string, max: number): string | null {
  const v = value.trim()
  if (!v || v.length > max) return null
  if (containsUnsafeSourceLeakage(v)) return null
  return v
}

export function createProductListingTarget(allowedCategoryIds: readonly number[]): TargetDefinition<ProductListingProposal, ProductListingInput> {
  function parseAndValidate(raw: unknown): TargetGenerationResult<ProductListingProposal> {
    const structural = RawSchema.safeParse(raw)
    if (!structural.success) return { ok: false, error: MALFORMED }

    const summary = clean(structural.data.summary, LISTING_LIMITS.summary)
    if (!summary) return { ok: false, error: NO_SUMMARY }

    // Each field is optional in practice: an unusable one becomes '' and the editor simply cannot
    // accept it, rather than failing the whole proposal.
    const seoTitle = clean(structural.data.seoTitle, LISTING_LIMITS.seoTitle) ?? ''
    const seoDescription = clean(structural.data.seoDescription, LISTING_LIMITS.seoDescription) ?? ''
    const categoryId = allowedCategoryIds.includes(structural.data.categoryId) ? structural.data.categoryId : null

    return { ok: true, output: { summary, seoTitle, seoDescription, categoryId } }
  }

  function buildUserInput(input: ProductListingInput): string {
    const line = (label: string, value: string | null, max = 120) =>
      `${label}: ${value ? sanitizeModelInputText(value, max) : '(not set)'}\n`
    const categoryLines = input.categories.length
      ? input.categories.map(c => `- ${c.id}: ${sanitizeModelInputText(c.name, 80)}`).join('\n')
      : '- None configured'
    return (
      'Current product record:\n'
      + line('Product name', input.product.name, 200)
      + line('Product code', input.product.code, 60)
      + line('Model / series', input.product.modelOrSeries, 100)
      + line('Current summary', input.product.summary, 600)
      + line('Current technical category', input.product.currentCategory, 80)
      + `\nAvailable technical categories:\n${categoryLines}\n`
      + '\nWrite, in English:'
      + `\nsummary: two sentences for a product listing card, at most ${LISTING_LIMITS.summary} characters.`
      + `\nseoTitle: a search-friendly title, at most ${LISTING_LIMITS.seoTitle} characters.`
      + `\nseoDescription: a meta description, at most ${LISTING_LIMITS.seoDescription} characters.`
      + '\ncategoryId: the id of the single best-fitting category from the list above, or 0 when none fits.'
      + '\nUse only what the record states. Never invent a specification, accuracy, throughput, certification, material, standard, price or lead time. '
      + 'Never mention a different model or series. Do not change the product name, code or slug.'
    )
  }

  return {
    id: PRODUCT_LISTING_TARGET_ID,
    schemaName: 'product_listing_copy',
    jsonSchema: PRODUCT_LISTING_JSON_SCHEMA,
    systemInstructions:
      'You write listing copy for one industrial inspection product, for an internal editor to review. '
      + 'Everything you write must be supported by the product record you are given. '
      + 'Never invent or imply a specification, a detection capability, an accuracy, a throughput, a certification, a standard, a material, a price or a lead time. '
      + 'Never write about a model other than the current one. '
      + 'Never propose a status, a publication, a media file or a URL. '
      + 'Write in English, plainly, without marketing superlatives.',
    buildUserInput,
    parseAndValidate,
  }
}
