import type { H3Event } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * Live visitor data for the admin dashboard.
 *
 * Anonymous only: path, source, country, duration, timestamp. No IP, no cookies, no identities.
 */

interface VisitorRow {
  id: number
  path: string
  referrer: string | null
  source: string | null
  country: string | null
  duration_ms: number | null
  session_id: string | null
  created_at: string
}

const FIELDS = 'id,path,referrer,source,country,duration_ms,session_id,created_at'

export default defineEventHandler(async (event: H3Event) => {
  const now = Date.now()
  const since5 = new Date(now - 5 * 60 * 1000).toISOString()
  const since24 = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const [liveRes, recentRes, dayRes] = await Promise.all([
    adminFetch<{ data: VisitorRow[] }>(
      event,
      `/items/visitor_events?filter[created_at][_gte]=${encodeURIComponent(since5)}&sort=-created_at&limit=100&fields=${FIELDS}`,
    ),
    adminFetch<{ data: VisitorRow[] }>(
      event,
      `/items/visitor_events?sort=-created_at&limit=60&fields=${FIELDS}`,
    ),
    adminFetch<{ data: VisitorRow[] }>(
      event,
      `/items/visitor_events?filter[created_at][_gte]=${encodeURIComponent(since24)}&limit=-1&fields=path,source,country,duration_ms,created_at`,
    ),
  ])

  const day = dayRes.data ?? []

  const byPath = new Map<string, { path: string; views: number; seconds: number }>()
  const byCountry = new Map<string, number>()
  const bySource = new Map<string, number>()
  for (const row of day) {
    const p = byPath.get(row.path) ?? { path: row.path, views: 0, seconds: 0 }
    p.views += 1
    p.seconds += Math.round((row.duration_ms ?? 0) / 1000)
    byPath.set(row.path, p)
    byCountry.set(row.country || 'XX', (byCountry.get(row.country || 'XX') ?? 0) + 1)
    bySource.set(row.source || 'Direct', (bySource.get(row.source || 'Direct') ?? 0) + 1)
  }

  // "Live" = distinct sessions seen in the last five minutes.
  const liveSessions = new Map<string, VisitorRow>()
  for (const row of liveRes.data ?? []) {
    const key = row.session_id || `row-${row.id}`
    if (!liveSessions.has(key)) liveSessions.set(key, row)
  }

  return {
    liveCount: liveSessions.size,
    live: [...liveSessions.values()].slice(0, 20),
    recent: recentRes.data ?? [],
    totals: {
      todayViews: day.length,
      todayCountries: byCountry.size,
    },
    topPages: [...byPath.values()].sort((a, b) => b.views - a.views).slice(0, 12),
    countries: [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, count]) => ({ code, count })),
    sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
  }
})
