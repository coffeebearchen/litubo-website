import { getQuery, getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentHistory } from '~/server/utils/contentHistory'
import type { AdminContentHistory } from '~/types/content-center'

/** CC-IMP-07 — read-only change history and lifecycle state of one content item (admin only). Never writes. */
export default defineEventHandler(async (event): Promise<AdminContentHistory> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  return getContentHistory(contentAdminFetch(event), id, getQuery(event).page)
})
