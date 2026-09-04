import { getCookie, setCookie, deleteCookie, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const rt = getCookie(event, 'admin_rt')
  if (!rt) {
    throw createError({ statusCode: 401, message: 'No refresh token' })
  }

  const config = useRuntimeConfig()

  type RefreshResp = { data: { access_token: string; refresh_token: string; expires: number } }
  let resp: RefreshResp

  try {
    resp = await $fetch<RefreshResp>(`${config.directusUrl}/auth/refresh`, {
      method: 'POST',
      body: { refresh_token: rt },
    })
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; statusCode?: number }
    const status = e?.response?.status ?? e?.statusCode ?? 0
    if (status === 401 || status === 403) {
      // Invalid / expired refresh token — clear both cookies and signal re-login
      const delOpts = { path: '/' }
      deleteCookie(event, 'admin_at', delOpts)
      deleteCookie(event, 'admin_rt', delOpts)
      throw createError({ statusCode: 401, message: 'Refresh token expired or invalid' })
    }
    // Network error / Directus 5xx — keep cookies intact, signal transient failure
    throw createError({ statusCode: 503, message: 'Directus temporarily unavailable' })
  }

  const { access_token, refresh_token, expires } = resp.data

  const isProd = process.env.NODE_ENV === 'production'
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
  }

  setCookie(event, 'admin_at', access_token, {
    ...cookieOpts,
    maxAge: Math.floor(expires / 1000),
  })
  setCookie(event, 'admin_rt', refresh_token, {
    ...cookieOpts,
    maxAge: 7 * 24 * 3600,
  })

  return { ok: true }
})
