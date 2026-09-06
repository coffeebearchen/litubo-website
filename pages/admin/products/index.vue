<script setup lang="ts">
import type { AdminProduct, CategorySummary, ProductsSummary, ProductStatus } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

// ── Filter state ─────────────────────────────────────────────────────────────
const activeStatus = ref<string>('')
const activeCategoryId = ref<string>('')
const searchRaw = ref<string>('')
const search = ref<string>('')
const page = ref(1)
const selectedProduct = ref<AdminProduct | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (val: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = val; page.value = 1 }, 300)
})

watch([activeStatus, activeCategoryId, search], () => { page.value = 1; selectedProduct.value = null })

const hasActiveFilters = computed(() =>
  activeStatus.value !== '' || activeCategoryId.value !== '' || searchRaw.value !== '',
)

function clearFilters() {
  activeStatus.value = ''
  activeCategoryId.value = ''
  searchRaw.value = ''
  search.value = ''
  page.value = 1
  selectedProduct.value = null
}

function onSidebarStatus(val: string) {
  activeStatus.value = val
  activeCategoryId.value = ''
  searchRaw.value = ''
  search.value = ''
}

// ── Data ─────────────────────────────────────────────────────────────────────
const [{ data: summaryData }, { data: categoriesData }, { data, pending, error, refresh }] = await Promise.all([
  useFetch<ProductsSummary>('/api/admin/products-summary'),
  useFetch<CategorySummary[]>('/api/admin/categories-summary'),
  useFetch<{ data: AdminProduct[]; meta: { total_count: number; filter_count: number } }>(
    '/api/admin/products',
    {
      query: computed(() => ({
        status: activeStatus.value || undefined,
        category_id: activeCategoryId.value || undefined,
        search: search.value || undefined,
        page: page.value,
        limit: 20,
      })),
    },
  ),
])

