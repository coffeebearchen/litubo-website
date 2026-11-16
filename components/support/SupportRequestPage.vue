<script setup lang="ts">
/**
 * The three Support request pages, sharing one layout and three configs.
 *
 * Visual language follows the V2 handoff: cold-light hero with a labelled info card, a local support
 * nav, a numbered fieldset form beside three help cards, and the shared footer.
 *
 * Each mode keeps its own existing contract — the layout is shared, the business type is not:
 *   spare-parts   → inquiry_type = spare_parts,           model required, no name/company
 *   service       → inquiry_type = support_request + support_request_type = service-training
 *   product-test  → inquiry_type = send_product_test,     product → tm_product_interest
 *
 * Nothing here promises stock, lead time, training dates, test capability or shipping approval.
 */
type Mode = 'spare-parts' | 'service' | 'product-test'

const props = defineProps<{ mode: Mode }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Field {
  key: string
  label: string
  type: 'text' | 'email' | 'textarea'
  required?: boolean
  placeholder?: string
  hint?: string
  rows?: number
}
interface Group { n: string, title: string, fields: Field[] }

interface Config {
  navLabel: string
  eyebrow: string
  title: string
  intro: string
  steps: string[]
  heroTitle: string
  heroRows: { label: string, value: string }[]
  heroNote: string
  formTitle: string
  formIntro: string
  chip: string
  groups: Group[]
  optionalLabel: string
  optionalFields: Field[]
  submitLabel: string
  submitNote: string
  help: { title: string, body: string, list?: string[], link?: { label: string, to: string } }[]
}

