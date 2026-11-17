<script setup lang="ts">
const props = defineProps<{ productId: string | number }>()
const route = useRoute()
const router = useRouter()

/**
 * The seven tabs of the unified product editor, in the order the approved visual master lists them
 * (UI-03): Basics / Content / Specifications / Media / FAQ / SEO / Preview. They are English because
 * the master is, and because the labels name concepts that do not translate cleanly ("Specifications"
 * is not the same thing as "技术参数" once a reader also sees the public product page).
 *
 * Preview is a real page but deliberately not part of the admin layout — it renders the product the
 * way a visitor would see it, so it opens full-screen and offers "Back to Edit".
 */
const tabs = [
  { label: 'Basics', path: `/admin/products/${props.productId}` },
  { label: 'Content', path: `/admin/products/${props.productId}/content` },
  { label: 'Specifications', path: `/admin/products/${props.productId}/specs` },
  { label: 'Media', path: `/admin/products/${props.productId}/media` },
  { label: 'FAQ', path: `/admin/products/${props.productId}/faq` },
  { label: 'SEO', path: `/admin/products/${props.productId}/seo` },
  { label: 'Preview', path: `/admin/products/${props.productId}/preview` },
]

function isActive(path: string) {
  return route.path === path || route.path === path + '/'
}

const currentTab = computed(() => tabs.find(t => isActive(t.path))?.path ?? tabs[0].path)

function onSelectChange(event: Event) {
  router.push((event.target as HTMLSelectElement).value)
}
</script>

<template>
  <!-- 桌面端：横向 tab 栏（tab 溢出时只做局部横滚，不挤压主内容） -->
  <nav class="subnav" aria-label="Product editor navigation">
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

  <!-- 移动端：select 下拉导航（全部 7 个页面可直接选择） -->
  <div class="subnav-mobile">
    <select class="subnav-select" :value="currentTab" @change="onSelectChange">
      <option v-for="tab in tabs" :key="tab.path" :value="tab.path">
        {{ tab.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
/* ── 桌面端 tab 栏 ── */
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

/* ── 移动端 select 导航 ── */
.subnav-mobile { display: none; }
.subnav-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--color-ink);
  min-height: 44px;
  cursor: pointer;
  appearance: auto;
}
.subnav-select:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }

@media (max-width: 720px) {
  .subnav { display: none; }
  .subnav-mobile {
    display: block;
    margin-bottom: var(--space-5);
  }
}
</style>
