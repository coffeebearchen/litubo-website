import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { ApplyRequestSchema, applyAcceptedSpecificationChanges } from '~/server/utils/aiSpecificationApply'

/**
 * PWS-AI-ENGINE-01R — "Apply accepted changes to Draft". The ONLY endpoint in
 * the AI-assisted Specifications flow that writes anything. It never calls
 * a model, never touches Page Content/FAQ/SEO/Media/Evidence/publish state.
 * All the actual pre-validation, writing, and failure-compensation logic
 * lives in `applyAcceptedSpecificationChanges()` (`aiSpecificationApply.ts`),
 * which is unit-tested directly with a mock Directus fetch — this file is a
 * thin, real Nitro wrapper around it.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const statusCheck = await adminFetch<{ data: { status: string } | null }>(
    event, `/items/products/${productId}?fields=status`,
  )
  if (statusCheck.data?.status === 'archived') {
    throw createError({ statusCode: 409, message: 'This product is archived and cannot be edited.' })
  }

  const body = await readBody(event)
  const parsed = ApplyRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Request body did not match the expected shape.' })
  }

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const result = await applyAcceptedSpecificationChanges(fetch, productId, parsed.data.changes)

  if (!result.ok) {
    throw createError({ statusCode: 409, message: result.error })
  }

  return { message: `${result.appliedCount} specification change${result.appliedCount === 1 ? '' : 's'} were applied to Draft.` }
})
