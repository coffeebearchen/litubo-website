import { createError } from 'h3'
import { optionalText } from '~/server/utils/publicInquiry'
import type { InquiryFields } from '~/server/utils/publicInquiry'

/**
 * FINAL-RELEASE-FIX-A — the three legacy public form endpoints as narrow compatibility adapters.
 *
 * Until this fix, `/api/contact`, `/api/support-request` and `/api/spare-parts` saved the raw request
 * body as a local JSON file whose name was built from the client's `formId`. Each endpoint is now
 * only a mapping from its legacy request shape (the shape its last callers sent, git a2d1c4e) onto
 * canonical inquiry fields for the one pipeline in `publicInquiry.ts`:
 *
 * - the inquiry type is assigned by the server for each endpoint; a client value is never read;
 * - only the legacy fields listed below are read; every other key is ignored and never stored;
 * - `formId` is checked against that endpoint's legacy values only, and is never stored;
 * - the client's `sourceUrl` is ignored; the pipeline derives `source_url` from a same-origin Referer.
 *
 * Phase 6 moved every other legacy form to `/api/inquiries` with its own inquiry type, so their
 * form ids (technical-matching, find-a-distributor, send-product-test) are refused here.
 */

function missingRequired(): never {
  throw createError({ statusCode: 400, message: 'Missing required fields.' })
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== ''
}

function checkFormId(body: Record<string, unknown>, allowed: readonly string[], required: boolean): void {
  const formId = optionalText(body, 'formId')
  if (!isPresent(formId)) {
    if (required) missingRequired()
    return
  }
  if (!allowed.includes(formId)) throw createError({ statusCode: 400, message: 'Invalid form.' })
}

/** `/api/contact`: its one caller today is Become a Partner. */
export function legacyContactFields(body: Record<string, unknown>): InquiryFields {
  checkFormId(body, ['contact', 'become-a-partner'], true)
  const name = optionalText(body, 'name')
  const email = optionalText(body, 'email')
  if (!isPresent(name) || !isPresent(email)) missingRequired()
  return {
    inquiry_type: 'contact',
    locale: optionalText(body, 'locale'),
    consent: body.consent,
    contact_name: name,
    contact_email: email,
    contact_company: optionalText(body, 'company'),
    contact_country: optionalText(body, 'country'),
    contact_phone: optionalText(body, 'phone'),
    message: optionalText(body, 'message'),
  }
}

/** `/api/support-request`: no page calls it; legacy shape of the support request form. */
export function legacySupportRequestFields(body: Record<string, unknown>): InquiryFields {
  checkFormId(body, ['technical-support', 'manual-request', 'service-training'], true)
  const name = optionalText(body, 'name')
  const email = optionalText(body, 'email')
  if (!isPresent(name) || !isPresent(email)) missingRequired()
  return {
    inquiry_type: 'support_request',
    locale: optionalText(body, 'locale'),
    consent: body.consent,
    contact_name: name,
    contact_email: email,
    contact_company: optionalText(body, 'company'),
    contact_country: optionalText(body, 'country'),
    model_number: optionalText(body, 'model'),
    serial_number: optionalText(body, 'serial'),
    message: optionalText(body, 'issue'),
    urgency: optionalText(body, 'urgency'),
  }
}

/** `/api/spare-parts`: no page calls it; legacy shape of the spare parts form. */
export function legacySparePartsFields(body: Record<string, unknown>): InquiryFields {
  checkFormId(body, ['spare-parts'], false)
  const email = optionalText(body, 'email')
  const model = optionalText(body, 'model')
  const parts = optionalText(body, 'parts')
  if (!isPresent(email) || !isPresent(model) || !isPresent(parts)) missingRequired()
  const notes = optionalText(body, 'message')
  return {
    inquiry_type: 'spare_parts',
    locale: optionalText(body, 'locale'),
    consent: body.consent,
    contact_email: email,
    contact_country: optionalText(body, 'country'),
    model_number: model,
    serial_number: optionalText(body, 'serial'),
    // The same message shape the Request Spare Parts page sends to /api/inquiries.
    message: isPresent(notes) ? `${parts}\n\nAdditional notes: ${notes}` : parts,
  }
}
