<script setup lang="ts">
import type { AdminProduct } from '~/types/product-cms'
import { adminAssetUrl, categoryContextRoute, productDetailRoute } from '~/utils/productCentre'

const props = defineProps<{
  /** null keeps the desktop column in place with an empty state (persistent workspace region). */
  product: AdminProduct | null
  categories: { id: number, name_en: string }[]
  /** Controls the narrow-viewport drawer only; the desktop column is always visible. */
  drawerOpen: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const categoryName = computed(() => {
  const id = props.product?.category_id
  if (!id) return 'Uncategorised'
  return props.categories.find(c => c.id === id)?.name_en ?? `ID ${id}`
})

const heroUrl = computed(() =>
  props.product?.hero_image
    ? adminAssetUrl(props.product.hero_image, { width: 320, height: 180, quality: 75 })
    : null,
)
</script>

<template>
  <aside
    class="control-panel"
    :class="{ 'control-panel--drawer-open': drawerOpen }"
    role="complementary"
    aria-label="Product control"
  >
    <div class="panel-header">
      <span class="panel-title">Product Control</span>
      <button
        type="button"
        class="btn-icon panel-close"
        aria-label="Close product control"
        @click="emit('close')"
      >✕</button>
    </div>

    <template v-if="product">
      <div class="panel-body">
        <div v-if="heroUrl" class="panel-hero">
          <img :src="heroUrl" :alt="product.name_en" class="panel-hero-img" loading="lazy">
        </div>
        <div v-else class="panel-hero panel-hero--empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span class="panel-hero-note">No hero image linked</span>
        </div>

        <div class="panel-identity">
          <span class="panel-name">{{ product.name_en }}</span>
          <StatusBadge :status="product.status" />
        </div>

        <p v-if="product.summary_en" class="panel-text">{{ product.summary_en }}</p>

        <div class="panel-divider" />

        <div class="panel-field">
          <span class="field-label">Product code</span>
          <span class="field-value" :class="{ muted: !product.product_code }">
            {{ product.product_code ?? 'Not set' }}
          </span>
        </div>

        <div class="panel-field">
          <span class="field-label">Model / series</span>
          <span class="field-value" :class="{ muted: !product.model_or_series }">
            {{ product.model_or_series ?? 'Not set' }}
          </span>
        </div>

        <div class="panel-field">
          <span class="field-label">Technical category</span>
          <div class="panel-field-row">
            <span class="field-value">{{ categoryName }}</span>
            <NuxtLink
              v-if="product.category_id"
              :to="categoryContextRoute(product.category_id)"
              class="field-link"
            >View category →</NuxtLink>
          </div>
        </div>

      </div>

      <div class="panel-actions">
        <NuxtLink :to="productDetailRoute(product.id)" class="btn btn-primary btn-full">
          Open product record
        </NuxtLink>
      </div>
    </template>

    <div v-else class="panel-empty">
      <p class="panel-empty-title">No product selected</p>
      <p class="panel-empty-hint">Select a product from the list to see its control context.</p>
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

.panel-hero {
  width: 100%;
  height: 140px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  overflow: hidden;
  flex-shrink: 0;
}

.panel-hero-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.panel-hero--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-style: dashed;
  color: var(--color-ink-muted);
}

.panel-hero-note { font-size: var(--text-xs); color: var(--color-ink-muted); }

.panel-identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.panel-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  line-height: 1.3;
  flex: 1;
  overflow-wrap: anywhere;
}

.panel-text {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.55;
  margin: 0;
}

.panel-field { display: flex; flex-direction: column; gap: var(--space-1); }

.field-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-value { font-size: var(--text-sm); color: var(--color-ink); overflow-wrap: anywhere; }
.field-value.muted { color: var(--color-ink-muted); }

.panel-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.field-link {
  font-size: var(--text-xs);
  color: var(--color-primary);
  text-decoration: none;
  white-space: nowrap;
}

.field-link:hover { text-decoration: underline; }

.panel-divider { border-top: 1px solid var(--color-line); }

.panel-actions {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  flex-shrink: 0;
}

.btn-full {
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-sizing: border-box;
}

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
