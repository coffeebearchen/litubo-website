<script setup lang="ts">
/**
 * Header language selector.
 *
 * Every supported language is listed so the available set is visible at a glance, but only a
 * published locale navigates. A language still in preparation is shown in place and marked as
 * unavailable — the entry never opens a blank page, and never an English page under a translated URL.
 *
 * Position is physical rather than logical: in Arabic the button stays at the physical top-right of
 * the header even though the page content flows RTL.
 */
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const runtimeConfig = useRuntimeConfig()

const publishedLocales = (runtimeConfig.public.publishedLocales as string[] | undefined) ?? ['en']
/** Development-only preview list; empty in a production build. */
const previewLocales = (runtimeConfig.public.previewLocales as string[] | undefined) ?? []

const current = computed(() => locales.value.find(l => l.code === locale.value))
const currentCode = computed(() => locale.value.toUpperCase())

const entries = computed(() => locales.value.map((l) => {
  const code = l.code
  const published = publishedLocales.includes(code)
  // A preview locale opens only in a development build; it is never a published target.
  const preview = !published && previewLocales.includes(code)
  const available = published || preview
  return {
    code,
    name: l.name ?? code,
    available,
    preview,
    current: code === locale.value,
    to: available ? switchLocalePath(code) : '',
  }
}))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) void nextTick(() => trigger.value?.focus())
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close(true)
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="lang-select">
    <button
      ref="trigger"
      type="button"
      class="lang-select__trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="`Language: ${current?.name ?? 'English'}`"
      @click="open = !open"
    >
      <svg class="lang-select__globe" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
        <path d="M3 12h18M12 3c2.5 2.8 2.5 15.2 0 18M12 3c-2.5 2.8-2.5 15.2 0 18" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span class="lang-select__code">{{ currentCode }}</span>
      <svg class="lang-select__chevron" :class="{ 'is-open': open }" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <ul v-show="open" class="lang-select__panel" role="menu" aria-label="Language">
      <li v-for="entry in entries" :key="entry.code" role="none">
        <NuxtLink
          v-if="entry.available"
          :to="entry.to"
          class="lang-select__item"
          :class="{ 'is-current': entry.current }"
          role="menuitem"
          :hreflang="entry.code"
          :lang="entry.code"
          :aria-current="entry.current ? 'true' : undefined"
          @click="close()"
        >
          <span class="lang-select__name">{{ entry.name }}</span>
          <span v-if="entry.preview" class="lang-select__pending">Preview</span>
          <svg v-if="entry.current" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NuxtLink>
        <span
          v-else
          class="lang-select__item lang-select__item--pending"
          role="menuitem"
          :lang="entry.code"
          aria-disabled="true"
        >
          <span class="lang-select__name">{{ entry.name }}</span>
          <span class="lang-select__pending">In preparation</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lang-select {
  position: relative;
  display: flex;
  align-items: center;
}

.lang-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 96px;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.lang-select__trigger:hover { background: #F2F8F4; }
.lang-select__globe { flex: none; color: var(--color-primary); }
.lang-select__code { letter-spacing: 0.02em; }
.lang-select__chevron { flex: none; transition: transform var(--transition-fast); }
.lang-select__chevron.is-open { transform: rotate(180deg); }

/* Right-aligned to the trigger, 8px below it. */
.lang-select__panel {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 120;
  width: 268px;
  margin: 0;
  padding: var(--space-1);
  list-style: none;
  background: var(--color-white);
  border: 1px solid #DAE3DD;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(27, 66, 36, 0.12);
}

.lang-select__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 48px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
  font-size: var(--text-base);
  text-decoration: none;
}
.lang-select__item:hover { background: #F2F8F4; }
.lang-select__item.is-current { color: var(--color-primary); font-weight: 600; }

.lang-select__item--pending {
  color: var(--color-ink-muted);
  cursor: not-allowed;
}
.lang-select__item--pending:hover { background: transparent; }
.lang-select__pending {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  white-space: nowrap;
}
</style>