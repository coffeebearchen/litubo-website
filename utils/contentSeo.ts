/**
 * CC-IMP-05 — Content Center SEO rules shared by the admin BFF and the SEO &
 * Locales page (CONTENT-CENTER-BLUEPRINT-V1 §6.1, §13, §14).
 *
 * V1 SEO data per locale row: slug, `seo_title` (fallback `title`),
 * `seo_description` (fallback `summary`), `canonical_path` (same-site path
 * override), `noindex`. The Open Graph image is an item-level `og_image` Media
 * Library link that falls back to the hero. Focus terms and social title /
 * description are not V1 data. Nothing here renders a public URL, scores a page
 * or estimates readiness — the checklist is a fixed set of yes / no facts.
 */

import type { AdminContentLocaleDraft } from '../types/content-center'
import { validateContentSlug } from './contentSlug'

export const CONTENT_TITLE_MAX = 160
export const CONTENT_SUMMARY_MAX = 400
export const CONTENT_SEO_TITLE_MAX = 120
export const CONTENT_SEO_DESCRIPTION_MAX = 320
export const CONTENT_CANONICAL_PATH_MAX = 255

export type CanonicalPathValidation = { ok: true, path: string | null } | { ok: false, message: string }

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 0x20 || code === 0x7F) return true
  }
  return false
}

/**
 * `canonical_path` is an internal path on this site: it starts with one "/", has
 * no whitespace, backslash or control character, so it can never be an external,
 * protocol-relative (`//host`) or scheme (`https:`, `javascript:`) URL.
 */
export function validateCanonicalPath(value: unknown): CanonicalPathValidation {
  if (value === null || value === undefined) return { ok: true, path: null }
  if (typeof value !== 'string') return { ok: false, message: 'canonical_path must be a string or null.' }
  const path = value.trim()
  if (path.length === 0) return { ok: true, path: null }
  if (path.length > CONTENT_CANONICAL_PATH_MAX) {
    return { ok: false, message: `canonical_path must be at most ${CONTENT_CANONICAL_PATH_MAX} characters.` }
  }
  if (!path.startsWith('/') || path.startsWith('//') || /[\s\\]/.test(path) || hasControlCharacter(path)) {
    return { ok: false, message: 'canonical_path must be an internal path starting with "/".' }
  }
  return { ok: true, path }
}

/** Blueprint §14: a locale's slug is locked once that locale has been published for the first time. */
export function isContentSlugLocked(row: Pick<AdminContentLocaleDraft, 'first_published_at'> | null | undefined): boolean {
  return Boolean(row?.first_published_at)
}

export interface SeoPreviewSource {
  title: string | null
  summary: string | null
  seo_title: string | null
  seo_description: string | null
}

export interface EffectiveSeoText {
  text: string
  source: 'seo' | 'fallback' | 'none'
}

/** The title a search engine would get: SEO title, else the page title. */
export function effectiveSeoTitle(source: SeoPreviewSource): EffectiveSeoText {
  const seo = source.seo_title?.trim()
  if (seo) return { text: seo, source: 'seo' }
  const title = source.title?.trim()
  return title ? { text: title, source: 'fallback' } : { text: '', source: 'none' }
}

/** The description a search engine would get: meta description, else the summary. */
export function effectiveSeoDescription(source: SeoPreviewSource): EffectiveSeoText {
  const seo = source.seo_description?.trim()
  if (seo) return { text: seo, source: 'seo' }
  const summary = source.summary?.trim()
  return summary ? { text: summary, source: 'fallback' } : { text: '', source: 'none' }
}

export type SocialImageSource = 'og_image' | 'hero' | 'none'

/** Open Graph image, else the hero (a preview fallback only — no link is created). */
export function socialImageSource(ogImage: unknown, hero: unknown): SocialImageSource {
  if (ogImage) return 'og_image'
  return hero ? 'hero' : 'none'
}

export type SeoCheckState = 'ok' | 'note' | 'attention'

export interface SeoCheckItem {
  key: 'slug' | 'title' | 'description' | 'canonical' | 'image' | 'indexing'
  state: SeoCheckState
  label: string
  detail: string
}

export interface SeoChecklistInput extends SeoPreviewSource {
  slug: string
  canonical_path: string | null
  noindex: boolean
  slugLocked: boolean
  ogImage: { archived: boolean } | null
  hero: { archived: boolean } | null
}

/** Deterministic Draft facts for one locale. No score, weight or percentage. */
export function contentSeoChecklist(input: SeoChecklistInput): SeoCheckItem[] {
  const slug = validateContentSlug(input.slug)
  const title = effectiveSeoTitle(input)
  const description = effectiveSeoDescription(input)
  const canonical = validateCanonicalPath(input.canonical_path)
  const image = socialImageSource(input.ogImage, input.hero)
  const imageArchived = image === 'og_image' ? input.ogImage!.archived : image === 'hero' ? input.hero!.archived : false

  return [
    slug.ok
      ? { key: 'slug', state: 'ok', label: 'URL slug is valid', detail: input.slugLocked ? 'Locked after first publication.' : 'Uniqueness for this language is checked when you save.' }
      : { key: 'slug', state: 'attention', label: 'URL slug needs attention', detail: slug.message },
    title.source === 'seo'
      ? { key: 'title', state: 'ok', label: 'SEO title set', detail: `${title.text.length} characters.` }
      : title.source === 'fallback'
        ? { key: 'title', state: 'note', label: 'SEO title uses the page title', detail: 'Add an SEO title to control the search result title.' }
        : { key: 'title', state: 'attention', label: 'No title available', detail: 'Add a title in Content editor or an SEO title here.' },
    description.source === 'seo'
      ? { key: 'description', state: 'ok', label: 'Meta description set', detail: `${description.text.length} characters.` }
      : description.source === 'fallback'
        ? { key: 'description', state: 'note', label: 'Meta description uses the summary', detail: 'Add a meta description to control the search snippet.' }
        : { key: 'description', state: 'attention', label: 'No description available', detail: 'Add a meta description here or a summary in Content editor.' },
    !canonical.ok
      ? { key: 'canonical', state: 'attention', label: 'Canonical path is not valid', detail: canonical.message }
      : canonical.path
        ? { key: 'canonical', state: 'ok', label: 'Custom canonical path', detail: canonical.path }
        : { key: 'canonical', state: 'ok', label: 'Default canonical', detail: 'Resolved when Public Delivery is enabled.' },
    imageArchived
      ? { key: 'image', state: 'attention', label: 'Preview image is archived', detail: 'Replace it with an active Media Library image.' }
      : image === 'og_image'
        ? { key: 'image', state: 'ok', label: 'Open Graph image set', detail: 'Used for social previews.' }
        : image === 'hero'
          ? { key: 'image', state: 'note', label: 'Social preview uses the hero image', detail: 'Select an Open Graph image to use a different picture.' }
          : { key: 'image', state: 'attention', label: 'No image for social previews', detail: 'Select an Open Graph image or a hero image in Media & relations.' },
    input.noindex
      ? { key: 'indexing', state: 'note', label: 'Noindex is on', detail: 'Search engines will be asked not to index this language once it is public.' }
      : { key: 'indexing', state: 'ok', label: 'Indexing allowed', detail: 'Applies only after this language is published.' },
  ]
}
