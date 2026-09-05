import { createError, getCookie } from 'h3'
import type { H3Event } from 'h3'

export function getAdminToken(event: H3Event): string {
  // Prefer the token already validated (and possibly refreshed) by admin-auth middleware.
  // This ensures internal useFetch calls during SSR use the refreshed token, not the
  // stale cookie that was forwarded from the original browser request.
  const contextToken = event.context.adminToken as string | undefined
  if (contextToken) return contextToken
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

// Verify product exists; throws 404 if not.
// Uses filter list query because Directus returns 403 (not 404) for a missing single-item request.
// Call AFTER admin-auth middleware has already verified Administrator role.
export async function assertProductExists(event: H3Event, productId: number): Promise<void> {
  const result = await adminFetch<{ data: { id: number }[] }>(
    event, `/items/products?filter[id][_eq]=${productId}&fields=id&limit=1`,
  )
  const rows = (result as { data: { id: number }[] }).data
  if (!Array.isArray(rows) || rows.length === 0) {
    throw createError({ statusCode: 404, message: `产品 ID ${productId} 不存在` })
  }
}
