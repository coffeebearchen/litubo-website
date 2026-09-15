import { z } from 'zod'
import {
  CONTENT_ATTRIBUTION_GUARD,
  UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
  buildCurrentContentContext,
  buildSourceMaterialBlock,
  containsUnsafeSourceLeakage,
  normalizeForLeakageComparison,
  sanitizeModelInputText,
  type ContentGenerationInput,
  type TargetDefinition,
  type TargetGenerationResult,
  type TargetValidationContext,
} from '../aiTargetContract'
import { validateBlocks } from '../contentBlocks'
import type { ContentBlockType } from '../../../utils/contentBlocks'
import {
  CONTENT_SEO_DESCRIPTION_MAX,
  CONTENT_SEO_TITLE_MAX,
  CONTENT_SUMMARY_MAX,
  CONTENT_TITLE_MAX,
} from '../../../utils/contentSeo'

/**
 * CC-IMP-08 — the `content-draft` Target (CONTENT-CENTER-BLUEPRINT-V1 §17, §18).
 *
 * One content item, one locale, the working copy only. A proposal may change
 * exactly these paths:
 *
 *   field:title · field:summary · field:seo_title · field:seo_description   → set
 *   block:<existing block id>                                                → replace (same type)
 *   block:new                                                                → insert (allowed type, never image)
 *
 * Anything else — slug, canonical path, noindex, content type, status, media or
 * relations, publication or lifecycle — is outside the target grammar: a response
 * that names such a target fails structural validation as a whole and never
 * becomes a proposal. Block data always passes the existing block registry
 * (`validateBlocks`), exactly like a human save.
 *
 * The target record (content id + locale) and every existing value come from the
 * server-side subject, never from model output. The model gives `Source N`
 * labels as evidence only — no page, row or cell locator.
 *
 * `blockData` is a JSON object string rather than a nested schema so one strict
 * structured-output schema covers every block type; it is parsed and validated
 * here, and an item whose data does not parse or validate is dropped.
 */

export const CONTENT_DRAFT_TARGET_ID = 'content-draft'

export const CONTENT_FIELD_TARGET_LIMITS = {
  'field:title': CONTENT_TITLE_MAX,
  'field:summary': CONTENT_SUMMARY_MAX,
  'field:seo_title': CONTENT_SEO_TITLE_MAX,
  'field:seo_description': CONTENT_SEO_DESCRIPTION_MAX,
} as const

export type ContentFieldTarget = keyof typeof CONTENT_FIELD_TARGET_LIMITS

const BLOCK_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FIELD_TARGET_RE = /^field:(?:title|summary|seo_title|seo_description)$/
/** The complete grammar of an AI-proposable content path. */
export const CONTENT_TARGET_RE = new RegExp(`^(?:field:(?:title|summary|seo_title|seo_description)|block:new|block:${BLOCK_ID})$`)
const SOURCE_LABEL_RE = /^Source \d{1,2}$/

/** A placeholder id used only to validate the data of a proposed new block; the real id is generated at Apply (CC-IMP-09). */
const NEW_BLOCK_VALIDATION_ID = '00000000-0000-4000-8000-000000000000'

export interface ContentBlockProposal {
  type: ContentBlockType
  data: Record<string, unknown>
}

export type ContentProposalChange =
  | { target: ContentFieldTarget, operation: 'set', value: string, sources: string[] }
  | { target: `block:${string}`, operation: 'replace', block: ContentBlockProposal, sources: string[] }
  | { target: 'block:new', operation: 'insert', block: ContentBlockProposal, sources: string[] }

export interface ContentFieldConflict {
  target: ContentFieldTarget
  candidateValues: string[]
}

/** The validated model output. The server adds proposal item ids and existing values when it stores it. */
export interface ContentDraftModelOutput {
  changes: ContentProposalChange[]
  conflicts: ContentFieldConflict[]
}

export interface ContentDraftTargetContext {
  /** The content type's allowed block types (registry). */
  allowedBlocks: readonly ContentBlockType[]
  /** The working copy's existing blocks, by id and type. */
  blocks: ReadonlyArray<{ id: string, type: string }>
}

const RawItemSchema = z.object({
  target: z.string().regex(CONTENT_TARGET_RE),
  value: z.string().max(2000),
  blockType: z.string().max(40),
  blockData: z.string().max(20_000),
  sources: z.array(z.string().regex(SOURCE_LABEL_RE)).max(10),
}).strict()

const RawConflictSchema = z.object({
  target: z.string().regex(FIELD_TARGET_RE),
  candidateValues: z.array(z.string().trim().min(1).max(400)).min(2).max(6),
}).strict()

