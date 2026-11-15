<script setup lang="ts">
import type { AdminProduct, CategorySummary, ProductsSummary } from '~/types/product-cms'
import type { ProductFilterState } from '~/utils/productCentre'
import {
  buildProductFilterQuery,
  categoryNameFor,
  hasActiveProductFilters,
  pageRangeLabel,
  parseProductFilterQuery,
  productDetailRoute,
  totalPageCount,
  adminAssetUrl,
} from '~/utils/productCentre'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

// ── Filter state (initialised from the URL so a refresh or an inbound link keeps scope) ──
const initial = parseProductFilterQuery(route.query as Record<string, unknown>)

const activeStatus = ref<string>(initial.status)
const activeCategoryId = ref<string>(initial.categoryId)
const searchRaw = ref<string>(initial.search)
const search = ref<string>(initial.search)
const page = ref<number>(initial.page)
const pageSize = ref<number>(20)

const selectedProduct = ref<AdminProduct | null>(null)
const controlDrawerOpen = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (val: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = val.trim() }, 300)
})

watch([activeStatus, activeCategoryId, search, pageSize], () => {
  page.value = 1
  selectedProduct.value = null
})

const filterState = computed<ProductFilterState>(() => ({
  status: activeStatus.value,
  categoryId: activeCategoryId.value,
  search: search.value,
  page: page.value,
}))

// State → URL. Compared before writing so the two watchers converge instead of looping.
watch(filterState, (state: ProductFilterState) => {
  const next = buildProductFilterQuery(state)
  const current = buildProductFilterQuery(parseProductFilterQuery(route.query as Record<string, unknown>))
  if (JSON.stringify(next) !== JSON.stringify(current)) router.replace({ query: next })
})

// URL → state, for inbound links and history navigation.
watch(() => route.query, (query: Record<string, unknown>) => {
  if (route.path !== '/admin/products') return
  const next = parseProductFilterQuery(query)
  if (next.status !== activeStatus.value) activeStatus.value = next.status
  if (next.categoryId !== activeCategoryId.value) activeCategoryId.value = next.categoryId
  if (next.search !== search.value) {
    search.value = next.search
    searchRaw.value = next.search
  }
  if (next.page !== page.value) page.value = next.page
})

const hasActiveFilters = computed(() => hasActiveProductFilters(filterState.value))

function clearFilters() {
  activeStatus.value = ''
  activeCategoryId.value = ''
  searchRaw.value = ''
  search.value = ''
  page.value = 1
  selectedProduct.value = null
}

function applyStatus(value: string) {
  activeStatus.value = value
}

// ── Data ─────────────────────────────────────────────────────────────────────
const [{ data: summaryData }, { data: categoriesData }, { data, pending, error, refresh }] = await Promise.all([
  useFetch<ProductsSummary>('/api/admin/products-summary'),
  useFetch<CategorySummary[]>('/api/admin/categories-summary'),
  useFetch<{ data: AdminProduct[], meta: { total_count: number, filter_count: number } }>(
    '/api/admin/products',
    {
      query: computed(() => ({
        status: activeStatus.value || undefined,
        category_id: activeCategoryId.value || undefined,
        search: search.value || undefined,
        page: page.value,
        limit: pageSize.value,
      })),
    },
  ),
])

const summary = computed<ProductsSummary>(
  () => summaryData.value ?? { all: 0, draft: 0, review: 0, draft_review: 0, published: 0, archived: 0 },
)
const categories = computed<CategorySummary[]>(() => categoriesData.value ?? [])
const products = computed(() => data.value?.data ?? [])
const totalCount = computed(() => data.value?.meta?.filter_count ?? 0)
const totalPages = computed(() => totalPageCount(totalCount.value, pageSize.value))
const rangeLabel = computed(() => pageRangeLabel(page.value, pageSize.value, totalCount.value))

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function selectProduct(p: AdminProduct) {
  selectedProduct.value = selectedProduct.value?.id === p.id ? null : p
  controlDrawerOpen.value = selectedProduct.value !== null
}

