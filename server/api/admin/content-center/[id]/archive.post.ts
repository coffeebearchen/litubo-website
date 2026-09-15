import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { LIFECYCLE_BODY_MAX_BYTES, archiveContentItem } from '~/server/utils/contentLifecycle'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import type { AdminContentLifecycleResult } from '~/types/content-center'

/**
 * CC-IMP-07 — manual Archive (Blueprint §23, §24). A human admin action only: admin session +
 * CSRF (middleware) and `expectedLifecycleFingerprint`. Nothing is deleted; no media file changes.
 */
export default defineEventHandler(async (event): Promise<AdminContentLifecycleResult> => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, LIFECYCLE_BODY_MAX_BYTES)
  return archiveContentItem(contentAdminFetch(event), id, body)
})
