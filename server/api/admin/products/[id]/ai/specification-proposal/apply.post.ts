import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import {
  ApplyRequestSchema,
  planSpecificationApply,
  executeSpecificationApply,
} from '~/server/utils/aiSpecificationApply'

/**
 * A legitimate body is at most 100 changes, each bounded by the schema to
 * roughly 1.2KB of text. The ceiling is enforced on bytes actually received
 * rather than on a declared `Content-Length`, matching Generate.
 */
export const MAX_APPLY_BODY_BYTES = 256 * 1024

/**
 * PWS-AI-APPLY-DRAFT-01 — "Apply accepted changes to Draft": the last step of
 * the single-product AI loop, and the only place AI-derived content is ever
 * written to a product.
 *
 * It writes ONLY what an administrator explicitly accepted on the Review
 * screen, ONLY to the product in this route, and ONLY while that product is a
 * Draft. It creates and updates specification rows and nothing else — no
 * delete, no status change, no publish, no media, no source, no SEO, no page
 * content. It calls no AI provider and reads no provider key.
 *
 * Order matters here, and it is: identify the product → confirm it is a Draft
 * → validate the body → preflight the entire batch → only then write. Every
 * refusal above the write step is a guaranteed zero-write refusal.
 *
 * Under Charter FD-004 this is Draft-only assistance with a human approving
 * every row, so it does not carry a database transaction. What it does carry
 * is honesty: a batch that fails halfway reports the real number applied and
 * stops, rather than claiming a rollback it cannot perform.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)

  // This describes one administrator's working session against one Draft.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  await assertProductExists(event, productId)

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)

  // Draft gate, checked before the body is even read: a product under review,
  // published, or archived is refused outright. Published content is never
  // reachable from this endpoint, by construction rather than by convention.
  const statusResult = await fetch<{ data: { status?: string } | null }>(
    `/items/products/${productId}?fields=status`,
  )
  if (statusResult?.data?.status !== 'draft') {
    throw createError({
      statusCode: 409,
      message: 'AI-assisted changes can only be applied to a Draft product.',
    })
  }

  const rawBody = await readJsonBodyWithByteLimit<unknown>(event, MAX_APPLY_BODY_BYTES)
  const parsed = ApplyRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    // The specific validation path is not echoed back: it describes the
    // request the client just sent, and a generic refusal is enough to act on.
    throw createError({ statusCode: 400, message: 'These changes could not be read. Nothing was written.' })
  }

  // Whole-batch preflight. Ownership of every update target is re-derived
  // server-side, and every add's destination group is resolved, before a
  // single write is issued.
  const plan = await planSpecificationApply(fetch, productId, parsed.data.changes)
  if (!plan.ok) {
    throw createError({ statusCode: plan.statusCode, message: plan.message })
  }

  return executeSpecificationApply(fetch, productId, plan.steps)
})
