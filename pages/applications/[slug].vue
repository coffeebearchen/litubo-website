<script setup lang="ts">
import { industryGuide } from '~/content/industry-guides'

/**
 * Application detail — one shared template for the eight confirmed industries.
 *
 * Content order is fixed by the V2 handoff: first screen → process scene → device discussion entry →
 * enquiry. The enquiry keeps the application as its context, so the team knows which application the
 * visitor came from without the visitor retyping it.
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

/** Generated and illustrated scenes must say what they are; a photograph does not carry the note. */
const sceneCaption = computed(() => {
  if (guide.sceneKind === 'generated') return 'AI-generated application scene.'
  if (guide.sceneKind === 'illustration') return 'Illustration shown. A photographed application scene is being prepared.'
  return ''
})
</script>

<template>
  <div>
    <!-- 1. First screen: title, one-sentence positioning, one clear enquiry entry -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.applications'), to: localePath('/applications') },
            { label: guide.title },
          ]"
        />
        <h1 class="page-hero__title">{{ guide.title }}</h1>
        <p class="page-hero__sub">{{ guide.intro }}</p>
        <p class="app-hero__actions">
          <NuxtLink :to="localePath(inquiryPath)" class="app-cta">
            Discuss this application →
          </NuxtLink>
        </p>
      </div>
    </section>

    <!-- 2. The questions this product type raises, beside the scene -->
    <section class="section-gap">
      <div class="container app-lead">
        <div class="app-lead__text">
          <p class="eyebrow">What this application involves</p>
          <h2 class="app-h2">The questions this product type raises</h2>
          <ul class="app-considerations" role="list">
            <li v-for="item in guide.considerations" :key="item">{{ item }}</li>
          </ul>
        </div>
        <figure class="app-lead__media">
          <img
            :src="guide.scene"
            :alt="guide.sceneAlt"
            width="800"
            height="600"
            loading="eager"
            decoding="async"
          >
          <figcaption v-if="sceneCaption">{{ sceneCaption }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- 3. Two interleaved blocks: the product, then the line. Device entry is a family, not a model. -->
    <section class="section-gap section-alt">
      <div class="container">
        <div class="app-split">
          <div class="app-split__text">
            <p class="eyebrow">The product</p>
            <h2 class="app-h2">What is being inspected</h2>
            <p class="app-body">{{ guide.productNote }}</p>
          </div>
          <div class="app-split__aside">
            <p class="app-aside-label">Representative family</p>
            <NuxtLink :to="localePath(guide.family.to)" class="app-family">
              {{ guide.family.label }} →
            </NuxtLink>
            <p class="app-aside-note">
              A family page, not a recommended model. The configuration is confirmed against your own product.
            </p>
          </div>
        </div>

        <div class="app-split app-split--reverse">
          <div class="app-split__text">
            <p class="eyebrow">The line</p>
            <h2 class="app-h2">What the machine has to fit into</h2>
            <p class="app-body">{{ guide.lineNote }}</p>
          </div>
          <div class="app-split__aside">
            <p class="app-aside-label">Discuss the line</p>
            <NuxtLink :to="localePath('/technical-matching')" class="app-family">
              Technical matching →
            </NuxtLink>
            <p class="app-aside-note">
              Bring the product and the line constraints; the discussion starts from there.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. What the visitor brings — placed after the introduction, before the enquiry -->
    <section class="section-gap">
      <div class="container app-prep">
        <p class="eyebrow">What to prepare</p>
        <h2 class="app-h2">What we need from you</h2>
        <ul class="app-prep__list" role="list">
          <li v-for="(item, index) in guide.preparation" :key="item">
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

    <!-- 5. Enquiry card: the application stays as context on the enquiry -->
    <section class="section-gap section-alt">
      <div class="container">
        <div class="app-inquiry">
          <div class="app-inquiry__text">
            <h2 class="app-h2">Discuss {{ guide.title.toLowerCase() }} inspection</h2>
            <p class="app-body">
              Tell us about the product and the line. Your enquiry arrives already marked with this
              application, so the team knows where the question came from.
            </p>
          </div>
          <NuxtLink :to="localePath(inquiryPath)" class="app-cta">
            Start the conversation →
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
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 640px;
}

.app-hero__actions { margin: var(--space-5) 0 0; }

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

/* Lead: text beside the scene */
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
.app-lead__media figcaption {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
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

/* Interleaved splits */
.app-split {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 56px;
  align-items: start;
  padding-bottom: var(--space-10);
  border-bottom: 1px solid #DAE3DD;
  margin-bottom: var(--space-10);
}
/* Mirrored with logical order rather than direction: rtl, so text stays readable in Arabic. */
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
.app-family {
  display: inline-block;
  font-size: var(--text-base);
  color: var(--color-link-on-light);
  text-decoration: none;
}
.app-family:hover { text-decoration: underline; }
.app-aside-note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-ink-muted);
}

/* Preparation */
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

/* Enquiry card */
.app-inquiry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-8);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}

@media (max-width: 1023px) {
  .app-lead,
  .app-split { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .app-split--reverse .app-split__text { order: 1; }
  .app-split--reverse .app-split__aside { order: 2; }
}

@media (max-width: 700px) {
  .app-h2 { font-size: var(--text-xl); }
  .app-inquiry { padding: var(--space-6); }
  .app-split { padding-bottom: var(--space-8); margin-bottom: var(--space-8); }
}
</style>