function thumbUrl(fileId: string) {
  return adminAssetUrl(fileId, { width: 80, height: 80 })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="page-heading-block">
        <h1 class="page-title">Product Center</h1>
        <p class="page-subtitle">
          Manage product records, track lifecycle status and keep catalogue data complete.
        </p>
      </div>
      <NuxtLink to="/admin/products/new" class="btn btn-primary">+ New Product</NuxtLink>
    </div>

    <ProductCatalogueNav />

    <div class="pc-layout">
      <ProductCentreSidebar
        :summary="summary"
        :categories="categories"
        :active-status="activeStatus"
        @update:active-status="applyStatus"
      />

      <div class="pc-main">
        <div class="pc-main-header">
          <div>
            <h2 class="pc-main-title">All Products</h2>
            <p class="pc-main-count">{{ rangeLabel }}</p>
          </div>
          <button
            type="button"
            class="control-trigger"
            @click="controlDrawerOpen = true"
          >
            Product control
          </button>
        </div>

        <ProductStatusTiles
          :summary="summary"
          :active-status="activeStatus"
          @select="applyStatus"
        />

        <div class="filter-bar">
          <input
            v-model="searchRaw"
            type="search"
            class="filter-input filter-search"
            placeholder="Search products…"
            aria-label="Search products"
          >

          <select v-model="activeStatus" class="filter-input filter-select" aria-label="Filter by status">
            <option value="">Status: all</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="draft,review">Draft &amp; review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          <select
            v-model="activeCategoryId"
            class="filter-input filter-select"
            aria-label="Filter by technical category"
          >
            <option value="">Technical category: all</option>
            <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
              {{ cat.name_en }}
            </option>
          </select>

          <button v-if="hasActiveFilters" type="button" class="btn-clear" @click="clearFilters">
            Clear filters
          </button>
        </div>

        <div class="pc-content">
          <div v-if="pending && !data" class="empty-state">
            <span class="empty-hint">Loading products…</span>
          </div>

          <div v-else-if="error" class="error-banner" role="alert">
            Failed to load products.
            <button type="button" class="link-btn" @click="refresh()">Retry</button>
          </div>

          <div v-else-if="!pending && products.length === 0" class="empty-state">
            <p class="empty-note">No products found.</p>
            <p v-if="hasActiveFilters" class="empty-hint">Try clearing the filters or the search term.</p>
          </div>

          <template v-else>
            <!-- Desktop / tablet: data table -->
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="th-thumb"><span class="sr-only">Thumbnail</span></th>
                    <th>Product name / model</th>
                    <th>Product code</th>
                    <th>Technical category</th>
                    <th>Status</th>
                    <th>Last updated</th>
                    <th><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="product in products"
                    :key="product.id"
                    class="product-row"
                    :class="{ selected: selectedProduct?.id === product.id }"
                    tabindex="0"
                    :aria-selected="selectedProduct?.id === product.id"
                    @click="selectProduct(product)"
                    @keydown.enter="selectProduct(product)"
                    @keydown.space.prevent="selectProduct(product)"
                  >
                    <td class="td-thumb">
                      <img
                        v-if="product.hero_image"
                        :src="thumbUrl(product.hero_image)"
                        :alt="product.name_en"
                        class="product-thumb"
                        loading="lazy"
                      >
                      <span v-else class="thumb-placeholder" aria-hidden="true" />
                    </td>
                    <td class="product-name">
                      <span class="product-name-main">{{ product.name_en }}</span>
                      <span v-if="product.model_or_series" class="product-name-sub">
                        {{ product.model_or_series }}
                      </span>
                    </td>
                    <td class="code-cell">
                      <span v-if="product.product_code" class="code-badge">{{ product.product_code }}</span>
                      <span v-else class="muted-text">—</span>
                    </td>
                    <td>{{ categoryNameFor(categories, product.category_id) }}</td>
                    <td><StatusBadge :status="product.status" /></td>
                    <td class="date-cell">{{ formatDate(product.date_updated) }}</td>
                    <td class="action-cell">
                      <NuxtLink
                        :to="productDetailRoute(product.id)"
                        class="row-link"
                        :aria-label="`Open record for ${product.name_en}`"
                        @click.stop
                      >Open</NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 375px: stacked card list per VM1-ADM02-M375 -->
            <ProductCardList
              class="card-list"
              :products="products"
              :categories="categories"
              :selected-id="selectedProduct?.id ?? null"
              @select="selectProduct"
            />
          </template>

          <div v-if="data && totalCount > 0" class="pagination">
            <span class="page-info">{{ rangeLabel }}</span>
            <div class="page-controls">
              <button
                type="button"
                class="btn btn-outline"
                :disabled="page <= 1"
                @click="page--"
              >← Prev</button>
              <span class="page-info">Page {{ page }} / {{ Math.max(totalPages, 1) }}</span>
              <button
                type="button"
                class="btn btn-outline"
                :disabled="page >= totalPages"
                @click="page++"
              >Next →</button>
            </div>
            <label class="page-size">
              <span class="page-size-label">Show</span>
              <select v-model.number="pageSize" class="filter-input page-size-select" aria-label="Products per page">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <ProductControlPanel
        :product="selectedProduct"
        :categories="categories"
        :drawer-open="controlDrawerOpen"
        @close="controlDrawerOpen = false"
      />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.page-heading-block { min-width: 0; }

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.5;
}

