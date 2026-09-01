<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const applications = useApplications()

useHead({
  title: t('seo.applications.title'),
  meta: [{ name: 'description', content: t('seo.applications.description') }],
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
          <NuxtLink
            v-for="app in applications"
            :key="app.slug"
            :to="localePath(`/applications/${app.slug}`)"
            class="app-card"
          >
            <div class="app-card__image-wrap">
              <img
                v-if="app.heroMedia.url"
                :src="app.heroMedia.url"
                :alt="app.heroMedia.alt.en"
                class="app-card__image"
                loading="lazy"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              >
              <div class="app-card__image-placeholder" aria-hidden="true" />
            </div>
            <div class="app-card__body">
              <h2 class="app-card__title">{{ app.title.en }}</h2>
              <span class="app-card__arrow" aria-hidden="true">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </div>
          </NuxtLink>
        </div>
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
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-normal);
}

.app-card:hover {
  box-shadow: 0 4px 16px rgba(18, 60, 50, 0.12);
}

.app-card__image-wrap {
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
}

.app-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.app-card:hover .app-card__image {
  transform: scale(1.03);
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

.app-card__arrow {
  color: var(--color-accent);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.app-card:hover .app-card__arrow {
  transform: translateX(4px);
}
</style>
