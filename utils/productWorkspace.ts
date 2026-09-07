/**
 * PWS-00 — Product Workspace Shell + Overview (read-only, PWS-00A).
 *
 * Pure helpers only. This module never issues a write request and never
 * invents data: every value it formats comes from a field the Register
 * (§4.5/§12.1i "PW-00" row) and the child blueprint (§18) already confirm
 * exists on the canonical `products` record.
 */

import type { AdminProduct, ProductCategory } from '~/types/product-cms'
import { adminAssetUrl } from './productCentre'

/**
 * Mandated literal Readiness text (Register §12.1i "PW-00" row + PWS-DOR-02).
 * `CH-DG-11` / `BP-DG-02` remain unresolved; no percentage, progress bar,
 * completion count or computed score may ever accompany this string.
 */
export const WORKSPACE_READINESS_UNAVAILABLE = 'Not assessed — rule not configured'

export type WorkspaceModuleGroup = 'PRODUCT RECORD' | 'PUBLISH & DISTRIBUTE' | 'CONTROL'

export interface WorkspaceModuleNavItem {
  key: string
  label: string
  group: WorkspaceModuleGroup
  /** Only `overview` (PWS-00) is enabled until its own work order lands. */
  enabled: boolean
}

/**
 * PWS-00…PWS-08 addressing (Register §4.6 / child blueprint §6). Order and
 * grouping follow `PW-VIS-01-OVERVIEW-D1440`'s module rail. Every entry other
 * than `overview` is a visible-but-disabled placeholder — it must never
 * navigate anywhere, since no route exists for it yet.
 */
export const WORKSPACE_MODULE_NAV: WorkspaceModuleNavItem[] = [
  { key: 'overview', label: 'Overview', group: 'PRODUCT RECORD', enabled: true },
  { key: 'page-content', label: 'Page content', group: 'PRODUCT RECORD', enabled: false },
  { key: 'specifications', label: 'Specifications', group: 'PRODUCT RECORD', enabled: false },
  { key: 'media-resources', label: 'Media & resources', group: 'PRODUCT RECORD', enabled: false },
  { key: 'relations', label: 'Relations', group: 'PRODUCT RECORD', enabled: false },
  { key: 'seo-locales', label: 'SEO & locales', group: 'PUBLISH & DISTRIBUTE', enabled: false },
  { key: 'share-distribution', label: 'Share & distribution', group: 'PUBLISH & DISTRIBUTE', enabled: false },
  { key: 'sources-evidence', label: 'Sources & evidence', group: 'CONTROL', enabled: false },
  { key: 'change-history', label: 'Change history', group: 'CONTROL', enabled: false },
]

export const WORKSPACE_MODULE_GROUPS: WorkspaceModuleGroup[] = [
  'PRODUCT RECORD',
  'PUBLISH & DISTRIBUTE',
  'CONTROL',
]

/** Real category name for the product's `category_id`, or an honest fallback. */
export function workspaceCategoryName(
  product: AdminProduct | null,
  categories: Pick<ProductCategory, 'id' | 'name_en'>[],
): string {
  if (!product?.category_id) return 'Not set'
  return categories.find(c => c.id === product.category_id)?.name_en ?? `ID ${product.category_id}`
}

/** Reuses the same hardened asset proxy as Product Control — never a copied file. */
export function workspaceHeroUrl(product: AdminProduct | null): string | null {
  return product?.hero_image
    ? adminAssetUrl(product.hero_image, { width: 480, height: 320, quality: 75 })
    : null
}
