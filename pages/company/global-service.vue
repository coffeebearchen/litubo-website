<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.globalService.title'), description: t('seo.globalService.description'), canonicalPath: '/company/global-service' })

// PUBLIC-CLAIMS-CLEANUP-01 (D-036): V1 describes only the enquiry and request routes that exist. This page makes
// no claim about network size, engineer training, regional stock, on-site service or geographic coverage.
const serviceItems = [
  { title: 'Technical Support', body: 'Describe the machine and the issue in a technical-support request.' },
  { title: 'Spare Parts', body: 'Spare parts can be requested with the machine model and serial number.' },
  { title: 'Manuals & Documentation', body: 'Operation and maintenance manuals can be requested through the Support section.' },
  { title: 'Service & Training', body: 'Service and operator-training requirements can be submitted as a service request.' },
  { title: 'Distributor Enquiries', body: 'Tell us your location and requirements; our team reviews each distributor enquiry.' },
  { title: 'Partnership Applications', body: 'Distributor and business partnership applications are reviewed by the LITUBO team.' },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="gs-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.globalService') }]" />
        <h1 class="gs-hero__title">{{ t('pages.globalService.heroTitle') }}</h1>
        <p class="gs-hero__sub">Technical support, spare-parts, manual, service and distributor enquiries for LITUBO inspection systems are handled through the request routes below.</p>
      </div>
    </section>

    <!-- Services -->
    <section class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Support and Enquiry Routes</SectionHeading>
        <div class="service-grid">
          <div
            v-for="item in serviceItems"
            :key="item.title"
            class="service-card"
          >
            <h3 class="service-card__title">{{ item.title }}</h3>
            <p class="service-card__body">{{ item.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Team photo -->
    <section class="section-gap">
      <div class="container">
        <div class="two-col">
          <div class="two-col__text">
            <SectionHeading>Distributor Enquiries</SectionHeading>
            <p class="body-text">Send your location and requirements through the distributor enquiry form, or contact us directly. Our team reviews each enquiry.</p>
            <div class="two-col__actions">
              <NuxtLink :to="localePath('/find-a-distributor')" class="btn btn--primary">Find a Distributor</NuxtLink>
              <NuxtLink :to="localePath('/contact')" class="btn btn--outline">Contact Us</NuxtLink>
            </div>
          </div>
          <div class="two-col__photo" aria-hidden="true">
            <div class="two-col__img-placeholder" />
          </div>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('nav_company.partner')"
      :secondary-to="localePath('/company/become-a-partner')"
    />
  </div>
</template>

<style scoped>
.gs-hero {
  background: var(--color-primary-deep);
  padding: var(--space-16) 0 var(--space-12);
  color: var(--color-white);
}

.gs-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-4) 0;
}

.gs-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 580px;
  line-height: var(--leading-normal);
}

.section-gap  { padding: var(--space-16) 0; }
.section-alt  { background: var(--color-canvas); }

/* ── Service grid ──────────────────────────────────────────────── */
.service-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-10);
}

.service-card {
  padding: var(--space-6);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.service-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}

.service-card__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

/* ── Two-col ───────────────────────────────────────────────────── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: center;
}

.two-col__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.body-text {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

.two-col__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.two-col__photo {
  aspect-ratio: 3 / 2;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.two-col__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.two-col__img-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.btn {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-sm);
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  text-decoration: none;
}
.btn--primary       { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn--primary:hover { background: var(--color-primary-deep); border-color: var(--color-primary-deep); }
.btn--outline       { background: transparent; color: var(--color-primary); border-color: var(--color-primary); }
.btn--outline:hover { background: var(--color-primary); color: #fff; }

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .service-grid { grid-template-columns: repeat(2, 1fr); }
  .two-col { grid-template-columns: 1fr; }
  .two-col__photo { display: none; }
}

@media (max-width: 639px) {
  .service-grid { grid-template-columns: 1fr; }
}
</style>
