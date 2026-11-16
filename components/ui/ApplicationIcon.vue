<script setup lang="ts">
/**
 * Application industry icon — the eight owner-approved line glyphs, delivered as standalone SVG
 * files in /public/icons/applications.
 *
 * The artwork comes from the approved Scheme-C prototype (24×24 geometry), restyled to the same
 * leaf-green + gold, round-cap language as the product-category icons. It is an industry hint only:
 * it is not a product drawing or a certification mark. The industry name always sits next to it, so
 * the image is decorative and carries an empty alt.
 *
 * The slug whitelist is fixed in code: no CMS-supplied SVG or HTML is accepted.
 */
const props = defineProps<{ slug: string }>()

const KNOWN = new Set([
  'packaged-food',
  'bottled-canned-products',
  'meat-seafood',
  'frozen-food',
  'bakery-snacks',
  'nuts-seeds-dried-food',
  'powder-granules',
  'pharmaceutical-daily-chemical',
])

const known = computed(() => KNOWN.has(props.slug))
</script>

<template>
  <span v-if="known" class="app-icon">
    <img
      class="app-icon__glyph"
      :src="`/icons/applications/${slug}.svg`"
      alt=""
      width="30"
      height="30"
      loading="lazy"
      decoding="async"
    >
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
  transition: background 220ms, border-color 220ms;
}
.app-icon__glyph {
  display: block;
  width: 30px;
  height: 30px;
  object-fit: contain;
}
</style>
