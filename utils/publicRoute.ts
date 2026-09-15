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
