/**
 * Canonical media folder policy.
 * Imported by both client (pages/) and server (server/api/) code.
 *
 * Rule: only CANONICAL folders may be chosen as upload or move targets.
 * LEGACY folders are browsable in the sidebar but cannot be used as targets.
 * Unrecognised folder names (future additions) are treated as legacy until
 * explicitly added to CANONICAL_FOLDER_NAMES.
 */

export const CANONICAL_FOLDER_NAMES: ReadonlySet<string> = new Set([
  // Site sections
  'home',
  'applications',
  'brand',
  // Products — root + product-category subfolders
  'products',
  'xray',
  'metal-detection',
  'combination',
  'checkweigher',
  'conveyor',
  // Resources
  'resources',
  'manuals',
  'certificates',
  'certifications',
  // Company
  'company',
  // Internal
  'test-only',
])

export const LEGACY_FOLDER_NAMES: ReadonlySet<string> = new Set([
  'case-studies',
  'insights',
  'downloads',
  'global-service',
  'technical-docs',
])

export function isFolderCanonical(name: string): boolean {
  return CANONICAL_FOLDER_NAMES.has(name)
}

export function isFolderLegacy(name: string): boolean {
  return LEGACY_FOLDER_NAMES.has(name)
}
