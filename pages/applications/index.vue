<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

// PUBLIC-CLAIMS-CLEANUP-01 (D-036): the hub lists the eight confirmed industries (D-002) using the site's own
// navigation labels, so no DEMO fixture is read here. Per-industry pages stay closed until real, confirmed
// content exists (D-014), which is why the cards are presentation only and link nowhere.
const industries = computed(() => [
  t('nav_applications.packaged'),
  t('nav_applications.bottled'),
  t('nav_applications.meat'),
  t('nav_applications.frozen'),
  t('nav_applications.bakery'),
  t('nav_applications.nuts'),
  t('nav_applications.powder'),
  t('nav_applications.pharma'),
])

useSeoHead({
  title: t('seo.applications.title'),
  description: t('seo.applications.description'),
  canonicalPath: '/applications',
})
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.applications') }]" />
        <h1 class="page-hero__title">{{ t('pages.applications.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.applications.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div class="applications-grid">
          <div
            v-for="industry in industries"
            :key="industry"
            class="app-card"
          >
            <div class="app-card__image-wrap">
              <div class="app-card__image-placeholder" aria-hidden="true" />
            </div>
            <div class="app-card__body">
              <h2 class="app-card__title">{{ industry }}</h2>
            </div>
          </div>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('mobile_bar.matching')"
      :secondary-to="localePath('/technical-matching')"
    />
  </div>
</template>

<style scoped>
.page-hero {
  background: var(--color-primary);
  padding: var(--space-12) 0;
  color: var(--color-white);
}

.page-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-4) 0;
}

.page-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.8);
  max-width: 560px;
  line-height: var(--leading-normal);
}

.section-gap { padding: var(--space-16) 0; }

.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-5);
}

.app-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  color: inherit;
}

.app-card__image-wrap {
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
}

.app-card__image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.app-card__body {
  padding: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.app-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  line-height: var(--leading-snug);
}
</style>
