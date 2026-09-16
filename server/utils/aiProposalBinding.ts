/**
 * FINAL-RELEASE-FIX-F — what the server remembers about a Product AI proposal,
 * beyond the proposal text itself.
 *
 * Product proposals used to store no binding at all: the replay guard held the
 * output, the administrator and the subject, and nothing about the material the
 * analysis had read. Apply therefore could not ask the only question that
 * matters at write time — "are the sources this was derived from still sources
 * this product is allowed to use?" — and silently skipped it.
 *
 * The binding is built entirely on the server from what Generate actually
 * resolved. It holds association row ids (`products_files.id`), never a Directus
 * file UUID, and nothing from the request body.
 */
export interface ProductProposalBinding {
  kind: 'product'
  productId: number
  /** The `products_files` rows the analysis read, exactly as Generate resolved them. */
  mediaIds: number[]
  /** The analysis fingerprint this proposal was minted under. */
  fingerprint: string
}

export function createProductProposalBinding(
  productId: number,
  mediaIds: number[],
  fingerprint: string,
): ProductProposalBinding {
  return { kind: 'product', productId, mediaIds: [...mediaIds].sort((a, b) => a - b), fingerprint }
}
