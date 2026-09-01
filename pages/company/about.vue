<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useHead({ title: t('seo.about.title'), meta: [{ name: 'description', content: t('seo.about.description') }] })

const imgErrors = ref({ hero: false, story: false })
const heroSrc = '/images/company/company-about-hero.jpg'
const storySrc = '/images/company/company-about-story.jpg'
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="about-hero">
      <div class="about-hero__media">
        <img
          v-if="!imgErrors.hero"
          :src="heroSrc"
          alt="LITUBO manufacturing facility"
          class="about-hero__img"
          loading="eager"
          @error="imgErrors.hero = true"
        >
        <div class="about-hero__overlay" aria-hidden="true" />
      </div>
      <div class="about-hero__content container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.company') },
            { label: t('nav_company.about') },
          ]"
          class="about-hero__breadcrumb"
        />
        <h1 class="about-hero__title">{{ t('pages.about.heroTitle') }}</h1>
        <p class="about-hero__sub">LITUBO is a global manufacturer of food and packaging inspection systems, headquartered in Kunshan, Jiangsu Province, China.</p>
      </div>
    </section>

    <!-- Mission -->
    <section class="section-gap">
      <div class="container">
        <div class="two-col">
          <div class="two-col__text">
            <SectionHeading>Our Mission</SectionHeading>
            <p class="body-text">We help food and packaging manufacturers around the world protect consumers and brands by delivering reliable, technically precise inspection systems. From the detection of physical contaminants to weight compliance and combination inspection, our equipment is built for continuous production environments where accuracy and uptime are non-negotiable.</p>
            <p class="body-text">Operating under Shanghai NingPin Industrial Dev. Co., Ltd., LITUBO serves distributors and end-users across Asia, Europe, the Americas and beyond.</p>
          </div>
          <div class="two-col__photo" aria-hidden="true">
            <img
              v-if="!imgErrors.story"
              :src="storySrc"
              alt="LITUBO facility"
              class="two-col__img"
              loading="lazy"
              @error="imgErrors.story = true"
            >
            <div v-else class="two-col__img-placeholder" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>

    <!-- Key pillars -->
    <section class="section-gap section-alt">
      <div class="container">
        <SectionHeading>What We Stand For</SectionHeading>
        <div class="pillars">
          <div class="pillar">
            <div class="pillar__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4l2.5 7h7l-5.7 4.1 2.2 6.9L14 18l-6 4 2.2-6.9L4.5 11H12L14 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="pillar__title">Technical Precision</h3>
            <p class="pillar__body">Inspection systems engineered to meet the detection sensitivity required by food retailers, regulators and HACCP programmes.</p>
          </div>
          <div class="pillar">
            <div class="pillar__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="10" stroke="currentColor" stroke-width="1.5" />
                <path d="M9 14l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="pillar__title">Production Reliability</h3>
            <p class="pillar__body">Built for continuous operation in demanding environments: IP-rated enclosures, stainless steel construction, and redundant detection channels.</p>
          </div>
          <div class="pillar">
            <div class="pillar__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M4 20l8-8 4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="pillar__title">Global Service Reach</h3>
            <p class="pillar__body">A distributor network across multiple regions provides local commissioning, training, spare parts supply and technical support.</p>
          </div>
          <div class="pillar">
            <div class="pillar__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="8" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
                <path d="M9 8V6a5 5 0 0110 0v2" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <h3 class="pillar__title">Partnership Model</h3>
            <p class="pillar__body">We work through regional distribution partners who bring local expertise, language support and on-the-ground service capability.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact block -->
    <section class="section-gap">
      <div class="container">
        <div class="contact-block">
          <div class="contact-block__text">
            <SectionHeading>Contact & Address</SectionHeading>
            <address class="contact-block__address">
              <p><strong>Shanghai NingPin Industrial Dev. Co., Ltd.</strong></p>
              <p>No. 23, Huangtu Rd., Huaqiao Town</p>
              <p>Kunshan, Jiangsu Province, China</p>
            </address>
          </div>
          <div class="contact-block__actions">
            <NuxtLink :to="localePath('/contact')" class="btn btn--primary">{{ t('common.contactUs') }}</NuxtLink>
            <NuxtLink :to="localePath('/find-a-distributor')" class="btn btn--outline">{{ t('common.findDistributor') }}</NuxtLink>
          </div>
        </div>
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
/* ── Hero ──────────────────────────────────────────────────────── */
.about-hero {
  position: relative;
  min-height: 480px;
  display: flex;
  align-items: flex-end;
  color: var(--color-white);
}

.about-hero__media {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
  overflow: hidden;
}

.about-hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.about-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(18,60,50,0.85) 0%, rgba(18,60,50,0.45) 70%, rgba(18,60,50,0.15) 100%);
}

.about-hero__content {
  position: relative;
  z-index: 1;
  padding-top: var(--space-16);
  padding-bottom: var(--space-12);
}

.about-hero__breadcrumb { margin-bottom: var(--space-4); }

.about-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin-bottom: var(--space-4);
}

.about-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.82);
  max-width: 540px;
  line-height: var(--leading-normal);
}

/* ── Two-col ───────────────────────────────────────────────────── */
.section-gap  { padding: var(--space-16) 0; }
.section-alt  { background: var(--color-canvas); }

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

/* ── Pillars ───────────────────────────────────────────────────── */
.pillars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-10);
}

.pillar {
  padding: var(--space-6);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.pillar__icon {
  color: var(--color-primary);
  margin-bottom: var(--space-4);
}

.pillar__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}

.pillar__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

/* ── Contact block ─────────────────────────────────────────────── */
.contact-block {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-8);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.contact-block__address {
  font-style: normal;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  margin-top: var(--space-4);
  line-height: var(--leading-normal);
}

.contact-block__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
  padding-top: var(--space-8);
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
  .two-col { grid-template-columns: 1fr; }
  .two-col__photo { display: none; }
  .pillars { grid-template-columns: repeat(2, 1fr); }
  .contact-block { flex-direction: column; }
}

@media (max-width: 639px) {
  .about-hero { min-height: 360px; }
  .pillars { grid-template-columns: 1fr; }
}
</style>
