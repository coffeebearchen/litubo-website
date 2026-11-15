<script setup lang="ts">
import type { CategorySummary, ProductsSummary } from '~/types/product-cms'
import { CATEGORY_HEALTH_UNAVAILABLE, categoryContextRoute } from '~/utils/productCentre'

definePageMeta({ layout: 'admin' })

const [{ data: summaryData }, { data, pending, error, refresh }] = await Promise.all([
  useFetch<ProductsSummary>('/api/admin/products-summary'),
  useFetch<CategorySummary[]>('/api/admin/categories-summary'),
])

const summary = computed<ProductsSummary>(
  () => summaryData.value ?? { all: 0, draft: 0, review: 0, draft_review: 0, published: 0, archived: 0 },
)
const categories = computed<CategorySummary[]>(() => data.value ?? [])

const selectedCategory = ref<CategorySummary | null>(null)
const controlDrawerOpen = ref(false)

function selectCategory(cat: CategorySummary) {
  selectedCategory.value = selectedCategory.value?.id === cat.id ? null : cat
  controlDrawerOpen.value = selectedCategory.value !== null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="page-heading-block">
        <h1 class="page-title">Product Center</h1>
        <p class="page-subtitle">
          Technical categories control the public Products menu and group product records.
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
        <div class="pc-main-header">
          <div>
            <h2 class="pc-main-title">Categories</h2>
            <p class="pc-main-count">
              {{ categories.length }} categor{{ categories.length === 1 ? 'y' : 'ies' }}
            </p>
          </div>
          <button type="button" class="control-trigger" @click="controlDrawerOpen = true">
            Product control
          </button>
        </div>

        <div class="pc-content">
          <div v-if="pending && !data" class="empty-state">
            <span class="empty-hint">Loading categories…</span>
          </div>

          <div v-else-if="error" class="error-banner" role="alert">
            Failed to load categories.
            <button type="button" class="link-btn" @click="refresh()">Retry</button>
          </div>

          <div v-else-if="!pending && categories.length === 0" class="empty-state">
            <p class="empty-note">No product categories configured yet.</p>
            <p class="empty-hint">Categories are maintained in the CMS before products can be grouped.</p>
          </div>

          <template v-else>
            <!-- Desktop / tablet -->
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th class="num-col">Total</th>
                    <th class="num-col">Draft</th>
                    <th class="num-col">In review</th>
                    <th class="num-col">Published</th>
                    <th class="num-col">Archived</th>
                    <th>Category health</th>
                    <th><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="cat in categories"
                    :key="cat.id"
                    class="cat-row"
                    :class="{ selected: selectedCategory?.id === cat.id }"
                    tabindex="0"
                    :aria-selected="selectedCategory?.id === cat.id"
                    @click="selectCategory(cat)"
                    @keydown.enter="selectCategory(cat)"
                    @keydown.space.prevent="selectCategory(cat)"
                  >
                    <td class="cat-name">{{ cat.name_en }}</td>
                    <td class="num-col">{{ cat.total }}</td>
                    <td class="num-col">{{ cat.by_status.draft }}</td>
                    <td class="num-col">{{ cat.by_status.review }}</td>
                    <td class="num-col">
                      <span :class="{ 'pub-count': cat.by_status.published > 0 }">
                        {{ cat.by_status.published }}
                      </span>
                    </td>
                    <td class="num-col">{{ cat.by_status.archived }}</td>
                    <td class="health-cell" title="Charter gate CH-DG-10 — Category Health definition not confirmed">
                      {{ CATEGORY_HEALTH_UNAVAILABLE }}
                    </td>
                    <td class="action-cell">
                      <NuxtLink
                        :to="categoryContextRoute(cat.id)"
                        class="row-link"
                        :aria-label="`Open ${cat.name_en} category context`"
                        @click.stop
                      >Open</NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 375px: stacked cards, no horizontal scrolling -->
            <ul class="cat-cards" role="list">
              <li
                v-for="cat in categories"
                :key="cat.id"
                class="cat-card"
                :class="{ 'cat-card--selected': selectedCategory?.id === cat.id }"
              >
                <button
                  type="button"
                  class="cat-card-main"
                  :aria-label="`Open control panel for ${cat.name_en}`"
                  @click="selectCategory(cat)"
                >
                  <span class="cat-card-name">{{ cat.name_en }}</span>
                  <span class="cat-card-counts">
                    <span>Total {{ cat.total }}</span>
                    <span>Draft {{ cat.by_status.draft }}</span>
                    <span>In review {{ cat.by_status.review }}</span>
                    <span>Published {{ cat.by_status.published }}</span>
                    <span>Archived {{ cat.by_status.archived }}</span>
                  </span>
                  <span class="cat-card-health">{{ CATEGORY_HEALTH_UNAVAILABLE }}</span>
                </button>
                <div class="cat-card-actions">
                  <NuxtLink :to="categoryContextRoute(cat.id)" class="cat-card-link">Open category</NuxtLink>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </div>

      <CategoryContextPanel
        :category="selectedCategory"
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

.pc-main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4);
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

.pc-content { flex: 1; border-top: 1px solid var(--color-line); }

.table-wrap { width: 100%; }
.cat-cards { display: none; }

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

.cat-row { cursor: pointer; transition: background var(--transition-fast); }
.cat-row:hover { background: var(--color-surface-alt); }

.cat-row.selected {
  background: rgba(47, 107, 58, 0.08);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.cat-name { font-weight: 600; color: var(--color-ink); }
.num-col { text-align: right; width: 90px; }
.pub-count { color: var(--color-primary); font-weight: 600; }

.health-cell {
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.action-cell { width: 80px; text-align: right; }

.row-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--text-xs);
  white-space: nowrap;
}

.row-link:hover { text-decoration: underline; }

/* States */
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

/* ── Category cards (shown wherever the four-part shell narrows the workspace) ── */
.cat-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.cat-card--selected {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.cat-card-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: var(--space-3) !important;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.cat-card-name { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }

.cat-card-counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

.cat-card-health {
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-ink-muted);
}

.cat-card-actions { display: flex; justify-content: flex-end; padding: 0 var(--space-3) var(--space-3); }

.cat-card-link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

@media (max-width: 1279px) {
  .table-wrap { display: none; }

  .cat-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    list-style: none;
    margin: 0;
    padding: var(--space-3);
  }
}

@media (max-width: 1023px) {
  .pc-layout { flex-direction: column; }
  .control-trigger { display: inline-flex; }
}

@media (max-width: 767px) {
  .pc-main-header { padding: var(--space-3); }
}
</style>
