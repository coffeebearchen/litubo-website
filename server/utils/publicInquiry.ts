import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'
import { createHmac } from 'node:crypto'
import sanitizeHtml from 'sanitize-html'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { writeInquiry } from '~/server/utils/writeInquiry'
import { sendInquiryEmail } from '~/server/utils/sendInquiryEmail'
import { syncHubspot } from '~/server/utils/syncHubspot'
import type { InquiryType, HubspotSyncStatus } from '~/types/content'

/**
 * FINAL-RELEASE-FIX-A — the one canonical pipeline for every public inquiry submission.
 *
 * `/api/inquiries` and the three legacy adapters (`/api/contact`, `/api/support-request`,
 * `/api/spare-parts`) all run the same steps, in this order:
 *
 *   1. read the JSON body under a hard byte limit (413); it must be a JSON object (400)
 *   2. rate limit on the client's network identity only, one bucket across all four endpoints (429)
 *   3. honeypot: a filled `website` gets the normal success response and nothing is stored
 *   4. map the body to canonical inquiry fields; a legacy adapter reads only its own legacy
 *      fields and the server assigns its inquiry type
 *   5. validate: consent must be exactly `true`, email, inquiry type, locale, text values only (400)
 *   6. build the stored record from an explicit allowlist; `consented_at` is set here, by the server
 *   7. write the record to Directus `inquiries`; any failure is 503, never a fake success
 *   8. the existing best-effort notification (only when SMTP is configured) and HubSpot sync
 *      (only when a token is configured)
 *
 * Nothing in this pipeline touches the filesystem and no request value becomes part of a path.
 * Request bodies, contact details and headers are never logged.
 */

/**
 * Every accepted field at its length limit is about 11,700 characters, which is about 35 KB of
 * UTF-8 even when each character needs three bytes. 64 KB leaves room for JSON keys, escaping and
 * a long pasted message that is trimmed below; anything larger is refused with 413 before it is
 * buffered or parsed.
 */
export const PUBLIC_INQUIRY_BODY_MAX_BYTES = 64 * 1024

const VALID_INQUIRY_TYPES: InquiryType[] = [
  'contact', 'technical_matching', 'distributor',
  'spare_parts', 'support_request', 'send_product_test',
]

const VALID_LOCALES = ['en', 'es', 'pt']

/** The canonical text fields a submission may carry; `consent` is the only other field read. */
const TEXT_FIELDS = [
  'inquiry_type', 'locale',
  'contact_name', 'contact_email', 'contact_phone', 'contact_company',
  'contact_country', 'contact_title',
  'message',
  'related_product_slug', 'related_application_slug',
  'model_number', 'serial_number',
  'tm_product_interest', 'tm_product_format', 'tm_line_speed',
  'tm_package_dimensions', 'tm_contaminant_concern', 'tm_existing_equipment',
  'utm_source', 'utm_medium', 'utm_campaign',
  'urgency', 'concern',
] as const

export type InquiryTextField = typeof TEXT_FIELDS[number]

/** Canonical inquiry fields produced by an endpoint's body mapping. */
export type InquiryFields = Partial<Record<InquiryTextField, string>> & { consent?: unknown }

/** Maps one endpoint's request body to canonical inquiry fields; throws 400 for an invalid body. */
export type InquiryFieldMapper = (body: Record<string, unknown>) => InquiryFields

// Fields captured in raw_fields snapshot (user-visible form values only)
const RAW_FIELDS_WHITELIST: InquiryTextField[] = [
  'contact_name', 'contact_email', 'contact_phone', 'contact_company',
  'contact_country', 'contact_title',
  'message', 'model_number', 'serial_number',
  'related_product_slug', 'related_application_slug',
  'tm_product_interest', 'tm_product_format', 'tm_line_speed',
  'tm_package_dimensions', 'tm_contaminant_concern', 'tm_existing_equipment',
  'urgency', 'concern',
]

