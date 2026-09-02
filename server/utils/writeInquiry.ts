import { directusFetch } from '~/server/utils/directus'

export async function writeInquiry(
  payload: Record<string, unknown>
): Promise<{ id: number | null }> {
  // nuxt-server has CREATE-only permission on inquiries.
  // Directus returns 204 No Content when CREATE succeeds but READ is not granted.
  // ofetch resolves 204 as null — we treat null as a successful write.
  const res = await directusFetch<{ data: { id: number } } | null>('/items/inquiries', {
    method: 'POST',
    body: payload,
  })
  return { id: res?.data?.id ?? null }
}
