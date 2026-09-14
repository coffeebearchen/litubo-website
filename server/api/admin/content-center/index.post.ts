import { setResponseStatus } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { CREATE_BODY_MAX_BYTES, createContentDraft } from '~/server/utils/contentDraft'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

/** CC-IMP-01 — create a Content Center draft item with its default-locale draft. Draft only. */
export default defineEventHandler(async (event) => {
  const body = await readJsonBodyWithByteLimit(event, CREATE_BODY_MAX_BYTES)
  const draft = await createContentDraft(contentAdminFetch(event), body)
  setResponseStatus(event, 201)
  return draft
})
