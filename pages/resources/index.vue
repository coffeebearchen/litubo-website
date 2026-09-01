<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('seo.resources.title'),
  meta: [{ name: 'description', content: t('seo.resources.description') }],
})

const DEMO_RESOURCES = [
  {
    type: 'INSIGHT',
    title: 'Choosing the Right Inspection Solution for Your Line',
    summary: 'A practical guide to selecting between X-Ray, metal detection and checkweighing for different product types and packaging formats.',
    date: '2025-08-01',
    slug: 'choosing-right-inspection-solution',
    section: 'insights',
    imgSrc: '/images/resources/resources-featured-insight.jpg',
  },
  {
    type: 'CASE STUDY',
    title: 'Reducing False Rejects by 40% on a High-Speed Poultry Line',
    summary: 'How a leading poultry processor improved inspection accuracy and reduced product waste using LITUBO X-Ray technology.',
    date: '2025-07-15',
    slug: 'reducing-false-rejects-poultry',
    section: 'case-studies',
    imgSrc: '/images/resources/resources-case-study-poultry.jpg',
  },
  {
    type: 'INSIGHT',
    title: 'Understanding Weight Legislation for Prepacked Food in the EU',
    summary: 'A technical overview of the Weights and Measures regulations affecting checkweigher specifications for food manufacturers.',
    date: '2025-06-20',
    slug: 'weight-legislation-eu-prepacked-food',
    section: 'insights',
    imgSrc: '/images/resources/resources-insight-weights.jpg',
  },
]

const imgErrors = ref<Record<string, boolean>>({})
function onImgError(slug: string) {
  imgErrors.value[slug] = true
}

const categories = [
  {
    key: 'insights',
    title: t('nav_resources.insights'),
    body: 'Technical articles, application guides and industry whitepapers.',
    to: localePath('/resources') + '#insights',
  },
  {
    key: 'case-studies',
    title: t('nav_resources.caseStudies'),
    body: 'Real-world results from food manufacturers using LITUBO systems.',
    to: localePath('/resources') + '#case-studies',
  },
  {
    key: 'downloads',
    title: t('nav_resources.downloads'),
    body: 'Datasheets, manuals, certificates and product specifications.',
    to: localePath('/resources/downloads'),
  },
  {
    key: 'videos',
    title: t('nav_resources.videos'),
    body: 'Product demonstrations, installation guides and operation tutorials.',
    to: localePath('/resources/videos'),
  },
]
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources') }]" />
        <h1 class="page-hero__title">{{ t('pages.resources.heroTitle') }}</h1>
        <p class="page-hero__sub">{{ t('pages.resources.heroSubtitle') }}</p>
      </div>
    </section>

    <!-- Resource category nav -->
    <section class="cat-nav-strip">
      <div class="container">
        <div class="cat-nav-grid">
          <NuxtLink
            v-for="cat in categories"
            :key="cat.key"
            :to="cat.to"
            class="cat-nav-card"
          >
            <h2 class="cat-nav-card__title">{{ cat.title }}</h2>
            <p class="cat-nav-card__body">{{ cat.body }}</p>
            <span class="cat-nav-card__arrow" aria-hidden="true">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Latest resources (DEMO) -->
    <section id="insights" class="section-gap">
      <div class="container">
        <div class="section-header">
          <SectionHeading>Latest from LITUBO</SectionHeading>
          <span class="demo-badge" aria-label="Demo content, not for public">DEMO — NOT FOR PUBLIC</span>
        </div>

        <div class="resource-grid">
          <article
            v-for="r in DEMO_RESOURCES"
            :key="r.slug"
            class="resource-card"
          >
            <div class="resource-card__media">
              <img
                v-if="r.imgSrc && !imgErrors[r.slug]"
                :src="r.imgSrc"
                :alt="r.title"
                class="resource-card__img"
                loading="lazy"
                @error="onImgError(r.slug)"
              >
              <div v-else class="resource-card__photo-placeholder" aria-hidden="true" />
            </div>
            <div class="resource-card__body">
              <p class="resource-card__type">{{ r.type }}</p>
              <h3 class="resource-card__title">{{ r.title }}</h3>
              <p class="resource-card__summary">{{ r.summary }}</p>
              <p class="resource-card__date">{{ r.date }}</p>
            </div>
          </article>
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
.page-hero {
  background: var(--color-primary);
  padding: var(--space-12) 0;
  color: var(--color-white);
}

.page-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-4) 0;
}

.page-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 560px;
  line-height: var(--leading-normal);
}

/* ── Category nav strip ────────────────────────────────────────── */
.cat-nav-strip {
  padding: var(--space-10) 0;
  background: var(--color-canvas);
  border-bottom: 1px solid var(--color-line);
}

.cat-nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.cat-nav-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-normal), border-color var(--transition-fast);
}

.cat-nav-card:hover {
  box-shadow: 0 2px 12px rgba(18,60,50,0.10);
  border-color: var(--color-primary);
}

.cat-nav-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
}

.cat-nav-card__body {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  flex: 1;
}

.cat-nav-card__arrow {
  color: var(--color-accent);
  transition: transform var(--transition-fast);
}

.cat-nav-card:hover .cat-nav-card__arrow {
  transform: translateX(4px);
}

/* ── Latest ────────────────────────────────────────────────────── */
.section-gap { padding: var(--space-16) 0; }

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-10);
  flex-wrap: wrap;
}

.demo-badge {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  white-space: nowrap;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.resource-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: box-shadow var(--transition-normal);
}

.resource-card:hover {
  box-shadow: 0 4px 16px rgba(18,60,50,0.12);
}

.resource-card__media {
  aspect-ratio: 16 / 9;
  position: relative;
  overflow: hidden;
}

.resource-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resource-card__photo-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 100%);
}

.resource-card__body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.resource-card__type {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.resource-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-primary);
  line-height: var(--leading-snug);
  flex: 1;
}

.resource-card__summary {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}

.resource-card__date {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin-top: var(--space-2);
}

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .cat-nav-grid { grid-template-columns: repeat(2, 1fr); }
  .resource-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 639px) {
  .cat-nav-grid { grid-template-columns: 1fr; }
  .resource-grid { grid-template-columns: 1fr; }
}
</style>
