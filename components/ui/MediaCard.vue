<script setup lang="ts">
import { resolveComponent } from 'vue'

defineProps<{
  title: string
  subtitle?: string
  tag?: string
  imageSrc?: string
  imageAlt?: string
  to?: string
}>()

const NuxtLink = resolveComponent('NuxtLink')
const imgError = ref(false)
</script>

<template>
  <article class="media-card">
    <component :is="to ? NuxtLink : 'div'" :to="to" class="media-card__inner">
      <div class="media-card__image-wrap">
        <img
          v-if="imageSrc && !imgError"
          :src="imageSrc"
          :alt="imageAlt ?? title"
          class="media-card__image"
          loading="lazy"
          @error="imgError = true"
        >
        <div v-else class="media-card__image-placeholder img-placeholder" aria-hidden="true" />
      </div>
      <div class="media-card__body">
        <p v-if="tag" class="media-card__tag">{{ tag }}</p>
        <h3 class="media-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="media-card__subtitle">{{ subtitle }}</p>
        <span v-if="to" class="media-card__arrow" aria-hidden="true">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>
    </component>
  </article>
</template>

<style scoped>
.media-card {
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
}

.media-card:hover {
  box-shadow: 0 4px 16px rgba(18, 60, 50, 0.12);
}

.media-card__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
  color: inherit;
}

.media-card__image-wrap {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-surface-alt);
}

.media-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.media-card:hover .media-card__image {
  transform: scale(1.03);
}

.media-card__image-placeholder {
  width: 100%;
  height: 100%;
}

.media-card__body {
  padding: var(--space-5);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.media-card__tag {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.media-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  line-height: var(--leading-snug);
}

.media-card__subtitle {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  flex: 1;
}

.media-card__arrow {
  display: flex;
  align-items: center;
  color: var(--color-accent);
  margin-top: var(--space-3);
  transition: transform var(--transition-fast);
}

.media-card:hover .media-card__arrow {
  transform: translateX(4px);
}
</style>
