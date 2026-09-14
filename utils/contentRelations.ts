/**
 * CC-IMP-01 — Content Center relation foundation (CONTENT-CENTER-BLUEPRINT-V1 §12).
 *
 * Relations only reference product / content ids; they never copy product truth.
 * The database enforces exactly one target per kind, no self relation and no
 * duplicate target (directus/schema/cc-imp-01-constraints.sql). This validator is
 * the matching BFF-side check for the relation workflow built in CC-IMP-04.
 */

export const CONTENT_RELATION_KINDS = ['product', 'content'] as const

export type ContentRelationKind = (typeof CONTENT_RELATION_KINDS)[number]

export interface ContentRelationInput {
  relation_kind: unknown
  product_id?: unknown
  related_content_id?: unknown
}

export type ContentRelationValidation =
  | { ok: true, relation_kind: ContentRelationKind, product_id: number | null, related_content_id: number | null }
  | { ok: false, message: string }

const isPositiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

export function isContentRelationKind(value: unknown): value is ContentRelationKind {
  return typeof value === 'string' && (CONTENT_RELATION_KINDS as readonly string[]).includes(value)
}

export function validateContentRelationInput(input: ContentRelationInput, sourceItemId: number): ContentRelationValidation {
  if (!isContentRelationKind(input.relation_kind)) {
    return { ok: false, message: 'relation_kind must be "product" or "content".' }
  }
  const hasProduct = input.product_id !== undefined && input.product_id !== null
  const hasContent = input.related_content_id !== undefined && input.related_content_id !== null

  if (input.relation_kind === 'product') {
    if (!isPositiveInt(input.product_id) || hasContent) {
      return { ok: false, message: 'A product relation needs exactly one product_id and no related_content_id.' }
    }
    return { ok: true, relation_kind: 'product', product_id: input.product_id, related_content_id: null }
  }

  if (!isPositiveInt(input.related_content_id) || hasProduct) {
    return { ok: false, message: 'A content relation needs exactly one related_content_id and no product_id.' }
  }
  if (input.related_content_id === sourceItemId) {
    return { ok: false, message: 'A content item cannot be related to itself.' }
  }
  return { ok: true, relation_kind: 'content', product_id: null, related_content_id: input.related_content_id }
}
