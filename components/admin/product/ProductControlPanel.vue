<script setup lang="ts">
import type { AdminProduct, ProductCategory } from '~/types/product-cms'

const props = defineProps<{
  product: AdminProduct
  categories: ProductCategory[]
}>()

const emit = defineEmits<{ close: [] }>()

const categoryName = computed(() => {
  if (!props.product.category_id) return '—'
  return props.categories.find(c => c.id === props.product.category_id)?.name_en ?? `ID ${props.product.category_id}`
})

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <aside class="control-panel" role="complementary" aria-label="Product details">
    <div class="panel-header">
      <span class="panel-title">Product Control</span>
      <button class="btn-icon" aria-label="Close details panel" @click="emit('close')">✕</button>
    </div>

    <div class="panel-body">
      <!-- Hero image -->
      <div v-if="product.hero_image" class="panel-hero">
        <img
          :src="`/api/admin/asset/${product.hero_image}?width=280&height=160&fit=cover&quality=75`"
          :alt="product.name_en"
          class="panel-hero-img"
          loading="lazy"
        >
      </div>
      <div v-else class="panel-hero panel-hero--empty" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>

      <!-- Name + status -->
      <div class="panel-identity">
        <span class="panel-product-name">{{ product.name_en }}</span>
        <AdminStatusBadge :status="product.status" />
      </div>

      <!-- Summary -->
      <p v-if="product.summary_en" class="panel-summary">{{ product.summary_en }}</p>

      <div class="panel-divider" />

      <div v-if="product.name_es" class="panel-field">
        <span class="field-label">Name (ES)</span>
        <span class="field-value">{{ product.name_es }}</span>
      </div>
      <div v-if="product.name_pt" class="panel-field">
        <span class="field-label">Name (PT)</span>
        <span class="field-value">{{ product.name_pt }}</span>
      </div>

      <div class="panel-field">
        <span class="field-label">Product Code</span>
        <span class="field-value" :class="{ muted: !product.product_code }">
          {{ product.product_code ?? 'Not set' }}
        </span>
      </div>
      <div class="panel-field">
        <span class="field-label">Model / Series</span>
        <span class="field-value" :class="{ muted: !product.model_or_series }">
          {{ product.model_or_series ?? '—' }}
        </span>
      </div>

      <div class="panel-divider" />

      <div class="panel-field">
        <span class="field-label">Technical Category</span>
        <div class="panel-field-row">
          <span class="field-value">{{ categoryName }}</span>
          <NuxtLink
            v-if="product.category_id"
            :to="`/admin/products/categories/${product.category_id}`"
            class="field-link"
          >
            View category →
          </NuxtLink>
        </div>
      </div>

      <div class="panel-divider" />

      <div class="panel-field">
        <span class="field-label">Created</span>
        <span class="field-value">{{ formatDate(product.date_created) }}</span>
      </div>
      <div class="panel-field">
        <span class="field-label">Last Updated</span>
        <span class="field-value">{{ formatDate(product.date_updated) }}</span>
      </div>
      <div v-if="product.published_at" class="panel-field">
        <span class="field-label">Published</span>
        <span class="field-value">{{ formatDate(product.published_at) }}</span>
      </div>
    </div>

    <div class="panel-actions">
      <NuxtLink :to="`/admin/products/${product.id}/edit`" class="btn btn-primary btn-full">
        Edit Product
      </NuxtLink>
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
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
}

.panel-hero {
  width: 100%;
  height: 120px;
  background: var(--color-surface-alt);
  overflow: hidden;
  flex-shrink: 0;
}

.panel-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.panel-hero--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink-muted);
}

.panel-identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) 0;
  flex-shrink: 0;
}

.panel-product-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  line-height: 1.3;
  flex: 1;
}

.panel-summary {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.5;
  padding: 0 var(--space-4);
  margin: var(--space-1) 0 0;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-value {
  font-size: var(--text-sm);
  color: var(--color-ink);
}

.field-value.muted { color: var(--color-ink-muted); }

.panel-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.field-link {
  font-size: var(--text-xs);
  color: var(--color-primary);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.field-link:hover { text-decoration: underline; }

.panel-divider {
  border-top: 1px solid var(--color-line);
  margin: var(--space-1) 0;
}

.panel-actions {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  flex-shrink: 0;
}

.btn-full {
  width: 100%;
  text-align: center;
  display: block;
  text-decoration: none;
  box-sizing: border-box;
}

@media (max-width: 767px) {
  .control-panel {
    position: fixed;
    inset: 0;
    width: 100%;
    z-index: 200;
  }
}
</style>
