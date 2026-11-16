<script setup lang="ts">
import { useI18n, useLocalePath } from '#imports'

const { t } = useI18n()
const localePath = useLocalePath()

/**
 * Top product-category strip.
 *
 * The five icons are the owner-approved category V1 set (two-colour SVG, viewBox 0 0 48 48),
 * served as static files from /public/images/product-categories. They are category hints, not
 * model drawings or certification marks. Because the category name is always visible inside the
 * link, every icon carries an empty alt so assistive technology announces the name only once.
 */
interface Cat { slug: string; label: string; path: string; icon: string }
const cats: Cat[] = [
  {
    slug: 'xray',
    label: t('nav_products.xray'),
    path: '/products/x-ray-inspection',
    icon: 'x-ray-inspection.svg',
  },
  {
    slug: 'metal',
    label: t('nav_products.metal'),
    path: '/products/metal-detection',
    icon: 'metal-detection.svg',
  },
  {
    slug: 'check',
    label: t('nav_products.checkweighers'),
    path: '/products/checkweighers',
    icon: 'checkweighers.svg',
  },
  {
    slug: 'combo',
    label: t('nav_products.combination'),
    path: '/products/combination-inspection',
    icon: 'combination-inspection.svg',
  },
  {
    slug: 'conveyor',
    label: t('nav_products.conveyors'),
    path: '/products/conveyors-reject-systems',
    icon: 'conveyors-reject-systems.svg',
  }
]
</script>

<template>
  <nav class="cat-strip" aria-label="Product categories">
    <div class="cat-strip__inner container">
      <NuxtLink
        v-for="c in cats"
        :key="c.slug"
        :to="localePath(c.path)"
        class="cat-strip__item"
      >
        <img
          class="cat-strip__icon"
          :src="`/icons/product-categories/${c.icon}`"
          alt=""
          width="26"
          height="26"
          loading="lazy"
          decoding="async"
        >
        <span class="cat-strip__label">{{ c.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.cat-strip {
  background: var(--color-white);
  border-bottom: 1px solid var(--color-line);
}

.cat-strip__inner {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding-block: var(--space-3);
  overflow-x: auto;
  scrollbar-width: none;
}

.cat-strip__inner::-webkit-scrollbar { display: none; }

.cat-strip__item {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  color: var(--color-ink-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  min-width: 104px;
}

.cat-strip__item:hover {
  color: var(--color-primary);
  border-bottom-color: var(--color-accent);
}

.cat-strip__icon {
  display: block;
  width: 26px;
  height: 26px;
  /* Fixed box keeps the strip height identical to the previous inline-SVG version. */
  object-fit: contain;
  transition: transform 160ms ease;
}

/* Hover lifts the glyph 1px only — no scale, no rotation, no looping animation. */
.cat-strip__item:hover .cat-strip__icon {
  transform: translateY(-1px);
}

.cat-strip__label {
  font-size: var(--text-xs);
  line-height: 1.3;
  text-align: center;
}

@media (max-width: 640px) {
  .cat-strip__inner { justify-content: flex-start; }
  .cat-strip__item { min-width: 92px; }
}

@media (prefers-reduced-motion: reduce) {
  .cat-strip__icon { transition: none !important; }
  .cat-strip__item:hover .cat-strip__icon { transform: none; }
}
</style>
