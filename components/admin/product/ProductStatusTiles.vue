<script setup lang="ts">
import type { ProductsSummary } from '~/types/product-cms'
import { buildStatusTiles } from '~/utils/productCentre'

const props = defineProps<{
  summary: ProductsSummary
  activeStatus: string
}>()

const emit = defineEmits<{ select: [string] }>()

const tiles = computed(() => buildStatusTiles(props.summary))
</script>

<template>
  <div class="status-tiles" role="group" aria-label="Filter products by lifecycle status">
    <button
      v-for="tile in tiles"
      :key="tile.key"
      type="button"
      class="status-tile"
      :class="{ 'status-tile--active': activeStatus === tile.value }"
      :aria-pressed="activeStatus === tile.value"
      @click="emit('select', tile.value)"
    >
      <span class="status-tile-label">{{ tile.label }}</span>
      <span class="status-tile-count">{{ tile.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.status-tiles {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) 0;
}

.status-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-3) !important;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.status-tile:hover { border-color: var(--color-primary); }

.status-tile--active {
  border-color: var(--color-primary);
  background: rgba(47, 107, 58, 0.07);
}

.status-tile-label {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.status-tile--active .status-tile-label {
  color: var(--color-primary);
  font-weight: 600;
}

.status-tile-count {
  font-size: var(--text-xl);
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-ink);
}

.status-tile--active .status-tile-count { color: var(--color-primary); }

@media (max-width: 1279px) {
  .status-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 767px) {
  .status-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: var(--space-3) var(--space-3) 0;
  }

  .status-tile { min-height: 44px; }
  .status-tile-count { font-size: var(--text-lg); }
}
</style>
