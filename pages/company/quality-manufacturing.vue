<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.quality.title'), description: t('seo.quality.description'), canonicalPath: '/company/quality-manufacturing' })

// FINAL-RELEASE-FIX-D (P1-05): this page states only what the project can support. Certification and compliance
// claims, facility and process details, and construction notes were removed: the repository holds no business
// confirmation or verified material for them (CLAUDE.md, D-008). Certificates belong in Resources > Downloads (D-003).
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="qm-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.quality') }]" />
        <h1 class="qm-hero__title">{{ t('pages.quality.heroTitle') }}</h1>
        <p class="qm-hero__sub">Our design and manufacturing processes are engineered to produce reliable, high-performance inspection systems.</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <p class="body-text">For technical specifications relevant to a specific product, please <NuxtLink :to="localePath('/contact')">contact our team</NuxtLink>.</p>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
    />
  </div>
</template>

<style scoped>
.qm-hero {
  background: var(--color-primary-deep);
  padding: var(--space-16) 0 var(--space-12);
  color: var(--color-white);
}

.qm-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-4) 0;
}

.qm-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 580px;
  line-height: var(--leading-normal);
}

.section-gap  { padding: var(--space-16) 0; }

.body-text {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

.body-text a {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
