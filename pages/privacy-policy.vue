<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: 'Privacy Policy — LITUBO', description: 'LITUBO privacy policy and data handling information.', canonicalPath: '', noIndex: true })

/** Reading aid only. The sections themselves still carry the pending-legal-review note. */
const toc = [
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use-your-information', label: 'How we use your information' },
  { id: 'crm-data-processing-hubspot', label: 'CRM data processing' },
  { id: 'data-retention', label: 'Data retention' },
  { id: 'your-rights', label: 'Your rights' },
  { id: 'contact', label: 'Contact' },
]
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('pages.privacy.heroTitle') }]" />
        <h1 class="page-hero__title">{{ t('pages.privacy.heroTitle') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container legal-layout">
        <nav class="legal-toc" aria-label="On this page">
          <p class="legal-toc__label">On this page</p>
          <ul role="list">
            <li v-for="item in toc" :key="item.id">
              <a :href="`#${item.id}`">{{ item.label }}</a>
            </li>
          </ul>
        </nav>

        <div class="prose">
        <p><strong>Last updated:</strong> content pending legal review before publication. The sections below are interim disclosures; a full Privacy Policy will be published after legal review is complete.</p>

        <h2 id="information-we-collect">Information We Collect</h2>
        <p>When you submit an inquiry form on this website, we collect the information you provide, which may include your name, email address, phone number, company name, country, job title, and details about your inspection requirements. We also collect technical metadata such as the page URL where the form was submitted and UTM campaign parameters, if present.</p>

        <h2 id="how-we-use-your-information">How We Use Your Information</h2>
        <p>We use the information you provide to respond to your inquiry, provide quotations and technical recommendations, and communicate with you about LITUBO products and services relevant to your request. We do not use your information for automated decision-making or profiling.</p>

        <h2 id="crm-data-processing-hubspot">CRM Data Processing — HubSpot</h2>
        <p>LITUBO uses HubSpot, Inc. as a Customer Relationship Management (CRM) platform. When you submit an inquiry, your contact information (name, email address, company, and phone number) and inquiry metadata (inquiry type, language, and product interest) may be stored in HubSpot to help our team manage and follow up on your request. HubSpot processes data on servers located in the United States. For information about HubSpot's data processing practices, please refer to HubSpot's Privacy Policy at <a href="https://legal.hubspot.com/privacy-policy" rel="noopener noreferrer">legal.hubspot.com/privacy-policy</a>.</p>

        <h2 id="data-retention">Data Retention</h2>
        <p>Inquiry records are retained for as long as necessary to manage our business relationship and comply with applicable legal obligations. You may request deletion of your data by contacting us at the address below.</p>

        <h2 id="your-rights">Your Rights</h2>
        <p>Depending on your location, you may have the right to access, correct, or request deletion of personal data we hold about you. To exercise any of these rights, please contact us at <a href="mailto:info@litubo.com">info@litubo.com</a>.</p>

        <h2 id="contact">Contact</h2>
        <p>For questions about this policy or our data practices, contact <a href="mailto:info@litubo.com">info@litubo.com</a>.</p>

        <p class="legal-note"><em>This page contains interim disclosures only. A complete Privacy Policy, including cookie policy and jurisdiction-specific rights, is pending legal review before final publication.</em></p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%); padding: var(--space-12) 0; color: var(--color-ink); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.legal-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 56px;
  align-items: start;
}

.legal-toc {
  position: sticky;
  top: 120px;
}

.legal-toc__label {
  margin: 0 0 var(--space-3);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

.legal-toc ul { list-style: none; margin: 0; padding: 0; }
.legal-toc li { margin-bottom: var(--space-2); }
.legal-toc a {
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-ink-muted);
  text-decoration: none;
}
.legal-toc a:hover { color: var(--color-primary); text-decoration: underline; }

@media (max-width: 1023px) {
  .legal-layout { grid-template-columns: 1fr; gap: 24px; }
  .legal-toc { position: static; border: 1px solid #DAE3DD; border-radius: 6px; padding: var(--space-4); }
}

.prose { max-width: 760px; font-size: var(--text-base); color: var(--color-ink); line-height: var(--leading-normal); }
.prose p { margin-bottom: var(--space-5); }
.prose a { color: var(--color-primary); text-decoration: underline; }
.prose h2 { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 600; margin: var(--space-8) 0 var(--space-3); }
.legal-note { font-size: var(--text-sm); color: var(--color-ink-muted); margin-top: var(--space-10); }
</style>
