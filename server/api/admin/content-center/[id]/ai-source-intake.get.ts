import { createError, getQuery, getRouterParam, setResponseHeader } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentAiSourceIntake } from '~/server/utils/aiContentIntake'
import type { AdminContentAiSourceIntake } from '~/types/content-center'

/**
 * CC-IMP-08 — CC-AI-01 AI Source Intake read: the already-linked, eligible sources of one
 * content item for one locale, as opaque refs bound to this admin and subject. Never writes.
 */
export default defineEventHandler(async (event): Promise<AdminContentAiSourceIntake> => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })
  return getContentAiSourceIntake(contentAdminFetch(event), id, getQuery(event).locale, adminUserId)
})
