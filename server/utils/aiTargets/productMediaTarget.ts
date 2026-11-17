import { z } from 'zod'
import {
  containsUnsafeSourceLeakage,
  sanitizeModelInputText,
  type AiGenerationInputBase,
  type TargetDefinition,
  type TargetGenerationResult,
} from '../aiTargetContract'

/**
 * Product Centre — which of a product's own pictures should be its hero, and what its alt text should
 * say.
 *
 * Honest limitation, stated in the prompt and in the UI: the model cannot see the images. It reasons
 * over file names, media titles and existing alt text only, so it proposes a *shortlist choice* for a
 * person to confirm — never an automatic placement. It also cannot invent a picture: the row id must
 * be one the server put in the prompt.
 */
export const PRODUCT_MEDIA_TARGET_ID = 'product-media'

export const ALT_MAX = 160

export interface ProductMediaProposal {
  /** `products_files.id` of the suggested hero, or 0 when the model declines to choose. */
  mediaRowId: number
  altText: string
}

export interface ProductMediaInput extends AiGenerationInputBase {
  product: { name: string, code: string | null, summary: string | null }
  media: Array<{ rowId: number, label: string, title: string | null, currentAlt: string | null }>
}

export const PRODUCT_MEDIA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mediaRowId: { type: 'integer' },
    altText: { type: 'string' },
  },
  required: ['mediaRowId', 'altText'],
} as const

const RawSchema = z.object({
  mediaRowId: z.number().int(),
  altText: z.string(),
}).strict()

const MALFORMED = 'The AI provider returned a response that could not be safely used.'

function clean(value: string, max: number): string | null {
  const v = value.trim()
  if (!v || v.length > max) return null
  if (containsUnsafeSourceLeakage(v)) return null
  return v
}

export function createProductMediaTarget(allowedRowIds: readonly number[]): TargetDefinition<ProductMediaProposal, ProductMediaInput> {
  function parseAndValidate(raw: unknown): TargetGenerationResult<ProductMediaProposal> {
    const structural = RawSchema.safeParse(raw)
    if (!structural.success) return { ok: false, error: MALFORMED }

    const mediaRowId = allowedRowIds.includes(structural.data.mediaRowId) ? structural.data.mediaRowId : 0
    const altText = clean(structural.data.altText, ALT_MAX) ?? ''

    // Returning "I cannot tell" is a legitimate answer: the person then chooses a picture themselves
    // and writes the alt. Turning that into a hard error would take the manual picker away with it.
    return { ok: true, output: { mediaRowId, altText } }
  }

  function buildUserInput(input: ProductMediaInput): string {
    const mediaLines = input.media.length
      ? input.media.map(m =>
        `- row ${m.rowId}: file "${sanitizeModelInputText(m.label, 120)}"`
        + (m.title ? `, media title "${sanitizeModelInputText(m.title, 120)}"` : ', no media title')
        + (m.currentAlt ? `, current alt "${sanitizeModelInputText(m.currentAlt, ALT_MAX)}"` : ', no alt text'),
      ).join('\n')
      : '- None'
    return (
      'Current product:\n'
      + `Name: ${sanitizeModelInputText(input.product.name, 200)}\n`
      + `Product code: ${input.product.code ? sanitizeModelInputText(input.product.code, 60) : '(not set)'}\n`
      + `Summary: ${input.product.summary ? sanitizeModelInputText(input.product.summary, 600) : '(not set)'}\n`
      + `\nPictures already linked to this product (you cannot see them; judge only by the text):\n${mediaLines}\n`
      + '\nChoose the single best picture to represent this product on a listing card, as mediaRowId, or 0 if the text does not tell you. '
      + `Then write altText: one plain sentence describing what that picture shows for a screen-reader user, at most ${ALT_MAX} characters. If the text you were given does not describe the picture, return an empty altText instead of a sentence about being unable to tell. `
      + 'Never name a specification, a certification, a measurement or a capability the text does not state. '
      + 'Never invent a file name or a row id that is not listed above.'
    )
  }

  return {
    id: PRODUCT_MEDIA_TARGET_ID,
    schemaName: 'product_hero_choice',
    jsonSchema: PRODUCT_MEDIA_JSON_SCHEMA,
    systemInstructions:
      'You help an internal editor choose which existing photograph represents a product, and write its alt text. '
      + 'You cannot see the pictures: use only the file names, media titles and alt text you are given, and say so by choosing 0 when they are not informative. '
      + 'Never invent a specification, a capability, a certification, a measurement or a customer. '
      + 'Never propose a file that is not in the list.',
    buildUserInput,
    parseAndValidate,
  }
}
