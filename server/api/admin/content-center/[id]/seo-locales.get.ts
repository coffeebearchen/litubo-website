import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentSeoLocales } from '~/server/utils/contentSeoLocales'
import type { AdminContentSeoLocales } from '~/types/content-center'

/** CC-IMP-05 — locale drafts, SEO fields and the Open Graph image of one content item (admin only). */
export default defineEventHandler(async (event): Promise<AdminContentSeoLocales> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const publishedLocales = useRuntimeConfig(event).public.publishedLocales as readonly unknown[]
  return getContentSeoLocales(contentAdminFetch(event), id, publishedLocales ?? [])
})
