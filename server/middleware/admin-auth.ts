import { createError, getCookie, getHeader, getRequestURL, sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event).pathname

  const isAdminApi = url.startsWith('/api/admin/')
  const isAdminPage = url.startsWith('/admin/') && !isAdminApi

  // Not an admin route — let through unchanged
  if (!isAdminPage && !isAdminApi) return

  // Login page must stay accessible with no cookie
  if (isAdminPage && url.startsWith('/admin/login')) return

  // Auth endpoints (login / logout / refresh / me) handle their own cookie logic
  if (isAdminApi && url.startsWith('/api/admin/auth/')) return

  const token = getCookie(event, 'admin_at')

  if (!token) {
    if (isAdminPage) return sendRedirect(event, '/admin/login', 302)
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const config = useRuntimeConfig()

  try {
    const me = await $fetch<{ data: { id: string; role: { name: string } } }>(
      `${config.directusUrl}/users/me?fields=id,role.name`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (me.data?.role?.name !== 'Administrator') {
      if (isAdminPage) return sendRedirect(event, '/admin/login', 302)
      throw createError({ statusCode: 403, message: 'Insufficient privileges' })
    }

    event.context.adminToken = token
    event.context.adminUserId = me.data.id
  } catch (err: unknown) {
    if (isAdminPage) return sendRedirect(event, '/admin/login', 302)
    const httpErr = err as { statusCode?: number; message?: string }
    if (httpErr.statusCode === 403) throw err
    throw createError({ statusCode: 401, message: 'Invalid or expired session' })
  }

  // CSRF check: only for write operations on API routes
  if (isAdminApi) {
    const method = event.node.req.method ?? 'GET'
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
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
    }
  }
})
