<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('seo.findDistributor.title'),
  meta: [{ name: 'description', content: t('seo.findDistributor.description') }],
})

const form = reactive({ name: '', company: '', email: '', country: '', phone: '', message: '', consent: false })
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate() {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim())    errors.name    = 'Required'
  if (!form.email.trim())   errors.email   = 'Required'
  if (!form.country.trim()) errors.country = 'Required'
  if (!form.consent)        errors.consent = 'You must agree to continue'
  return Object.values(errors).every(v => !v)
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  try {
    await $fetch('/api/inquiries', {
      method: 'POST',
      body: {
        inquiry_type: 'distributor',
        locale: useI18n().locale.value,
        contact_name: form.name,
        contact_company: form.company,
        contact_email: form.email,
        contact_country: form.country,
        contact_phone: form.phone,
        message: form.message,
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
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('pages.findDistributor.heroTitle') }]" />
        <h1 class="page-hero__title">{{ t('pages.findDistributor.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.findDistributor.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <div v-if="status === 'success'" class="form-success" role="alert">
          <h2>{{ t('common.successTitle') }}</h2>
          <p>{{ t('common.successBody') }}</p>
        </div>
        <form v-else class="form-panel" novalidate @submit.prevent="submit">
          <div class="form-grid">
            <FormField id="name" :label="t('pages.findDistributor.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
            <FormField id="company" :label="t('pages.findDistributor.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
            <FormField id="email" type="email" :label="t('pages.findDistributor.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
            <FormField id="country" :label="t('pages.findDistributor.countryLabel')" required :model-value="form.country" :error="errors.country" @update:model-value="form.country = $event" />
            <FormField id="phone" type="tel" :label="t('pages.findDistributor.phoneLabel')" :model-value="form.phone" @update:model-value="form.phone = $event" />
          </div>
          <FormField id="message" type="textarea" :label="t('pages.findDistributor.messageLabel')" :model-value="form.message" class="form-message" @update:model-value="form.message = $event" />
          <label class="consent-label">
            <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
            <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
          </label>
          <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>
          <BaseButton type="submit" variant="accent" size="lg" :disabled="status === 'loading'" class="submit-btn">
            {{ status === 'loading' ? t('common.loading') : t('pages.findDistributor.submitLabel') }}
          </BaseButton>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.page-hero__sub { font-size: var(--text-lg); color: rgba(255,255,255,0.8); max-width: 560px; line-height: var(--leading-normal); }
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
