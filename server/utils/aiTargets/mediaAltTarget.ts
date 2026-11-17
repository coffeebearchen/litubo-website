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
 * Alt text for a Media Library file.
 *
 * This is the one piece of image work the assistant may do without seeing the picture: it works from
 * what the record already knows - the file name, any title an editor wrote, the product the file is
 * linked to, the folder it sits in. That is enough to describe a product photograph honestly and not
 * enough to invent a scene, which is exactly the boundary we want: no claim about what is in the frame
 * that the metadata does not support.
 *
 * An empty answer is legitimate and means "this file needs a human to look at it". The confirm endpoint
 * refuses to store an empty title, so the panel turns that into a nudge rather than a silent overwrite.
 */
export const MEDIA_ALT_TARGET_ID = 'media-alt'
export const ALT_STORAGE_MAX = 160
export const ALT_IDEAL_MAX = 125

export interface MediaAltProposal {
  altText: string
}

export interface MediaAltInput extends AiGenerationInputBase {
  filename: string
  currentTitle: string
  fileType: string
  productName: string | null
  folderName: string | null
}

const ProposalSchema = z.object({ altText: z.string() }).strict()

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['altText'],
  properties: {
    altText: { type: 'string', maxLength: ALT_STORAGE_MAX },
  },
}

export function createMediaAltTarget(): TargetDefinition<MediaAltProposal, MediaAltInput> {
  return {
    id: MEDIA_ALT_TARGET_ID,
    schemaName: 'media_alt',
    jsonSchema: JSON_SCHEMA,
    systemInstructions: [
      UNTRUSTED_SOURCE_MATERIAL_PREAMBLE,
      'You write alt text for images on an industrial B2B website: LITUBO, a manufacturer of food and',
      'packaging inspection equipment (metal detection, checkweighers, X-ray, combination systems).',
      '',
      'Rules:',
      '- Describe only what the supplied metadata supports: a product photograph of a named machine, a',
      '  document cover, an icon, a factory or line photograph. Never invent what is in the frame.',
      '- Under 125 characters. No "image of", no "photo of". No file name, no hash, no URL, no path.',
      '- If the file name reads like a title (several words joined by dashes), use it: describe the',
      '  illustration with it, for example "Illustration for the article on preparing a quotation".',
      '- If the metadata says nothing useful (a hash-like name, no title, no product), return an empty',
      '  string: a human should look at the picture. Do not guess.',
      '- Write in English.',
    ].join('\n'),
    buildUserInput(input: MediaAltInput): string {
      return [
        'Write alt text for one Media Library file.',
        '',
        `File name: ${input.filename || '(none)'}`,
        `Current title: ${input.currentTitle || '(none)'}`,
        `File type: ${input.fileType || '(unknown)'}`,
        `Linked product: ${input.productName ?? '(none)'}`,
        `Folder: ${input.folderName ?? '(none)'}`,
      ].join('\n')
    },
    parseAndValidate(raw: unknown, _context: TargetValidationContext): TargetGenerationResult<MediaAltProposal> {
      const parsed = ProposalSchema.safeParse(raw)
      if (!parsed.success) {
        return { ok: false, error: 'The AI provider returned a response that could not be safely used.' }
      }
      const altText = parsed.data.altText.replace(/\s+/g, ' ').trim()
      if (altText.length > ALT_STORAGE_MAX) {
        return { ok: false, error: 'The AI provider returned alt text that is too long to store.' }
      }
      if (altText && containsUnsafeSourceLeakage(altText)) {
        return { ok: false, error: 'The AI provider returned alt text with unusable content.' }
      }
      return { ok: true, output: { altText } }
    },
  }
}
