<script setup lang="ts">
import type { HomeContent, PostsResult, ProductCategory } from '~/types/content'
import { INDUSTRY_GUIDES } from '~/content/industry-guides'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Home "Inspection by application" — the same eight industries as /applications.
const appCards = INDUSTRY_GUIDES.map(g => ({ slug: g.slug, title: g.title }))

const { data: homeContent } = await useAsyncData<HomeContent>(
  'home-content',
  () => $fetch<HomeContent>('/api/cms/home'),
  { server: true, lazy: false }
)

// locale 优先选择对应语言，空值时回退到 EN，EN 也为空时回退到 i18n key
function cmsText(
  obj: { en: string; es: string; pt: string } | undefined,
  i18nKey: string
): string {
  if (!obj) return t(i18nKey)
  const l = locale.value as 'en' | 'es' | 'pt'
  return obj[l] || obj.en || t(i18nKey)
}

const hero = computed(() => homeContent.value?.hero ?? null)

const heroEyebrow = computed(() => cmsText(hero.value?.eyebrow, 'pages.home.heroEyebrow'))
const heroTitle = computed(() => cmsText(hero.value?.title, 'pages.home.heroTitle'))
const heroBody = computed(() => cmsText(hero.value?.body, 'pages.home.heroSubtitle'))
const heroPrimaryLabel = computed(() => cmsText(hero.value?.ctaPrimary.label, 'pages.home.heroCta'))
const heroPrimaryPath = computed(() => hero.value?.ctaPrimary.path || '/products')
const heroSecondaryLabel = computed(() => cmsText(hero.value?.ctaSecondary.label, 'pages.home.heroCtaSecondary'))
const heroSecondaryPath = computed(() => hero.value?.ctaSecondary.path || '/contact')

// ─── Scheme C: five product families ────────────────────────────────
// Titles, intros and order come from the published categories. The card photograph and the
// "family example" label come from one named, published product per family, so a single photo is
// never presented as if every model in the family looks like it. Conveyors & reject systems have
// no published product in the source data, so that card keeps an honest branded placeholder.
const FAMILY_SOURCE: Readonly<Record<string, { slug: string; label: string }>> = {
  'x-ray-inspection': { slug: 'xr-200d-compact-food-x-ray-inspection-system', label: 'XR-200D' },
  'metal-detection': { slug: 'lt-m-digital-all-metal-detector-series', label: 'LT-M Series' },
  'checkweighers': { slug: 'lt-150-compact-online-checkweigher', label: 'LT-150' },
  'combination-inspection': { slug: 'lt-js220-metal-detector-checkweigher-combo', label: 'LT-JS220' },
}

interface FamilyProduct {
  slug: string
  name: { en: string }
  heroMedia?: { url: string; alt?: { en: string } }
}

const { data: categories } = await useAsyncData<ProductCategory[]>(
  'home-categories',
  () => $fetch<ProductCategory[]>('/api/cms/products/categories'),
  { default: () => [] },
)

const { data: familyProducts } = await useAsyncData<Record<string, FamilyProduct>>(
  'home-family-products',
  async () => {
    const keys = Object.keys(FAMILY_SOURCE)
    const lists = await Promise.all(keys.map(key => $fetch<{ products: FamilyProduct[] }>(`/api/cms/products/${key}`)
      .catch(() => ({ products: [] as FamilyProduct[] }))))
    const map: Record<string, FamilyProduct> = {}
    keys.forEach((key, i) => {
      const hit = (lists[i]?.products ?? []).find(p => p.slug === FAMILY_SOURCE[key]!.slug)
      if (hit) map[key] = hit
    })
    return map
  },
  { default: () => ({}) },
)

const familyCards = computed(() => (categories.value ?? []).map((c, i) => {
  const source = FAMILY_SOURCE[c.slug]
  const product = familyProducts.value?.[c.slug]
  return {
    key: c.slug,
    index: i,
    title: c.title[locale.value as 'en' | 'es' | 'pt'] || c.title.en,
    description: c.intro[locale.value as 'en' | 'es' | 'pt'] || c.intro.en,
    imageSrc: product?.heroMedia?.url || c.heroMedia?.url || '',
    imageAlt: product?.heroMedia?.alt?.en || product?.name.en || c.title.en,
    modelLabel: source?.label ? `${source.label} · family example` : '',
    to: localePath(`/products/${c.slug}`),
  }
}))

