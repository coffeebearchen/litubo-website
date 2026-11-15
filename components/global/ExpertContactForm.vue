<script setup lang="ts">
import { reactive, ref } from 'vue'

const { locale } = useI18n()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  country: '',
  message: '',
  consent: false,
  website: '', // honeypot
})

const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate(): boolean {
  for (const k in errors) errors[k] = ''
  if (!form.firstName.trim() && !form.lastName.trim()) errors.name = 'Required'
  if (!form.email.trim()) errors.email = 'Required'
  if (!form.country.trim()) errors.country = 'Required'
  if (!form.message.trim()) errors.message = 'Required'
  if (!form.consent) errors.consent = 'You must agree to continue'
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
        contact_name: `${form.firstName} ${form.lastName}`.trim(),
        contact_company: form.company,
        contact_email: form.email,
        contact_country: form.country,
        message: form.message,
        consent: form.consent,
        website: form.website,
      },
    })
    status.value = 'success'
  }
  catch {
    status.value = 'error'
  }
}
</script>

<template>
  <section class="expert">
    <div class="container">
      <h2 class="expert__title">Connect with an Expert</h2>
      <p class="expert__sub">Tell us about your product and line. We will confirm the right inspection approach with you.</p>

      <div v-if="status === 'success'" class="expert__state">
        <h3>Thank you — your enquiry has been received.</h3>
        <p>Our team will get back to you shortly.</p>
      </div>
      <div v-else-if="status === 'error'" class="expert__state expert__state--error">
        <p>Something went wrong. Please try again or email info@litubo.com.</p>
      </div>

      <form v-else class="expert__form" novalidate @submit.prevent="submit">
        <div class="expert__grid">
          <label class="expert__field">
            <span>First name <em>*</em></span>
            <input v-model="form.firstName" type="text" autocomplete="given-name" :class="{ 'is-error': errors.name }">
          </label>
          <label class="expert__field">
            <span>Last name</span>
            <input v-model="form.lastName" type="text" autocomplete="family-name">
          </label>
          <label class="expert__field">
            <span>Work email <em>*</em></span>
            <input v-model="form.email" type="email" autocomplete="email" :class="{ 'is-error': errors.email }">
          </label>
          <label class="expert__field">
            <span>Company</span>
            <input v-model="form.company" type="text" autocomplete="organization">
          </label>
          <label class="expert__field">
            <span>Country / Region <em>*</em></span>
            <input v-model="form.country" type="text" autocomplete="country-name" :class="{ 'is-error': errors.country }">
          </label>
          <label class="expert__field expert__field--wide">
            <span>Your requirements <em>*</em></span>
            <textarea v-model="form.message" rows="4" :class="{ 'is-error': errors.message }" placeholder="Product, packaging, line speed, contaminants you need to detect…" />
          </label>
        </div>

        <label class="expert__consent">
          <input v-model="form.consent" type="checkbox">
          <span>I agree to the processing of my personal data in accordance with the Privacy Policy.</span>
        </label>
        <p v-if="errors.consent" class="expert__error">{{ errors.consent }}</p>

        <button type="submit" class="expert__submit" :disabled="status === 'loading'">
          {{ status === 'loading' ? 'Sending…' : 'Submit inquiry' }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.expert {
  background: var(--color-canvas);
  padding-block: var(--space-16);
}

.expert__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-primary-deep);
  margin: 0 0 var(--space-3);
}

.expert__sub {
  color: var(--color-ink-muted);
  font-size: var(--text-base);
  margin: 0 0 var(--space-8);
  max-width: 640px;
}

.expert__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.expert__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}

.expert__field--wide { grid-column: 1 / -1; }

.expert__field em { color: var(--color-accent); font-style: normal; }

.expert__field input,
.expert__field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  font: inherit;
  color: var(--color-ink);
}

.expert__field input:focus,
.expert__field textarea:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.expert__field .is-error { border-color: #b3261e; }

.expert__consent {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-5);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}

.expert__consent input { margin-top: 3px; }

.expert__error {
  color: #b3261e;
  font-size: var(--text-sm);
  margin: var(--space-2) 0 0;
}

.expert__submit {
  margin-top: var(--space-6);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 11px 26px;
  background: var(--color-primary);
  color: var(--color-white);
  font: 600 var(--text-sm)/1.4 var(--font-body);
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  cursor: pointer;
}

.expert__submit:hover { background: var(--color-primary-deep); }
.expert__submit:disabled { opacity: .7; cursor: progress; }

.expert__state {
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-8);
}

.expert__state h3 {
  font-family: var(--font-display);
  color: var(--color-primary);
  margin: 0 0 var(--space-2);
}

.expert__state--error { border-color: #b3261e; }

@media (max-width: 900px) {
  .expert__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .expert__grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
