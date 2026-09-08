/**
 * PWS-00 — Product Workspace Shell + Overview (read-only, PWS-00A).
 * PWS-01 — Page Content (editable, PWS-01-FAST-01).
 * PWS-07 — Sources & Evidence (read-only, PWS-07-FAST-01R).
 *
 * Pure helpers never invent data or issue a write request themselves: every
 * value they format comes from a field the Register (§4.5/§12.1i "PW-00" row,
 * "PW-03" row, "PW-06" row) and the child blueprint (§18, §19, §20) already
 * confirm exists on the canonical `products` / `product_sections` /
 * `product_faqs` / `product_source_records` records. `PWS-01`'s own writes go
 * through the existing, already-shipped sections/FAQ admin API — nothing here
 * calls it directly.
 */

import type { AdminProduct, ProductCategory, FileRole } from '~/types/product-cms'
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
  /** Only a module with its own landed work order is enabled (`overview`, `page-content`, `sources-evidence`). */
  enabled: boolean
  /** Shown visibly next to a disabled item's name (not hover-only) — every disabled item must have one. */
  disabledReason?: string
}

/**
 * PWS-00…PWS-08 addressing (Register §4.6 / child blueprint §6). Order and
 * grouping follow `PW-VIS-01-OVERVIEW-D1440`'s module rail. Every disabled
 * entry is a visible-but-disabled placeholder — it must never navigate
 * anywhere, since no route exists for it yet.
 */
export const WORKSPACE_MODULE_NAV: WorkspaceModuleNavItem[] = [
  { key: 'overview', label: 'Overview', group: 'PRODUCT RECORD', enabled: true },
  { key: 'page-content', label: 'Page content', group: 'PRODUCT RECORD', enabled: true },
  { key: 'specifications', label: 'Specifications', group: 'PRODUCT RECORD', enabled: true },
  { key: 'media-resources', label: 'Media & resources', group: 'PRODUCT RECORD', enabled: true },
  { key: 'relations', label: 'Relations', group: 'PRODUCT RECORD', enabled: false, disabledReason: 'Not built yet' },
  { key: 'seo-locales', label: 'SEO & locales', group: 'PUBLISH & DISTRIBUTE', enabled: false, disabledReason: 'Not built yet' },
  { key: 'share-distribution', label: 'Share & distribution', group: 'PUBLISH & DISTRIBUTE', enabled: false, disabledReason: 'Not built yet' },
  { key: 'sources-evidence', label: 'Sources & evidence', group: 'CONTROL', enabled: true },
  { key: 'ai-source-intake', label: 'AI Source Intake', group: 'CONTROL', enabled: true },
  { key: 'change-history', label: 'Change history', group: 'CONTROL', enabled: false, disabledReason: 'Not built yet' },
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

/**
 * PWS-07 review-status display mapping (PWS-07-FAST-01R, confirmed decision).
 * The `SourceReviewStatus` enum on `product_source_records` is unchanged —
 * this only renames the four existing values to clear English UI text.
 * `null`/unset renders as "Pending verification", matching the default state
 * a newly created source record is in before anyone reviews it.
 */
export function sourceReviewStatusLabel(status: string | null): string {
  switch (status) {
    case 'confirmed': return 'Verified'
    case 'needs_review': return 'Needs review'
    case 'missing': return 'Needs review'
    case 'conflict': return 'Needs review'
    default: return 'Pending verification'
  }
}

/** Friendly file-type label from a Directus file's MIME `type`, never a raw MIME string. */
export function sourceFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'File'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet'
  if (mimeType.includes('word')) return 'Document'
  if (mimeType.startsWith('text/')) return 'Text'
  return 'File'
}

/**
 * PWS-03 — Media & Resources (product-media associations, `products_files`).
 * Display-only mapping for the existing, unchanged `FileRole` enum — never a
 * fabricated 12th value. A role only ever labels an association a human
 * already made in this module; it is never inferred from filename or folder.
 */
const FILE_ROLE_LABELS: Record<FileRole, string> = {
  hero: 'Hero image',
  overview: 'Overview',
  application: 'Application',
  detail: 'Detail',
  gallery: 'Gallery',
  video_poster: 'Video poster',
  brochure: 'Brochure',
  datasheet: 'Datasheet',
  drawing: 'Drawing',
  manual: 'Manual',
  certificate: 'Certificate',
}

export function fileRoleLabel(role: FileRole | null): string {
  if (!role) return 'Role not set'
  return FILE_ROLE_LABELS[role] ?? role
}

/**
 * Thumbnail through the same hardened `/api/admin/media/:id` proxy the legacy
 * per-product editor (`pages/admin/products/[id]/media.vue`) and the global
 * Media Library page already use — never a raw Directus asset URL.
 */
export function workspaceMediaThumbUrl(
  fileId: string | null,
  opts: { width: number, height: number } = { width: 240, height: 180 },
): string | null {
  return fileId ? `/api/admin/media/${fileId}?width=${opts.width}&height=${opts.height}&fit=cover` : null
}

/** Product media (image-like) vs. Documents & access — split by the file's real MIME type, never by role or filename guesswork. */
export function workspaceMediaIsImage(mimeType: string | null): boolean {
  return (mimeType ?? '').startsWith('image/')
}

/**
 * PWS-AI-01-FAST-01 — honest display name for an AI Source Intake file card.
 * Never falls back to any fragment of the Directus file UUID (stricter than
 * the Sources & evidence picker's fallback, per this task's own boundary).
 */
export function aiIntakeFileDisplayName(m: { filename_download?: string | null, caption_en?: string | null, alt_en?: string | null }): string {
  return m.filename_download || m.caption_en || m.alt_en || 'Untitled file'
}

/** Whether a product-media association is currently readable/available, in plain English — never a raw boolean. */
export function mediaReadableLabel(enabled: boolean): string {
  return enabled ? 'Enabled' : 'Disabled'
}