const summary = computed<ProductsSummary>(() => summaryData.value ?? { all: 0, draft: 0, review: 0, draft_review: 0, published: 0, archived: 0 })
const categories = computed<CategorySummary[]>(() => categoriesData.value ?? [])
const products = computed(() => data.value?.data ?? [])
const totalCount = computed(() => data.value?.meta?.filter_count ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / 20))

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryName(id: number | null): string {
  if (!id) return '—'
  return categories.value.find((c: CategorySummary) => c.id === id)?.name_en ?? `ID ${id}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function selectProduct(p: AdminProduct) {
  selectedProduct.value = selectedProduct.value?.id === p.id ? null : p
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Product Center</h1>
      <NuxtLink to="/admin/products/new" class="btn btn-primary">+ New Product</NuxtLink>
    </div>

    <AdminProductProductCatalogueNav />

    <div class="pc-layout">
      <!-- Left: Product Catalogue sidebar -->
      <AdminProductProductCentreSidebar
        :summary="summary"
        :categories="categories"
        :active-status="activeStatus"
        @update:active-status="onSidebarStatus"
      />

      <!-- Right: Main content -->
      <div class="pc-main">
        <!-- Filter bar -->
        <div class="filter-bar">
          <input
            v-model="searchRaw"
            type="text"
            class="filter-input filter-search"
            placeholder="Search products…"
            aria-label="Search products"
          >

          <select
            v-model="activeStatus"
            class="filter-input filter-select"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="draft,review">Draft &amp; Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          <select
            v-model="activeCategoryId"
            class="filter-input filter-select"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
              {{ cat.name_en }}
            </option>
          </select>

          <button
            v-if="hasActiveFilters"
            class="btn-clear"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>

        <!-- Product table + Control Panel -->
        <div class="content-layout" :class="{ 'panel-open': selectedProduct }">
          <div class="table-section">
            <!-- Loading -->
            <div v-if="pending && !data" class="empty-state">
              <span class="empty-hint">Loading products…</span>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="error-banner" role="alert">
              Failed to load products.
              <button class="link-btn" @click="refresh()">Retry</button>
            </div>

            <!-- Empty -->
            <div v-else-if="!pending && products.length === 0" class="empty-state">
              <p class="empty-note">No products found.</p>
              <p v-if="hasActiveFilters" class="empty-hint">
                Try clearing filters or search.
              </p>
            </div>

            <!-- Table -->
            <div v-else class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="th-thumb" aria-label="Thumbnail" />
                    <th>Product Name</th>
                    <th>Product Code</th>
                    <th>Model / Series</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Updated</th>
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
                        :src="`/api/admin/asset/${product.hero_image}?width=40&height=40&fit=cover&quality=70`"
                        :alt="product.name_en"
                        class="product-thumb"
                        loading="lazy"
                      >
                      <span v-else class="thumb-placeholder" aria-hidden="true" />
                    </td>
                    <td class="product-name">{{ product.name_en }}</td>
                    <td class="code-cell">
                      <span v-if="product.product_code" class="code-badge">{{ product.product_code }}</span>
                      <span v-else class="muted-text">—</span>
                    </td>
                    <td>{{ product.model_or_series ?? '—' }}</td>
                    <td>{{ getCategoryName(product.category_id) }}</td>
                    <td>
                      <AdminStatusBadge :status="(product.status as ProductStatus)" />
                    </td>
                    <td class="date-cell">{{ formatDate(product.date_updated) }}</td>
                    <td class="action-cell">
                      <NuxtLink
                        :to="`/admin/products/${product.id}/edit`"
                        class="edit-btn btn-icon"
                        :aria-label="`Edit ${product.name_en}`"
                        @click.stop
                      >✎</NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination">
              <button :disabled="page <= 1" class="btn btn-outline" @click="page--">← Prev</button>
              <span class="page-info">Page {{ page }} / {{ totalPages }}</span>
              <button :disabled="page >= totalPages" class="btn btn-outline" @click="page++">Next →</button>
            </div>

            <div v-if="data && totalCount > 0" class="total-count">
              {{ totalCount }} product{{ totalCount !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- Product Control Panel -->
          <AdminProductProductControlPanel
            v-if="selectedProduct"
            :product="selectedProduct"
            :categories="[]"
            @close="selectedProduct = null"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* ── Product Centre layout ── */
.pc-layout {
  display: flex;
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

/* ── Filter bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.filter-input {
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface);
  outline: none;
  font-family: inherit;
}

.filter-input:focus { border-color: var(--color-primary); }
.filter-search { min-width: 200px; flex: 1; }
.filter-select { min-width: 140px; }

.btn-clear {
  height: 36px;
  padding: 0 var(--space-3);
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.1s, color 0.1s;
}

.btn-clear:hover { border-color: var(--color-ink); color: var(--color-ink); }

/* ── Content: table + panel ── */
.content-layout {
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.table-section { flex: 1; min-width: 0; }

.table-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

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

.product-row { cursor: pointer; transition: background 0.1s; }
.product-row:hover { background: var(--color-surface-alt); }
.product-row.selected { background: #eaf2ef; }

/* Thumbnail */
.th-thumb { width: 52px; padding: var(--space-2) var(--space-3); }
.td-thumb { width: 52px; padding: var(--space-2) var(--space-2); }

.product-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  display: block;
  border: 1px solid var(--color-line);
}

.thumb-placeholder {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  border: 1px dashed var(--color-line);
}

.product-name {
  font-weight: 500;
  color: var(--color-ink);
  max-width: 220px;
}

.code-badge {
  font-family: monospace;
  font-size: 0.8em;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 1px 5px;
}

.muted-text { color: var(--color-ink-muted); }
.date-cell { white-space: nowrap; color: var(--color-ink-muted); }
.action-cell { width: 44px; text-align: center; }

.edit-btn {
  color: var(--color-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  justify-content: center;
  border-top: 1px solid var(--color-line);
}

.page-info { font-size: var(--text-sm); color: var(--color-ink-muted); }

.total-count {
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  text-align: right;
  border-top: 1px solid var(--color-line);
}

/* States */
.empty-state {
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

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
  padding: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Mobile */
@media (max-width: 767px) {
  .pc-layout { flex-direction: column; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-search { min-width: 0; }
  .filter-select { min-width: 0; }
  .content-layout { flex-direction: column; }
  .panel-open .table-section { display: none; }
}
</style>
