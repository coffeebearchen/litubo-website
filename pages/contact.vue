<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const relatedProduct = computed(() => typeof route.query.product === 'string' && /^[a-z0-9-]{1,200}$/.test(route.query.product) ? route.query.product : '')
const relatedApplication = computed(() => typeof route.query.application === 'string' && /^[a-z0-9-]{1,200}$/.test(route.query.application) ? route.query.application : '')

useSeoHead({
  title: t('seo.contact.title'),
  description: t('seo.contact.description'),
  canonicalPath: '/contact',
})

const form = reactive({
  name: '',
  company: '',
  email: '',
  country: '',
  phone: '',
  message: route.query.topic === 'demonstration' ? 'I would like demonstration information for the following equipment / application: ' : '',
  consent: false,
})

const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate(): boolean {
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
    await $fetch('/api/inquiries', {
      method: 'POST',
      body: {
        inquiry_type: 'contact',
        locale: locale.value,
        contact_name: form.name,
        contact_company: form.company,
        contact_email: form.email,
        contact_country: form.country,
        contact_phone: form.phone,
        message: form.message,
        related_product_slug: relatedProduct.value || undefined,
        related_application_slug: relatedApplication.value || undefined,
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
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.contact') }]" />
        <h1 class="page-hero__title">{{ t('pages.contact.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.contact.heroSubtitle') }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container form-page-layout">
        <!-- Form -->
        <div class="form-panel">
          <div v-if="status === 'success'" class="form-success" role="alert">
            <h2>{{ t('common.successTitle') }}</h2>
            <p>{{ t('common.successBody') }}</p>
          </div>

          <div v-else-if="status === 'error'" class="form-error-state" role="alert">
            <p>{{ t('common.errorBody') }}</p>
          </div>

          <form v-else novalidate @submit.prevent="submit">
            <div class="form-grid">
              <FormField id="name" :label="t('pages.contact.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
              <FormField id="company" :label="t('pages.contact.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
              <FormField id="email" type="email" :label="t('pages.contact.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
              <FormField id="country" :label="t('pages.contact.countryLabel')" required :model-value="form.country" :error="errors.country" @update:model-value="form.country = $event" />
              <FormField id="phone" type="tel" :label="t('pages.contact.phoneLabel')" :model-value="form.phone" @update:model-value="form.phone = $event" />
            </div>
            <FormField id="message" type="textarea" :label="t('pages.contact.messageLabel')" required :placeholder="t('pages.contact.messagePlaceholder')" :model-value="form.message" :error="errors.message" class="form-message" @update:model-value="form.message = $event" />

            <label class="consent-label" :class="{ 'consent-label--error': errors.consent }">
              <input v-model="form.consent" type="checkbox" class="consent-checkbox" >
              <span>I agree to the processing of my personal data in accordance with the <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.</span>
            </label>
            <p v-if="errors.consent" class="consent-error" role="alert">{{ errors.consent }}</p>

            <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="submit-btn">
              {{ status === 'loading' ? t('common.loading') : t('pages.contact.submitLabel') }}
            </BaseButton>
          </form>
        </div>

        <!-- Contact info sidebar -->
        <aside class="contact-info">
          <h2 class="contact-info__title">Contact details</h2>
          <p class="contact-info__item"><a href="mailto:info@litubo.com">info@litubo.com</a></p>
          <p class="contact-info__item"><a href="tel:+862152707913">+86 21 5270 7913</a></p>
          <p class="contact-info__item">WhatsApp: <a href="https://wa.me/8619370713936" target="_blank" rel="noopener noreferrer">+86 193 7071 3936</a></p>
          <address class="contact-info__address">
            No. 23, Huangtu Rd., Huaqiao Town,<br>
            Kunshan, Jiangsu Province, China
          </address>
        </aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.page-hero__sub { font-size: var(--text-lg); color: rgba(255,255,255,0.8); max-width: 560px; line-height: var(--leading-normal); }

.section-gap { padding: var(--space-16) 0; }

.form-page-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-12);
  align-items: start;
}

.form-panel {
  max-width: 640px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}

.form-message { margin-bottom: var(--space-5); }

.consent-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.consent-label--error { color: #c0392b; }

.consent-checkbox {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
}

.consent-label a {
  color: var(--color-primary);
  text-decoration: underline;
}

.consent-error {
  font-size: var(--text-xs);
  color: #c0392b;
  margin-bottom: var(--space-4);
}

.submit-btn { margin-top: var(--space-5); }

.form-success {
  padding: var(--space-8);
  background: var(--color-canvas);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.form-success h2 {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-primary);
  margin-bottom: var(--space-3);
}

.form-error-state {
  padding: var(--space-4);
  background: #fff5f5;
  border: 1px solid #f5c6c6;
  border-radius: var(--radius-sm);
  color: #c0392b;
  font-size: var(--text-sm);
}

.contact-info {
  padding: var(--space-6);
  background: var(--color-canvas);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.contact-info__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-5);
}

.contact-info__item {
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
}

.contact-info__item a {
  color: var(--color-primary);
  transition: color var(--transition-fast);
}

.contact-info__item a:hover { color: var(--color-accent); }

.contact-info__address {
  margin-top: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  font-style: normal;
  line-height: 1.7;
}

@media (max-width: 1023px) {
  .form-page-layout {
    grid-template-columns: 1fr;
  }

  .contact-info {
    order: -1;
  }
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
