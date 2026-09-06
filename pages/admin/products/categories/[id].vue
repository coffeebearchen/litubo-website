<script setup lang="ts">
import type { AdminProduct, CategorySummary, ProductStatus } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const categoryId = computed(() => String(route.params.id))

// ── Filter state ─────────────────────────────────────────────────────────────
const activeStatus = ref<string>('')
const searchRaw = ref<string>('')
const search = ref<string>('')
const page = ref(1)
const selectedProduct = ref<AdminProduct | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (val: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = val; page.value = 1 }, 300)
})
watch([activeStatus, search], () => { page.value = 1; selectedProduct.value = null })

// ── Data ─────────────────────────────────────────────────────────────────────
const { data: categoriesData } = await useFetch<CategorySummary[]>('/api/admin/categories-summary')
const categories = computed<CategorySummary[]>(() => categoriesData.value ?? [])
const currentCategory = computed<CategorySummary | undefined>(
  () => categories.value.find((c: CategorySummary) => String(c.id) === categoryId.value),
)

const { data, pending, error, refresh } = await useFetch<{
  data: AdminProduct[]
  meta: { total_count: number; filter_count: number }
}>(
  '/api/admin/products',
  {
    query: computed(() => ({
      category_id: categoryId.value,
      status: activeStatus.value || undefined,
      search: search.value || undefined,
      page: page.value,
      limit: 20,
    })),
  },
)

const products = computed(() => data.value?.data ?? [])
const totalCount = computed(() => data.value?.meta?.filter_count ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / 20))

// ── Helpers ──────────────────────────────────────────────────────────────────
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
    </div>

    <AdminProductProductCatalogueNav />

    <!-- Category context nav tabs -->
    <div class="cat-tabs-wrap">
      <nav class="cat-tabs" aria-label="Category navigation">
        <NuxtLink
          to="/admin/products/categories"
          class="cat-tab"
          :class="{ 'cat-tab--overview': true }"
        >
          All Categories
        </NuxtLink>
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="`/admin/products/categories/${cat.id}`"
          class="cat-tab"
          :class="{ 'cat-tab--active': String(cat.id) === categoryId }"
        >
          {{ cat.name_en }}
          <span class="cat-tab-count">{{ cat.total }}</span>
        </NuxtLink>
      </nav>
    </div>

    <!-- 2-column layout: product list + category panel -->
    <div class="cat-layout">
      <!-- Left: product list -->
      <div class="cat-main">
        <!-- Filter bar -->
        <div class="filter-bar">
          <input
            v-model="searchRaw"
            type="text"
            class="filter-input filter-search"
            :placeholder="`Search in ${currentCategory?.name_en ?? 'category'}…`"
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
        </div>

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
          <p class="empty-note">No products in this category.</p>
          <p v-if="activeStatus || searchRaw" class="empty-hint">
            Try clearing status filter or search.
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
                <td>
                  <span v-if="product.product_code" class="code-badge">{{ product.product_code }}</span>
                  <span v-else class="muted-text">—</span>
                </td>
                <td>
                  <AdminStatusBadge :status="(product.status as ProductStatus)" />
                </td>
                <td class="date-cell">{{ formatDate(product.date_updated) }}</td>
                <td class="action-cell">
                  <NuxtLink
                    :to="`/admin/products/${product.id}/edit`"
                    class="edit-btn"
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

      <!-- Right: Category context panel -->
      <aside class="cat-panel" aria-label="Category information">
        <template v-if="currentCategory">
          <div class="cat-panel-header">
            <h2 class="cat-panel-name">{{ currentCategory.name_en }}</h2>
            <NuxtLink to="/admin/products/categories" class="cat-panel-back">← All categories</NuxtLink>
          </div>

          <div class="cat-panel-section">
            <p class="cat-panel-label">Product counts</p>
            <ul class="count-list">
              <li class="count-row">
                <span class="count-key">Total</span>
                <span class="count-val">{{ currentCategory.total }}</span>
              </li>
              <li class="count-row">
                <span class="count-key">Draft</span>
                <span class="count-val">{{ currentCategory.by_status.draft }}</span>
              </li>
              <li class="count-row">
                <span class="count-key">In Review</span>
                <span class="count-val">{{ currentCategory.by_status.review }}</span>
              </li>
              <li class="count-row">
                <span class="count-key count-key--pub">Published</span>
                <span class="count-val count-val--pub">{{ currentCategory.by_status.published }}</span>
              </li>
              <li class="count-row">
                <span class="count-key">Archived</span>
                <span class="count-val">{{ currentCategory.by_status.archived }}</span>
              </li>
            </ul>
          </div>

          <div class="cat-panel-divider" />

          <div class="cat-panel-section">
            <p class="cat-panel-label">Category Health</p>
            <p class="health-na">Not assessed</p>
            <p class="health-note">Scoring rule not confirmed (DG-10)</p>
          </div>

          <div class="cat-panel-divider" />

          <div class="cat-panel-section">
            <NuxtLink
              :to="`/admin/products?category_id=${currentCategory.id}`"
              class="cat-panel-link"
            >
              View in All Products →
            </NuxtLink>
          </div>
        </template>

        <div v-else class="cat-panel-empty">
          <p class="muted-text">Category not found.</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: var(--space-4); }

