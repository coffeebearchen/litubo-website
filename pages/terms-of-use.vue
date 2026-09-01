<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useHead({ title: 'Terms of Use — LITUBO', meta: [{ name: 'robots', content: 'noindex' }] })
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('pages.terms.heroTitle') }]" />
        <h1 class="page-hero__title">{{ t('pages.terms.heroTitle') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container prose">
        <p><strong>Last updated:</strong> content pending legal review before publication.</p>
        <p>This page will contain the LITUBO website Terms of Use, including intellectual property rights, limitation of liability, and governing law.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.prose { max-width: 760px; font-size: var(--text-base); color: var(--color-ink); line-height: var(--leading-normal); }
.prose p { margin-bottom: var(--space-5); }
</style>
