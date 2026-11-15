/**
 * Anonymous page-view tracking.
 *
 * - No cookies. A random session id lives in sessionStorage only.
 * - Sends one beacon per page view (duration 0) and one duration update when the visitor leaves
 *   the page, so the admin dashboard can show both live pages and time on page.
 * - Skips /admin so the team's own work does not pollute the visitor feed.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()

  const SESSION_KEY = 'ltb_sid'
  let currentPath = ''
  let startedAt = 0

  function sessionId(): string {
    try {
      let value = sessionStorage.getItem(SESSION_KEY)
      if (!value) {
        value = (globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`)
        sessionStorage.setItem(SESSION_KEY, value)
      }
      return value
    }
    catch {
      return 'anonymous'
    }
  }

  function shouldTrack(path: string): boolean {
    return !path.startsWith('/admin')
  }

  function send(path: string, durationMs: number) {
    if (!shouldTrack(path)) return
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || '',
      sessionId: sessionId(),
      durationMs: Math.max(0, Math.round(durationMs)),
    })
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }))
        return
      }
    }
    catch {
      // fall through to fetch
    }
    try {
      void fetch('/api/track', {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    catch {
      // Tracking must never break the page.
    }
  }

  function flushDuration() {
    if (!currentPath) return
    const elapsed = Date.now() - startedAt
    if (elapsed > 700) send(currentPath, elapsed)
    startedAt = Date.now()
  }

  router.afterEach((to) => {
    flushDuration()
    currentPath = to.fullPath
    startedAt = Date.now()
    send(currentPath, 0)
  })

  if (import.meta.client) {
    window.addEventListener('pagehide', flushDuration)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDuration()
    })
  }
})
