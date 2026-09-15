import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { LIFECYCLE_BODY_MAX_BYTES, restoreContentItem } from '~/server/utils/contentLifecycle'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentLifecycleResult } from '~/types/content-center'

/**
 * CC-IMP-07 — manual Restore (Blueprint §24): archived → draft with every published snapshot
 * cleared. Never publishes; working copies, media links and relations are kept.
 */
export default defineEventHandler(async (event): Promise<AdminContentLifecycleResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, LIFECYCLE_BODY_MAX_BYTES)
  return restoreContentItem(contentAdminFetch(event), id, body)
})
