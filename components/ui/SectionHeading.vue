<script setup lang="ts">
defineProps<{
  tag?: 'h1' | 'h2' | 'h3'
  eyebrow?: string
  centered?: boolean
}>()
</script>

<template>
  <div class="section-heading" :class="{ 'section-heading--centered': centered }">
    <p v-if="eyebrow" class="section-heading__eyebrow">{{ eyebrow }}</p>
    <component :is="tag ?? 'h2'" class="section-heading__title">
      <slot />
    </component>
    <div v-if="$slots.sub" class="section-heading__sub">
      <slot name="sub" />
    </div>
  </div>
</template>

<style scoped>
.section-heading {
  max-width: 640px;
}

.section-heading--centered {
  margin-inline: auto;
  text-align: center;
}

.section-heading__eyebrow {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}

.section-heading__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  color: var(--color-primary);
}

.section-heading__sub {
  margin-top: var(--space-4);
  font-size: var(--text-lg);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}
</style>
