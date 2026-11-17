import { setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * How many inquiries still need a first look.
 *
 * Every inquiry is saved even when no notification channel is configured, so without a visible
 * count a new lead is indistinguishable from an empty inbox. This returns just the number — no
 * contact details, no message text — so the admin shell can show it without loading the list.
 *
 * "Unread" is the existing `new` status; opening an inquiry moves it on and the count drops.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const res = await adminFetch<{ data?: unknown[] }>(
    event,
    '/items/inquiries?filter[status][_eq]=new&aggregate[count]=id&limit=1',
  )

  // Directus returns the aggregate as [{ count: { id: "21" } }] or [{ count: "21" }] depending on
  // version; accept both and default to 0 rather than throwing in the admin shell.
  const row = Array.isArray(res?.data) ? res.data[0] as Record<string, unknown> | undefined : undefined
  const countField = row?.count
  const raw = typeof countField === 'object' && countField !== null
    ? (countField as Record<string, unknown>).id
    : countField
  const count = Number(raw)

  return { count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0 }
})
