<script setup lang="ts">
/**
 * About LITUBO — who we are, what we make, and where a conversation starts.
 *
 * Statements stay inside what the project can support: the product families, the legal entity and the
 * enquiry routes. No company history, factory size, team count, customer case or country coverage is
 * asserted here.
 *
 * The three equipment photographs are real products, shown as product photographs — not as a factory
 * scene. They remain visible on narrow screens; the previous version hid the whole visual below
 * 1023px, which removed the only company imagery on a phone.
 */
const { t } = useI18n()
const localePath = useLocalePath()

/**
 * V2-04 — the hero may be overridden from /admin/page-content. Every field falls back to the copy
 * below, so the page renders exactly as before until someone publishes an override.
 */
const { hero } = await usePageHero('company.about', {
  eyebrow: 'About LITUBO',
  title: 'Food & packaging inspection solutions.',
  body: 'LITUBO builds inspection equipment for food and packaging producers: X-ray inspection, metal detection, checkweighing, combination inspection, and conveyors and reject systems.',
  ctaPrimaryLabel: 'Explore the equipment',
  ctaPrimaryPath: '/products',
  ctaSecondaryLabel: 'Talk to an engineer',
  ctaSecondaryPath: '/contact',
})

useSeoHead({ title: t('seo.about.title'), description: t('seo.about.description'), canonicalPath: '/company/about', ogImage: hero.imageUrl || undefined })

const families = [
  { label: 'X-Ray Inspection', body: 'Dense contaminant detection and fill or count checks.', to: '/products/x-ray-inspection', icon: 'x-ray-inspection.svg' },
  { label: 'Metal Detection', body: 'Ferrous, non-ferrous and stainless contamination.', to: '/products/metal-detection', icon: 'metal-detection.svg' },
  { label: 'Checkweighers', body: 'Inline weight control and left-right sorting.', to: '/products/checkweighers', icon: 'checkweighers.svg' },
  { label: 'Combination Inspection', body: 'More than one technology on a single line.', to: '/products/combination-inspection', icon: 'combination-inspection.svg' },
  { label: 'Conveyors & Reject Systems', body: 'Transfer and rejection around the inspection point.', to: '/products/conveyors-reject-systems', icon: 'conveyors-reject-systems.svg' },
]

const nextSteps = [
  { title: 'Technical discussion', body: 'Describe the product, the pack and the line.', to: '/technical-matching' },
  { title: 'Documents', body: 'Request a datasheet, manual or drawing for a model.', to: '/resources/downloads' },
  { title: 'Equipment support', body: 'Parts, guidance and training for equipment in service.', to: '/company/global-service' },
]

const company = {
  legalName: 'Shanghai NingPin Industrial Dev. Co., Ltd.',
  city: 'Kunshan, Jiangsu Province, China',
  email: 'sales@litubo.com',
}
</script>

