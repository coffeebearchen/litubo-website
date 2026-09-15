import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { listPublicContent, publicContentOptionsFromConfig } from '~/server/utils/contentPublic'
import type { PublicContentList } from '~/types/content-public'

/**
 * CC-IMP-10 — public Content Center list for one public type (Blueprint §29; D-035).
 * Not a public type or locale → 404. Directus failure → 503, never an empty list.
 */
export default defineEventHandler(async (event): Promise<PublicContentList> => {
  const options = publicContentOptionsFromConfig(useRuntimeConfig())
  let result: PublicContentList | null
  try {
    result = await listPublicContent(directusFetch, getRouterParam(event, 'type'), getQuery(event).locale, options)
  }
  catch (err) {
    console.error('[cms/content] Directus fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content temporarily unavailable' })
  }
  if (!result) throw createError({ statusCode: 404, message: 'Not found' })
  return result
})
