<script setup lang="ts">
import type { CategorySummary, ProductsSummary } from '~/types/product-cms'
import { categoryContextRoute } from '~/utils/productCentre'

const props = defineProps<{
  summary: ProductsSummary
  categories: CategorySummary[]
  activeStatus: string
}>()

const emit = defineEmits<{ 'update:activeStatus': [string] }>()

const route = useRoute()

/** On /admin/products the views drive local filter state; elsewhere they navigate to it. */
const onAllProductsRoute = computed(() => route.path === '/admin/products')

const SYSTEM_VIEWS = [
  { label: 'All Products', value: '', countKey: 'all' as const },
  { label: 'Draft & Review', value: 'draft,review', countKey: 'draft_review' as const },
  { label: 'Published', value: 'published', countKey: 'published' as const },
  { label: 'Archived', value: 'archived', countKey: 'archived' as const },
]

function isViewActive(value: string) {
  return onAllProductsRoute.value && props.activeStatus === value
}

function viewLink(value: string) {
  return value ? { path: '/admin/products', query: { status: value } } : { path: '/admin/products' }
}

/** Collapsed by default on narrow viewports; always expanded from 1024px up. */
const railOpen = ref(false)
</script>

<template>
  <aside class="pc-rail" :class="{ 'pc-rail--open': railOpen }" aria-label="Product catalogue navigation">
    <div class="rail-titlebar">
      <span class="rail-title">Product Catalogue</span>
      <button
        type="button"
        class="rail-toggle"
        :aria-expanded="railOpen"
        aria-controls="product-catalogue-rail"
        @click="railOpen = !railOpen"
      >
        {{ railOpen ? 'Hide' : 'Browse' }}
      </button>
    </div>

    <div id="product-catalogue-rail" class="rail-content">
      <div class="rail-section">
        <p class="rail-heading">System views</p>
        <ul class="rail-list" role="list">
          <li v-for="view in SYSTEM_VIEWS" :key="view.value || 'all'">
            <button
              v-if="onAllProductsRoute"
              type="button"
              class="rail-item"
              :class="{ 'rail-item--active': isViewActive(view.value) }"
              :aria-pressed="isViewActive(view.value)"
              @click="emit('update:activeStatus', view.value)"
            >
              <span class="rail-item-label">{{ view.label }}</span>
              <span class="rail-item-count">{{ summary[view.countKey] }}</span>
            </button>
            <NuxtLink v-else :to="viewLink(view.value)" class="rail-item">
              <span class="rail-item-label">{{ view.label }}</span>
              <span class="rail-item-count">{{ summary[view.countKey] }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="rail-section rail-section--taxonomy">
        <p class="rail-heading">Product taxonomy</p>
        <ul class="rail-list" role="list">
          <li v-for="cat in categories" :key="cat.id">
            <NuxtLink
              :to="categoryContextRoute(cat.id)"
              class="rail-item"
              :class="{ 'rail-item--active': route.path === categoryContextRoute(cat.id) }"
            >
              <span class="rail-item-label">{{ cat.name_en }}</span>
              <span class="rail-item-count">{{ cat.total }}</span>
            </NuxtLink>
          </li>
          <li v-if="categories.length === 0" class="rail-empty">No categories configured</li>
        </ul>
      </div>

      <div class="rail-footer">
        <p class="rail-note">Product taxonomy controls the public Products menu.</p>
        <p class="rail-note">Media Library stores reusable files, not product records.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.pc-rail {
  width: 216px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-line);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
}

.rail-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.rail-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
}

/* Disclosure control exists only on narrow viewports. */
.rail-toggle { display: none; }

.rail-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.rail-section { padding: var(--space-3) var(--space-2) var(--space-2); }
.rail-section--taxonomy { flex: 1; }

.rail-heading {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  padding: var(--space-1) var(--space-2) var(--space-2);
  margin: 0;
}

.rail-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3) !important;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  font-size: var(--text-sm) !important;
  color: var(--color-ink);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.rail-item:hover { background: rgba(18, 60, 50, 0.07); }

.rail-item--active {
  background: rgba(15, 92, 75, 0.12);
  color: var(--color-primary);
  font-weight: 600;
}

.rail-item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-item-count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 1px 8px;
  flex-shrink: 0;
}

.rail-item--active .rail-item-count {
  background: rgba(15, 92, 75, 0.16);
  color: var(--color-primary);
}

.rail-empty {
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
}

.rail-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  margin-top: auto;
}

.rail-note {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  line-height: 1.5;
  margin: 0 0 var(--space-2);
}

.rail-note:last-child { margin-bottom: 0; }

/* Rail column narrows before it ever stacks, matching the Media Library rail. */
@media (max-width: 1279px) {
  .pc-rail { width: 190px; }
}

/* ── 768–1023px: full-width band, System views and taxonomy stay visible ── */
@media (max-width: 1023px) {
  .pc-rail {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
  }

  .rail-content {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-4);
    padding: 0 var(--space-2) var(--space-2);
  }

  .rail-section { flex: 1 1 240px; padding-top: var(--space-2); }
  .rail-footer { display: none; }
}

/* ── ≤767px: collapsible accordion so the catalogue never squeezes the list ── */
@media (max-width: 767px) {
  .rail-toggle {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: var(--space-1) var(--space-3) !important;
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs) !important;
    color: var(--color-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .rail-content {
    display: none;
    flex-direction: column;
    gap: 0;
  }

  .pc-rail--open .rail-content { display: flex; }
}
</style>
