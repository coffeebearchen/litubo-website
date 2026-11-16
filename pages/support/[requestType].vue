<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const requestType = computed(() => route.params.requestType as string)

const titles: Record<string, string> = {
  'technical-support': t('nav_support.techSupport'),
  'manual-request':    t('nav_support.manualRequest'),
  'service-training':  t('nav_support.serviceTraining'),
}

if (!Object.prototype.hasOwnProperty.call(titles, requestType.value)) {
  throw createError({ statusCode: 404, fatal: true })
}

const pageTitle = computed(() => titles[requestType.value] ?? t('pages.serviceRequest.heroTitle'))

useHead({ title: `${pageTitle.value} — LITUBO` })

const documentLabels: Record<string, string> = { datasheet: 'product datasheet', manual: 'operation manual', drawing: 'technical drawing', catalogue: 'product selection information' }
const documentLabel = requestType.value === 'manual-request' && typeof route.query.document === 'string' && Object.hasOwn(documentLabels, route.query.document) ? documentLabels[route.query.document] : ''
const form = reactive({ name: '', company: '', email: '', model: '', serial: '', country: '', issue: documentLabel ? `Please send the ${documentLabel} for the following product / application: ` : '', urgency: '', consent: false })


</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.support'), to: localePath('/support') }, { label: pageTitle }]" />
        <h1 class="page-hero__title">{{ pageTitle }}</h1>
        <p class="page-hero__sub">{{ t('pages.serviceRequest.heroSubtitle') }}</p>
      </div>
    </section>
    <section class="section-gap">
      <div class="container">
        <SupportRequestForm
          :request-type="requestType"
          :show-serial="true"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%); padding: var(--space-12) 0; color: var(--color-ink); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.page-hero__sub { font-size: var(--text-lg); color: var(--color-ink-muted); max-width: 560px; line-height: var(--leading-normal); }
.section-gap { padding: var(--space-16) 0; }
.form-panel { max-width: 640px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); margin-bottom: var(--space-5); }
.form-message { margin-bottom: var(--space-5); }
.consent-label { display: flex; align-items: flex-start; gap: var(--space-3); font-size: var(--text-sm); color: var(--color-ink-muted); cursor: pointer; margin-bottom: var(--space-2); }
.consent-checkbox { margin-top: 3px; flex-shrink: 0; accent-color: var(--color-primary); }
.consent-label a { color: var(--color-primary); text-decoration: underline; }
.consent-error { font-size: var(--text-xs); color: #c0392b; margin-bottom: var(--space-4); }
.submit-btn { margin-top: var(--space-5); }
.form-success { padding: var(--space-8); background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: var(--radius-sm); }
.form-success h2 { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-primary); margin-bottom: var(--space-3); }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
</style>
