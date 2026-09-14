import { getRouterParam } from 'h3'
import { contentAdminFetch } from '~/server/utils/contentAdminFetch'
import { parseContentItemId } from '~/server/utils/contentDraft'
import { MEDIA_RELATIONS_BODY_MAX_BYTES, saveContentMediaRelations } from '~/server/utils/contentMediaRelations'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

/**
 * CC-IMP-04 — save the complete desired set of hero / inline / download links and
 * relations. Validated as a whole before any write; never touches content status,
 * blocks, file lifecycle or file visibility.
 */
export default defineEventHandler(async (event) => {
  const id = parseContentItemId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, MEDIA_RELATIONS_BODY_MAX_BYTES)
  return saveContentMediaRelations(contentAdminFetch(event), id, body)
})
