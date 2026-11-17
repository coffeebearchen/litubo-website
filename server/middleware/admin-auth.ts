import { createError, getCookie, getHeader, getRequestURL, sendRedirect } from 'h3'
import { attemptSsrRefresh } from '~/server/utils/adminRefresh'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event).pathname

  const isAdminApi = url.startsWith('/api/admin/')
  /**
   * The bare `/admin` path is an admin page too. `startsWith('/admin/')` alone skipped it, so
   * `/admin` rendered the admin shell (10.6 KB of navigation, no data) to an anonymous request
   * instead of redirecting to the login page — the shell is harmless, but a gate should treat every
   * admin path the same way, and the browser should not be bounced by a client-side redirect.
   */
  const isAdminPage = (url === '/admin' || url.startsWith('/admin/')) && !isAdminApi

  // Not an admin route — let through unchanged
  if (!isAdminPage && !isAdminApi) return

  // Login page must stay accessible with no cookie
  if (isAdminPage && url.startsWith('/admin/login')) return

  // Auth endpoints (login / logout / refresh / me) handle their own cookie logic
  if (isAdminApi && url.startsWith('/api/admin/auth/')) return

  const config = useRuntimeConfig()

  function reject(): ReturnType<typeof sendRedirect> | never {
    if (isAdminPage) return sendRedirect(event, '/admin/login', 302)
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  let token = getCookie(event, 'admin_at') ?? undefined

  // Fast path: no AT at all — skip the /users/me round-trip, go straight to refresh
  if (!token) {
    const refreshed = await attemptSsrRefresh(event)
    if (!refreshed) return reject()
    token = refreshed
  }

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
    const httpErr = err as { statusCode?: number }

    // Role check explicitly denied — do not attempt refresh
    if (httpErr.statusCode === 403) throw err

    // AT was rejected (likely expired) — attempt server-side refresh with admin_rt
    const refreshed = await attemptSsrRefresh(event)
    if (!refreshed) return reject()

    // Verify the refreshed token and confirm Administrator role
    try {
      const me2 = await $fetch<{ data: { id: string; role: { name: string } } }>(
        `${config.directusUrl}/users/me?fields=id,role.name`,
        { headers: { Authorization: `Bearer ${refreshed}` } }
      )

      if (me2.data?.role?.name !== 'Administrator') {
        if (isAdminPage) return sendRedirect(event, '/admin/login', 302)
        throw createError({ statusCode: 403, message: 'Insufficient privileges' })
      }

      event.context.adminToken = refreshed
      event.context.adminUserId = me2.data.id
    } catch {
      return reject()
    }
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