// Hero showroom: the XR-200D photo, fetched from the real published product.
const { data: xrayList } = await useAsyncData<{ products: Array<{ slug: string; name: { en: string }; heroMedia?: { url: string; alt?: { en: string } } }> }>(
  'home-showroom-product',
  () => $fetch('/api/cms/products/x-ray-inspection'),
  { default: () => ({ products: [] }) },
)
const showroom = computed(() => {
  const rows = xrayList.value?.products ?? []
  const hit = rows.find(p => p.slug.startsWith('xr-200d'))
  return hit ?? rows[0] ?? null
})

// Full-bleed production band uses the approved production-line photograph.
const bandImage = '/images/home/home-hero-inspection-line.png'

useSeoHead({
  title: t('seo.home.title'),
  description: t('seo.home.description'),
  canonicalPath: '/',
})

// ─── Blog & Insights: real published English articles only ──────────
const { data: latestPosts } = await useAsyncData<PostsResult>(
  'home-blog-posts',
  () => $fetch<PostsResult>('/api/cms/posts?limit=12'),
  { default: () => ({ posts: [] }) },
)

/** Route prefix per content type, so an article never lands in the wrong detail path. */
const BLOG_ROUTE: Readonly<Record<string, string>> = {
  insight: '/resources/insights',
  technical_guide: '/resources/technical-guides',
  case_study: '/resources/case-studies',
  news: '/resources/news',
}

const BLOG_TAG: Readonly<Record<string, string>> = {
  insight: 'Insight',
  technical_guide: 'Technical guide',
  case_study: 'Case study',
  news: 'News',
}

// FAQ posts are a support format, not blog articles, so they are excluded here.
const blogPosts = computed(() => (latestPosts.value?.posts ?? [])
  .filter(p => p.contentType !== 'faq' && (p.title[locale.value as 'en' | 'es' | 'pt'] || p.title.en))
  .slice(0, 3)
  .map((p, i) => ({
    key: p.slug,
    order: String(i + 1).padStart(2, '0'),
    tag: BLOG_TAG[p.contentType] ?? 'Article',
    title: p.title[locale.value as 'en' | 'es' | 'pt'] || p.title.en,
    excerpt: p.excerpt[locale.value as 'en' | 'es' | 'pt'] || p.excerpt.en,
    cover: p.coverImageUrl || '',
    to: localePath(`${BLOG_ROUTE[p.contentType] ?? '/resources/insights'}/${p.slug}`),
  })))

// PUBLIC-CLAIMS-CLEANUP-01 (D-036): the FAQ teaser lists real published FAQ questions in the current locale only
// (RSG-05, no fallback). With none published the whole section is not rendered; no question is hard-coded.
const { data: faqTeaser } = await useAsyncData<PostsResult>(
  'home-faq-teaser',
  () => $fetch<PostsResult>('/api/cms/posts?content_type=faq&sort=publish_date'),
  { default: () => ({ posts: [] }) },
)
const faqQuestions = computed(() => (faqTeaser.value?.posts ?? [])
  .map(post => post.title[locale.value as 'en' | 'es' | 'pt'])
  .filter(Boolean)
  .slice(0, 6))

// ─── Three-step conversation ────────────────────────────────────────
// Describes our process only; it makes no claim about products or results.
const steps = [
  {
    n: '01',
    title: 'Describe the product and pack',
    body: 'Product form, packaging material and the point on the line where inspection would sit.',
  },
  {
    n: '02',
    title: 'Review the inspection task',
    body: 'The foreign material or weight check you need to discuss, and the conditions around it.',
  },
  {
    n: '03',
    title: 'Agree the configuration',
    body: 'Model, aperture, reject method and installation details are confirmed with our technical team.',
  },
]
</script>

