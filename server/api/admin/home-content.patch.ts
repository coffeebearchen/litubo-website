import type { H3Event } from 'h3'
import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * Admin: update one fixed home block (English source text + publish state).
 *
 * Only the English columns are exposed here: ES/PT are not indexable in this phase and the owner
 * edits them in Directus when needed. Publishing is explicit — a `draft` block is not returned by
 * the public /api/cms/home endpoint.
 */

interface PatchBody {
  id?: unknown
  eyebrow_en?: unknown
  title_en?: unknown
  body_en?: unknown
  status?: unknown
}

const STATUSES = new Set(['published', 'draft'])

function text(value: unknown, max: number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw createError({ statusCode: 400, message: 'Expected text' })
  return value.slice(0, max)
}

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<PatchBody>(event).catch(() => null)
  const id = Number(body?.id)
  if (!body || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'A valid block id is required' })
  }

  const patch: Record<string, unknown> = {}
  const eyebrow = text(body.eyebrow_en, 200)
  const title = text(body.title_en, 400)
  const content = text(body.body_en, 2000)
  if (eyebrow !== undefined) patch.eyebrow_en = eyebrow
  if (title !== undefined) patch.title_en = title
  if (content !== undefined) patch.body_en = content
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUSES.has(body.status)) {
      throw createError({ statusCode: 400, message: 'status must be published or draft' })
    }
    patch.status = body.status
  }
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const updated = await adminFetch<{ data: { id: number; content_key: string; status: string } }>(
    event,
    `/items/site_content/${id}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  return { ok: true, block: updated.data }
})
