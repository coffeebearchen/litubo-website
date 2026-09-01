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

defineProps<{
  sections: NavSection[]
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <Transition name="mega-menu">
    <div
      v-if="isOpen"
      class="mega-menu"
      role="region"
      @keydown="handleKeydown"
    >
      <div class="mega-menu__container container">
        <div
          v-for="(section, si) in sections"
          :key="si"
          class="mega-menu__section"
        >
          <p class="mega-menu__section-title">{{ section.title }}</p>
          <ul class="mega-menu__list" role="list">
            <li v-for="item in section.items" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="mega-menu__link"
                @click="emit('close')"
              >
                <svg class="mega-menu__arrow" width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                  <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
          <NuxtLink
            v-if="section.cta"
            :to="section.cta.to"
            class="mega-menu__cta"
            @click="emit('close')"
          >
            {{ section.cta.label }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mega-menu {
  position: fixed;
  top: var(--header-height);
  left: 0;
  right: 0;
  z-index: 95;
  background: var(--color-white);
  border-top: 2px solid var(--color-accent);
  box-shadow: var(--shadow-menu);
  padding: var(--space-8) 0;
}

.mega-menu__container {
  display: flex;
  gap: var(--space-12);
}

.mega-menu__section {
  min-width: 180px;
}

.mega-menu__section-title {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  margin-bottom: var(--space-4);
}

.mega-menu__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mega-menu__link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: var(--text-sm);
  font-weight: 400;
  color: var(--color-ink);
  transition: color var(--transition-fast);
}

.mega-menu__link:hover {
  color: var(--color-primary);
}

.mega-menu__link:hover .mega-menu__arrow {
  transform: translateX(3px);
}

.mega-menu__arrow {
  flex-shrink: 0;
  color: var(--color-accent);
  transition: transform var(--transition-fast);
}

.mega-menu__cta {
  display: inline-block;
  margin-top: var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-primary);
  padding-bottom: 2px;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.mega-menu__cta:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* Transition */
.mega-menu-enter-active,
.mega-menu-leave-active {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
}

.mega-menu-enter-from,
.mega-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
