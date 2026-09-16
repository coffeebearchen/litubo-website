import { useRuntimeConfig } from '#imports'
import { readDirectusToken } from './directusServiceToken'

export async function directusFetch<T = unknown>(
  path: string,
  options: Parameters<typeof $fetch>[1] = {}
): Promise<T> {
  const config = useRuntimeConfig()
  const base = config.directusUrl
  // Read from the running process on every call, never from runtimeConfig: a build can neither
  // carry the token nor leave a stale copy behind (FINAL-RELEASE-PRODUCTION-READY-01C).
  const token = readDirectusToken()

  if (!base || !token) {
    throw new Error('Directus not configured')
  }

  const result = await $fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  return result as T
}