const LENGTH_LIMITS: Partial<Record<InquiryTextField, number>> = {
  contact_name: 200,
  contact_email: 254,
  contact_phone: 50,
  contact_company: 200,
  contact_country: 100,
  contact_title: 200,
  message: 5000,
  related_product_slug: 200,
  related_application_slug: 200,
  model_number: 200,
  serial_number: 200,
  tm_product_interest: 500,
  tm_product_format: 500,
  tm_line_speed: 200,
  tm_package_dimensions: 500,
  tm_contaminant_concern: 500,
  tm_existing_equipment: 1000,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  urgency: 100,
  concern: 1000,
}

function clean(s: string, maxLen = 500): string {
  return sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).trim().substring(0, maxLen)
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function badRequest(message: string): never {
  throw createError({ statusCode: 400, message })
}

function safeSourceUrl(
  referer: string | null | undefined,
  requestHost: string | null | undefined,
  siteUrl: string,
): string {
  if (!referer) return ''
  try {
    const ref = new URL(referer)
    const siteHost = new URL(siteUrl).hostname
    const reqHost = requestHost ? requestHost.split(':')[0] : null
    // Accept only same-origin Referer
    if (ref.hostname !== siteHost && ref.hostname !== reqHost) return ''
    return ref.pathname || ''
  }
  catch {
    return ''
  }
}

/**
 * The rate-limit key is the client's network address only, never a body field, and one bucket is
 * shared by every public inquiry endpoint. The address is hashed with a server secret and never
 * stored. As before, the first `x-forwarded-for` address is used when present, so the limit is only
 * as trustworthy as the proxy in front of the app: without a proxy that overwrites that header, a
 * client can choose it.
 */
function rateLimitKey(event: H3Event, secret: string): string {
  const rawIp = (getHeader(event, 'x-forwarded-for') ?? '').split(',')[0]?.trim()
    || event.node.req.socket?.remoteAddress
    || ''
  return `inquiry:${createHmac('sha256', secret || 'dev-fallback-secret').update(rawIp).digest('hex')}`
}

/**
 * Reads one text value from a request body: absent, `null` or a string. Any other type (object,
 * array, number, boolean) is an invalid payload, never something to coerce.
 */
