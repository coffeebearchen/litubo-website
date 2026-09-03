<script setup lang="ts">
import type { ProductStatus } from '~/types/product-cms'

const props = defineProps<{
  status: ProductStatus
  publishedAt: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  'status-change': [newStatus: ProductStatus]
}>()

// Phase 9A-1: only draft↔review transitions allowed
const transitions: Record<ProductStatus, { label: string; target: ProductStatus; class: string }[]> = {
  draft: [{ label: '提交审核', target: 'review', class: 'btn--review' }],
  review: [{ label: '退回草稿', target: 'draft', class: 'btn--draft' }],
  published: [],
  archived: [],
}

const currentTransitions = computed(() => transitions[props.status] ?? [])

const lockNote = computed(() => {
  if (props.status === 'draft' || props.status === 'review') return null
  return 'Published / Archived 状态将在 Phase 9A-2 验收后开放'
})
</script>

<template>
  <div class="publish-panel">
    <h3 class="panel-title">发布状态</h3>

    <div class="status-row">
      <StatusBadge :status="status" />
      <span v-if="publishedAt" class="published-at">
        首次发布：{{ new Date(publishedAt).toLocaleDateString('zh-CN') }}
      </span>
    </div>

    <div v-if="currentTransitions.length" class="action-row">
      <button
        v-for="t in currentTransitions"
        :key="t.target"
        class="btn"
        :class="t.class"
        :disabled="loading"
        @click="emit('status-change', t.target)"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="lockNote" class="lock-note">{{ lockNote }}</p>

    <div class="disabled-row">
      <button class="btn btn--locked" disabled title="Phase 9A-2 后开放">发布</button>
      <button class="btn btn--locked" disabled title="Phase 9A-2 后开放">归档</button>
    </div>
  </div>
</template>

<style scoped>
.publish-panel {
  background: white;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.published-at {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

.action-row, .disabled-row {
  display: flex;
  gap: var(--space-2);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--transition-fast);
}

.btn--review { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn--review:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn--draft  { background: white; color: var(--color-ink); border-color: var(--color-line); }
.btn--draft:hover:not(:disabled) { background: #F4F6F5; }

.btn--locked {
  background: #F0F0F0;
  color: #B0B0B0;
  cursor: not-allowed;
  border-color: #E0E0E0;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.lock-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: #FFFBF0;
  border-radius: var(--radius-sm);
  border: 1px solid #F0E8C0;
}
</style>
