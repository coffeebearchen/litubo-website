// In-process rate limiter. State resets on server restart.
// Key format: `${ipHash}:${inquiryType}`
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
