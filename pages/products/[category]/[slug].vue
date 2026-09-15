<script setup lang="ts">
import type { Product, ProductCategory, LocalizedString } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const categorySlug = route.params.category as string
const slug = route.params.slug as string

/** The current locale's text only; there is no fallback to another locale (RSG-05). */
function loc(s: LocalizedString): string {
  return s[locale.value as keyof LocalizedString] ?? ''
}

// FINAL-RELEASE-FIX-C: an unpublished locale is a 404, and the page answers with the API's own 404 / 503
// for the product and for its category; neither is ever turned into the other.
assertPublishedLocale()
const { data: product, error: productError } = await useAsyncData<Product>(
  `product-${categorySlug}-${slug}`,
  () => $fetch<Product>(`/api/cms/products/${categorySlug}/${slug}`)
)
const productStatus = publicPageStatus(productError.value, Boolean(product.value))
if (productStatus) {
  throw createError({ statusCode: productStatus, fatal: true })
}
// A product with no name in this locale is not public in it.
if (!loc(product.value!.name)) {
  throw createError({ statusCode: 404, fatal: true })
}

const { data: categoryData, error: categoryError } = await useAsyncData<{ category: ProductCategory; products: Product[] }>(
  `product-category-${categorySlug}`,
  () => $fetch<{ category: ProductCategory; products: Product[] }>(`/api/cms/products/${categorySlug}`)
)
const categoryStatus = publicPageStatus(categoryError.value, Boolean(categoryData.value))
if (categoryStatus) {
  throw createError({ statusCode: categoryStatus, fatal: true })
}
const category = computed(() => categoryData.value?.category)

const prodSeoTitle = computed(() => (product.value ? loc(product.value.seo.title) : '') || t('seo.products.title'))
const prodSeoDesc = computed(() => (product.value ? loc(product.value.seo.description) : ''))
useSeoHead({
  title: prodSeoTitle,
  description: prodSeoDesc,
  canonicalPath: computed(() => product.value?.seo.canonicalPath ?? ''),
  ogImage: computed(() => product.value?.seo.ogImage),
  noIndex: computed(() => product.value?.seo.noIndex),
  ogType: 'website',
})

// Prefer structured spec groups; fall back to inline specifications array
const hasSpecGroups = computed(() => (product.value?.specGroups?.length ?? 0) > 0)
const hasSpecsFlat = computed(() => !hasSpecGroups.value && (product.value?.specifications?.length ?? 0) > 0)

// FAQ open/close state
const openFaq = ref<number | null>(null)
function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? null : i
}

const DOWNLOAD_ROLE_LABELS: Record<string, string> = {
  brochure: 'Brochure',
  datasheet: 'Datasheet',
  drawing: 'Drawing',
  manual: 'Manual',
  certificate: 'Certificate',
}
</script>