const configs: Record<Mode, Config> = {
  'spare-parts': {
    navLabel: 'Request Spare Parts',
    eyebrow: 'Support · Equipment & parts',
    title: 'Request spare parts.',
    intro: 'Start with the equipment and the part you need. The model and serial number help us identify the relevant information.',
    steps: ['Equipment', 'Part details', 'Your contact'],
    heroTitle: 'Identify before ordering.',
    heroRows: [{ label: 'MODEL', value: 'Copy from your equipment' }, { label: 'SERIAL', value: 'Include if available' }],
    heroNote: 'Check the equipment label or existing documentation for the model and serial number.',
    formTitle: 'Your spare-parts request',
    formIntro: 'Describe the part in your own words. Include any markings or quantity if known.',
    chip: 'Spare parts',
    groups: [
      {
        n: '01',
        title: 'Identify your equipment',
        fields: [
          { key: 'model', label: 'Machine model', type: 'text', required: true, placeholder: 'As shown on the equipment label' },
          { key: 'serial', label: 'Serial number', type: 'text', placeholder: 'If available' },
          { key: 'country', label: 'Installation country', type: 'text', placeholder: '' },
        ],
      },
      {
        n: '02',
        title: 'Describe the part',
        fields: [
          { key: 'parts', label: 'Parts required', type: 'textarea', required: true, rows: 5, placeholder: 'Part name, markings, quantity or a description of what you need.', hint: 'You can describe a part even if you do not know its part number.' },
        ],
      },
      {
        n: '03',
        title: 'Your contact',
        fields: [{ key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'you@company.com' }],
      },
    ],
    optionalLabel: 'Additional notes (optional)',
    optionalFields: [{ key: 'notes', label: 'Anything else we should know', type: 'textarea', rows: 4 }],
    submitLabel: 'Send parts request',
    submitNote: 'Your request helps the team identify the next information to discuss.',
    help: [
      { title: 'Find the equipment details.', body: 'The model and serial number help identify the equipment you are asking about.', link: { label: 'Cannot identify the model? Ask for help', to: '/support/technical-support' } },
      { title: 'Describe what you need.', body: 'A short description is enough to start.', list: ['Part markings or a brief description', 'Quantity, if known', 'Photos you can share when requested'] },
      { title: 'What happens next?', body: 'The equipment and part details are reviewed before the relevant information is confirmed.', link: { label: 'Looking for a manual instead?', to: '/resources/downloads' } },
    ],
  },
  service: {
    navLabel: 'Service & Training',
    eyebrow: 'Support · Service & training',
    title: 'Service & training.',
    intro: 'Tell us what you need to resolve or learn. You do not need to diagnose the equipment before asking.',
    steps: ['Your request', 'Equipment', 'Your contact'],
    heroTitle: 'What to prepare.',
    heroRows: [{ label: 'EQUIPMENT', value: 'Model and serial if available' }, { label: 'PEOPLE', value: 'Who needs the guidance' }],
    heroNote: 'Describe the task you want to complete, not only the symptom you noticed.',
    formTitle: 'Your service or training request',
    formIntro: 'Choose the closest topic, then describe what you need in your own words.',
    chip: 'Service & training',
    groups: [
      {
        n: '01',
        title: 'Your request',
        fields: [{ key: 'issue', label: 'Your request', type: 'textarea', required: true, rows: 5, placeholder: 'Describe the task, the question or the training you need.' }],
      },
      {
        n: '02',
        title: 'Equipment',
        fields: [
          { key: 'model', label: 'Machine model', type: 'text', placeholder: 'If known' },
          { key: 'serial', label: 'Serial number', type: 'text', placeholder: 'If available' },
          { key: 'country', label: 'Installation country', type: 'text' },
        ],
      },
      {
        n: '03',
        title: 'Your contact',
        fields: [
          { key: 'name', label: 'Full name', type: 'text', required: true },
          { key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'you@company.com' },
          { key: 'company', label: 'Company', type: 'text' },
        ],
      },
    ],
    optionalLabel: 'Additional notes (optional)',
    optionalFields: [{ key: 'notes', label: 'Anything else we should know', type: 'textarea', rows: 4 }],
    submitLabel: 'Send request',
    submitNote: 'Service and training scope is discussed with the team before anything is scheduled.',
    help: [
      { title: 'Which equipment?', body: 'Model and installation country help the team prepare. Serial number is useful if you have it.', link: { label: 'Not sure which model? Ask for help', to: '/support/technical-support' } },
      { title: 'Who needs the guidance?', body: 'Operators, line supervisors and maintenance staff have different questions.', list: ['Who will take part', 'Their current experience level', 'The language the session is delivered in'] },
      { title: 'What should we know?', body: 'Describe the operation you want to complete. A diagnosis is not required to start the conversation.' },
    ],
  },
  'product-test': {
    navLabel: 'Send Product for Test',
    eyebrow: 'Support · Product test',
    title: 'Request a product test.',
    intro: 'Describe the product and the question you want answered. The team confirms the arrangement before anything is sent.',
    steps: ['Describe the product', 'Discuss requirements', 'Confirm arrangements'],
    heroTitle: 'Confirm before shipping.',
    heroRows: [{ label: 'PRODUCT', value: 'Actual product and condition' }, { label: 'PACK', value: 'Packaging and dimensions' }],
    heroNote: 'Please do not send samples until the team has confirmed the arrangement with you.',
    formTitle: 'Your product test request',
    formIntro: 'Describe the real product and the condition it runs in, so the question can be assessed.',
    chip: 'Product test',
    groups: [
      {
        n: '01',
        title: 'Describe the product',
        fields: [
          { key: 'product', label: 'Product description', type: 'textarea', required: true, rows: 4, placeholder: 'What the product is, its state (loose, packed, frozen) and the packaging around it.' },
          { key: 'concern', label: 'Contaminant or issue', type: 'text', placeholder: 'If you already know what concerns you' },
        ],
      },
      {
        n: '02',
        title: 'Your contact',
        fields: [
          { key: 'name', label: 'Full name', type: 'text', required: true },
          { key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'you@company.com' },
          { key: 'company', label: 'Company', type: 'text' },
          { key: 'country', label: 'Country / region', type: 'text' },
        ],
      },
    ],
    optionalLabel: 'Packaging and additional details (optional)',
    optionalFields: [{ key: 'notes', label: 'Packaging, dimensions or other notes', type: 'textarea', rows: 4 }],
    submitLabel: 'Send test request',
    submitNote: 'This is a request, not an approval. The team confirms whether and how the test can proceed.',
    help: [
      { title: 'What to prepare.', body: 'A useful discussion starts from the real product.', list: ['The actual product and its state', 'Packaging and dimensions', 'The question you want investigated'] },
      { title: 'Wait for confirmation.', body: 'Please do not ship samples before the team has confirmed the arrangement with you.' },
      { title: 'What this is not.', body: 'This form does not approve a test, book a slot or guarantee that a particular contaminant can be found.' },
    ],
  },
}

const cfg = computed(() => configs[props.mode])

const form = reactive({
  name: '', company: '', email: '', model: '', serial: '', country: '',
  parts: '', issue: '', product: '', concern: '', notes: '',
  consent: false,
})
const topic = ref<'guidance' | 'training' | 'other'>('guidance')
const errors = reactive<Record<string, string>>({})
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

