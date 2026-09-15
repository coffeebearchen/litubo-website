import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { getPublicContentDetail, publicContentOptionsFromConfig } from '~/server/utils/contentPublic'
import type { PublicContentDetail } from '~/types/content-public'

/**
 * CC-IMP-10 — public Content Center detail (Blueprint §29; D-035). Exact type, exact
 * locale, exact slug, published snapshot only. Not publicly eligible → 404;
 * Directus failure → 503. No legacy `posts` fallback.
 */
export default defineEventHandler(async (event): Promise<PublicContentDetail> => {
  const options = publicContentOptionsFromConfig(useRuntimeConfig())
  let result: PublicContentDetail | null
  try {
    result = await getPublicContentDetail(directusFetch, getRouterParam(event, 'type'), getRouterParam(event, 'slug'), getQuery(event).locale, options)
  }
  catch (err) {
    console.error('[cms/content/detail] Directus fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content temporarily unavailable' })
  }
  if (!result) throw createError({ statusCode: 404, message: 'Not found' })
  return result
})
