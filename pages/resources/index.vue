<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('seo.resources.title'),
  meta: [{ name: 'description', content: t('seo.resources.description') }],
})
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources') }]" />
        <h1 class="page-hero__title">{{ t('pages.resources.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.resources.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div class="resource-categories">
          <NuxtLink id="insights" :to="localePath('/resources') + '#insights'" class="resource-category-card">
            <h2 class="resource-category-card__title">{{ t('nav_resources.insights') }}</h2>
            <p class="resource-category-card__body">Technical articles and whitepapers</p>
          </NuxtLink>
          <NuxtLink id="case-studies" :to="localePath('/resources') + '#case-studies'" class="resource-category-card">
            <h2 class="resource-category-card__title">{{ t('nav_resources.caseStudies') }}</h2>
            <p class="resource-category-card__body">Real-world deployment stories</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/resources/downloads')" class="resource-category-card">
            <h2 class="resource-category-card__title">{{ t('nav_resources.downloads') }}</h2>
            <p class="resource-category-card__body">Datasheets, manuals and certificates</p>
          </NuxtLink>
          <NuxtLink :to="localePath('/resources/videos')" class="resource-category-card">
            <h2 class="resource-category-card__title">{{ t('nav_resources.videos') }}</h2>
            <p class="resource-category-card__body">Product demos and installation guides</p>
          </NuxtLink>
        </div>
        <p class="resources-coming">Content is being prepared. Check back soon.</p>
      </div>
    </section>
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

.resource-categories {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-5);
}

.resource-category-card {
  display: block;
  padding: var(--space-6);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition: box-shadow var(--transition-normal);
}

.resource-category-card:hover {
  box-shadow: 0 4px 16px rgba(18, 60, 50, 0.12);
}

.resource-category-card__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}

.resource-category-card__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}

.resources-coming {
  margin-top: var(--space-10);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}
</style>
