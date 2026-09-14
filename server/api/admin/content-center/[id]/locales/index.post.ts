import { getRouterParam, setResponseStatus } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { CREATE_BODY_MAX_BYTES, createLocaleDraft, parseContentItemId } from '~/server/utils/contentDraft'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

/** CC-IMP-01 — create a non-default locale draft, starting from the default locale's block structure. */
export default defineEventHandler(async (event) => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, CREATE_BODY_MAX_BYTES)
  const draft = await createLocaleDraft(contentAdminFetch(event), id, body)
  setResponseStatus(event, 201)
  return draft
})
