import { createHash } from 'node:crypto'
import { resolvePublicFiles } from './contentPublic'
import type { FetchFn } from './mediaLifecycle'
import type { ProductMediaInput } from './aiTargets/productMediaTarget'

/**
 * The pictures an AI may choose between for one product.
 *
 * Only enabled links to files that are publicly eligible right now are candidates (RSG-06): a private
 * or archived file must never become a proposed hero, because the public page would silently fall
 * back and the editor would think the placement worked. Raw file UUIDs are deliberately not sent to
 * the provider — the model sees row ids and human-readable labels, the same rule the AI source refs
 * follow.
 */
export interface MediaCandidate {
  /** `products_files.id` — what the model names, and what the confirm step re-resolves. */
  rowId: number
  fileId: string
  /** What the model is shown: file name, and the media title when it has one. */
  label: string
  title: string | null
  currentAlt: string | null
}

interface LinkRow {
  id: number
  directus_files_id: string | null
  file_role?: string | null
  enabled?: boolean | null
  alt_en?: string | null
  sort?: number | null
}

export async function loadProductMediaCandidates(fetch: FetchFn, productId: number): Promise<MediaCandidate[]> {
  const res = await fetch<{ data: LinkRow[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}&filter[enabled][_eq]=true`
    + '&fields=id,directus_files_id,file_role,enabled,alt_en,sort&sort=sort,id&limit=-1',
  )
  const links = (res.data ?? []).filter(l => typeof l.directus_files_id === 'string' && l.directus_files_id)
  if (links.length === 0) return []

  const eligible = await resolvePublicFiles(fetch, links.map(l => l.directus_files_id as string))
  const out: MediaCandidate[] = []
  for (const link of links) {
    const fileId = String(link.directus_files_id).toLowerCase()
    const file = eligible.get(fileId)
    if (!file) continue
    if (file.type && !file.type.startsWith('image/')) continue
    out.push({
      rowId: link.id,
      fileId,
      label: file.filename_download ?? file.title ?? `file ${link.id}`,
      title: file.title ?? null,
      currentAlt: link.alt_en ?? null,
    })
  }
  return out
}

export function buildProductMediaInput(
  product: { name_en?: string | null, product_code?: string | null, summary_en?: string | null },
  candidates: readonly MediaCandidate[],
): ProductMediaInput {
  return {
    sourceFileSummaries: [],
    extractedSourceTexts: [],
    product: {
      name: product.name_en ?? '',
      code: product.product_code ?? null,
      summary: product.summary_en ?? null,
    },
    media: candidates.map(c => ({ rowId: c.rowId, label: c.label, title: c.title, currentAlt: c.currentAlt })),
  }
}

/**
 * Changes when the pictures available to choose between change, or when the product text does.
 * A proposal made before a picture was added or removed is therefore stale by construction.
 */
export function productMediaFingerprint(
  product: { name_en?: string | null, product_code?: string | null, summary_en?: string | null },
  candidates: readonly MediaCandidate[],
): string {
  const media = [...candidates]
    .sort((a, b) => a.rowId - b.rowId)
    .map(c => `${c.rowId}:${c.fileId}:${c.currentAlt ?? ''}`)
  return createHash('sha256')
    .update(JSON.stringify([product.name_en ?? '', product.product_code ?? '', product.summary_en ?? '', media]), 'utf8')
    .digest('hex')
}
