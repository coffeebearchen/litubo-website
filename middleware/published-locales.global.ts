/** English first: keep incomplete ES/PT pages closed across static and dynamic routes. */
export default defineNuxtRouteMiddleware((to) => {
  const match = to.path.match(/^\/(es|pt)(?:\/|$)/)
  if (match && !isPublishedLocale(match[1], useRuntimeConfig().public.publishedLocales)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
})
