/**
 * Keep every locale the site does not publish closed, across static and dynamic routes.
 *
 * English is the only published locale in this phase. A prefix such as `/es`, `/pt`, `/zh` or `/ar`
 * answers 404 rather than rendering an English fallback under a translated URL, which would tell a
 * visitor (and a crawler) that the page is translated when it is not.
 *
 * The locale list is derived from the configured locales, so adding a language later does not need
 * this file to change — only `public.publishedLocales`.
 */
const KNOWN_LOCALES = ['en', 'es', 'pt', 'zh', 'ar', 'ja'] as const

export default defineNuxtRouteMiddleware((to) => {
  const published = useRuntimeConfig().public.publishedLocales
  const match = to.path.match(/^\/([a-z]{2}(?:-[A-Za-z]{2,4})?)(?:\/|$)/)
  if (!match) return

  const candidate = match[1]!
  if (!(KNOWN_LOCALES as readonly string[]).includes(candidate)) return
  if (candidate === 'en') return
  if (isPublishedLocale(candidate, published)) return

  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
})
