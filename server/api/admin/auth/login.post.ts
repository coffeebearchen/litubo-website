import { createError, readBody, setCookie, getHeader } from 'h3'
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from '~/server/utils/loginRateLimit'

export default defineEventHandler(async (event) => {
  const forwarded = getHeader(event, 'x-forwarded-for')
  const ip = (forwarded?.split(',')[0] ?? event.node.req.socket?.remoteAddress ?? 'unknown').trim()

  const rl = checkLoginRateLimit(ip)
  if (rl.locked) {
    throw createError({
      statusCode: 429,
      message: `Too many failed login attempts. Try again in ${rl.retryAfter} seconds.`,
    })
  }

  const body = await readBody(event)
  const email = String(body?.email ?? '').trim()
  const password = String(body?.password ?? '')

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  const config = useRuntimeConfig()

  try {
    const resp = await $fetch<{
      data: { access_token: string; refresh_token: string; expires: number }
    }>(`${config.directusUrl}/auth/login`, {
      method: 'POST',
      body: { email, password },
    })

    const { access_token, refresh_token, expires } = resp.data

    const me = await $fetch<{
      data: { id: string; email: string; first_name: string | null; role: { name: string } }
    }>(`${config.directusUrl}/users/me?fields=id,email,first_name,role.name`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (me.data?.role?.name !== 'Administrator') {
      throw createError({ statusCode: 403, message: 'Access restricted to administrators' })
    }

    clearLoginFailures(ip)

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

    return {
      ok: true,
      user: {
        id: me.data.id,
        email: me.data.email,
        first_name: me.data.first_name,
      },
    }
  } catch (err: unknown) {
    const httpErr = err as { statusCode?: number }
    if (httpErr.statusCode === 403) throw err
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }
})