const topics = [
  { key: 'guidance' as const, label: 'Service guidance' },
  { key: 'training' as const, label: 'Operator training' },
  { key: 'other' as const, label: 'Other questions' },
]

function requiredEmail(key: string): string | undefined {
  const v = (form as Record<string, string>)[key]
  return v && v.trim() ? undefined : 'Required'
}

function validate(): boolean {
  for (const k in errors) errors[k] = ''
  if (props.mode === 'spare-parts') {
    if (!form.model.trim()) errors.model = 'Required'
    if (!form.parts.trim()) errors.parts = 'Required'
    if (!form.email.trim()) errors.email = 'Required'
  }
  else if (props.mode === 'service') {
    if (!form.name.trim()) errors.name = 'Required'
    if (!form.email.trim()) errors.email = 'Required'
    if (!form.issue.trim()) errors.issue = 'Required'
  }
  else {
    if (!form.name.trim()) errors.name = 'Required'
    if (!form.email.trim()) errors.email = 'Required'
    if (!form.product.trim()) errors.product = 'Required'
  }
  if (!form.consent) errors.consent = 'Please agree to continue'
  return Object.values(errors).every(v => !v)
}

/** Builds the message: a fixed readable prefix once, then the visitor's own words unchanged. */
function buildMessage(): string {
  const notes = form.notes.trim() ? `\n\nAdditional notes:\n${form.notes.trim()}` : ''
  if (props.mode === 'spare-parts') return `${form.parts.trim()}${notes}`
  if (props.mode === 'service') {
    const label = topics.find(x => x.key === topic.value)!.label
    return `Request topic: ${label}\n\n${form.issue.trim()}${notes}`
  }
  return `${form.product.trim()}${notes}`
}

async function submit() {
  if (!validate()) return
  status.value = 'loading'
  const base = {
    locale: locale.value,
    contact_email: form.email,
    consent: form.consent,
    website: '',
  }
  try {
    if (props.mode === 'spare-parts') {
      await $fetch('/api/inquiries', {
        method: 'POST',
        body: {
          ...base,
          inquiry_type: 'spare_parts',
          model_number: form.model,
          serial_number: form.serial,
          contact_country: form.country,
          message: buildMessage(),
        },
      })
    }
    else if (props.mode === 'service') {
      await $fetch('/api/inquiries', {
        method: 'POST',
        body: {
          ...base,
          inquiry_type: 'support_request',
          support_request_type: 'service-training',
          contact_name: form.name,
          contact_company: form.company,
          model_number: form.model,
          serial_number: form.serial,
          contact_country: form.country,
          message: buildMessage(),
        },
      })
    }
    else {
      await $fetch('/api/inquiries', {
        method: 'POST',
        body: {
          ...base,
          inquiry_type: 'send_product_test',
          contact_name: form.name,
          contact_company: form.company,
          contact_country: form.country,
          tm_product_interest: form.product,
          concern: form.concern,
          message: buildMessage(),
        },
      })
    }
    status.value = 'success'
  }
  catch {
    status.value = 'error'
  }
}

const nav = [
  { label: 'Request Spare Parts', to: '/support/request-spare-parts' },
  { label: 'Service & Training', to: '/support/service-training' },
  { label: 'Send Product Test', to: '/support/send-product-test' },
  { label: 'Technical documents', to: '/resources/downloads' },
]
</script>

