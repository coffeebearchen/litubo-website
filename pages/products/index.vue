<script setup lang="ts">
import type { ProductCategory } from '~/types/content'

const { t } = useI18n()
const localePath = useLocalePath()

const { data: categories } = await useAsyncData<ProductCategory[]>(
  'product-categories',
  () => $fetch('/api/cms/products/categories')
)

useHead({
  title: t('seo.products.title'),
  meta: [{ name: 'description', content: t('seo.products.description') }],
})
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.products') }]" />
        <h1 class="page-hero__title">{{ t('pages.products.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.products.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div class="product-category-grid">
          <NuxtLink
            v-for="cat in categories"
            :key="cat.slug"
            :to="localePath(`/products/${cat.slug}`)"
            class="category-card"
          >
            <div class="category-card__image-wrap">
              <img
                v-if="cat.heroMedia.url"
                :src="cat.heroMedia.url"
                :alt="cat.heroMedia.alt.en"
                class="category-card__image"
                loading="lazy"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              >
              <div class="category-card__image-placeholder" aria-hidden="true" />
            </div>
            <div class="category-card__body">
              <h2 class="category-card__title">{{ cat.title.en }}</h2>
              <p class="category-card__intro">{{ cat.intro.en }}</p>
              <span class="category-card__arrow" aria-hidden="true">
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

.product-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-6);
}

.category-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
  text-decoration: none;
  color: inherit;
}

.category-card:hover {
  box-shadow: 0 4px 20px rgba(18, 60, 50, 0.14);
}

.category-card__image-wrap {
  aspect-ratio: 16 / 9;
  position: relative;
  overflow: hidden;
}

.category-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.category-card:hover .category-card__image {
  transform: scale(1.03);
}

.category-card__image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.category-card__body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.category-card__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-primary);
}

.category-card__intro {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  flex: 1;
}

.category-card__arrow {
  color: var(--color-accent);
  transition: transform var(--transition-fast);
}

.category-card:hover .category-card__arrow {
  transform: translateX(4px);
}
</style>
