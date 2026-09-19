import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { Locale } from '~/types/content'
import { absoluteSiteUrl } from '~/utils/publicRoute'

export interface SeoHeadOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /**
   * Relative path for canonical URL.
   * - Home page: pass '/' (produces trailing-slash canonical).
   * - All other pages: no trailing slash, no query string or hash.
   * - Empty string: no canonical or hreflang (FAQ post records, noindex pages).
   */
  canonicalPath: MaybeRefOrGetter<string>
  /**
   * og:image / twitter:image. An absolute URL, or a site-relative path that is made absolute with the
   * configured site URL (`absoluteSiteUrl`). Falls back to the site default when omitted or unusable.
   */
  ogImage?: MaybeRefOrGetter<string | undefined>
  /** true → outputs noindex,follow; suppresses canonical and hreflang. */
  noIndex?: MaybeRefOrGetter<boolean | undefined>
  /** og:type — defaults to 'website'. Pass 'article' for content detail pages. */
  ogType?: 'website' | 'article'
}

const OG_IMAGE_FALLBACK = '/images/home/home-hero-inspection-line.png'

const OG_LOCALE_MAP: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
  pt: 'pt_BR',
}

/**
 * Unified SEO head composable — the single authority for:
 * canonical, hreflang, og:*, twitter:*, robots meta.
 *
 * html lang is handled separately in layouts/default.vue.
 *
 * publishedLocales=['en'] rules (Phase 8B-1):
 *   EN routes  → canonical + hreflang="en" + hreflang="x-default" (both → EN URL)
 *   /es/ /pt/  → noindex,follow; no canonical; no hreflang
 *   noIndex    → noindex,follow; no canonical; no hreflang
 *   canonicalPath='' → no canonical; no hreflang
 *
 * OG image fallback note: uses home-hero-inspection-line.png (1255×895 px, ratio 1.40:1).
 * Social platforms will centre-crop. Provide a 1200×630 og-default.jpg to replace this.
 */
export function useSeoHead(options: SeoHeadOptions) {
  const { locale } = useI18n()
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  useHead(computed(() => {
    const title = toValue(options.title)
    const description = toValue(options.description)
    const rawPath = toValue(options.canonicalPath)
    const ogImageProp = toValue(options.ogImage)
    const noIndex = toValue(options.noIndex) ?? false
    const ogType = options.ogType ?? 'website'
    const currentLocale = locale.value as Locale

    const isEnLocale = currentLocale === 'en'

    // Canonical URL construction
    let canonicalUrl = ''
    if (rawPath) {
      if (rawPath === '/') {
        canonicalUrl = `${siteUrl}/`
      }
      else {
        // Strip query string, hash, and trailing slash
        const clean = rawPath.split('?')[0].split('#')[0].replace(/\/$/, '')
        canonicalUrl = `${siteUrl}${clean}`
      }
    }

    const ogUrl = canonicalUrl || `${siteUrl}/`
    const ogImage = absoluteSiteUrl(siteUrl, ogImageProp) ?? `${siteUrl}${OG_IMAGE_FALLBACK}`
    const ogLocale = OG_LOCALE_MAP[currentLocale] ?? 'en_US'

    const showCanonicalHreflang = !noIndex && isEnLocale && !!canonicalUrl
    const showNoIndex = noIndex || !isEnLocale

    const link: Array<Record<string, string>> = []
    const meta: Array<Record<string, string>> = []

    if (showNoIndex) {
      meta.push({ name: 'robots', content: 'noindex, follow' })
    }

    if (showCanonicalHreflang) {
      link.push({ rel: 'canonical', href: canonicalUrl })
      link.push({ rel: 'alternate', hreflang: 'en', href: canonicalUrl })
      link.push({ rel: 'alternate', hreflang: 'x-default', href: canonicalUrl })
    }

    meta.push({ property: 'og:title', content: title })
    meta.push({ property: 'og:description', content: description })
    meta.push({ property: 'og:type', content: ogType })
    meta.push({ property: 'og:url', content: ogUrl })
    meta.push({ property: 'og:image', content: ogImage })
    meta.push({ property: 'og:image:alt', content: title })
    meta.push({ property: 'og:site_name', content: 'LITUBO' })
    meta.push({ property: 'og:locale', content: ogLocale })

    meta.push({ name: 'twitter:card', content: 'summary_large_image' })
    meta.push({ name: 'twitter:title', content: title })
    meta.push({ name: 'twitter:description', content: description })
    meta.push({ name: 'twitter:image', content: ogImage })

    return {
      title,
      meta: [
        { name: 'description', content: description },
        ...meta,
      ],
      link,
    }
  }))
}
