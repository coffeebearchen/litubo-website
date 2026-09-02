<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.support.title'), description: t('seo.support.description'), canonicalPath: '/support' })
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.support') }]" />
        <h1 class="page-hero__title">{{ t('pages.support.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.support.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div class="support-grid">
          <NuxtLink :to="localePath('/support/faq')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.faq') }}</h2>
            <p class="support-card__body">Frequently asked questions about our systems.</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/request-spare-parts')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.spareParts') }}</h2>
            <p class="support-card__body">Submit a spare parts inquiry with model and serial number.</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/send-product-test')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.productTest') }}</h2>
            <p class="support-card__body">Send a product sample to our application lab for testing.</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/technical-support')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.techSupport') }}</h2>
            <p class="support-card__body">Report an issue and request technical assistance.</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/manual-request')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.manualRequest') }}</h2>
            <p class="support-card__body">Request a manual or technical document for your machine.</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/service-training')" class="support-card">
            <h2 class="support-card__title">{{ t('nav_support.serviceTraining') }}</h2>
            <p class="support-card__body">Arrange a service visit or operator training session.</p>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.page-hero__sub { font-size: var(--text-lg); color: rgba(255,255,255,0.8); max-width: 560px; line-height: var(--leading-normal); }
.section-gap { padding: var(--space-16) 0; }
.support-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-5); }
.support-card { display: block; padding: var(--space-6); background: var(--color-white); border: 1px solid var(--color-line); border-radius: var(--radius-sm); box-shadow: var(--shadow-card); text-decoration: none; transition: box-shadow var(--transition-normal); }
.support-card:hover { box-shadow: 0 4px 16px rgba(18,60,50,0.12); }
.support-card__title { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 600; color: var(--color-primary); margin-bottom: var(--space-2); }
.support-card__body { font-size: var(--text-sm); color: var(--color-ink-muted); line-height: var(--leading-normal); }
</style>
