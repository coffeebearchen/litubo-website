<script setup lang="ts">
const props = defineProps<{
  currentPage: number
  totalPages: number
  baseUrl?: string
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

const pages = computed(() => {
  const range: (number | '…')[] = []
  const delta = 2
  const left = props.currentPage - delta
  const right = props.currentPage + delta

  for (let i = 1; i <= props.totalPages; i++) {
    if (i === 1 || i === props.totalPages || (i >= left && i <= right)) {
      range.push(i)
    } else if (range[range.length - 1] !== '…') {
      range.push('…')
    }
  }
  return range
})
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="Pagination">
    <button
      class="pagination__btn"
      :disabled="currentPage <= 1"
      :aria-label="`Previous page`"
      @click="emit('change', currentPage - 1)"
    >
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
        <path d="M6 1L1 6l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <template v-for="(page, i) in pages" :key="i">
      <span v-if="page === '…'" class="pagination__ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        class="pagination__btn pagination__page"
        :class="{ 'is-active': page === currentPage }"
        :aria-label="`Page ${page}`"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="emit('change', page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      class="pagination__btn"
      :disabled="currentPage >= totalPages"
      :aria-label="`Next page`"
      @click="emit('change', currentPage + 1)"
    >
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
        <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  justify-content: center;
}

.pagination__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.pagination__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination__page.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

.pagination__ellipsis {
  padding: 0 var(--space-2);
  color: var(--color-ink-muted);
}
</style>
