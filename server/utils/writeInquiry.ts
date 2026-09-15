import { createError } from 'h3'
import { directusFetch } from '~/server/utils/directus'

export async function writeInquiry(
  payload: Record<string, unknown>
): Promise<{ id: number | null }> {
  // nuxt-server has CREATE-only permission on inquiries.
  // Directus returns 204 No Content when CREATE succeeds but READ is not granted.
  // ofetch resolves 204 as null — we treat null as a successful write.
  try {
    const res = await directusFetch<{ data: { id: number } } | null>('/items/inquiries?fields=id', {
      method: 'POST',
      body: payload,
    })
    return { id: res?.data?.id ?? null }
  }
  catch (err: unknown) {
    // Any failure to store the inquiry (Directus down, not configured, or refusing the write) is
    // 503 to the public client: never a fake success, never Directus's own status or body.
    // Only the upstream status code is logged, never the payload.
    const status = (err as { response?: { status?: number } })?.response?.status
    console.error('[inquiry] Directus write failed', { status: status ?? null })
    throw createError({ statusCode: 503, message: 'CMS unavailable. Please try again later.' })
  }
}
