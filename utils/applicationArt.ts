/**
 * Single source of truth for the application illustrations.
 *
 * The `/applications` page and the Applications dropdown both resolve their artwork through these
 * helpers, so replacing a file updates both places at once — there is no second mapping to drift.
 *
 * Files live in `public/images/applications/<slug>.webp` and are the exported, on-brand hand-drawn
 * set (cool white ground, grey-green line work). They are category hints, never product photos.
 */

const ART_DIR = '/images/applications'

/** Artwork URL for an application slug, e.g. `packaged-food`. */
export function applicationArtPath(slug: string): string {
  return `${ART_DIR}/${slug}.webp`
}

/**
 * Slug from a resolved application route. `to` may carry a locale prefix (`/es/applications/...`)
 * and a query/hash, so the last path segment is taken rather than pattern-matching the prefix.
 */
export function applicationSlugFromPath(to: string): string {
  const clean = to.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '')
  const idx = clean.lastIndexOf('/')
  return idx === -1 ? clean : clean.slice(idx + 1)
}
