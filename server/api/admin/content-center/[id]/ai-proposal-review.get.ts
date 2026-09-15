import { createError, getQuery, getRouterParam, setResponseHeader } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentAiProposalReview } from '~/server/utils/aiContentApply'
import type { AdminContentAiReview } from '~/types/content-center'

/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review read: the signed-in admin's newest proposal for one
 * content item and one exact locale (`?locale=`), with the current draft revision. Never writes.
 */
export default defineEventHandler(async (event): Promise<AdminContentAiReview> => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })
  return getContentAiProposalReview(contentAdminFetch(event), id, getQuery(event).locale, adminUserId)
})
