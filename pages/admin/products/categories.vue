<script setup lang="ts">
import type { CategorySummary } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const { data, pending, error, refresh } = await useFetch<CategorySummary[]>('/api/admin/categories-summary')
const categories = computed(() => data.value ?? [])
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Product Center</h1>
    </div>

    <AdminProductProductCatalogueNav />

    <!-- Loading -->
    <div v-if="pending && !data" class="empty-state">
      <span class="empty-hint">Loading categories…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner" role="alert">
      Failed to load categories.
      <button class="link-btn" @click="refresh()">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!pending && categories.length === 0" class="empty-state">
      <p class="empty-note">No product categories configured yet.</p>
    </div>

    <!-- Table -->
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="num-col">Total</th>
            <th class="num-col">Draft</th>
            <th class="num-col">Review</th>
            <th class="num-col">Published</th>
            <th class="num-col">Archived</th>
            <th>Category Health</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id" class="cat-row">
            <td>
              <NuxtLink
                :to="`/admin/products/categories/${cat.id}`"
                class="cat-link"
              >
                {{ cat.name_en }}
              </NuxtLink>
            </td>
            <td class="num-col">{{ cat.total }}</td>
            <td class="num-col">{{ cat.by_status.draft }}</td>
            <td class="num-col">{{ cat.by_status.review }}</td>
            <td class="num-col">
              <span :class="{ 'pub-count': cat.by_status.published > 0 }">
                {{ cat.by_status.published }}
              </span>
            </td>
            <td class="num-col">{{ cat.by_status.archived }}</td>
            <td class="health-cell">
              <span class="health-na">Not assessed</span>
              <span class="health-note"> — scoring rule not configured</span>
              <span class="health-dg"> (DG-10)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--space-5);
}
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
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

.num-col { text-align: right; width: 80px; }
.cat-row:hover { background: var(--color-surface-alt); }

.cat-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}
.cat-link:hover { text-decoration: underline; }

.pub-count {
  color: var(--color-primary);
  font-weight: 600;
}

.health-cell { white-space: nowrap; }
.health-na {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  font-style: italic;
}
.health-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.health-dg {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  opacity: 0.7;
}

.empty-state {
  padding: var(--space-12) var(--space-6);
  text-align: center;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
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
</style>
