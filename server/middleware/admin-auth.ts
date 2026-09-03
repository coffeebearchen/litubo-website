import { createError, getCookie, getHeader, getRequestURL } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event).pathname

  if (!url.startsWith('/api/admin/')) return
  if (url.startsWith('/api/admin/auth/')) return

  const token = getCookie(event, 'admin_at')
  if (!token) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const config = useRuntimeConfig()

  try {
    const me = await $fetch<{ data: { id: string; role: { name: string } } }>(
      `${config.directusUrl}/users/me?fields=id,role.name`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (me.data?.role?.name !== 'Administrator') {
      throw createError({ statusCode: 403, message: 'Insufficient privileges' })
    }

    event.context.adminToken = token
    event.context.adminUserId = me.data.id
  } catch (err: unknown) {
    const httpErr = err as { statusCode?: number; message?: string }
    if (httpErr.statusCode === 403) throw err
    throw createError({ statusCode: 401, message: 'Invalid or expired session' })
  }

  const method = event.node.req.method ?? 'GET'
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = getHeader(event, 'origin')
    const host = getHeader(event, 'host')
    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          throw createError({ statusCode: 403, message: 'CSRF check failed' })
        }
      } catch {
        throw createError({ statusCode: 403, message: 'Invalid Origin header' })
      }
    }
  }
})
