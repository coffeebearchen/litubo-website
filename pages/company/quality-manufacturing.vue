<script setup lang="ts">
/**
 * Quality & Manufacturing — a project-check and document-request structure.
 *
 * The visual is complete, but it makes no claim about manufacturing process, certification, test
 * capability or inspection results. Nothing here says "we have passed"; every item is a subject to
 * discuss or a document to request.
 *
 * Real manufacturing photography, process detail and certificates are added later at the defined
 * positions once the owner supplies verified material — the layout does not need rebuilding.
 */
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.quality.title'), description: t('seo.quality.description'), canonicalPath: '/company/quality-manufacturing' })

const checks = [
  { title: 'The product and the pack', body: 'Product form, pack material and how the pack runs on a conveyor.' },
  { title: 'What has to be found', body: 'The contaminant, the missing item or the weight deviation you need to address.' },
  { title: 'The line around it', body: 'Throughput, available length, conveyor height and how rejects are removed.' },
]

const requirements = [
  { title: 'Material and cleaning', body: 'Contact materials, washdown routine and the cleaning agents the line uses.' },
  { title: 'Dimensions and integration', body: 'Aperture, belt width, transfer height and how the machine sits in the existing line.' },
  { title: 'Whether evaluation is needed', body: 'If the product is difficult, a sample review is discussed before any configuration is proposed.' },
  { title: 'Applicable documents', body: 'The datasheet, drawing or manual that applies to the model under discussion.' },
]
</script>

<template>
  <div class="qm-page">
    <!-- 1. Cold-light hero with a real checkweigher photograph -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.quality') }]" />
        <div class="qm-hero">
          <div class="qm-hero__text">
            <p class="eyebrow">Quality &amp; manufacturing</p>
            <h1 class="qm-hero__title">Clear requirements come before configuration.</h1>
            <p class="qm-hero__intro">
              A machine is confirmed against your product and your line, not selected from a catalogue.
              This page sets out what the technical discussion needs, and where to request the documents
              that apply to a specific model.
            </p>
            <p class="qm-hero__actions">
              <NuxtLink :to="localePath('/technical-matching')" class="qm-cta">Discuss your requirements</NuxtLink>
              <NuxtLink :to="localePath('/resources/downloads')" class="qm-link">Request documents →</NuxtLink>
            </p>
          </div>
          <figure class="qm-hero__media">
            <img src="/images/devices/weigher-real.webp" alt="LITUBO checkweigher on a production line" width="800" height="533" loading="eager" decoding="async">
            <figcaption>Equipment photograph. The configuration is confirmed against your own product.</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <CompanyNav />

    <!-- 2. Three checks, kept as one compact list -->
    <section class="qm-band">
      <div class="container">
        <p class="eyebrow">Start here</p>
        <h2 class="qm-h2">Three questions the discussion begins with.</h2>
        <ul class="qm-checks" role="list">
          <li v-for="(c, i) in checks" :key="c.title">
            <span class="qm-checks__n">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="qm-checks__title">{{ c.title }}</span>
            <span class="qm-checks__body">{{ c.body }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 3. Combination photograph beside four project requirements -->
    <section class="qm-band qm-band--tint">
      <div class="container qm-split">
        <figure class="qm-split__media">
          <img src="/images/devices/combination-real.webp" alt="LITUBO combination inspection system" width="800" height="481" loading="lazy" decoding="async">
          <figcaption>Equipment photograph. Not a manufacturing or inspection record.</figcaption>
        </figure>
        <div class="qm-split__text">
          <p class="eyebrow">Project requirements</p>
          <h2 class="qm-h2">Four things a configuration has to satisfy.</h2>
          <p class="qm-body">
            Each of these is a subject for the technical discussion. None of them is a claim about what
            has already been certified or measured.
          </p>
          <ol class="qm-reqs" role="list">
            <li v-for="(r, i) in requirements" :key="r.title">
              <span class="qm-reqs__n">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="qm-reqs__title">{{ r.title }}</span>
              <span class="qm-reqs__body">{{ r.body }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- 4. Two concrete actions -->
    <section class="qm-band">
      <div class="container">
        <p class="eyebrow">Next</p>
        <h2 class="qm-h2">Two ways to take this further.</h2>
        <div class="qm-actions">
          <NuxtLink :to="localePath('/resources/downloads')" class="qm-action">
            <span class="qm-action__title">Request documents for a model</span>
            <span class="qm-action__body">Datasheet, drawing or manual — requested for the model you are discussing.</span>
            <span class="qm-action__link">Request documents →</span>
          </NuxtLink>
          <NuxtLink :to="localePath('/support/send-product-test')" class="qm-action">
            <span class="qm-action__title">Discuss a product test</span>
            <span class="qm-action__body">Describe the product and the question. The arrangement is confirmed before anything is sent.</span>
            <span class="qm-action__link">Send a test request →</span>
          </NuxtLink>
        </div>
        <p class="qm-footnote">
          Certification, manufacturing records and published test results are added once the material is
          confirmed. This page does not present them in advance.
        </p>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.products')"
      :secondary-to="localePath('/products')"
    />
  </div>
</template>

<style scoped>
.qm-band { padding: var(--space-16) 0; }
.qm-band--tint { background: #F3F7F0; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.qm-h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, 41px);
  line-height: 1.15;
  color: var(--color-ink);
}
.qm-body {
  margin: 0 0 var(--space-5);
  max-width: 620px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

/* Hero */
.qm-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 1fr);
  gap: 62px;
  align-items: center;
  padding-block: var(--space-5) 44px;
}
.qm-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, 61px);
  line-height: 1.08;
  color: var(--color-ink);
}
.qm-hero__intro {
  margin: 0 0 var(--space-5);
  max-width: 600px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.qm-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin: 0; }