<template>
  <div class="support-page">
    <!-- Hero: cold-light, with a labelled info card rather than a photograph -->
    <section class="sp-hero">
      <div class="container sp-hero__inner">
        <div class="sp-hero__text">
          <p class="eyebrow">{{ cfg.eyebrow }}</p>
          <h1 class="sp-hero__title">{{ cfg.title }}</h1>
          <p class="sp-hero__intro">{{ cfg.intro }}</p>
          <ol class="sp-steps" role="list">
            <li v-for="(s, i) in cfg.steps" :key="s">
              <span class="sp-steps__n">{{ i + 1 }}</span>{{ s }}
            </li>
          </ol>
        </div>
        <aside class="sp-hero__card">
          <p class="sp-hero__kicker">A useful starting point</p>
          <p class="sp-hero__card-title">{{ cfg.heroTitle }}</p>
          <dl class="sp-labels">
            <div v-for="row in cfg.heroRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd dir="ltr">{{ row.value }}</dd>
            </div>
          </dl>
          <p class="sp-hero__note">{{ cfg.heroNote }}</p>
        </aside>
      </div>
    </section>

    <!-- Local support nav -->
    <nav class="sp-nav" aria-label="Support requests">
      <div class="container sp-nav__inner">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="localePath(item.to)"
          class="sp-nav__item"
          :class="{ 'is-active': localePath(item.to) === $route.path }"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>

    <!-- Form + help -->
    <section class="sp-main">
      <div class="container sp-main__inner">
        <div class="sp-form">
          <header class="sp-form__head">
            <h2 class="sp-form__title">{{ cfg.formTitle }}</h2>
            <span class="sp-form__required">* Required</span>
          </header>
          <p class="sp-form__intro">{{ cfg.formIntro }}</p>
          <p class="sp-chip">{{ cfg.chip }}</p>

          <div v-if="status === 'success'" class="sp-state sp-state--ok" role="alert">
            <h3>Thank you — your request has been received.</h3>
            <p>Our team will review it and reply by email.</p>
          </div>

          <template v-else>
            <div v-if="status === 'error'" class="sp-state sp-state--error" role="alert">
              <p>We could not send your request. Your details are still here — please try again.</p>
            </div>

            <form novalidate @submit.prevent="submit">
              <fieldset v-for="group in cfg.groups" :key="group.n" class="sp-group">
                <legend class="sp-group__legend">
                  <span class="sp-group__n">{{ group.n }}</span>
                  <span class="sp-group__title">{{ group.title }}</span>
                </legend>

                <div class="sp-fields" :class="{ 'sp-fields--single': group.fields.length === 1 }">
                  <label v-for="field in group.fields" :key="field.key" class="sp-field" :class="{ 'sp-field--wide': field.type === 'textarea' }">
                    <span class="sp-field__label">{{ field.label }} <em v-if="field.required">*</em></span>
                    <textarea
                      v-if="field.type === 'textarea'"
                      v-model="(form as Record<string, string>)[field.key]"
                      :rows="field.rows ?? 5"
                      :placeholder="field.placeholder"
                      :class="{ 'is-error': errors[field.key] }"
                    />
                    <input
                      v-else
                      v-model="(form as Record<string, string>)[field.key]"
                      :type="field.type"
                      :placeholder="field.placeholder"
                      :class="{ 'is-error': errors[field.key] }"
                    >
                    <span v-if="field.hint" class="sp-field__hint">{{ field.hint }}</span>
                  </label>
                </div>

                <!-- Topic buttons belong to the service request only -->
                <div v-if="mode === 'service' && group.n === '01'" class="sp-topics" role="radiogroup" aria-label="Request topic">
                  <button
                    v-for="tp in topics"
                    :key="tp.key"
                    type="button"
                    role="radio"
                    class="sp-topic"
                    :class="{ 'is-selected': topic === tp.key }"
                    :aria-checked="topic === tp.key"
                    @click="topic = tp.key"
                  >
                    {{ tp.label }}
                  </button>
                </div>
              </fieldset>

              <details class="sp-optional">
                <summary>{{ cfg.optionalLabel }}</summary>
                <div class="sp-optional__body">
                  <label v-for="field in cfg.optionalFields" :key="field.key" class="sp-field">
                    <span class="sp-field__label">{{ field.label }}</span>
                    <textarea
                      v-model="(form as Record<string, string>)[field.key]"
                      :rows="field.rows ?? 4"
                    />
                  </label>
                </div>
              </details>

              <label class="sp-consent">
                <input v-model="form.consent" type="checkbox">
                <span>
                  I agree to the processing of my personal data in accordance with the
                  <NuxtLink :to="localePath('/privacy-policy')">Privacy Policy</NuxtLink>.
                </span>
              </label>
              <p v-if="errors.consent" class="sp-error" role="alert">{{ errors.consent }}</p>

              <div class="sp-submit-row">
                <button type="submit" class="sp-submit" :disabled="status === 'loading'">
                  {{ status === 'loading' ? 'Sending…' : cfg.submitLabel }} →
                </button>
                <p class="sp-submit__note">{{ cfg.submitNote }}</p>
              </div>
            </form>
          </template>
        </div>

        <aside class="sp-help">
          <div v-for="card in cfg.help" :key="card.title" class="sp-help__card">
            <p class="sp-help__kicker">Helpful to prepare</p>
            <h3 class="sp-help__title">{{ card.title }}</h3>
            <p class="sp-help__body">{{ card.body }}</p>
            <ol v-if="card.list" class="sp-help__list" role="list">
              <li v-for="(item, i) in card.list" :key="item">
                <span>{{ String(i + 1).padStart(2, '0') }}</span>{{ item }}
              </li>
            </ol>
            <NuxtLink v-if="card.link" :to="localePath(card.link.to)" class="sp-help__link">
              {{ card.link.label }} →
            </NuxtLink>
          </div>
        </aside>
      </div>
    </section>

    <!-- Other support entries -->
    <section class="sp-other">
      <div class="container sp-other__inner">
        <p class="sp-other__text">Looking for a different kind of support?</p>
        <NuxtLink :to="localePath('/support')" class="sp-other__link">Explore support options →</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

