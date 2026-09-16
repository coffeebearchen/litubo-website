import { createError } from 'h3'

/**
 * FINAL-RELEASE-FIX-F — the V1 release gate for Product AI Apply.
 *
 * Apply writes a batch of specification rows as a sequence of independent
 * Directus REST calls. There is no database transaction available to it: this
 * repository has no database driver and no transaction helper, every write goes
 * through the Directus HTTP API, and one batch can be up to two hundred separate
 * writes. Making that batch genuinely all-or-nothing would need a new data
 * access layer or a Directus extension — a redesign, not a fix — so V1 does not
 * pretend otherwise (a try/catch, a compensating delete or a best-effort
 * rollback is not atomicity, and the previous implementation was withdrawn
 * precisely for claiming that it was).
 *
 * What V1 does instead is refuse to run the non-atomic path in production. The
 * flag is a plain boolean, never a secret:
 *
 *   production      → enabled ONLY when PRODUCT_AI_APPLY_ENABLED is exactly
 *                     "true". Missing, empty or anything else is disabled.
 *   everything else → enabled unless PRODUCT_AI_APPLY_ENABLED is "false", so
 *                     local development and the test suite are unchanged.
 *
 * Nothing is deleted or hidden: Generate, the proposal and the human review
 * screen all still work; only the write is closed, and only where a partial
 * batch would be someone's live catalogue.
 */

export const PRODUCT_AI_APPLY_DISABLED_MESSAGE
  = 'Applying AI proposals is turned off on this server. Add the accepted values in Specifications instead.'

/** Reads the flag with the fail-closed rule above. `nodeEnv` is injectable for tests. */
export function isProductAiApplyEnabled(
  config: { productAiApplyEnabled?: unknown },
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const raw = typeof config?.productAiApplyEnabled === 'string'
    ? config.productAiApplyEnabled.trim().toLowerCase()
    : ''
  if (nodeEnv === 'production') return raw === 'true'
  return raw !== 'false'
}

/** Throws 503 when Apply is closed on this server. Checked before anything is claimed or written. */
export function assertProductAiApplyEnabled(
  config: { productAiApplyEnabled?: unknown },
  nodeEnv?: string | undefined,
): void {
  if (!isProductAiApplyEnabled(config, nodeEnv)) {
    throw createError({ statusCode: 503, message: PRODUCT_AI_APPLY_DISABLED_MESSAGE })
  }
}
