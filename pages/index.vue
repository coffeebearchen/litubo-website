<script setup lang="ts">
import type { HomeContent, PostsResult } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()

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

const heroImgSrc = computed(() =>
  hero.value?.imageUrl || '/images/home/home-hero-inspection-line.png'
)
const heroImgError = ref(false)

const heroEyebrow = computed(() => cmsText(hero.value?.eyebrow, 'pages.home.heroEyebrow'))
const heroTitle = computed(() => cmsText(hero.value?.title, 'pages.home.heroTitle'))
const heroBody = computed(() => cmsText(hero.value?.body, 'pages.home.heroSubtitle'))
const heroPrimaryLabel = computed(() => cmsText(hero.value?.ctaPrimary.label, 'pages.home.heroCta'))
const heroPrimaryPath = computed(() => hero.value?.ctaPrimary.path || '/products')
const heroSecondaryLabel = computed(() => cmsText(hero.value?.ctaSecondary.label, 'pages.home.heroCtaSecondary'))
const heroSecondaryPath = computed(() => hero.value?.ctaSecondary.path || '/contact')

// Home category grid — the five stable product lines
const catCards = [
  { slug: 'x-ray-inspection', title: t('nav_products.xray'), desc: 'Advanced X-ray inspection for packaged food and packaging.' },
  { slug: 'metal-detection', title: t('nav_products.metal'), desc: 'High-sensitivity metal detection for food processing lines.' },
  { slug: 'checkweighers', title: t('nav_products.checkweighers'), desc: 'Dynamic checkweighing for accurate fill weights.' },
  { slug: 'combination-inspection', title: t('nav_products.combination'), desc: 'Integrated multi-technology inspection systems.' },
  { slug: 'conveyors-reject-systems', title: t('nav_products.conveyors'), desc: 'Conveyors and reject systems for LITUBO equipment.' },
]

useSeoHead({
  title: t('seo.home.title'),
  description: t('seo.home.description'),
  canonicalPath: '/',
})

