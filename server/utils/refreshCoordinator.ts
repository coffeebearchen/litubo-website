import { createHash } from 'node:crypto'

export type TokenData = { access_token: string; refresh_token: string; expires: number }
export type AtStatus = 'valid' | 'invalid' | 'unavailable'

export type RefreshDecision =
  | { action: 'ok'; tokens?: TokenData }
  | { action: '503'; message: string }
  | { action: '401'; clearAt: boolean; clearRt: boolean }

export interface RefreshDeps {
  verifyAt: (at: string) => Promise<AtStatus>
  callRefresh: (rt: string) => Promise<TokenData>
}

export function createCoordinator(opts: { graceTtl?: number; rotatedTtl?: number } = {}) {
  const GRACE = opts.graceTtl ?? 5_000
  // Rotated TTL is deliberately longer than grace so late-arriving requests
  // (that miss the grace window but still carry a recently consumed RT) are
  // recognized and returned 503 instead of triggering a destructive 401.
  const ROTATED = opts.rotatedTtl ?? 60_000

  const pending = new Map<string, Promise<TokenData>>()
  const graceCache = new Map<string, { data: TokenData; expiresAt: number }>()
  // Tracks SHA-256 digests of successfully rotated RTs — digest only, no token data.
  // Lets late-arriving requests carrying an already-consumed RT return 503 rather than
  // clearing cookies and forcing a re-login.
  const rotated = new Map<string, number>() // key → expiresAt

  function rtKey(rt: string): string {
    return createHash('sha256').update(rt).digest('hex')
  }

  function storeGrace(key: string, data: TokenData): void {
    graceCache.set(key, { data, expiresAt: Date.now() + GRACE })
    setTimeout(() => graceCache.delete(key), GRACE)
    // Mark the RT as recently rotated; persists past the grace window
    rotated.set(key, Date.now() + ROTATED)
    setTimeout(() => rotated.delete(key), ROTATED)
  }

  async function doRefresh(rt: string, deps: RefreshDeps): Promise<TokenData> {
    const key = rtKey(rt)

    const cached = graceCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    if (!pending.has(key)) {
      const call = deps.callRefresh(rt)
      const managed = call
        .then((data) => { storeGrace(key, data); return data })
        .finally(() => pending.delete(key))
      pending.set(key, managed)
    }

    return pending.get(key)!
  }

  return {
    async refresh(
      opts: { at?: string; rt?: string; intent: 'ensure' | 'scheduled-renew' },
      deps: RefreshDeps,
    ): Promise<RefreshDecision> {
      const { at, rt, intent } = opts

      // ensure: cheap AT pre-check; skip RT rotation when AT is still valid
      if (intent === 'ensure' && at) {
        const s = await deps.verifyAt(at)
        if (s === 'valid') return { action: 'ok' }
        if (s === 'unavailable') return { action: '503', message: 'Directus temporarily unavailable' }
        // 'invalid': fall through to RT refresh
      }

      // No RT — inspect AT before deciding whether to 503 or 401
      if (!rt) {
        if (intent === 'scheduled-renew' && at) {
          const s = await deps.verifyAt(at)
          if (s === 'valid') return { action: '503', message: 'No refresh token; session still active' }
          if (s === 'unavailable') return { action: '503', message: 'Directus temporarily unavailable' }
          return { action: '401', clearAt: true, clearRt: false }
        }
        // ensure path: AT already confirmed invalid, or no AT at all
        return { action: '401', clearAt: !!at, clearRt: false }
      }

      const key = rtKey(rt)

      let tokenData: TokenData
      try {
        tokenData = await doRefresh(rt, deps)
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; statusCode?: number }
        const status = e?.response?.status ?? e?.statusCode ?? 0

        if (status === 401 || status === 403) {
          // Late-arriving request: this RT was already consumed and rotated by this process.
          // New cookies are already set; returning 503 lets the caller retry gracefully
          // without clearing the valid session.
          if ((rotated.get(key) ?? 0) > Date.now()) {
            return { action: '503', message: 'Token already rotated; session remains active' }
          }

          // scheduled-renew skipped the AT pre-check; verify now before clearing cookies
          if (intent === 'scheduled-renew' && at) {
            const s = await deps.verifyAt(at)
            if (s === 'valid') return { action: '503', message: 'Scheduled renewal failed; session remains active' }
            if (s === 'unavailable') return { action: '503', message: 'Directus temporarily unavailable' }
          }
          // Both AT and RT confirmed invalid (or no AT)
          return { action: '401', clearAt: !!at, clearRt: true }
        }

        // 5xx / network — keep cookies intact
        return { action: '503', message: 'Directus temporarily unavailable' }
      }

      return { action: 'ok', tokens: tokenData }
    },
  }
}

// Production singleton — shared across all requests in this Nuxt server process.
// For horizontal scaling (multiple Nuxt instances), replace with Redis SETNX+TTL.
export const coordinator = createCoordinator()
