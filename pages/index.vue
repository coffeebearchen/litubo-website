<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const productCategories = useProductCategories()
const applications = useApplications()

useHead({
  title: t('seo.home.title'),
  meta: [
    { name: 'description', content: t('seo.home.description') },
    { property: 'og:title', content: t('seo.home.title') },
    { property: 'og:description', content: t('seo.home.description') },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <div class="page-home">
    <!-- Hero -->
    <section class="home-hero">
      <div class="container home-hero__inner">
        <div class="home-hero__content">
          <h1 class="home-hero__title">{{ t('pages.home.heroTitle') }}</h1>
          <p class="home-hero__subtitle">{{ t('pages.home.heroSubtitle') }}</p>
          <div class="home-hero__actions">
            <NuxtLink :to="localePath('/products')" class="btn btn--accent btn--lg">
              {{ t('pages.home.heroCta') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/find-a-distributor')" class="btn btn--outline btn--lg">
              {{ t('pages.home.heroCtaSecondary') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Product lines teaser -->
    <section class="home-products section-gap">
      <div class="container">
        <SectionHeading>
          {{ t('nav.products') }}
          <template #sub>{{ t('pages.products.heroSubtitle') }}</template>
        </SectionHeading>
        <div class="home-products__grid">
          <MediaCard
            v-for="cat in productCategories"
            :key="cat.slug"
            :title="cat.title.en"
            :to="localePath(`/products/${cat.slug}`)"
          />
        </div>
        <div class="home-products__cta">
          <ArrowLink :to="localePath('/products')">{{ t('nav_products.viewAll') }}</ArrowLink>
        </div>
      </div>
    </section>

    <!-- Applications teaser -->
    <section class="home-applications section-gap section-alt">
      <div class="container">
        <SectionHeading>{{ t('nav.applications') }}</SectionHeading>
        <div class="home-applications__grid">
          <NuxtLink
            v-for="app in applications"
            :key="app.slug"
            :to="localePath(`/applications/${app.slug}`)"
            class="app-chip"
          >
            {{ app.title.en }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.findDistributor')"
      :secondary-to="localePath('/find-a-distributor')"
      dark
    />
  </div>
</template>


<style scoped>
/* Hero */
.home-hero {
  background: var(--color-primary-deep);
  padding: var(--space-24) 0 var(--space-20);
  min-height: 540px;
  display: flex;
  align-items: center;
}

.home-hero__content {
  max-width: 600px;
}

.home-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-4xl), 5vw, var(--text-6xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  color: var(--color-white);
  margin-bottom: var(--space-5);
}

.home-hero__subtitle {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.75);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-8);
  max-width: 480px;
}

.home-hero__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

/* Buttons inline in template */
:deep(.btn) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  text-decoration: none;
  cursor: pointer;
}
:deep(.btn--lg)      { padding: var(--space-3) var(--space-8); font-size: var(--text-base); }
:deep(.btn--accent)  { background: var(--color-accent); color: var(--color-white); border-color: var(--color-accent); }
:deep(.btn--accent:hover) { background: #b85f15; border-color: #b85f15; }
:deep(.btn--outline) { background: transparent; color: var(--color-white); border-color: rgba(255,255,255,0.5); }
:deep(.btn--outline:hover) { background: rgba(255,255,255,0.1); border-color: var(--color-white); }

/* Sections */
.section-gap { padding: var(--space-20) 0; }
.section-alt  { background: var(--color-canvas); }

/* Products grid */
.home-products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-5);
  margin-top: var(--space-10);
}

.home-products__cta {
  margin-top: var(--space-8);
}

/* Applications chips */
.home-applications__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.app-chip {
  display: inline-flex;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.app-chip:hover {
  background: var(--color-primary);
  color: var(--color-white);
}
</style>
