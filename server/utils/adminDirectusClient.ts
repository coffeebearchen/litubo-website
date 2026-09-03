import { createError, getCookie } from 'h3'
import type { H3Event } from 'h3'

export function getAdminToken(event: H3Event): string {
  const token = getCookie(event, 'admin_at')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })
  return token
}

export async function adminFetch<T = unknown>(
  event: H3Event,
  path: string,
  options: Parameters<typeof $fetch>[1] = {}
): Promise<T> {
  const config = useRuntimeConfig()
  const token = getAdminToken(event)

  const result = await $fetch(`${config.directusUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  })
  return result as T
}
