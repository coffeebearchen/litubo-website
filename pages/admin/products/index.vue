<script setup lang="ts">
import type { AdminProduct, ProductCategory, ProductStatus } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Review', value: 'review' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
] as const

const activeStatus = ref<string>('')
const activeCategoryId = ref<string>('')
const searchRaw = ref<string>('')
const search = ref<string>('')
const page = ref(1)
const selectedProduct = ref<AdminProduct | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (val: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search.value = val
    page.value = 1
  }, 300)
})

watch([activeStatus, activeCategoryId, search], () => { page.value = 1 })

const { data: categoriesData } = await useFetch<{ data: ProductCategory[] }>('/api/admin/categories')
const categories = computed<ProductCategory[]>(() => categoriesData.value?.data ?? [])

const { data, pending, error, refresh } = await useFetch<{
  data: AdminProduct[]
  meta: { total_count: number; filter_count: number }
}>('/api/admin/products', {
  query: computed(() => ({
    status: activeStatus.value || undefined,
    category_id: activeCategoryId.value || undefined,
    search: search.value || undefined,
    page: page.value,
    limit: 20,
  })),
})

const products = computed(() => data.value?.data ?? [])
const totalCount = computed(() => data.value?.meta?.filter_count ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / 20))

function getCategoryName(id: number | null): string {
  if (!id) return '—'
  return categories.value.find((c: ProductCategory) => c.id === id)?.name_en ?? `ID ${id}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function selectProduct(p: AdminProduct) {
  selectedProduct.value = selectedProduct.value?.id === p.id ? null : p
}

function onStatusTab(val: string) {
  activeStatus.value = val
  selectedProduct.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Product Center</h1>
      <NuxtLink to="/admin/products/new" class="btn btn-primary">+ Add Product</NuxtLink>
    </div>

    <AdminProductProductCatalogueNav />

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="status-tabs" role="tablist">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          role="tab"
          class="status-tab"
          :class="{ active: activeStatus === tab.value }"
          :aria-selected="activeStatus === tab.value"
          @click="onStatusTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-controls">
        <select
          v-model="activeCategoryId"
          class="filter-select"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
            {{ cat.name_en }}
          </option>
        </select>

        <input
          v-model="searchRaw"
          type="text"
          class="filter-search"
          placeholder="Search products…"
          aria-label="Search products"
        >
      </div>
    </div>

    <!-- Content: table + control panel -->
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
          <p v-if="activeStatus || activeCategoryId || search" class="empty-hint">
            Try clearing filters or search.
          </p>
        </div>

        <!-- Table -->
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
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
          {{ totalCount }} product{{ totalCount !== 1 ? 's' : '' }} total
        </div>
      </div>

      <!-- Product Control Panel -->
      <AdminProductProductControlPanel
        v-if="selectedProduct"
        :product="selectedProduct"
        :categories="categories"
        @close="selectedProduct = null"
      />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.status-tabs {
  display: flex;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.status-tab {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  border-right: 1px solid var(--color-line);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  min-height: 40px;
}
.status-tab:last-child { border-right: none; }
.status-tab:hover { background: var(--color-surface-alt); color: var(--color-ink); }
.status-tab.active {
  background: var(--color-primary);
  color: var(--color-white);
  font-weight: 600;
}

.filter-controls {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.filter-select,
.filter-search {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface);
  outline: none;
  font-family: inherit;
}
.filter-select:focus,
.filter-search:focus { border-color: var(--color-primary); }
.filter-search { min-width: 220px; }

.content-layout {
  display: flex;
  align-items: flex-start;
  gap: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-section {
  flex: 1;
  min-width: 0;
}

.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
}
thead { background: var(--color-surface-alt); }
th {
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--color-line);
}
td { border-bottom: 1px solid var(--color-line); }
tbody tr:last-child td { border-bottom: none; }

.product-row {
  cursor: pointer;
  transition: background 0.12s;
}
.product-row:hover { background: var(--color-surface-alt); }
.product-row.selected { background: #eaf2ef; }

.product-name { font-weight: 500; color: var(--color-ink); max-width: 260px; }
.code-badge {
  font-family: monospace;
  font-size: 0.85em;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
}
.muted-text { color: var(--color-ink-muted); }
.date-cell { white-space: nowrap; }
.action-cell { width: 48px; text-align: center; }
.edit-btn {
  color: var(--color-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

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
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  text-align: right;
  border-top: 1px solid var(--color-line);
}

.empty-state {
  padding: var(--space-12) var(--space-6);
  text-align: center;
}
.empty-note {
  font-size: var(--text-base);
  color: var(--color-ink);
  margin: 0 0 var(--space-2);
}
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

@media (max-width: 767px) {
  .filter-bar { flex-direction: column; align-items: stretch; }
  .status-tabs { flex-wrap: wrap; }
  .filter-controls { flex-direction: column; }
  .filter-search { min-width: 0; }
  .content-layout { flex-direction: column; }
  .panel-open .table-section { display: none; }
}
</style>
