import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, settleApply } from '~/server/utils/aiProposalReplayGuard'
import { SEO_ENTITIES, isSeoEntity, seoSubjectKey } from '~/server/utils/seoMetaAi'
import type { SeoMetaProposal } from '~/server/utils/aiTargets/seoMetaTarget'

/**
 * The only writer of the assistant's SEO action.
 *
 * The value written is the one the person confirmed, not the one the provider proposed: the panel lets
 * them edit both fields before saving, and this endpoint stores exactly what it was sent. The proposal
 * reference is still required, so a confirmation can only happen once and only for the item it was
 * generated for.
 *
 * `seo_title` / `seo_description` are the only two columns this endpoint can touch. It cannot change a
 * title, a body, a status, a slug or the publication state.
 */
export const MAX_SEO_CONFIRM_BODY_BYTES = 2048

interface Body {
  entity?: unknown
  id?: unknown
  proposalRef?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
}

function clamp(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.slice(0, max)
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_SEO_CONFIRM_BODY_BYTES)
  const entity = body?.entity
  if (!isSeoEntity(entity)) throw createError({ statusCode: 400, message: 'Unknown entity' })
  const rawId = String(body?.id ?? '')
  if (!/^[1-9]\d*$/.test(rawId)) throw createError({ statusCode: 400, message: 'Invalid id' })
  const id = Number(rawId)
  const proposalRef = typeof body?.proposalRef === 'string' ? body.proposalRef : ''
  if (!proposalRef) throw createError({ statusCode: 400, message: 'proposalRef is required' })

  const spec = SEO_ENTITIES[entity]
  const seoTitle = clamp(body?.seoTitle, 120)
  const seoDescription = clamp(body?.seoDescription, 320)
  if (!seoTitle) throw createError({ statusCode: 400, message: 'A search title is required' })
  if (!seoDescription) throw createError({ statusCode: 400, message: 'A search description is required' })

  const subjectKey = seoSubjectKey(entity, id)
  const stored = readProposal<SeoMetaProposal, unknown>(proposalRef, { subjectKey, adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This suggestion is no longer available. Generate it again.' })

  const claim = claimApply(proposalRef, { subjectKey, adminUserId })
  if (!claim.ok) {
    throw createError({ statusCode: 409, message: 'This suggestion has already been applied, or belongs to a different item.' })
  }

  try {
    const patch = {
      [spec.seoTitleColumn]: seoTitle,
      [spec.seoDescriptionColumn]: seoDescription,
    }

    if (entity === 'post') {
      await adminFetch(event, `/items/posts/${id}`, { method: 'PATCH', body: patch })
    }
    else {
      const rows = await adminFetch<{ data: Array<{ id: number }> }>(
        event,
        `/items/content_item_locales?filter[content_items_id][_eq]=${id}&filter[locale][_eq]=${spec.locale}&fields=id&limit=1`,
      )
      const row = rows?.data?.[0]
      if (!row) throw createError({ statusCode: 404, message: 'No English content locale for this item' })
      await adminFetch(event, `/items/content_item_locales/${row.id}`, { method: 'PATCH', body: patch })
    }

    settleApply(proposalRef, { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'saved' })
    return { ok: true, entity, id, saved: { seoTitle, seoDescription } }
  }
  catch (error) {
    settleApply(proposalRef, {
      ok: false,
      appliedCount: 0,
      totalCount: 1,
      partial: false,
      message: error instanceof Error ? error.message.slice(0, 200) : 'write failed',
    })
    throw error
  }
})
