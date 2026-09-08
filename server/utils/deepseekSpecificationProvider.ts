import { parseSpecificationProposalResponse, type SpecificationProposalResult } from './aiSpecificationProposal'
import type { AiSpecificationProvider, GenerateSpecificationProposalInput } from './aiProviderRegistry'

/**
 * PWS-AI-PROVIDER-02 — server-only DeepSeek provider adapter.
 *
 * A fully independent adapter, not a thin re-skin of the OpenAI one: it
 * calls DeepSeek's own Chat Completions endpoint directly over `fetch` (no
 * shared HTTP client, no shared SDK), builds its own request body, and
 * handles its own capability boundary. DeepSeek's public API does not offer
 * the same strict `json_schema` Structured-Outputs mode the OpenAI adapter
 * uses — only a looser `json_object` mode that guarantees valid JSON but not
 * a specific shape — so this adapter compensates by spelling out the exact
 * required shape in the prompt text itself, and then relies on the same
 * `parseSpecificationProposalResponse()` used by every other provider as the
 * one place that actually decides whether the result is safe to trust.
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

export interface DeepSeekProviderConfig {
  apiKey: string
  model: string
}

/**
 * Injected so automated tests can exercise every success/failure path with a
 * mock, without ever issuing a real `fetch` to DeepSeek. `defaultDeepSeekModelCaller`
 * below is the only implementation that does.
 */
export type DeepSeekModelCaller = (
  input: GenerateSpecificationProposalInput,
  config: DeepSeekProviderConfig,
) => Promise<unknown>

const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const CALL_FAILED_ERROR = 'The AI provider could not generate a proposal right now.'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000

/**
 * DeepSeek's `json_object` mode only guarantees syntactically valid JSON, so
 * the exact shape is spelled out here in plain text. `parseSpecificationProposalResponse()`
 * is the actual safety boundary regardless of how well the model follows this.
 */
const SHAPE_INSTRUCTIONS = `Respond with a single JSON object of exactly this shape, and nothing else:
{"groups": [{"group": "<group name>", "items": [{"parameter": "<parameter name>", "value": "<value>", "note": "<optional short note>"}]}]}
Every group must have at least one item. "note" may be omitted. Do not include any other field.`

/**
 * The real network call — DeepSeek Chat Completions with `response_format:
 * { type: "json_object" }`. This function is a thin wire adapter only: it
 * does no validation of its own, because `parseSpecificationProposalResponse()`
 * is the single place that decides what is safe to trust, regardless of
 * what the API returns.
 */
async function defaultDeepSeekModelCaller(
  input: GenerateSpecificationProposalInput,
  config: DeepSeekProviderConfig,
): Promise<unknown> {
  const fileList = input.sourceFileSummaries
    .map(f => `- ${f.displayName} (${f.fileType})`)
    .join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You produce structured product specification proposals for internal review. '
              + 'Only use the provided source materials. Never invent values you cannot support.\n'
              + SHAPE_INSTRUCTIONS,
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
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw new Error(`DeepSeek request failed with status ${response.status}`)

  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response had no message content')

  return JSON.parse(content)
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