export function optionalText(body: Record<string, unknown>, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return undefined
  const value = body[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') badRequest('Invalid field value.')
  return value
}

/** `/api/inquiries`: the body already uses the canonical field names, and only those are read. */
export function canonicalInquiryFields(body: Record<string, unknown>): InquiryFields {
  const fields: InquiryFields = { consent: body.consent }
  for (const key of TEXT_FIELDS) fields[key] = optionalText(body, key)
  return fields
}

async function readInquiryBody(event: H3Event): Promise<Record<string, unknown>> {
  const body = await readJsonBodyWithByteLimit<unknown>(event, PUBLIC_INQUIRY_BODY_MAX_BYTES)
  if (!body || typeof body !== 'object' || Array.isArray(body)) badRequest('Invalid request body.')
  return body as Record<string, unknown>
}

/** Runs one public inquiry submission through the canonical pipeline described at the top of this file. */
export async function handlePublicInquiry(event: H3Event, toInquiryFields: InquiryFieldMapper): Promise<{ ok: true }> {
  const body = await readInquiryBody(event)
  const config = useRuntimeConfig()
  const hasHubspotToken = Boolean(config.hubspotAccessToken)

  // Rate limit: reject without writing to Directus
  if (checkRateLimit(rateLimitKey(event, config.submissionIpSecret))) {
    throw createError({ statusCode: 429, message: 'Too many requests. Please wait and try again.' })
  }

  // Honeypot: return fake success without writing to Directus
  if (body.website) {
    return { ok: true }
  }

  const fields = toInquiryFields(body)

  // Consent is an explicit `true` from the client; only then does the server record consented_at.
  if (fields.consent !== true) badRequest('Consent is required.')
  const emailRaw = fields.contact_email ?? ''
  if (!emailRaw) badRequest('Email is required.')
  if (!validEmail(emailRaw)) badRequest('Invalid email format.')
  if (!VALID_INQUIRY_TYPES.includes(fields.inquiry_type as InquiryType)) badRequest('Invalid inquiry type.')
  if (fields.locale && !VALID_LOCALES.includes(fields.locale)) badRequest('Invalid locale.')

  // Sanitize strings and enforce length limits
  const san: Partial<Record<InquiryTextField, string>> = {}
  for (const key of TEXT_FIELDS) {
    const value = fields[key]
    if (value !== undefined && value !== '') san[key] = clean(value, LENGTH_LIMITS[key] ?? 500)
  }

  // Derive source_url from Referer header (not from request body)
  const referer = getHeader(event, 'referer') || getHeader(event, 'referrer') || null
  const host = getHeader(event, 'host') || null
  const sourceUrl = safeSourceUrl(referer, host, config.public.siteUrl)

  // Build raw_fields: user-visible fields only, no PII-adjacent internal data
  const rawFields: Record<string, string> = {}
  for (const key of RAW_FIELDS_WHITELIST) {
    const val = san[key]
    if (val) rawFields[key] = val
  }

  // Build the Directus payload from an explicit allowlist
  const now = new Date().toISOString()
  const hubspotSyncStatus: HubspotSyncStatus = hasHubspotToken ? 'pending' : 'not_configured'
  const payload: Record<string, unknown> = {
    inquiry_type: san.inquiry_type,
    status: 'new',
    locale: san.locale || 'en',
    consent_given: true,
    consented_at: now,
    privacy_policy_version: config.privacyPolicyVersion || '1.0',
    contact_name: san.contact_name || null,
    contact_email: san.contact_email,
    contact_phone: san.contact_phone || null,
    contact_company: san.contact_company || null,
    contact_country: san.contact_country || null,
    contact_title: san.contact_title || null,
    message: san.message || null,
    related_product_slug: san.related_product_slug || null,
    related_application_slug: san.related_application_slug || null,
    model_number: san.model_number || null,
    serial_number: san.serial_number || null,
    tm_product_interest: san.tm_product_interest || null,
    tm_product_format: san.tm_product_format || null,
    tm_line_speed: san.tm_line_speed || null,
    tm_package_dimensions: san.tm_package_dimensions || null,
    tm_contaminant_concern: san.tm_contaminant_concern || null,
    tm_existing_equipment: san.tm_existing_equipment || null,
    source_url: sourceUrl,
    referrer: referer,
    utm_source: san.utm_source || null,
    utm_medium: san.utm_medium || null,
    utm_campaign: san.utm_campaign || null,
    raw_fields: rawFields,
    hubspot_sync_status: hubspotSyncStatus,
  }

  // Write to Directus; surface 503 on failure (never silent)
  const result = await writeInquiry(payload)

  // Email notification (best-effort; log only the record ID, no PII)
  sendInquiryEmail(result.id, san.inquiry_type as InquiryType).catch(() => {
    console.error('[inquiry] email notification failed', { id: result.id })
  })

  // HubSpot Contact sync (controlled await, bounded by HUBSPOT_REQUEST_TIMEOUT_MS).
  // Any outcome (success, error, timeout) is written back to the Directus record.
  // The form response is always { ok: true } as long as Directus write succeeded.
  if (hasHubspotToken && result.id !== null) {
    await syncHubspot(result.id, {
      contact_email: String(san.contact_email),
      contact_name: san.contact_name || null,
      contact_company: san.contact_company || null,
      contact_phone: san.contact_phone || null,
      inquiry_type: String(san.inquiry_type),
      source_url: sourceUrl,
      utm_source: san.utm_source || null,
      utm_medium: san.utm_medium || null,
      utm_campaign: san.utm_campaign || null,
      product_interest: san.tm_product_interest || null,
    }).catch(() => {
      // syncHubspot handles its own error logging and Directus write-back
    })
  }

  return { ok: true }
}
