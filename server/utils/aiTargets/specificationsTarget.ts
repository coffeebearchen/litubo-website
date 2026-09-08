import { z } from 'zod'
import {
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  buildSourceMaterialBlock,
  containsUnsafeSourceLeakage,
  type AiGenerationInput,
  type TargetDefinition,
  type TargetGenerationResult,
} from '../aiTargetContract'

/**
 * PWS-AI-ENGINE-01R — the `specifications` Target, the first (and this
 * round's only) registered Target for the shared AI Proposal Engine.
 *
 * The model's output shape is deliberately narrower than the existing
 * Specifications editor's data model: only `group` / `parameter` / `value`.
 * The model is never asked for, and never allowed to supply, a `note` —
 * `.strict()` below means any extra key (including a model-invented `note`,
 * `source`, `page`, or `locator`) fails validation outright rather than
 * being silently dropped. A human reviewer can still add their own note
 * when editing a proposed item before Apply (see `WorkspaceAiProposalReview.vue`)
 * — that is user-authored text, not model output, and is unaffected by this
 * restriction.
 */

export const SpecificationProposalItemSchema = z.object({
  parameter: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(500),
}).strict()

export const SpecificationProposalGroupSchema = z.object({
  group: z.string().trim().min(1).max(200),
  items: z.array(SpecificationProposalItemSchema).min(1).max(100),
}).strict()

export const SpecificationProposalSchema = z.object({
  groups: z.array(SpecificationProposalGroupSchema).min(1).max(50),
}).strict()

export type SpecificationProposalItem = z.infer<typeof SpecificationProposalItemSchema>
export type SpecificationProposalGroup = z.infer<typeof SpecificationProposalGroupSchema>
export type SpecificationProposal = z.infer<typeof SpecificationProposalSchema>

const MALFORMED_RESPONSE_ERROR = 'The AI provider returned a response that could not be safely used.'
const NO_SAFE_ITEMS_ERROR = 'The AI provider\'s response did not contain any safely usable specification suggestions.'

const SPECIFICATION_PROPOSAL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    groups: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          group: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                parameter: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['parameter', 'value'],
            },
          },
        },
        required: ['group', 'items'],
      },
    },
  },
  required: ['groups'],
} as const

/**
 * Zod structural validation, followed by an independent server-side safety
 * scan on every `group`/`parameter`/`value` string — a value matching Zod's
 * `string` type can still be a URL, a UUID, a file path, or a page-number
 * locator the model leaked from the source material. Any item containing
 * such a value is dropped (not "cleaned" — dropping is the only way to
 * avoid guessing what a corrupted value was supposed to say); a group left
 * with zero items is dropped entirely; a response left with zero groups
 * after scanning is a safe failure, never an empty-but-"successful" result.
 */
function parseAndValidate(raw: unknown): TargetGenerationResult<SpecificationProposal> {
  const structural = SpecificationProposalSchema.safeParse(raw)
  if (!structural.success) return { ok: false, error: MALFORMED_RESPONSE_ERROR }

  const safeGroups = structural.data.groups
    .map(g => ({
      group: g.group,
      items: g.items.filter(it => !containsUnsafeSourceLeakage(it.parameter) && !containsUnsafeSourceLeakage(it.value)),
    }))
    .filter(g => g.items.length > 0 && !containsUnsafeSourceLeakage(g.group))

  if (safeGroups.length === 0) return { ok: false, error: NO_SAFE_ITEMS_ERROR }

  return { ok: true, output: { groups: safeGroups } }
}

function buildUserInput(input: AiGenerationInput): string {
  const fileList = input.sourceFileSummaries
    .map(f => `- ${f.displayName} (${f.fileType})`)
    .join('\n')
  return (
    `Product: ${input.productName}\n`
    + `Approved source materials (already associated with this product):\n${fileList}\n`
    + (input.contextNote ? `Additional approved context: ${input.contextNote}\n` : '')
    + 'Propose specification groups and parameters supported by these materials. '
    + 'Return only group, parameter and value for each item — do not include a note, source reference, or page number.\n\n'
    + buildSourceMaterialBlock(input.extractedSourceTexts)
  )
}

export const specificationsTarget: TargetDefinition<SpecificationProposal> = {
  id: 'specifications',
  schemaName: 'specification_proposal',
  jsonSchema: SPECIFICATION_PROPOSAL_JSON_SCHEMA,
  systemInstructions:
    UNTRUSTED_SOURCE_MATERIAL_PREAMBLE
    + ' You produce structured product specification proposals for internal review, each with a group, a parameter name, and a value only — never a note, source citation, or locator.',
  buildUserInput,
  parseAndValidate,
}
