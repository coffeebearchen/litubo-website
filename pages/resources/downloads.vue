<script setup lang="ts">
/**
 * Downloads — request the right document, with the selection carried into the enquiry.
 *
 * Structure follows the V2 reference: hero → three-step strip → three selectable document types
 * beside the request form → selection help → FAQ → shared footer.
 *
 * There is no public file library, so nothing here offers a download. The enquiry uses the existing
 * support_request contract: `support_request_type = manual-request`, and the chosen document type is
 * written into the message as a readable prefix so the back office sees what was requested.
 */
const { t } = useI18n()
const localePath = useLocalePath()

/**
 * V2-04 — the hero may be overridden from /admin/page-content. Every field falls back to the copy
 * below, so the page renders exactly as before until someone publishes an override.
 */
const { hero } = await usePageHero('resources.downloads', {
  eyebrow: 'Technical documents',
  title: 'The right information. A clearer next step.',
  body: 'Datasheets, manuals and drawings are provided on request, because the correct document depends on the model and the configuration you are discussing.',
  ctaPrimaryLabel: 'Request a document',
  ctaPrimaryPath: '#request',
})


useSeoHead({
  title: 'Request technical documents — LITUBO',
  description: 'Request product datasheets, manuals and drawings. Confirm the model with the LITUBO team.',
  canonicalPath: '/resources/downloads',
})

type DocType = 'datasheet' | 'manual' | 'drawing'

const docTypes: { id: DocType, title: string, body: string, hint: string }[] = [
  {
    id: 'datasheet',
    title: 'Datasheets',
    body: 'Specifications and configuration information for a model you are discussing.',
    hint: 'Model or series helps',
  },
  {
    id: 'manual',
    title: 'Manuals',
    body: 'Operation and maintenance documentation for equipment already in service.',
    hint: 'Model and serial number',
  },
  {
    id: 'drawing',
    title: 'Drawings',
    body: 'Dimensioned drawings for installation space, connections and line integration.',
    hint: 'Model and line details',
  },
]

const selected = ref<DocType>('datasheet')
const activeType = computed(() => docTypes.find(d => d.id === selected.value)!)

const steps = [
  { label: 'Choose your information', sub: 'Datasheet, manual or drawing' },
  { label: 'Identify your equipment', sub: 'Model, series or application' },
  { label: 'Send your request', sub: 'Our team replies with the document' },
]

const faqs = [
  {
    q: 'What if I do not know the model?',
    a: 'Describe the product, the pack and the inspection question. The team can identify the right document with you.',
  },
  {
    q: 'Can you send a manual for equipment already installed?',
    a: 'Yes. Include the model and, where you have it, the serial number, so the correct manual is located.',
  },
  {
    q: 'Is this an instant download?',
    a: 'No. This page sends a documentation request. The team confirms the model and sends the correct files.',
  },
]


/** The document type is a readable prefix; the visitor's own words are never replaced. */
const messagePrefix = computed(() => `Document request: ${activeType.value.title.slice(0, -1)}`)


</script>

