<script setup lang="ts">
import type { ProductCategory, Product } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const categorySlug = route.params.category as string

const { data, error } = await useAsyncData<{ category: ProductCategory; products: Product[]; cmsError?: boolean }>(
  `product-category-${categorySlug}`,
  () => $fetch(`/api/cms/products/${categorySlug}`)
)

if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const category = computed(() => data.value!.category)
const products = computed(() => data.value!.products)
const cmsError = computed(() => data.value?.cmsError === true)

const catLocale = computed(() => locale.value as 'en' | 'es' | 'pt')
const catSeoTitle = computed(() =>
  category.value?.seo.title[catLocale.value] || category.value?.seo.title.en || t('seo.products.title')
)
const catSeoDesc = computed(() =>
  category.value?.seo.description[catLocale.value] || category.value?.seo.description.en || ''
)
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
            { label: category.title.en },
          ]"
        />
        <h1 class="page-hero__title">{{ category.title.en }}</h1>
        <p class="page-hero__sub">{{ category.intro.en }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div v-if="products.length" class="product-grid">
          <MediaCard
            v-for="p in products"
            :key="p.slug"
            :title="p.name.en"
            :subtitle="p.summary.en"
            :to="localePath(`/products/${categorySlug}/${p.slug}`)"
            :image-src="p.heroMedia.url"
            :image-alt="p.heroMedia.alt.en"
          />
        </div>
        <div v-else-if="cmsError" class="unavailable-state">
          <p>Product information is temporarily unavailable. Please try again later or <NuxtLink :to="localePath('/contact')">contact us</NuxtLink>.</p>
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-6);
}

.empty-state,
.unavailable-state {
  padding: var(--space-12) 0;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

.empty-state a,
.unavailable-state a {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
