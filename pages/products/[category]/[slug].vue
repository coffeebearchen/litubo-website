<script setup lang="ts">
import type { Product, ProductCategory } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const categorySlug = route.params.category as string
const slug = route.params.slug as string

const { data: product, error: productError } = await useAsyncData<Product>(
  `product-${categorySlug}-${slug}`,
  () => $fetch(`/api/cms/products/${categorySlug}/${slug}`)
)

if (productError.value || !product.value) {
  throw createError({ statusCode: 404, statusMessage: 'Product not found' })
}

const { data: categoryData } = await useAsyncData<{ category: ProductCategory; products: Product[] }>(
  `product-category-${categorySlug}`,
  () => $fetch(`/api/cms/products/${categorySlug}`)
)
const category = computed(() => categoryData.value?.category)

const prodSeoTitle = computed(() => {
  const l = locale.value as 'en' | 'es' | 'pt'
  return (product.value?.seo.title[l] || product.value?.seo.title.en) ?? t('seo.products.title')
})
const prodSeoDesc = computed(() => {
  const l = locale.value as 'en' | 'es' | 'pt'
  return product.value?.seo.description[l] || product.value?.seo.description.en || ''
})
useSeoHead({
  title: prodSeoTitle,
  description: prodSeoDesc,
  canonicalPath: computed(() => product.value?.seo.canonicalPath ?? ''),
  ogImage: computed(() => product.value?.seo.ogImage),
  noIndex: computed(() => product.value?.seo.noIndex),
  ogType: 'website',
})
</script>

<template>
  <div v-if="product && category">
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.products'), to: localePath('/products') },
            { label: category.title.en, to: localePath(`/products/${categorySlug}`) },
            { label: product.name.en },
          ]"
        />
        <h1 class="page-hero__title">{{ product.name.en }}</h1>
        <p class="page-hero__sub">{{ product.summary.en }}</p>
        <div class="page-hero__actions">
          <NuxtLink :to="localePath('/contact')" class="btn btn--accent">{{ t('common.talkToEngineer') }}</NuxtLink>
          <NuxtLink :to="localePath('/find-a-distributor')" class="btn btn--outline-white">{{ t('common.findDistributor') }}</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Product highlights -->
    <section v-if="product.highlights.length" class="section-gap">
      <div class="container">
        <SectionHeading>Key Benefits</SectionHeading>
        <div class="highlights-grid">
          <FeatureCard
            v-for="(h, i) in product.highlights"
            :key="i"
            :title="h.title.en"
            :body="h.body.en"
          />
        </div>
      </div>
    </section>

    <!-- Specifications -->
    <section v-if="product.specifications.length" class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Technical Specifications</SectionHeading>
        <table class="spec-table">
          <tbody>
            <tr v-for="row in product.specifications" :key="row.label.en">
              <th>{{ row.label.en }}</th>
              <td>{{ row.value.en }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('common.findDistributor')"
      :secondary-to="localePath('/find-a-distributor')"
    />
  </div>
</template>

<style scoped>
.page-hero {
  background: var(--color-primary-deep);
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
  color: rgba(255, 255, 255, 0.75);
  max-width: 560px;
  line-height: var(--leading-normal);
  margin-bottom: var(--space-8);
}

.page-hero__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

:deep(.btn) {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  padding: var(--space-2) var(--space-6);
  font-size: var(--text-sm);
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  text-decoration: none;
}
:deep(.btn--accent)        { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
:deep(.btn--accent:hover)  { background: #b85f15; border-color: #b85f15; }
:deep(.btn--outline-white) { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
:deep(.btn--outline-white:hover) { background: rgba(255,255,255,0.1); border-color: #fff; }

.section-gap { padding: var(--space-16) 0; }
.section-alt  { background: var(--color-canvas); }

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-5);
  margin-top: var(--space-8);
}

.spec-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-8);
  font-size: var(--text-sm);
}

.spec-table th,
.spec-table td {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  text-align: left;
}

.spec-table th {
  width: 40%;
  background: var(--color-canvas);
  font-weight: 600;
  color: var(--color-ink);
}

.spec-table td {
  color: var(--color-ink-muted);
}

@media (max-width: 640px) {
  .spec-table, .spec-table thead, .spec-table tbody, .spec-table th, .spec-table td, .spec-table tr {
    display: block;
  }
  .spec-table th {
    border-bottom: none;
    padding-bottom: var(--space-1);
  }
  .spec-table td {
    padding-top: var(--space-1);
    margin-bottom: var(--space-2);
    border-top: none;
  }
}
</style>
