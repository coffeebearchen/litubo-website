import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import type { HubspotSyncStatus } from '~/types/content'

export interface HubspotSyncInput {
  contact_email: string
  contact_name: string | null
  contact_company: string | null
  contact_phone: string | null
  inquiry_type: string
  locale: string
  related_product_slug: string | null
  source_url: string
}

const HUBSPOT_API_PROD = 'https://api.hubapi.com'
const HUBSPOT_REQUEST_TIMEOUT_MS = 2500

function resolveApiBase(configured: string | undefined): string {
  // Only allow override outside production to prevent accidental staging calls
  if (process.env.NODE_ENV !== 'production' && configured) return configured
  return HUBSPOT_API_PROD
}

async function hubspotFetch<T>(
  apiBase: string,
  accessToken: string,
  path: string,
  options: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HUBSPOT_REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
      },
      signal: controller.signal,
    })
    const text = await res.text()
    const data = text ? (JSON.parse(text) as T) : null
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

async function upsertContact(
  apiBase: string,
  accessToken: string,
  email: string,
  properties: Record<string, string>,
): Promise<string> {
  type ContactResp = { id?: string; status?: string; message?: string }

  // 1. Try PATCH by email (idProperty=email)
  const patch = await hubspotFetch<ContactResp>(
    apiBase, accessToken,
    `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
    { method: 'PATCH', body: JSON.stringify({ properties }) },
  )
  if (patch.ok && patch.data?.id) return patch.data.id

  if (patch.status !== 404) {
    throw new Error(`hubspot_patch_${patch.status}`)
  }

  // 2. 404 — contact not found: POST to create
  const post = await hubspotFetch<ContactResp>(
    apiBase, accessToken,
    '/crm/v3/objects/contacts',
    { method: 'POST', body: JSON.stringify({ properties }) },
  )
  if (post.ok && post.data?.id) return post.data.id

  if (post.status !== 409) {
    throw new Error(`hubspot_post_${post.status}`)
  }

  // 3. 409 — contact exists (race condition): re-PATCH by email (max one retry)
  const retry = await hubspotFetch<ContactResp>(
    apiBase, accessToken,
    `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
    { method: 'PATCH', body: JSON.stringify({ properties }) },
  )
  if (retry.ok && retry.data?.id) return retry.data.id
  throw new Error(`hubspot_retry_${retry.status}`)
}

async function writeSyncResult(
  inquiryId: number,
  status: HubspotSyncStatus,
  contactId: string | null,
  errorSummary: string | null,
): Promise<void> {
  await directusFetch(`/items/inquiries/${inquiryId}`, {
    method: 'PATCH',
    body: {
      hubspot_sync_status: status,
      ...(contactId !== null ? { hubspot_contact_id: contactId } : {}),
      hubspot_synced_at: new Date().toISOString(),
      ...(errorSummary !== null ? { hubspot_error_summary: errorSummary } : {}),
    },
  })
}

/**
 * Sync a submitted inquiry as a HubSpot Contact (Phase 7A framework).
 * Called only when HUBSPOT_ACCESS_TOKEN is configured.
 * Total wall-clock time is bounded by HUBSPOT_REQUEST_TIMEOUT_MS + Directus write overhead.
 * Any outcome writes back to the inquiries record; the caller's form response is unaffected.
 */
export async function syncHubspot(
  inquiryId: number,
  input: HubspotSyncInput,
): Promise<void> {
  const config = useRuntimeConfig()
  const accessToken = config.hubspotAccessToken as string | undefined

  // Defensive: should not be called without a token, but handle gracefully
  if (!accessToken) {
    await writeSyncResult(inquiryId, 'not_configured', null, null).catch(() => {})
    return
  }

  const apiBase = resolveApiBase(config.hubspotApiBase as string | undefined)

  const properties: Record<string, string> = {
    email: input.contact_email,
  }
  if (input.contact_name) properties.firstname = input.contact_name
  if (input.contact_company) properties.company = input.contact_company
  if (input.contact_phone) properties.phone = input.contact_phone
  // Custom litubo_* properties — must be created in HubSpot Settings before Phase 7B
  properties.litubo_inquiry_type = input.inquiry_type
  properties.litubo_locale = input.locale
  if (input.related_product_slug) properties.litubo_related_product_slug = input.related_product_slug
  if (input.source_url) properties.litubo_source_url = input.source_url

  try {
    const contactId = await upsertContact(apiBase, accessToken, input.contact_email, properties)
    await writeSyncResult(inquiryId, 'success', contactId, null)
  }
  catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    const status: HubspotSyncStatus = isTimeout ? 'timeout' : 'error'
    // Safe summary: error code only, no PII, no token, no stack
    const summary = err instanceof Error ? err.message.substring(0, 200) : 'unknown_error'
    console.error('[hubspot] sync failed', { inquiryId, status })
    await writeSyncResult(inquiryId, status, null, summary).catch(() => {})
  }
}
