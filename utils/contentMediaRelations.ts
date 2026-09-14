/**
 * CC-IMP-04 — Content Center Media & Relations (CC-03) shared rules
 * (CONTENT-CENTER-BLUEPRINT-V1 §11, §12; D-023).
 *
 * Files stay in the Media Library; `content_items_files` stores a Media UUID and
 * a role. This module owns the `hero`, `inline` and `download` links and the
 * product / content relations. `og_image` (SEO & Locales) and `source_document`
 * (AI Source Intake) belong to later modules and are preserved untouched.
 */

import type { ContentMediaRole } from './contentMediaRoles'

export const CONTENT_MEDIA_MANAGED_ROLES = ['hero', 'inline', 'download'] as const satisfies readonly ContentMediaRole[]

export type ContentManagedMediaRole = (typeof CONTENT_MEDIA_MANAGED_ROLES)[number]

/** Roles another module owns. A Media & Relations save never creates, edits or removes them. */
export const CONTENT_MEDIA_PRESERVED_ROLES = ['og_image', 'source_document'] as const satisfies readonly ContentMediaRole[]

/** Hero and inline links are pictures (the page cover and image sections). Downloads may be any file. */
export const CONTENT_IMAGE_ONLY_ROLES: readonly ContentManagedMediaRole[] = ['hero', 'inline']

/** Blueprint §11: `language` for downloads. */
export const CONTENT_DOWNLOAD_LANGUAGES = ['all', 'en', 'es', 'pt'] as const

export type ContentDownloadLanguage = (typeof CONTENT_DOWNLOAD_LANGUAGES)[number]

export const CONTENT_MEDIA_LINKS_MAX = 100
export const CONTENT_RELATIONS_MAX = 100
export const CONTENT_MEDIA_ALT_MAX = 250
export const CONTENT_MEDIA_CAPTION_MAX = 300
export const CONTENT_MEDIA_VERSION_MAX = 60

export const CONTENT_MEDIA_ROLE_LABELS: Readonly<Record<ContentMediaRole, string>> = {
  hero: 'Hero media',
  inline: 'Inline media',
  download: 'Download',
  og_image: 'Open Graph image',
  source_document: 'Source document',
}

export const CONTENT_DOWNLOAD_LANGUAGE_LABELS: Readonly<Record<ContentDownloadLanguage, string>> = {
  all: 'All languages',
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
}

export function isManagedContentMediaRole(value: unknown): value is ContentManagedMediaRole {
  return typeof value === 'string' && (CONTENT_MEDIA_MANAGED_ROLES as readonly string[]).includes(value)
}

export function isContentDownloadLanguage(value: unknown): value is ContentDownloadLanguage {
  return typeof value === 'string' && (CONTENT_DOWNLOAD_LANGUAGES as readonly string[]).includes(value)
}

export function isImageMimeType(type: unknown): boolean {
  return typeof type === 'string' && type.trim().toLowerCase().startsWith('image/')
}

/** `YYYY-MM-DD` that is a real calendar date. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function contentMediaAltField(locale: string): string {
  return `alt_${locale}`
}

export function contentMediaCaptionField(locale: string): string {
  return `caption_${locale}`
}
