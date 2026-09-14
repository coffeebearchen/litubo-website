import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { countContentLinks, getContentDraft, parseContentItemId } from '~/server/utils/contentDraft'
import type { AdminContentDraftDetail } from '~/types/content-center'

/**
 * CC-IMP-01 — read one Content Center item with its locale drafts (admin only).
 * CC-IMP-02 — also returns real media-link and relation counts for the Overview.
 */
export default defineEventHandler(async (event): Promise<AdminContentDraftDetail> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const fetch = contentAdminFetch(event)
  const draft = await getContentDraft(fetch, id)
  return { ...draft, linkCounts: await countContentLinks(fetch, id) }
})
