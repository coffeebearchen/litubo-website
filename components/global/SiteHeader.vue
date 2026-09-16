<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

const mobileNavOpen = ref(false)
const activeMenu = ref<string | null>(null)
const headerRef = ref<HTMLElement | null>(null)

interface NavLink { label: string; to: string }
interface NavSection { title: string; items: NavLink[]; cta?: NavLink }
interface NavItem {
  id: string
  label: string
  to: string
  menuType: 'products' | 'applications' | 'resources' | 'support' | 'company'
  sections: NavSection[]
  cta?: NavLink
  featured?: { title: string; to: string }
  promo?: { title: string; body: string; cta: NavLink }
}

const navItems = computed<NavItem[]>(() => [
  {
    id: 'products',
    label: t('nav.products'),
    to: localePath('/products'),
    menuType: 'products',
    sections: [
      {
        title: t('nav_products.systemsHeading'),
        items: [
          { label: t('nav_products.xray'), to: localePath('/products/x-ray-inspection') },
          { label: t('nav_products.metal'), to: localePath('/products/metal-detection') },
          { label: t('nav_products.checkweighers'), to: localePath('/products/checkweighers') },
          { label: t('nav_products.combination'), to: localePath('/products/combination-inspection') },
          { label: t('nav_products.conveyors'), to: localePath('/products/conveyors-reject-systems') },
        ],
      },
      {
        title: t('nav_products.techHeading'),
        items: [
          { label: t('nav_products.xrayTech'), to: localePath('/products/x-ray-inspection') },
          { label: t('nav_products.metalTech'), to: localePath('/products/metal-detection') },
          { label: t('nav_products.checkTech'), to: localePath('/products/checkweighers') },
        ],
      },
      {
        title: t('nav_products.appHeading'),
        items: [
          { label: t('nav_applications.packaged'), to: localePath('/applications') },
          { label: t('nav_applications.meat'), to: localePath('/applications') },
          { label: t('nav_applications.frozen'), to: localePath('/applications') },
          { label: t('nav_applications.bakery'), to: localePath('/applications') },
        ],
      },
    ],
    cta: { label: t('nav_products.exploreAll'), to: localePath('/products') },
  },
  {
    id: 'applications',
    label: t('nav.applications'),
    to: localePath('/applications'),
    menuType: 'applications',
    sections: [
      {
        title: t('nav_applications.heading'),
        items: [
          { label: t('nav_applications.packaged'), to: localePath('/applications') },
          { label: t('nav_applications.bottled'), to: localePath('/applications') },
          { label: t('nav_applications.meat'), to: localePath('/applications') },
          { label: t('nav_applications.frozen'), to: localePath('/applications') },
          { label: t('nav_applications.bakery'), to: localePath('/applications') },
          { label: t('nav_applications.nuts'), to: localePath('/applications') },
          { label: t('nav_applications.powder'), to: localePath('/applications') },
        ],
      },
    ],
    cta: { label: t('nav_applications.viewAll'), to: localePath('/applications') },
  },
  {
    id: 'resources',
    label: t('nav.resources'),
    to: localePath('/resources'),
    menuType: 'resources',
    sections: [
      {
        title: t('nav_resources.heading'),
        items: [
          { label: t('nav_resources.overview'), to: localePath('/resources') },
          { label: t('nav_resources.insights'), to: localePath('/resources') },
          { label: t('nav_resources.caseStudies'), to: localePath('/resources') },
          { label: t('nav_resources.downloads'), to: localePath('/resources/downloads') },
          { label: t('nav_resources.videos'), to: localePath('/resources/videos') },
        ],
      },
    ],
    featured: {
      title: t('nav_resources.featuredTitle'),
      to: localePath('/resources'),
    },
  },
  {
    id: 'support',
    label: t('nav.support'),
    to: localePath('/support'),
    menuType: 'support',
    sections: [
      {
        title: t('nav_support.directHeading'),
        items: [
          { label: t('nav_support.techSupport'), to: localePath('/support/technical-support') },
          { label: t('nav_support.manualRequest'), to: localePath('/support/manual-request') },
          { label: t('nav_support.spareParts'), to: localePath('/support/request-spare-parts') },
          { label: t('nav_support.serviceTraining'), to: localePath('/support/service-training') },
          { label: t('nav_support.productTest'), to: localePath('/support/send-product-test') },
        ],
        cta: { label: t('nav_support.overview'), to: localePath('/support') },
      },
      {
        title: t('nav_support.docsHeading'),
        items: [
          { label: t('nav_support.techDocs'), to: localePath('/support') },
          { label: t('nav_support.faq'), to: localePath('/support/faq') },
        ],
      },
    ],
  },
  {
    id: 'company',
    label: t('nav.company'),
    to: localePath('/company/about'),
    menuType: 'company',
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
    promo: {
      title: t('nav_company.promoTitle'),
      body: t('nav_company.promoBody'),
      cta: { label: t('nav_company.about'), to: localePath('/company/about') },
    },
  },
])

