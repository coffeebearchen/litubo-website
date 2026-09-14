import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { getContentDraft, parseContentItemId } from '~/server/utils/contentDraft'

/** CC-IMP-01 — read one Content Center item with its locale drafts (admin only). */
export default defineEventHandler(async (event) => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  return getContentDraft(contentAdminFetch(event), id)
})
