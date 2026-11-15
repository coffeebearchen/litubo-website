<script setup lang="ts">
import { industryGuide } from '~/content/industry-guides'

assertPublishedLocale()
const route = useRoute()
const localePath = useLocalePath()
const guide = industryGuide(String(route.params.slug))
if (!guide) throw createError({ statusCode: 404, fatal: true })
useSeoHead({ title: `${guide.title} Inspection — LITUBO`, description: guide.intro, canonicalPath: `/applications/${guide.slug}` })
const inquiryPath = `/contact?application=${encodeURIComponent(guide.slug)}`
const categories = [
  { slug: 'x-ray-inspection', label: 'X-ray inspection' },
  { slug: 'metal-detection', label: 'Metal detection' },
  { slug: 'checkweighers', label: 'Checkweighing' },
]
</script>

<template>
  <div v-if="guide">
    <section class="application-hero"><div class="container"><Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: 'Applications', to: localePath('/applications') }, { label: guide.title }]" /><p class="eyebrow">Food & Packaging Inspection</p><h1>{{ guide.title }}</h1><p class="intro">{{ guide.intro }}</p><NuxtLink :to="localePath(inquiryPath)" class="primary-link">Discuss your application →</NuxtLink></div></section>
    <section class="section-gap"><div class="container guide-grid"><div><p class="eyebrow">Your production line</p><h2>What to share with our team</h2><p class="section-copy">A few practical details help us discuss the right inspection approach for your product.</p><ul><li v-for="item in guide.considerations" :key="item">{{ item }}</li></ul></div><aside class="guide-note"><span class="guide-note__brand">LITUBO</span><h2>Start with your product.</h2><p>Send product and packaging photos, dimensions and your inspection objective. Our team can discuss the configuration and any further information or sample evaluation needed.</p><NuxtLink :to="localePath('/technical-matching')">Prepare a technical enquiry →</NuxtLink></aside></div></section>
    <section class="section-gap section-alt"><div class="container"><p class="eyebrow">Explore the range</p><h2>Inspection equipment to discuss</h2><p class="section-copy">The appropriate technology and configuration depend on your actual product, pack and production conditions.</p><div class="equipment-grid"><NuxtLink v-for="category in categories" :key="category.slug" :to="localePath(`/products/${category.slug}`)" class="equipment-card"><h3>{{ category.label }}</h3><span>Explore equipment →</span></NuxtLink></div></div></section>
    <CTABanner title="Talk through your application" primary-label="Contact our team" :primary-to="localePath(inquiryPath)" secondary-label="Technical matching" :secondary-to="localePath('/technical-matching')" />
  </div>
</template>

<style scoped>
.application-hero { background: var(--color-primary-deep); color: white; padding: var(--space-12) 0 var(--space-16); } h1 { font-family: var(--font-display); font-size: clamp(2.25rem, 5vw, 3.5rem); line-height: 1.15; margin: var(--space-4) 0; } .eyebrow { color: var(--color-accent); font-size: var(--text-xs); font-weight: 600; text-transform: uppercase; letter-spacing: .1em; margin-bottom: var(--space-3); } .application-hero .eyebrow { margin-top: var(--space-8); } .intro { color: rgba(255,255,255,.8); max-width: 720px; font-size: var(--text-lg); line-height: 1.7; } .primary-link { display: inline-block; margin-top: var(--space-8); padding: 14px 22px; background: var(--color-accent); color: white; border-radius: var(--radius-sm); font-weight: 600; } .section-gap { padding: var(--space-16) 0; } .section-alt { background: var(--color-canvas); } h2 { font-family: var(--font-display); font-size: var(--text-3xl); margin-bottom: var(--space-4); line-height: 1.25; } .section-copy { max-width: 720px; color: var(--color-ink-muted); line-height: 1.7; } .guide-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: var(--space-16); } ul { padding-left: 20px; margin-top: var(--space-6); } li { padding: 10px 0; line-height: 1.7; color: var(--color-ink-muted); } .guide-note { background: var(--color-canvas); padding: var(--space-8); border-left: 3px solid var(--color-accent); } .guide-note__brand { display: block; color: var(--color-primary); letter-spacing: .15em; font-weight: 700; margin-bottom: var(--space-6); } .guide-note h2 { font-size: var(--text-2xl); } .guide-note p { color: var(--color-ink-muted); line-height: 1.8; } .guide-note a { display: inline-block; margin-top: var(--space-6); color: var(--color-primary); font-weight: 600; } .equipment-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: var(--space-6); margin-top: var(--space-8); } .equipment-card { border: 1px solid var(--color-line); padding: var(--space-8); background: white; color: var(--color-primary); } .equipment-card h3 { font-size: var(--text-lg); margin-bottom: var(--space-6); } .equipment-card span { font-size: var(--text-sm); }
@media (max-width: 768px) { .guide-grid, .equipment-grid { grid-template-columns: 1fr; gap: var(--space-6); } .section-gap { padding: var(--space-12) 0; } }
</style>
