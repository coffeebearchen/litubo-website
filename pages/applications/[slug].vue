<script setup lang="ts">
import { industryGuide } from '~/content/industry-guides'

/**
 * Application detail — one shared template, eight independent content sets.
 *
 * Structure and copy order follow the V3 reference page exactly:
 *   hero (eyebrow · title · intro · two entries · product scene)
 *   → three-step index
 *   → THE PRODUCT (text left, numbered questions right)
 *   → THE PRODUCTION LINE (scene left, text and line items right, closing note)
 *   → EQUIPMENT FAMILIES (three real device families)
 *   → PREPARE THE DISCUSSION (what to bring left, enquiry card right)
 *   → "Not sure where to start?" band
 *   → shared footer
 *
 * Nothing here states a performance figure, a recommended model or a customer reference.
 */
assertPublishedLocale()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const guide = industryGuide(String(route.params.slug))
if (!guide) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useSeoHead({
  title: `${guide.title} Inspection — LITUBO`,
  description: guide.intro,
  canonicalPath: `/applications/${guide.slug}`,
})

const inquiryPath = `/contact?application=${encodeURIComponent(guide.slug)}`

// Labels and subtitles are copied from the V3 reference; do not paraphrase them.
const steps = [
  { id: 'product', label: 'Product & packaging', sub: 'Define the inspection question' },
  { id: 'line', label: 'Your production line', sub: 'Bring the process into view' },
  { id: 'discuss', label: 'Prepare the discussion', sub: 'Share a few useful details' },
]

const approaches = [
  {
    title: 'X-ray inspection',
    body: 'Discuss your product, packaging and the inspection question.',
    image: '/images/devices/xray-real.webp',
    to: '/products/x-ray-inspection',
  },
  {
    title: 'Metal detection',
    body: 'Review the material concern and proposed inspection point.',
    image: '/images/devices/metal-real.webp',
    to: '/products/metal-detection',
  },
  {
    title: 'Checkweighing',
    body: 'For finished-pack weight checks, share the pack and line conditions.',
    image: '/images/devices/weigher-real.webp',
    to: '/products/checkweighers',
  },
]
</script>

