import OpenAI from 'openai'
import { parseSpecificationProposalResponse, type SpecificationProposalResult } from './aiSpecificationProposal'
import type { AiSpecificationProvider, GenerateSpecificationProposalInput } from './aiProviderRegistry'

/**
 * PWS-AI-PROVIDER-02-FIX-JSON-SCHEMA-01 — server-only DeepSeek provider
 * adapter, using DeepSeek's own documented Responses API.
 *
 * Per DeepSeek's official API docs (api-docs.deepseek.com/guides/responses_api,
 * verified 2026-09-08): "our API now supports the Responses API format, with
 * the base_url being https://api.deepseek.com" — the documented integration
 * path is the official OpenAI Node/Python SDK, pointed at that base URL,
 * calling `client.responses.create()`; the docs state the `text` parameter's
 * `format` is "fully supported", following OpenAI's own Responses API
 * structure. This adapter follows exactly that documented shape — it does
 * not invent an undocumented raw endpoint or field.
 *
 * This remains a fully independent adapter file from the OpenAI provider
 * module (own config type, own default model caller, own JSON Schema
 * constant, own prompt construction, own error handling) — the two files
 * share no code and neither imports the other. They both happen to use the
 * `openai` SDK
 * because DeepSeek's own documentation says that is the correct, documented
 * way to reach its Responses API — not because this adapter was simplified
 * into a copy of the OpenAI one.
 *
 * DeepSeek's Responses API does not offer the same strict-JSON-Schema
 * guarantee for every field constraint OpenAI's newer models support (per
 * the docs, `text`/`format` support is described only as "fully supported"
 * without the same `strict: true` guarantee language OpenAI documents) — so
 * the existing server-side Zod validation in `aiSpecificationProposal.ts`
 * remains the second, authoritative safety boundary regardless of how well
 * the model actually follows the schema.
 *
 * Text-only, first-version scope: this adapter only prepares a "text
 * material summary → structured specification proposal" call path. It does
 * not implement or call any image/PDF/Excel/DOCX upload, parsing, OCR,
 * vision, or file API of any kind.
 *
 * This file is never imported by a `.vue` file or anything else that ships
 * to the browser — only by future `server/api/**` endpoints, matching the
 * same server-only convention as the OpenAI adapter.
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export interface DeepSeekProviderConfig {
  apiKey: string
  model: string
}

/**
 * Injected so automated tests can exercise every success/failure path with a
 * mock, without ever constructing a real client or reaching the network.
 * `defaultDeepSeekModelCaller` below is the only implementation that does.
 */
export type DeepSeekModelCaller = (
  input: GenerateSpecificationProposalInput,
  config: DeepSeekProviderConfig,
) => Promise<unknown>

const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const CALL_FAILED_ERROR = 'The AI provider could not generate a proposal right now.'

/**
 * The canonical specification-proposal shape, expressed as its own local
 * JSON Schema literal for the DeepSeek Responses API call — kept separate
 * from the OpenAI adapter's own copy so the two adapters remain independent
 * and neither can drift the other by editing a shared constant.
 */
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
 * The real network call — DeepSeek's documented Responses API, reached via
 * the official OpenAI SDK pointed at DeepSeek's `base_url`, with
 * `text.format.type: 'json_schema'` structured output. This function is a
 * thin wire adapter only: it does no validation of its own, because
 * `parseSpecificationProposalResponse()` is the single place that decides
 * what is safe to trust, regardless of what the API returns.
 */
async function defaultDeepSeekModelCaller(
  input: GenerateSpecificationProposalInput,
  config: DeepSeekProviderConfig,
): Promise<unknown> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: DEEPSEEK_BASE_URL })

  const fileList = input.sourceFileSummaries
    .map(f => `- ${f.displayName} (${f.fileType})`)
    .join('\n')

  const response = await client.responses.create({
    model: config.model,
    instructions:
      'You produce structured product specification proposals for internal review. '
      + 'Only use the provided source materials. Never invent values you cannot support.',
    input:
      `Product: ${input.productName}\n`
      + `Approved source materials (already associated with this product):\n${fileList}\n`
      + (input.contextNote ? `Additional approved context: ${input.contextNote}\n` : '')
      + 'Propose specification groups and parameters supported by these materials.',
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
 * Factory for the DeepSeek-backed provider. `callModel` defaults to the real
 * network implementation but is always overridable — every automated test
 * in this task supplies a mock instead.
 */
export function createDeepSeekSpecificationProvider(
  config: DeepSeekProviderConfig,
  callModel: DeepSeekModelCaller = defaultDeepSeekModelCaller,
): AiSpecificationProvider {
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