<template>
  <div class="page-home">

    <!-- ─── Hero (scheme C: warm band + product showroom) ─────────── -->
    <section class="home-hero" aria-label="Hero">
      <div class="container home-hero__split">
        <div class="home-hero__copy">
          <p class="home-hero__eyebrow">{{ heroEyebrow }}</p>
          <h1 class="home-hero__title">{{ heroTitle }}</h1>
          <p class="home-hero__subtitle">{{ heroBody }}</p>
          <div class="home-hero__actions">
            <NuxtLink :to="localePath(heroPrimaryPath)" class="home-btn home-btn--primary">
              {{ heroPrimaryLabel }}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </NuxtLink>
            <NuxtLink :to="localePath(heroSecondaryPath)" class="home-btn home-btn--outline">
              {{ heroSecondaryLabel }}
            </NuxtLink>
          </div>
        </div>

        <figure class="home-hero__figure">
          <div class="home-hero__showroom">
            <img
              v-if="showroom?.heroMedia?.url"
              :src="showroom.heroMedia.url"
              :alt="showroom.name.en"
              loading="eager"
              fetchpriority="high"
            >
            <div v-else class="home-hero__showroom-placeholder img-placeholder img-placeholder--warm-light" aria-hidden="true" />
            <span v-if="showroom" class="home-hero__showroom-label">
              {{ showroom.name.en }} · X-ray inspection
            </span>
          </div>
          <figcaption class="home-hero__caption">
            Product image shown as supplied; the exact configuration is confirmed with your team.
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ─── Five product families (image ↔ description reveal) ────── -->
    <section id="systems" class="section-pad" aria-labelledby="families-heading">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">The product families</p>
            <h2 id="families-heading">Find your starting point.</h2>
          </div>
          <p>Five inspection families. Final model selection is discussed for your application.</p>
        </div>

        <div v-if="familyCards.length" class="family-reveal-grid">
          <FamilyRevealCard
            v-for="card in familyCards"
            :key="card.key"
            :index="card.index"
            :title="card.title"
            :description="card.description"
            :image-src="card.imageSrc"
            :image-alt="card.imageAlt"
            :model-label="card.modelLabel"
            :to="card.to"
          />
        </div>
        <p v-else class="home-empty">
          Product families are being prepared.
          <NuxtLink :to="localePath('/products')">Browse all products →</NuxtLink>
        </p>
      </div>
    </section>

    <!-- ─── Production line band ──────────────────────────────────── -->
    <section class="home-band" aria-labelledby="band-heading">
      <img :src="bandImage" alt="" class="home-band__img" loading="lazy" aria-hidden="true">
      <div class="container home-band__inner">
        <p class="home-band__eyebrow">On the line</p>
        <h2 id="band-heading">Every inspection decision starts with the product and the pack.</h2>
        <p class="home-band__body">
          Throughput, pack format and the available space decide as much as the technology does.
          We review those conditions with you before recommending a configuration.
        </p>
      </div>
    </section>

    <!-- ─── Inspection by application (illustrated) ───────────────── -->
    <section class="section-pad" aria-labelledby="applications-heading">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Inspection by application</p>
            <h2 id="applications-heading">Your product.<br>Your inspection questions.</h2>
          </div>
          <p>Start with an application. Final suitability depends on the product, packaging and line conditions.</p>
        </div>

        <div class="application-grid illustrated-apps">
          <NuxtLink
            v-for="a in appCards"
            :key="a.slug"
            :to="localePath(`/applications/${a.slug}`)"
          >
            <span class="application-name">
              <ApplicationIcon :slug="a.slug" />
              <h3>{{ a.title }}</h3>
            </span>
            <span class="app-explore">
              Explore application
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path d="M5 19L19 5M5 5h14v14" />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ─── Three-step conversation ───────────────────────────────── -->
    <section class="section-pad home-steps-band" aria-labelledby="steps-heading">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">How we work</p>
            <h2 id="steps-heading">Three steps to a useful answer.</h2>
          </div>
          <p>No automatic matching. Each enquiry is reviewed by our technical team.</p>
        </div>
        <div class="home-steps">
          <article v-for="s in steps" :key="s.n">
            <p class="home-steps__number">{{ s.n }}</p>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- ─── Blog & Insights ───────────────────────────────────────── -->
    <section id="blog" class="section-pad home-blog" aria-labelledby="blog-heading">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Blog &amp; Insights</p>
            <h2 id="blog-heading">Practical ideas.<br>A clearer conversation.</h2>
          </div>
          <NuxtLink :to="localePath('/resources')" class="text-link">
            View the blog
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M5 19L19 5M5 5h14v14" />
            </svg>
          </NuxtLink>
        </div>

        <div v-if="blogPosts.length" class="home-blog__grid">
          <article v-for="p in blogPosts" :key="p.key" class="home-blog__card">
            <NuxtLink :to="p.to" class="home-blog__cover">
              <img v-if="p.cover" :src="p.cover" :alt="p.title" loading="lazy">
              <span v-else class="home-blog__cover-fallback" aria-hidden="true">
                <span class="home-blog__cover-icon">
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
                  </svg>
                </span>
                <span>LITUBO INSIGHTS</span>
              </span>
              <span class="home-blog__order">{{ p.order }}</span>
            </NuxtLink>
            <div class="home-blog__body">
              <p class="eyebrow">{{ p.tag }}</p>
              <h3><NuxtLink :to="p.to">{{ p.title }}</NuxtLink></h3>
              <p>{{ p.excerpt }}</p>
              <NuxtLink :to="p.to" class="family-link">
                Read more
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <path d="M5 19L19 5M5 5h14v14" />
                </svg>
              </NuxtLink>
            </div>
          </article>
        </div>

        <p v-else class="home-empty">
          No articles published yet.
          <NuxtLink :to="localePath('/resources')">Explore resources →</NuxtLink>
        </p>
      </div>
    </section>

    <!-- ─── FAQ teaser ────────────────────────────────────────────── -->
    <section v-if="faqQuestions.length" class="section-pad" aria-labelledby="faq-heading">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Common questions</p>
            <h2 id="faq-heading">{{ t('pages.home.faqTitle') }}</h2>
          </div>
          <p>{{ t('pages.home.faqSubtitle') }}</p>
        </div>
        <ul class="home-faq__questions" role="list">
          <li v-for="q in faqQuestions" :key="q">
            <NuxtLink :to="localePath('/support/faq')" class="home-faq__question-link">
              <svg class="home-faq__q-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2" />
                <text x="8" y="12" text-anchor="middle" fill="currentColor" font-size="10" font-weight="700">?</text>
              </svg>
              {{ q }}
            </NuxtLink>
          </li>
        </ul>
        <div class="home-faq__footer">
          <NuxtLink :to="localePath('/support/faq')" class="text-link">
            {{ t('pages.home.faqCta') }}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M5 19L19 5M5 5h14v14" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ─── Connect with an Expert ────────────────────────────────── -->
    <ExpertContactForm />

  </div>