<template>
  <div class="application-page">
    <!-- Hero: eyebrow · title · intro · two entries · product scene -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.applications'), to: localePath('/applications') },
            { label: guide.title },
          ]"
        />
        <div class="app-hero">
          <div class="app-hero__text">
            <p class="eyebrow">Inspection by application</p>
            <h1 class="app-hero__title">{{ guide.title }}</h1>
            <p class="app-hero__intro">{{ guide.intro }}</p>
            <p class="app-hero__actions">
              <NuxtLink :to="localePath(inquiryPath)" class="app-cta">
                Discuss this application
              </NuxtLink>
              <a href="#product" class="app-link">Explore the process ↓</a>
            </p>
            <p class="app-hero__note">
              Start with what you know. Final suitability and configuration require technical review.
            </p>
          </div>
          <figure class="app-hero__media">
            <img
              :src="guide.productImage"
              :alt="guide.productAlt"
              width="1200"
              height="900"
              loading="eager"
              decoding="async"
            >
          </figure>
        </div>
      </div>
    </section>

    <!-- Three-step index -->
    <nav class="app-steps" aria-label="On this page">
      <div class="container">
        <div class="app-steps__inner">
          <a v-for="(step, index) in steps" :key="step.id" :href="`#${step.id}`" class="app-steps__item">
            <span class="app-steps__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="app-steps__text">
              <span class="app-steps__label">{{ step.label }}</span>
              <span class="app-steps__sub">{{ step.sub }}</span>
            </span>
          </a>
        </div>
      </div>
    </nav>

    <!-- THE PRODUCT: text left, numbered questions right -->
    <section id="product" class="app-band">
      <div class="container">
        <div class="app-split">
          <div class="app-split__text">
            <p class="eyebrow">The product</p>
            <h2 class="app-h2">{{ guide.productTitle }}</h2>
            <p class="app-body">{{ guide.productNote }}</p>
          </div>
          <ol class="app-numbered" role="list">
            <li v-for="(item, index) in guide.questions" :key="item">
              <span class="app-numbered__index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span>{{ item }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- THE PRODUCTION LINE: scene left, text and line items right -->
    <section id="line" class="app-band app-band--tint">
      <div class="container">
        <div class="app-split app-split--media">
          <figure class="app-split__media">
            <img
              :src="guide.productionImage"
              :alt="guide.productionAlt"
              width="1200"
              height="900"
              loading="lazy"
              decoding="async"
            >
          </figure>
          <div class="app-split__text">
            <p class="eyebrow">The production line</p>
            <h2 class="app-h2">{{ guide.lineTitle }}</h2>
            <p class="app-body">{{ guide.lineNote }}</p>
            <ul class="app-lined" role="list">
              <li v-for="item in guide.lineItems" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div class="app-note">
          <p class="app-note__title">Make room for the complete process.</p>
          <p class="app-note__body">
            A simple line description can help the team discuss access, transfer and rejected-product
            handling.
          </p>
        </div>
      </div>
    </section>

    <!-- EQUIPMENT FAMILIES -->
    <section id="discuss" class="app-band">
      <div class="container">
        <div class="app-head">
          <div>
            <p class="eyebrow">Equipment families</p>
            <h2 class="app-h2">Inspection approaches to discuss.</h2>
          </div>
          <p class="app-head__aside">
            Explore the families, then confirm the right approach against your actual product.
          </p>
        </div>

        <ul class="app-approaches" role="list">
          <li v-for="item in approaches" :key="item.to" class="app-approach">
            <div class="app-approach__media">
              <img :src="item.image" alt="" width="800" height="481" loading="lazy" decoding="async">
            </div>
            <h3 class="app-approach__title">{{ item.title }}</h3>
            <p class="app-approach__body">{{ item.body }}</p>
            <NuxtLink :to="localePath(item.to)" class="app-approach__link">Explore the family →</NuxtLink>
          </li>
        </ul>

        <p class="app-footnote">
          Equipment photos show existing product families. They are not recommendations for this
          application or evidence of a particular installation.
        </p>
      </div>
    </section>

    <!-- PREPARE THE DISCUSSION: what to bring left, enquiry card right -->
    <section class="app-band app-band--tint">
      <div class="container">
        <div class="app-inquiry">
          <div class="app-inquiry__text">
            <p class="eyebrow">Prepare the discussion</p>
            <h2 class="app-h2">A useful enquiry starts with a few details.</h2>
            <p class="app-body">
              You do not need every answer to begin. Share the product and the question you want to
              resolve.
            </p>
            <ul class="app-lined" role="list">
              <li v-for="item in guide.prep" :key="item">{{ item }}</li>
            </ul>
            <p class="app-footnote">
              Product photos and a simple line description can help prepare the discussion.
            </p>
          </div>

          <div class="app-inquiry__card">
            <p class="app-inquiry__context">Application: {{ guide.title }}</p>
            <h3 class="app-inquiry__title">What would you like to inspect?</h3>
            <dl class="app-inquiry__fields">
              <div>
                <dt>Product presentation</dt>
                <dd>{{ guide.presentation.join(' · ') }}</dd>
              </div>
              <div>
                <dt>Work email</dt>
                <dd>your@company.com</dd>
              </div>
              <div>
                <dt>Your inspection question</dt>
                <dd>Tell us about your product, packaging and line.</dd>
              </div>
            </dl>
            <NuxtLink :to="localePath(inquiryPath)" class="app-cta app-cta--block">
              Send application enquiry
            </NuxtLink>
            <p class="app-inquiry__note">
              The live form is the LITUBO contact form; the application is attached automatically.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Not sure where to start? -->
    <section class="app-band">
      <div class="container">
        <div class="app-help">
          <div>
            <p class="app-help__title">Not sure where to start?</p>
            <p class="app-help__body">Start with your product and an inspection question.</p>
          </div>
          <NuxtLink :to="localePath('/technical-matching')" class="app-cta app-cta--outline">
            Talk through your application →
          </NuxtLink>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.applications')"
      :secondary-to="localePath('/applications')"
    />
  </div>
</template>

<style scoped>
.app-band { padding: var(--space-14) 0; }
.app-band--tint { background: #F2F6F2; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

.app-h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.2;
  color: var(--color-ink);
}

.app-body {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 620px;
}

.app-footnote {
  margin: var(--space-4) 0 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-ink-muted);
}

