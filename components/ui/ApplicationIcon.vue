<script setup lang="ts">
/**
 * Fixed local icon whitelist for the eight application industries.
 *
 * These are industry identifiers, not product constructions or certification marks, so they are
 * deliberately hard-coded in the repo: no CMS-supplied SVG/HTML is accepted, and no paid icon
 * service is involved. The name is always rendered next to the icon, so the icon is aria-hidden.
 */
const props = defineProps<{ slug: string }>()

const ICONS: Readonly<Record<string, string>> = {
  'packaged-food': 'M4 7h16v14H4zM4 7l4-4h8l4 4M12 7v14M9 3l-2 4',
  'bottled-canned-products': 'M9 2h6v4l2 3v12H7V9l2-3V2zm-2 11h10M9 5h6',
  'meat-seafood': 'M4 12c4-6 10-6 14 0-4 6-10 6-14 0zm0 0L1 8v8l3-4zm10-1h.01',
  'frozen-food': 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4',
  'bakery-snacks': 'M5 20V9C0 8 2 3 6 4c2-3 10-3 12 0 4-1 6 4 1 5v11H5zm4-11v5m6-5v5M5 17h14',
  'nuts-seeds-dried-food': 'M12 4c5 0 8 4 8 8s-3 8-8 8-8-4-8-8 3-8 8-8zm0 0c-4 4-4 12 0 16m0-16c4 4 4 12 0 16M9 4l3-2 3 2',
  'powder-granules': 'M4 3h16l-5 7v4l-6 3v-7L4 3zm4 17h.01m4-1h.01m5-1h.01m-1 4h.01m-5 0h.01',
  'pharmaceutical-daily-chemical': 'M8 4a5 5 0 017 7l-4 5a5 5 0 01-7-7l4-5zm-2 3l8 7M17 3v5m-2-2h5',
}

const path = computed(() => ICONS[props.slug] ?? null)
</script>

<template>
  <span v-if="path" class="app-icon" aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      stroke-width="1.45"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path :d="path" />
    </svg>
  </span>
</template>

<style scoped>
.app-icon {
  flex: none;
  width: 44px;
  height: 44px;
  background: #FBF5E9;
  border: 1px solid #E4D3AF;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #956A22;
  transition: background 220ms, border-color 220ms;
}
</style>
