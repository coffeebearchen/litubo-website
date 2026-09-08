import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import {
  isSupportedTextSourceMime,
  sanitizeDisplayNameForBrowser,
  temporarilyUnsupportedReason,
} from '~/server/utils/aiTextExtraction'
import { createSourceRef } from '~/server/utils/aiSourceRef'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — the AI Source Intake screen's own,
 * minimal source list.
 *
 * That screen used to call the general product media endpoint, which answers
 * with the full association row: `directus_files_id` (a storage UUID),
 * `filename_download`, `caption_en`, `alt_en`, dimensions, sort order. None of
 * that is needed to choose files to analyze, and a UUID handed to the browser
 * is a durable identifier into the content store.
 *
 * This endpoint returns only what the screen renders and what Generate needs:
 * a sanitized display name, plain labels, whether the file can be analyzed and
 * why not, and an opaque `sourceRef` that stands in for the association id
 * (see `aiSourceRef.ts`). Everything else stays on the server.
 */

/** Exactly what the browser receives per file. Nothing here is a Directus identifier. */
export interface AiIntakeSource {
  sourceRef: string
  displayName: string
  typeLabel: string
  roleLabel: string
  analyzable: boolean
  /** Present only when `analyzable` is false — the honest, specific reason. */
  unavailableReason: string | null
}

interface ProductFileRow {
  id: number
  enabled: boolean | null
  file_role: string | null
  directus_files_id: {
    filename_download: string | null
    type: string | null
  } | null
}

function typeLabel(mime: string | null): string {
  if (!mime) return 'Unknown'
  const type = mime.toLowerCase().split(';')[0].trim()
  if (type === 'text/csv') return 'CSV'
  if (type === 'text/tab-separated-values') return 'TSV'
  if (type === 'text/plain') return 'Text'
  if (type === 'application/pdf') return 'PDF'
  if (type.startsWith('image/')) return 'Image'
  if (type.startsWith('video/')) return 'Video'
  return 'File'
}

function roleLabel(role: string | null): string {
  if (!role) return 'Role not set'
  return role.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Why this file cannot be analyzed, in the order the reasons actually apply. */
function unavailableReasonFor(row: ProductFileRow): string | null {
  const mime = row.directus_files_id?.type ?? null
  const droppedFormat = temporarilyUnsupportedReason(mime)
  if (droppedFormat) return droppedFormat
  if (!isSupportedTextSourceMime(mime)) return 'Not available for text-source analysis yet.'
  if (row.enabled !== true) return 'This file is disabled for this product, so it cannot be analyzed. Enable it in Media & resources first.'
  return null
}

export default defineEventHandler(async (event): Promise<AiIntakeSource[]> => {
  // Provider status and source lists describe one administrator's working
  // context; neither should be held by a shared cache or survive sign-out.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const adminUserId = event.context.adminUserId as string | undefined
  if (!adminUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const result = await adminFetch<{ data: ProductFileRow[] }>(
    event,
    `/items/products_files?filter[products_id][_eq]=${productId}`
    + '&fields=id,enabled,file_role,directus_files_id.filename_download,directus_files_id.type'
    + '&limit=200&sort=sort,id',
  )

  return (result.data ?? []).map((row) => {
    const reason = unavailableReasonFor(row)
    return {
      sourceRef: createSourceRef(row.id, { productId, adminUserId }),
      displayName: sanitizeDisplayNameForBrowser(row.directus_files_id?.filename_download ?? null),
      typeLabel: typeLabel(row.directus_files_id?.type ?? null),
      roleLabel: roleLabel(row.file_role),
      analyzable: reason === null,
      unavailableReason: reason,
    }
  })
})
