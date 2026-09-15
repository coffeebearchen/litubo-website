// In-process rate limiter. State resets on server restart.
// Key format: `inquiry:${ipHash}` — one bucket per client across every public inquiry endpoint
// (server/utils/publicInquiry.ts); no request body field is part of the key.
const store = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 3

/** Returns true if the key is over the limit (caller should return 429). */
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const prev = (store.get(key) ?? []).filter(t => now - t < WINDOW_MS)
  if (prev.length >= MAX_REQUESTS) return true
  store.set(key, [...prev, now])
  return false
}
