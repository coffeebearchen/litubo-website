<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoHead({
  title: t('seo.technicalMatching.title'),
  description: t('seo.technicalMatching.description'),
  canonicalPath: '/technical-matching',
})

const form = reactive({
  name: '', company: '', email: '', country: '',
  product: '', format: '', speed: '', dimensions: '', contaminant: '', existingEquip: '', message: '',
  consent: false,
})

const route = useRoute()

/**
 * Context carried in from another page. The Checkweighers catalogue sends `series`, the Videos page
 * sends `topic` / `equipment` / `focus`, and About or the applications pages send `application`.
 *
 * Only whitelisted values are accepted, and a whitelisted value is turned into a readable first line
 * of the message so the back office sees where the enquiry came from. Anything unrecognised is
 * ignored — a query string never becomes a business type.
 */
const SERIES_LABELS: Record<string, string> = {
  compact: 'Compact',
  standard: 'Standard',
  'medium-range': 'Medium-range',
  'extra-large': 'Extra-large',
  pharmaceutical: 'Pharmaceutical',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  'metal-detection': 'Metal detection',
  checkweighers: 'Checkweighing',
  'combination-inspection': 'Combination inspection',
  'x-ray-inspection': 'X-ray inspection',
  'conveyors-reject-systems': 'Conveyors and reject systems',
}

function readParam(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

const incoming = computed(() => {
  const lines: string[] = []
  const series = readParam('series')
  if (series && SERIES_LABELS[series]) lines.push(`Equipment series: ${SERIES_LABELS[series]}`)
  const equipment = readParam('equipment')
  if (equipment && EQUIPMENT_LABELS[equipment]) lines.push(`Equipment family: ${EQUIPMENT_LABELS[equipment]}`)
  const topic = readParam('topic')
  if (topic === 'demonstration') lines.push('Enquiry context: Demonstration request')
  const application = readParam('application')
  if (application) lines.push(`Application: ${application.replace(/-/g, ' ')}`)
  // Free text is capped and never used as a type.
  const focus = typeof route.query.focus === 'string' ? route.query.focus.trim().slice(0, 200) : ''
  if (focus) lines.push(`Focus: ${focus}`)
  return lines
})

const contextSummary = computed(() => incoming.value.length ? incoming.value.join('\n') : '')

const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate() {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim())    errors.name    = 'Required'
  if (!form.email.trim())   errors.email   = 'Required'
  if (!form.country.trim()) errors.country = 'Required'
  if (!form.product.trim()) errors.product = 'Required'
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
        inquiry_type: 'technical_matching',
        locale: locale.value,
        contact_name: form.name,
        contact_company: form.company,
        contact_email: form.email,
        contact_country: form.country,
        tm_product_interest: form.product,
        tm_product_format: form.format,
        tm_line_speed: form.speed,
        tm_package_dimensions: form.dimensions,
        tm_contaminant_concern: form.contaminant,
        tm_existing_equipment: form.existingEquip,
        message: contextSummary.value
          ? `${contextSummary.value}\n\n${form.message}`.trim()
          : form.message,
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
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('pages.technicalMatching.heroTitle') }]" />
        <h1 class="page-hero__title">{{ t('pages.technicalMatching.heroTitle') }}</h1>
      <p v-if="incoming.length" class="tm-context">
        <span v-for="line in incoming" :key="line">{{ line }}</span>
      </p>
        <p class="page-hero__sub">{{ t('pages.technicalMatching.heroSubtitle') }}</p>
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
            <FormField id="name" :label="t('pages.contact.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
            <FormField id="company" :label="t('pages.contact.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
            <FormField id="email" type="email" :label="t('pages.contact.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
            <FormField id="country" :label="t('pages.contact.countryLabel')" required :model-value="form.country" :error="errors.country" @update:model-value="form.country = $event" />
            <FormField id="product" :label="t('pages.technicalMatching.productLabel')" required :model-value="form.product" :error="errors.product" @update:model-value="form.product = $event" />
            <FormField id="format" :label="t('pages.technicalMatching.formatLabel')" :model-value="form.format" @update:model-value="form.format = $event" />
            <FormField id="speed" :label="t('pages.technicalMatching.speedLabel')" :model-value="form.speed" @update:model-value="form.speed = $event" />
            <FormField id="dimensions" :label="t('pages.technicalMatching.dimensionsLabel')" :model-value="form.dimensions" @update:model-value="form.dimensions = $event" />
            <FormField id="contaminant" :label="t('pages.technicalMatching.contaminantLabel')" :model-value="form.contaminant" @update:model-value="form.contaminant = $event" />
            <FormField id="existingEquip" :label="t('pages.technicalMatching.existingEquipLabel')" :model-value="form.existingEquip" @update:model-value="form.existingEquip = $event" />
          </div>
          <FormField id="message" type="textarea" :label="t('pages.technicalMatching.messageLabel')" :model-value="form.message" class="form-message" @update:model-value="form.message = $event" />

          <label class="consent-label">
            <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
            <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
          </label>
          <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>

          <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="submit-btn">
            {{ status === 'loading' ? t('common.loading') : t('pages.technicalMatching.submitLabel') }}
          </BaseButton>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tm-context {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: var(--space-3) 0 0;
  padding: var(--space-3) var(--space-4);
  border-inline-start: 3px solid var(--color-primary);
  background: #F3F7EF;
  border-radius: 4px;
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}
.page-hero { background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%); padding: var(--space-12) 0; color: var(--color-ink); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.page-hero__sub { font-size: var(--text-lg); color: var(--color-ink-muted); max-width: 560px; line-height: var(--leading-normal); }
.section-gap { padding: var(--space-16) 0; }
.form-panel { max-width: 860px; }
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
