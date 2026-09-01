<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useHead({ title: `Downloads — LITUBO`, meta: [{ name: 'description', content: 'Product datasheets, manuals, certificates and catalogs.' }] })
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources'), to: localePath('/resources') }, { label: t('nav_resources.downloads') }]" />
        <h1 class="page-hero__title">{{ t('nav_resources.downloads') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container content-placeholder">
        <p>Download assets are being prepared. <NuxtLink :to="localePath('/contact')">Contact us</NuxtLink> to request a specific document.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.content-placeholder { font-size: var(--text-base); color: var(--color-ink-muted); }
.content-placeholder a { color: var(--color-primary); text-decoration: underline; }
</style>
