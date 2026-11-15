<script setup lang="ts">
interface NavItem {
  label: string
  to: string
}

interface NavSection {
  title: string
  items: NavItem[]
  cta?: { label: string; to: string }
}

interface MenuItem {
  id: string
  label: string
  to: string
  sections: NavSection[]
  menuType?: string
  cta?: { label: string; to: string }
  featured?: unknown
  promo?: unknown
}

const props = defineProps<{
  isOpen: boolean
  navItems: MenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const openSection = ref<string | null>(null)
const panelRef = ref<HTMLElement | null>(null)

function toggleSection(id: string) {
  openSection.value = openSection.value === id ? null : id
}

// Lock body scroll when open
watch(() => props.isOpen, (open: boolean) => {
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
  if (!open) {
    openSection.value = null
  }
})

// Close on Escape
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Transition name="mobile-nav">
    <div
      v-if="isOpen"
      id="mobile-nav"
      ref="panelRef"
      class="mobile-nav"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      @keydown="handleKeydown"
    >
      <!-- Header bar -->
      <div class="mobile-nav__header">
        <NuxtLink
          :to="localePath('/')"
          class="mobile-nav__logo"
          @click="emit('close')"
        >
          LITUBO
        </NuxtLink>
        <button
          class="mobile-nav__close"
          aria-label="Close menu"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- Navigation list -->
      <nav class="mobile-nav__body" aria-label="Mobile navigation">
        <ul class="mobile-nav__list" role="list">
          <li v-for="item in navItems" :key="item.id" class="mobile-nav__item">
            <button
              class="mobile-nav__trigger"
              :aria-expanded="openSection === item.id"
              @click="toggleSection(item.id)"
            >
              {{ item.label }}
              <svg
                class="mobile-nav__chevron"
                :class="{ 'is-open': openSection === item.id }"
                width="16"
                height="10"
                viewBox="0 0 12 7"
                fill="none"
                aria-hidden="true"
              >
                <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>

            <Transition name="accordion">
              <div v-if="openSection === item.id" class="mobile-nav__sub">
                <div v-for="(section, si) in item.sections" :key="si">
                  <ul class="mobile-nav__sub-list" role="list">
                    <li v-for="link in section.items" :key="link.to">
                      <NuxtLink
                        :to="link.to"
                        class="mobile-nav__sub-link"
                        @click="emit('close')"
                      >
                        {{ link.label }}
                      </NuxtLink>
                    </li>
                  </ul>
                </div>
              </div>
            </Transition>
          </li>
        </ul>

        <!-- Bottom actions -->
        <div class="mobile-nav__actions">
          <NuxtLink
            :to="localePath('/contact')"
            class="mobile-nav__action-link"
            @click="emit('close')"
          >
            {{ t('nav.contact') }}
          </NuxtLink>

          <NuxtLink
            :to="localePath('/find-a-distributor')"
            class="btn btn--accent"
            @click="emit('close')"
          >
            {{ t('nav.findDistributor') }}
          </NuxtLink>

          <LanguageSwitch />
        </div>
      </nav>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="mobile-nav-backdrop"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>
</template>

<style scoped>
.mobile-nav {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(360px, 90vw);
  background: var(--color-white);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-nav__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  height: var(--header-height);
  background: var(--color-primary-deep);
  flex-shrink: 0;
}

.mobile-nav__logo {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-transform: uppercase;
}

.mobile-nav__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: rgba(255, 255, 255, 0.85);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.mobile-nav__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-white);
}

.mobile-nav__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-8);
}

.mobile-nav__list {
  border-bottom: 1px solid var(--color-line);
}

.mobile-nav__item {
  border-top: 1px solid var(--color-line);
}

.mobile-nav__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-ink);
  text-align: left;
}

.mobile-nav__chevron {
  flex-shrink: 0;
  color: var(--color-ink-muted);
  transition: transform var(--transition-normal);
}

.mobile-nav__chevron.is-open {
  transform: rotate(180deg);
}

.mobile-nav__sub {
  background: var(--color-canvas);
  border-top: 1px solid var(--color-line);
  padding: var(--space-3) 0;
}

.mobile-nav__sub-list {
  padding: 0;
}

.mobile-nav__sub-link {
  display: block;
  padding: var(--space-3) var(--space-8);
  font-size: var(--text-sm);
  color: var(--color-ink);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.mobile-nav__sub-link:hover {
  color: var(--color-primary);
  background: rgba(47, 107, 58, 0.05);
}

.mobile-nav__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-5);
}

.mobile-nav__action-link {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-ink);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-line);
}

.mobile-nav__action-link:hover {
  color: var(--color-primary);
}

/* Backdrop */
.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 190;
}

/* Transitions */
.mobile-nav-enter-active,
.mobile-nav-leave-active {
  transition: transform var(--transition-normal);
}

.mobile-nav-enter-from,
.mobile-nav-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.accordion-enter-active,
.accordion-leave-active {
  transition: opacity var(--transition-normal);
  overflow: hidden;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
}

/* Btn reset (used in mobile nav actions) */
:deep(.btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
  text-align: center;
}

:deep(.btn--accent) {
  background: var(--color-accent);
  color: var(--color-white);
  border-color: var(--color-accent);
}

:deep(.btn--accent:hover) {
  background: #B87A00;
  border-color: #B87A00;
}
</style>
