<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.quality.title'), description: t('seo.quality.description'), canonicalPath: '/company/quality-manufacturing' })

/**
 * FINAL-RELEASE-FIX-D (P1-05): this page states only what the project can support.
 *
 * Certification and compliance claims, facility and process details, and construction notes were
 * removed because the repository holds no business confirmation or verified material for them
 * (CLAUDE.md, D-008). This rewrite does not add any of that back.
 *
 * What it does add is the three things a visitor actually has to decide before a build can be
 * discussed — the product, what has to be found, and the line — and the route to discuss them.
 * Those are question prompts, not capability claims.
 */
const discussionPoints = [
  {
    key: 'product',
    title: 'The product and the pack',
    body: 'Product form, pack material and how the pack behaves on a conveyor decide which inspection principle is even possible.',
    detail: 'Bring the pack, or a photo and its dimensions.',
  },
  {
    key: 'target',
    title: 'What has to be found',
    body: 'A metal fragment, a bone, a stone, a missing item, a fill-weight deviation — each sets a different requirement on the system.',
    detail: 'Describe the contamination or the weight problem.',
  },
  {
    key: 'line',
    title: 'The line around it',
    body: 'Throughput, available length, conveyor height and how rejects are handled decide whether a configuration can be installed.',
    detail: 'Line speed and the space you can give the machine.',
  },
]
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.quality') }]" />
        <h1 class="page-hero__title">{{ t('pages.quality.heroTitle') }}</h1>
        <p class="page-hero__sub">
          A configuration is confirmed against your product and your line, not chosen from a list. These
          are the three things the technical discussion starts with.
        </p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div class="discussion-grid">
          <article v-for="(point, index) in discussionPoints" :key="point.key" class="discussion-card">
            <span class="discussion-card__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <h2 class="discussion-card__title">{{ point.title }}</h2>
            <p class="discussion-card__body">{{ point.body }}</p>
            <p class="discussion-card__detail">{{ point.detail }}</p>
          </article>
        </div>

        <div class="quality-note">
          <p>
            Final configuration, inspection performance and suitability are confirmed with our team for
            your product and production line. Documentation that applies to a specific model is requested
            through
            <NuxtLink :to="localePath('/resources/downloads')">technical documents</NuxtLink>.
          </p>
          <NuxtLink :to="localePath('/technical-matching')" class="quality-note__cta">
            Describe your line →
          </NuxtLink>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('common.learnMore')"
      :secondary-to="localePath('/company/about')"
    />
  </div>
</template>

<style scoped>
.section-gap { padding: var(--space-16) 0; }

.discussion-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.discussion-card {
  padding: var(--space-6);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}

.discussion-card__index {
  display: block;
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--color-ink-muted);
  margin-bottom: var(--space-3);
}

.discussion-card__title {
  margin: 0 0 var(--space-3);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: 1.3;
  color: var(--color-ink);
}

.discussion-card__body {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

.discussion-card__detail {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-ink);
  border-top: 1px solid #E7EDE8;
  padding-top: var(--space-3);
}

.quality-note {
  margin-top: var(--space-10);
  padding: var(--space-6);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #F2F8F4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.quality-note p {
  margin: 0;
  max-width: 720px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

.quality-note a { color: var(--color-link-on-light); }

.quality-note__cta {
  color: var(--color-link-on-light);
  font-size: var(--text-sm);
  text-decoration: none;
  white-space: nowrap;
}
.quality-note__cta:hover { text-decoration: underline; }

@media (max-width: 1023px) {
  .discussion-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .discussion-grid { grid-template-columns: 1fr; gap: 16px; }
  .quality-note { flex-direction: column; align-items: flex-start; }
}
</style>