// "Latest from LITUBO" — the three most recent published insights (real posts only).
const { data: latestPosts } = await useAsyncData<PostsResult>(
  'home-latest-posts',
  () => $fetch<PostsResult>('/api/cms/posts?limit=3'),
  { default: () => ({ posts: [] }) },
)
const latestResources = computed(() => (latestPosts.value?.posts ?? []).map(p => ({
  tag: p.contentType === 'insight' ? 'Insight' : p.contentType === 'technical_guide' ? 'Technical Guide' : 'Article',
  title: p.title[locale.value as 'en' | 'es' | 'pt'] || p.title.en,
  excerpt: p.excerpt[locale.value as 'en' | 'es' | 'pt'] || p.excerpt.en,
  to: `/resources/${p.contentType === 'insight' ? 'insights' : p.contentType === 'technical_guide' ? 'technical-guides' : 'news'}/${p.slug}`,
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
</script>

<template>
  <div class="page-home">

    <!-- ─── Hero ──────────────────────────────────────── -->
    <section class="home-hero" aria-label="Hero">
      <!-- Full-bleed background image; falls back to dark-green CSS when missing -->
      <div class="home-hero__bg" aria-hidden="true">
        <img
          v-if="!heroImgError"
          :src="heroImgSrc"
          alt=""
          class="home-hero__bg-img"
          loading="eager"
          fetchpriority="high"
          @error="heroImgError = true"
        >
        <div class="home-hero__bg-overlay" />
      </div>
      <div class="home-hero__inner">
        <!-- Text side -->
        <div class="home-hero__content">
          <p class="home-hero__eyebrow">{{ heroEyebrow }}</p>
          <h1 class="home-hero__title">{{ heroTitle }}</h1>
          <p class="home-hero__subtitle">{{ heroBody }}</p>
          <div class="home-hero__actions">
            <NuxtLink :to="localePath(heroPrimaryPath)" class="hero-btn hero-btn--primary">
              {{ heroPrimaryLabel }}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </NuxtLink>
            <NuxtLink :to="localePath(heroSecondaryPath)" class="hero-btn hero-btn--outline">
              {{ heroSecondaryLabel }}
            </NuxtLink>
          </div>
        </div>
        <!-- Image side (photo pending) -->
        <div class="home-hero__media" aria-hidden="true">
          <div class="home-hero__photo-area" />
        </div>
      </div>
      <!-- Slider dots decoration -->
      <div class="home-hero__dots" aria-hidden="true">
        <span class="home-hero__dot home-hero__dot--active" />
        <span class="home-hero__dot" />
        <span class="home-hero__dot" />
      </div>
    </section>

    <!-- ─── About LITUBO (ANYI-style two-column) ───────── -->
    <section class="home-about section-gap">
      <div class="container home-about__grid">
        <div class="home-about__copy">
          <p class="home-about__eyebrow">ABOUT LITUBO</p>
          <h2 class="home-about__title">A clear route to the right inspection system.</h2>
          <p class="home-about__body">LITUBO supplies food and packaging inspection equipment — X-ray, metal detection, checkweighing and combination systems — with application clarification, product selection and configuration support.</p>
          <p class="home-about__body">Tell us your product, packaging and line conditions. We discuss the exact model with your team.</p>
          <ul class="home-about__features">
            <li>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12M4 20h16M9 20v-6h6v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <strong>Application-specific selection</strong>
            </li>
            <li>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              <strong>Exact-model specifications</strong>
            </li>
            <li>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-4 4V5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              <strong>Technical enquiry support</strong>
            </li>
          </ul>
          <NuxtLink :to="localePath('/company/about')" class="home-about__link">About LITUBO →</NuxtLink>
        </div>
        <div class="home-about__media">
          <img v-if="heroImgSrc && !heroImgError" :src="heroImgSrc" alt="LITUBO inspection systems in production" loading="lazy">
          <div v-else class="home-about__media-placeholder img-placeholder" aria-hidden="true" />
          <p class="home-about__caption">Production line inspection — illustrative image</p>
        </div>
      </div>
    </section>

    <!-- ─── Find inspection systems (category grid) ───── -->
    <section class="home-cats section-gap section-alt">
      <div class="container">
        <div class="home-cats__header">
          <h2 class="home-section-title">Find inspection systems</h2>
          <NuxtLink :to="localePath('/products')" class="home-all-link">Explore all categories →</NuxtLink>
        </div>
        <p class="home-cats__sub">Five proven technology lines, configurable for your production environment.</p>
        <div class="home-cats__grid">
          <NuxtLink v-for="c in catCards" :key="c.slug" :to="localePath(`/products/${c.slug}`)" class="home-cat-card">
            <div class="home-cat-card__media img-placeholder img-placeholder--light" aria-hidden="true" />
            <div class="home-cat-card__body">
              <h3 class="home-cat-card__title">{{ c.title }}</h3>
              <p class="home-cat-card__desc">{{ c.desc }}</p>
              <span class="home-cat-card__link">Explore systems →</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ─── Latest from LITUBO ────────────────────────── -->
    <section v-if="latestResources.length" class="home-latest section-gap section-alt" aria-label="Latest resources">
      <div class="container">
        <div class="home-latest__header">
          <h2 class="home-section-title">{{ t('pages.home.latestTitle') }}</h2>
          <NuxtLink :to="localePath('/resources')" class="home-all-link">
            {{ t('pages.home.latestCta') }}
            <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </NuxtLink>
        </div>
        <div class="home-latest__grid">
          <article v-for="item in latestResources" :key="item.title" class="resource-card">
            <NuxtLink :to="localePath(item.to)" class="resource-card__link">
              <div class="resource-card__photo img-placeholder img-placeholder--light" aria-hidden="true" />
              <div class="resource-card__body">
                <p class="resource-card__tag">{{ item.tag }}</p>
                <h3 class="resource-card__title">{{ item.title }}</h3>
                <p class="resource-card__excerpt">{{ item.excerpt }}</p>
                <span class="resource-card__read" aria-hidden="true">Read more →</span>
              </div>
            </NuxtLink>
          </article>
        </div>
      </div>
    </section>

    <!-- ─── FAQ teaser ────────────────────────────────── -->
    <section v-if="faqQuestions.length" class="home-faq section-gap" aria-labelledby="faq-heading">
      <div class="container">
        <h2 id="faq-heading" class="home-faq__title">{{ t('pages.home.faqTitle') }}</h2>
        <p class="home-faq__subtitle">{{ t('pages.home.faqSubtitle') }}</p>
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
          <NuxtLink :to="localePath('/support/faq')" class="home-all-link">
            {{ t('pages.home.faqCta') }}
            <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ─── CTA banner ────────────────────────────────── -->
    <section class="home-cta-banner" aria-label="Contact CTA">
      <div class="container home-cta-banner__inner">
        <div class="home-cta-banner__content">
          <h2 class="home-cta-banner__title">{{ t('pages.home.ctaTitle') }}</h2>
          <p class="home-cta-banner__body">{{ t('pages.home.ctaBody') }}</p>
          <NuxtLink :to="localePath('/contact')" class="cta-banner-btn">
            {{ t('pages.home.ctaCta') }}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </NuxtLink>
        </div>
        <div class="home-cta-banner__media" aria-hidden="true">
          <div class="home-cta-banner__photo" />
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ─── Shared section utilities ─────────────────────────── */
.section-gap { padding: var(--space-20) 0; }
.section-alt { background: var(--color-canvas); }

.home-section-title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-primary);
  line-height: var(--leading-snug);
}

.home-all-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--transition-fast);
}

