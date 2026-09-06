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
      <span class="panel-title">Product Details</span>
      <button class="btn-icon" aria-label="Close details panel" @click="emit('close')">✕</button>
    </div>

    <div class="panel-body">
      <div class="panel-field">
        <span class="field-label">Name (EN)</span>
        <span class="field-value">{{ product.name_en }}</span>
      </div>
      <div v-if="product.name_es" class="panel-field">
        <span class="field-label">Name (ES)</span>
        <span class="field-value">{{ product.name_es }}</span>
      </div>
      <div v-if="product.name_pt" class="panel-field">
        <span class="field-label">Name (PT)</span>
        <span class="field-value">{{ product.name_pt }}</span>
      </div>

      <div class="panel-divider" />

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
      <div class="panel-field">
        <span class="field-label">Category</span>
        <span class="field-value">{{ categoryName }}</span>
      </div>
      <div class="panel-field">
        <span class="field-label">Status</span>
        <AdminStatusBadge :status="product.status" />
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
  width: 360px;
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
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}
.panel-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
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
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.field-value {
  font-size: var(--text-sm);
  color: var(--color-ink);
}
.field-value.muted {
  color: var(--color-ink-muted);
}
.panel-divider {
  border-top: 1px solid var(--color-line);
  margin: var(--space-1) 0;
}
.panel-actions {
  padding: var(--space-4) var(--space-5);
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
