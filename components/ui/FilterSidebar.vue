<script setup lang="ts">
interface FilterGroup {
  id: string
  label: string
  options: Array<{ value: string; label: string; count?: number }>
}

defineProps<{
  groups: FilterGroup[]
  activeFilters?: Record<string, string[]>
}>()

const emit = defineEmits<{
  change: [groupId: string, value: string, checked: boolean]
  clear: []
}>()
</script>

<template>
  <aside class="filter-sidebar" aria-label="Filters">
    <div class="filter-sidebar__header">
      <h2 class="filter-sidebar__title">Filters</h2>
      <button class="filter-sidebar__clear" @click="emit('clear')">Clear all</button>
    </div>

    <div v-for="group in groups" :key="group.id" class="filter-sidebar__group">
      <p class="filter-sidebar__group-label">{{ group.label }}</p>
      <ul class="filter-sidebar__options" role="list">
        <li v-for="option in group.options" :key="option.value">
          <label class="filter-sidebar__option">
            <input
              type="checkbox"
              class="filter-sidebar__checkbox"
              :value="option.value"
              :checked="activeFilters?.[group.id]?.includes(option.value)"
              @change="emit('change', group.id, option.value, ($event.target as HTMLInputElement).checked)"
            >
            <span class="filter-sidebar__option-label">{{ option.label }}</span>
            <span v-if="option.count !== undefined" class="filter-sidebar__count">{{ option.count }}</span>
          </label>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.filter-sidebar {
  width: 220px;
  flex-shrink: 0;
}

.filter-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.filter-sidebar__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
}

.filter-sidebar__clear {
  font-size: var(--text-xs);
  color: var(--color-accent);
  text-decoration: underline;
  cursor: pointer;
}

.filter-sidebar__group {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-line);
}

.filter-sidebar__group-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-muted);
  margin-bottom: var(--space-3);
}

.filter-sidebar__options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-sidebar__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.filter-sidebar__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.filter-sidebar__option-label {
  font-size: var(--text-sm);
  color: var(--color-ink);
  flex: 1;
}

.filter-sidebar__count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: var(--color-canvas);
  border: 1px solid var(--color-line);
  border-radius: 10px;
  padding: 0 var(--space-2);
}

@media (max-width: 767px) {
  .filter-sidebar {
    width: 100%;
  }
}
</style>
