<script setup lang="ts">
/**
 * The support request form, shared by `/support/<requestType>` and `/resources/downloads`.
 *
 * One submit path, one validation path. The Downloads page passes a `messagePrefix` so the chosen
 * document type reaches the back office as a readable first line, and `showSerial` so the serial
 * field only appears for a manual request. Everything else — the endpoint, the contract, the
 * consent rule and the failure behaviour — is identical because it is the same code.
 */
const props = withDefaults(defineProps<{
  /** support_request_type sent to the API. */
  requestType: string
  /** Prefix prepended to the visitor's own words. Never replaces them. */
  messagePrefix?: string
  /** Show the serial-number field (manuals only). */
  showSerial?: boolean
  /** Button label; falls back to the shared submit label. */
  submitLabel?: string
  /** Optional starting text for the message field. */
  defaultMessage?: string
}>(), {
  messagePrefix: '',
  showSerial: false,
  submitLabel: '',
  defaultMessage: '',
})

const emit = defineEmits<{ success: [] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const form = reactive({
  name: '',
  company: '',
  email: '',
  model: '',
  serial: '',
  country: '',
  message: props.defaultMessage,
  consent: false,
})
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function validate(): boolean {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim()) errors.name = 'Required'
  if (!form.email.trim()) errors.email = 'Required'
  if (!form.message.trim()) errors.message = 'Required'
  if (!form.consent) errors.consent = 'Please agree to continue'
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
        support_request_type: props.requestType,
        locale: locale.value,
        contact_name: form.name,
        contact_company: form.company,
        contact_email: form.email,
        model_number: form.model,
        serial_number: props.showSerial ? form.serial : '',
        contact_country: form.country,
        message: props.messagePrefix ? `${props.messagePrefix}\n\n${form.message}` : form.message,
        consent: form.consent,
        website: '',
      },
    })
    status.value = 'success'
    emit('success')
  }
  catch {
    status.value = 'error'
  }
}
</script>

<template>
  <div class="support-request-form">
    <div v-if="status === 'success'" class="sr-state" role="alert">
      <h2 class="sr-state__title">{{ t('common.successTitle') }}</h2>
      <p class="sr-state__body">{{ t('common.successBody') }}</p>
    </div>

    <template v-else>
      <!-- A failure keeps every value the visitor typed; the alert sits above the fields. -->
      <div v-if="status === 'error'" class="sr-alert" role="alert">
        <p>We could not send your request. Your details are still here — please try again.</p>
      </div>

      <form class="sr-form" novalidate @submit.prevent="submit">
        <div class="sr-grid">
          <FormField id="sr-name" :label="t('pages.serviceRequest.nameLabel')" required :model-value="form.name" :error="errors.name" @update:model-value="form.name = $event" />
          <FormField id="sr-company" :label="t('pages.serviceRequest.companyLabel')" :model-value="form.company" @update:model-value="form.company = $event" />
          <FormField id="sr-email" type="email" :label="t('pages.serviceRequest.emailLabel')" required :model-value="form.email" :error="errors.email" @update:model-value="form.email = $event" />
          <FormField id="sr-model" :label="t('pages.serviceRequest.modelLabel')" :model-value="form.model" @update:model-value="form.model = $event" />
          <FormField v-if="showSerial" id="sr-serial" :label="t('pages.serviceRequest.serialLabel')" :model-value="form.serial" @update:model-value="form.serial = $event" />
          <FormField id="sr-country" :label="t('pages.serviceRequest.countryLabel')" :model-value="form.country" @update:model-value="form.country = $event" />
        </div>

        <FormField
          id="sr-message"
          type="textarea"
          :label="t('pages.serviceRequest.issueLabel')"
          required
          :model-value="form.message"
          :error="errors.message"
          class="sr-message"
          @update:model-value="form.message = $event"
        />

        <label class="sr-consent">
          <input v-model="form.consent" type="checkbox" class="sr-consent__box">
          <span>
            I agree to the processing of my personal data in accordance with the
            <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.
          </span>
        </label>
        <p v-if="errors.consent" class="sr-consent__error" role="alert">{{ errors.consent }}</p>

        <BaseButton type="submit" variant="primary" size="lg" :disabled="status === 'loading'" class="sr-submit">
          {{ status === 'loading' ? t('common.loading') : (submitLabel || t('pages.serviceRequest.submitLabel')) }}
        </BaseButton>
      </form>
    </template>
  </div>
</template>

<style scoped>
.sr-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}
.sr-message { margin-bottom: var(--space-5); }

.sr-consent {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  cursor: pointer;
  margin-bottom: var(--space-2);
}
.sr-consent__box { margin-top: 3px; flex-shrink: 0; accent-color: var(--color-primary); }
.sr-consent a { color: var(--color-primary); text-decoration: underline; }
.sr-consent__error { font-size: var(--text-xs); color: #c0392b; margin-bottom: var(--space-4); }

.sr-submit { margin-top: var(--space-5); }

.sr-alert {
  margin-bottom: var(--space-5);
  padding: var(--space-3) var(--space-4);
  border: 1px solid #E5B4A0;
  border-radius: var(--radius-sm);
  background: #FDF0EA;
  color: #8A3A1A;
  font-size: var(--text-sm);
}
.sr-alert p { margin: 0; }

.sr-state {
  padding: var(--space-8);
  background: var(--color-canvas);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}
.sr-state__title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-primary);
  margin: 0 0 var(--space-3);
}
.sr-state__body { margin: 0; font-size: var(--text-base); color: var(--color-ink-muted); }

@media (max-width: 640px) {
  .sr-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
