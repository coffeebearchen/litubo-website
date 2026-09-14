import { getQuery } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { listContentDrafts } from '~/server/utils/contentDraft'

/** CC-IMP-01 — list Content Center items (admin only; foundation for the CC-00 list). */
export default defineEventHandler(async (event) => {
  return listContentDrafts(contentAdminFetch(event), getQuery(event))
})
