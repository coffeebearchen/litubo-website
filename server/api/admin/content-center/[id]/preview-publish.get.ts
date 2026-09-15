import { getQuery, getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentPreviewPublish } from '~/server/utils/contentPublication'
import type { AdminContentPreviewPublish } from '~/types/content-center'

/**
 * CC-IMP-06 — admin Draft preview, readiness and publication state of one language
 * (admin only). Read-only: never writes and never publishes.
 */
export default defineEventHandler(async (event): Promise<AdminContentPreviewPublish> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const publishedLocales = useRuntimeConfig(event).public.publishedLocales as readonly unknown[]
  return getContentPreviewPublish(contentAdminFetch(event), id, getQuery(event).locale, { publishedLocales: publishedLocales ?? [] })
})
