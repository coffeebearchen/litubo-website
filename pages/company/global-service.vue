<script setup lang="ts">
/**
 * Global Service Capability — how to start a support request, and where partners go instead.
 *
 * The four service entries are real links to the existing request pages. The previous version
 * rendered them as plain containers, so nothing on the page could actually be opened.
 *
 * Nothing here claims a service network, local stock, response times or an engineer visit: the
 * page explains how a request is started, not where we already are.
 */
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.globalService.title'), description: t('seo.globalService.description'), canonicalPath: '/company/global-service' })

const entries = [
  { title: 'Technical support', body: 'Describe the machine and the issue in a technical-support request.', to: '/support/technical-support' },
  { title: 'Spare parts', body: 'Request parts with the machine model and serial number.', to: '/support/request-spare-parts' },
  { title: 'Documents', body: 'Request a datasheet, manual or drawing for a specific model.', to: '/resources/downloads' },
  { title: 'Service & training', body: 'Discuss service guidance or operator training for your team.', to: '/support/service-training' },
]

const steps = [
  { n: '01', title: 'Identify the equipment', body: 'Model, serial number and installation country help the team locate the right information.' },
  { n: '02', title: 'Explain the location and the need', body: 'Where the machine runs, and what has to be resolved or learned.' },
  { n: '03', title: 'Agree the right route', body: 'The team confirms which path fits — parts, documentation, guidance or training.' },
]
</script>

<template>
  <div class="gs-page">
    <!-- 1. Hero: statement and action, with a neutral communication symbol -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.globalService') }]" />
        <div class="gs-hero">
          <div class="gs-hero__text">
            <p class="eyebrow">Support · Global</p>
            <h1 class="gs-hero__title">{{ t('pages.globalService.heroTitle') }}</h1>
            <p class="gs-hero__intro">
              Support starts with a clear request. Tell us the machine, where it runs and what you need,
              and the team will confirm the right path.
            </p>
            <p class="gs-hero__actions">
              <NuxtLink :to="localePath('/support')" class="gs-cta">Start a support request</NuxtLink>
              <NuxtLink :to="localePath('/contact')" class="gs-link">Not sure where to begin? →</NuxtLink>
            </p>
          </div>
          <aside class="gs-hero__aside">
            <span class="gs-symbol" aria-hidden="true">
              <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
                <circle cx="48" cy="48" r="34" stroke="currentColor" stroke-width="1.2" />
                <ellipse cx="48" cy="48" rx="34" ry="14" stroke="currentColor" stroke-width="1.2" />
                <path d="M48 14c10 12 10 56 0 68M48 14c-10 12-10 56 0 68" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </span>
            <ul role="list">
              <li><span>Location</span>Where the machine runs</li>
              <li><span>Equipment</span>Model and serial number</li>
              <li><span>Question</span>What has to be resolved</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>

    <CompanyNav />

    <!-- 2. Four clickable service entries -->
    <section class="gs-band">
      <div class="container">
        <p class="eyebrow">Support routes</p>
        <h2 class="gs-h2">Choose the route that matches your request.</h2>
        <ul class="gs-entries" role="list">
          <li v-for="entry in entries" :key="entry.to">
            <NuxtLink :to="localePath(entry.to)" class="gs-entry">
              <span class="gs-entry__mark" aria-hidden="true" />
              <span class="gs-entry__title">{{ entry.title }}</span>
              <span class="gs-entry__body">{{ entry.body }}</span>
              <span class="gs-entry__link">Open the request →</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- 3. Three preparation steps -->
    <section class="gs-band gs-band--tint">
      <div class="container">
        <p class="eyebrow">Before you write</p>
        <h2 class="gs-h2">Three things that make a request actionable.</h2>
        <ol class="gs-steps" role="list">
          <li v-for="step in steps" :key="step.n">
            <span class="gs-steps__n">{{ step.n }}</span>
            <span class="gs-steps__title">{{ step.title }}</span>
            <span class="gs-steps__body">{{ step.body }}</span>
          </li>
        </ol>
        <p class="gs-footnote">
          Response and availability are confirmed per request. This page does not describe local stock,
          a service network or a response-time commitment.
        </p>
      </div>
    </section>

    <!-- 4. Customer and partner split -->
    <section class="gs-band">
      <div class="container gs-split">
        <div class="gs-split__card">
          <p class="eyebrow">For equipment owners</p>
          <h2 class="gs-h2">Looking for local support?</h2>
          <p class="gs-body">
            Customers asking for a distributor or local arrangement should use the distributor request,
            so the team can respond to that question specifically.
          </p>
          <NuxtLink :to="localePath('/find-a-distributor')" class="gs-link">Request local arrangements →</NuxtLink>
        </div>
        <div class="gs-split__card gs-split__card--alt">
          <p class="eyebrow">For companies</p>
          <h2 class="gs-h2">Interested in working with us?</h2>
          <p class="gs-body">
            Companies exploring distribution, service cooperation or integration should introduce their
            market and experience through the partnership enquiry instead.
          </p>
          <NuxtLink :to="localePath('/company/become-a-partner')" class="gs-link">Introduce your company →</NuxtLink>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.support')"
      :secondary-to="localePath('/support')"
    />
  </div>
