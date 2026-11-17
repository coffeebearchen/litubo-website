import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, settleApply } from '~/server/utils/aiProposalReplayGuard'
import type { CategoryIntroProposal } from '~/server/utils/aiTargets/categoryIntroTarget'

/**
 * The only writer of the category action: three columns on one `product_categories` row.
 *
 * It writes the values the person confirmed, not the ones the provider proposed - the panel lets them
 * edit the introduction and both search fields before saving. It cannot touch the category name, its
 * slug, its status, its hero image or which products are filed under it.
 */
export const MAX_CATEGORY_CONFIRM_BYTES = 4096

interface Body {
  id?: unknown
  proposalRef?: unknown
  intro?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
}

function clamp(value: unknown, max: number): string {
  return (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_CATEGORY_CONFIRM_BYTES)
  const rawId = String(body?.id ?? '')
  if (!/^[1-9]\d*$/.test(rawId)) throw createError({ statusCode: 400, message: 'Invalid category id' })
  const id = Number(rawId)
  const proposalRef = typeof body?.proposalRef === 'string' ? body.proposalRef : ''
  if (!proposalRef) throw createError({ statusCode: 400, message: 'proposalRef is required' })

  const intro = clamp(body?.intro, 400)
  const seoTitle = clamp(body?.seoTitle, 120)
  const seoDescription = clamp(body?.seoDescription, 320)
  if (!intro) throw createError({ statusCode: 400, message: 'An introduction is required' })
  if (!seoTitle) throw createError({ statusCode: 400, message: 'A search title is required' })
  if (!seoDescription) throw createError({ statusCode: 400, message: 'A search description is required' })

  const subjectKey = `category:${id}`
  const stored = readProposal<CategoryIntroProposal, unknown>(proposalRef, { subjectKey, adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This suggestion is no longer available. Generate it again.' })

  const claim = claimApply(proposalRef, { subjectKey, adminUserId })
  if (!claim.ok) {
    throw createError({ statusCode: 409, message: 'This suggestion has already been applied, or belongs to a different category.' })
  }

  try {
    await adminFetch(event, `/items/product_categories/${id}`, {
      method: 'PATCH',
      body: { intro_en: intro, seo_title_en: seoTitle, seo_description_en: seoDescription },
    })
    settleApply(proposalRef, { ok: true, appliedCount: 3, totalCount: 3, partial: false, message: 'saved' })
    return { ok: true, id, saved: { intro, seoTitle, seoDescription } }
  }
  catch (error) {
    settleApply(proposalRef, {
      ok: false,
      appliedCount: 0,
      totalCount: 3,
      partial: false,
      message: error instanceof Error ? error.message.slice(0, 200) : 'write failed',
    })
    throw error
  }
})
