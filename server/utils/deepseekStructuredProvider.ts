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
 * api-docs.deepseek.com/guides/responses_api, verified 2026-09-08).
 * DeepSeek's docs describe `text`/`format` support as "fully supported"
 * without OpenAI's `strict: true` guarantee language, so this adapter's
 * `text.format` object only ever sends the officially documented `type` /
 * `name` / `schema` fields — never `strict`. `target.parseAndValidate()`
 * remains the actual, provider-independent safety boundary regardless of
 * how closely DeepSeek follows the schema.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the request is issued with native
 * `fetch` rather than the `openai` SDK. The project now runs on Node 22.22.2,
 * so the SDK's `engines` range is no longer the reason to avoid it; the SDK
 * was only ever an HTTP client for a documented JSON endpoint here. The
 * request and response shapes are unchanged.
 *
 * Remains a fully independent adapter file from the OpenAI provider module
 * (own config type, own default model caller, own error handling) — the two
 * files share no code and neither imports the other.
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

/**
 * PWS-AI-BETA-01R2 — the first real Beta call reached DeepSeek, consumed
 * tokens, and still produced nothing usable, and the then-current adapter
 * collapsed every transport failure into one sentence. The specific status was
 * constructed (`provider responded 401`) and then discarded by a bare `catch`,
 * so the failure could not be diagnosed afterwards at all.
 *
 * These categories are the fix. They are a CLOSED set of fixed strings: no
 * provider message, no raw payload, and no reasoning content ever reaches this
 * type. Everything a caller or a log line can learn about a failure is here.
 */
export type DeepSeekFailureCategory =
  | 'authentication_failed'
  | 'insufficient_balance'
  | 'invalid_request'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_incomplete'
  | 'provider_failed'
  | 'no_output_text'
  | 'invalid_json'
  | 'timeout'
  | 'network_error'

/** Fixed, short, safe. Nothing here is derived from provider output. */
export const DEEPSEEK_FAILURE_MESSAGES: Record<DeepSeekFailureCategory, string> = {
  authentication_failed: 'DeepSeek authentication failed.',
  insufficient_balance: 'DeepSeek account balance is insufficient.',
  invalid_request: 'DeepSeek rejected the request.',
  rate_limited: 'DeepSeek rate limit was reached.',
  provider_unavailable: 'DeepSeek service is temporarily unavailable.',
  provider_incomplete: 'DeepSeek returned an incomplete response.',
  provider_failed: 'DeepSeek reported that generation failed.',
  no_output_text: 'DeepSeek returned no final output.',
  invalid_json: 'DeepSeek returned final output that could not be parsed.',
  timeout: 'DeepSeek did not respond before the request timeout.',
  network_error: 'DeepSeek could not be reached.',
}

/**
 * Carries the category and, when they exist, the two pieces of metadata that
 * are safe to record: the HTTP status and the Responses `status` field. It
 * deliberately does NOT carry the provider's own error message or body.
 */
export class DeepSeekCallError extends Error {
  constructor(
    readonly category: DeepSeekFailureCategory,
    readonly httpStatus?: number,
    readonly responseStatus?: string,
  ) {
    super(category)
    this.name = 'DeepSeekCallError'
  }
}

/** HTTP status → category. Ordered most specific first. */
function categoryForHttpStatus(status: number): DeepSeekFailureCategory {
  if (status === 401) return 'authentication_failed'
  if (status === 402) return 'insufficient_balance'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_unavailable'
  if (status >= 400) return 'invalid_request'
  return 'provider_unavailable'
}

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
 *  - `AbortSignal.timeout()` aborts the underlying HTTP request itself, and a
 *    bare `fetch` performs exactly one attempt — no retry, and this project
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

/**
 * Pulls the model's FINAL answer out of a Responses API payload — and nothing
 * else.
 *
 * PWS-AI-BETA-01R2 — the previous version accepted any `chunk.text` it found
 * anywhere in `output`, without checking either `item.type` or `content.type`.
 * DeepSeek V4 Flash has thinking enabled by default, so a response can carry a
 * `reasoning` item alongside the `message` item. Under the old rule the
 * reasoning prose would be concatenated in front of the JSON answer and handed
 * to `JSON.parse`, which cannot succeed. This adapter now reads only what is
 * unambiguously the final output.
 *
 * The reasoning text is not returned, not logged, and not inspected — it is
 * skipped on the basis of its type alone.
 */
