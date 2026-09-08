/**
 * Pure presentation helpers shared by the Product Centre routes (PC-01 / PC-02).
 *
 * No Nuxt auto-imports and no runtime dependencies: the Vue components and the
 * Vitest suite import the SAME module, so the tests exercise production code
 * rather than a copy of it.
 *
 * Gate discipline enforced here (never render a number without a confirmed rule):
 *   CH-DG-10 / BP-DG-01 — Category Health
 *   CH-DG-11 / BP-DG-02 — Readiness / completeness
 *   CH-DG-12 / BP-DG-05 — product media roles and counts
 *   BP-DG-06            — source evidence review
 */

import type { AdminProduct, CategorySummary, ProductStatus, ProductsSummary } from '~/types/product-cms'

// ── Lifecycle status filters ─────────────────────────────────────────────────

/** Lifecycle values accepted by the products BFF `status` parameter. */
export const PRODUCT_STATUS_VALUES: ProductStatus[] = ['draft', 'review', 'published', 'archived']

const KNOWN_STATUS_SET = new Set<string>(PRODUCT_STATUS_VALUES)

export interface StatusTile {
  key: string
  label: string
  /** Value sent as the `status` filter; '' means "no status filter". */
  value: string
  count: number
}

/**
 * Status tile strip required by VM1-ADM02-D1440 / VM1-ADM02-M375.
 * Every count comes from the real products-summary aggregate — the master's
 * "blocked" tile has no confirmed rule and is therefore not reproduced.
 */
export function buildStatusTiles(summary: ProductsSummary): StatusTile[] {
  return [
    { key: 'all', label: 'All products', value: '', count: summary.all },
    { key: 'draft', label: 'Draft', value: 'draft', count: summary.draft },
    { key: 'review', label: 'In review', value: 'review', count: summary.review },
    { key: 'published', label: 'Published', value: 'published', count: summary.published },
    { key: 'archived', label: 'Archived', value: 'archived', count: summary.archived },
  ]
}

// ── Routes and asset URLs ────────────────────────────────────────────────────

/**
 * Product images are only ever addressed through the hardened admin proxy.
 * A Directus origin, token or raw file path must never reach the browser.
 */
export function adminAssetUrl(
  fileId: string,
  opts: { width: number; height: number; quality?: number },
): string {
  const quality = opts.quality ?? 70
  return `/api/admin/asset/${encodeURIComponent(fileId)}`
    + `?width=${opts.width}&height=${opts.height}&fit=cover&quality=${quality}`
}

/** Existing product record route. The Workspace shell (PW-00) does not exist yet. */
export function productDetailRoute(id: number | string): string {
  return `/admin/products/${id}`
}

/**
 * PWS-00 read-only Workspace entry point (PWS-DOR-02 / PWS-00A). Added in
 * parallel to productDetailRoute() above, which is unchanged and remains the
 * sole writable surface for a product during the pilot (child blueprint §18.3).
 */
export function workspaceOverviewRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/overview`
}

/** PWS-07 read-only Sources & Evidence route (PWS-07-FAST-01R). Same shell, second enabled tab. */
export function workspaceSourcesEvidenceRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/sources-evidence`
}

/** PWS-01 Page Content route (PWS-01-FAST-01). Third enabled tab, editable in the same shell. */
export function workspacePageContentRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/page-content`
}

/** PWS-02 Specifications route (PWS-02-FAST-01). Fourth enabled tab, editable in the same shell. */
export function workspaceSpecificationsRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/specifications`
}

/** PWS-03 Media & Resources route (PWS-03 FAST-01). Fifth enabled tab, editable in the same shell. */
export function workspaceMediaResourcesRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/media-resources`
}

/**
 * PWS-AI-01-FAST-01 AI Source Intake route — explicitly authorized, narrowed
 * first step of `AI-01` (source *selection* only; no analysis, no proposal
 * generation, no PWS-AI-02). Same shell, sixth enabled tab.
 */
export function workspaceAiSourceIntakeRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/ai-source-intake`
}

