import { getQuery, getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { getContentMediaRelations } from '~/server/utils/contentMediaRelations'

/** CC-IMP-04 — the item's hero / inline / download links and relations (admin only, read-only). */
export default defineEventHandler(async (event) => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  return getContentMediaRelations(contentAdminFetch(event), id, getQuery(event).locale)
})
