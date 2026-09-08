import OpenAI from 'openai'
import type { AiGenerationInput, TargetDefinition, TargetGenerationResult } from './aiTargetContract'
import type { AiStructuredProvider } from './aiProviderRegistry'

/**
 * PWS-AI-ENGINE-01R — server-only DeepSeek adapter, Target-neutral. Started
 * life as the Specifications-only `deepseekSpecificationProvider.ts`
 * (PWS-AI-PROVIDER-02-FIX-JSON-SCHEMA-01); this round generalizes it to take
 * a `TargetDefinition` per call instead of hardcoding the Specifications
 * prompt/schema.
 *
 * Uses DeepSeek's own documented Responses API (per
 * api-docs.deepseek.com/guides/responses_api, verified 2026-09-08): the
 * documented integration path is the official OpenAI Node/Python SDK,
 * pointed at DeepSeek's `base_url`, calling `client.responses.create()`.
 * DeepSeek's docs describe `text`/`format` support as "fully supported"
 * without OpenAI's `strict: true` guarantee language, so this adapter's
 * `text.format` object only ever sends the officially documented `type` /
 * `name` / `schema` fields — never `strict`. `target.parseAndValidate()`
 * remains the actual, provider-independent safety boundary regardless of
 * how closely DeepSeek follows the schema.
 *
 * Remains a fully independent adapter file from the OpenAI provider module
 * (own config type, own default model caller, own error handling) — the two
 * files share no code and neither imports the other; they both use the
 * `openai` SDK only because that is DeepSeek's own documented way to reach
 * its Responses API.
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
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: DeepSeekProviderConfig,
) => Promise<unknown>

const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const CALL_FAILED_ERROR = 'The AI provider could not generate a proposal right now.'

/**
 * The real network call — DeepSeek's documented Responses API, reached via
 * the official OpenAI SDK pointed at DeepSeek's `base_url`, with
 * `text.format.type: 'json_schema'` structured output constrained to the
 * Target's own JSON Schema. This function is a thin wire adapter only: it
 * does no validation of its own, because `target.parseAndValidate()` is the
 * single place that decides what is safe to trust.
 */
/**
 * Zero automatic retries and a 30s request timeout. Two distinct mechanisms,
 * described accurately (PWS-AI-ENGINE-01R2-SAFETY-02):
 *
 *  - `timeout` on the SDK client aborts the underlying HTTP request itself,
 *    and `maxRetries: 0` means one attempt only — no retry, and this project
 *    never falls back to the other provider.
 *  - `withCallDeadline()` below additionally bounds how long THIS FUNCTION's
 *    caller waits, covering an injected or future `callModel` that hangs
 *    without ever reaching the SDK. It is a caller wait limit, not a
 *    cancellation of work already in flight — the SDK's own timeout is what
 *    cancels the network call.
 */
const REQUEST_TIMEOUT_MS = 30_000

const CALL_DEADLINE_MS = REQUEST_TIMEOUT_MS + 5_000

/**
 * A unique Symbol, not a string: a model response is arbitrary provider data,
 * and a sentinel a provider could itself return is a sentinel that can be
 * spoofed. No JSON payload can ever equal this value.
 */
const DEADLINE_EXCEEDED = Symbol('provider-call-deadline-exceeded')

async function withCallDeadline<T>(work: Promise<T>): Promise<T | typeof DEADLINE_EXCEEDED> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<typeof DEADLINE_EXCEEDED>((resolve) => {
    timer = setTimeout(() => resolve(DEADLINE_EXCEEDED), CALL_DEADLINE_MS)
  })
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

async function defaultDeepSeekModelCaller(
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: DeepSeekProviderConfig,
): Promise<unknown> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: DEEPSEEK_BASE_URL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 })

  const response = await client.responses.create({
    model: config.model,
    instructions: target.systemInstructions,
    input: target.buildUserInput(input),
    // DeepSeek's documented Responses API only specifies `type`, `name` and
    // `schema` for json_schema structured output — `strict` is an OpenAI-only
    // guarantee this adapter must not claim or depend on.
    text: {
      format: {
        type: 'json_schema',
        name: target.schemaName,
        schema: target.jsonSchema,
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
export function createDeepSeekStructuredProvider(
  config: DeepSeekProviderConfig,
  callModel: DeepSeekModelCaller = defaultDeepSeekModelCaller,
): AiStructuredProvider {
  function isConfigured(): boolean {
    return Boolean(config.apiKey.trim() && config.model.trim())
  }

  async function generateStructured<TOutput>(
    target: TargetDefinition<TOutput>,
    input: AiGenerationInput,
  ): Promise<TargetGenerationResult<TOutput>> {
    if (!isConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR }

    let raw: unknown
    try {
      raw = await withCallDeadline(callModel(target as TargetDefinition<unknown>, input, config))
    } catch {
      return { ok: false, error: CALL_FAILED_ERROR }
    }
    if (raw === DEADLINE_EXCEEDED) return { ok: false, error: CALL_FAILED_ERROR }

    const sourceMaterial = input.extractedSourceTexts.map(s => s.text).join('\n\n')
    return target.parseAndValidate(raw, { sourceMaterial })
  }

  return { isConfigured, generateStructured }
}
