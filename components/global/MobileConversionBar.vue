<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const contact = useContactInfo()

const isMatchingPage = computed(() =>
  route.path === '/technical-matching'
  || route.path.endsWith('/technical-matching'),
)
</script>

<template>
  <nav class="mobile-cbar" aria-label="Quick contact">
    <a
      :href="contact.whatsappHref"
      class="mobile-cbar__btn mobile-cbar__btn--whatsapp"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('mobile_bar.whatsapp')"
    >
      <!-- WhatsApp icon -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.138.563 4.14 1.541 5.871L.057 23.97l6.284-1.648A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.91 0-3.69-.513-5.213-1.405l-.374-.222-3.883 1.018 1.035-3.783-.243-.39A9.793 9.793 0 012.182 12C2.182 6.557 6.557 2.182 12 2.182S21.818 6.557 21.818 12 17.443 21.818 12 21.818z" />
      </svg>
      <span>{{ t('mobile_bar.whatsapp') }}</span>
    </a>

    <NuxtLink
      v-if="!isMatchingPage"
      :to="localePath('/technical-matching')"
      class="mobile-cbar__btn mobile-cbar__btn--matching"
      :aria-label="t('mobile_bar.matching')"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <span>{{ t('mobile_bar.matching') }}</span>
    </NuxtLink>

    <!-- On matching page: show contact instead -->
    <NuxtLink
      v-else
      :to="localePath('/contact')"
      class="mobile-cbar__btn mobile-cbar__btn--matching"
      :aria-label="t('nav.contact')"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      <span>{{ t('nav.contact') }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.mobile-cbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 150;
  display: flex;
  align-items: stretch;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--color-white);
  border-top: 1px solid var(--color-line);
  box-shadow: 0 -2px 12px rgba(27, 66, 36, 0.08);
}

.mobile-cbar__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  transition: background var(--transition-fast);
  min-width: 0;
}

.mobile-cbar__btn--whatsapp {
  background: #25D366;
  color: var(--color-white);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.mobile-cbar__btn--whatsapp:hover,
.mobile-cbar__btn--whatsapp:active {
  background: #1eb858;
}

.mobile-cbar__btn--matching {
  background: var(--color-primary);
  color: var(--color-white);
}

.mobile-cbar__btn--matching:hover,
.mobile-cbar__btn--matching:active {
  background: var(--color-primary-deep);
}

/* Only show on mobile */
@media (min-width: 1024px) {
  .mobile-cbar {
    display: none;
  }
}
</style>
