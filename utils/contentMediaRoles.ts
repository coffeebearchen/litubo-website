/**
 * CC-IMP-01 — Content Center media role registry (CONTENT-CENTER-BLUEPRINT-V1 §11).
 *
 * Files always stay in the Media Library (D-023); `content_items_files` stores a
 * Media UUID plus one of these roles. Fail-closed: an unknown role is rejected.
 * `source_document` is internal — never public, never part of a published snapshot.
 * The linking workflow itself belongs to CC-IMP-04.
 */

export const CONTENT_MEDIA_ROLES = ['hero', 'og_image', 'inline', 'download', 'source_document'] as const

export type ContentMediaRole = (typeof CONTENT_MEDIA_ROLES)[number]

export const PUBLIC_CONTENT_MEDIA_ROLES: readonly ContentMediaRole[] = ['hero', 'og_image', 'inline', 'download']

/** At most one enabled link per item for these roles. */
export const SINGLE_ENABLED_CONTENT_MEDIA_ROLES: readonly ContentMediaRole[] = ['hero', 'og_image']

export function isContentMediaRole(value: unknown): value is ContentMediaRole {
  return typeof value === 'string' && (CONTENT_MEDIA_ROLES as readonly string[]).includes(value)
}

export function isPublicContentMediaRole(value: unknown): boolean {
  return isContentMediaRole(value) && PUBLIC_CONTENT_MEDIA_ROLES.includes(value)
}
