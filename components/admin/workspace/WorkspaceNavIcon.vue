<script setup lang="ts">
defineProps<{
  moduleKey: string
}>()
</script>

<template>
  <svg class="ws-nav-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="moduleKey === 'overview'">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 13h5M9.5 16.5h5" />
    </template>
    <template v-else-if="moduleKey === 'page-content'">
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 8.5h17" />
      <path d="M7 12h4M7 15h7" />
    </template>
    <template v-else-if="moduleKey === 'specifications'">
      <path d="M4 6h2M4 12h2M4 18h2" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </template>
    <template v-else-if="moduleKey === 'media-resources'">
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M20.5 15L15 10 6 19" />
    </template>
    <template v-else-if="moduleKey === 'relations'">
      <circle cx="7" cy="12" r="3.5" />
      <circle cx="17" cy="12" r="3.5" />
    </template>
    <template v-else-if="moduleKey === 'seo-locales'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.3 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.3-3.8-8.5S9.5 5.8 12 3.5Z" />
    </template>
    <template v-else-if="moduleKey === 'share-distribution'">
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8 10.8L16 7M8 13.2L16 17" />
    </template>
    <template v-else-if="moduleKey === 'sources-evidence'">
      <path d="M12 3.5l7 3v5.2c0 4.6-3 7.8-7 8.8-4-1-7-4.2-7-8.8V6.5l7-3Z" />
    </template>
    <template v-else-if="moduleKey === 'change-history'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
  </svg>
</template>

<style scoped>
.ws-nav-icon { flex-shrink: 0; }
</style>