</template>

<style scoped>
/* ─── Shared section utilities ─────────────────────────────── */
.section-pad { padding-block: var(--space-20); }

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: var(--space-12);
  margin-bottom: var(--space-10);
}
.section-head h2 {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--color-ink);
  margin: 0;
}
.section-head > p { max-width: 460px; color: var(--color-ink-muted); margin: 0; }

.eyebrow {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 var(--space-3);
}
.section-head .eyebrow { color: var(--color-ink-muted); }

.text-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}
.text-link svg { flex: none; }

.home-empty {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  padding-block: var(--space-8);
}
.home-empty a { color: var(--color-link-on-light); text-decoration: underline; }

/* ─── Hero (scheme C) ──────────────────────────────────────── */
.home-hero {
  background: var(--color-surface-warm);
  padding-block: var(--space-16);
}
.home-hero__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: center;
}
.home-hero__eyebrow {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 var(--space-4);
}
.home-hero__title {
  font-family: var(--font-display);
  font-size: var(--text-5xl);
  line-height: 1.08;
  letter-spacing: -0.02em;
  font-weight: 400;
  color: var(--color-ink);
  margin: 0;
}
.home-hero__subtitle {
  max-width: 520px;
  margin: var(--space-6) 0 0;
  color: var(--color-ink-muted);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}
.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-8);
}
.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-6);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.home-btn--primary { background: var(--color-accent); color: #152A1B; }
.home-btn--primary:hover { background: #E6A626; }
.home-btn--outline { background: transparent; border-color: #798F79; color: var(--color-primary-deep); }
.home-btn--outline:hover { border-color: var(--color-primary-deep); }

.home-hero__figure { margin: 0; }
.home-hero__showroom {
  position: relative;
  height: 490px;
  display: grid;
  place-items: center;
  padding: var(--space-8);
  background: #FFFCF5;
  border: 1px solid #D8BD86;
}
/* Contain only: the product photo is never scaled or cropped. */
.home-hero__showroom img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  min-height: 0;
}
.home-hero__showroom-placeholder { width: 100%; height: 100%; }
.home-hero__showroom-label {
  position: absolute;
  bottom: var(--space-4);
  left: var(--space-6);
  font-size: var(--text-xs);
  color: #6C5E46;
}
.home-hero__caption {
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

/* ─── Family grid ──────────────────────────────────────────── */
.family-reveal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

/* ─── Production band ──────────────────────────────────────── */
.home-band {
  position: relative;
  isolation: isolate;
  min-height: 420px;
  display: flex;
  align-items: center;
  color: #fff;
  overflow: hidden;
}
.home-band__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -2;
}
.home-band::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #1B4224EA, #1B422433);
  z-index: -1;
}
.home-band__inner { padding-block: var(--space-16); }
.home-band__eyebrow {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #F0C16A;
  margin: 0 0 var(--space-4);
}
.home-band h2 {
  font-family: var(--font-display);
  font-size: var(--text-4xl);
  line-height: var(--leading-tight);
  font-weight: 400;
  max-width: 700px;
  margin: 0;
}
.home-band__body {
  max-width: 600px;
  margin: var(--space-6) 0 0;
  color: #E1E9DB;
  font-size: var(--text-base);
}

/* ─── Applications (illustrated) ───────────────────────────── */
.application-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-12);
}
.application-grid a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6) 0;
  border-top: 1px solid #C4C8BA;
  text-decoration: none;
  color: var(--color-ink);
}
.application-name {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}
.application-name h3 {
  font-size: var(--text-lg);
  line-height: var(--leading-snug);
  font-weight: 600;
  margin: 0;
}
.app-explore {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-link-on-light);
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-underline-offset: 5px;
}
.app-explore svg { flex: none; transition: transform 180ms var(--reveal-easing); }
.application-grid a:hover .app-explore svg { transform: translate(2px, -2px); }
.application-grid a:hover :deep(.app-icon) { background: #F5E8CD; border-color: #CFAE6D; }
.application-grid a:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 4px; }

