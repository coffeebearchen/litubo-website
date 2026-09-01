<script setup lang="ts">
defineProps<{
  title: string
  body?: string
  primaryLabel: string
  primaryTo: string
  secondaryLabel?: string
  secondaryTo?: string
  dark?: boolean
}>()
</script>

<template>
  <section class="cta-banner" :class="{ 'cta-banner--dark': dark }">
    <div class="container cta-banner__inner">
      <div class="cta-banner__text">
        <h2 class="cta-banner__title">{{ title }}</h2>
        <p v-if="body" class="cta-banner__body">{{ body }}</p>
      </div>
      <div class="cta-banner__actions">
        <NuxtLink :to="primaryTo" class="btn btn--accent btn--lg">
          {{ primaryLabel }}
        </NuxtLink>
        <NuxtLink v-if="secondaryLabel && secondaryTo" :to="secondaryTo" class="btn btn--outline-white btn--lg">
          {{ secondaryLabel }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-banner {
  background: var(--color-primary);
  padding: var(--space-16) 0;
}

.cta-banner--dark {
  background: var(--color-primary-deep);
}

.cta-banner__inner {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.cta-banner__text {
  flex: 1;
  min-width: 240px;
}

.cta-banner__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-white);
  line-height: var(--leading-snug);
}

.cta-banner__body {
  margin-top: var(--space-3);
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.75);
  line-height: var(--leading-normal);
}

.cta-banner__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

:deep(.btn) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

:deep(.btn--lg) {
  padding: var(--space-3) var(--space-8);
  font-size: var(--text-base);
}

:deep(.btn--accent) {
  background: var(--color-accent);
  color: var(--color-white);
  border-color: var(--color-accent);
}

:deep(.btn--accent:hover) {
  background: #b85f15;
  border-color: #b85f15;
}

:deep(.btn--outline-white) {
  background: transparent;
  color: var(--color-white);
  border-color: rgba(255, 255, 255, 0.5);
}

:deep(.btn--outline-white:hover) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-white);
}

@media (max-width: 767px) {
  .cta-banner__inner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-6);
  }
}
</style>