</template>

<style scoped>
.gs-band { padding: var(--space-16) 0; }
.gs-band--tint { background: #F3F7F0; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.gs-h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, 41px);
  line-height: 1.15;
  color: var(--color-ink);
}
.gs-body {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

/* Hero */
.gs-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 1fr);
  gap: 62px;
  align-items: center;
  padding-block: var(--space-5) 44px;
}
.gs-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, 61px);
  line-height: 1.08;
  color: var(--color-ink);
}
.gs-hero__intro {
  margin: 0 0 var(--space-5);
  max-width: 560px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.gs-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin: 0; }
.gs-cta {
  display: inline-block;
  padding: 13px 24px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.gs-cta:hover { background: var(--color-primary-deep); }
.gs-link { font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.gs-link:hover { text-decoration: underline; }

.gs-hero__aside {
  padding: var(--space-6);
  border: 1px solid #D2DFD0;
  border-radius: 6px;
  background: #fff;
}
.gs-symbol { display: block; color: var(--color-primary); margin-bottom: var(--space-4); }
.gs-hero__aside ul { list-style: none; margin: 0; padding: 0; }
.gs-hero__aside li { padding: var(--space-2) 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.gs-hero__aside li:last-child { border-bottom: 0; }
.gs-hero__aside li span { display: block; font-weight: 600; color: var(--color-ink); }

/* Four entries */
.gs-entries {
  list-style: none;
  margin: var(--space-6) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.gs-entry {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: var(--space-2) var(--space-4);
  height: 100%;
  padding: 27px;
  border: 1px solid #D2DFD0;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.gs-entry:hover { border-color: var(--color-primary); box-shadow: 0 4px 16px rgba(27, 66, 36, 0.08); }
.gs-entry__mark {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  grid-row: span 3;
}
.gs-entry__title { font-size: 29px; font-weight: 600; color: var(--color-ink); }
.gs-entry__body { font-size: 20px; line-height: 1.5; color: var(--color-ink-muted); }
.gs-entry__link { font-size: var(--text-sm); color: var(--color-link-on-light); }

/* Steps */
.gs-steps { list-style: none; margin: var(--space-6) 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.gs-steps li { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4) 0; border-top: 2px solid var(--color-primary); }
.gs-steps__n { font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-primary); }
.gs-steps__title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.gs-steps__body { font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.gs-footnote { margin: var(--space-6) 0 0; max-width: 760px; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

/* Split */
.gs-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px; }
.gs-split__card { padding: 30px; border: 1px solid #D2DFD0; border-radius: 6px; background: #F3F7EF; }
.gs-split__card--alt { background: #FAFAF5; }
.gs-split__card .gs-h2 { font-size: var(--text-2xl); }

@media (max-width: 1023px) {
  .gs-hero, .gs-split { grid-template-columns: minmax(0, 1fr); gap: 27px; }
  .gs-entries { grid-template-columns: minmax(0, 1fr); }
  .gs-steps { grid-template-columns: minmax(0, 1fr); gap: 17px; }
}

@media (max-width: 700px) {
  .gs-band { padding: var(--space-10) 0; }
  .gs-hero__title { font-size: 45px; }
  .gs-entry { padding: 20px; grid-template-columns: 35px minmax(0, 1fr); }
  .gs-entry__mark { width: 35px; height: 35px; }
  .gs-entry__title { font-size: var(--text-xl); }
  .gs-entry__body { font-size: var(--text-base); }
  .gs-steps__n { font-size: var(--text-lg); }
}

@media (prefers-reduced-motion: reduce) {
  .gs-entry { transition: none; }
}
</style>