<template>
  <div class="ab-page">
    <!-- 1. Hero: three real equipment photographs instead of an unverified factory scene -->
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.company') }, { label: t('nav_company.about') }]" />
        <div class="ab-hero">
          <div class="ab-hero__text">
            <p class="eyebrow">{{ hero.eyebrow }}</p>
            <h1 class="ab-hero__title">{{ hero.title }}</h1>
            <p class="ab-hero__intro">{{ hero.body }}</p>
            <p v-if="hero.ctaPrimaryLabel" class="ab-hero__actions">
              <NuxtLink :to="localePath(hero.ctaPrimaryPath)" class="ab-cta">{{ hero.ctaPrimaryLabel }}</NuxtLink>
              <NuxtLink v-if="hero.ctaSecondaryLabel" :to="localePath(hero.ctaSecondaryPath)" class="ab-link">{{ hero.ctaSecondaryLabel }} →</NuxtLink>
            </p>
          </div>
          <div class="ab-hero__media">
            <img class="ab-hero__main" :src="hero.imageUrl || '/images/devices/combination-real.webp'" :alt="hero.imageAlt || 'LITUBO combination inspection system with metal detection and checkweighing'" width="800" height="481" loading="eager" decoding="async">
            <div class="ab-hero__pair">
              <img src="/images/devices/metal-real.webp" alt="LITUBO metal detection head on a conveyor" width="800" height="533" loading="lazy" decoding="async">
              <img src="/images/devices/weigher-real.webp" alt="LITUBO checkweigher on a production line" width="800" height="533" loading="lazy" decoding="async">
            </div>
          </div>
        </div>
      </div>
    </section>

    <CompanyNav />

    <!-- 2. Company identity -->
    <section class="ab-band">
      <div class="container ab-identity">
        <div>
          <p class="eyebrow">How a discussion starts</p>
          <h2 class="ab-h2">Every inspection decision starts with the product and the pack.</h2>
          <p class="ab-body">
            Throughput, pack format and the available space decide as much as the technology does. We
            review those conditions with you before recommending a configuration — there is no automatic
            matching.
          </p>
        </div>
        <aside class="ab-identity__card">
          <p class="eyebrow">Company</p>
          <dl>
            <div><dt>Legal entity</dt><dd>{{ company.legalName }}</dd></div>
            <div><dt>Location</dt><dd>{{ company.city }}</dd></div>
            <div><dt>Email</dt><dd dir="ltr"><a :href="`mailto:${company.email}`">{{ company.email }}</a></dd></div>
          </dl>
        </aside>
      </div>
    </section>

    <!-- 3. Five equipment families as real row entries -->
    <section class="ab-band ab-band--tint">
      <div class="container">
        <p class="eyebrow">Equipment families</p>
        <h2 class="ab-h2">Five families, one starting point.</h2>
        <ul class="ab-families" role="list">
          <li v-for="f in families" :key="f.to">
            <NuxtLink :to="localePath(f.to)" class="ab-family">
              <img class="ab-family__icon" :src="`/icons/product-categories/${f.icon}`" alt="" width="42" height="42" loading="lazy" decoding="async">
              <span class="ab-family__text">
                <span class="ab-family__name">{{ f.label }}</span>
                <span class="ab-family__body">{{ f.body }}</span>
              </span>
              <span class="ab-family__arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- 4. Three next steps -->
    <section class="ab-band">
      <div class="container">
        <p class="eyebrow">Next steps</p>
        <h2 class="ab-h2">Three ways to take this further.</h2>
        <ul class="ab-steps" role="list">
          <li v-for="(s, i) in nextSteps" :key="s.to">
            <NuxtLink :to="localePath(s.to)" class="ab-step">
              <span class="ab-step__n">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="ab-step__title">{{ s.title }}</span>
              <span class="ab-step__body">{{ s.body }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- 5. Compact contact strip -->
    <section class="ab-contact">
      <div class="container ab-contact__inner">
        <div>
          <p class="ab-contact__name">{{ company.legalName }}</p>
          <p class="ab-contact__meta">{{ company.city }} · <a :href="`mailto:${company.email}`">{{ company.email }}</a></p>
        </div>
        <div class="ab-contact__actions">
          <NuxtLink :to="localePath('/contact')" class="ab-cta">Contact the team</NuxtLink>
          <NuxtLink :to="localePath('/company/become-a-partner')" class="ab-link">Partnership enquiry →</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ab-band { padding: var(--space-16) 0; }
.ab-band--tint { background: #F3F7F0; }

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.ab-h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3vw, calc(41px * var(--type-scale)));
  line-height: 1.15;
  color: var(--color-ink);
}
.ab-body {
  margin: 0;
  max-width: 620px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

/* Hero */
.ab-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 1fr);
  gap: 62px;
  align-items: center;
  padding-block: var(--space-5) 44px;
}
.ab-hero__title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(var(--text-3xl), 4vw, calc(61px * var(--type-scale)));
  line-height: 1.08;
  color: var(--color-ink);
}
.ab-hero__intro {
  margin: 0 0 var(--space-5);
  max-width: 600px;
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-ink-muted);
}
.ab-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); margin: 0; }

