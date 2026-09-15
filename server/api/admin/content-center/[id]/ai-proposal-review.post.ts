import { createError, getRouterParam, setResponseHeader } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { CONTENT_AI_APPLY_BODY_MAX_BYTES, applyContentAiProposal } from '~/server/utils/aiContentApply'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentAiApplyResult } from '~/types/content-center'

/**
 * CC-IMP-09 — "Apply approved changes": writes the human-approved items of one server-held
 * proposal to the same content locale's working Draft in one PATCH. Admin session + CSRF come
 * from the global middleware; the body is byte-limited before it is parsed. Never publishes.
 */
export default defineEventHandler(async (event): Promise<AdminContentAiApplyResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const body = await readJsonBodyWithByteLimit(event, CONTENT_AI_APPLY_BODY_MAX_BYTES)
  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })
  return applyContentAiProposal(contentAdminFetch(event), id, body, adminUserId)
})
