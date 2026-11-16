<script setup lang="ts">
import { industryGuide } from '~/content/industry-guides'

/**
 * Application detail — one shared template, eight independent content sets.
 *
 * Order follows the V3 handoff: first screen (text + product scene) → three in-page steps →
 * industry questions beside the production scene → product and line notes → device family entry →
 * preparation list and enquiry → shared footer.
 *
 * Nothing here states a performance figure, a recommended model or a customer reference. Both
 * scenes are generated, and the caption says so.
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

const headlineLines = computed(() => guide.headline.split('\n').filter(Boolean))

const approaches = [
  {
    title: 'X-ray inspection',
    body: 'Finds dense contaminants and checks fill or count where the pack allows a beam to pass.',
    image: '/images/devices/xray-real.webp',
    to: '/products/x-ray-inspection',
  },
  {
    title: 'Metal detection',
    body: 'Detects ferrous, non-ferrous and stainless contamination, including through many pack formats.',
    image: '/images/devices/metal-real.webp',
    to: '/products/metal-detection',
  },
  {
    title: 'Checkweighing',
    body: 'Verifies that each pack carries the weight it should, independent of the product itself.',
    image: '/images/devices/weigher-real.webp',
    to: '/products/checkweighers',
  },
]

const steps = [
  { id: 'product', label: 'Product & pack' },
  { id: 'line', label: 'Production line' },
  { id: 'discuss', label: 'Technical discussion' },
]
</script>

<template>
  <div class="application-page">
    <!-- 1. First screen: statement, intro, one clear entry, and the product scene -->
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
            <p class="eyebrow">{{ guide.title }}</p>
            <h1 class="app-hero__headline">
              <span v-for="line in headlineLines" :key="line">{{ line }}</span>
            </h1>
            <p class="app-hero__intro">{{ guide.intro }}</p>
            <NuxtLink :to="localePath(inquiryPath)" class="app-cta">
              Discuss this application →
            </NuxtLink>
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

    <!-- 2. Three steps: in-page index -->
    <nav class="app-steps" aria-label="On this page">
      <div class="container app-steps__inner">
        <a v-for="(step, index) in steps" :key="step.id" :href="`#${step.id}`" class="app-steps__item">
          <span class="app-steps__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span>{{ step.label }}</span>
        </a>
      </div>
    </nav>

    <!-- 3. Industry questions beside the production scene -->
    <section id="product" class="section-gap">
      <div class="container app-lead">
        <div class="app-lead__text">
          <p class="eyebrow">What this application involves</p>
          <h2 class="app-h2">{{ guide.productTitle }}</h2>
          <p class="app-body">{{ guide.productNote }}</p>
          <ul class="app-considerations" role="list">
            <li v-for="item in guide.questions" :key="item">{{ item }}</li>
          </ul>
        </div>
        <figure class="app-lead__media">
          <img
            :src="guide.productionImage"
            :alt="guide.productionAlt"
            width="1200"
            height="900"
            loading="lazy"
            decoding="async"
          >
        </figure>
      </div>
    </section>

    <!-- 4. Product and line, interleaved; device entry is a family, not a model -->
    <section id="line" class="section-gap section-alt">
      <div class="container">
        <div class="app-split">
          <div class="app-split__text">
            <p class="eyebrow">The product and the pack</p>
            <h2 class="app-h2">{{ guide.lineTitle }}</h2>
            <p class="app-body">{{ guide.lineNote }}</p>
          </div>
          <div class="app-split__aside">
            <p class="app-aside-label">Item presentation</p>
            <ul class="app-aside-list" role="list">
              <li v-for="item in guide.presentation" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div class="app-split app-split--reverse">
          <div class="app-split__text">
            <p class="eyebrow">The line</p>
            <h2 class="app-h2">What the machine has to fit into</h2>
            <ul class="app-considerations" role="list">
              <li v-for="item in guide.lineItems" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div id="discuss" class="app-split__aside">
            <p class="app-aside-label">Representative family</p>
            <NuxtLink :to="localePath(guide.family.to)" class="app-family">
              {{ guide.family.label }} →
            </NuxtLink>
            <p class="app-aside-note">
              A family page, not a recommended model. The configuration is confirmed against your own
              product and line.
            </p>
            <NuxtLink :to="localePath('/technical-matching')" class="app-family app-family--second">
              Technical matching →
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Inspection approaches — real device photographs, each linking to a real category -->
    <section class="section-gap section-alt">
      <div class="container">
        <p class="eyebrow">Inspection approaches to discuss</p>
        <h2 class="app-h2">Which technology is worth discussing</h2>
        <p class="app-body app-body--wide">
          The right approach follows from what has to be found and how the product is presented. These
          are the families the discussion usually starts from.
        </p>
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
      </div>
    </section>

    <!-- 5. What to prepare, then the enquiry -->
    <section class="section-gap">
      <div class="container app-prep">
        <p class="eyebrow">What to prepare</p>
        <h2 class="app-h2">What we need from you</h2>
        <ul class="app-prep__list" role="list">
          <li v-for="(item, index) in guide.prep" :key="item">
            <span class="app-prep__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ item }}</span>
          </li>
        </ul>
        <p class="app-prep__note">
          You do not need all of it to start. A photo of the pack and a short description of the
          problem is usually enough for a first reply.
        </p>
      </div>
    </section>

    <section class="section-gap section-alt">
      <div class="container">
        <div class="app-inquiry">
          <div class="app-inquiry__text">
            <h2 class="app-h2">A useful enquiry starts with a few details</h2>
            <p class="app-body">
              We do not match products automatically. A short description of the product, the pack and
              the line is enough for our team to reply with a considered answer.
            </p>
            <ul class="app-inquiry__points" role="list">
              <li>Thoughtful answers from people who know the equipment</li>
              <li>The configuration is confirmed for your product, not assumed</li>
            </ul>
          </div>
          <div class="app-inquiry__card">
            <p class="app-aside-label">What would you like to inspect?</p>
            <ul class="app-inquiry__fields" role="list">
              <li>Product category</li>
              <li>Pack format</li>
              <li>Your inspection objective</li>
              <li>Additional notes</li>
            </ul>
            <NuxtLink :to="localePath(inquiryPath)" class="app-cta app-cta--block">
              Continue with these details →
            </NuxtLink>
            <p class="app-inquiry__note">
              This is a preview of the model. The live enquiry form is the LITUBO contact form.
            </p>
          </div>
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
.section-gap { padding: var(--space-16) 0; }

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
  max-width: 640px;
}

/* ── First screen ─────────────────────────────────── */
.app-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
  align-items: center;
  padding-block: var(--space-6);
}

