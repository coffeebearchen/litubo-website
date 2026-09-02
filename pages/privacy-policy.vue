<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useHead({ title: 'Privacy Policy — LITUBO', meta: [{ name: 'robots', content: 'noindex' }] })
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
      <div class="container prose">
        <p><strong>Last updated:</strong> content pending legal review before publication. The sections below are interim disclosures; a full Privacy Policy will be published after legal review is complete.</p>

        <h2>Information We Collect</h2>
        <p>When you submit an inquiry form on this website, we collect the information you provide, which may include your name, email address, phone number, company name, country, job title, and details about your inspection requirements. We also collect technical metadata such as the page URL where the form was submitted and UTM campaign parameters, if present.</p>

        <h2>How We Use Your Information</h2>
        <p>We use the information you provide to respond to your inquiry, provide quotations and technical recommendations, and communicate with you about LITUBO products and services relevant to your request. We do not use your information for automated decision-making or profiling.</p>

        <h2>CRM Data Processing — HubSpot</h2>
        <p>LITUBO uses HubSpot, Inc. as a Customer Relationship Management (CRM) platform. When you submit an inquiry, your contact information (name, email address, company, and phone number) and inquiry metadata (inquiry type, language, and product interest) may be stored in HubSpot to help our team manage and follow up on your request. HubSpot processes data on servers located in the United States. For information about HubSpot's data processing practices, please refer to HubSpot's Privacy Policy at <a href="https://legal.hubspot.com/privacy-policy" rel="noopener noreferrer">legal.hubspot.com/privacy-policy</a>.</p>

        <h2>Data Retention</h2>
        <p>Inquiry records are retained for as long as necessary to manage our business relationship and comply with applicable legal obligations. You may request deletion of your data by contacting us at the address below.</p>

        <h2>Your Rights</h2>
        <p>Depending on your location, you may have the right to access, correct, or request deletion of personal data we hold about you. To exercise any of these rights, please contact us at <a href="mailto:info@litubo.com">info@litubo.com</a>.</p>

        <h2>Contact</h2>
        <p>For questions about this policy or our data practices, contact <a href="mailto:info@litubo.com">info@litubo.com</a>.</p>

        <p class="legal-note"><em>This page contains interim disclosures only. A complete Privacy Policy, including cookie policy and jurisdiction-specific rights, is pending legal review before final publication.</em></p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.prose { max-width: 760px; font-size: var(--text-base); color: var(--color-ink); line-height: var(--leading-normal); }
.prose p { margin-bottom: var(--space-5); }
.prose a { color: var(--color-primary); text-decoration: underline; }
.prose h2 { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 600; margin: var(--space-8) 0 var(--space-3); }
.legal-note { font-size: var(--text-sm); color: var(--color-ink-muted); margin-top: var(--space-10); }
</style>
