/**
 * CC-IMP-01 — Content Center locales (CONTENT-CENTER-BLUEPRINT-V1 §15).
 *
 * Mirrors `i18n.locales` and `i18n.defaultLocale` in nuxt.config.ts; a test keeps
 * the two in step so there is no second locale configuration. Which locales the
 * public site actually publishes stays in `runtimeConfig.public.publishedLocales`.
 */

export const CONTENT_LOCALES = ['en', 'es', 'pt'] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]

export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'en'

export function isContentLocale(value: unknown): value is ContentLocale {
  return typeof value === 'string' && (CONTENT_LOCALES as readonly string[]).includes(value)
}
