import type { H3Event } from 'h3'
import { adminFetch } from './adminDirectusClient'
import type { FetchFn } from './mediaLifecycle'

/** CC-IMP-01 — the admin's own Directus session as an injectable FetchFn (Directus revisions record the admin). */
export function contentAdminFetch(event: H3Event): FetchFn {
  return (<T>(path: string, options?: Record<string, unknown>) =>
    adminFetch<T>(event, path, (options ?? {}) as Parameters<typeof adminFetch>[2])) as FetchFn
}
