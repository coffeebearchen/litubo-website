import OpenAI from 'openai'
import {
  parseSpecificationProposalResponse,
  type SpecificationProposalResult,
} from './aiSpecificationProposal'

/**
 * PWS-AI-PLATFORM-01 — server-only OpenAI provider foundation.
 *
 * This file is never imported by a `.vue` file, a `pages/`/`components/`
 * module, or anything else that ships to the browser — only by future
 * `server/api/**` endpoints. `OPENAI_API_KEY` and `OPENAI_MODEL` are read
 * from `useRuntimeConfig()` (server-only fields, never `runtimeConfig.public`)
 * by the caller and passed in as plain config, exactly like the existing
 * `directusToken`/`directusUrl` pattern in `adminDirectusClient.ts`.
 *
 * No Generate/Review/Apply UI exists yet, and this module's own
 * `generateSpecificationProposal()` is never called by this task's tests or
 * by any shipped page — `isConfigured()` fails closed whenever the key or
 * model is unset, which is the case for every automated test and for this
 * repository until an operator sets real values in their own `.env`.
 */

/** Non-sensitive scope description for a future Generate call — file names and types only, never raw content, a UUID, or a path. */
export interface GenerateSpecificationProposalInput {
  productName: string
  sourceFileSummaries: Array<{ displayName: string, fileType: string }>
  /** Optional, human-approved free text the admin typed in — never raw file content. */
  contextNote?: string
}

export interface SpecificationProposalProviderConfig {
  apiKey: string
  model: string
}

/**
 * Injected so automated tests can exercise every success/failure path with a
 * mock, without ever constructing an OpenAI client or reaching the network.
 * `defaultOpenAiModelCaller` below is the only implementation that does.
 */
export type ModelCaller = (
  input: GenerateSpecificationProposalInput,
  config: SpecificationProposalProviderConfig,
) => Promise<unknown>

export interface SpecificationProposalProvider {
  isConfigured(): boolean
  generateSpecificationProposal(input: GenerateSpecificationProposalInput): Promise<SpecificationProposalResult>
}

const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const CALL_FAILED_ERROR = 'The AI provider could not generate a proposal right now.'

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
                note: { type: 'string' },
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
 * The real network call — OpenAI Responses API with Structured Outputs, so
 * the model is constrained to exactly the safe shape above. This function is
 * a thin wire adapter only: it does no validation of its own, because
 * `parseSpecificationProposalResponse()` is the single place that decides
 * what is safe to trust, regardless of what the API returns.
 */
async function defaultOpenAiModelCaller(
  input: GenerateSpecificationProposalInput,
  config: SpecificationProposalProviderConfig,
): Promise<unknown> {
  const client = new OpenAI({ apiKey: config.apiKey })

  const fileList = input.sourceFileSummaries
    .map(f => `- ${f.displayName} (${f.fileType})`)
    .join('\n')

  const response = await client.responses.create({
    model: config.model,
    input: [
      {
        role: 'system',
        content:
          'You produce structured product specification proposals for internal review. '
          + 'Only use the provided source materials. Never invent values you cannot support.',
      },
      {
        role: 'user',
        content:
          `Product: ${input.productName}\n`
          + `Approved source materials (already associated with this product):\n${fileList}\n`
          + (input.contextNote ? `Additional approved context: ${input.contextNote}\n` : '')
          + 'Propose specification groups and parameters supported by these materials.',
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'specification_proposal',
        schema: SPECIFICATION_PROPOSAL_JSON_SCHEMA,
        strict: true,
      },
    },
  })

  return JSON.parse(response.output_text)
}

/**
 * Factory for the OpenAI-backed provider. `callModel` defaults to the real
 * network implementation but is always overridable — every automated test
 * in this task supplies a mock instead.
 */
export function createOpenAiSpecificationProvider(
  config: SpecificationProposalProviderConfig,
  callModel: ModelCaller = defaultOpenAiModelCaller,
): SpecificationProposalProvider {
  function isConfigured(): boolean {
    return Boolean(config.apiKey.trim() && config.model.trim())
  }

  async function generateSpecificationProposal(
    input: GenerateSpecificationProposalInput,
  ): Promise<SpecificationProposalResult> {
    if (!isConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR }

    let raw: unknown
    try {
      raw = await callModel(input, config)
    } catch {
      return { ok: false, error: CALL_FAILED_ERROR }
    }

    return parseSpecificationProposalResponse(raw)
  }

  return { isConfigured, generateSpecificationProposal }
}
