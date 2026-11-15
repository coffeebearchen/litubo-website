import { createHmac } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { createError, getHeader, setResponseHeader, type H3Event } from 'h3'
import { createDefaultAiProviderRegistry } from './aiProviderRegistryDefault'
import { visitorAssistantTarget } from './aiTargets/visitorAssistantTarget'
import { checkRateLimit } from './rateLimit'
import { readDeepseekApiKey, readOpenaiApiKey, readSubmissionIpSecret } from './serverSecrets'
import { APPROVED_VISITOR_KNOWLEDGE } from './visitorAssistantKnowledge'

export const VISITOR_ASSISTANT_BODY_MAX_BYTES = 4 * 1024

export function visitorAssistantStatus(config: ReturnType<typeof useRuntimeConfig>) {
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })
  const provider = registry.getProvider(registry.getDefaultProvider())
  return { enabled: config.visitorAiEnabled === 'true', configured: provider.isConfigured(), registry }
}

export function assertVisitorAssistantRequest(event: H3Event, question: unknown): string {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (typeof question !== 'string') throw createError({ statusCode: 400, message: 'Enter a question.' })
  const clean = question.normalize('NFKC').replace(/[\p{Cf}\p{Cc}]/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (!clean || clean.length > 800) throw createError({ statusCode: 400, message: 'Keep the question between 1 and 800 characters.' })
  const rawIp = (getHeader(event, 'x-forwarded-for') ?? '').split(',')[0]?.trim() || event.node.req.socket?.remoteAddress || ''
  const key = `visitor-ai:${createHmac('sha256', readSubmissionIpSecret() || 'dev-fallback-secret').update(rawIp).digest('hex')}`
  if (checkRateLimit(key)) throw createError({ statusCode: 429, message: 'Please wait a moment before asking another question.' })
  return clean
}

export async function answerVisitorQuestion(event: H3Event, question: string) {
  const config = useRuntimeConfig()
  const status = visitorAssistantStatus(config)
  if (!status.enabled || !status.configured) throw createError({ statusCode: 503, message: 'The online assistant is not available yet. Please contact our team.' })
  const result = await status.registry.generateStructured(status.registry.getDefaultProvider(), visitorAssistantTarget, {
    question,
    sourceFileSummaries: [{ displayName: 'Approved public knowledge', fileType: 'text' }],
    extractedSourceTexts: [{ displayName: 'Approved public knowledge', text: APPROVED_VISITOR_KNOWLEDGE }],
  })
  if (!result.ok) throw createError({ statusCode: 503, message: 'The online assistant could not answer safely. Please contact our team.' })
  return result.output
}
