import { createError, getRouterParam } from 'h3'
import { assertProductExists } from '~/server/utils/adminDirectusClient'

/**
 * PWS-AI-ENGINE-01R2 — "Apply accepted changes to Draft" is disabled.
 * The previous implementation wrote through several independent Directus
 * REST calls with a best-effort compensating rollback on failure — not a
 * real atomic transaction (a compensation call could itself silently fail,
 * a process interruption could leave a partial batch committed, and
 * concurrent Apply calls on the same product were never detected). That
 * code has been removed rather than kept/wrapped/renamed. A real fix needs
 * a single Directus-side transactional command, which needs a custom
 * Directus extension, which needs an `/directus/extensions` volume mount
 * added to `docker-compose.yml` — the same compose file this repo shares
 * verbatim between local dev and production. That is a production Docker
 * infrastructure change and requires explicit per-action authorization this
 * task does not have, so this endpoint unconditionally refuses to write
 * anything until that transactional command exists. Generate and Review
 * are unaffected — only this last "commit to Draft" step is blocked.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  throw createError({
    statusCode: 503,
    message: 'Applying AI-proposed specification changes is temporarily disabled: a verified atomic database transaction is not yet available for this write path, so nothing can be saved. Review the proposed changes above; Apply will be re-enabled once a real transactional writer is built.',
  })
})
