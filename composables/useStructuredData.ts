import type { PublicSiteSettings } from '~/types/settings'

/**
 * schema.org JSON-LD builders.
 *
 * These exist so AI answer engines and classic crawlers can read the site as entities rather than
 * guess from prose. Every field is taken from the database or the site settings — nothing is
 * inferred. In particular:
 *
 * - no `offers`/`price`: the site never publishes prices, and inventing one would be a false claim;
 * - no `aggregateRating`/`review`: there are no approved customer reviews;
 * - no `hasCertification`: certifications are not published in this phase.
 *
 * A page that emits a node without those optional blocks is still valid schema.org.
 */

export function useStructuredData() {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  const abs = (pathOrUrl: string): string => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    return `${siteUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
  }

  /** Publisher entity — used on the home page and as `brand` on products. */
  function organizationNode(settings: PublicSiteSettings | null | undefined): Record<string, unknown> {
    const node: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: settings?.brand_name || 'LITUBO',
      url: `${siteUrl}/`,
    }
    if (settings?.legal_company_name) node.legalName = settings.legal_company_name
    if (settings?.public_email) node.email = settings.public_email
    if (settings?.public_phone) node.telephone = settings.public_phone
    if (settings?.public_address) {
      node.address = {
        '@type': 'PostalAddress',
        streetAddress: settings.public_address,
        addressCountry: 'CN',
      }
    }
    const socials = (settings?.social_links ?? []).map(l => l.url).filter(Boolean)
    if (socials.length) node.sameAs = socials
    return node
  }

  /** Site entity with the query entry point search engines expect. */
  function websiteNode(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LITUBO',
      url: `${siteUrl}/`,
    }
  }

  interface ProductNodeInput {
    name: string
    description: string
    slug: string
    categorySlug: string
    model: string
    images: string[]
    brand?: string
  }

  function productNode(input: ProductNodeInput): Record<string, unknown> {
    const node: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: input.name,
      url: `${siteUrl}/products/${input.categorySlug}/${input.slug}`,
      brand: { '@type': 'Brand', name: input.brand || 'LITUBO' },
    }
    if (input.description) node.description = input.description
    if (input.model) node.sku = input.model
    if (input.model) node.model = input.model
    const images = input.images.map(abs).filter(Boolean)
    if (images.length === 1) node.image = images[0]
    else if (images.length > 1) node.image = images
    return node
  }

  interface Crumb { name: string; path: string }

  function breadcrumbNode(crumbs: Crumb[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: abs(c.path),
      })),
    }
  }

  interface QaPair { question: string; answer: string }

  function faqNode(pairs: QaPair[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: pairs.map(p => ({
        '@type': 'Question',
        name: p.question,
        acceptedAnswer: { '@type': 'Answer', text: p.answer },
      })),
    }
  }

  return { siteUrl, org: organizationNode, website: websiteNode, product: productNode, breadcrumb: breadcrumbNode, faq: faqNode }
}
