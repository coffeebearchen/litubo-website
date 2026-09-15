/**
 * CC-IMP-05 — SEO & Locales page state (client).
 *
 * The page edits one language at a time: slug, SEO title, meta description,
 * canonical path and noindex of that locale row, plus the item's Open Graph
 * image. Edits stay local until one explicit Save, which sends only what changed
 * with the revision (`expectedDraftRevision`) and image version
 * (`expectedOgVersion`) it loaded. Starting a language is a separate, explicit
 * action that creates an untranslated Draft through the existing locale endpoint.
 */

import type { AdminContentSeoImage, AdminContentSeoLocaleRow, AdminContentSeoLocales } from '../types/content-center'
import { CONTENT_LOCALE_LABELS, CONTENT_LOCALE_STATE_LABELS, contentApiErrorStatus, contentLocaleState, type ContentLocaleState } from './contentCenter'
import type { ContentLocale } from './contentLocales'

export interface SeoFormState {
  slug: string
  seo_title: string
  seo_description: string
  canonical_path: string
  noindex: boolean
}

export function seoFormFromRow(row: Pick<AdminContentSeoLocaleRow, 'slug' | 'seo_title' | 'seo_description' | 'canonical_path' | 'noindex'>): SeoFormState {
  return {
    slug: row.slug ?? '',
    seo_title: row.seo_title ?? '',
    seo_description: row.seo_description ?? '',
    canonical_path: row.canonical_path ?? '',
    noindex: row.noindex === true,
  }
}

export type SeoSaveFields = Partial<{
  slug: string
  seo_title: string | null
  seo_description: string | null
  canonical_path: string | null
  noindex: boolean
}>

/** Only the fields that changed. Optional text compares and saves as the server stores it (trimmed, empty → null). */
export function seoChangedFields(original: SeoFormState, current: SeoFormState): SeoSaveFields {
  const changed: SeoSaveFields = {}
  if (current.slug !== original.slug) changed.slug = current.slug
  for (const key of ['seo_title', 'seo_description', 'canonical_path'] as const) {
    if (current[key].trim() !== original[key].trim()) changed[key] = current[key].trim() || null
  }
  if (current.noindex !== original.noindex) changed.noindex = current.noindex
  return changed
}

/** The Open Graph image staged on the page: the loaded one, another Media Library image, or none. */
export interface StagedOgImage {
  directus_files_id: string
  file: AdminContentSeoImage['file']
}

export function stagedOgFrom(image: AdminContentSeoImage | null): StagedOgImage | null {
  return image ? { directus_files_id: image.directus_files_id, file: { ...image.file } } : null
}

export function isOgImageChanged(original: StagedOgImage | null, current: StagedOgImage | null): boolean {
  return (original?.directus_files_id.toLowerCase() ?? null) !== (current?.directus_files_id.toLowerCase() ?? null)
}

export interface SeoLocalesSaveBody {
  locale: ContentLocale
  expectedDraftRevision?: number
  fields?: SeoSaveFields
  og_image?: { directus_files_id: string | null, expectedOgVersion: string }
}

export function buildSeoLocalesSaveBody(input: {
  locale: ContentLocale
  revision: number
  original: SeoFormState | null
  current: SeoFormState | null
  originalOg: StagedOgImage | null
  currentOg: StagedOgImage | null
  ogVersion: string
}): SeoLocalesSaveBody | null {
  const body: SeoLocalesSaveBody = { locale: input.locale }
  const fields = input.original && input.current ? seoChangedFields(input.original, input.current) : {}
  if (Object.keys(fields).length > 0) {
    body.expectedDraftRevision = input.revision
    body.fields = fields
  }
  if (isOgImageChanged(input.originalOg, input.currentOg)) {
    body.og_image = { directus_files_id: input.currentOg?.directus_files_id ?? null, expectedOgVersion: input.ogVersion }
  }
  return body.fields || body.og_image ? body : null
}

// ── Languages ───────────────────────────────────────────────────────────────

export interface SeoLocaleTab {
  code: ContentLocale
  label: string
  isDefault: boolean
  state: ContentLocaleState
  stateLabel: string
  /** In `publishedLocales`: the public site serves this language. */
  sitePublished: boolean
  row: AdminContentSeoLocaleRow | null
}

