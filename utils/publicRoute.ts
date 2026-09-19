/**
 * FINAL-RELEASE-FIX-C — the public page contract for Product and legacy posts pages
 * (RELEASE-SAFETY-GATES RSG-05; D-009; D-035 already applies the same rules to Content Center):
 *
 *   record not found, not published, or not public in this locale  → 404
 *   upstream (Directus) unavailable or failing                      → 503
 *   a locale outside runtimeConfig.public.publishedLocales          → 404, never another locale's content
 */

/** True only for a locale the public site publishes. */
export function isPublishedLocale(locale: unknown, publishedLocales: unknown): boolean {
  return typeof locale === 'string' && Array.isArray(publishedLocales) && publishedLocales.includes(locale)
}

/**
 * The status a public page must answer with once its data has loaded, or null when it can render.
 * A 4xx from the public API means not found; a 5xx, or an error without a status (the API could not
 * be reached), means unavailable. Neither is ever turned into the other, or into an empty 200.
 */
export function publicPageStatus(error: { statusCode?: number } | null | undefined, hasData: boolean): 404 | 503 | null {
  if (error) {
    const status = error.statusCode
    return typeof status === 'number' && status >= 400 && status < 500 ? 404 : 503
  }
  return hasData ? null : 404
}

/**
 * LITUBO-STABLE-BASELINE-CLOSEOUT-01 — an Open Graph / Twitter image URL must be absolute. A site-relative
 * path (the public media proxy `/api/cms/media/<id>`, a static `/images/…` file) is made absolute with the
 * trusted configured site URL — never the request Host — the way canonical URLs and Content Center pages
 * already build theirs. An absolute URL is kept only when it is already on that site URL; anything else
 * (another origin, protocol-relative, other schemes, a bare name) is not an image URL this site emits, so
 * the caller falls back to the site default.
 */
export function absoluteSiteUrl(siteUrl: string, value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const base = siteUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(value)) return value.startsWith(`${base}/`) ? value : undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  return `${base}${value}`
}
