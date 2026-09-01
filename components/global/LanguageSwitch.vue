<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const runtimeConfig = useRuntimeConfig()

const publishedLocales = runtimeConfig.public.publishedLocales as string[]

const availableLocales = computed(() =>
  locales.value.filter(l => publishedLocales.includes(l.code))
)

</script>

<template>
  <div v-if="availableLocales.length > 1" class="lang-switch">
    <ul class="lang-switch__list" role="list" aria-label="Language">
      <li v-for="loc in availableLocales" :key="loc.code">
        <NuxtLink
          :to="switchLocalePath(loc.code)"
          class="lang-switch__link"
          :class="{ 'is-active': loc.code === locale }"
          :hreflang="loc.code"
          :aria-current="loc.code === locale ? 'true' : undefined"
        >
          {{ loc.code.toUpperCase() }}
        </NuxtLink>
      </li>
    </ul>
  </div>
  <div v-else class="lang-switch lang-switch--single">
    <span class="lang-switch__current">{{ locale.toUpperCase() }}</span>
  </div>
</template>

<style scoped>
.lang-switch {
  display: flex;
  align-items: center;
}

.lang-switch__list {
  display: flex;
  align-items: center;
  gap: 2px;
}

.lang-switch__link {
  display: flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
  letter-spacing: 0.05em;
}

.lang-switch__link:hover,
.lang-switch__link.is-active {
  color: var(--color-white);
  background: rgba(255, 255, 255, 0.1);
}

.lang-switch__link.is-active {
  color: var(--color-accent);
}

.lang-switch--single {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
}
</style>
