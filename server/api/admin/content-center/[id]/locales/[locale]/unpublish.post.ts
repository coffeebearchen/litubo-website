import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { PUBLICATION_BODY_MAX_BYTES, unpublishContentLocale } from '~/server/utils/contentPublication'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentPublicationResult } from '~/types/content-center'

/**
 * CC-IMP-06 — manual Unpublish of one language (Blueprint §23). Unpublishing the
 * default language unpublishes every language and returns the item to draft.
 * The working copy is never deleted.
 */
export default defineEventHandler(async (event): Promise<AdminContentPublicationResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, PUBLICATION_BODY_MAX_BYTES)
  const publishedLocales = useRuntimeConfig(event).public.publishedLocales as readonly unknown[]
  return unpublishContentLocale(contentAdminFetch(event), id, getRouterParam(event, 'locale'), body, { publishedLocales: publishedLocales ?? [] })
})
