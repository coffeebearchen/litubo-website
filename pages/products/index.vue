<script setup lang="ts">
import type { ProductCategory, LocalizedString } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// FINAL-RELEASE-FIX-C: an unpublished locale is a 404; an unavailable catalogue is a 503, never an empty 200.
assertPublishedLocale()
const { data: categories, error } = await useAsyncData<ProductCategory[]>(
  'product-categories',
  () => $fetch<ProductCategory[]>('/api/cms/products/categories')
)
const status = publicPageStatus(error.value, Array.isArray(categories.value))
if (status) {
  throw createError({ statusCode: status, fatal: true })
}

/** The current locale's text only; there is no fallback to another locale (RSG-05). */
function loc(s: LocalizedString): string {
  return s[locale.value as keyof LocalizedString] ?? ''
}

useSeoHead({
  title: t('seo.products.title'),
  description: t('seo.products.description'),
  canonicalPath: '/products',
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
        <p v-if="!categories?.length" class="empty-state">
          {{ t('pages.products.empty') }}
          <NuxtLink :to="localePath('/contact')">{{ t('nav.contact') }}</NuxtLink>
        </p>
        <div v-else class="product-category-grid">
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
                :alt="loc(cat.heroMedia.alt)"
                class="category-card__image"
                loading="lazy"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              >
              <div class="category-card__image-placeholder img-placeholder" aria-hidden="true" />
            </div>
            <div class="category-card__body">
              <h2 class="category-card__title">{{ loc(cat.title) }}</h2>
              <p class="category-card__intro">{{ loc(cat.intro) }}</p>
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
  background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%);
  padding: var(--space-12) 0;
  color: var(--color-ink);
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
  color: var(--color-ink-muted);
  max-width: 560px;
  line-height: var(--leading-normal);
}

.section-gap { padding: var(--space-16) 0; }

.empty-state {
  padding: var(--space-12) 0;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

.empty-state a {
  color: var(--color-primary);
  text-decoration: underline;
}

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
  box-shadow: 0 4px 20px rgba(27, 66, 36, 0.14);
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
  object-fit: contain;
  padding: var(--space-3);
  transition: transform var(--transition-normal);
}

.category-card:hover .category-card__image {
  transform: scale(1.03);
}

.category-card__image-placeholder {
  width: 100%;
  height: 100%;
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
