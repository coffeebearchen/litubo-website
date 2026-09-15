import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { PUBLICATION_BODY_MAX_BYTES, publishContentLocale } from '~/server/utils/contentPublication'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentPublicationResult } from '~/types/content-center'

/**
 * CC-IMP-06 — manual Publish of one language (Blueprint §23). A human admin action
 * only: admin session + CSRF (middleware), `expectedDraftRevision`, hard readiness
 * recomputed here, snapshot built on the server.
 */
export default defineEventHandler(async (event): Promise<AdminContentPublicationResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, PUBLICATION_BODY_MAX_BYTES)
  const publishedLocales = useRuntimeConfig(event).public.publishedLocales as readonly unknown[]
  return publishContentLocale(contentAdminFetch(event), id, getRouterParam(event, 'locale'), body, { publishedLocales: publishedLocales ?? [] })
})