/* ─── Steps ────────────────────────────────────────────────── */
.home-steps-band { background: var(--color-canvas); }
.home-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
}
.home-steps article {
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-top: 3px solid var(--color-accent);
  padding: var(--space-6);
}
.home-steps__number {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: #AC7B25;
  margin: 0 0 var(--space-3);
}
.home-steps h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 var(--space-3);
}
.home-steps article p:last-child {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

/* ─── Blog & Insights ──────────────────────────────────────── */
.home-blog { background: var(--color-canvas); }
.home-blog__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}
.home-blog__card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.home-blog__cover {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  padding: var(--space-6);
  background: #F3E4C8;
  color: var(--color-link-on-light);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  overflow: hidden;
}
.home-blog__cover img { width: 100%; height: 100%; object-fit: cover; }
.home-blog__cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  height: 100%;
}
.home-blog__cover-icon {
  display: grid;
  place-items: center;
  width: 70px;
  height: 70px;
  border: 1px solid #CCAE72;
  border-radius: 50%;
  background: #FFFFFF50;
}
.home-blog__order {
  position: absolute;
  left: var(--space-5);
  top: var(--space-4);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0;
}
.home-blog__card:nth-child(2) .home-blog__cover { background: #F6F0E4; }
.home-blog__card:nth-child(3) .home-blog__cover { background: #EDEFE5; }
.home-blog__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  padding: var(--space-6);
}
.home-blog__body .eyebrow { margin: 0; color: var(--color-link-on-light); font-size: var(--text-xs); }
.home-blog__body h3 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  line-height: 1.3;
  font-weight: 400;
  margin: 0;
}
.home-blog__body h3 a { text-decoration: none; color: inherit; }
.home-blog__body h3 a:hover { text-decoration: underline; text-decoration-color: var(--color-accent); }
.home-blog__body > p:not(.eyebrow) {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--color-ink-muted);
}
.home-blog__body .family-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  margin-top: auto;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}

/* ─── FAQ ──────────────────────────────────────────────────── */
.home-faq__questions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-10);
}
.home-faq__question-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-top: 1px solid #C5CCBE;
  color: var(--color-ink);
  font-size: var(--text-sm);
  text-decoration: none;
}
.home-faq__question-link:hover { color: var(--color-primary); }
.home-faq__q-icon { flex: none; color: var(--color-primary); }
.home-faq__footer { margin-top: var(--space-6); }

/* ─── Responsive ───────────────────────────────────────────── */
@media (max-width: 1100px) {
  .home-hero__split { gap: var(--space-8); }
  .home-hero__title { font-size: var(--text-4xl); }
  .home-hero__showroom { height: 420px; }
  .family-reveal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-band h2 { font-size: var(--text-3xl); }
  .home-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-blog__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .application-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .application-grid a { flex-direction: column; align-items: start; gap: var(--space-3); }
  .app-explore { padding-left: 60px; }
}

@media (max-width: 760px) {
  .section-pad { padding-block: var(--space-12); }
  .section-head { display: block; margin-bottom: var(--space-8); }
  .section-head > p { margin-top: var(--space-4); }
  .section-head h2 { font-size: var(--text-2xl); }

  .home-hero { padding-block: var(--space-10); }
  .home-hero__split { grid-template-columns: minmax(0, 1fr); }
  .home-hero__title { font-size: var(--text-3xl); }
  .home-hero__subtitle { font-size: var(--text-base); }
  .home-hero__showroom { height: 380px; padding: var(--space-5); }

  .family-reveal-grid,
  .home-blog__grid,
  .home-steps,
  .application-grid,
  .home-faq__questions { grid-template-columns: minmax(0, 1fr); }

  .home-band { min-height: 380px; }
  .home-band h2 { font-size: var(--text-2xl); }

  .application-grid a { flex-direction: row; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .app-explore { padding-left: 60px; font-size: var(--text-xs); }
}

@media (prefers-reduced-motion: reduce) {
  .home-btn,
  .app-explore svg { transition: none !important; }
}
</style>