function readResponsesApiOutputText(payload: unknown): string {
  const body = payload as {
    output_text?: unknown
    output?: Array<{ type?: unknown, content?: Array<{ type?: unknown, text?: unknown }> }>
  }

  // The convenience field, when a provider computes it, already means "the
  // final text". Only a non-empty string counts.
  if (typeof body.output_text === 'string' && body.output_text.trim() !== '') {
    return body.output_text
  }

  const parts: string[] = []
  for (const item of body.output ?? []) {
    // `reasoning`, tool calls and anything else are skipped outright.
    if (item?.type !== 'message') continue
    for (const chunk of item.content ?? []) {
      // Within a message, only the final answer part — never `reasoning_text`,
      // `refusal`, or any other text-bearing field.
      if (chunk?.type === 'output_text' && typeof chunk.text === 'string') {
        parts.push(chunk.text)
      }
    }
  }

  if (parts.length === 0) throw new DeepSeekCallError('no_output_text')
  return parts.join('')
}

async function defaultDeepSeekModelCaller(
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: DeepSeekProviderConfig,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${DEEPSEEK_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        instructions: target.systemInstructions,
        input: target.buildUserInput(input),
        /**
         * PWS-AI-BETA-01R2 — thinking off.
         *
         * DeepSeek V4 Flash enables thinking by default at `effort: high`. The
         * first real Beta call spent 7,079 tokens on what is a structured
         * extraction task: read a document, emit a JSON object against a fixed
         * schema. There is no reasoning budget worth paying here, and a
         * reasoning item in the response is one more thing the parser above has
         * to step around.
         *
         * This is set for every structured call, not for one Target — the
         * adapter stays Target-neutral and does not inspect `target.id`. If a
         * future Target genuinely needs reasoning, that belongs in a provider
         * policy, not in a special case here.
         */
        reasoning: { effort: 'none' },
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
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    // `AbortSignal.timeout()` rejects with a TimeoutError; everything else at
    // this point is DNS, TLS, a refused connection or a proxy.
    const name = (error as { name?: string } | null)?.name
    throw new DeepSeekCallError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error')
  }

  if (!response.ok) {
    // The status is kept as metadata — the body is not read, so no provider
    // error message can leak through this path.
    throw new DeepSeekCallError(categoryForHttpStatus(response.status), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new DeepSeekCallError('invalid_json', response.status)
  }

  /**
   * A Responses payload reports its own outcome. Only `incomplete` and
   * `failed` are refused: a missing `status` is treated as usable, because
   * rejecting a payload that carries a perfectly good final answer merely
   * because it omitted the field would turn a working call into a failure.
   */
  const responseStatus = (payload as { status?: unknown } | null)?.status
  if (responseStatus === 'incomplete') {
    throw new DeepSeekCallError('provider_incomplete', response.status, 'incomplete')
  }
  if (responseStatus === 'failed') {
    throw new DeepSeekCallError('provider_failed', response.status, 'failed')
  }

  const outputText = readResponsesApiOutputText(payload)
  try {
    return JSON.parse(outputText)
  } catch {
    throw new DeepSeekCallError('invalid_json', response.status, typeof responseStatus === 'string' ? responseStatus : undefined)
  }
}

/**
 * Records a failure with the only metadata that is safe to keep: which
 * provider, which category, and the two status values when they exist.
 *
 * PWS-AI-BETA-01R2 — deliberately NOT logged here: the API key, any header,
 * the prompt, the system instructions, the extracted source text, the
 * filename, the product name or id, the provider's raw response, the
 * provider's own error message, the reasoning content, the final output text,
 * and the stack. A diagnosable failure does not require any of them.
 */
function logProviderFailure(failure: DeepSeekCallError): void {
  const parts = ['provider=deepseek', `category=${failure.category}`]
  if (failure.httpStatus !== undefined) parts.push(`httpStatus=${failure.httpStatus}`)
  if (failure.responseStatus !== undefined) parts.push(`responseStatus=${failure.responseStatus}`)
  console.warn(`[ai/deepseek] AI provider failure: ${parts.join(' ')}`)
}

/** Logs the failure once and returns its fixed, safe message. */
function failureResult<TOutput>(failure: DeepSeekCallError): TargetGenerationResult<TOutput> {
  logProviderFailure(failure)
  return { ok: false, error: DEEPSEEK_FAILURE_MESSAGES[failure.category] }
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
    } catch (error) {
      // An uncategorised throw can only come from an injected caller (tests) or
      // an unforeseen runtime fault; it is reported as a transport failure
      // rather than inventing a more specific claim about it.
      const failure = error instanceof DeepSeekCallError
        ? error
        : new DeepSeekCallError('network_error')
      return failureResult(failure)
    }
    if (raw === DEADLINE_EXCEEDED) return failureResult(new DeepSeekCallError('timeout'))

    const sourceMaterial = input.extractedSourceTexts.map(s => s.text).join('\n\n')
    return target.parseAndValidate(raw, { sourceMaterial })
  }

  return { isConfigured, generateStructured }
}
