import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { publicContentOptionsFromConfig } from '~/server/utils/contentPublic'
import { buildSitemapUrls, renderSitemap, type SitemapUrl } from '~/server/utils/sitemap'

/**
 * `/sitemap.xml` — published products plus eligible Content Center entries
 * (CC-IMP-10, RSG-02). An upstream failure answers 503 (not cached) instead of a
 * normal-looking empty sitemap. Editorial/static pages are included independently of CMS records.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')

  let urls: SitemapUrl[]
  try {
    urls = await buildSitemapUrls(directusFetch, { ...publicContentOptionsFromConfig(config), siteUrl, includeStaticPages: true })
  }
  catch (err) {
    console.error('[sitemap.xml] Directus fetch failed:', err instanceof Error ? err.message : err)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({ statusCode: 503, message: 'Sitemap temporarily unavailable' })
  }

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return renderSitemap(urls)
})
