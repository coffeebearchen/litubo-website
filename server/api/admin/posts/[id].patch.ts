import { getRouterParam, readBody, createError, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * V2-03 — update one blog/FAQ record on the collection the site actually reads.
 *
 * Only columns that already exist are accepted. `cover_fit` is the single column V2 adds; see
 * 10-MINIMAL-SCHEMA-API-V2.md. A client cannot rename the slug or move the record between content
 * types here, because a published English URL depends on both.
 */
const ALLOWED = [
  'title_en', 'title_es', 'title_pt',
  'excerpt_en', 'excerpt_es', 'excerpt_pt',
  'body_en', 'body_es', 'body_pt',
  'cover_image', 'cover_fit', 'status',
  'seo_title_en', 'seo_title_es', 'seo_title_pt',
  'seo_description_en', 'seo_description_es', 'seo_description_pt',
]

const COVER_FIT = ['contain', 'cover', 'null']

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid post id' })
  }

  const body = (await readBody(event)) ?? {}

  // V2-05: a three-value enum. An unknown value is rejected rather than stored, because the public
  // page would silently fall back to its old behaviour and the editor would look like it saved.
  if (body.cover_fit !== undefined && body.cover_fit !== null) {
    if (!COVER_FIT.includes(String(body.cover_fit))) {
      throw createError({ statusCode: 400, message: 'cover_fit must be contain, cover or null' })
    }
  }

  const payload: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, message: 'No editable field supplied' })
  }

  const res = await adminFetch<{ data?: unknown }>(event, `/items/posts/${id}`, {
    method: 'PATCH',
    body: payload,
  })

  return res?.data ?? null
})