.ab-hero__media { display: flex; flex-direction: column; gap: 10px; }
.ab-hero__main {
  display: block;
  width: 100%;
  height: 198px;
  object-fit: contain;
  background: #fff;
  border: 1px solid #D2DFD0;
  border-radius: 6px;
}
.ab-hero__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ab-hero__pair img {
  display: block;
  width: 100%;
  height: 100px;
  object-fit: contain;
  background: #fff;
  border: 1px solid #D2DFD0;
  border-radius: 6px;
}

.ab-cta {
  display: inline-block;
  padding: 13px 24px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}
.ab-cta:hover { background: var(--color-primary-deep); }
.ab-link { font-size: var(--text-sm); color: var(--color-link-on-light); text-decoration: none; }
.ab-link:hover { text-decoration: underline; }

/* Identity */
.ab-identity { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); gap: 70px; align-items: start; }
.ab-identity__card { padding: 30px; border: 1px solid #D2DFD0; border-radius: 6px; background: #F3F7EF; }
.ab-identity__card dl { margin: 0; }
.ab-identity__card dl div { padding: var(--space-3) 0; border-bottom: 1px solid #E3EBE4; }
.ab-identity__card dl div:last-child { border-bottom: 0; }
.ab-identity__card dt { font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-ink-muted); margin-bottom: 4px; }
.ab-identity__card dd { margin: 0; font-size: calc(20px * var(--type-scale)); line-height: 1.5; color: var(--color-ink); }
.ab-identity__card a { color: var(--color-link-on-light); }

/* Families */
.ab-families { list-style: none; margin: var(--space-5) 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 40px; }
.ab-family {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 20px;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4) 0;
  border-bottom: 1px solid #E3EBE4;
  text-decoration: none;
  color: inherit;
  transition: color 160ms ease;
}
.ab-family:hover .ab-family__name { color: var(--color-primary); }
.ab-family:hover .ab-family__arrow { transform: translateX(3px); }
.ab-family__icon { width: 42px; height: 42px; display: block; }
.ab-family__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ab-family__name { font-size: var(--text-lg); font-weight: 600; color: var(--color-ink); transition: color 160ms ease; }
.ab-family__body { font-size: var(--text-sm); line-height: 1.5; color: var(--color-ink-muted); }
.ab-family__arrow { font-size: var(--text-base); color: var(--color-link-on-light); transition: transform 160ms ease; }

/* Steps */
.ab-steps { list-style: none; margin: var(--space-6) 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.ab-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-top: 2px solid var(--color-primary);
  text-decoration: none;
  color: inherit;
}
.ab-step__n { font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-primary); }
.ab-step__title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.ab-step__body { font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

/* Contact strip */
.ab-contact { border-top: 1px solid #DAE3DD; background: #FAFAF5; }
.ab-contact__inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); padding-block: var(--space-8); }
.ab-contact__name { margin: 0 0 4px; font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }
.ab-contact__meta { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); }
.ab-contact__meta a { color: var(--color-link-on-light); }
.ab-contact__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); }

@media (max-width: 1023px) {
  .ab-hero, .ab-identity { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  /* The photographs stay on narrow screens: they are the only company visual on a phone. */
  .ab-hero__main { height: 180px; }
  .ab-hero__pair img { height: 90px; }
  .ab-steps { grid-template-columns: minmax(0, 1fr); gap: 17px; }
}

@media (max-width: 700px) {
  .ab-band { padding: var(--space-10) 0; }
  .ab-hero__title { font-size: calc(45px * var(--type-scale)); }
  .ab-families { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .ab-family { grid-template-columns: 35px minmax(0, 1fr) 18px; padding: var(--space-3) 0; }
  .ab-family__icon { width: 30px; height: 30px; }
  .ab-family__name { font-size: var(--text-base); }
  .ab-family__body { font-size: var(--text-sm); }
  .ab-contact__inner { flex-direction: column; align-items: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .ab-family { transition: none; }
}

@media (max-width: 380px) {
  /* The design lowers the display heading again at 320px; without this the longest word meets the
     right edge of the viewport. */
  .ab-hero__title { font-size: calc(39px * var(--type-scale)); }
}

</style>
