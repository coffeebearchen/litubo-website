import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { archivedAmong } from '~/server/utils/contentMediaRelations'
import { sanitizeDisplayNameForBrowser } from '~/server/utils/aiTextExtraction'
import { createSourceRef, SourceRefUnavailableError } from '~/server/utils/aiSourceRef'
import { aiSourceFormatFor, aiSourceFormatRefusal, aiSourceTypeLabel, sourceFailureMessage } from '~/utils/aiSourceFormats'

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
 *
 * FINAL-RELEASE-FIX-F — a file archived in the Media Library is listed as
 * unavailable rather than offered. Content AI has always applied that rule;
 * Product AI did not, so an archived file could still be selected, downloaded
 * and sent to a paid provider. The engine now refuses it as well, so this list
 * can never offer a file the engine would drop.
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
  /** AI-IMAGE-OCR-SOURCE-01 — an image counts toward the per-analysis image limit. */
  isImage: boolean
}

interface ProductFileRow {
  id: number
  enabled: boolean | null
  file_role: string | null
  directus_files_id: {
    id: string | null
    filename_download: string | null
    type: string | null
  } | null
}

/** The same wording Content AI uses for an archived source. */
const ARCHIVED_FILE_REASON = 'This file is archived in the Media Library, so it cannot be analyzed.'

function roleLabel(role: string | null): string {
  if (!role) return 'Role not set'
  return role.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Why this file cannot be analyzed, in the order the reasons actually apply.
 *
 * AI-SOURCE-CONTRACT-01 — the format decision and its wording both come from the
 * shared source contract, the same one the engine reads the file with, so this
 * list can never offer a file the engine would refuse.
 */
function unavailableReasonFor(row: ProductFileRow, archived: Set<string>): string | null {
  const mime = row.directus_files_id?.type ?? null
  const refusal = aiSourceFormatRefusal(mime)
  if (refusal) return sourceFailureMessage(refusal, mime)
  if (row.enabled !== true) return sourceFailureMessage('disabled')
  if (archived.has(row.directus_files_id?.id ?? '')) return ARCHIVED_FILE_REASON
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
    + '&fields=id,enabled,file_role,directus_files_id.id,directus_files_id.filename_download,directus_files_id.type'
    + '&limit=200&sort=sort,id',
  )

  const rows = result.data ?? []
  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const archived = await archivedAmong(fetch, rows.map(row => row.directus_files_id?.id ?? '').filter(Boolean))

  try {
    return rows.map((row) => {
      const reason = unavailableReasonFor(row, archived)
      return {
        sourceRef: createSourceRef(row.id, { productId, adminUserId }),
        displayName: sanitizeDisplayNameForBrowser(row.directus_files_id?.filename_download ?? null),
        typeLabel: aiSourceTypeLabel(row.directus_files_id?.type ?? null),
        roleLabel: roleLabel(row.file_role),
        analyzable: reason === null,
        unavailableReason: reason,
        isImage: aiSourceFormatFor(row.directus_files_id?.type ?? null)?.key === 'image',
      }
    })
  } catch (error) {
    // Fail closed: with no server secret there is no safe handle to hand out,
    // and raw Directus ids are never an acceptable fallback.
    if (error instanceof SourceRefUnavailableError) {
      throw createError({ statusCode: 503, message: 'AI source selection is unavailable on this server.' })
    }
    throw error
  }
})