.home-all-link:hover { color: #b85f15; }

/* ─── Hero ─────────────────────────────────────────────── */
.home-hero {
  position: relative;
  background: var(--color-primary-deep);
  min-height: clamp(540px, 68vh, 720px);
  display: flex;
  flex-direction: column;
}

/* ─── Hero background image layer ─────────────────────── */
.home-hero__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.home-hero__bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}

.home-hero__bg-overlay {
  position: absolute;
  inset: 0;
  /* Desktop: readable left, the photograph shows through on the right */
  background: linear-gradient(
    90deg,
    rgba(18, 60, 50, 0.86) 0%,
    rgba(18, 60, 50, 0.76) 38%,
    rgba(18, 60, 50, 0.40) 62%,
    rgba(18, 60, 50, 0.16) 100%
  );
}

.home-hero__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  max-width: var(--container-max);
  margin: 0 auto;
  width: 100%;
  padding-inline: var(--container-pad);
  position: relative;
  z-index: 1;
}

.home-hero__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--space-20) var(--space-10) var(--space-20) 0;
}

.home-hero__eyebrow {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-accent);
  margin-bottom: var(--space-4);
}

.home-hero__title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.5vw, var(--text-6xl));
  font-weight: 700;
  line-height: var(--leading-tight);
  color: var(--color-white);
  margin-bottom: var(--space-5);
}

.home-hero__subtitle {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.7);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-8);
  max-width: 440px;
}

.home-hero__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 13px var(--space-6);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}

.hero-btn--primary {
  background: var(--color-accent);
  color: var(--color-white);
  border-color: var(--color-accent);
}

.hero-btn--primary:hover {
  background: #b85f15;
  border-color: #b85f15;
}

.hero-btn--outline {
  background: transparent;
  color: var(--color-white);
  border-color: rgba(255, 255, 255, 0.4);
}

.hero-btn--outline:hover {
  border-color: var(--color-white);
  background: rgba(255, 255, 255, 0.08);
}

.home-hero__media {
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.home-hero__photo-area {
  /* Transparent — image visible via .home-hero__bg-img background layer.
     Fallback: .home-hero { background: var(--color-primary-deep) } takes effect. */
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: transparent;
}

.home-hero__dots {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--container-pad) var(--space-5);
  max-width: var(--container-max);
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 1;
}

