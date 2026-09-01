<script setup lang="ts">
defineProps<{
  to: string
  external?: boolean
}>()
</script>

<template>
  <a
    v-if="external"
    :href="to"
    target="_blank"
    rel="noopener noreferrer"
    class="arrow-link"
  >
    <slot />
    <svg class="arrow-link__icon" width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 5.5h14M10 1l5 4.5-5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </a>
  <NuxtLink
    v-else
    :to="to"
    class="arrow-link"
  >
    <slot />
    <svg class="arrow-link__icon" width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 5.5h14M10 1l5 4.5-5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </NuxtLink>
</template>

<style scoped>
.arrow-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  transition: color var(--transition-fast), gap var(--transition-fast);
}

.arrow-link:hover {
  color: var(--color-accent);
  gap: var(--space-3);
}

.arrow-link__icon {
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.arrow-link:hover .arrow-link__icon {
  transform: translateX(3px);
}
</style>
