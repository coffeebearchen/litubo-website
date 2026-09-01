import { useRuntimeConfig } from '#imports'

export async function directusFetch<T = unknown>(
  path: string,
  options: Parameters<typeof $fetch>[1] = {}
): Promise<T> {
  const config = useRuntimeConfig()
  const base = config.directusUrl
  const token = config.directusToken

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