<template>
  <div class="downloads-page">
    <!-- 1. Hero -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources'), to: localePath('/resources') }, { label: 'Downloads' }]" />
        <div class="dl-hero">
          <div class="dl-hero__text">
            <p class="eyebrow">{{ hero.eyebrow }}</p>
            <h1 class="dl-hero__title">{{ hero.title }}</h1>
            <p class="dl-hero__intro">{{ hero.body }}</p>
            <p class="dl-hero__actions">
              <a href="#request" class="dl-cta">Request a document</a>
              <NuxtLink :to="localePath('/technical-matching')" class="dl-link">Not sure what you need? →</NuxtLink>
            </p>
          </div>
          <figure class="dl-hero__media">
            <img src="/images/devices/weigher-real.webp" alt="" width="800" height="533" loading="eager" decoding="async">
          </figure>
        </div>
      </div>
    </section>

    <!-- 2. Three-step strip -->
    <nav class="dl-steps" aria-label="How a request works">
      <div class="container dl-steps__inner">
        <div v-for="(step, i) in steps" :key="step.label" class="dl-step">
          <span class="dl-step__index">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="dl-step__text">
            <span class="dl-step__label">{{ step.label }}</span>
            <span class="dl-step__sub">{{ step.sub }}</span>
          </span>
        </div>
      </div>
    </nav>

    <!-- 3. Selectable document types + request form -->
    <section id="request" class="dl-band">
      <div class="container dl-task">
        <div class="dl-task__left">
          <p class="eyebrow">Choose your information</p>
          <div class="dl-cards" role="radiogroup" aria-label="Document type">
            <button
              v-for="doc in docTypes"
              :key="doc.id"
              type="button"
              role="radio"
              class="dl-card"
              :class="{ 'is-selected': selected === doc.id }"
              :aria-checked="selected === doc.id"
              @click="selected = doc.id"
            >
              <span class="dl-card__mark" aria-hidden="true" />
              <span class="dl-card__text">
                <span class="dl-card__title">{{ doc.title }}</span>
                <span class="dl-card__body">{{ doc.body }}</span>
              </span>
              <span class="dl-card__hint">{{ doc.hint }}</span>
            </button>
          </div>

          <!-- Fourth entry: selection help, not a fabricated file -->
          <div class="dl-help">
            <p class="dl-help__title">Still choosing the equipment?</p>
            <p class="dl-help__body">
              The catalogue is a discussion, not a file. Tell us what you need to inspect and the team
              will suggest which family to look at.
            </p>
            <NuxtLink :to="localePath('/technical-matching')" class="dl-link">Talk it through →</NuxtLink>
          </div>
        </div>

        <div class="dl-task__form">
          <div class="dl-form">
            <p class="dl-form__context">Selected: {{ activeType.title }}</p>
            <h2 class="dl-form__title">Request this document</h2>

            <SupportRequestForm
              request-type="manual-request"
              :message-prefix="messagePrefix"
              :show-serial="selected === 'manual'"
              submit-label="Send document request"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- 4. FAQ -->
    <section class="dl-band dl-band--tint">
      <div class="container dl-faq">
        <div>
          <p class="eyebrow">Questions</p>
          <h2 class="dl-h2">Before you ask</h2>
        </div>
        <div class="dl-faq__list">
          <details v-for="item in faqs" :key="item.q" class="dl-faq__item">
            <summary>{{ item.q }}</summary>
            <p>{{ item.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.resources')"
      :secondary-to="localePath('/resources')"
    />
  </div>
</template>

<style scoped>
.dl-band { padding: var(--space-14) 0; }
.dl-band--tint { background: #F2F6F2; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.dl-h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.2;
  color: var(--color-ink);
}

/* Hero */
.dl-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 60px;
  align-items: center;
  padding-block: var(--space-4) var(--space-8);
}
.dl-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 3.6vw, var(--text-5xl));
  line-height: 1.08;
  color: var(--color-ink);
}
.dl-hero__intro {
  margin: 0 0 var(--space-5);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 540px;
}
.dl-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin: 0; }
.dl-hero__media { margin: 0; }
.dl-hero__media img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
  background: #F2F8F4;
}

