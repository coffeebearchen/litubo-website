<script setup lang="ts">
defineProps<{
  title: string
  body?: string
  icon?: string
}>()
</script>

<template>
  <div class="feature-card">
    <div v-if="icon" class="feature-card__icon" aria-hidden="true">{{ icon }}</div>
    <div class="feature-card__icon-line" aria-hidden="true" />
    <h3 class="feature-card__title">{{ title }}</h3>
    <p v-if="body" class="feature-card__body">{{ body }}</p>
  </div>
</template>

<style scoped>
.feature-card {
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-white);
}

.feature-card__icon {
  font-size: var(--text-2xl);
  margin-bottom: var(--space-4);
}

.feature-card__icon-line {
  width: 32px;
  height: 3px;
  background: var(--color-accent);
  border-radius: 2px;
  margin-bottom: var(--space-4);
}

.feature-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  line-height: var(--leading-snug);
  margin-bottom: var(--space-2);
}

.feature-card__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}
</style>
