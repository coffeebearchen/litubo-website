/**
 * CC-IMP-10 — Phase 1 public route ownership of the legacy `posts` collection (D-035).
 *
 * Technical Article and Case Study detail pages are served only by Content Center;
 * News is not public in Phase 1 (D-004 / D-013). The legacy `posts` API therefore
 * serves only the types whose public pages still read it: Technical Guides and FAQ.
 * No `posts` row is migrated, changed or deleted.
 */

export const LEGACY_PUBLIC_POST_TYPES = ['technical_guide', 'faq'] as const

export type LegacyPublicPostType = (typeof LEGACY_PUBLIC_POST_TYPES)[number]

export function isLegacyPublicPostType(value: unknown): value is LegacyPublicPostType {
  return typeof value === 'string' && (LEGACY_PUBLIC_POST_TYPES as readonly string[]).includes(value)
}
