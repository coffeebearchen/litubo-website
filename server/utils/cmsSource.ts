import { createError } from 'h3'

/**
 * FINAL-RELEASE-FIX-C — where the public CMS APIs read their data (D-020).
 *
 * `directus` is the only source a production server may use. The DEMO fixtures are a development and
 * test convenience and are served only outside production. In production every other value of
 * CMS_MODE / CMS_MODE_PRODUCTS — `fixtures`, empty, missing or unknown — fails closed: the request is
 * answered 503 and no fixture is ever returned. The misconfiguration is logged, never corrected silently.
 */

export type CmsSource = 'directus' | 'fixtures'

export type CmsModeKey = 'cmsMode' | 'productsCmsMode'

const ENV_NAMES: Record<CmsModeKey, string> = { cmsMode: 'CMS_MODE', productsCmsMode: 'CMS_MODE_PRODUCTS' }

/** The source for a configured mode, or null when a production server must refuse to serve. */
export function resolveCmsSource(mode: unknown, nodeEnv: string | undefined = process.env.NODE_ENV): CmsSource | null {
  if (mode === 'directus') return 'directus'
  return nodeEnv === 'production' ? null : 'fixtures'
}

/** The source for one public API request; a production server not configured for Directus answers 503. */
export function requireCmsSource(key: CmsModeKey): CmsSource {
  const source = resolveCmsSource(useRuntimeConfig()[key])
  if (source) return source
  console.error(`[cms] ${ENV_NAMES[key]} must be "directus" in production; refusing to serve demo fixtures`)
  throw createError({ statusCode: 503, message: 'Content temporarily unavailable' })
}
