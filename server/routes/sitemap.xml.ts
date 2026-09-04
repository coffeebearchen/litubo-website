import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'

interface SitemapProduct {
  slug: string
  category_id: number
  date_updated: string | null
  seo_noindex: boolean | null
}

interface SitemapCategory {
  id: number
  slug: string
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  const skeleton = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`

  if (config.productsCmsMode !== 'directus') {
    return skeleton
  }

  let products: SitemapProduct[] = []
  let categories: SitemapCategory[] = []

  try {
    const [prodRes, catRes] = await Promise.all([
      directusFetch<{ data: SitemapProduct[] }>(
        '/items/products' +
        '?filter[status][_eq]=published' +
        '&filter[seo_noindex][_neq]=true' +
        '&fields=slug,category_id,date_updated,seo_noindex' +
        '&limit=-1'
      ),
      directusFetch<{ data: SitemapCategory[] }>(
        '/items/product_categories' +
        '?filter[status][_eq]=published' +
        '&fields=id,slug' +
        '&limit=-1'
      ),
    ])
    products = prodRes.data
    categories = catRes.data
  }
  catch (err) {
    console.error('[sitemap.xml] Directus fetch failed:', err instanceof Error ? err.message : err)
    // Return empty sitemap on error — do not expose error details
    return skeleton
  }

  const catSlugById = new Map<number, string>(categories.map(c => [c.id, c.slug]))

  const urls = products
    .filter(p => catSlugById.has(p.category_id))
    .map((p) => {
      const catSlug = catSlugById.get(p.category_id)!
      const loc = `${siteUrl}/products/${catSlug}/${p.slug}`
      const lastmod = p.date_updated ? p.date_updated.slice(0, 10) : ''
      return lastmod
        ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
        : `  <url><loc>${loc}</loc></url>`
    })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n')
})