.home-hero__dot {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

.home-hero__dot--active {
  background: var(--color-accent);
  width: 18px;
  border-radius: 3px;
}

/* ─── Path section ─────────────────────────────────────── */
.home-path__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-8);
  line-height: var(--leading-snug);
}

.home-path__cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

.home-path__card {
  background: var(--color-primary-deep);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.home-path__card-photo {
  height: 200px;
}

.home-path__card-photo--alt {
  height: 200px;
}

.home-path__card-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  flex: 1;
}

.home-path__card-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-white);
  line-height: var(--leading-snug);
}

.home-path__card-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.path-card-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 9px var(--space-4);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-white);
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  width: fit-content;
}

.path-card-btn:hover {
  border-color: var(--color-white);
  background: rgba(255, 255, 255, 0.08);
}

/* ─── Latest resources ─────────────────────────────────── */
.home-latest__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.home-latest__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.resource-card {
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
}

.resource-card:hover {
  box-shadow: 0 4px 20px rgba(18, 60, 50, 0.1);
}

.resource-card__link {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
  color: inherit;
}

.resource-card__photo {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.resource-card__body {
  padding: var(--space-5);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.resource-card__tag {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.resource-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-ink);
  line-height: var(--leading-snug);
}

.resource-card__excerpt {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  flex: 1;
}

.resource-card__read {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-accent);
  margin-top: var(--space-3);
}

/* ─── FAQ teaser ───────────────────────────────────────── */
.home-faq {
  background: var(--color-surface-alt);
}

.home-faq__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-primary);
  text-align: center;
  margin-bottom: var(--space-3);
  line-height: var(--leading-snug);
}

.home-faq__subtitle {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  text-align: center;
  max-width: 480px;
  margin: 0 auto var(--space-8);
  line-height: var(--leading-normal);
}

.home-faq__questions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3) var(--space-8);
  max-width: 840px;
  margin: 0 auto var(--space-8);
}

.home-faq__question-link {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink);
  text-decoration: none;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-line);
  transition: color var(--transition-fast);
  line-height: var(--leading-snug);
}

.home-faq__question-link:hover { color: var(--color-primary); }

.home-faq__q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-accent);
}

.home-faq__footer {
  text-align: center;
}

/* ─── CTA banner ───────────────────────────────────────── */
.home-cta-banner {
  background: var(--color-primary-deep);
  overflow: hidden;
}

.home-cta-banner__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 360px;
}

.home-cta-banner__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--space-16) var(--space-10) var(--space-16) 0;
  gap: var(--space-5);
}

.home-cta-banner__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-white);
  line-height: var(--leading-snug);
}

.home-cta-banner__body {
  font-size: var(--text-base);
  color: rgba(255, 255, 255, 0.65);
  line-height: var(--leading-normal);
  max-width: 420px;
}

.cta-banner-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 13px var(--space-6);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-white);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  width: fit-content;
}

.cta-banner-btn:hover {
  border-color: var(--color-white);
  background: rgba(255, 255, 255, 0.08);
}

.home-cta-banner__media {
  overflow: hidden;
}

.home-cta-banner__photo {
  width: 100%;
  height: 100%;
  min-height: 360px;
  background: linear-gradient(
    90deg,
    var(--color-primary-deep) 0%,
    rgba(15, 92, 75, 0.5) 40%,
    rgba(15, 92, 75, 0.3) 100%
  ),
  repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 1px,
    transparent 1px,
    transparent 8px
  );
}

/* ─── Responsive ───────────────────────────────────────── */
@media (max-width: 1023px) {
  .home-latest__grid {
    grid-template-columns: 1fr 1fr;
  }
  .home-latest__grid > *:last-child {
    display: none;
  }
}

