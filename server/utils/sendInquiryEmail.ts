import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'
import { readSmtpPassword } from '~/server/utils/serverSecrets'
import type { InquiryType } from '~/types/content'

const CONTACT_TYPES: InquiryType[] = ['contact', 'technical_matching', 'distributor']

export async function sendInquiryEmail(
  inquiryId: number | null,
  inquiryType: InquiryType
): Promise<void> {
  const config = useRuntimeConfig()
  if (!config.smtpHost) return

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