.qm-hero__media { margin: 0; }
.qm-hero__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #D2DFD0;
}
.qm-hero__media figcaption,
.qm-split__media figcaption {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-ink-muted);
}

.qm-cta {
  display: inline-block;
  padding: 13px 24px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.qm-cta:hover { background: var(--color-primary-deep); }
.qm-link { font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.qm-link:hover { text-decoration: underline; }

/* Checks */
.qm-checks { list-style: none; margin: var(--space-5) 0 0; padding: 0; }
.qm-checks li {
  display: grid;
  grid-template-columns: 48px minmax(0, 320px) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: baseline;
  padding: var(--space-3) 0;
  border-bottom: 1px solid #E3EBE4;
}
.qm-checks__n { font-family: var(--font-display); font-size: var(--text-base); color: var(--color-primary); }
.qm-checks__title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.qm-checks__body { font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

/* Split */
.qm-split { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 62px; align-items: start; }
.qm-split__media { margin: 0; }
.qm-split__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #D2DFD0;
}

.qm-reqs { list-style: none; margin: 0; padding: 0; }
.qm-reqs li {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 4px var(--space-3);
  padding: var(--space-4) 0;
  border-bottom: 1px solid #E3EBE4;
}
.qm-reqs li:last-child { border-bottom: 0; }
.qm-reqs__n { font-family: var(--font-display); font-size: var(--text-base); color: var(--color-primary); grid-row: span 2; }
.qm-reqs__title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.qm-reqs__body { font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

/* Actions */
.qm-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: var(--space-5); }
.qm-action {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  padding: 27px;
  border: 1px solid #D2DFD0;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.qm-action:hover { border-color: var(--color-primary); box-shadow: 0 4px 16px rgba(27, 66, 36, 0.08); }
.qm-action__title { font-family: var(--font-display); font-size: 29px; color: var(--color-ink); }
.qm-action__body { font-size: 20px; line-height: 1.5; color: var(--color-ink-muted); flex: 1; }
.qm-action__link { font-size: var(--text-sm); color: var(--color-link-on-light); }

.qm-footnote { margin: var(--space-6) 0 0; max-width: 760px; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

@media (max-width: 1023px) {
  .qm-hero, .qm-split { grid-template-columns: minmax(0, 1fr); gap: 27px; }
  .qm-checks li { grid-template-columns: 40px minmax(0, 1fr); }
  .qm-checks__body { grid-column: 2; }
  .qm-actions { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 700px) {
  .qm-band { padding: var(--space-10) 0; }
  .qm-hero__title { font-size: 45px; }
  .qm-checks li { grid-template-columns: 34px minmax(0, 1fr); }
  .qm-action { padding: 26px; }
  .qm-action__title { font-size: 30px; }
  .qm-action__body { font-size: 22px; }
}

@media (prefers-reduced-motion: reduce) {
  .qm-action { transition: none; }
}

@media (max-width: 380px) {
  /* The design lowers the display heading again at 320px; without this the longest word meets the
     right edge of the viewport. */
  .qm-hero__title { font-size: 39px; }
}

</style>
