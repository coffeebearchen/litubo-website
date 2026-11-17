import { createError, setResponseHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { claimApply, readProposal, settleApply } from '~/server/utils/aiProposalReplayGuard'
import { ALT_STORAGE_MAX, type MediaAltProposal } from '~/server/utils/aiTargets/mediaAltTarget'

/**
 * The only writer of the assistant's alt-text action.
 *
 * It writes one column on one file: `directus_files.title`, which the media library shows and the
 * public pages already read as alt text. It cannot change the file, its folder, its visibility, its
 * public-eligibility flag or anything that links it to a product.
 *
 * An empty value is refused: clearing an alt would be a silent regression for screen readers, and a
 * file that genuinely needs no description should be handled deliberately, not by accepting a blank.
 */
export const MAX_MEDIA_ALT_CONFIRM_BYTES = 1024

interface Body {
  fileId?: unknown
  proposalRef?: unknown
  altText?: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readJsonBodyWithByteLimit<Body>(event, MAX_MEDIA_ALT_CONFIRM_BYTES)
  const fileId = String(body?.fileId ?? '')
  if (!UUID_RE.test(fileId)) throw createError({ statusCode: 400, message: 'Invalid file id' })
  const proposalRef = typeof body?.proposalRef === 'string' ? body.proposalRef : ''
  if (!proposalRef) throw createError({ statusCode: 400, message: 'proposalRef is required' })

  const altText = (typeof body?.altText === 'string' ? body.altText : '').replace(/\s+/g, ' ').trim()
  if (!altText) throw createError({ statusCode: 400, message: 'Alt text cannot be empty' })
  if (altText.length > ALT_STORAGE_MAX) throw createError({ statusCode: 400, message: 'Alt text is too long' })

  const subjectKey = `media:${fileId.toLowerCase()}`
  const stored = readProposal<MediaAltProposal, unknown>(proposalRef, { subjectKey, adminUserId })
  if (!stored) throw createError({ statusCode: 409, message: 'This suggestion is no longer available. Generate it again.' })

  const claim = claimApply(proposalRef, { subjectKey, adminUserId })
  if (!claim.ok) {
    throw createError({ statusCode: 409, message: 'This suggestion has already been applied, or belongs to a different file.' })
  }

  try {
    await adminFetch(event, `/files/${fileId.toLowerCase()}`, { method: 'PATCH', body: { title: altText } })
    settleApply(proposalRef, { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'saved' })
    return { ok: true, fileId, altText }
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
