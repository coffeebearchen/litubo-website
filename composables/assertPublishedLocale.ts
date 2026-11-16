/**
 * FINAL-RELEASE-FIX-C (RSG-05): a public Product or legacy posts page in a locale the site does not
 * publish answers 404; it never shows another locale's content instead. Call in setup, before loading data.
 *
 * A development-only preview locale is allowed through as well: `previewLocales` is empty in a
 * production build, so a translation draft can be reviewed locally without becoming reachable live.
 */
export function assertPublishedLocale(): void {
  const { locale } = useI18n()
  const config = useRuntimeConfig()
  if (isPublishedLocale(locale.value, config.public.publishedLocales)) return

  const preview = (config.public.previewLocales as string[] | undefined) ?? []
  if (preview.includes(locale.value)) return

  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}