/**
 * Content adapter composable.
 *
 * Phase 1: reads from local DEMO fixtures.
 * Phase 2: reads from Directus via the same interface — only adapter internals change.
 * Components must not import fixtures directly.
 */

import type { ProductCategory, Product, Application } from '~/types/content'
import {
  DEMO_PRODUCT_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_APPLICATIONS,
} from '~/content/fixtures'

/* ─── Product categories ─────────────────────────────────────────────── */
export function useProductCategories(): ProductCategory[] {
  return DEMO_PRODUCT_CATEGORIES
}

export function useProductCategory(slug: string): ProductCategory | undefined {
  return DEMO_PRODUCT_CATEGORIES.find(c => c.slug === slug)
}

/* ─── Products ──────────────────────────────────────────────────────── */
export function useProducts(categorySlug?: string): Product[] {
  const all = DEMO_PRODUCTS
  if (categorySlug) {
    const cat = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
    if (!cat) return []
    return all.filter(p => p.categoryId === cat.id)
  }
  return all
}

export function useProduct(categorySlug: string, slug: string): Product | undefined {
  const cat = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
  if (!cat) return undefined
  return DEMO_PRODUCTS.find(p => p.categoryId === cat.id && p.slug === slug)
}

/* ─── Applications ──────────────────────────────────────────────────── */
export function useApplications(): Application[] {
  return DEMO_APPLICATIONS
}

export function useApplication(slug: string): Application | undefined {
  return DEMO_APPLICATIONS.find(a => a.slug === slug)
}
