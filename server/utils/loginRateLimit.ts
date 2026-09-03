const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60 * 1000

interface Entry { count: number; lockUntil: number }
const store = new Map<string, Entry>()

export function checkLoginRateLimit(ip: string): { locked: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(ip)
  if (!entry) return { locked: false }
  if (entry.lockUntil > now) {
    return { locked: true, retryAfter: Math.ceil((entry.lockUntil - now) / 1000) }
  }
  return { locked: false }
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const entry = store.get(ip) ?? { count: 0, lockUntil: 0 }
  if (entry.lockUntil > 0 && entry.lockUntil <= now) {
    entry.count = 0
    entry.lockUntil = 0
  }
  entry.count++
  if (entry.count >= MAX_FAILURES) {
    entry.lockUntil = now + LOCKOUT_MS
  }
  store.set(ip, entry)
}

export function clearLoginFailures(ip: string): void {
  store.delete(ip)
}
