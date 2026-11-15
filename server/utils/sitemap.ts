import type { FetchFn } from './mediaLifecycle'
import { INDUSTRY_GUIDES } from '../../content/industry-guides'
import {
  contentPublicPath,
  isSitemapEligible,
  loadEligiblePublicContent,
  publicContentTypes,
  publishedContentLocales,
  type PublicContentOptions,
} from './contentPublic'

/**
 * CC-IMP-10 — `/sitemap.xml` (RELEASE-SAFETY-GATES RSG-02, §3A.2; Blueprint §30).
 *
 * Products keep their existing public semantics (published product in a published
 * category, `seo_noindex ≠ true`). The products query reads only fields the
 * `nuxt-server` products permission allows — `date_updated` is not one of them, so
 * product entries carry no `<lastmod>`.
 *
 * Content Center entries come from the one public eligibility contract
 * (`contentPublic.ts`) and are only narrowed further: sitemap-eligible type and
 * snapshot noindex = false. Every upstream failure throws; the route answers 503
 * instead of a normal-looking empty sitemap.
 */

type Row = Record<string, unknown>

export const SITEMAP_PRODUCTS_QUERY =
  '/items/products?filter[status][_eq]=published&filter[seo_noindex][_neq]=true&fields=slug,category_id,seo_noindex&limit=-1'
export const SITEMAP_CATEGORIES_QUERY =
  '/items/product_categories?filter[status][_eq]=published&fields=id,slug&limit=-1'

export interface SitemapUrl {
  loc: string
  lastmod: string | null
}

export interface SitemapOptions extends PublicContentOptions {
  siteUrl: string
  includeStaticPages?: boolean
}

async function productUrls(fetch: FetchFn, siteUrl: string): Promise<SitemapUrl[]> {
  const [productRes, categoryRes] = await Promise.all([
    fetch<{ data: Row[] }>(SITEMAP_PRODUCTS_QUERY),
    fetch<{ data: Row[] }>(SITEMAP_CATEGORIES_QUERY),
  ])
  const categorySlug = new Map<number, string>(
    (categoryRes.data ?? []).filter(c => typeof c.id === 'number' && typeof c.slug === 'string').map(c => [c.id as number, c.slug as string]),
  )
  return (productRes.data ?? [])
    .filter(p => typeof p.slug === 'string' && p.seo_noindex !== true && categorySlug.has(p.category_id as number))
    .map(p => ({ loc: `${siteUrl}/products/${categorySlug.get(p.category_id as number)}/${p.slug as string}`, lastmod: null }))
}

async function contentUrls(fetch: FetchFn, options: SitemapOptions): Promise<SitemapUrl[]> {
  const types = publicContentTypes(options).filter(type => type.sitemapEligible)
  const urls: SitemapUrl[] = []
  for (const locale of publishedContentLocales(options)) {
    const entries = await loadEligiblePublicContent(fetch, locale, types, { limit: -1 }, options)
    for (const entry of entries.filter(isSitemapEligible)) {
      urls.push({
        loc: `${options.siteUrl}${contentPublicPath(entry.type, entry.locale, entry.slug)}`,
        lastmod: entry.publishedAt ? entry.publishedAt.slice(0, 10) : null,
      })
    }
  }
  return urls
}

export async function buildSitemapUrls(fetch: FetchFn, options: SitemapOptions): Promise<SitemapUrl[]> {
  const siteUrl = options.siteUrl.replace(/\/$/, '')
  const [products, content] = await Promise.all([
    options.productsFromDirectus ? productUrls(fetch, siteUrl) : Promise.resolve([]),
    options.contentFromDirectus ? contentUrls(fetch, { ...options, siteUrl }) : Promise.resolve([]),
  ])
  const staticPages: SitemapUrl[] = options.includeStaticPages ? [
    '/', '/products', '/applications', '/resources', '/resources/downloads', '/resources/videos', '/support', '/support/faq',
    '/contact', '/technical-matching', '/find-a-distributor',
    '/company/about', '/company/quality-manufacturing', '/company/global-service', '/company/become-a-partner',
    ...INDUSTRY_GUIDES.map(guide => `/applications/${guide.slug}`),
  ].map(path => ({ loc: `${siteUrl}${path}`, lastmod: null })) : []
  return [...staticPages, ...products, ...content]
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function renderSitemap(urls: readonly SitemapUrl[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => (u.lastmod
      ? `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${xmlEscape(u.lastmod)}</lastmod></url>`
      : `  <url><loc>${xmlEscape(u.loc)}</loc></url>`)),
    '</urlset>',
  ].join('\n')
}
