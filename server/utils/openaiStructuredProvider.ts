import OpenAI from 'openai'
import type { AiGenerationInput, TargetDefinition, TargetGenerationResult } from './aiTargetContract'
import type { AiStructuredProvider } from './aiProviderRegistry'

/**
 * PWS-AI-ENGINE-01R — server-only OpenAI adapter, Target-neutral. Started
 * life as the Specifications-only `openaiSpecificationProvider.ts`
 * (PWS-AI-PLATFORM-01); this round generalizes it to take a `TargetDefinition`
 * per call instead of hardcoding the Specifications prompt/schema — the
 * network call, config, and fail-closed behavior are otherwise unchanged.
 *
 * This file is never imported by a `.vue` file, a `pages/`/`components/`
 * module, or anything else that ships to the browser — only by
 * `server/api/**` endpoints. `OPENAI_API_KEY` and `OPENAI_MODEL` are read
 * from `useRuntimeConfig()` (server-only fields, never `runtimeConfig.public`)
 * by the caller and passed in as plain config, exactly like the existing
 * `directusToken`/`directusUrl` pattern in `adminDirectusClient.ts`.
 */

export interface StructuredProviderConfig {
  apiKey: string
  model: string
}

/**
 * Injected so automated tests can exercise every success/failure path with a
 * mock, without ever constructing an OpenAI client or reaching the network.
 * `defaultOpenAiModelCaller` below is the only implementation that does.
 */
export type ModelCaller = (
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: StructuredProviderConfig,
) => Promise<unknown>

const NOT_CONFIGURED_ERROR = 'AI provider is not configured.'
const CALL_FAILED_ERROR = 'The AI provider could not generate a proposal right now.'

/**
 * The real network call — OpenAI Responses API with Structured Outputs, so
 * the model is constrained to exactly the Target's own JSON Schema. This
 * function is a thin wire adapter only: it does no validation of its own,
 * because `target.parseAndValidate()` is the single place that decides what
 * is safe to trust, regardless of what the API returns.
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

async function defaultOpenAiModelCaller(
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: StructuredProviderConfig,
): Promise<unknown> {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 })

  const response = await client.responses.create({
    model: config.model,
    input: [
      { role: 'system', content: target.systemInstructions },
      { role: 'user', content: target.buildUserInput(input) },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: target.schemaName,
        schema: target.jsonSchema,
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
export function createOpenAiStructuredProvider(
  config: StructuredProviderConfig,
  callModel: ModelCaller = defaultOpenAiModelCaller,
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
