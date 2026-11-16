<script setup lang="ts">
/**
 * Become a Partner — a commercial introduction, not a qualification system.
 *
 * The enquiry still goes through the existing `/api/contact` compatibility route with
 * `formId = become-a-partner`; the back office receives `inquiry_type = contact`. The cooperation
 * interest is therefore carried as a readable prefix inside the message, which is the only place it
 * can be carried without inventing an enquiry type the pipeline does not support.
 *
 * Nothing here grants partner status, a territory or exclusivity. Applying is an introduction.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

useSeoHead({ title: t('seo.partner.title'), description: t('seo.partner.description'), canonicalPath: '/company/become-a-partner' })

type Interest = 'distribution' | 'service' | 'integration' | 'other'

const interests: { key: Interest, title: string, body: string }[] = [
  { key: 'distribution', title: 'Distribution', body: 'Represent or supply LITUBO equipment in your market.' },
  { key: 'service', title: 'Service cooperation', body: 'Local service, commissioning or technical support.' },
  { key: 'integration', title: 'System integration', body: 'Build inspection into your own line or system.' },
  { key: 'other', title: 'Other cooperation', body: 'Something else — describe what you have in mind.' },
]

// A controlled value from the query may preselect a topic. Any other value falls back to distribution.
const allowedInterests = interests.map(i => i.key)
const preselected = typeof route.query.role === 'string' && allowedInterests.includes(route.query.role as Interest)
  ? (route.query.role as Interest)
  : 'distribution'

const interest = ref<Interest>(preselected)
const productLine = ref('')

const form = reactive({
  name: '', company: '', email: '', country: '', message: '', consent: false,
})
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

const interestLabel = computed(() => interests.find(i => i.key === interest.value)!.title)

function validate(): boolean {
  for (const k in errors) errors[k] = ''
  if (!form.name.trim()) errors.name = 'Required'
  if (!form.email.trim()) errors.email = 'Required'
  if (!form.country.trim()) errors.country = 'Required'
  if (!form.message.trim()) errors.message = 'Required'
  if (!form.consent) errors.consent = 'Please agree to continue'
  return Object.values(errors).every(v => !v)
}

/** The intent prefix is written once; the visitor's own introduction is never replaced. */
function buildMessage(): string {
  const product = productLine.value.trim() ? `\nEquipment or service experience: ${productLine.value.trim()}` : ''
  return `Partnership enquiry\nCooperation interest: ${interestLabel.value}${product}\n\n${form.message.trim()}`
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: form.name,
        company: form.company,
        email: form.email,
        country: form.country,
        message: buildMessage(),
        consent: form.consent,
        formId: 'become-a-partner',
        sourceUrl: route.fullPath,
        locale: locale.value,
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
  <div class="pt-page">
    <!-- 1. Hero: intent, with a structure diagram rather than a stock handshake -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.partner') }]" />
        <div class="pt-hero">
          <div class="pt-hero__text">
            <p class="eyebrow">Partnership</p>
            <h1 class="pt-hero__title">{{ t('pages.partner.heroTitle') }}</h1>
            <p class="pt-hero__intro">
              Introduce your market, your experience and what you have in mind. A partnership enquiry is
              a conversation about fit — not an application for an account.
            </p>
          </div>
          <aside class="pt-hero__aside">
            <span class="pt-symbol" aria-hidden="true">
              <svg width="104" height="88" viewBox="0 0 104 88" fill="none">
                <circle cx="22" cy="22" r="12" stroke="currentColor" stroke-width="1.3" />
                <circle cx="82" cy="22" r="12" stroke="currentColor" stroke-width="1.3" />
                <circle cx="52" cy="66" r="12" stroke="currentColor" stroke-width="1.3" />
                <path d="M34 24h36M28 34l18 22M76 34L58 56" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </span>
            <ul role="list">
              <li><span>Market</span>Where you operate and who you serve</li>
              <li><span>Experience</span>Equipment, service or integration background</li>
              <li><span>Intent</span>What a cooperation would look like</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>

    <CompanyNav />

    <!-- 2. Cooperation topics -->
    <section class="pt-band">
      <div class="container">
        <p class="eyebrow">Cooperation interest</p>
        <h2 class="pt-h2">What kind of cooperation are you considering?</h2>
        <div class="pt-topics" role="radiogroup" aria-label="Cooperation interest">
          <button
            v-for="item in interests"
            :key="item.key"
            type="button"
            role="radio"
            class="pt-topic"
            :class="{ 'is-active': interest === item.key }"
            :aria-checked="interest === item.key"
            @click="interest = item.key"
          >
            <span class="pt-topic__title">{{ item.title }}</span>
            <span class="pt-topic__body">{{ item.body }}</span>
          </button>
        </div>

        <div class="pt-main">
          <div class="pt-form">
            <h2 class="pt-form__title">Introduce your company</h2>
            <p class="pt-form__intro">Two short groups: your market and experience, then how to reach you.</p>
            <p class="pt-form__context">Cooperation interest: {{ interestLabel }}</p>

            <div v-if="status === 'success'" class="pt-state pt-state--ok" role="alert">
              <h3>Thank you — your introduction has been received.</h3>
              <p>Our team will review it and reply by email. This does not create a partnership yet.</p>
            </div>

            <template v-else>
              <div v-if="status === 'error'" class="pt-state pt-state--error" role="alert">
                <p>We could not send this. Your details are still here — please try again.</p>
              </div>

              <form novalidate @submit.prevent="submit">
                <fieldset class="pt-group">
                  <legend class="pt-group__legend"><span>01</span> Market and experience</legend>
                  <div class="pt-fields">
                    <label class="pt-field pt-field--wide">
                      <span>Your introduction <em>*</em></span>
                      <textarea v-model="form.message" rows="6" :class="{ 'is-error': errors.message }" placeholder="Your market, the customers you serve, your experience with inspection equipment or service, and what you have in mind." />
                    </label>
                    <label class="pt-field">
                      <span>Country / region <em>*</em></span>
                      <input v-model="form.country" type="text" :class="{ 'is-error': errors.country }">
                    </label>
                    <label class="pt-field">
                      <span>Equipment or service experience</span>
                      <input v-model="productLine" type="text" placeholder="If applicable">
                    </label>
                  </div>
                </fieldset>

                <fieldset class="pt-group">
                  <legend class="pt-group__legend"><span>02</span> Your contact</legend>
                  <div class="pt-fields">
                    <label class="pt-field">
                      <span>Full name <em>*</em></span>
                      <input v-model="form.name" type="text" autocomplete="name" :class="{ 'is-error': errors.name }">
                    </label>
                    <label class="pt-field">
                      <span>Company</span>
                      <input v-model="form.company" type="text" autocomplete="organization">
                    </label>
                    <label class="pt-field">
                      <span>Work email <em>*</em></span>
                      <input v-model="form.email" type="email" autocomplete="email" :class="{ 'is-error': errors.email }">
                    </label>
                  </div>
                </fieldset>

                <label class="pt-consent">
                  <input v-model="form.consent" type="checkbox">
                  <span>
                    I agree to the processing of my personal data in accordance with the
                    <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.
                  </span>
                </label>
                <p v-if="errors.consent" class="pt-error" role="alert">{{ errors.consent }}</p>

                <button type="submit" class="pt-submit" :disabled="status === 'loading'">
                  {{ status === 'loading' ? 'Sending…' : 'Send partnership enquiry' }} →
                </button>
              </form>
            </template>
          </div>

          <aside class="pt-help">
            <div class="pt-help__card">
              <p class="eyebrow">Helpful to include</p>
              <h3 class="pt-help__title">What makes an introduction useful</h3>
              <ul class="pt-help__list" role="list">
                <li><span>01</span> The industries and customers you already serve</li>
                <li><span>02</span> Your experience with inspection or weighing equipment</li>
                <li><span>03</span> The kind of cooperation you are proposing</li>
              </ul>
            </div>

            <div class="pt-help__card pt-help__card--note">
              <p class="eyebrow">Please note</p>
              <p class="pt-help__body">
                Sending this enquiry does not grant partner status, a territory or exclusivity. Those are
                separate commercial decisions, discussed after both sides understand the fit.
              </p>
            </div>

            <div class="pt-help__card">
              <p class="eyebrow">Already a customer?</p>
              <p class="pt-help__body">
                If your question is about equipment you already run, the support routes are faster than a
                partnership enquiry.
              </p>
              <NuxtLink :to="localePath('/company/global-service')" class="pt-help__link">
                Go to Global Service →
              </NuxtLink>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav.company')"
      :secondary-to="localePath('/company/about')"
    />
  </div>
</template>

<style scoped>
.pt-band { padding: var(--space-16) 0; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.pt-h2 {
  margin: 0 0 var(--space-5);
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, 41px);
  line-height: 1.15;
  color: var(--color-ink);
}

.pt-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 1fr);
  gap: 62px;
  align-items: center;
  padding-block: var(--space-5) 44px;
}
.pt-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, 61px);
  line-height: 1.08;
  color: var(--color-ink);
}
.pt-hero__intro {
  margin: 0;
  max-width: 560px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.pt-hero__aside { padding: var(--space-6); border: 1px solid #D2DFD0; border-radius: 6px; background: #F3F7EF; }
.pt-symbol { display: block; color: var(--color-primary); margin-bottom: var(--space-4); }
.pt-hero__aside ul { list-style: none; margin: 0; padding: 0; }
.pt-hero__aside li { padding: var(--space-2) 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.pt-hero__aside li:last-child { border-bottom: 0; }
.pt-hero__aside li span { display: block; font-weight: 600; color: var(--color-ink); }

.pt-topics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin-bottom: var(--space-10); }
.pt-topic {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 24px;
  border: 1px solid #D2DFD0;
  border-radius: 6px;
  background: #fff;
  text-align: start;
  font: inherit;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}
.pt-topic.is-active { border: 2px solid var(--color-primary); background: #F3F7EF; padding: 23px; }
.pt-topic__title { font-size: var(--text-lg); font-weight: 600; color: var(--color-ink); }
.pt-topic__body { font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }

.pt-main { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 40px; align-items: start; }
.pt-form { padding: 32px 35px; border: 1px solid #D2DFD0; border-top: 3px solid var(--color-primary); border-radius: 6px; background: #fff; }
.pt-form__title { margin: 0 0 var(--space-2); font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-ink); }
.pt-form__intro { margin: 0 0 var(--space-3); font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.pt-form__context {
  display: inline-block;
  margin: 0 0 var(--space-5);
  padding: 6px 12px;
  border-radius: 999px;
  background: #F3F7EF;
  font-size: var(--text-xs);
  color: var(--color-primary);
}

.pt-group { border: 0; margin: 0 0 27px; padding: 0; }
.pt-group__legend { display: flex; align-items: baseline; gap: var(--space-3); padding: 0; margin-bottom: var(--space-3); font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.pt-group__legend span { font-family: var(--font-display); color: var(--color-ink-muted); }
.pt-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.pt-field { display: flex; flex-direction: column; gap: 6px; }
.pt-field--wide { grid-column: 1 / -1; }
.pt-field span { font-size: var(--text-sm); color: var(--color-ink); }
.pt-field em { color: var(--color-primary); font-style: normal; }
.pt-field input,
.pt-field textarea {
  width: 100%;
  min-width: 0;
  min-height: 50px;
  padding: 12px 14px;
  border: 1px solid #B9CABA;
  border-radius: 4px;
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-ink);
  background: #fff;
}
.pt-field textarea { min-height: 155px; resize: vertical; }
.pt-field input.is-error,
.pt-field textarea.is-error { border-color: #B4451F; }

.pt-consent { display: flex; gap: var(--space-2); align-items: flex-start; padding-top: var(--space-4); border-top: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.pt-consent input { margin-top: 4px; accent-color: var(--color-primary); }
.pt-consent a { color: var(--color-primary); }
.pt-error { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: #B4451F; }
.pt-submit {
  margin-top: var(--space-4);
  padding: 13px 24px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #203C32;
  font: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
}
.pt-submit:hover { filter: brightness(0.96); }
.pt-submit:disabled { opacity: 0.7; cursor: default; }

.pt-state { padding: var(--space-4); border-radius: var(--radius-sm); }
.pt-state--ok { background: #EEF6EA; border: 1px solid #C7D8CA; }
.pt-state--ok h3 { margin: 0 0 var(--space-2); font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-primary); }
.pt-state--ok p { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); }
.pt-state--error { background: #FDF0EA; border: 1px solid #E5B4A0; margin-bottom: var(--space-4); }
.pt-state--error p { margin: 0; font-size: var(--text-sm); color: #8A3A1A; }

.pt-help { display: flex; flex-direction: column; gap: var(--space-4); }
.pt-help__card { padding: 27px; border: 1px solid #D2DFD0; border-radius: 6px; background: #FAFAF5; }
.pt-help__card--note { background: #F3F7EF; }
.pt-help__title { margin: 0 0 var(--space-3); font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-ink); }
.pt-help__body { margin: 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.pt-help__list { list-style: none; margin: 0; padding: 0; }
.pt-help__list li { display: flex; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.pt-help__list li:last-child { border-bottom: 0; }
.pt-help__list li span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.pt-help__link { display: inline-block; margin-top: var(--space-3); font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.pt-help__link:hover { text-decoration: underline; }

@media (max-width: 1023px) {
  .pt-hero, .pt-main { grid-template-columns: minmax(0, 1fr); gap: 27px; }
  .pt-topics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
}

@media (max-width: 700px) {
  .pt-band { padding: var(--space-10) 0; }
  .pt-hero__title { font-size: 45px; }
  .pt-topic { padding: 18px; }
  .pt-topic.is-active { padding: 17px; }
  .pt-form { padding: 25px 23px; }
  .pt-fields { grid-template-columns: minmax(0, 1fr); }
  .pt-field textarea { min-height: 165px; }
  .pt-submit { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .pt-topic { transition: none; }
}
</style>
