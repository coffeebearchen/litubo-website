<script setup lang="ts">
import type { AdminProduct, CategorySummary } from '~/types/product-cms'
import { buildProductCardModel, categoryNameFor } from '~/utils/productCentre'

const props = defineProps<{
  products: AdminProduct[]
  categories: CategorySummary[]
  selectedId: number | null
}>()

const emit = defineEmits<{ select: [AdminProduct] }>()

const cards = computed(() =>
  props.products.map(product => ({
    product,
    model: buildProductCardModel(product, categoryNameFor(props.categories, product.category_id)),
  })),
)
</script>

<template>
  <ul class="product-cards" role="list">
    <li
      v-for="{ product, model } in cards"
      :key="model.id"
      class="product-card"
      :class="{ 'product-card--selected': selectedId === model.id }"
    >
      <button
        type="button"
        class="product-card-main"
        :aria-label="`Open control panel for ${model.name}`"
        @click="emit('select', product)"
      >
        <img
          v-if="model.thumbUrl"
          :src="model.thumbUrl"
          :alt="model.name"
          class="product-card-thumb"
          loading="lazy"
        >
        <span v-else class="product-card-thumb product-card-thumb--empty" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </span>

        <span class="product-card-body">
          <span class="product-card-name">{{ model.name }}</span>
          <span class="product-card-meta">
            <span v-if="model.code" class="product-card-code">{{ model.code }}</span>
            <span v-else class="product-card-muted">No product code</span>
            <span v-if="model.model" class="product-card-muted">· {{ model.model }}</span>
          </span>
          <span class="product-card-meta product-card-muted">{{ model.categoryName }}</span>
        </span>

        <StatusBadge :status="model.status" />
      </button>

      <div class="product-card-actions">
        <NuxtLink :to="model.detailRoute" class="product-card-link">Open record</NuxtLink>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.product-cards {
  list-style: none;
  margin: 0;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.product-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.product-card--selected {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.product-card-main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  min-height: 44px;
  padding: var(--space-3) !important;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.product-card-thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-line);
  background: var(--color-surface-alt);
}

.product-card-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border-style: dashed;
  color: var(--color-ink-muted);
}

.product-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-card-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.product-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  align-items: baseline;
}

.product-card-code {
  font-family: monospace;
  font-size: 0.9em;
  color: var(--color-ink);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 0 5px;
  overflow-wrap: anywhere;
}

.product-card-muted { color: var(--color-ink-muted); }

.product-card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--space-3) var(--space-3);
}

.product-card-link {
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

.product-card-link:hover { border-color: var(--color-primary); }
</style>
