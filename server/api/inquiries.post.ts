import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { createHmac } from 'node:crypto'
import sanitizeHtml from 'sanitize-html'
import { useRuntimeConfig } from '#imports'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { writeInquiry } from '~/server/utils/writeInquiry'
import { sendInquiryEmail } from '~/server/utils/sendInquiryEmail'
import { syncHubspot } from '~/server/utils/syncHubspot'
import type { InquiryType, HubspotSyncStatus } from '~/types/content'

const VALID_INQUIRY_TYPES: InquiryType[] = [
  'contact', 'technical_matching', 'distributor',
  'spare_parts', 'support_request', 'send_product_test',
]

// Fields accepted from the request body and forwarded to Directus
const FIELD_WHITELIST = new Set([
  'inquiry_type', 'locale', 'consent',
  'contact_name', 'contact_email', 'contact_phone', 'contact_company',
  'contact_country', 'contact_title',
  'message',
  'related_product_slug', 'related_application_slug',
  'model_number', 'serial_number',
  'tm_product_interest', 'tm_product_format', 'tm_line_speed',
  'tm_package_dimensions', 'tm_contaminant_concern', 'tm_existing_equipment',
  'utm_source', 'utm_medium', 'utm_campaign',
])

// Fields captured in raw_fields snapshot (user-visible form values only)
const RAW_FIELDS_WHITELIST = new Set([
  'contact_name', 'contact_email', 'contact_phone', 'contact_company',
  'contact_country', 'contact_title',
  'message', 'model_number', 'serial_number',
  'related_product_slug', 'related_application_slug',
  'tm_product_interest', 'tm_product_format', 'tm_line_speed',
  'tm_package_dimensions', 'tm_contaminant_concern', 'tm_existing_equipment',
  'urgency', 'concern',
])

const LENGTH_LIMITS: Record<string, number> = {
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

function ipHash(ip: string, secret: string): string {
  return createHmac('sha256', secret || 'dev-fallback-secret').update(ip).digest('hex')
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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const hasHubspotToken = Boolean(config.hubspotAccessToken)
  const body = await readBody<Record<string, unknown>>(event)

  // Step 1 — IP hash (never stored, only used in rate-limit key)
  const rawIp = (getHeader(event, 'x-forwarded-for') ?? '').split(',')[0]?.trim()
    || event.node.req.socket?.remoteAddress
    || ''
  const hash = ipHash(rawIp, config.submissionIpSecret)

  // Step 2 — Rate limit: reject without writing to Directus
  const inquiryType = String(body?.inquiry_type ?? '')
  if (checkRateLimit(`${hash}:${inquiryType}`)) {
    throw createError({ statusCode: 429, message: 'Too many requests. Please wait and try again.' })
  }

  // Step 3 — Honeypot: return fake success without writing to Directus
  if (body?.website) {
    return { ok: true }
  }

  // Step 4 — Field whitelist filter
  const filtered: Record<string, unknown> = {}
  for (const key of FIELD_WHITELIST) {
    if (key in body && body[key] !== undefined && body[key] !== null && body[key] !== '') {
      filtered[key] = body[key]
    }
  }
  // Also extract extras needed for raw_fields but not in main whitelist
  const extras: Record<string, unknown> = {}
  for (const key of ['urgency', 'concern']) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      extras[key] = body[key]
    }
  }

  // Step 5 — Validate required fields
  if (!filtered.consent) {
    throw createError({ statusCode: 400, message: 'Consent is required.' })
  }
  const emailRaw = String(filtered.contact_email ?? '')
  if (!emailRaw) {
    throw createError({ statusCode: 400, message: 'Email is required.' })
  }
  if (!validEmail(emailRaw)) {
    throw createError({ statusCode: 400, message: 'Invalid email format.' })
  }
  if (!VALID_INQUIRY_TYPES.includes(filtered.inquiry_type as InquiryType)) {
    throw createError({ statusCode: 400, message: 'Invalid inquiry type.' })
  }

  // Sanitize strings and enforce length limits
  const san: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(filtered)) {
    san[k] = typeof v === 'string' ? clean(v, LENGTH_LIMITS[k] ?? 500) : v
  }
  for (const [k, v] of Object.entries(extras)) {
    extras[k] = typeof v === 'string' ? clean(v, LENGTH_LIMITS[k] ?? 500) : v
  }

  // Step 6 — Derive source_url from Referer header (not from request body)
  const referer = getHeader(event, 'referer') || getHeader(event, 'referrer') || null
  const host = getHeader(event, 'host') || null
  const sourceUrl = safeSourceUrl(referer, host, config.public.siteUrl)

  // Build raw_fields: user-visible fields only, no PII-adjacent internal data
  const rawFields: Record<string, unknown> = {}
  for (const key of RAW_FIELDS_WHITELIST) {
    const val = san[key] ?? extras[key]
    if (val !== undefined && val !== null && val !== '') rawFields[key] = val
  }

  // Step 7 — Build Directus payload
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

  // Step 8 — Write to Directus; surface 503 on failure (never silent)
  const result = await writeInquiry(payload)

  // Step 9 — Email notification (best-effort; log only the record ID, no PII)
  sendInquiryEmail(result.id, san.inquiry_type as InquiryType).catch(() => {
    console.error('[inquiry] email notification failed', { id: result.id })
  })

  // Step 10 — HubSpot Contact sync (controlled await, bounded by HUBSPOT_REQUEST_TIMEOUT_MS).
  // Any outcome (success, error, timeout) is written back to the Directus record.
  // The form response is always { ok: true } as long as Directus write succeeded.
  if (hasHubspotToken && result.id !== null) {
    await syncHubspot(result.id, {
      contact_email: String(san.contact_email),
      contact_name: san.contact_name ? String(san.contact_name) : null,
      contact_company: san.contact_company ? String(san.contact_company) : null,
      contact_phone: san.contact_phone ? String(san.contact_phone) : null,
      inquiry_type: String(san.inquiry_type),
      locale: String(san.locale || 'en'),
      related_product_slug: san.related_product_slug ? String(san.related_product_slug) : null,
      source_url: sourceUrl,
    }).catch(() => {
      // syncHubspot handles its own error logging and Directus write-back
    })
  }

  return { ok: true }
})
