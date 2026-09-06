<script setup lang="ts">
const route = useRoute()
const isCategoriesActive = computed(() => route.path === '/admin/products/categories')
</script>

<template>
  <nav class="catalogue-nav" aria-label="Product Centre navigation">
    <!-- Desktop tabs -->
    <NuxtLink
      to="/admin/products"
      class="subnav-tab"
      :class="{ 'subnav-tab--active': !isCategoriesActive }"
    >
      All Products
    </NuxtLink>
    <NuxtLink
      to="/admin/products/categories"
      class="subnav-tab"
      :class="{ 'subnav-tab--active': isCategoriesActive }"
    >
      Categories
    </NuxtLink>
  </nav>
</template>

<style scoped>
.catalogue-nav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-line);
  margin-bottom: var(--space-5);
  overflow-x: auto;
  scrollbar-width: none;
}
.catalogue-nav::-webkit-scrollbar { display: none; }

.subnav-tab {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.subnav-tab:hover { color: var(--color-ink); }
.subnav-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}
</style>
