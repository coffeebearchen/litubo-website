import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { name, email, formId } = body
  if (!name || !email || !formId) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const submission = {
    id: `${formId}-${Date.now()}`,
    formId,
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
    console.error('[support-request API] Failed to write submission:', err)
  }

  return { ok: true, id: submission.id }
})