@media (max-width: 767px) {
  /* Hero: stack vertically, image visible as full-bleed bg behind text */
  .home-hero__bg-overlay {
    /* Uniform strong overlay — text spans full width on mobile */
    background: rgba(18, 60, 50, 0.87);
  }
  .home-hero__bg-img {
    /* Crop to mid-conveyor / device area */
    object-position: center 40%;
  }
  .home-hero__inner {
    grid-template-columns: 1fr;
    padding-inline: var(--space-5);
  }
  .home-hero__content {
    padding: var(--space-10) 0 var(--space-6);
  }
  .home-hero__subtitle {
    max-width: 100%;
  }
  .home-hero__media {
    display: none;
  }
  .home-hero__actions {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-btn {
    width: 100%;
    justify-content: center;
  }
  /* Path: stack cards */
  .home-path__cards {
    grid-template-columns: 1fr;
  }
  /* Latest: 1 col */
  .home-latest__grid {
    grid-template-columns: 1fr;
  }
  .home-latest__grid > *:last-child {
    display: block;
  }
  /* FAQ: 1 col */
  .home-faq__questions {
    grid-template-columns: 1fr;
  }
  /* CTA banner: stack */
  .home-cta-banner__inner {
    grid-template-columns: 1fr;
  }
  .home-cta-banner__content {
    padding: var(--space-10) 0;
  }
  .home-cta-banner__media {
    display: none;
  }
}

@media (max-width: 479px) {
  .section-gap { padding: var(--space-12) 0; }
  .home-hero__title {
    font-size: var(--text-3xl);
  }
  .hero-btn {
    padding: 11px var(--space-4);
    font-size: var(--text-sm);
  }
  .home-path__card-photo {
    height: 140px;
  }
}

/* ─── About LITUBO (ANYI-style) ─── */
.home-about { background: var(--color-white); }
.home-about__grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: var(--space-16); align-items: center; }
.home-about__eyebrow { color: var(--color-primary); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 var(--space-3); }
.home-about__title { font-family: var(--font-display); font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl)); font-weight: 600; line-height: var(--leading-tight); color: var(--color-primary-deep); margin: 0 0 var(--space-5); }
.home-about__body { font-size: var(--text-base); line-height: var(--leading-normal); color: var(--color-ink-muted); margin: 0 0 var(--space-4); max-width: 560px; }
.home-about__features { list-style: none; padding: 0; margin: var(--space-6) 0; display: flex; flex-direction: column; gap: var(--space-3); }
.home-about__features li { display: flex; align-items: center; gap: var(--space-3); color: var(--color-ink); font-size: var(--text-sm); }
.home-about__features svg { color: var(--color-primary); flex: 0 0 auto; }
.home-about__link { color: var(--color-primary); font-weight: 600; font-size: var(--text-sm); text-decoration: none; }
.home-about__link:hover { text-decoration: underline; }
.home-about__media { position: relative; }
.home-about__media img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius-sm); }
.home-about__media-placeholder { width: 100%; aspect-ratio: 4 / 3; border-radius: var(--radius-sm); }
.home-about__caption { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-2) 0 0; text-align: right; }

/* ─── Find inspection systems (category grid) ─── */
.home-cats__header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); }
.home-cats__sub { color: var(--color-ink-muted); font-size: var(--text-base); margin: var(--space-2) 0 var(--space-8); }
.home-cats__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-6); }
.home-cat-card { display: flex; flex-direction: column; background: var(--color-white); border: 1px solid var(--color-line); border-radius: var(--radius-sm); overflow: hidden; text-decoration: none; color: inherit; transition: box-shadow var(--transition-normal); }
.home-cat-card:hover { box-shadow: 0 4px 20px rgba(18,60,50,.14); }
.home-cat-card__media { aspect-ratio: 4 / 3; }
.home-cat-card__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
.home-cat-card__title { font-family: var(--font-display); font-size: var(--text-lg); font-weight: 600; color: var(--color-primary); margin: 0; }
.home-cat-card__desc { font-size: var(--text-sm); color: var(--color-ink-muted); line-height: var(--leading-normal); margin: 0; flex: 1; }
.home-cat-card__link { font-size: var(--text-sm); font-weight: 600; color: var(--color-accent); }
@media (max-width: 900px) { .home-about__grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-8); } }
</style>
