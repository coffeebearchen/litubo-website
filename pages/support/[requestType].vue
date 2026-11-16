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
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate() {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim())  errors.name  = 'Required'
  if (!form.email.trim()) errors.email = 'Required'
  if (!form.issue.trim()) errors.issue = 'Required'
  if (!form.consent)      errors.consent = 'You must agree to continue'
  return Object.values(errors).every(v => !v)
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  try {
    await $fetch('/api/inquiries', {
      method: 'POST',
      body: {
        inquiry_type: 'support_request',
        support_request_type: requestType.value,
        locale: locale.value,
        contact_name: form.name,
        contact_company: form.company,
        contact_email: form.email,
        model_number: form.model,
        serial_number: form.serial,
        contact_country: form.country,
        message: form.issue,
        urgency: form.urgency,
        consent: form.consent,
        website: '',
      },
    })
    status.value = 'success'
  } catch {
    status.value = 'error'
  }
}
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
        <div v-if="status === 'success'" class="form-success" role="alert">
          <h2>{{ t('common.successTitle') }}</h2><p>{{ t('common.successBody') }}</p>
        </div>
        <form v-else class="form-panel" novalidate @submit.prevent="submit">
          <div class="form-grid">
            <FormField id="name" :label="t('pages.serviceRequest.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
            <FormField id="company" :label="t('pages.serviceRequest.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
            <FormField id="email" type="email" :label="t('pages.serviceRequest.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
            <FormField id="model" :label="t('pages.serviceRequest.modelLabel')" :model-value="form.model" @update:model-value="form.model = $event" />
            <FormField id="serial" :label="t('pages.serviceRequest.serialLabel')" :model-value="form.serial" @update:model-value="form.serial = $event" />
            <FormField id="country" :label="t('pages.serviceRequest.countryLabel')" :model-value="form.country" @update:model-value="form.country = $event" />
          </div>
          <FormField id="issue" type="textarea" :label="t('pages.serviceRequest.issueLabel')" required :model-value="form.issue" :error="errors.issue" class="form-message" @update:model-value="form.issue = $event" />
          <label class="consent-label">
            <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
            <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
          </label>
          <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>
          <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="submit-btn">
            {{ status === 'loading' ? t('common.loading') : t('pages.serviceRequest.submitLabel') }}
          </BaseButton>
        </form>
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