/* ── Product Centre four-part layout: global nav · rail · workspace · control ── */
.pc-layout {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.pc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pc-main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) 0;
}

.pc-main-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.pc-main-count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
}

/* Drawer trigger — the control column is persistent from 1024px up. */
.control-trigger {
  display: none;
  align-items: center;
  min-height: 40px;
  padding: var(--space-1) var(--space-3) !important;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--text-xs) !important;
  color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

/* ── Filters ── */
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.filter-input {
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface);
  font-family: inherit;
  outline: none;
}

.filter-input:focus { border-color: var(--color-primary); }
.filter-search { flex: 1; min-width: 180px; }
.filter-select { min-width: 170px; }

.btn-clear {
  min-height: 40px;
  padding: 0 var(--space-3) !important;
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm) !important;
  color: var(--color-ink-muted);
  cursor: pointer;
  white-space: nowrap;
}

.btn-clear:hover { border-color: var(--color-ink); color: var(--color-ink); }

.pc-content {
  flex: 1;
  border-top: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
}

/* ── Table (desktop / tablet) ── */
.table-wrap { width: 100%; }
.card-list { display: none; }

table { width: 100%; border-collapse: collapse; }
thead { background: var(--color-surface-alt); }

th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--color-line);
  padding: var(--space-2) var(--space-3);
}

td {
  border-bottom: 1px solid var(--color-line);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  vertical-align: middle;
}

tbody tr:last-child td { border-bottom: none; }

.product-row { cursor: pointer; transition: background var(--transition-fast); }
.product-row:hover { background: var(--color-surface-alt); }

.product-row.selected {
  background: rgba(47, 107, 58, 0.08);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.th-thumb, .td-thumb { width: 60px; }

.product-thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-line);
  display: block;
}

.thumb-placeholder {
  display: block;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  border: 1px dashed var(--color-line);
}

.product-name { max-width: 260px; }
.product-name-main { display: block; font-weight: 600; color: var(--color-ink); }
.product-name-sub { display: block; font-size: var(--text-xs); color: var(--color-ink-muted); }

.code-badge {
  font-family: monospace;
  font-size: 0.85em;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
}

.muted-text { color: var(--color-ink-muted); }
.date-cell { white-space: nowrap; color: var(--color-ink-muted); }
.action-cell { width: 80px; text-align: right; }

.row-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--text-xs);
  white-space: nowrap;
}

.row-link:hover { text-decoration: underline; }

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  margin-top: auto;
}

.page-controls { display: flex; align-items: center; gap: var(--space-3); }
.page-info { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; }

.page-size { display: flex; align-items: center; gap: var(--space-2); }
.page-size-label { font-size: var(--text-xs); color: var(--color-ink-muted); }
.page-size-select { min-height: 36px; min-width: 72px; }

/* ── States ── */
.empty-state { padding: var(--space-12) var(--space-6); text-align: center; }
.empty-note { font-size: var(--text-base); color: var(--color-ink); margin: 0 0 var(--space-2); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); }

.error-banner {
  background: #fff0f0;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  color: #991b1b;
  margin: var(--space-4);
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
  padding: 0 !important;
  min-height: 0 !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── <1280px: the workspace keeps all four parts, so the list becomes cards ── */
@media (max-width: 1279px) {
  .table-wrap { display: none; }
  .card-list { display: block; }
}

/* ── ≤1023px: rail becomes a full-width band, control becomes a drawer ── */
@media (max-width: 1023px) {
  .pc-layout { flex-direction: column; }
  .control-trigger { display: inline-flex; }
}

/* ── ≤767px: single column, no horizontal page overflow ── */
@media (max-width: 767px) {
  .page-header { flex-direction: column; align-items: stretch; }
  .page-header .btn { width: 100%; text-align: center; }

  .pc-main-header { padding: var(--space-3) var(--space-3) 0; }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-3);
  }

  .filter-search, .filter-select, .btn-clear { min-width: 0; width: 100%; }

  .pagination {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .page-controls { justify-content: space-between; }
  .page-size { justify-content: space-between; }
}
</style>
