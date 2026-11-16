<script setup lang="ts">
import type { ProductCategory, Product, LocalizedString } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const categorySlug = route.params.category as string

// FINAL-RELEASE-FIX-C: an unpublished locale is a 404, and the page answers with the API's own 404 / 503.
assertPublishedLocale()
const { data, error } = await useAsyncData<{ category: ProductCategory; products: Product[] }>(
  `product-category-${categorySlug}`,
  () => $fetch<{ category: ProductCategory; products: Product[] }>(`/api/cms/products/${categorySlug}`)
)
const status = publicPageStatus(error.value, Boolean(data.value))
if (status) {
  throw createError({ statusCode: status, fatal: true })
}

const category = computed(() => data.value?.category)
const products = computed(() => data.value?.products ?? [])

/** The current locale's text only; there is no fallback to another locale (RSG-05). */
function loc(s: LocalizedString): string {
  return s[locale.value as keyof LocalizedString] ?? ''
}

const catSeoTitle = computed(() => (category.value ? loc(category.value.seo.title) : '') || t('seo.products.title'))
const catSeoDesc = computed(() => (category.value ? loc(category.value.seo.description) : ''))
useSeoHead({
  title: catSeoTitle,
  description: catSeoDesc,
  canonicalPath: `/products/${categorySlug}`,
})
</script>

<template>
  <div v-if="category">
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.products'), to: localePath('/products') },
            { label: loc(category.title) },
          ]"
        />
        <h1 class="page-hero__title">{{ loc(category.title) }}</h1>
        <p class="page-hero__sub">{{ loc(category.intro) }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div v-if="products.length" class="product-grid">
          <MediaCard
            v-for="p in products"
            :key="p.slug"
            :title="loc(p.name)"
            :subtitle="loc(p.summary)"
            :to="localePath(`/products/${categorySlug}/${p.slug}`)"
            :image-src="p.heroMedia.url"
            :image-alt="loc(p.heroMedia.alt)"
          />
        </div>
        <div v-else class="empty-state">
          <p>Product information is being prepared. <NuxtLink :to="localePath('/contact')">Contact us</NuxtLink> for details.</p>
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6);
}

.empty-state {
  padding: var(--space-12) 0;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

.empty-state a {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