.app-hero__headline {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 3.2vw, var(--text-5xl));
  line-height: 1.12;
  color: var(--color-ink);
}
.app-hero__headline span { display: block; }

.app-hero__intro {
  margin: 0 0 var(--space-5);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 560px;
}

.app-hero__media { margin: 0; }
.app-hero__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
  background: #F2F8F4;
}
.app-hero__media figcaption,
.app-lead__media figcaption {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}

.app-cta {
  display: inline-block;
  padding: 14px 24px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.app-cta:hover { background: var(--color-primary-deep); }

/* ── Three steps ──────────────────────────────────── */
.app-steps {
  border-block: 1px solid #DAE3DD;
  background: #fff;
}
.app-steps__inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  padding-block: var(--space-3);
}
.app-steps__item {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  text-decoration: none;
}
.app-steps__item:hover { color: var(--color-primary); }
.app-steps__index {
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--color-primary);
}

/* ── Questions beside the production scene ────────── */
.app-lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 56px;
  align-items: start;
}
.app-lead__media { margin: 0; }
.app-lead__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
  background: #F2F8F4;
}

.app-considerations { margin: 0; padding: 0; list-style: none; }
.app-considerations li {
  position: relative;
  padding-inline-start: var(--space-5);
  margin-bottom: var(--space-3);
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-ink-muted);
}
.app-considerations li::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 0.62em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
}

/* ── Interleaved splits ───────────────────────────── */
.app-split {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 56px;
  align-items: start;
  padding-bottom: var(--space-10);
  border-bottom: 1px solid #DAE3DD;
  margin-bottom: var(--space-10);
}
.app-split--reverse .app-split__text { order: 2; }
.app-split--reverse .app-split__aside { order: 1; }
.app-split:last-child { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }

.app-aside-label {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.app-aside-list { margin: 0; padding: 0; list-style: none; }
.app-aside-list li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid #E7EDE8;
  font-size: var(--text-sm);
  color: var(--color-ink);
}
.app-family {
  display: inline-block;
  font-size: var(--text-base);
  color: var(--color-link-on-light);
  text-decoration: none;
}
.app-family:hover { text-decoration: underline; }
.app-family--second { margin-top: var(--space-3); display: block; }
.app-aside-note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-ink-muted);
}

/* ── Inspection approaches ─────────────────────────────── */
.app-body--wide { max-width: 720px; }

.app-approaches {
  list-style: none;
  margin: var(--space-8) 0 0;
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
  height: 150px;
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

/* ── Preparation ──────────────────────────────────── */
.app-prep__list { list-style: none; margin: var(--space-5) 0 0; padding: 0; }
.app-prep__list li {
  display: flex;
  gap: var(--space-4);
  align-items: baseline;
  padding: var(--space-3) 0;
  border-bottom: 1px solid #E7EDE8;
  font-size: var(--text-base);
  color: var(--color-ink);
}
.app-prep__index {
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--color-ink-muted);
  flex: none;
}
.app-prep__note {
  margin: var(--space-5) 0 0;
  max-width: 640px;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

/* ── Enquiry card ─────────────────────────────────── */
.app-inquiry {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 56px;
  align-items: start;
}
.app-inquiry__points { list-style: none; margin: var(--space-4) 0 0; padding: 0; }
.app-inquiry__points li {
  position: relative;
  padding-inline-start: var(--space-5);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}
.app-inquiry__points li::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 0.6em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
}
.app-inquiry__card {
  padding: var(--space-6);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.app-inquiry__fields { list-style: none; margin: var(--space-3) 0 var(--space-5); padding: 0; }
.app-inquiry__fields li {
  padding: var(--space-3);
  margin-bottom: var(--space-2);
  border: 1px solid #E7EDE8;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}
.app-cta--block { display: block; text-align: center; }
.app-inquiry__note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.app-inquiry__text .app-body { max-width: none; }

@media (max-width: 1023px) {
  .app-hero,
  .app-lead,
  .app-split { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  /* Text first, then the image, on narrow screens. */
  .app-hero__media { order: 2; }
  .app-split--reverse .app-split__text { order: 1; }
  .app-split--reverse .app-split__aside { order: 2; }
  .app-steps__inner { gap: var(--space-3); }
  .app-approaches { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .app-inquiry { grid-template-columns: minmax(0, 1fr); gap: 28px; }
}

@media (max-width: 700px) {
  .app-h2 { font-size: var(--text-xl); }
  .app-hero__headline { font-size: var(--text-2xl); }
  .app-approaches { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .app-split { padding-bottom: var(--space-8); margin-bottom: var(--space-8); }
}
</style>
