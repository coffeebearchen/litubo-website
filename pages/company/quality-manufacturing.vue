<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: t('seo.quality.title'), description: t('seo.quality.description'), canonicalPath: '/company/quality-manufacturing' })

const imgErrors = ref({ lab: false, floor: false })
const labSrc = '/images/company/company-quality-lab.jpg'
const floorSrc = '/images/company/company-quality-manufacturing.jpg'

const certSlots = [
  { file: '/images/certifications/cert-iso9001.jpg', label: 'ISO 9001' },
  { file: '/images/certifications/cert-ce.jpg', label: 'CE Marking' },
  { file: '/images/certifications/cert-fda.jpg', label: 'FDA Compliance' },
  { file: '/images/certifications/cert-haccp.jpg', label: 'HACCP Ready' },
]
const certErrors = ref<Record<string, boolean>>({})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="qm-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.quality') }]" />
        <h1 class="qm-hero__title">{{ t('pages.quality.heroTitle') }}</h1>
        <p class="qm-hero__sub">Our design and manufacturing processes are engineered to produce reliable, high-performance inspection systems that meet international food-safety standards.</p>
      </div>
    </section>

    <!-- Manufacturing overview -->
    <section class="section-gap">
      <div class="container">
        <div class="two-col">
          <div class="two-col__text">
            <SectionHeading>Manufacturing Standards</SectionHeading>
            <p class="body-text">Each LITUBO system is assembled, tested and validated at our facility in Kunshan, Jiangsu Province. Production processes are documented and follow defined quality control checkpoints at every stage — from component incoming inspection through final functional testing before despatch.</p>
            <p class="body-text">Detailed manufacturing and quality documentation is being prepared for this page. For technical specifications or compliance documentation relevant to a specific product, please <NuxtLink :to="localePath('/contact')">contact our team</NuxtLink>.</p>
          </div>
          <div class="two-col__photo" aria-hidden="true">
            <img
              v-if="!imgErrors.lab"
              :src="labSrc"
              alt="Quality and testing laboratory"
              class="two-col__img"
              loading="lazy"
              @error="imgErrors.lab = true"
            >
            <div v-else class="two-col__img-placeholder" />
          </div>
        </div>
      </div>
    </section>

    <!-- Certifications -->
    <section class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Certifications & Compliance</SectionHeading>
        <p class="section-sub">Certification documentation is being updated. Images below are placeholder slots — supply certificate scans or official badge artwork.</p>
        <div class="cert-grid">
          <div
            v-for="cert in certSlots"
            :key="cert.label"
            class="cert-card"
          >
            <div class="cert-card__img-wrap">
              <img
                v-if="!certErrors[cert.label]"
                :src="cert.file"
                :alt="cert.label"
                class="cert-card__img"
                loading="lazy"
                @error="certErrors[cert.label] = true"
              >
              <div v-else class="cert-card__placeholder" aria-hidden="true" />
            </div>
            <p class="cert-card__label">{{ cert.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Manufacturing floor -->
    <section class="section-gap">
      <div class="container">
        <SectionHeading>Production Facility</SectionHeading>
        <div class="facility-photo">
          <img
            v-if="!imgErrors.floor"
            :src="floorSrc"
            alt="LITUBO production facility"
            class="facility-photo__img"
            loading="lazy"
            @error="imgErrors.floor = true"
          >
          <div v-else class="facility-photo__placeholder" aria-hidden="true" />
        </div>
        <p class="facility-caption">Production environment at LITUBO's Kunshan facility. Photography coming soon.</p>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
    />
  </div>
</template>

<style scoped>
.qm-hero {
  background: var(--color-primary-deep);
  padding: var(--space-16) 0 var(--space-12);
  color: var(--color-white);
}

.qm-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-4) 0;
}

.qm-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 580px;
  line-height: var(--leading-normal);
}

.section-gap  { padding: var(--space-16) 0; }
.section-alt  { background: var(--color-canvas); }
.section-sub  { font-size: var(--text-sm); color: var(--color-ink-muted); max-width: 520px; margin-bottom: var(--space-8); margin-top: var(--space-2); }

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

.body-text a {
  color: var(--color-primary);
  text-decoration: underline;
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

/* ── Certifications ────────────────────────────────────────────── */
.cert-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

.cert-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.cert-card__img-wrap {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.cert-card__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cert-card__placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-line);
  border-radius: var(--radius-sm);
}

.cert-card__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  text-align: center;
}

/* ── Facility photo ────────────────────────────────────────────── */
.facility-photo {
  aspect-ratio: 16 / 6;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-top: var(--space-8);
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.facility-photo__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.facility-photo__placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.facility-caption {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin-top: var(--space-3);
}

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .two-col { grid-template-columns: 1fr; }
  .two-col__photo { display: none; }
  .cert-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 639px) {
  .cert-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
