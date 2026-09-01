<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('seo.home.title'),
  meta: [
    { name: 'description', content: t('seo.home.description') },
    { property: 'og:title', content: t('seo.home.title') },
    { property: 'og:description', content: t('seo.home.description') },
    { property: 'og:type', content: 'website' },
  ],
})

const demoResources = [
  {
    tag: 'GUIDE',
    title: 'What to look for in an X-ray inspection system',
    excerpt: 'Key parameters and performance checklist for evaluating X-ray detection on your production line.',
    to: '/resources',
  },
  {
    tag: 'INSIGHT',
    title: 'Managing false rejects: common causes and solutions',
    excerpt: 'How to reduce costly product waste without compromising contaminant detection performance.',
    to: '/resources',
  },
  {
    tag: 'GUIDE',
    title: 'Selecting the right checkweigher for your line',
    excerpt: 'Speed, accuracy, and integration requirements — a practical guide to checkweigher selection.',
    to: '/resources',
  },
]

const faqQuestions = [
  'What contaminants can X-ray inspection detect?',
  'How does metal detection work with wet or conductive products?',
  'Which inspection technology suits packaged food?',
  'What integration options are available for LITUBO systems?',
  'How do I request service or spare parts?',
  'Can LITUBO help with regulatory compliance documentation?',
]
</script>

<template>
  <div class="page-home">

    <!-- ─── Hero ──────────────────────────────────────── -->
    <section class="home-hero" aria-label="Hero">
      <div class="home-hero__inner">
        <!-- Text side -->
        <div class="home-hero__content">
          <p class="home-hero__eyebrow">{{ t('pages.home.heroEyebrow') }}</p>
          <h1 class="home-hero__title">{{ t('pages.home.heroTitle') }}</h1>
          <p class="home-hero__subtitle">{{ t('pages.home.heroSubtitle') }}</p>
          <div class="home-hero__actions">
            <NuxtLink :to="localePath('/products')" class="hero-btn hero-btn--primary">
              {{ t('pages.home.heroCta') }}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </NuxtLink>
            <NuxtLink :to="localePath('/contact')" class="hero-btn hero-btn--outline">
              {{ t('pages.home.heroCtaSecondary') }}
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

    <!-- ─── Find the right path ───────────────────────── -->
    <section class="home-path section-gap">
      <div class="container">
        <h2 class="home-path__title">{{ t('pages.home.pathTitle') }}</h2>
        <div class="home-path__cards">

          <!-- Card 1: Looking for equipment -->
          <div class="home-path__card">
            <div class="home-path__card-photo" aria-hidden="true" />
            <div class="home-path__card-body">
              <h3 class="home-path__card-title">{{ t('pages.home.pathCard1Title') }}</h3>
              <div class="home-path__card-actions">
                <NuxtLink :to="localePath('/products')" class="path-card-btn">
                  {{ t('pages.home.pathCard1Cta1') }}
                  <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                    <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </NuxtLink>
                <NuxtLink :to="localePath('/applications')" class="path-card-btn">
                  {{ t('pages.home.pathCard1Cta2') }}
                  <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                    <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Card 2: Already working with LITUBO -->
          <div class="home-path__card">
            <div class="home-path__card-photo home-path__card-photo--alt" aria-hidden="true" />
            <div class="home-path__card-body">
              <h3 class="home-path__card-title">{{ t('pages.home.pathCard2Title') }}</h3>
              <div class="home-path__card-actions">
                <NuxtLink :to="localePath('/technical-matching')" class="path-card-btn">
                  {{ t('pages.home.pathCard2Cta1') }}
                  <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                    <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </NuxtLink>
                <NuxtLink :to="localePath('/contact')" class="path-card-btn">
                  {{ t('pages.home.pathCard2Cta2') }}
                  <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                    <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </NuxtLink>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ─── Latest from LITUBO ────────────────────────── -->
    <section class="home-latest section-gap section-alt" aria-label="Latest resources">
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
        <!-- DEMO notice -->
        <p class="demo-notice" aria-label="Demo content notice">{{ t('pages.home.demoNotice') }}</p>
        <div class="home-latest__grid">
          <article v-for="item in demoResources" :key="item.title" class="resource-card">
            <NuxtLink :to="localePath(item.to)" class="resource-card__link">
              <div class="resource-card__photo" aria-hidden="true" />
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
    <section class="home-faq section-gap" aria-labelledby="faq-heading">
      <div class="container">
        <h2 id="faq-heading" class="home-faq__title">{{ t('pages.home.faqTitle') }}</h2>
        <p class="home-faq__subtitle">{{ t('pages.home.faqSubtitle') }}</p>
        <!-- Non-functional search (Phase 1 — static) -->
        <div class="home-faq__search" role="search" aria-label="FAQ search (not yet active)">
          <svg class="home-faq__search-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M9 17A8 8 0 109 1a8 8 0 000 16zM19 19l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            class="home-faq__search-input"
            type="search"
            :placeholder="t('pages.home.faqSearch')"
            disabled
            aria-disabled="true"
          >
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

.demo-notice {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-white);
  background: #b85f15;
  padding: 2px 8px;
  border-radius: 2px;
  margin-bottom: var(--space-6);
}

/* ─── Hero ─────────────────────────────────────────────── */
.home-hero {
  position: relative;
  background: var(--color-primary-deep);
  min-height: calc(100vh - var(--header-height));
  display: flex;
  flex-direction: column;
}

.home-hero__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  max-width: var(--container-max);
  margin: 0 auto;
  width: 100%;
  padding-inline: var(--container-pad);
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
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: linear-gradient(135deg, rgba(15, 92, 75, 0.6) 0%, rgba(18, 60, 50, 0.9) 100%),
    repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.02) 0px,
      rgba(255, 255, 255, 0.02) 1px,
      transparent 1px,
      transparent 8px
    );
}

.home-hero__dots {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--container-pad) var(--space-5);
  max-width: var(--container-max);
  margin: 0 auto;
  width: 100%;
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
  background: linear-gradient(
    160deg,
    rgba(15, 92, 75, 0.4) 0%,
    rgba(18, 60, 50, 0.95) 100%
  ),
  repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 1px,
    transparent 1px,
    transparent 10px
  );
}

.home-path__card-photo--alt {
  background: linear-gradient(
    160deg,
    rgba(208, 111, 27, 0.15) 0%,
    rgba(18, 60, 50, 0.95) 100%
  ),
  repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 1px,
    transparent 1px,
    transparent 10px
  );
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

.home-faq__search {
  position: relative;
  max-width: 640px;
  margin: 0 auto var(--space-8);
}

.home-faq__search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-ink-muted);
  pointer-events: none;
}

.home-faq__search-input {
  width: 100%;
  padding: 14px var(--space-4) 14px 44px;
  font-size: var(--text-base);
  font-family: var(--font-body);
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-ink);
  cursor: not-allowed;
  opacity: 0.7;
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
  /* Hero: stack vertically */
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
</style>
