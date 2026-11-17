import { z } from 'zod'
import {
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  buildSourceMaterialBlock,
  containsUnsafeSourceLeakage,
  sanitizeModelInputText,
  type AiGenerationInputBase,
  type TargetDefinition,
  type TargetGenerationResult,
  type TargetValidationContext,
} from '../aiTargetContract'

/**
 * Product Centre intake — one uploaded document, one proposed new product.
 *
 * The uploader names the code (it may differ from anything printed in the document), optionally adds
 * an instruction, and the model fills the parts a person would otherwise retype: name, model/series,
 * summary, SEO title and description, the best existing technical category, and parameter rows.
 *
 * The whole point of this target is what it refuses to do. A document that does not state a value
 * leaves it empty; a model that invents a certification, an accuracy, a throughput or a lead time has
 * its item dropped. Nothing here creates a product — the caller stores the proposal against a
 * one-time reference and a person presses one button.
 */
export const PRODUCT_INTAKE_TARGET_ID = 'product-intake'

export const INTAKE_LIMITS = {
  name: 200,
  modelOrSeries: 100,
  summary: 600,
  seoTitle: 120,
  seoDescription: 320,
  group: 120,
  parameter: 200,
  value: 500,
  specs: 40,
} as const

export interface IntakeSpecRow {
  group: string
  parameter: string
  value: string
}

export interface ProductIntakeProposal {
  name: string
  modelOrSeries: string
  summary: string
  seoTitle: string
  seoDescription: string
  /** An id from the supplied category list, or 0 when the document does not make it clear. */
  categoryId: number
  specs: IntakeSpecRow[]
}

export interface ProductIntakeInput extends AiGenerationInputBase {
  productCode: string
  instruction: string | null
  categories: Array<{ id: number, name: string }>
}

export const PRODUCT_INTAKE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    modelOrSeries: { type: 'string' },
    summary: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    categoryId: { type: 'integer' },
    specs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          group: { type: 'string' },
          parameter: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['group', 'parameter', 'value'],
      },
    },
  },
  required: ['name', 'modelOrSeries', 'summary', 'seoTitle', 'seoDescription', 'categoryId', 'specs'],
} as const

const RawSchema = z.object({
  name: z.string(),
  modelOrSeries: z.string(),
  summary: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  categoryId: z.number().int(),
  specs: z.array(z.object({ group: z.string(), parameter: z.string(), value: z.string() })).max(200),
}).strict()

const MALFORMED = 'The AI provider returned a response that could not be safely used.'
const NO_NAME = 'The document did not yield a usable product name. Nothing was created.'

/** Trimmed, capped, and refused if it carries a link, a path or a line break. */
function clean(value: string, max: number): string | null {
  const v = value.trim()
  if (!v || v.length > max) return null
  if (containsUnsafeSourceLeakage(v)) return null
  return v
}

export function createProductIntakeTarget(allowedCategoryIds: readonly number[]): TargetDefinition<ProductIntakeProposal, ProductIntakeInput> {
  function parseAndValidate(raw: unknown, _validation: TargetValidationContext): TargetGenerationResult<ProductIntakeProposal> {
    const structural = RawSchema.safeParse(raw)
    if (!structural.success) return { ok: false, error: MALFORMED }
    const d = structural.data

    const name = clean(d.name, INTAKE_LIMITS.name)
    // Without a name there is no product to create, and a made-up name would be worse than a refusal.
    if (!name) return { ok: false, error: NO_NAME }

    const specs: IntakeSpecRow[] = []
    const seen = new Set<string>()
    for (const row of d.specs) {
      const group = clean(row.group, INTAKE_LIMITS.group)
      const parameter = clean(row.parameter, INTAKE_LIMITS.parameter)
      const value = clean(row.value, INTAKE_LIMITS.value)
      if (!group || !parameter || !value) continue
      const key = `${group.toLowerCase()}|${parameter.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      specs.push({ group, parameter, value })
      if (specs.length >= INTAKE_LIMITS.specs) break
    }

    return {
      ok: true,
      output: {
        name,
        modelOrSeries: clean(d.modelOrSeries, INTAKE_LIMITS.modelOrSeries) ?? '',
        summary: clean(d.summary, INTAKE_LIMITS.summary) ?? '',
        seoTitle: clean(d.seoTitle, INTAKE_LIMITS.seoTitle) ?? '',
        seoDescription: clean(d.seoDescription, INTAKE_LIMITS.seoDescription) ?? '',
        categoryId: allowedCategoryIds.includes(d.categoryId) ? d.categoryId : 0,
        specs,
      },
    }
  }

  function buildUserInput(input: ProductIntakeInput): string {
    const categoryLines = input.categories.length
      ? input.categories.map(c => `- ${c.id}: ${sanitizeModelInputText(c.name, 80)}`).join('\n')
      : '- None configured'
    return (
      'This product is being created from one uploaded document.\n'
      + `The person assigned product code: ${sanitizeModelInputText(input.productCode, 60)}\n`
      + (input.instruction ? `Instruction from the person: ${sanitizeModelInputText(input.instruction, 400)}\n` : '')
      + `\nAvailable technical categories:\n${categoryLines}\n`
      + '\nFill these from the document only:'
      + `\nname: the product name as the document states it, at most ${INTAKE_LIMITS.name} characters.`
      + `\nmodelOrSeries: the model or series designation the document uses, or empty when it does not name one.`
      + `\nsummary: two sentences for a listing card, at most ${INTAKE_LIMITS.summary} characters.`
      + `\nseoTitle: at most ${INTAKE_LIMITS.seoTitle} characters.\nseoDescription: at most ${INTAKE_LIMITS.seoDescription} characters.`
      + '\ncategoryId: the single best-fitting id from the list, or 0 when the document does not make it clear.'
      + `\nspecs: up to ${INTAKE_LIMITS.specs} rows of group / parameter / value that the document states, with the unit exactly as written. Omit anything the document does not state.`
      + '\nNever invent a specification, accuracy, throughput, certification, standard, material, price or lead time. '
      + 'Never copy a value that belongs to a different model. '
      + 'If the document covers several models, take only the model the person assigned unless the document is clearly about one model.'
      + '\n\n'
      + buildSourceMaterialBlock(input.extractedSourceTexts)
    )
  }

  return {
    id: PRODUCT_INTAKE_TARGET_ID,
    schemaName: 'product_intake',
    jsonSchema: PRODUCT_INTAKE_JSON_SCHEMA,
    systemInstructions:
      UNTRUSTED_SOURCE_MATERIAL_PREAMBLE
      + ' You prepare a new product record for internal review from one uploaded document. '
      + 'A person checks it and publishes; nothing is sent to a customer. '
      + 'Use only what the document states. Never invent a product, a model, a specification, an accuracy, a throughput, a certification, a standard, a material, a country, a price or a lead time. '
      + 'When the document does not state something, leave that field empty or out. '
      + 'Write in English, plainly. Never mention a file name, a page number or a download link in the output.',
    buildUserInput,
    parseAndValidate,
  }
}
