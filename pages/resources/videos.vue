<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: 'Equipment Demonstrations — LITUBO', description: 'Discuss a product demonstration and the inspection questions that matter to your production line.', canonicalPath: '/resources/videos' })
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources'), to: localePath('/resources') }, { label: t('nav_resources.videos') }]" />
        <h1 class="page-hero__title">{{ t('nav_resources.videos') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container demonstration">
        <div><p class="eyebrow">See the equipment in context</p><h2>Ask about a demonstration for your application.</h2><p>Tell us which equipment you are considering and what you would like to understand. Our team can discuss relevant demonstration material and any further product information needed.</p><ul><li>Product feeding, conveying and handling</li><li>Inspection setup and operator workflow</li><li>Reject handling and line integration</li><li>Cleaning, changeover and access requirements</li></ul><NuxtLink :to="localePath('/contact?topic=demonstration')" class="demonstration-link">Request demonstration information →</NuxtLink></div>
        <aside><span>LITUBO</span><h3>Start with your product and packaging.</h3><p>Photos, dimensions, pack materials and the inspection objective give our team a practical starting point.</p><NuxtLink :to="localePath('/technical-matching')">Prepare a technical enquiry →</NuxtLink></aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%); padding: var(--space-12) 0; color: var(--color-ink); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.content-placeholder { font-size: var(--text-base); color: var(--color-ink-muted); }
.content-placeholder a { color: var(--color-primary); text-decoration: underline; }
.demonstration { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); gap: var(--space-16); }
.eyebrow { color: var(--color-accent); text-transform: uppercase; letter-spacing: .08em; font-size: var(--text-xs); margin-bottom: var(--space-4); }
h2 { font-family: var(--font-display); color: var(--color-primary); font-size: var(--text-3xl); line-height: 1.3; margin-bottom: var(--space-6); }
.demonstration p, li { color: var(--color-ink-muted); line-height: 1.8; } ul { padding-left: 20px; margin: var(--space-6) 0; } li { margin: 8px 0; }
.demonstration-link { display: inline-block; background: var(--color-primary); color: white; padding: 14px 22px; border-radius: var(--radius-sm); margin-top: var(--space-4); }
aside { background: var(--color-canvas); padding: var(--space-8); border-top: 3px solid var(--color-accent); align-self: start; } aside span { color: var(--color-primary); font-weight: 700; letter-spacing: .12em; } aside h3 { color: var(--color-primary); font-size: var(--text-2xl); margin: var(--space-6) 0 var(--space-4); } aside a { display: block; color: var(--color-primary); margin-top: var(--space-6); font-weight: 600; }
@media (max-width: 768px) { .demonstration { grid-template-columns: 1fr; gap: var(--space-8); } }
</style>