/* ── Hero ─────────────────────────────────────────── */
.app-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 48px;
  align-items: center;
  padding-block: var(--space-5);
}
.app-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 3.4vw, var(--text-5xl));
  line-height: 1.1;
  color: var(--color-ink);
}
.app-hero__intro {
  margin: 0 0 var(--space-5);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 520px;
}
.app-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  margin: 0 0 var(--space-3);
}
.app-hero__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.app-hero__media { margin: 0; }
.app-hero__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
  background: #F2F8F4;
}

.app-cta {
  display: inline-block;
  padding: 13px 22px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.app-cta:hover { background: var(--color-primary-deep); }
.app-cta--block { display: block; text-align: center; }
.app-cta--outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
.app-cta--outline:hover { background: var(--color-primary); color: #fff; }
.app-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}
.app-link:hover { text-decoration: underline; }

/* ── Three steps ──────────────────────────────────── */
.app-steps { background: #FAF8F3; padding-block: var(--space-4); }
.app-steps__inner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.app-steps__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  text-decoration: none;
  color: var(--color-ink);
}
.app-steps__item:hover .app-steps__label { color: var(--color-primary); }
.app-steps__index {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  line-height: 1.1;
}
.app-steps__text { display: flex; flex-direction: column; gap: 2px; }
.app-steps__label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.app-steps__sub { font-size: var(--text-xs); color: var(--color-ink-muted); }

/* ── Split blocks ─────────────────────────────────── */
.app-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 56px;
  align-items: start;
}
.app-split--media { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
.app-split__media { margin: 0; }
.app-split__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
  background: #F2F8F4;
}

/* Numbered question list */
.app-numbered { margin: 0; padding: 0; list-style: none; }
.app-numbered li {
  display: flex;
  gap: var(--space-4);
  align-items: baseline;
  padding: var(--space-3) 0;
  border-bottom: 1px solid #E7EDE8;
  font-size: var(--text-base);
  color: var(--color-ink);
}
.app-numbered__index {
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--color-ink-muted);
  flex: none;
}

/* Underlined item list */
.app-lined { margin: var(--space-4) 0 0; padding: 0; list-style: none; }
.app-lined li {
  padding: var(--space-3) 0;
  border-bottom: 1px solid #E7EDE8;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

/* Closing note inside the production band */
.app-note {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--space-6);
  align-items: baseline;
  margin-top: var(--space-8);
  padding: var(--space-5);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.app-note__title { margin: 0; font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.app-note__body { margin: 0; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }

/* ── Equipment families ───────────────────────────── */
.app-head {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 48px;
  align-items: end;
  margin-bottom: var(--space-8);
}
.app-head__aside {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

.app-approaches {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.app-approach {
  display: flex;
  flex-direction: column;
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.app-approach__media { background: #F2F8F4; }
.app-approach__media img {
  display: block;
  width: 100%;
  height: 160px;
  object-fit: contain;
}
.app-approach__title {
  margin: var(--space-4) var(--space-4) var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-ink);
}
.app-approach__body {
  margin: 0 var(--space-4) var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-ink-muted);
  flex: 1;
}
.app-approach__link {
  margin: 0 var(--space-4) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-link-on-light);
  text-decoration: none;
}
.app-approach__link:hover { text-decoration: underline; }

/* ── Prepare + enquiry ────────────────────────────── */
.app-inquiry {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 56px;
  align-items: start;
}
.app-inquiry__card {
  padding: var(--space-6);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.app-inquiry__context {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: #F2F6F2;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.app-inquiry__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--color-ink);
}
.app-inquiry__fields { margin: 0 0 var(--space-5); }
.app-inquiry__fields dt {
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-ink);
}
.app-inquiry__fields dd {
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border: 1px solid #E7EDE8;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}
.app-inquiry__note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

/* ── Not sure where to start ──────────────────────── */
.app-help {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #F2F6F2;
}
.app-help__title { margin: 0 0 var(--space-1); font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.app-help__body { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); }

@media (max-width: 1023px) {
  .app-hero,
  .app-split,
  .app-split--media,
  .app-inquiry,
  .app-note,
  .app-head { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .app-hero__media { order: 2; }
  .app-steps__inner { grid-template-columns: minmax(0, 1fr); }
  .app-approaches { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .app-band { padding: var(--space-10) 0; }
  .app-h2 { font-size: var(--text-xl); }
  .app-approaches { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .app-inquiry__card { padding: var(--space-5); }
  .app-help { flex-direction: column; align-items: flex-start; }
}
</style>