<template>
  <div v-if="product && category">
    <!-- Hero -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.products'), to: localePath('/products') },
            { label: loc(category.title), to: localePath(`/products/${categorySlug}`) },
            { label: loc(product.name) },
          ]"
        />
        <h1 class="page-hero__title">{{ loc(product.name) }}</h1>
        <p v-if="product.modelSeries" class="page-hero__model">{{ product.modelSeries }}</p>
        <p class="page-hero__sub">{{ loc(product.summary) }}</p>
        <div class="page-hero__actions">
          <NuxtLink :to="localePath('/contact')" class="btn btn--accent">{{ t('common.talkToEngineer') }}</NuxtLink>
          <NuxtLink :to="localePath('/find-a-distributor')" class="btn btn--outline-white">{{ t('common.findDistributor') }}</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Gallery -->
    <section v-if="product.gallery.length" class="section-gap">
      <div class="container">
        <div class="gallery-grid">
          <img
            v-for="img in product.gallery"
            :key="img.id"
            :src="img.url"
            :alt="loc(img.alt)"
            class="gallery-img"
            loading="lazy"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          >
        </div>
      </div>
    </section>

    <!-- Inline highlights (fixtures mode / legacy) -->
    <section v-if="product.highlights.length" class="section-gap">
      <div class="container">
        <SectionHeading>Key Benefits</SectionHeading>
        <div class="highlights-grid">
          <FeatureCard
            v-for="(h, i) in product.highlights"
            :key="i"
            :title="loc(h.title)"
            :body="loc(h.body)"
          />
        </div>
      </div>
    </section>

    <!-- Content sections (Directus mode) — all body text is plain text, never v-html -->
    <template v-if="product.sections?.length">
      <section
        v-for="(sec, si) in product.sections"
        :key="si"
        class="section-gap"
        :class="{ 'section-alt': si % 2 === 1 }"
      >
        <div class="container">
          <p v-if="loc(sec.eyebrow)" class="section-eyebrow">
            {{ loc(sec.eyebrow) }}
          </p>
          <SectionHeading v-if="loc(sec.title)">
            {{ loc(sec.title) }}
          </SectionHeading>
          <p v-if="loc(sec.body)" class="section-body">
            {{ loc(sec.body) }}
          </p>
          <!-- Section items (feature_list / benefits) -->
          <div v-if="sec.items.length" class="highlights-grid" style="margin-top: var(--space-6)">
            <FeatureCard
              v-for="(item, ii) in sec.items"
              :key="ii"
              :title="loc(item.title)"
              :body="loc(item.body)"
            />
          </div>
          <!-- Section media -->
          <img
            v-if="sec.media"
            :src="sec.media.url"
            :alt="loc(sec.media.alt)"
            class="section-media-img"
            loading="lazy"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          >
        </div>
      </section>
    </template>

    <!-- Structured spec groups (Directus mode) -->
    <section v-if="hasSpecGroups" class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Technical Specifications</SectionHeading>
        <div
          v-for="(group, gi) in product.specGroups"
          :key="gi"
          class="spec-group"
        >
          <h3 v-if="loc(group.title)" class="spec-group__title">
            {{ loc(group.title) }}
          </h3>
          <p v-if="loc(group.description)" class="spec-group__desc">
            {{ loc(group.description) }}
          </p>
          <table class="spec-table">
            <tbody>
              <tr v-for="(row, ri) in group.items" :key="ri">
                <th>{{ loc(row.label) }}</th>
                <td>
                  {{ loc(row.value) }}<span v-if="row.unit" class="spec-unit"> {{ row.unit }}</span>
                  <span v-if="row.note" class="spec-note">{{ row.note }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Inline flat specifications (fixtures mode fallback) -->
    <section v-else-if="hasSpecsFlat" class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Technical Specifications</SectionHeading>
        <table class="spec-table">
          <tbody>
            <tr v-for="(row, ri) in product.specifications" :key="ri">
              <th>{{ loc(row.label) }}</th>
              <td>{{ loc(row.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- FAQ (Directus mode) — answer text is plain text, white-space: pre-line -->
    <section v-if="product.faqs?.length" class="section-gap">
      <div class="container">
        <SectionHeading>Frequently Asked Questions</SectionHeading>
        <dl class="faq-list">
          <div
            v-for="(faq, fi) in product.faqs"
            :key="fi"
            class="faq-item"
          >
            <dt>
              <button
                class="faq-question"
                :aria-expanded="openFaq === fi"
                @click="toggleFaq(fi)"
              >
                {{ loc(faq.question) }}
                <span class="faq-icon" aria-hidden="true">{{ openFaq === fi ? '−' : '+' }}</span>
              </button>
            </dt>
            <dd v-show="openFaq === fi" class="faq-answer">
              {{ loc(faq.answer) }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- Downloads (Directus mode) -->
    <section v-if="product.downloads?.length" class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Documents & Downloads</SectionHeading>
        <ul class="download-list">
          <li v-for="dl in product.downloads" :key="dl.uuid" class="download-item">
            <a :href="dl.url" class="download-link" target="_blank" rel="noopener">
              <span class="download-role">{{ DOWNLOAD_ROLE_LABELS[dl.role] ?? dl.role }}</span>
              <span v-if="dl.versionLabel" class="download-version">{{ dl.versionLabel }}</span>
              <svg class="download-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1v8M3 6l4 4 4-4M1 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
          </li>
        </ul>
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
  margin: var(--space-4) 0 var(--space-2);
}

.page-hero__model {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 var(--space-3);
  font-family: var(--font-mono, monospace);
  letter-spacing: 0.03em;
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

.section-eyebrow {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  margin: 0 0 var(--space-2);
}

.section-body {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  line-height: var(--leading-relaxed);
  white-space: pre-line;
  max-width: 720px;
  margin-top: var(--space-4);
}

.section-media-img {
  margin-top: var(--space-8);
  border-radius: var(--radius-md);
  max-width: 100%;
  display: block;
}

/* Gallery */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}

.gallery-img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
}

/* Highlights */
.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-5);
  margin-top: var(--space-8);
}

/* Spec groups */
.spec-group { margin-top: var(--space-8); }
.spec-group__title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-1);
}
.spec-group__desc {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-3);
}

/* Spec table */
.spec-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-3);
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
.spec-table td { color: var(--color-ink-muted); }
.spec-unit { color: var(--color-ink-muted); }
.spec-note {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  font-style: italic;
}

@media (max-width: 640px) {
  .spec-table, .spec-table thead, .spec-table tbody,
  .spec-table th, .spec-table td, .spec-table tr { display: block; }
  .spec-table th { border-bottom: none; padding-bottom: var(--space-1); }
  .spec-table td { padding-top: var(--space-1); margin-bottom: var(--space-2); border-top: none; }
}

/* FAQ */
.faq-list {
  margin-top: var(--space-8);
  border-top: 1px solid var(--color-line);
}
.faq-item {
  border-bottom: 1px solid var(--color-line);
}
.faq-question {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  text-align: left;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-ink);
}
.faq-icon { color: var(--color-accent); font-size: var(--text-lg); flex-shrink: 0; }
.faq-answer {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-relaxed);
  white-space: pre-line;
  padding: 0 0 var(--space-4);
  margin: 0;
}

/* Downloads */
.download-list {
  list-style: none;
  padding: 0;
  margin: var(--space-8) 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.download-item {}
.download-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.download-link:hover { background: var(--color-canvas); }
.download-role { font-weight: 500; }
.download-version { color: var(--color-ink-muted); }
.download-icon { flex-shrink: 0; }
</style>
