import type { AiGenerationInput, AiGenerationInputBase, TargetDefinition, TargetGenerationResult } from './aiTargetContract'
import type { AiStructuredProvider } from './aiProviderRegistry'

/**
 * PWS-AI-ENGINE-01R — server-only OpenAI adapter, Target-neutral. Started
 * life as the Specifications-only `openaiSpecificationProvider.ts`
 * (PWS-AI-PLATFORM-01); this round generalizes it to take a `TargetDefinition`
 * per call instead of hardcoding the Specifications prompt/schema — the
 * network call, config, and fail-closed behavior are otherwise unchanged.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the request is issued with native
 * `fetch` rather than the `openai` SDK. The project now runs on Node 22.22.2,
 * so the SDK's `engines` range is no longer the reason to avoid it; the
 * adapter stays on native `fetch` because the SDK was only ever an HTTP client
 * for a documented JSON endpoint, and a dependency that is not installed
 * cannot ship a surprise. The request and response shapes are unchanged.
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
 *  - `AbortSignal.timeout()` aborts the underlying HTTP request itself, and a
 *    bare `fetch` performs exactly one attempt — no retry, and this project
 *    never falls back to the other provider.
 *  - `withCallDeadline()` below additionally bounds how long THIS FUNCTION's
 *    caller waits, covering an injected or future `callModel` that hangs
 *    without ever reaching the SDK. It is a caller wait limit, not a
 *    cancellation of work already in flight — the SDK's own timeout is what
 *    cancels the network call.
 */
const OPENAI_BASE_URL = 'https://api.openai.com/v1'

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
 * Pulls the assistant's text out of a Responses API payload. The official SDK
 * exposed this as a convenience `output_text` property computed client-side,
 * so a native caller has to do the same walk: prefer the field when a provider
 * sends it, otherwise concatenate the text parts of the output items.
 */
function readResponsesApiOutputText(payload: unknown): string {
  const body = payload as {
    output_text?: unknown
    output?: Array<{ content?: Array<{ text?: unknown }> }>
  }
  if (typeof body.output_text === 'string') return body.output_text

  const parts: string[] = []
  for (const item of body.output ?? []) {
    for (const chunk of item.content ?? []) {
      if (typeof chunk.text === 'string') parts.push(chunk.text)
    }
  }
  if (parts.length === 0) throw new Error('provider returned no text output')
  return parts.join('')
}

async function defaultOpenAiModelCaller(
  target: TargetDefinition<unknown>,
  input: AiGenerationInput,
  config: StructuredProviderConfig,
): Promise<unknown> {
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
    // One attempt, aborted at the deadline. `fetch` performs no automatic
    // retry, so "zero retries" is a property of the call, not a setting.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`provider responded ${response.status}`)
  return JSON.parse(readResponsesApiOutputText(await response.json()))
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

  async function generateStructured<TOutput, TInput extends AiGenerationInputBase = AiGenerationInput>(
    target: TargetDefinition<TOutput, TInput>,
    input: TInput,
  ): Promise<TargetGenerationResult<TOutput>> {
    if (!isConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR }

    let raw: unknown
    try {
      // CC-IMP-08 — the call only uses `target.buildUserInput(input)`, so the subject's input shape passes through unchanged.
      raw = await withCallDeadline(callModel(target as unknown as TargetDefinition<unknown>, input as unknown as AiGenerationInput, config))
    } catch {
      return { ok: false, error: CALL_FAILED_ERROR }
    }
    if (raw === DEADLINE_EXCEEDED) return { ok: false, error: CALL_FAILED_ERROR }

    const sourceMaterial = input.extractedSourceTexts.map(s => s.text).join('\n\n')
    return target.parseAndValidate(raw, { sourceMaterial })
  }

  return { isConfigured, generateStructured }
}
