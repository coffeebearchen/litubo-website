import { defineEventHandler, getHeader, readBody } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { sendWecomVisit } from '~/server/utils/wecomNotify'

/**
 * Anonymous page-view beacon.
 *
 * Stored fields: path, referrer, source (derived), country (from a CDN header when present),
 * duration, random session id, timestamp. No IP address, no cookie and no personal data are stored.
 *
 * The beacon is intentionally fire-and-forget: it never throws at the caller and always answers
 * 204, so a tracking outage can never break a page.
 */

interface TrackBody {
  path?: unknown
  referrer?: unknown
  sessionId?: unknown
  durationMs?: unknown
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/')) return null
  if (path.length > 255) return null
  return path
}

function classifySource(referrer: string): string {
  if (!referrer) return 'Direct'
  let host = ''
  try {
    host = new URL(referrer).hostname.toLowerCase()
  }
  catch {
    return 'Other'
  }
  if (/litubo\.com$/.test(host)) return 'Internal'
  if (/google\./.test(host)) return 'Google'
  if (/bing\./.test(host)) return 'Bing'
  if (/baidu\./.test(host)) return 'Baidu'
  if (/weixin|wechat|qq\.com/.test(host)) return 'WeChat'
  if (/linkedin\./.test(host)) return 'LinkedIn'
  if (/youtube\./.test(host)) return 'YouTube'
  if (/facebook\.|fb\./.test(host)) return 'Facebook'
  if (/alibaba|made-in-china|1688|globalsources/.test(host)) return 'B2B marketplace'
  return 'Referral'
}

function resolveCountry(event: Parameters<typeof getHeader>[0]): string {
  const raw = getHeader(event, 'cf-ipcountry')
    || getHeader(event, 'x-vercel-ip-country')
    || getHeader(event, 'x-country-code')
    || ''
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : 'XX'
}

export default defineEventHandler(async (event) => {
  // Always 204 — tracking must never surface an error to the visitor.
  try {
    const body = await readBody<TrackBody>(event).catch(() => null)
    if (!body) return new Response(null, { status: 204 })

    const path = cleanPath(body.path)
    if (!path) return new Response(null, { status: 204 })

    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 512) : ''
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : ''
    const durationMs = Number.isFinite(Number(body.durationMs)) ? Math.max(0, Math.min(24 * 3600_000, Number(body.durationMs))) : 0
    const source = classifySource(referrer)
    const country = resolveCountry(event)

    // A duration beacon updates the page-view row it belongs to instead of creating a second one.
    if (durationMs > 0 && sessionId) {
      const existing = await directusFetch<{ data: Array<{ id: number }> }>(
        `/items/visitor_events?filter[session_id][_eq]=${encodeURIComponent(sessionId)}`
        + `&filter[path][_eq]=${encodeURIComponent(path)}&sort=-created_at&limit=1&fields=id`,
      ).catch(() => null)
      const row = existing?.data?.[0]
      if (row) {
        await directusFetch(`/items/visitor_events/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ duration_ms: Math.round(durationMs) }),
        })
        return new Response(null, { status: 204 })
      }
    }

    await directusFetch('/items/visitor_events', {
      method: 'POST',
      body: JSON.stringify({ path, referrer, source, country, duration_ms: 0, session_id: sessionId }),
    })

    // Optional live push (only when WECOM_WEBHOOK_URL is configured).
    sendWecomVisit({ path, source, country, sessionId, referrer }).catch(() => {})
  }
  catch (err) {
    console.error('[track] beacon failed:', err instanceof Error ? err.message : err)
  }
  return new Response(null, { status: 204 })
})
