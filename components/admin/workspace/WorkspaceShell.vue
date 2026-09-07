<script setup lang="ts">
import type { AdminProduct } from '~/types/product-cms'

defineProps<{
  product: AdminProduct
  previewHref: string
}>()
</script>

<template>
  <div class="ws-shell">
    <nav class="ws-breadcrumb" aria-label="Breadcrumb">
      <NuxtLink to="/admin/products">Product Center</NuxtLink>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ product.name_en }}</span>
    </nav>

    <div class="ws-header">
      <div class="ws-header-title">
        <h1 class="ws-page-title">{{ product.name_en }}</h1>
        <StatusBadge :status="product.status" />
      </div>

      <div class="ws-header-actions">
        <NuxtLink :to="previewHref" target="_blank" rel="noopener" class="btn btn-secondary">
          Preview product
        </NuxtLink>
        <button
          type="button"
          class="btn btn-secondary"
          disabled
          title="This read-only preview cannot save changes. Editing arrives in a later Workspace work order."
        >
          Save changes
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled
          title="Submit for review is disabled in this read-only preview — the readiness rule is not yet configured."
        >
          Submit for review
        </button>
      </div>
    </div>

    <div class="ws-body">
      <slot name="nav" />
      <div class="ws-main">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-shell { padding: var(--space-6) var(--space-6) var(--space-8); }

.ws-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin-bottom: var(--space-4);
}

.ws-breadcrumb a { color: var(--color-ink-muted); text-decoration: none; }
.ws-breadcrumb a:hover { color: var(--color-primary); text-decoration: underline; }
.ws-breadcrumb span[aria-current] { color: var(--color-ink); }

.ws-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.ws-header-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.ws-page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.ws-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.btn-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.btn-secondary:hover:not(:disabled) { background: var(--color-surface-alt); }

.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-deep); }

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ws-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
}

.ws-main { flex: 1; min-width: 0; }

@media (max-width: 767px) {
  .ws-shell { padding: var(--space-4); }
  .ws-page-title { font-size: var(--text-xl); }
  .ws-body { flex-direction: column; gap: var(--space-4); }
}
</style>