export function seoLocaleTabs(value: Pick<AdminContentSeoLocales, 'site_locales' | 'default_locale' | 'published_locales' | 'locales'>): SeoLocaleTab[] {
  return value.site_locales.map((code) => {
    const row = value.locales.find(l => l.locale === code) ?? null
    const state = contentLocaleState(row)
    return {
      code,
      label: CONTENT_LOCALE_LABELS[code],
      isDefault: code === value.default_locale,
      state,
      stateLabel: CONTENT_LOCALE_STATE_LABELS[state],
      sitePublished: value.published_locales.includes(code),
      row,
    }
  })
}

/**
 * A starting slug for a new language: the default language's slug. The same slug
 * may be used in another language; the user edits it before starting.
 */
export function suggestedLocaleSlug(value: Pick<AdminContentSeoLocales, 'locales' | 'default_locale'>): string {
  return value.locales.find(l => l.locale === value.default_locale)?.slug ?? ''
}

export function localeStartBody(locale: ContentLocale, title: string, slug: string): { locale: ContentLocale, title: string, slug: string } {
  return { locale, title: title.trim(), slug: slug.trim() }
}

// ── Save errors ─────────────────────────────────────────────────────────────

export type SeoField = 'slug' | 'seo_title' | 'seo_description' | 'canonical_path' | 'noindex'
const SEO_FIELDS: readonly SeoField[] = ['slug', 'seo_title', 'seo_description', 'canonical_path', 'noindex']

export type SeoSaveErrorKind = 'conflict' | 'og_conflict' | 'field' | 'image' | 'partial' | 'rejected' | 'session' | 'forbidden' | 'not_found' | 'too_large' | 'unavailable'

export interface SeoSaveError {
  kind: SeoSaveErrorKind
  status: number
  message: string
  field: SeoField | null
  currentDraftRevision: number | null
  /** Partial save: the SEO fields were written and the image change may be retried as is. */
  seoSaved: boolean
  ogImageRetryable: boolean
}

export const SEO_CONFLICT_MESSAGE = 'This language draft changed since you opened it.'
export const SEO_OG_CONFLICT_MESSAGE = 'The Open Graph image changed since you opened this page.'

export function interpretSeoLocalesSaveError(err: unknown): SeoSaveError {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: Record<string, unknown> } } | null)?.data
  const serverMessage = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const inner = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const base = (kind: SeoSaveErrorKind, message: string, extra: Partial<SeoSaveError> = {}): SeoSaveError => ({
    kind, status, message, field: null, currentDraftRevision: null, seoSaved: false, ogImageRetryable: false, ...extra,
  })

  if (inner.partial === true) {
    const saved = Array.isArray(inner.saved) && inner.saved.includes('seo')
    const revision = Number(inner.currentDraftRevision)
    return base('partial', serverMessage ?? 'Saving stopped part-way.', {
      seoSaved: saved,
      ogImageRetryable: inner.ogImageRetryable === true,
      currentDraftRevision: Number.isInteger(revision) ? revision : null,
    })
  }
  switch (status) {
    case 409: {
      if ('currentDraftRevision' in inner) {
        const current = Number(inner.currentDraftRevision)
        return base('conflict', SEO_CONFLICT_MESSAGE, { currentDraftRevision: Number.isInteger(current) ? current : null })
      }
      if ('currentOgVersion' in inner) return base('og_conflict', SEO_OG_CONFLICT_MESSAGE)
      if (inner.field === 'slug') return base('field', serverMessage ?? 'This slug is already used for this language.', { field: 'slug' })
      return base('rejected', serverMessage ?? 'These changes cannot be saved right now.')
    }
    case 422:
      if (SEO_FIELDS.includes(inner.field as SeoField)) return base('field', serverMessage ?? 'This value is not valid.', { field: inner.field as SeoField })
      if (inner.field === 'og_image') return base('image', serverMessage ?? 'This image cannot be used as the Open Graph image.')
      return base('rejected', serverMessage ?? 'Some values are not valid. Nothing was saved.')
    case 413:
      return base('too_large', 'This save is too large.')
    case 400:
      return base('rejected', serverMessage ?? 'The save request could not be processed.')
    case 401:
      return base('session', 'Your session has expired. Your unsaved changes are still here — sign in again in another tab, then save.')
    case 403:
      return base('forbidden', 'You do not have permission to change this content item.')
    case 404:
      return base('not_found', serverMessage ?? 'This content item or language draft was not found.')
    default:
      return base('unavailable', 'Content Center is temporarily unavailable. Your unsaved changes are kept — try again.')
  }
}

export const SEO_LOCALES_LEAVE_MESSAGE = 'You have unsaved SEO or language changes. Leave without saving?'
export const SEO_LOCALES_SWITCH_MESSAGE = 'You have unsaved changes on this page. Switch language and discard them?'
