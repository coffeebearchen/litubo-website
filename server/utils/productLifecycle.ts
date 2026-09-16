import { createError } from 'h3'
import type { H3Event } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * FINAL-RELEASE-FIX-F — the one place the V1 product lifecycle is decided.
 *
 * Before this file the rule lived in four hand-synchronised copies (the PATCH
 * route, the publish panel, a test, and a filter enum) and the only Draft gate
 * in the whole server was a pasted `if` inside the AI Apply endpoint, while
 * twenty-five other write routes had none at all. A published product could be
 * re-written field by field, from either the legacy editor or the Workspace,
 * with no review and no trace.
 *
 * V1 contract (D-037):
 *
 *   draft      → business data may be written
 *   review     → read-only; publish or return to draft
 *   published  → read-only; return to draft to edit, then review and publish again
 *   archived   → read-only
 *
 * That is deliberately the smallest safe shape. It is NOT a published-snapshot
 * or revision-copy architecture: there is one row per product, and taking it
 * back to draft is what makes it editable. A snapshot model stays deferred.
 */

export type ProductStatus = 'draft' | 'review' | 'published' | 'archived'

export const PRODUCT_STATUS_VALUES: readonly ProductStatus[] = ['draft', 'review', 'published', 'archived']

/**
 * The status machine, as the server actually enforces it. `archived` has no
 * outgoing edge and no transition targets it, so the API can neither leave nor
 * reach that state — archiving stays a Directus-side action. Unchanged from the
 * behaviour this module inherited; it is only moved here so the PATCH route,
 * the tests and any future caller read the same table.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly ProductStatus[]>> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['draft'],
}

/** The statuses in which product business data may be created, updated or deleted. */
export const MUTABLE_STATUSES: readonly ProductStatus[] = ['draft']

/** Shown to an administrator who tried to edit a product that is not a Draft. */
export const NOT_DRAFT_MESSAGE = 'This product is not a Draft. Return it to Draft to edit it.'

export interface ProductLifecycle {
  id: number
  status: string
  product_code: string | null
  published_at: string | null
}

/**
 * Reads the lifecycle columns of one product, or throws 404.
 *
 * Uses a filter list query rather than a single-item request for the same
 * reason `assertProductExists` does: Directus answers a missing single item
 * with 403, which would be reported to the administrator as a permission
 * problem rather than a missing product.
 */
export async function readProductLifecycle(event: H3Event, productId: number): Promise<ProductLifecycle> {
  const result = await adminFetch<{ data: ProductLifecycle[] }>(
    event,
    `/items/products?filter[id][_eq]=${productId}&fields=id,status,product_code,published_at&limit=1`,
  )
  const row = result?.data?.[0]
  if (!row) throw createError({ statusCode: 404, message: `产品 ID ${productId} 不存在` })
  return row
}

/**
 * The single guard every product business write goes through.
 *
 * It proves the product exists and that it is a Draft, in one round trip, and
 * returns the lifecycle row so a caller that also needs the status or the
 * product code does not query again. A product under review, published or
 * archived is refused with 409 before anything is written — the same status
 * code and the same zero-write guarantee the AI Apply endpoint already used,
 * now shared rather than copied.
 *
 * Status transitions do NOT go through here: changing status is not a business
 * write, and a published product must still be able to return to draft.
 */
export async function assertProductDraftForMutation(
  event: H3Event,
  productId: number,
  options: { message?: string } = {},
): Promise<ProductLifecycle> {
  const lifecycle = await readProductLifecycle(event, productId)
  if (!MUTABLE_STATUSES.includes(lifecycle.status as ProductStatus)) {
    throw createError({ statusCode: 409, message: options.message ?? NOT_DRAFT_MESSAGE })
  }
  return lifecycle
}

/** True when `next` is a transition the server allows from `current`. */
export function isAllowedTransition(current: string, next: string): boolean {
  return (ALLOWED_TRANSITIONS[current] ?? []).includes(next as ProductStatus)
}