/* Hero */
.sp-hero { background: linear-gradient(180deg, #F5F7F3 0%, #F0F5EF 100%); padding-block: var(--space-8) 35px; }
.sp-hero__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 65px;
  align-items: start;
}
.sp-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 3.6vw, var(--text-5xl));
  line-height: 1.1;
  color: var(--color-ink);
}
.sp-hero__intro {
  margin: 0 0 var(--space-5);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
  max-width: 620px;
}
.sp-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
.sp-steps li { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--color-ink-muted); }
.sp-steps__n {
  display: inline-grid; place-items: center;
  width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid #C7D8CA; font-size: 10px; color: var(--color-primary);
}

.sp-hero__card {
  max-width: 370px;
  padding: 25px 28px;
  border: 1px solid #C7D8CA;
  border-radius: 7px;
  background: #fff;
}
.sp-hero__kicker { margin: 0 0 var(--space-3); font-size: var(--text-xs); letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-ink-muted); }
.sp-hero__card-title { margin: 0 0 var(--space-4); font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-ink); }
.sp-labels { margin: 0 0 var(--space-4); display: flex; flex-direction: column; gap: 6px; }
.sp-labels div { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: var(--space-2); padding: 8px 10px; border: 1px solid #E3EBE4; border-radius: 4px; background: #FAFBF8; }
.sp-labels dt { font-size: 11px; letter-spacing: 0.08em; color: var(--color-ink-muted); }
.sp-labels dd { margin: 0; font-size: var(--text-xs); color: var(--color-ink); }
.sp-hero__note { margin: 0; padding: var(--space-3); border-inline-start: 3px solid var(--color-primary); background: #F0F5EC; font-size: var(--text-xs); line-height: 1.5; color: var(--color-ink-muted); }

/* Local nav */
.sp-nav { border-bottom: 1px solid #DAE3DD; background: #fff; }
.sp-nav__inner { display: flex; gap: 34px; padding-block: 17px; overflow-x: auto; scrollbar-width: none; }
.sp-nav__inner::-webkit-scrollbar { display: none; }
.sp-nav__item {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  text-decoration: none;
  padding-bottom: 6px;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.sp-nav__item:hover { color: var(--color-primary); }
.sp-nav__item.is-active { color: var(--color-ink); border-bottom-color: var(--color-primary); }

/* Main */
.sp-main { background: #FAFBF8; padding-block: 48px 60px; }
.sp-main__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
  gap: 40px;
  align-items: start;
}

.sp-form {
  padding: 32px 36px;
  border: 1px solid #D1DED3;
  border-top: 3px solid var(--color-primary);
  border-radius: 6px;
  background: #fff;
}
.sp-form__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); }
.sp-form__title { margin: 0; font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-ink); }
.sp-form__required { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; }
.sp-form__intro { margin: var(--space-2) 0 var(--space-4); font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.sp-chip {
  display: inline-block;
  margin: 0 0 var(--space-5);
  padding: 6px 12px;
  border-radius: 999px;
  background: #F0F5EC;
  font-size: var(--text-xs);
  color: var(--color-primary);
}

.sp-group { border: 0; margin: 0 0 27px; padding: 0; }
.sp-group__legend { display: flex; align-items: baseline; gap: var(--space-3); padding: 0; margin-bottom: var(--space-3); }
.sp-group__n { font-family: var(--font-display); font-size: var(--text-lg); color: var(--color-ink-muted); }
.sp-group__title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }

.sp-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.sp-fields--single { grid-template-columns: minmax(0, 1fr); }
.sp-field { display: flex; flex-direction: column; gap: 6px; }
.sp-field--wide { grid-column: 1 / -1; }
.sp-field__label { font-size: var(--text-sm); color: var(--color-ink); }
.sp-field__label em { color: var(--color-primary); font-style: normal; }
.sp-field__hint { font-size: var(--text-xs); color: var(--color-ink-muted); }
.sp-field input,
.sp-field textarea {
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
.sp-field textarea { min-height: 140px; resize: vertical; }
.sp-field input.is-error,
.sp-field textarea.is-error { border-color: #B4451F; }

.sp-topics { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
.sp-topic {
  min-height: 42px;
  padding: 8px 16px;
  border: 1px solid #D1DED3;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-ink);
  cursor: pointer;
}
.sp-topic.is-selected { background: #E9F1E5; border-color: var(--color-primary); color: var(--color-primary); }

.sp-optional {
  margin: 0 0 var(--space-5);
  padding: 14px 17px;
  border: 1px solid #DDE6DC;
  border-radius: 4px;
  background: #F8FAF5;
}
.sp-optional summary { cursor: pointer; font-size: var(--text-sm); color: var(--color-ink); list-style: none; }
.sp-optional summary::-webkit-details-marker { display: none; }
.sp-optional__body { margin-top: var(--space-3); }

.sp-consent {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding-top: var(--space-4);
  border-top: 1px solid #E3EBE4;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.sp-consent input { margin-top: 4px; accent-color: var(--color-primary); }
.sp-consent a { color: var(--color-primary); }
.sp-error { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: #B4451F; }

.sp-submit-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin-top: var(--space-4); }
.sp-submit {
  padding: 12px 24px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #203C32;
  font: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
}
.sp-submit:hover { filter: brightness(0.96); }
.sp-submit:disabled { opacity: 0.7; cursor: default; }
.sp-submit__note { margin: 0; max-width: 320px; font-size: var(--text-xs); line-height: 1.5; color: var(--color-ink-muted); }

.sp-state { padding: var(--space-4); border-radius: var(--radius-sm); }
.sp-state--ok { background: #EEF6EA; border: 1px solid #C7D8CA; }
.sp-state--ok h3 { margin: 0 0 var(--space-2); font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-primary); }
.sp-state--ok p { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); }
.sp-state--error { background: #FDF0EA; border: 1px solid #E5B4A0; margin-bottom: var(--space-4); }
.sp-state--error p { margin: 0; font-size: var(--text-sm); color: #8A3A1A; }

/* Help cards */
.sp-help { display: flex; flex-direction: column; gap: var(--space-4); }
.sp-help__card { padding: 25px 27px; border: 1px solid #D1DED3; border-radius: 6px; background: #F0F5EC; }
.sp-help__card:nth-child(even) { background: #fff; }
.sp-help__kicker { margin: 0 0 var(--space-2); font-size: var(--text-xs); letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-ink-muted); }
.sp-help__title { margin: 0 0 var(--space-3); font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-ink); }
.sp-help__body { margin: 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }
.sp-help__list { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
.sp-help__list li { display: flex; gap: var(--space-3); padding: 8px 0; border-bottom: 1px solid #E3EBE4; font-size: var(--text-sm); color: var(--color-ink); }
.sp-help__list li span { font-size: var(--text-xs); color: var(--color-ink-muted); }
.sp-help__link { display: inline-block; margin-top: var(--space-3); font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.sp-help__link:hover { text-decoration: underline; }

/* Other support */
.sp-other { border-top: 1px solid #DAE3DD; background: #fff; }
.sp-other__inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); padding-block: var(--space-6); }
.sp-other__text { margin: 0; font-size: var(--text-base); color: var(--color-ink-muted); }
.sp-other__link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.sp-other__link:hover { text-decoration: underline; }

@media (max-width: 1023px) {
  .sp-hero__inner, .sp-main__inner { grid-template-columns: minmax(0, 1fr); gap: 26px; }
  .sp-hero__card { max-width: none; }
  .sp-nav__inner { gap: 24px; }
}

@media (max-width: 700px) {
  .sp-main { padding-block: 30px 40px; }
  .sp-form { padding: 25px 23px; }
  .sp-fields { grid-template-columns: minmax(0, 1fr); }
  .sp-hero__title { font-size: var(--text-3xl); }
  .sp-submit { width: 100%; }
  .sp-submit-row { flex-direction: column; align-items: stretch; }
  .sp-submit__note { max-width: none; }
}
</style>