.dl-cta {
  display: inline-block;
  padding: 13px 22px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.dl-cta:hover { background: var(--color-primary-deep); }
.dl-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.dl-link:hover { text-decoration: underline; }

/* Steps */
.dl-steps { background: #FAF8F3; padding-block: var(--space-4); }
.dl-steps__inner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  padding: var(--space-4) var(--space-5);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
}
.dl-step { display: flex; align-items: flex-start; gap: var(--space-3); }
.dl-step__index { font-size: var(--text-lg); font-weight: 600; color: var(--color-primary); line-height: 1.1; }
.dl-step__text { display: flex; flex-direction: column; gap: 2px; }
.dl-step__label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.dl-step__sub { font-size: var(--text-xs); color: var(--color-ink-muted); }

/* Task area */
.dl-task {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 46px;
  align-items: start;
}
.dl-cards { display: flex; flex-direction: column; gap: 18px; margin-top: var(--space-4); }
.dl-card {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 22px;
  align-items: center;
  padding: 24px;
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #fff;
  text-align: start;
  cursor: pointer;
  font: inherit;
  transition: border-color 160ms ease, background 160ms ease;
}
.dl-card__mark {
  width: 8px;
  height: 100%;
  min-height: 44px;
  border-radius: 4px;
  background: var(--color-primary);
}
.dl-card.is-selected { border: 2px solid var(--color-primary); background: #F2F7F1; padding: 23px; }
.dl-card__text { display: flex; flex-direction: column; gap: 4px; }
.dl-card__title { font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-ink); }
.dl-card__body { font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.dl-card__hint { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; }

.dl-help {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  background: #F2F6F2;
}
.dl-help__title { margin: 0 0 var(--space-2); font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.dl-help__body { margin: 0 0 var(--space-3); font-size: var(--text-sm); line-height: 1.55; color: var(--color-ink-muted); }

/* Form */
.dl-form {
  padding: 28px;
  border: 1px solid #C7D7C9;
  border-top: 3px solid var(--color-primary);
  border-radius: 5px;
  background: #fff;
}
.dl-form__context {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: #F2F6F2;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.dl-form__title {
  margin: 0 0 var(--space-5);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--color-ink);
}
.dl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.dl-field { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-sm); color: var(--color-ink); }
.dl-field--full { margin-top: var(--space-3); }
.dl-field em { color: var(--color-primary); font-style: normal; }
.dl-field input,
.dl-field textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #B9CABA;
  border-radius: 4px;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: #fff;
}
.dl-field input.is-error,
.dl-field textarea.is-error { border-color: #B4451F; }
.dl-consent {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin: var(--space-4) 0 var(--space-3);
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-ink-muted);
}
.dl-consent a { color: var(--color-primary); }
.dl-error { margin: 0 0 var(--space-3); font-size: var(--text-xs); color: #B4451F; }
.dl-submit {
  width: 100%;
  padding: 13px 20px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}
.dl-submit:hover { background: var(--color-primary-deep); }
.dl-submit:disabled { opacity: 0.7; cursor: default; }

.dl-alert {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid #E5B4A0;
  border-radius: var(--radius-sm);
  background: #FDF0EA;
  color: #8A3A1A;
  font-size: var(--text-sm);
}
.dl-alert p { margin: 0; }
.dl-state { padding: var(--space-4) 0; }
.dl-state__title { margin: 0 0 var(--space-2); font-size: var(--text-lg); color: var(--color-ink); }
.dl-state__body { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); }

/* FAQ */
.dl-faq { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: 65px; align-items: start; }
.dl-faq__item { border-bottom: 1px solid #DAE3DD; padding: var(--space-4) 0; }
.dl-faq__item summary {
  cursor: pointer;
  font-size: var(--text-base);
  color: var(--color-ink);
  list-style: none;
}
.dl-faq__item summary::-webkit-details-marker { display: none; }
.dl-faq__item p { margin: var(--space-3) 0 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

@media (max-width: 1023px) {
  .dl-hero, .dl-task, .dl-faq { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .dl-steps__inner { grid-template-columns: minmax(0, 1fr); gap: 15px; }
  .dl-hero__media { order: 2; }
}

@media (max-width: 700px) {
  .dl-band { padding: var(--space-10) 0; }
  .dl-card { grid-template-columns: 8px minmax(0, 1fr); gap: 14px; }
  .dl-card__hint { display: none; }
  .dl-form { padding: 25px; }
  .dl-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .dl-card { transition: none; }
}

@media (max-width: 380px) {
  /* The design lowers the display heading again at 320px; without this the longest word meets the
     right edge of the viewport. */
  .dl-hero__title { font-size: 39px; }
}

</style>
