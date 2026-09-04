import { getCookie, setCookie, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const rt = getCookie(event, 'admin_rt')
  if (!rt) {
    throw createError({ statusCode: 401, message: 'No refresh token' })
  }

  const config = useRuntimeConfig()

  try {
    const resp = await $fetch<{
      data: { access_token: string; refresh_token: string; expires: number }
    }>(`${config.directusUrl}/auth/refresh`, {
      method: 'POST',
      body: { refresh_token: rt },
    })

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
  } catch {
    throw createError({ statusCode: 401, message: 'Refresh token expired or invalid' })
  }
})