function openMenu(id: string) { activeMenu.value = id }
function closeMenu() { activeMenu.value = null }
function toggleMenu(id: string) { activeMenu.value = activeMenu.value === id ? null : id }

function handleKeydown(e: KeyboardEvent, id: string) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(id) }
  if (e.key === 'Escape') { closeMenu() }
}

watch(() => route.fullPath, () => {
  closeMenu()
  mobileNavOpen.value = false
})

function handleOutsideClick(e: MouseEvent) {
  if (headerRef.value && !headerRef.value.contains(e.target as Node)) closeMenu()
}

onMounted(() => { document.addEventListener('click', handleOutsideClick) })
onUnmounted(() => { document.removeEventListener('click', handleOutsideClick) })
</script>

<template>
  <header ref="headerRef" class="site-header" role="banner">
    <div class="site-header__container container">
      <!-- Logo -->
      <NuxtLink :to="localePath('/')" class="site-header__logo" aria-label="LITUBO — Home">
        <span class="logo-wordmark">LITUBO</span>
        <span class="logo-divider" aria-hidden="true" />
        <span class="logo-tagline">Food &amp; Packaging<br>Inspection Solutions</span>
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
              <svg class="site-header__chevron" :class="{ 'is-open': activeMenu === item.id }" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <MegaMenu
              :item="item"
              :is-open="activeMenu === item.id"
              @close="closeMenu"
            />
          </li>
        </ul>
      </nav>

      <!-- Actions -->
      <div class="site-header__actions">
        <NuxtLink :to="localePath('/contact')" class="site-header__contact-link">
          {{ t('nav.contact') }}
        </NuxtLink>
        <LanguageSwitch />
        <NuxtLink :to="localePath('/find-a-distributor')" class="site-header__cta-btn">
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

    <!-- Mega menu backdrop -->
    <div
      v-if="activeMenu"
      class="mega-menu-backdrop"
      aria-hidden="true"
      @click="closeMenu"
    />
  </header>

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
  background: var(--color-white);
  border-bottom: 1px solid var(--color-line);
  box-shadow: 0 1px 4px rgba(18, 60, 50, 0.06);
}

.site-header__container {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: 100%;
}

/* ── Logo ─────────────────────────────────────────── */
.site-header__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  text-decoration: none;
}

.logo-wordmark {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
}

.logo-divider {
  display: block;
  width: 1px;
  height: 30px;
  background: var(--color-line);
  flex-shrink: 0;
}

.logo-tagline {
  font-family: var(--font-body);
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--color-ink-muted);
  font-weight: 400;
  white-space: nowrap;
}

/* ── Desktop nav ──────────────────────────────────── */
.site-header__nav { flex: 1; }

.site-header__nav-list {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.site-header__nav-item { position: static; }

.site-header__nav-link {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink);
  white-space: nowrap;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), box-shadow var(--transition-fast);
  box-shadow: inset 0 -2px 0 transparent;
}

.site-header__nav-link:hover {
  color: var(--color-primary);
  box-shadow: inset 0 -2px 0 var(--color-accent);
}

.site-header__nav-link.is-active {
  color: var(--color-primary);
  box-shadow: inset 0 -2px 0 var(--color-accent);
}

.site-header__chevron {
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.site-header__chevron.is-open {
  transform: rotate(180deg);
}

/* ── Actions ──────────────────────────────────────── */
.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.site-header__contact-link {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-2);
  transition: color var(--transition-fast);
  white-space: nowrap;
}

.site-header__contact-link:hover {
  color: var(--color-primary);
}

.site-header__cta-btn {
  display: inline-flex;
  align-items: center;
  padding: 7px var(--space-4);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
}

.site-header__cta-btn:hover {
  background: var(--color-accent);
  color: var(--color-white);
}

/* ── Hamburger ────────────────────────────────────── */
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
  background: var(--color-ink);
  border-radius: 1px;
  transition: transform var(--transition-normal), opacity var(--transition-fast);
}

/* ── Backdrop ─────────────────────────────────────── */
.mega-menu-backdrop {
  position: fixed;
  inset: var(--header-height) 0 0 0;
  background: rgba(0, 0, 0, 0.25);
  z-index: 90;
}

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 1023px) {
  .site-header__nav,
  .site-header__actions {
    display: none;
  }
  .site-header__hamburger {
    display: flex;
    margin-left: auto;
  }
  .logo-divider,
  .logo-tagline {
    display: none;
  }
}
</style>
