import { createHash } from 'node:crypto'
import type { AdminInquiry } from '../../types/inquiries'
import type { InquiryGenerationInput } from './aiTargets/inquirySummaryTarget'

/**
 * V2-06 — the shared shape of "what this inquiry is, as far as the AI feature is concerned".
 *
 * Two things must never disagree between Generate and Confirm:
 *
 *  - **The subject key**, so a proposal for inquiry 22 is never read or written for inquiry 21.
 *  - **The fingerprint of the fields the proposal was based on**, so a sentence added to the message
 *    after a summary was generated cannot be confirmed as though the summary covered it.
 *
 * Both are built on the server from the stored row. Neither ever comes from a request body.
 */

/** The model sees at most this much of the message. The stored message is untouched. */
export const INQUIRY_MESSAGE_MAX_FOR_MODEL = 6000

export function inquirySubjectKey(id: number): string {
  return `inquiry:${id}`
}

/**
 * Exactly the fields a proposal is based on, in a fixed order.
 *
 * The contact's name, email, phone and company are deliberately absent: a summary and an intent hint
 * do not need them, and changing a phone number must not invalidate a summary. What the visitor
 * asked for — the message, the machine details, the language, the form — is what a proposal stands on.
 */
function fingerprintParts(inquiry: AdminInquiry): string[] {
  return [
    inquiry.inquiry_type,
    inquiry.locale,
    inquiry.model_number ?? '',
    inquiry.serial_number ?? '',
    inquiry.related_product_slug ?? '',
    inquiry.message ?? '',
  ]
}

export function inquiryFingerprint(inquiry: AdminInquiry): string {
  return createHash('sha256').update(JSON.stringify(fingerprintParts(inquiry)), 'utf8').digest('hex')
}

/** The inquiry as the provider's prompt sees it. The message travels as the one labelled source text. */
export function buildInquiryGenerationInput(inquiry: AdminInquiry): InquiryGenerationInput {
  const message = (inquiry.message ?? '').replace(/\r\n/g, '\n').trim()
  const bounded = message.slice(0, INQUIRY_MESSAGE_MAX_FOR_MODEL)
  return {
    sourceFileSummaries: [],
    extractedSourceTexts: bounded ? [{ displayName: 'Customer message', text: bounded }] : [],
    inquiry: {
      typeLabel: inquiry.inquiry_type.replaceAll('_', ' '),
      locale: inquiry.locale,
      submittedAt: inquiry.submitted_at,
      modelNumber: inquiry.model_number,
      serialNumber: inquiry.serial_number,
      relatedProduct: inquiry.related_product_slug,
      messageChars: message.length,
    },
  }
}
