<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useSeoHead({ title: t('seo.partner.title'), description: t('seo.partner.description'), canonicalPath: '/company/become-a-partner' })

const form = reactive({ name: '', company: '', email: '', country: '', message: '', consent: false })
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate() {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim())    errors.name    = 'Required'
  if (!form.email.trim())   errors.email   = 'Required'
  if (!form.country.trim()) errors.country = 'Required'
  if (!form.message.trim()) errors.message = 'Required'
  if (!form.consent)        errors.consent = 'You must agree to continue'
  return Object.values(errors).every(v => !v)
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      // Route and locale are read in setup: useRoute() / useI18n() called inside this handler threw before the request was sent.
      body: { ...form, formId: 'become-a-partner', sourceUrl: route.fullPath, locale: locale.value },
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
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.partner') }]" />
        <h1 class="page-hero__title">{{ t('pages.partner.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.partner.heroSubtitle') }}</p>
      </div>
    </section>
    <section class="section-gap">
      <div class="container">
        <div v-if="status === 'success'" class="form-success" role="alert">
          <h2>{{ t('common.successTitle') }}</h2><p>{{ t('common.successBody') }}</p>
        </div>
        <form v-else class="form-panel" novalidate @submit.prevent="submit">
          <div class="form-grid">
            <FormField id="name" :label="t('pages.partner.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
            <FormField id="company" :label="t('pages.partner.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
            <FormField id="email" type="email" :label="t('pages.partner.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
            <FormField id="country" :label="t('pages.partner.countryLabel')" required :model-value="form.country" :error="errors.country" @update:model-value="form.country = $event" />
          </div>
          <FormField id="message" type="textarea" :label="t('pages.partner.messageLabel')" required :model-value="form.message" :error="errors.message" class="form-message" @update:model-value="form.message = $event" />
          <label class="consent-label">
            <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
            <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
          </label>
          <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>
          <p v-if="status === 'error'" class="form-error" role="alert">{{ t('common.errorBody') }}</p>
          <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="submit-btn">
            {{ status === 'loading' ? t('common.loading') : t('pages.partner.submitLabel') }}
          </BaseButton>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary-deep); padding: var(--space-12) 0; color: var(--color-ink); }
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
.form-error { margin-top: var(--space-4); padding: var(--space-4); background: #fff5f5; border: 1px solid #f5c6c6; border-radius: var(--radius-sm); color: #c0392b; font-size: var(--text-sm); }
.submit-btn { margin-top: var(--space-5); }
.form-success { padding: var(--space-8); background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: var(--radius-sm); }
.form-success h2 { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-primary); margin-bottom: var(--space-3); }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
</style>
