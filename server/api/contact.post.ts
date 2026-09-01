import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  // Validate required fields
  const { name, email, formId, locale } = body
  if (!name || !email || !formId) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  // Build submission record
  const submission = {
    id: `${formId}-${Date.now()}`,
    formId,
    locale: locale ?? 'en',
    values: body,
    consentAt: new Date().toISOString(),
    sourceUrl: body.sourceUrl ?? '',
    submittedAt: new Date().toISOString(),
    status: 'new',
  }

  // Persist to local file (development only — replace with CMS write in Phase 2)
  try {
    const dir = join(process.cwd(), '.data', 'submissions')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, `${submission.id}.json`),
      JSON.stringify(submission, null, 2),
      'utf8'
    )
  } catch (err) {
    console.error('[contact API] Failed to write submission:', err)
  }

  // Email delivery (Phase 2): SMTP_HOST must be configured
  if (config.smtpHost) {
    // TODO: implement nodemailer send to config.contactEmail
    console.info('[contact API] SMTP configured but email sending is not yet implemented.')
  } else {
    console.info('[contact API] No SMTP configured. Submission saved locally only.')
  }

  return { ok: true, id: submission.id }
})
