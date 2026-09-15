/**
 * CC-IMP-08 — the subject an analysis is about (Blueprint §17 "one engine,
 * generalized subject").
 *
 * The Proposal Engine, the replay guard, source refs and the Generate rate limit
 * were all keyed by a bare product id. A content item can share that number with
 * a product, and one content item has a separate Draft per locale, so every one
 * of those keys now uses the subject key:
 *
 *   product  → `product:<id>`
 *   content  → `content:<id>:<locale>`
 *
 * `content 6 / en` ≠ `content 6 / es` ≠ `content 4 / en` ≠ `product 6`. The key is
 * always built on the server from the route and the database, never taken from
 * a request body.
 */

export type AiSubjectKind = 'product' | 'content'

export function productSubjectKey(productId: number): string {
  return `product:${productId}`
}

export function contentSubjectKey(contentItemId: number, locale: string): string {
  return `content:${contentItemId}:${locale}`
}

/** A product binding (`{ productId }`, the existing Product AI shape) or an explicit subject key. */
export type AiSubjectBinding = { productId: number } | { subjectKey: string }

export function subjectKeyOf(binding: AiSubjectBinding): string {
  return 'subjectKey' in binding ? binding.subjectKey : productSubjectKey(binding.productId)
}
