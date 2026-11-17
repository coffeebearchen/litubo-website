import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'
import { readSmtpPassword } from '~/server/utils/serverSecrets'
import type { InquiryType } from '~/types/content'

const CONTACT_TYPES: InquiryType[] = ['contact', 'technical_matching', 'distributor']

/**
 * Log the actionable reason once per process. Re-logging it for every inquiry buried the real
 * signal under identical lines and made it look like a transient send failure.
 */
let warned = false
function warnUnconfigured(reason: string): void {
  if (warned) return
  warned = true
  console.warn(`[inquiry] email notification is not configured: ${reason}. Inquiries are still saved; set SMTP_HOST, SMTP_USER and SMTP_PASS to receive them by email.`)
}

/**
 * Whether the SMTP settings describe a mail server we can actually reach.
 *
 * A placeholder host such as `...` is truthy, so the old `if (!config.smtpHost)` guard let it
 * through and every inquiry ended in `[inquiry] email notification failed` with an ENOTFOUND from
 * nodemailer. The lead was saved but nobody was told. Treating a non-hostname as "not configured"
 * keeps the failure honest: nothing is attempted, and the reason is logged once.
 */
function smtpProblem(config: ReturnType<typeof useRuntimeConfig>): string | null {
  if (!config.smtpHost) return 'SMTP_HOST is empty'
  // A hostname needs at least one dot and contains no spaces; `...` and similar placeholders fail both.
  if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(config.smtpHost))) {
    return `SMTP_HOST "${config.smtpHost}" is not a hostname (placeholder left in .env?)`
  }
  // Most SMTPS relays reject unauthenticated submission; a username without a password always fails.
  if (config.smtpUser && !readSmtpPassword()) return 'SMTP_USER is set but SMTP_PASS is empty'
  return null
}

export async function sendInquiryEmail(
  inquiryId: number | null,
  inquiryType: InquiryType
): Promise<void> {
  const config = useRuntimeConfig()
  const problem = smtpProblem(config)
  if (problem) {
    warnUnconfigured(problem)
    return
  }

  const to = CONTACT_TYPES.includes(inquiryType) ? config.contactEmail : config.salesEmail

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort) || 587,
    secure: false,
    // SMTP_PASS is read from the running process, never runtimeConfig (FINAL-RELEASE-PRODUCTION-READY-01D).
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: readSmtpPassword() }
      : undefined,
  })

  await transporter.sendMail({
    from: config.smtpFrom,
    to,
    subject: inquiryId
      ? `New inquiry [${inquiryType}] #${inquiryId}`
      : `New inquiry [${inquiryType}]`,
    // No PII in body — recipient opens Directus Admin to view contact details
    text: `A new ${inquiryType} inquiry has been submitted (ID: ${inquiryId}).\n\nLog in to Directus Admin to view and respond.`,
  })
}
