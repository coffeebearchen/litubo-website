<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

const mobileNavOpen = ref(false)
const activeMenu = ref<string | null>(null)
const headerRef = ref<HTMLElement | null>(null)

const navItems = computed(() => [
  {
    id: 'products',
    label: t('nav.products'),
    to: localePath('/products'),
    sections: [
      {
        title: t('nav_products.heading'),
        items: [
          { label: t('nav_products.xray'), to: localePath('/products/x-ray-inspection') },
          { label: t('nav_products.metal'), to: localePath('/products/metal-detection') },
          { label: t('nav_products.checkweighers'), to: localePath('/products/checkweighers') },
          { label: t('nav_products.combination'), to: localePath('/products/combination-inspection') },
          { label: t('nav_products.conveyors'), to: localePath('/products/conveyors-reject-systems') },
        ],
        cta: { label: t('nav_products.viewAll'), to: localePath('/products') },
      },
    ],
  },
  {
    id: 'applications',
    label: t('nav.applications'),
    to: localePath('/applications'),
    sections: [
      {
        title: t('nav_applications.heading'),
        items: [
          { label: t('nav_applications.packaged'), to: localePath('/applications/packaged-food') },
          { label: t('nav_applications.bottled'), to: localePath('/applications/bottled-canned-products') },
          { label: t('nav_applications.meat'), to: localePath('/applications/meat-seafood') },
          { label: t('nav_applications.frozen'), to: localePath('/applications/frozen-food') },
          { label: t('nav_applications.bakery'), to: localePath('/applications/bakery-snacks') },
          { label: t('nav_applications.nuts'), to: localePath('/applications/nuts-seeds-dried-food') },
          { label: t('nav_applications.powder'), to: localePath('/applications/powder-granules') },
          { label: t('nav_applications.pharma'), to: localePath('/applications/pharmaceutical-daily-chemical') },
        ],
        cta: { label: t('nav_applications.viewAll'), to: localePath('/applications') },
      },
    ],
  },
  {
    id: 'resources',
    label: t('nav.resources'),
    to: localePath('/resources'),
    sections: [
      {
        title: t('nav_resources.heading'),
        items: [
          { label: t('nav_resources.insights'), to: localePath('/resources') + '#insights' },
          { label: t('nav_resources.caseStudies'), to: localePath('/resources') + '#case-studies' },
          { label: t('nav_resources.downloads'), to: localePath('/resources/downloads') },
          { label: t('nav_resources.videos'), to: localePath('/resources/videos') },
        ],
        cta: { label: t('nav_resources.viewAll'), to: localePath('/resources') },
      },
    ],
  },
  {
    id: 'support',
    label: t('nav.support'),
    to: localePath('/support'),
    sections: [
      {
        title: t('nav_support.heading'),
        items: [
          { label: t('nav_support.overview'), to: localePath('/support') },
          { label: t('nav_support.faq'), to: localePath('/support/faq') },
          { label: t('nav_support.spareParts'), to: localePath('/support/request-spare-parts') },
          { label: t('nav_support.productTest'), to: localePath('/support/send-product-test') },
          { label: t('nav_support.techSupport'), to: localePath('/support/technical-support') },
          { label: t('nav_support.manualRequest'), to: localePath('/support/manual-request') },
          { label: t('nav_support.serviceTraining'), to: localePath('/support/service-training') },
        ],
      },
    ],
  },
  {
    id: 'company',
    label: t('nav.company'),
    to: localePath('/company/about'),
    sections: [
      {
        title: t('nav_company.heading'),
        items: [
          { label: t('nav_company.about'), to: localePath('/company/about') },
          { label: t('nav_company.quality'), to: localePath('/company/quality-manufacturing') },
          { label: t('nav_company.globalService'), to: localePath('/company/global-service') },
          { label: t('nav_company.partner'), to: localePath('/company/become-a-partner') },
        ],
      },
    ],
  },
])

function openMenu(id: string) {
  activeMenu.value = id
}

function closeMenu() {
  activeMenu.value = null
}

function toggleMenu(id: string) {
  activeMenu.value = activeMenu.value === id ? null : id
}

function handleKeydown(e: KeyboardEvent, id: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleMenu(id)
  }
  if (e.key === 'Escape') {
    closeMenu()
  }
}

