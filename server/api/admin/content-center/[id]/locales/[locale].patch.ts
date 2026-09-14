import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { UPDATE_BODY_MAX_BYTES, parseContentItemId, updateLocaleDraft } from '~/server/utils/contentDraft'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

/** CC-IMP-01 — save a locale working copy. Requires `expectedDraftRevision`; never touches publication fields. */
export default defineEventHandler(async (event) => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, UPDATE_BODY_MAX_BYTES)
  return updateLocaleDraft(contentAdminFetch(event), id, getRouterParam(event, 'locale'), body)
})
