import { createError, setResponseHeader } from 'h3'
import { z } from 'zod'
import { createDefaultAiProviderRegistry } from '~/server/utils/aiProviderRegistryDefault'
import { parseAiProviderId } from '~/server/utils/aiProviderRegistry'
import { readDeepseekApiKey, readOpenaiApiKey } from '~/server/utils/serverSecrets'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimGenerateSlot, releaseGenerateSlot } from '~/server/utils/aiGenerateRateLimit'

/**
 * Turns the site check numbers into a short, prioritised list of what to fix first.
 *
 * Read-only: it writes nothing, and the only thing the model receives is counts (numbers, plus a few
 * record labels). No page content, no customer data. The panel shows the same numbers next to the
 * answer, so the advice can be checked against the facts it was given.
 */
export const MAX_AUDIT_SUMMARY_BYTES = 8192

const CountsSchema = z.object({
  posts: z.number().int().min(0),
  postsMissingTitle: z.number().int().min(0),
  postsMissingDescription: z.number().int().min(0),
  products: z.number().int().min(0),
  productsMissingTitle: z.number().int().min(0),
  productsMissingDescription: z.number().int().min(0),
  categories: z.number().int().min(0),
  categoriesMissingDescription: z.number().int().min(0),
  mediaTotal: z.number().int().min(0),
  mediaWithoutAlt: z.number().int().min(0),
  mediaUnclassified: z.number().int().min(0),
  updatedToday: z.number().int().min(0),
  duplicateTitles: z.number().int().min(0),
}).strict()

const BodySchema = z.object({ counts: CountsSchema }).strict()

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<unknown>(event, MAX_AUDIT_SUMMARY_BYTES)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid audit counts' })
  const c = parsed.data.counts

  const config = useRuntimeConfig()
  const registry = createDefaultAiProviderRegistry({
    defaultProvider: config.aiDefaultProvider,
    openai: { apiKey: readOpenaiApiKey(), model: config.openaiModel },
    deepseek: { apiKey: readDeepseekApiKey(), model: config.deepseekModel },
  })
  const providerId = parseAiProviderId(config.aiDefaultProvider, 'deepseek')
  if (!registry.getProvider(providerId).isConfigured()) {
    return { ok: false, unavailable: true, error: 'AI is not configured on this server yet.' }
  }

  const slot = claimGenerateSlot(adminUserId, 'site-audit')
  if (!slot.allowed) {
    setResponseHeader(event, 'Retry-After', slot.retryAfterSeconds)
    throw createError({ statusCode: 429, message: 'A summary was just generated. Wait a moment.' })
  }

  try {
    const facts = [
      `Articles published: ${c.posts}, missing search title: ${c.postsMissingTitle}, missing search description: ${c.postsMissingDescription}`,
      `Products published: ${c.products}, missing search title: ${c.productsMissingTitle}, missing search description: ${c.productsMissingDescription}`,
      `Product categories: ${c.categories}, missing search description: ${c.categoriesMissingDescription}`,
      `Images in the library: ${c.mediaTotal}, without alt text: ${c.mediaWithoutAlt}, not filed in a folder: ${c.mediaUnclassified}`,
      `Records updated today: ${c.updatedToday}`,
      `Records sharing a search title with another record: ${c.duplicateTitles}`,
    ].join('\n')

    const prompt = [
      'You advise the owner of an industrial B2B website (food and packaging inspection equipment) on',
      'where to spend editing effort. The numbers below are measured, not estimated. They come from a',
      'site check the owner just ran in their admin panel.',
      '',
      'Rules:',
      '- At most 5 bullets, each one sentence, each naming the concrete thing to fix and the relevant',
      '  number. Order by what most affects a buyer finding the site.',
      '- Recommend only work that can be done in this admin (search titles, descriptions, alt text,',
      '  folders, category intros). Never suggest buying tools, hiring, ads or redesigning.',
      '- Do not invent numbers. If a number is zero, say that part is fine instead of listing it.',
      '- End with one line that starts "Start with:" and names the single first action.',
      '',
      'Measured facts:',
      facts,
    ].join('\n')

    const result = await registry.generateStructured(providerId, {
      id: 'site-audit-summary',
      schemaName: 'site_audit_summary',
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['advice'],
        properties: { advice: { type: 'string', maxLength: 1200 } },
      },
      systemInstructions: 'You return only JSON. No prose outside the JSON object.',
      buildUserInput: () => prompt,
      parseAndValidate(raw: unknown) {
        const shape = z.object({ advice: z.string().min(1).max(1200) }).strict().safeParse(raw)
        if (!shape.success) return { ok: false as const, error: 'The AI provider returned a response that could not be used.' }
        return { ok: true as const, output: { advice: shape.data.advice.replace(/\n{3,}/g, '\n\n').trim() } }
      },
    }, { sourceFileSummaries: [], extractedSourceTexts: [] })

    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, advice: result.output.advice, counts: c }
  }
  finally {
    releaseGenerateSlot(adminUserId, 'site-audit')
  }
})
