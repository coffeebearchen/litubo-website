import { getCookie, setCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { coordinator } from './refreshCoordinator'
import type { TokenData } from './refreshCoordinator'

/**
 * Attempt a server-side token refresh using the admin_rt cookie.
 *
 * Call this from SSR middleware when admin_at is absent or has been rejected by Directus.
 * The shared coordinator deduplicates concurrent refresh calls (e.g., page middleware +
 * an internal useFetch for the same SSR request both seeing the same expired AT).
 *
 * Returns: the new access token string on success, or null on failure / unavailability.
 * Side effect on success: writes new httpOnly admin_at and admin_rt cookies to the response.
 */
export async function attemptSsrRefresh(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig()
  const rt = getCookie(event, 'admin_rt') ?? undefined
  if (!rt) return null

  const deps = {
    // We already know AT is absent or invalid — verifyAt is never called on this path.
    verifyAt: async (_at: string): Promise<'valid' | 'invalid' | 'unavailable'> => 'invalid',

    callRefresh: async (refreshToken: string): Promise<TokenData> => {
      type Resp = { data: TokenData }
      const r = await $fetch<Resp>(`${config.directusUrl}/auth/refresh`, {
        method: 'POST',
        body: { refresh_token: refreshToken },
      })
      return r.data
    },
  }

  // Pass `at: undefined` so the coordinator skips the AT pre-check and goes
  // straight to RT rotation.  The coordinator's pending-map deduplicates any
  // concurrent call carrying the same RT within the same server process.
  const decision = await coordinator.refresh({ at: undefined, rt, intent: 'ensure' }, deps)

  if (decision.action === 'ok' && decision.tokens) {
    const isProd = process.env.NODE_ENV === 'production'
    const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const, path: '/' }
    setCookie(event, 'admin_at', decision.tokens.access_token, {
      ...base,
      maxAge: Math.floor(decision.tokens.expires / 1000),
    })
    setCookie(event, 'admin_rt', decision.tokens.refresh_token, {
      ...base,
      maxAge: 7 * 24 * 3600,
    })
    return decision.tokens.access_token
  }

  if (decision.action === '401') {
    if (decision.clearAt) deleteCookie(event, 'admin_at', { path: '/' })
    if (decision.clearRt) deleteCookie(event, 'admin_rt', { path: '/' })
  }

  // '401' (invalid RT) or '503' (Directus unavailable) → caller redirects to login
  return null
}
