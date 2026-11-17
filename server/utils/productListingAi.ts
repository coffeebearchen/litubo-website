import { createHash } from 'node:crypto'
import type { ProductListingInput } from './aiTargets/productListingTarget'

/**
 * Shared between the proposal and confirm endpoints of the Product Centre AI, so the two can never
 * disagree about what the proposal was based on.
 *
 * The fingerprint covers exactly the fields the copy was derived from. Changing a product's name or
 * category makes an older proposal stale; adding a note somewhere else does not.
 */
export interface ProductListingRow {
  id: number
  name_en?: string | null
  product_code?: string | null
  model_or_series?: string | null
  summary_en?: string | null
  category_id?: number | null
  status?: string | null
}

export interface CategoryOption { id: number, name: string }

export function productListingFingerprint(product: ProductListingRow): string {
  const parts = [
    product.name_en ?? '',
    product.product_code ?? '',
    product.model_or_series ?? '',
    product.summary_en ?? '',
    product.category_id === null || product.category_id === undefined ? '' : String(product.category_id),
  ]
  return createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex')
}

export function buildProductListingInput(product: ProductListingRow, categories: CategoryOption[]): ProductListingInput {
  const current = categories.find(c => c.id === product.category_id)
  return {
    sourceFileSummaries: [],
    extractedSourceTexts: [],
    product: {
      name: product.name_en ?? '',
      code: product.product_code ?? null,
      modelOrSeries: product.model_or_series ?? null,
      summary: product.summary_en ?? null,
      currentCategory: current?.name ?? null,
    },
    categories,
  }
}
