/**
 * CC-IMP-01 — Content Center slug rules (CONTENT-CENTER-BLUEPRINT-V1 §14).
 *
 * Moved unchanged out of server/utils/contentDraft.ts by CC-IMP-05 so the SEO &
 * Locales page can show the same format / reserved-word check the BFF applies.
 * Uniqueness per locale stays with the BFF pre-check and the database index.
 */

export const CONTENT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const CONTENT_SLUG_MAX = 100
export const RESERVED_CONTENT_SLUGS = ['new', 'index', 'preview', 'draft', 'edit', 'admin', 'api', 'search', 'page', 'all'] as const

export type SlugValidation = { ok: true, slug: string } | { ok: false, message: string }

export function validateContentSlug(value: unknown): SlugValidation {
  if (typeof value !== 'string' || value.length === 0) return { ok: false, message: 'slug is required.' }
  if (value.length > CONTENT_SLUG_MAX) return { ok: false, message: `slug must be at most ${CONTENT_SLUG_MAX} characters.` }
  if (!CONTENT_SLUG_RE.test(value)) {
    return { ok: false, message: 'slug may contain only lowercase letters, digits and single hyphens between them.' }
  }
  if ((RESERVED_CONTENT_SLUGS as readonly string[]).includes(value)) {
    return { ok: false, message: `"${value}" is a reserved slug.` }
  }
  return { ok: true, slug: value }
}
