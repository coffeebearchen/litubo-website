<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
useHead({ title: `${t('pages.spareParts.heroTitle')} — LITUBO` })

const form = reactive({ email: '', model: '', serial: '', parts: '', country: '', message: '', consent: false })
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate() {
  for (const k in errors) errors[k] = ''
  if (!form.email.trim())  errors.email  = 'Required'
  if (!form.model.trim())  errors.model  = 'Required'
  if (!form.parts.trim())  errors.parts  = 'Required'
  if (!form.consent)       errors.consent = 'You must agree to continue'
  return Object.values(errors).every(v => !v)
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  try {
    await $fetch('/api/inquiries', {
      method: 'POST',
      body: {
        inquiry_type: 'spare_parts',
        locale: locale.value,
        contact_email: form.email,
        model_number: form.model,
        serial_number: form.serial,
        contact_country: form.country,
        // parts description is the primary message; append optional additional notes
        message: form.message
          ? `${form.parts}\n\nAdditional notes: ${form.message}`
          : form.parts,
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
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.support'), to: localePath('/support') }, { label: t('pages.spareParts.heroTitle') }]" />
        <h1 class="page-hero__title">{{ t('pages.spareParts.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.spareParts.heroSubtitle') }}</p>
      </div>
    </section>
    <section class="section-gap">
      <div class="container">
        <div v-if="status === 'success'" class="form-success" role="alert">
          <h2>{{ t('common.successTitle') }}</h2><p>{{ t('common.successBody') }}</p>
        </div>
        <form v-else class="form-panel" novalidate @submit.prevent="submit">
          <div class="form-grid">
            <FormField id="email" type="email" :label="t('pages.spareParts.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
            <FormField id="model" :label="t('pages.spareParts.modelLabel')" required :model-value="form.model" :error="errors.model" @update:model-value="form.model = $event" />
            <FormField id="serial" :label="t('pages.spareParts.serialLabel')" :model-value="form.serial" @update:model-value="form.serial = $event" />
            <FormField id="country" :label="t('pages.spareParts.countryLabel')" :model-value="form.country" @update:model-value="form.country = $event" />
          </div>
          <FormField id="parts" type="textarea" :label="t('pages.spareParts.partsLabel')" required :model-value="form.parts" :error="errors.parts" class="form-message" @update:model-value="form.parts = $event" />
          <FormField id="message" type="textarea" :label="t('pages.spareParts.messageLabel')" :model-value="form.message" class="form-message" @update:model-value="form.message = $event" />
          <label class="consent-label">
            <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
            <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
          </label>
          <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>
          <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="submit-btn">
            {{ status === 'loading' ? t('common.loading') : t('pages.spareParts.submitLabel') }}
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