/* Category tabs */
.cat-tabs-wrap {
  overflow-x: auto;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.cat-tabs {
  display: flex;
  gap: 0;
  min-width: max-content;
}

.cat-tab {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
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
  margin-left: var(--space-1);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 1px 6px;
}

/* 2-column layout */
.cat-layout {
  display: flex;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  align-items: flex-start;
}

.cat-main { flex: 1; min-width: 0; }

/* Filter bar */
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

/* Table */
.table-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
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

.th-thumb { width: 52px; }
.td-thumb { width: 52px; padding: var(--space-2) var(--space-2); }

.product-thumb {
  width: 40px; height: 40px; object-fit: cover;
  border-radius: var(--radius-sm); display: block;
  border: 1px solid var(--color-line);
}

.thumb-placeholder {
  display: block; width: 40px; height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  border: 1px dashed var(--color-line);
}

.product-name { font-weight: 500; color: var(--color-ink); max-width: 260px; }
.code-badge {
  font-family: monospace; font-size: 0.8em;
  background: var(--color-surface-alt); border: 1px solid var(--color-line);
  border-radius: var(--radius-sm); padding: 1px 5px;
}
.muted-text { color: var(--color-ink-muted); }
.date-cell { white-space: nowrap; color: var(--color-ink-muted); }
.action-cell { width: 44px; text-align: center; }
.edit-btn { color: var(--color-primary); text-decoration: none; }

/* Pagination */
.pagination {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  justify-content: center;
  border-top: 1px solid var(--color-line);
}
.page-info { font-size: var(--text-sm); color: var(--color-ink-muted); }
.total-count {
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-xs); color: var(--color-ink-muted);
  text-align: right;
  border-top: 1px solid var(--color-line);
}

/* States */
.empty-state { padding: var(--space-12) var(--space-6); text-align: center; }
.empty-note { font-size: var(--text-base); color: var(--color-ink); margin: 0 0 var(--space-2); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); }
.error-banner {
  background: #fff0f0; border: 1px solid #fca5a5;
  border-radius: var(--radius-md); padding: var(--space-4) var(--space-5);
  color: #991b1b; margin: var(--space-4);
}
.link-btn {
  background: none; border: none; color: var(--color-primary);
  cursor: pointer; text-decoration: underline;
  font-size: inherit; padding: 0;
}

.sr-only {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}

/* Category panel */
.cat-panel {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-line);
  background: var(--color-surface-alt);
  align-self: stretch;
  min-height: 300px;
}

.cat-panel-header {
  padding: var(--space-4) var(--space-4) var(--space-2);
  border-bottom: 1px solid var(--color-line);
}

.cat-panel-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-2);
}

.cat-panel-back {
  font-size: var(--text-xs);
  color: var(--color-primary);
  text-decoration: none;
}
.cat-panel-back:hover { text-decoration: underline; }

.cat-panel-section { padding: var(--space-3) var(--space-4); }
.cat-panel-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  margin: 0 0 var(--space-2);
}

.cat-panel-divider {
  border-top: 1px solid var(--color-line);
}

.count-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.count-row {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}
.count-key { font-size: var(--text-sm); color: var(--color-ink-muted); }
.count-key--pub { color: var(--color-ink); font-weight: 500; }
.count-val { font-size: var(--text-sm); color: var(--color-ink); font-weight: 500; }
.count-val--pub { color: var(--color-primary); }

.health-na {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  font-style: italic;
  margin: 0 0 var(--space-1);
}
.health-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0;
}

.cat-panel-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}
.cat-panel-link:hover { text-decoration: underline; }

.cat-panel-empty {
  padding: var(--space-6);
  text-align: center;
}

/* Mobile: panel collapses below */
@media (max-width: 767px) {
  .cat-layout { flex-direction: column; }
  .cat-panel {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--color-line);
  }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-search, .filter-select { min-width: 0; }
}
</style>
