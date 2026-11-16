/**
 * Locale gate for public routes.
 *
 * A locale is reachable only when it is either published, or listed in `previewLocales` — and
 * `previewLocales` is empty in a production build, so a translation draft can be reviewed in a
 * development build without ever being reachable on the live site.
 *
 * A prefixed locale that is not reachable answers 404. It must never render the English fallback
 * under a translated URL: that would tell a visitor, and a crawler, that the page is translated when
 * it is not.
 */
const KNOWN_LOCALES = ['en', 'es', 'pt', 'zh', 'ar', 'ja'] as const

export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  const published = config.public.publishedLocales
  const preview = (config.public.previewLocales as string[] | undefined) ?? []

  const match = to.path.match(/^\/([a-z]{2}(?:-[A-Za-z]{2,4})?)(?:\/|$)/)
  if (!match) return

  const candidate = match[1]!
  if (!(KNOWN_LOCALES as readonly string[]).includes(candidate)) return
  if (candidate === 'en') return
  if (isPublishedLocale(candidate, published)) return
  if (preview.includes(candidate)) return

  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
})
