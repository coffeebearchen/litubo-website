<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; to?: string }>
}>()
</script>

<template>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol class="breadcrumb__list" role="list">
      <li v-for="(item, i) in items" :key="i" class="breadcrumb__item">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="breadcrumb__link"
        >
          {{ item.label }}
        </NuxtLink>
        <span v-else class="breadcrumb__current" aria-current="page">{{ item.label }}</span>
        <span v-if="i < items.length - 1" class="breadcrumb__sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumb {
  padding: var(--space-3) 0;
}

.breadcrumb__list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.breadcrumb__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.breadcrumb__link {
  /* Explicit ink, not currentColor: on the warm page hero the inherited colour is white and the
     breadcrumb becomes unreadable. */
  color: var(--color-ink-muted);
  opacity: 0.72;
  transition: opacity var(--transition-fast);
}

.breadcrumb__link:hover {
  opacity: 1;
}

.breadcrumb__current {
  color: var(--color-ink);
  opacity: 0.92;
  font-weight: 500;
}

.breadcrumb__sep {
  color: var(--color-ink-muted);
  opacity: 0.45;
}
</style>
