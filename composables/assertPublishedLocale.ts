/**
 * FINAL-RELEASE-FIX-C (RSG-05): a public Product or legacy posts page in a locale the site does not
 * publish answers 404; it never shows another locale's content instead. Call in setup, before loading data.
 */
export function assertPublishedLocale(): void {
  const { locale } = useI18n()
  if (!isPublishedLocale(locale.value, useRuntimeConfig().public.publishedLocales)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
}
