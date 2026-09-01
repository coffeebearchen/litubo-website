import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  const { email, model, parts } = body
  if (!email || !model || !parts) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const submission = {
    id: `spare-parts-${Date.now()}`,
    formId: 'spare-parts',
    locale: body.locale ?? 'en',
    values: body,
    consentAt: new Date().toISOString(),
    sourceUrl: body.sourceUrl ?? '',
    submittedAt: new Date().toISOString(),
    status: 'new',
  }

  try {
    const dir = join(process.cwd(), '.data', 'submissions')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, `${submission.id}.json`),
      JSON.stringify(submission, null, 2),
      'utf8'
    )
  } catch (err) {
    console.error('[spare-parts API] Failed to write submission:', err)
  }

  if (config.smtpHost) {
    // TODO: send to config.salesEmail
  } else {
    console.info('[spare-parts API] Submission saved locally. Configure SMTP for email delivery.')
  }

  return { ok: true, id: submission.id }
})
