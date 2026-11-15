import { z } from 'zod'
import {
  buildSourceMaterialBlock,
  containsUnsafeSourceLeakage,
  normalizeForLeakageComparison,
  sanitizeModelInputText,
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  type AiGenerationInputBase,
  type TargetDefinition,
  type TargetGenerationResult,
  type TargetValidationContext,
} from '../aiTargetContract'

export const VISITOR_ASSISTANT_PATHS = [
  '/contact',
  '/technical-matching',
  '/products',
  '/products/x-ray-inspection',
  '/products/metal-detection',
  '/products/checkweighers',
  '/products/combination-inspection',
  '/products/conveyors-reject-systems',
  '/support',
] as const

export interface VisitorAssistantInput extends AiGenerationInputBase {
  question: string
}

export interface VisitorAssistantAnswer {
  answer: string
  needsHuman: boolean
  topic: 'products' | 'selection' | 'support' | 'company' | 'other'
  suggestedPath: typeof VISITOR_ASSISTANT_PATHS[number]
  suggestedLabel: string
  followUpQuestion: string
}

const AnswerSchema = z.object({
  answer: z.string().trim().min(1).max(1000),
  needsHuman: z.boolean(),
  topic: z.enum(['products', 'selection', 'support', 'company', 'other']),
  suggestedPath: z.enum(VISITOR_ASSISTANT_PATHS),
  suggestedLabel: z.string().trim().min(1).max(80),
  followUpQuestion: z.string().trim().max(250),
}).strict()

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'needsHuman', 'topic', 'suggestedPath', 'suggestedLabel', 'followUpQuestion'],
  properties: {
    answer: { type: 'string', minLength: 1, maxLength: 1000 },
    needsHuman: { type: 'boolean' },
    topic: { type: 'string', enum: ['products', 'selection', 'support', 'company', 'other'] },
    suggestedPath: { type: 'string', enum: VISITOR_ASSISTANT_PATHS },
    suggestedLabel: { type: 'string', minLength: 1, maxLength: 80 },
    followUpQuestion: { type: 'string', maxLength: 250 },
  },
}

const MALFORMED = 'The assistant response could not be safely used.'
const MIN_ECHO_LENGTH = 180

function parseAndValidate(raw: unknown, context: TargetValidationContext): TargetGenerationResult<VisitorAssistantAnswer> {
  const result = AnswerSchema.safeParse(raw)
  if (!result.success) return { ok: false, error: MALFORMED }
  const output = result.data
  const prose = [output.answer, output.suggestedLabel, output.followUpQuestion]
  if (prose.some(value => containsUnsafeSourceLeakage(value))) return { ok: false, error: MALFORMED }

  const source = normalizeForLeakageComparison(context.sourceMaterial)
  const combined = normalizeForLeakageComparison(prose.join(' '))
  if (source.length >= MIN_ECHO_LENGTH) {
    for (let i = 0; i + MIN_ECHO_LENGTH <= combined.length; i++) {
      if (source.includes(combined.slice(i, i + MIN_ECHO_LENGTH))) return { ok: false, error: MALFORMED }
    }
  }
  return { ok: true, output }
}

export const visitorAssistantTarget: TargetDefinition<VisitorAssistantAnswer, VisitorAssistantInput> = {
  id: 'visitor-assistant',
  schemaName: 'visitor_assistant_answer',
  jsonSchema: JSON_SCHEMA,
  systemInstructions:
    UNTRUSTED_SOURCE_MATERIAL_PREAMBLE
    + ' You are the public LITUBO website assistant. Answer in concise professional English using only the approved public knowledge supplied in the source material.'
    + ' Never invent specifications, detection performance, certifications, customer cases, prices, delivery dates, warranties, factory ownership, or service coverage.'
    + ' Product parameters and project suitability require confirmation by a LITUBO engineer. When a question requires those details, set needsHuman to true and direct the visitor to contact or technical matching.'
    + ' Do not ask for confidential data, passwords, payment information, or sensitive production data. Do not claim that a message has been sent or that a person will reply by a specific time.',
  buildUserInput(input) {
    return (
      `Visitor question: ${sanitizeModelInputText(input.question, 800)}\n`
      + 'Answer from the approved public knowledge below. If it is not enough, say so briefly and suggest the appropriate human-contact path.\n\n'
      + buildSourceMaterialBlock(input.extractedSourceTexts)
    )
  },
  parseAndValidate,
}
