<script setup lang="ts">
import type { CategorySummary } from '~/types/product-cms'
import { CATEGORY_HEALTH_UNAVAILABLE } from '~/utils/productCentre'

defineProps<{
  category: CategorySummary | null
  /** Controls the narrow-viewport drawer only; the desktop column is always visible. */
  drawerOpen: boolean
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <aside
    class="control-panel"
    :class="{ 'control-panel--drawer-open': drawerOpen }"
    role="complementary"
    aria-label="Category control"
  >
    <div class="panel-header">
      <span class="panel-title">Product Control</span>
      <button
        type="button"
        class="btn-icon panel-close"
        aria-label="Close category context"
        @click="emit('close')"
      >✕</button>
    </div>

    <div v-if="category" class="panel-body">
      <div class="panel-identity">
        <span class="panel-name">{{ category.name_en }}</span>
        <span class="panel-kind">Technical category</span>
      </div>

      <div class="panel-divider" />

      <div class="panel-block">
        <span class="field-label">Product counts</span>
        <ul class="count-list" role="list">
          <li class="count-row">
            <span class="count-key">Total</span><span class="count-val">{{ category.total }}</span>
          </li>
          <li class="count-row">
            <span class="count-key">Draft</span><span class="count-val">{{ category.by_status.draft }}</span>
          </li>
          <li class="count-row">
            <span class="count-key">In review</span><span class="count-val">{{ category.by_status.review }}</span>
          </li>
          <li class="count-row">
            <span class="count-key">Published</span>
            <span class="count-val count-val--pub">{{ category.by_status.published }}</span>
          </li>
          <li class="count-row">
            <span class="count-key">Archived</span><span class="count-val">{{ category.by_status.archived }}</span>
          </li>
        </ul>
      </div>

      <div class="panel-divider" />

      <div class="panel-block">
        <span class="field-label">Category health</span>
        <p class="gate-value" title="Charter gate CH-DG-10 — Category Health definition not confirmed">
          {{ CATEGORY_HEALTH_UNAVAILABLE }}
        </p>
      </div>

      <div class="panel-divider" />

      <div class="panel-block">
        <span class="field-label">About this category</span>
        <p v-if="category.intro_en" class="panel-text">{{ category.intro_en }}</p>
        <p v-else class="panel-text panel-text--muted">No category introduction recorded.</p>
      </div>

      <div class="panel-divider" />

      <div class="panel-block">
        <NuxtLink :to="`/admin/products?category_id=${category.id}`" class="field-link">
          View in All Products →
        </NuxtLink>
      </div>
    </div>

    <div v-else class="panel-empty">
      <p class="panel-empty-title">No category selected</p>
      <p class="panel-empty-hint">Open a category from the product taxonomy to see its context.</p>
    </div>
  </aside>
</template>

<style scoped>
.control-panel {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  align-self: stretch;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
}

/* The close control only exists in the narrow-viewport drawer. */
.panel-close { display: none; }

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-identity { display: flex; flex-direction: column; gap: var(--space-1); }

.panel-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.panel-kind { font-size: var(--text-xs); color: var(--color-ink-muted); }

.panel-block { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.count-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

.count-row { display: flex; align-items: center; justify-content: space-between; }
.count-key { font-size: var(--text-sm); color: var(--color-ink-muted); }
.count-val { font-size: var(--text-sm); color: var(--color-ink); font-weight: 500; }
.count-val--pub { color: var(--color-primary); }

.gate-value {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  font-style: italic;
  margin: 0;
}

.panel-text {
  font-size: var(--text-sm);
  color: var(--color-ink);
  line-height: 1.55;
  margin: 0;
}

.panel-text--muted { color: var(--color-ink-muted); font-style: italic; }

.field-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

.field-link:hover { text-decoration: underline; }

.panel-divider { border-top: 1px solid var(--color-line); }

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.panel-empty-title { font-size: var(--text-sm); color: var(--color-ink); margin: 0; }
.panel-empty-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; line-height: 1.5; }

/* Matches the Media Library detail rail, which narrows before it is dismissed. */
@media (max-width: 1279px) {
  .control-panel { width: 280px; }
}

/* ── Narrow viewports: the third column becomes a closable drawer ── */
@media (max-width: 1023px) {
  .control-panel {
    position: fixed;
    inset: 0;
    width: 100%;
    max-width: 100%;
    z-index: 200;
    border-left: none;
    display: none;
  }

  .control-panel--drawer-open { display: flex; }

  .panel-close { display: inline-flex; }
}
</style>
