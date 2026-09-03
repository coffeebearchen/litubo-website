<script setup lang="ts">
const props = defineProps<{ productId: string | number }>()
const route = useRoute()

const tabs = [
  { label: '基础信息', path: `/admin/products/${props.productId}` },
  { label: '页面模块', path: `/admin/products/${props.productId}/content` },
  { label: '技术参数', path: `/admin/products/${props.productId}/specs` },
  { label: '图片与资料', path: `/admin/products/${props.productId}/media` },
  { label: '产品 FAQ', path: `/admin/products/${props.productId}/faq` },
  { label: 'SEO', path: `/admin/products/${props.productId}/seo` },
]

function isActive(path: string) {
  return route.path === path || route.path === path + '/'
}
</script>

<template>
  <nav class="subnav" aria-label="产品编辑导航">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="subnav-tab"
      :class="{ 'subnav-tab--active': isActive(tab.path) }"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.subnav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-line);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  scrollbar-width: none;
}
.subnav::-webkit-scrollbar { display: none; }

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
}
.subnav-tab:hover { color: var(--color-ink); }
.subnav-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}
</style>
