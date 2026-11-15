<script setup lang="ts">
import { useI18n, useLocalePath } from '#imports'

const { t } = useI18n()
const localePath = useLocalePath()

interface Cat { slug: string; label: string; path: string; d: string }
const cats: Cat[] = [
  {
    slug: 'xray',
    label: t('nav_products.xray'),
    path: '/products/x-ray-inspection',
    d: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8z',
  },
  {
    slug: 'metal',
    label: t('nav_products.metal'),
    path: '/products/metal-detection',
    d: 'M5 15a5 5 0 0110 0v3H9v-3a5 5 0 0110 0',
  },
  {
    slug: 'check',
    label: t('nav_products.checkweighers'),
    path: '/products/checkweighers',
    d: 'M12 4v16M5 20h14M7 9l5-5 5 5',
  },
  {
    slug: 'combo',
    label: t('nav_products.combination'),
    path: '/products/combination-inspection',
    d: 'M9 7a5 5 0 100 10 5 5 0 000-10zm6 0a5 5 0 100 10 5 5 0 000-10z',
  },
  {
    slug: 'conveyor',
    label: t('nav_products.conveyors'),
    path: '/products/conveyors-reject-systems',
    d: 'M3 9h13l3 3-3 3H3zM3 15h3',
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
        <svg class="cat-strip__icon" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path :d="c.d" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
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
  color: var(--color-primary);
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
</style>
