<script setup lang="ts">
/**
 * Local company navigation, shared by the four Company pages.
 *
 * The design places it directly under the hero: the four pages are one section, and moving between
 * them should not require the main menu. The current route is underlined.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const items = [
  { label: t('nav_company.about'), to: '/company/about' },
  { label: t('nav_company.quality'), to: '/company/quality-manufacturing' },
  { label: t('nav_company.globalService'), to: '/company/global-service' },
  { label: t('nav_company.partner'), to: '/company/become-a-partner' },
]

function isActive(to: string): boolean {
  return localePath(to) === route.path
}
</script>

<template>
  <nav class="company-nav" aria-label="Company">
    <div class="container company-nav__inner">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="localePath(item.to)"
        class="company-nav__item"
        :class="{ 'is-active': isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.company-nav {
  border-bottom: 1px solid #DAE3DD;
  background: #fff;
}
.company-nav__inner {
  display: flex;
  gap: 34px;
  padding-block: 17px;
  overflow-x: auto;
  scrollbar-width: none;
}
.company-nav__inner::-webkit-scrollbar { display: none; }
.company-nav__item {
  font-size: 16px;
  color: var(--color-ink-muted);
  text-decoration: none;
  padding-bottom: 6px;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.company-nav__item:hover { color: var(--color-primary); }
.company-nav__item.is-active {
  color: var(--color-ink);
  border-bottom-color: var(--color-primary);
}

@media (max-width: 700px) {
  .company-nav__inner { gap: 24px; padding-block: 15px; }
  .company-nav__item { font-size: 15px; }
}
</style>
