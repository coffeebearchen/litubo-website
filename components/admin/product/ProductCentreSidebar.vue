<script setup lang="ts">
import type { CategorySummary, ProductsSummary } from '~/types/product-cms'

const props = defineProps<{
  summary: ProductsSummary
  categories: CategorySummary[]
  activeStatus: string
}>()

const emit = defineEmits<{ 'update:activeStatus': [string] }>()

const route = useRoute()

const SYSTEM_VIEWS = [
  { label: 'All Products',   value: '',           countKey: 'all'          as const },
  { label: 'Draft & Review', value: 'draft,review', countKey: 'draft_review' as const },
  { label: 'Published',      value: 'published',  countKey: 'published'    as const },
  { label: 'Archived',       value: 'archived',   countKey: 'archived'     as const },
]

function isViewActive(val: string) {
  return props.activeStatus === val && route.path === '/admin/products'
}
</script>

<template>
  <aside class="pc-sidebar" aria-label="Product catalogue navigation">
    <div class="sidebar-section">
      <p class="sidebar-heading">SYSTEM VIEWS</p>
      <ul class="sidebar-list" role="list">
        <li v-for="view in SYSTEM_VIEWS" :key="view.value">
          <button
            class="sidebar-item"
            :class="{ 'sidebar-item--active': isViewActive(view.value) }"
            @click="emit('update:activeStatus', view.value)"
          >
            <span class="sidebar-item-label">{{ view.label }}</span>
            <span class="sidebar-item-count">{{ summary[view.countKey] }}</span>
          </button>
        </li>
        <li>
          <span
            class="sidebar-item sidebar-item--disabled"
            aria-disabled="true"
            :title="`Category Health formula not confirmed — Charter DG-10`"
          >
            <span class="sidebar-item-label">Needs Attention</span>
            <span class="sidebar-item-count sidebar-item-count--gate">—</span>
          </span>
          <span class="gate-note">Not assessed (DG-10)</span>
        </li>
      </ul>
    </div>

    <div class="sidebar-section sidebar-section--taxonomy">
      <p class="sidebar-heading">PRODUCT TAXONOMY</p>
      <ul class="sidebar-list" role="list">
        <li v-for="cat in categories" :key="cat.id">
          <NuxtLink
            :to="`/admin/products/categories/${cat.id}`"
            class="sidebar-item sidebar-item--link"
            :class="{ 'sidebar-item--active': route.path === `/admin/products/categories/${cat.id}` }"
          >
            <span class="sidebar-item-label">{{ cat.name_en }}</span>
            <span class="sidebar-item-count">{{ cat.total }}</span>
          </NuxtLink>
        </li>
        <li v-if="categories.length === 0" class="sidebar-empty">
          No categories configured
        </li>
      </ul>
    </div>

    <div class="sidebar-footer-note-block">
      <p class="sidebar-footer-note">Product taxonomy controls the public Products menu.</p>
      <p class="sidebar-footer-note">Media Library stores reusable files, not product records.</p>
    </div>
  </aside>
</template>

<style scoped>
.pc-sidebar {
  width: 204px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-line);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-section {
  padding: var(--space-4) var(--space-3) var(--space-2);
}

.sidebar-section--taxonomy {
  flex: 1;
}

.sidebar-heading {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  padding: var(--space-1) var(--space-2) var(--space-2);
  margin: 0;
}

.sidebar-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  text-align: left;
  transition: background 0.1s, color 0.1s;
  min-height: 36px;
}

.sidebar-item:hover:not(.sidebar-item--disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.sidebar-item--active {
  background: rgba(15, 92, 75, 0.1);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-item--disabled {
  cursor: default;
  opacity: 0.45;
}

.sidebar-item--link {
  display: flex;
}

.sidebar-item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: var(--space-2);
}

.sidebar-item-count {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 1px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}

.sidebar-item--active .sidebar-item-count {
  background: rgba(15, 92, 75, 0.15);
  color: var(--color-primary);
}

.sidebar-item-count--gate { opacity: 0.5; }

.gate-note {
  font-size: 0.6rem;
  color: var(--color-ink-muted);
  padding: 0 var(--space-3) var(--space-1);
  display: block;
  font-style: italic;
}

.sidebar-empty {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  font-style: italic;
}

.sidebar-footer-note-block {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  margin-top: auto;
}

.sidebar-footer-note {
  font-size: 0.625rem;
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-2);
  line-height: 1.5;
}

.sidebar-footer-note:last-child { margin-bottom: 0; }

@media (max-width: 767px) {
  .pc-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .sidebar-section {
    flex-shrink: 0;
    padding: var(--space-3);
  }

  .sidebar-section--taxonomy {
    flex: 0 0 auto;
  }

  .sidebar-list {
    flex-direction: row;
    gap: var(--space-1);
    flex-wrap: nowrap;
  }

  .sidebar-item {
    white-space: nowrap;
    min-height: 32px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }

  .gate-note { display: none; }
  .sidebar-footer-note-block { display: none; }
}
</style>
