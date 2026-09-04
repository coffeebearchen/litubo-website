import { getCookie, setCookie, deleteCookie, createError, setResponseHeader, getHeader, readBody } from 'h3'
import type { H3Event } from 'h3'
import { coordinator, type TokenData } from '~/server/utils/refreshCoordinator'

function writeCookies(event: H3Event, data: TokenData): void {
  const isProd = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const, path: '/' }
  setCookie(event, 'admin_at', data.access_token, { ...base, maxAge: Math.floor(data.expires / 1000) })
  setCookie(event, 'admin_rt', data.refresh_token, { ...base, maxAge: 7 * 24 * 3600 })
}

export default defineEventHandler(async (event) => {
  // Never allow any proxy or CDN to cache an auth response.
  setResponseHeader(event, 'Cache-Control', 'no-store')

  // Explicit same-origin CSRF check — mirrors server/middleware/admin-auth.ts.
  const origin = getHeader(event, 'origin')
  const host = getHeader(event, 'host') ?? ''
  if (!origin) {
    throw createError({ statusCode: 403, message: 'CSRF: Origin header required' })
  }
  try {
    const originHost = new URL(origin).host
    if (originHost !== host) {
      throw createError({ statusCode: 403, message: 'CSRF: Origin mismatch' })
    }
  } catch (e: unknown) {
    const ce = e as { statusCode?: number }
    if (ce.statusCode === 403) throw e
    throw createError({ statusCode: 403, message: 'CSRF: Invalid Origin header' })
  }

  // Read intent; default to 'ensure'. Unknown intents are rejected with 400.
  let intent: 'ensure' | 'scheduled-renew' = 'ensure'
  try {
    const body = await readBody<{ intent?: unknown }>(event)
    if (body?.intent !== undefined) {
      if (body.intent === 'scheduled-renew') {
        intent = 'scheduled-renew'
      } else if (body.intent !== 'ensure') {
        throw createError({ statusCode: 400, message: 'Invalid intent; accepted: ensure | scheduled-renew' })
      }
    }
  } catch (e: unknown) {
    const ce = e as { statusCode?: number }
    if (ce.statusCode === 400) throw e
    // readBody parse error (empty or non-JSON body) → default to ensure
  }

  const config = useRuntimeConfig()

  const deps = {
    verifyAt: async (at: string) => {
      try {
        await $fetch(`${config.directusUrl}/users/me?fields=id`, {
          headers: { Authorization: `Bearer ${at}` },
        })
        return 'valid' as const
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; statusCode?: number }
        const status = e?.response?.status ?? e?.statusCode ?? 0
        return status === 401 || status === 403 ? 'invalid' as const : 'unavailable' as const
      }
    },
    callRefresh: async (rt: string) => {
      type Resp = { data: TokenData }
      const r = await $fetch<Resp>(`${config.directusUrl}/auth/refresh`, {
        method: 'POST',
        body: { refresh_token: rt },
      })
      return r.data
    },
  }

  const at = getCookie(event, 'admin_at') ?? undefined
  const rt = getCookie(event, 'admin_rt') ?? undefined

  const decision = await coordinator.refresh({ at, rt, intent }, deps)

  switch (decision.action) {
    case 'ok':
      if (decision.tokens) writeCookies(event, decision.tokens)
      return { ok: true }

    case '503':
      throw createError({ statusCode: 503, message: decision.message })

    case '401':
      if (decision.clearAt) deleteCookie(event, 'admin_at', { path: '/' })
      if (decision.clearRt) deleteCookie(event, 'admin_rt', { path: '/' })
      throw createError({ statusCode: 401, message: 'Session expired, please log in again' })
  }
})
