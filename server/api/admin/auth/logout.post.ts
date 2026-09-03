import { deleteCookie, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'admin_rt')
  const config = useRuntimeConfig()

  if (refreshToken) {
    try {
      await $fetch(`${config.directusUrl}/auth/logout`, {
        method: 'POST',
        body: { refresh_token: refreshToken },
      })
    } catch {
      // Ignore — clear cookies regardless
    }
  }

  deleteCookie(event, 'admin_at', { path: '/' })
  deleteCookie(event, 'admin_rt', { path: '/' })

  return { ok: true }
})
