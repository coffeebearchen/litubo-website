import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { SEO_LOCALES_BODY_MAX_BYTES, saveContentSeoLocales } from '~/server/utils/contentSeoLocales'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentSeoLocales } from '~/types/content-center'

/**
 * CC-IMP-05 — save one locale's SEO fields (with `expectedDraftRevision`) and / or
 * the item's Open Graph image (with `expectedOgVersion`). Validates everything
 * before writing; never publishes and never touches other media roles.
 */
export default defineEventHandler(async (event): Promise<AdminContentSeoLocales> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, SEO_LOCALES_BODY_MAX_BYTES)
  const publishedLocales = useRuntimeConfig(event).public.publishedLocales as readonly unknown[]
  return saveContentSeoLocales(contentAdminFetch(event), id, body, publishedLocales ?? [])
})