const RawOutputSchema = z.object({
  items: z.array(RawItemSchema).max(64),
  conflicts: z.array(RawConflictSchema).max(20),
}).strict()

/** Strict structured output: every property required, no additional properties (valid for OpenAI `strict: true` and DeepSeek). */
export const CONTENT_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          target: { type: 'string' },
          value: { type: 'string' },
          blockType: { type: 'string' },
          blockData: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['target', 'value', 'blockType', 'blockData', 'sources'],
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          target: { type: 'string' },
          candidateValues: { type: 'array', items: { type: 'string' } },
        },
        required: ['target', 'candidateValues'],
      },
    },
  },
  required: ['items', 'conflicts'],
} as const

const MALFORMED_RESPONSE_ERROR = 'The AI provider returned a response that could not be safely used.'
const NO_SAFE_ITEMS_ERROR = 'The AI provider\'s response did not contain any safely usable content suggestions.'
const OVERSIZED_RESPONSE_ERROR = 'The AI provider returned more suggestions than can be safely reviewed at once.'

/**
 * Prose is longer than a specification value, so a legitimately similar sentence
 * is more likely; the echo threshold is higher than the specifications Target's
 * 80 characters. A 200+ character run copied from the sources is still refused.
 */
const MIN_UNSAFE_ECHO_LENGTH = 200
const MAX_PROPOSAL_TOTAL_CHARS = 60_000

function stringLeaves(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value)
  else if (Array.isArray(value)) value.forEach(v => stringLeaves(v, into))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => stringLeaves(v, into))
  return into
}

function containsLongSourceEcho(normalizedValue: string, sourceWindows: Set<string>): boolean {
  for (let i = 0; i + MIN_UNSAFE_ECHO_LENGTH <= normalizedValue.length; i++) {
    if (sourceWindows.has(normalizedValue.slice(i, i + MIN_UNSAFE_ECHO_LENGTH))) return true
  }
  return false
}

