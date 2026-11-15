<script setup lang="ts">
import type { AdminProduct, CategorySummary, ProductsSummary } from '~/types/product-cms'
import {
  adminAssetUrl,
  categoryContextRoute,
  pageRangeLabel,
  productDetailRoute,
  totalPageCount,
} from '~/utils/productCentre'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const categoryId = computed(() => String(route.params.id))

// ── Filter state (category scope always comes from the route param) ──────────
const activeStatus = ref<string>('')
const searchRaw = ref<string>('')
const search = ref<string>('')
const page = ref(1)
const pageSize = 20

const selectedProduct = ref<AdminProduct | null>(null)
const controlDrawerOpen = ref(false)
const showProductControl = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (val: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = val.trim() }, 300)
})

watch([activeStatus, search, categoryId], () => {
  page.value = 1
  selectedProduct.value = null
  showProductControl.value = false
})

const hasActiveFilters = computed(() => Boolean(activeStatus.value || search.value))

function clearFilters() {
  activeStatus.value = ''
  searchRaw.value = ''
  search.value = ''
  page.value = 1
}

// ── Data ─────────────────────────────────────────────────────────────────────
const [{ data: summaryData }, { data: categoriesData }, { data, pending, error, refresh }] = await Promise.all([
  useFetch<ProductsSummary>('/api/admin/products-summary'),
  useFetch<CategorySummary[]>('/api/admin/categories-summary'),
  useFetch<{ data: AdminProduct[], meta: { total_count: number, filter_count: number } }>(
    '/api/admin/products',
    {
      query: computed(() => ({
        category_id: categoryId.value,
        status: activeStatus.value || undefined,
        search: search.value || undefined,
        page: page.value,
        limit: pageSize,
      })),
    },
  ),
])

const summary = computed<ProductsSummary>(
  () => summaryData.value ?? { all: 0, draft: 0, review: 0, draft_review: 0, published: 0, archived: 0 },
)
const categories = computed<CategorySummary[]>(() => categoriesData.value ?? [])
const currentCategory = computed<CategorySummary | null>(
  () => categories.value.find((c: CategorySummary) => String(c.id) === categoryId.value) ?? null,
)

const products = computed(() => data.value?.data ?? [])
const totalCount = computed(() => data.value?.meta?.filter_count ?? 0)
const totalPages = computed(() => totalPageCount(totalCount.value, pageSize))
const rangeLabel = computed(() => pageRangeLabel(page.value, pageSize, totalCount.value))

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function selectProduct(p: AdminProduct) {
  const next = selectedProduct.value?.id === p.id ? null : p
  selectedProduct.value = next
  showProductControl.value = next !== null
  controlDrawerOpen.value = next !== null
}

function closeControl() {
  controlDrawerOpen.value = false
  showProductControl.value = false
  selectedProduct.value = null
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
          Category context — the same catalogue workspace scoped to one technical category.
        </p>
      </div>
    </div>

    <ProductCatalogueNav />

    <div class="pc-layout">
      <ProductCentreSidebar
        :summary="summary"
        :categories="categories"
        active-status=""
      />

      <div class="pc-main">
        <!-- Category tab strip -->
        <div class="cat-tabs-wrap">
          <nav class="cat-tabs" aria-label="Category navigation">
            <NuxtLink to="/admin/products/categories" class="cat-tab">All categories</NuxtLink>
            <NuxtLink
              v-for="cat in categories"
              :key="cat.id"
              :to="categoryContextRoute(cat.id)"
              class="cat-tab"
              :class="{ 'cat-tab--active': String(cat.id) === categoryId }"
            >
              {{ cat.name_en }}
              <span class="cat-tab-count">{{ cat.total }}</span>
            </NuxtLink>
          </nav>
        </div>

        <div class="pc-main-header">
          <div>
            <h2 class="pc-main-title">{{ currentCategory?.name_en ?? 'Category' }}</h2>
            <p class="pc-main-count">
              Product collection · {{ rangeLabel }}
            </p>
          </div>
          <button type="button" class="control-trigger" @click="controlDrawerOpen = true">
            Product control
          </button>
        </div>

        <div class="filter-bar">
          <input
            v-model="searchRaw"
            type="search"
            class="filter-input filter-search"
            :placeholder="`Search in ${currentCategory?.name_en ?? 'this category'}…`"
            aria-label="Search products in this category"
          >

          <select v-model="activeStatus" class="filter-input filter-select" aria-label="Filter by status">
            <option value="">Status: all</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="draft,review">Draft &amp; review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
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

          <div v-else-if="!currentCategory && !pending" class="empty-state">
            <p class="empty-note">Category not found.</p>
            <NuxtLink to="/admin/products/categories" class="empty-hint">Back to all categories</NuxtLink>
          </div>

          <div v-else-if="!pending && products.length === 0" class="empty-state">
            <p class="empty-note">No products in this category.</p>
            <p v-if="hasActiveFilters" class="empty-hint">Try clearing the status filter or the search term.</p>
          </div>

          <template v-else>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="th-thumb"><span class="sr-only">Thumbnail</span></th>
                    <th>Product name / model</th>
                    <th>Product code</th>
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
                    <td>
                      <span v-if="product.product_code" class="code-badge">{{ product.product_code }}</span>
                      <span v-else class="muted-text">—</span>
                    </td>
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
              <button type="button" class="btn btn-outline" :disabled="page <= 1" @click="page--">← Prev</button>
              <span class="page-info">Page {{ page }} / {{ Math.max(totalPages, 1) }}</span>
              <button type="button" class="btn btn-outline" :disabled="page >= totalPages" @click="page++">
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: category context by default, product context once a row is selected -->
      <ProductControlPanel
        v-if="showProductControl"
        :product="selectedProduct"
        :categories="categories"
        :drawer-open="controlDrawerOpen"
        @close="closeControl"
      />
      <CategoryContextPanel
        v-else
        :category="currentCategory"
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

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.5;
}

.pc-layout {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.pc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

/* ── Category tabs ── */
.cat-tabs-wrap {
  border-bottom: 1px solid var(--color-line);
  overflow-x: auto;
  scrollbar-width: none;
}

.cat-tabs-wrap::-webkit-scrollbar { display: none; }

.cat-tabs { display: flex; min-width: max-content; }

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.cat-tab:hover { color: var(--color-ink); }

.cat-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.cat-tab-count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 1px 7px;
}

.cat-tab--active .cat-tab-count { background: rgba(47, 107, 58, 0.16); color: var(--color-primary); }

.pc-main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) 0;
}

.pc-main-title { font-size: var(--text-lg); font-weight: 600; color: var(--color-ink); margin: 0; }
.pc-main-count { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-1) 0 0; }

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

.pc-content { flex: 1; border-top: 1px solid var(--color-line); display: flex; flex-direction: column; }

/* ── Table ── */
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

.product-name { max-width: 280px; }
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

.row-link { color: var(--color-primary); text-decoration: none; font-size: var(--text-xs); white-space: nowrap; }
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

@media (max-width: 1023px) {
  .pc-layout { flex-direction: column; }
  .control-trigger { display: inline-flex; }
}

@media (max-width: 767px) {
  .pc-main-header { padding: var(--space-3) var(--space-3) 0; }
  .cat-tab { min-height: 44px; padding: var(--space-2) var(--space-3); }

  .filter-bar { flex-direction: column; align-items: stretch; padding: var(--space-3); }
  .filter-search, .filter-select, .btn-clear { min-width: 0; width: 100%; }

  .pagination { flex-direction: column; align-items: stretch; gap: var(--space-2); }
  .page-controls { justify-content: space-between; }
}
</style>