// Close mega menu on route change
watch(() => route.fullPath, () => {
  closeMenu()
  mobileNavOpen.value = false
})

// Close on outside click
function handleOutsideClick(e: MouseEvent) {
  if (headerRef.value && !headerRef.value.contains(e.target as Node)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<template>
  <header ref="headerRef" class="site-header" role="banner">
    <div class="site-header__container container">
      <!-- Logo -->
      <NuxtLink :to="localePath('/')" class="site-header__logo" aria-label="LITUBO — Home">
        <span class="logo-text">LITUBO</span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="site-header__nav" aria-label="Main navigation">
        <ul class="site-header__nav-list" role="list">
          <li
            v-for="item in navItems"
            :key="item.id"
            class="site-header__nav-item"
            @mouseenter="openMenu(item.id)"
            @mouseleave="closeMenu"
          >
            <button
              class="site-header__nav-link"
              :class="{ 'is-active': activeMenu === item.id }"
              :aria-expanded="activeMenu === item.id"
              aria-haspopup="true"
              @click="toggleMenu(item.id)"
              @keydown="handleKeydown($event, item.id)"
            >
              {{ item.label }}
              <svg class="site-header__chevron" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <MegaMenu
              :sections="item.sections"
              :is-open="activeMenu === item.id"
              @close="closeMenu"
            />
          </li>
        </ul>
      </nav>

      <!-- Actions -->
      <div class="site-header__actions">
        <NuxtLink
          :to="localePath('/contact')"
          class="site-header__contact-link"
        >
          {{ t('nav.contact') }}
        </NuxtLink>

        <LanguageSwitch />

        <NuxtLink
          :to="localePath('/find-a-distributor')"
          class="btn btn--accent btn--sm"
        >
          {{ t('nav.findDistributor') }}
        </NuxtLink>
      </div>

      <!-- Mobile hamburger -->
      <button
        class="site-header__hamburger"
        :aria-expanded="mobileNavOpen"
        aria-controls="mobile-nav"
        :aria-label="mobileNavOpen ? 'Close menu' : 'Open menu'"
        @click="mobileNavOpen = !mobileNavOpen"
      >
        <span class="hamburger-line" />
        <span class="hamburger-line" />
        <span class="hamburger-line" />
      </button>
    </div>

    <!-- Mega menu overlay backdrop -->
    <div
      v-if="activeMenu"
      class="mega-menu-backdrop"
      aria-hidden="true"
      @click="closeMenu"
    />
  </header>

  <!-- Mobile nav rendered outside header so it overlays full page -->
  <MobileNav
    :is-open="mobileNavOpen"
    :nav-items="navItems"
    @close="mobileNavOpen = false"
  />
</template>

<style scoped>
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--header-height);
  background: var(--color-primary-deep);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.site-header__container {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: 100%;
}

/* Logo */
.site-header__logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo-text {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-transform: uppercase;
}

/* Desktop nav */
.site-header__nav {
  flex: 1;
}

.site-header__nav-list {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.site-header__nav-item {
  position: static;
}

.site-header__nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;
}

.site-header__nav-link:hover,
.site-header__nav-link.is-active {
  color: var(--color-white);
  background: rgba(255, 255, 255, 0.08);
}

.site-header__chevron {
  transition: transform var(--transition-fast);
}

.site-header__nav-link.is-active .site-header__chevron {
  transform: rotate(180deg);
}

/* Actions */
.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.site-header__contact-link {
  font-size: var(--text-sm);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.site-header__contact-link:hover {
  color: var(--color-white);
  background: rgba(255, 255, 255, 0.08);
}

/* Hamburger */
.site-header__hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: var(--space-2);
  flex-shrink: 0;
}

.hamburger-line {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-white);
  border-radius: 1px;
  transition: transform var(--transition-normal), opacity var(--transition-fast);
}

/* Backdrop */
.mega-menu-backdrop {
  position: fixed;
  inset: var(--header-height) 0 0 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 90;
}

/* Buttons (global, defined here for use across header) */
:deep(.btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
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

:deep(.btn--sm) {
  padding: var(--space-1) var(--space-4);
  font-size: var(--text-xs);
}

/* Responsive */
@media (max-width: 1023px) {
  .site-header__nav,
  .site-header__actions {
    display: none;
  }

  .site-header__hamburger {
    display: flex;
    margin-left: auto;
  }
}
</style>
