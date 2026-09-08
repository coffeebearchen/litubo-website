import { z } from 'zod'
import {
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  buildSourceMaterialBlock,
  containsUnsafeSourceLeakage,
  normalizeForLeakageComparison,
  sanitizeModelInputText,
  type AiGenerationInput,
  type TargetDefinition,
  type TargetGenerationResult,
  type TargetValidationContext,
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

const OVERSIZED_RESPONSE_ERROR = 'The AI provider returned more suggestions than can be safely reviewed at once.'

/**
 * A model that regurgitates a long, contiguous run of the source material it
 * was given (instead of extracting a short structured fact) matches none of
 * `containsUnsafeSourceLeakage()`'s patterns — a copied sentence has no URL,
 * UUID, path, or file extension in it. Any 80+ normalized-character run that
 * also appears in the source material is treated as an unsafe echo. A genuine
 * short spec value ("0.8 mm", "IP65", "Stainless steel 304") is far shorter
 * than 80 characters and is never affected.
 *
 * PWS-AI-ENGINE-01R2-SAFETY-02 — this check runs on the ORDERED CONCATENATION
 * of every model-controlled string, not on each field in isolation. Checking
 * fields one at a time was trivially bypassable: a 158-character passage split
 * across two 79-character values (or spread over several items) passes every
 * per-field check while still delivering the whole passage to the reviewer's
 * screen. Because the shared normalization removes all whitespace, the
 * fragments rejoin into exactly the contiguous run they were cut from,
 * wherever the model chose to cut it.
 */
const MIN_UNSAFE_ECHO_LENGTH = 80

/** Hard ceilings on one proposal, checked before any scanning work — a 50x100 response must never turn into a CPU sink or a fragment-smuggling channel. */
const MAX_PROPOSAL_ITEMS = 200
const MAX_PROPOSAL_TOTAL_CHARS = 20_000

/** Every distinct 80-character window of the source, so each projection below costs one hash lookup per position instead of a full substring search. */
function buildSourceWindowSet(normalizedSourceMaterial: string): Set<string> {
  const windows = new Set<string>()
  for (let i = 0; i + MIN_UNSAFE_ECHO_LENGTH <= normalizedSourceMaterial.length; i++) {
    windows.add(normalizedSourceMaterial.slice(i, i + MIN_UNSAFE_ECHO_LENGTH))
  }
  return windows
}

function containsLongSourceEcho(normalizedValue: string, sourceWindows: Set<string>): boolean {
  for (let i = 0; i + MIN_UNSAFE_ECHO_LENGTH <= normalizedValue.length; i++) {
    if (sourceWindows.has(normalizedValue.slice(i, i + MIN_UNSAFE_ECHO_LENGTH))) return true
  }
  return false
}

/** Every model-controlled string in the exact order the model emitted it. */
function modelControlledStringsInOrder(groups: SpecificationProposal['groups']): string[] {
  return groups.flatMap(g => [g.group, ...g.items.flatMap(it => [it.parameter, it.value])])
}

/**
 * The ordered concatenations a split-up passage could be reassembled from.
 * One全-field concatenation is not enough on its own: a model that puts each
 * fragment in a `value` leaves the group/parameter labels sitting between
 * them, which breaks contiguity in that single string while the fragments
 * still line up perfectly for anyone reading the values down the column. So
 * each field role also gets its own ordered projection, plus per-item
 * parameter+value pairs for a passage split across an item's two fields.
 */
function echoProjections(groups: SpecificationProposal['groups']): string[] {
  return [
    modelControlledStringsInOrder(groups).join(''),
    groups.flatMap(g => g.items.map(it => it.value)).join(''),
    groups.flatMap(g => g.items.map(it => it.parameter)).join(''),
    groups.map(g => g.group).join(''),
    groups.flatMap(g => g.items.map(it => it.parameter + it.value)).join(''),
  ]
}

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
function parseAndValidate(raw: unknown, context: TargetValidationContext): TargetGenerationResult<SpecificationProposal> {
  const structural = SpecificationProposalSchema.safeParse(raw)
  if (!structural.success) return { ok: false, error: MALFORMED_RESPONSE_ERROR }

  const groups = structural.data.groups
  const allStrings = modelControlledStringsInOrder(groups)

  // Size ceilings first — before any scanning runs over the response.
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0)
  const totalChars = allStrings.reduce((n, s) => n + s.length, 0)
  if (totalItems > MAX_PROPOSAL_ITEMS || totalChars > MAX_PROPOSAL_TOTAL_CHARS) {
    return { ok: false, error: OVERSIZED_RESPONSE_ERROR }
  }

  // Aggregate echo check — the whole proposal fails together, because keeping
  // the "clean" fragments of a split-up passage would deliver the passage.
  const normalizedSourceMaterial = normalizeForLeakageComparison(context.sourceMaterial)
  if (normalizedSourceMaterial.length >= MIN_UNSAFE_ECHO_LENGTH) {
    const sourceWindows = buildSourceWindowSet(normalizedSourceMaterial)
    for (const projection of echoProjections(groups)) {
      if (containsLongSourceEcho(normalizeForLeakageComparison(projection), sourceWindows)) {
        return { ok: false, error: NO_SAFE_ITEMS_ERROR }
      }
    }
  }

  // Per-field pattern scan — a single bad value only drops its own item.
  const safeGroups = groups
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
    .map(f => `- ${sanitizeModelInputText(f.displayName, 60)} (${sanitizeModelInputText(f.fileType, 20)})`)
    .join('\n')
  const contextNote = input.contextNote ? sanitizeModelInputText(input.contextNote, 500) : ''
  return (
    `Product: ${sanitizeModelInputText(input.productName)}\n`
    + `Approved source materials (already associated with this product):\n${fileList}\n`
    + (contextNote ? `Additional approved context: ${contextNote}\n` : '')
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
