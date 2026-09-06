<script setup lang="ts">
import type { AdminProduct, ProductStatus } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Review', value: 'review' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const activeStatus = ref('')
const page = ref(1)

const { data, pending } = await useFetch<{
  data: AdminProduct[]
  meta: { total_count: number; filter_count: number }
}>('/api/admin/products', {
  query: computed(() => ({
    status: activeStatus.value || undefined,
    page: page.value,
    limit: 20,
  })),
})

function selectTab(val: string) {
  activeStatus.value = val
  page.value = 1
}

const products = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta?.filter_count ?? 0)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Product Center</h1>
      <NuxtLink to="/admin/products/new" class="btn-primary">+ New Product</NuxtLink>
    </div>

    <div class="tabs">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        class="tab"
        :class="{ 'tab--active': activeStatus === tab.value }"
        @click="selectTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="table-wrap">
      <table v-if="!pending && products.length" class="product-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Model Series</th>
            <th>Category</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>
              <div class="product-name">{{ p.name_en }}</div>
              <div class="product-slug">{{ p.slug }}</div>
            </td>
            <td>{{ p.model_or_series ?? '—' }}</td>
            <td>{{ p.category_id ?? '—' }}</td>
            <td><StatusBadge :status="(p.status as ProductStatus)" /></td>
            <td class="date-cell">{{ p.date_updated ? new Date(p.date_updated).toLocaleDateString('en-US') : '—' }}</td>
            <td>
              <NuxtLink :to="`/admin/products/${p.id}`" class="edit-link">Edit</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="pending" class="empty-state">Loading…</div>

      <div v-else class="empty-state">
        <p>{{ activeStatus ? `No ${STATUS_TABS.find(t => t.value === activeStatus)?.label} products found` : 'No products found' }}</p>
        <NuxtLink v-if="!activeStatus" to="/admin/products/new" class="btn-primary">Create first product</NuxtLink>
      </div>
    </div>

    <div v-if="total > 20" class="pagination">
      <button :disabled="page <= 1" class="page-btn" @click="page--">Previous</button>
      <span class="page-info">Page {{ page }} · {{ total }} total</span>
      <button :disabled="page * 20 >= total" class="page-btn" @click="page++">Next</button>
    </div>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
}

.btn-primary {
  padding: var(--space-2) var(--space-5);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  transition: background var(--transition-fast);
}
.btn-primary:hover { background: var(--color-primary-deep); }

.tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-line);
}

.tab {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color var(--transition-fast);
}
.tab:hover { color: var(--color-ink); }
.tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 500; }

.table-wrap {
  background: white;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow-x: auto;
  overflow-y: hidden;
}

.product-table { width: 100%; border-collapse: collapse; }

.product-table th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  background: #F8FAF9;
  border-bottom: 1px solid var(--color-line);
}

.product-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  font-size: var(--text-sm);
  color: var(--color-ink);
  vertical-align: middle;
}

.product-table tr:last-child td { border-bottom: none; }
.product-table tr:hover td { background: #F8FAF9; }

.product-name { font-weight: 500; }
.product-slug { font-size: var(--text-xs); color: var(--color-ink-muted); font-family: monospace; }

.date-cell { color: var(--color-ink-muted); font-size: var(--text-xs); }

.edit-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
}
.edit-link:hover { text-decoration: underline; }

.empty-state {
  padding: var(--space-12);
  text-align: center;
  color: var(--color-ink-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.page-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-line);
  background: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
}
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-info { font-size: var(--text-sm); color: var(--color-ink-muted); }
</style>
