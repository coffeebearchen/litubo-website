<script setup lang="ts">
import type { ContentItemStatus } from '~/types/content-center'
import { CONTENT_CENTER_LIST_ROUTE } from '~/utils/contentCenter'

/**
 * CC-IMP-02 — shared Content Workspace shell: breadcrumb, record identity,
 * module rail slot and main area. Follows the Product Workspace shell layout
 * without importing its product-specific header actions (Preview product /
 * Save changes). Content modules that later need header actions add them here.
 */
withDefaults(defineProps<{
  recordTitle: string
  pageTitle: string
  subtitle: string
  status: ContentItemStatus
  refreshing?: boolean
  /** CC-IMP-03 — editing modules hide Refresh so a reload can never silently drop local edits. */
  showRefresh?: boolean
}>(), { refreshing: false, showRefresh: true })

const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <div class="cc-shell">
    <nav class="cc-breadcrumb" aria-label="Breadcrumb">
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE">Content Center</NuxtLink>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ recordTitle }}</span>
    </nav>

    <div class="cc-header">
      <div class="cc-header-text">
        <div class="cc-header-title">
          <h1 class="cc-page-title">{{ pageTitle }}</h1>
          <StatusBadge :status="status" />
        </div>
        <p class="cc-page-subtitle">{{ subtitle }}</p>
      </div>

      <div class="cc-header-actions">
        <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-btn">Back to Content Center</NuxtLink>
        <button v-if="showRefresh" type="button" class="cc-btn" :disabled="refreshing" @click="emit('refresh')">
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
        <slot name="actions" />
      </div>
    </div>

    <div class="cc-body">
      <slot name="nav" />
      <div class="cc-main">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-shell { padding: var(--space-6) var(--space-6) var(--space-8); }

.cc-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin-bottom: var(--space-4);
}

.cc-breadcrumb a { color: var(--color-ink-muted); text-decoration: none; flex-shrink: 0; }
.cc-breadcrumb a:hover { color: var(--color-primary); text-decoration: underline; }

.cc-breadcrumb span[aria-current] {
  color: var(--color-ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.cc-header-text { min-width: 0; flex: 1 1 320px; }

.cc-header-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  min-width: 0;
}

.cc-page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.cc-page-subtitle {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
}

.cc-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.cc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  padding: var(--space-2) var(--space-5);
}

.cc-btn:hover:not(:disabled) { background: var(--color-surface-alt); }
.cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cc-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
}

.cc-main { flex: 1; min-width: 0; }

@media (max-width: 767px) {
  .cc-shell { padding: var(--space-4); }
  .cc-page-title { font-size: var(--text-xl); }
  .cc-header-actions { width: 100%; align-items: stretch; }
  .cc-header-actions > * { flex: 1 1 0; }
  .cc-body { flex-direction: column; gap: var(--space-4); }
}
</style>