/**
 * PWS-AI-ENGINE-01 AI Proposal Review route — reached only by completing
 * AI Source Intake's Analyze step (its state is in-memory only, via
 * `useAiProposalSession()`). Deliberately not listed in `WORKSPACE_MODULE_NAV`:
 * opening this URL directly is a valid, well-defined state (an honest empty
 * state), not a persistent browsable section.
 */
export function workspaceAiProposalReviewRoute(id: number | string): string {
  return `/admin/product-workspace/${id}/ai-proposal-review`
}

export function categoryContextRoute(id: number | string): string {
  return `/admin/products/categories/${id}`
}

// ── Product card model (375px card list) ─────────────────────────────────────

export interface ProductCardModel {
  id: number
  name: string
  code: string | null
  model: string | null
  categoryName: string
  status: ProductStatus
  thumbUrl: string | null
  detailRoute: string
}

export function categoryNameFor(categories: CategorySummary[], id: number | null): string {
  if (!id) return 'Uncategorised'
  return categories.find(c => c.id === id)?.name_en ?? `ID ${id}`
}

/**
 * Fields shown on a 375px product card. Only values the products BFF actually
 * returns are included — no readiness, media count or source status.
 */
export function buildProductCardModel(product: AdminProduct, categoryName: string): ProductCardModel {
  return {
    id: product.id,
    name: product.name_en,
    code: product.product_code ?? null,
    model: product.model_or_series ?? null,
    categoryName,
    status: product.status,
    thumbUrl: product.hero_image ? adminAssetUrl(product.hero_image, { width: 96, height: 96 }) : null,
    detailRoute: productDetailRoute(product.id),
  }
}

// ── Gated indicators — never render a fabricated value ───────────────────────

/**
 * CH-DG-10 / BP-DG-01: Category Health has no confirmed rule, so the category
 * routes render exactly this string — never a score, percentage or colour result.
 * Readiness, media counts and source review (CH-DG-11 / CH-DG-12 / BP-DG-02 /
 * BP-DG-05 / BP-DG-06) have no approved contract either and are therefore not
 * rendered at all: Product Control shows only fields the products BFF returns.
 */
export const CATEGORY_HEALTH_UNAVAILABLE = 'Not assessed — rule not configured'

// ── Filter state ↔ URL query ─────────────────────────────────────────────────

export interface ProductFilterState {
  status: string
  categoryId: string
  search: string
  page: number
}

export const DEFAULT_PRODUCT_FILTERS: ProductFilterState = {
  status: '',
  categoryId: '',
  search: '',
  page: 1,
}

const CATEGORY_ID_RE = /^\d{1,10}$/
const MAX_SEARCH_LEN = 200

/** Keeps only known lifecycle values; unknown input collapses to no filter. */
export function normaliseStatusFilter(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  const known = String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(s => KNOWN_STATUS_SET.has(s))
  return Array.from(new Set(known)).join(',')
}

export function normaliseCategoryFilter(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  const s = String(raw).trim()
  return CATEGORY_ID_RE.test(s) ? s : ''
}

export function normaliseSearchFilter(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  return String(raw).slice(0, MAX_SEARCH_LEN).trim()
}

export function normalisePageNumber(raw: unknown): number {
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Reads a Vue Router query object into validated filter state. */
export function parseProductFilterQuery(query: Record<string, unknown>): ProductFilterState {
  return {
    status: normaliseStatusFilter(query.status),
    categoryId: normaliseCategoryFilter(query.category_id),
    search: normaliseSearchFilter(query.search),
    page: normalisePageNumber(query.page),
  }
}

/** Serialises filter state back to a query object; default values are omitted. */
export function buildProductFilterQuery(state: ProductFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.status) query.status = state.status
  if (state.categoryId) query.category_id = state.categoryId
  if (state.search) query.search = state.search
  if (state.page > 1) query.page = String(state.page)
  return query
}

export function hasActiveProductFilters(state: ProductFilterState): boolean {
  return Boolean(state.status || state.categoryId || state.search)
}

/** Inclusive 1-based range shown next to the pagination control. */
export function pageRangeLabel(page: number, limit: number, total: number): string {
  if (total === 0) return '0 products'
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)
  return `${first}–${last} of ${total} products`
}

export function totalPageCount(total: number, limit: number): number {
  if (total <= 0 || limit <= 0) return 0
  return Math.ceil(total / limit)
}
