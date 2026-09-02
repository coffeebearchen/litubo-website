<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const app = computed(() => useApplication(route.params.slug as string))
const allCategories = useProductCategories()

if (!app.value) {
  throw createError({ statusCode: 404, statusMessage: 'Application not found' })
}

const appLocale = computed(() => locale.value as 'en' | 'es' | 'pt')
const appSeoTitle = computed(() =>
  app.value?.seo.title[appLocale.value] || app.value?.seo.title.en || t('seo.applications.title')
)
const appSeoDesc = computed(() =>
  app.value?.seo.description[appLocale.value] || app.value?.seo.description.en || ''
)
useSeoHead({
  title: appSeoTitle,
  description: appSeoDesc,
  canonicalPath: computed(() => app.value?.seo.canonicalPath ?? ''),
  noIndex: computed(() => app.value?.seo.noIndex),
})

const imgError = ref(false)
</script>

<template>
  <div v-if="app">
    <!-- Hero -->
    <section class="app-hero">
      <div class="app-hero__media">
        <img
          v-if="app.heroMedia.url && !imgError"
          :src="app.heroMedia.url"
          :alt="app.heroMedia.alt.en"
          class="app-hero__img"
          loading="eager"
          @error="imgError = true"
        >
        <div class="app-hero__overlay" aria-hidden="true" />
      </div>
      <div class="app-hero__content container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.applications'), to: localePath('/applications') },
            { label: app.title.en },
          ]"
          class="app-hero__breadcrumb"
        />
        <h1 class="app-hero__title">{{ app.title.en }}</h1>
        <p v-if="app.overview.en && app.overview.en !== 'TODO_CONTENT'" class="app-hero__sub">
          {{ app.overview.en }}
        </p>
        <div class="app-hero__actions">
          <NuxtLink :to="localePath('/contact')" class="btn btn--accent">{{ t('common.talkToEngineer') }}</NuxtLink>
          <NuxtLink :to="localePath('/products')" class="btn btn--outline-white">{{ t('nav_products.heading') }}</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Inspection overview -->
    <section class="section-gap">
      <div class="container">
        <div class="app-overview">
          <div class="app-overview__text">
            <SectionHeading>Inspection for {{ app.title.en }}</SectionHeading>
            <p class="app-overview__body">
              Food and packaging manufacturers working with {{ app.title.en.toLowerCase() }} face specific contamination risks and regulatory requirements. LITUBO inspection systems are configured to match the density, shape, and packaging format of your product, ensuring reliable detection at production speeds.
            </p>
            <p class="app-overview__body">Content specific to this application is being prepared. <NuxtLink :to="localePath('/contact')">Contact our engineering team</NuxtLink> for detailed guidance on inspection solutions for {{ app.title.en.toLowerCase() }}.</p>
          </div>
          <div class="app-overview__photo" aria-hidden="true" />
        </div>
      </div>
    </section>

    <!-- Common challenges -->
    <section class="section-gap section-alt">
      <div class="container">
        <SectionHeading>Common Inspection Challenges</SectionHeading>
        <p class="section-sub">Typical contamination and compliance concerns for this application category.</p>
        <div class="challenge-grid">
          <div class="challenge-card">
            <div class="challenge-card__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
                <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
            <h3 class="challenge-card__title">Physical Contamination</h3>
            <p class="challenge-card__body">Metal fragments, glass shards, bone, stone, dense plastics and rubber — detected by X-Ray or metal detection systems tuned to your product density.</p>
          </div>
          <div class="challenge-card">
            <div class="challenge-card__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
            <h3 class="challenge-card__title">Weight Compliance</h3>
            <p class="challenge-card__body">High-speed checkweighers verify every pack is within declared weight tolerances, reducing give-away and meeting legal metrology requirements.</p>
          </div>
          <div class="challenge-card">
            <div class="challenge-card__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <h3 class="challenge-card__title">Regulatory Compliance</h3>
            <p class="challenge-card__body">Retailers, food safety standards, and international regulations increasingly mandate documented inspection records and validated detection performance.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Recommended product categories -->
    <section class="section-gap">
      <div class="container">
        <SectionHeading>Inspection Systems for This Application</SectionHeading>
        <p class="section-sub">These product categories are commonly used for {{ app.title.en.toLowerCase() }} inspection.</p>
        <div class="rec-grid">
          <NuxtLink
            v-for="cat in allCategories.slice(0, 3)"
            :key="cat.slug"
            :to="localePath(`/products/${cat.slug}`)"
            class="rec-card"
          >
            <div class="rec-card__photo" aria-hidden="true" />
            <div class="rec-card__body">
              <h3 class="rec-card__title">{{ cat.title.en }}</h3>
              <span class="rec-card__arrow" aria-hidden="true">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('common.findDistributor')"
      :secondary-to="localePath('/find-a-distributor')"
    />
  </div>
</template>

<style scoped>
/* ── Hero ──────────────────────────────────────────────────────── */
.app-hero {
  position: relative;
  min-height: 460px;
  display: flex;
  align-items: flex-end;
  color: var(--color-white);
}

.app-hero__media {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
  overflow: hidden;
}

.app-hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.app-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(18,60,50,0.88) 0%, rgba(18,60,50,0.5) 60%, rgba(18,60,50,0.2) 100%);
}

.app-hero__content {
  position: relative;
  padding-top: var(--space-16);
  padding-bottom: var(--space-12);
  z-index: 1;
}

.app-hero__breadcrumb { margin-bottom: var(--space-4); }

.app-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin-bottom: var(--space-4);
}

.app-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.82);
  max-width: 520px;
  line-height: var(--leading-normal);
  margin-bottom: var(--space-8);
}

.app-hero__actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
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
.btn--accent       { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
.btn--accent:hover { background: #b85f15; border-color: #b85f15; }
.btn--outline-white       { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
.btn--outline-white:hover { background: rgba(255,255,255,0.1); border-color: #fff; }

/* ── Overview ──────────────────────────────────────────────────── */
.section-gap  { padding: var(--space-16) 0; }
.section-alt  { background: var(--color-canvas); }
.section-sub  { font-size: var(--text-base); color: var(--color-ink-muted); max-width: 560px; margin-bottom: var(--space-10); }

.app-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: center;
}

.app-overview__text { display: flex; flex-direction: column; gap: var(--space-4); }

.app-overview__body {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

.app-overview__body a {
  color: var(--color-primary);
  text-decoration: underline;
}

.app-overview__photo {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

/* ── Challenges ────────────────────────────────────────────────── */
.challenge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-8);
}

.challenge-card {
  padding: var(--space-6);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.challenge-card__icon {
  color: var(--color-primary);
  margin-bottom: var(--space-4);
}

.challenge-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}

.challenge-card__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

/* ── Recommended products ──────────────────────────────────────── */
.rec-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-8);
}

.rec-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-normal);
}

.rec-card:hover {
  box-shadow: 0 4px 16px rgba(18,60,50,0.12);
}

.rec-card__photo {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.rec-card__body {
  padding: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.rec-card__title {
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-primary);
}

.rec-card__arrow {
  color: var(--color-accent);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.rec-card:hover .rec-card__arrow {
  transform: translateX(4px);
}

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .app-overview { grid-template-columns: 1fr; }
  .app-overview__photo { display: none; }
  .challenge-grid { grid-template-columns: 1fr 1fr; }
  .rec-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 639px) {
  .app-hero { min-height: 360px; }
  .challenge-grid { grid-template-columns: 1fr; }
  .rec-grid { grid-template-columns: 1fr; }
}
</style>