function parseBlockData(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export function createContentDraftTarget(context: ContentDraftTargetContext): TargetDefinition<ContentDraftModelOutput, ContentGenerationInput> {
  const insertableTypes = context.allowedBlocks.filter(type => type !== 'image')
  const existingTypes = new Map(context.blocks.map(b => [b.id.toLowerCase(), b.type]))

  function validateBlock(id: string, type: string, rawData: string): ContentBlockProposal | null {
    if (!(insertableTypes as readonly string[]).includes(type)) return null
    const data = parseBlockData(rawData)
    if (!data) return null
    const checked = validateBlocks([{ id, type, data }], insertableTypes)
    if (!checked.ok) return null
    const block = checked.blocks[0]!
    if (stringLeaves(block.data).some(containsUnsafeSourceLeakage)) return null
    return { type: block.type, data: block.data }
  }

  function parseAndValidate(raw: unknown, validation: TargetValidationContext): TargetGenerationResult<ContentDraftModelOutput> {
    const structural = RawOutputSchema.safeParse(raw)
    if (!structural.success) return { ok: false, error: MALFORMED_RESPONSE_ERROR }
    const { items, conflicts } = structural.data

    const allStrings = [
      ...items.flatMap(it => [it.value, it.blockData]),
      ...conflicts.flatMap(c => c.candidateValues),
    ]
    if (allStrings.reduce((n, s) => n + s.length, 0) > MAX_PROPOSAL_TOTAL_CHARS) {
      return { ok: false, error: OVERSIZED_RESPONSE_ERROR }
    }

    // Aggregate echo check across every model-controlled string and the text inside block data.
    const normalizedSource = normalizeForLeakageComparison(validation.sourceMaterial)
    if (normalizedSource.length >= MIN_UNSAFE_ECHO_LENGTH) {
      const windows = new Set<string>()
      for (let i = 0; i + MIN_UNSAFE_ECHO_LENGTH <= normalizedSource.length; i++) windows.add(normalizedSource.slice(i, i + MIN_UNSAFE_ECHO_LENGTH))
      const blockTexts = items.flatMap(it => stringLeaves(parseBlockData(it.blockData)))
      const projections = [
        items.map(it => it.value).join(''),
        blockTexts.join(''),
        [...items.map(it => it.value), ...blockTexts, ...conflicts.flatMap(c => c.candidateValues)].join(''),
      ]
      if (projections.some(p => containsLongSourceEcho(normalizeForLeakageComparison(p), windows))) {
        return { ok: false, error: NO_SAFE_ITEMS_ERROR }
      }
    }

    const changes: ContentProposalChange[] = []
    const seenTargets = new Set<string>()
    for (const item of items) {
      const target = item.target
      const sources = [...new Set(item.sources)]
      if (FIELD_TARGET_RE.test(target)) {
        const field = target as ContentFieldTarget
        const value = item.value.trim()
        if (seenTargets.has(field) || item.blockType !== '' || item.blockData !== '') continue
        if (!value || value.length > CONTENT_FIELD_TARGET_LIMITS[field] || containsUnsafeSourceLeakage(value)) continue
        seenTargets.add(field)
        changes.push({ target: field, operation: 'set', value, sources })
        continue
      }
      if (item.value !== '') continue
      if (target === 'block:new') {
        const block = validateBlock(NEW_BLOCK_VALIDATION_ID, item.blockType, item.blockData)
        if (block) changes.push({ target: 'block:new', operation: 'insert', block, sources })
        continue
      }
      const blockId = target.slice('block:'.length).toLowerCase()
      const existingType = existingTypes.get(blockId)
      if (!existingType || existingType !== item.blockType || seenTargets.has(`block:${blockId}`)) continue
      const block = validateBlock(blockId, item.blockType, item.blockData)
      if (!block) continue
      seenTargets.add(`block:${blockId}`)
      changes.push({ target: `block:${blockId}`, operation: 'replace', block, sources })
    }

    const safeConflicts: ContentFieldConflict[] = conflicts
      .map(c => ({ target: c.target as ContentFieldTarget, candidateValues: c.candidateValues.filter(v => !containsUnsafeSourceLeakage(v)) }))
      .filter(c => new Set(c.candidateValues.map(normalizeForLeakageComparison)).size >= 2)

    if (changes.length === 0 && safeConflicts.length === 0) return { ok: false, error: NO_SAFE_ITEMS_ERROR }
    return { ok: true, output: { changes, conflicts: safeConflicts } }
  }

  function buildUserInput(input: ContentGenerationInput): string {
    const fileList = input.sourceFileSummaries
      .map(f => `- ${sanitizeModelInputText(f.displayName, 60)} (${sanitizeModelInputText(f.fileType, 20)})`)
      .join('\n')
    const blockTypes = insertableTypes.length > 0 ? insertableTypes.join(', ') : 'none'
    return (
      buildCurrentContentContext(input.content)
      + `Approved source materials (already linked to this content item):\n${fileList}\n`
      + `Propose improvements to this content item's draft in the language of locale ${sanitizeModelInputText(input.content.locale, 10)}, supported only by these materials.\n`
      + 'Each item names one target: field:title, field:summary, field:seo_title, field:seo_description, '
      + 'block:<an existing section id listed above> to replace that section with the same type, or block:new to add a new section. '
      + 'For a field, put the proposed text in value and leave blockType and blockData empty. '
      + `For a section, leave value empty, set blockType to the section type (allowed new section types: ${blockTypes}) `
      + 'and blockData to a JSON object string for that type: text {"heading":"…","paragraphs":["…"]}; '
      + 'key_points {"heading":"…","items":[{"title":"…","body":"…"}]}; faq {"heading":"…","items":[{"question":"…","answer":"…"}]}; '
      + 'cta {"heading":"…","body":"…","label":"…","href":""}; related_content and downloads {"heading":"…"}. '
      + 'In sources, list only the labels of the materials that support the item, such as "Source 1" — never a page number, row, cell or file name.\n'
      + 'If two materials clearly disagree about a field, do not choose: leave it out of items and list it under conflicts with the values the materials gave. '
      + 'If the materials do not support a change, propose nothing for it.\n\n'
      + buildSourceMaterialBlock(input.extractedSourceTexts)
    )
  }

  return {
    id: CONTENT_DRAFT_TARGET_ID,
    schemaName: 'content_draft_proposal',
    jsonSchema: CONTENT_DRAFT_JSON_SCHEMA,
    systemInstructions:
      UNTRUSTED_SOURCE_MATERIAL_PREAMBLE
      + ' ' + CONTENT_ATTRIBUTION_GUARD
      + ' You produce structured draft proposals for one content item for internal human review. A person decides what, if anything, is applied to the draft.'
      + ' Propose only the title, the summary, the SEO title, the SEO description and the content sections of the working draft.'
      + ' Never propose or mention a slug, canonical path, noindex setting, content type, status, media file, image, download link, relation, publication, archiving or restoring.',
    buildUserInput,
    parseAndValidate,
  }
}
