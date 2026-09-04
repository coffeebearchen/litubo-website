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

const transitions: Record<ProductStatus, { label: string; target: ProductStatus; class: string }[]> = {
  draft:     [{ label: '提交审核', target: 'review',     class: 'btn--review'   }],
  review:    [
    { label: '退回草稿', target: 'draft',     class: 'btn--draft'   },
    { label: '发布',     target: 'published', class: 'btn--publish'  },
  ],
  published: [{ label: '撤回草稿', target: 'draft',     class: 'btn--draft'   }],
  archived:  [],
}

const currentTransitions = computed(() => transitions[props.status] ?? [])

const lockNote = computed(() => {
  if (props.status === 'archived') return '已归档状态，如需恢复请联系管理员'
  return null
})

function requestTransition(target: ProductStatus) {
  if (target === 'published') {
    if (!window.confirm('确认发布此产品？发布后将对外公开可见。')) return
  }
  else if (target === 'draft' && props.status === 'published') {
    if (!window.confirm('确认撤回至草稿？产品将立即从前台下线。')) return
  }
  emit('status-change', target)
}
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
        @click="requestTransition(t.target)"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="lockNote" class="lock-note">{{ lockNote }}</p>
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

.action-row {
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

.btn--review  { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn--review:hover:not(:disabled)  { background: var(--color-primary-deep); }
.btn--publish { background: #1a6b3c; color: white; border-color: #1a6b3c; }
.btn--publish:hover:not(:disabled) { background: #155230; }
.btn--draft   { background: white; color: var(--color-ink); border-color: var(--color-line); }
.btn--draft:hover:not(:disabled)   { background: #F4F6F5; }

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
