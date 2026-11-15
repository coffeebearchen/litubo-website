<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
useSeoHead({ title: 'Technical Documents — LITUBO', description: 'Request product datasheets, manuals, drawings and selection information from the LITUBO team.', canonicalPath: '/resources/downloads' })
const documents = [
  { id: 'datasheet', title: 'Product datasheets', body: 'Request the specifications and configuration information for the model you are discussing.' },
  { id: 'manual', title: 'Operation manuals', body: 'Share your model and serial number so our team can identify the appropriate manual.' },
  { id: 'drawing', title: 'Technical drawings', body: 'Discuss equipment dimensions, installation space and connections for your production line.' },
  { id: 'catalogue', title: 'Product selection', body: 'Tell us about your application and the inspection equipment you would like to explore.' },
]
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb :items="[{ label: 'Home', to: localePath('/') }, { label: t('nav.resources'), to: localePath('/resources') }, { label: t('nav_resources.downloads') }]" />
        <h1 class="page-hero__title">{{ t('nav_resources.downloads') }}</h1>
      </div>
    </section>
    <section class="section-gap">
      <div class="container">
        <p class="documents-intro">Get the right technical information for your project. Include the product model or describe your application when requesting a document.</p>
        <div class="documents-grid"><article v-for="document in documents" :key="document.id" class="document-card"><span class="document-card__type">Technical information</span><h2>{{ document.title }}</h2><p>{{ document.body }}</p><NuxtLink :to="localePath(`/support/manual-request?document=${document.id}`)">Request document →</NuxtLink></article></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.content-placeholder { font-size: var(--text-base); color: var(--color-ink-muted); }
.content-placeholder a { color: var(--color-primary); text-decoration: underline; }
.documents-intro { max-width: 760px; color: var(--color-ink-muted); font-size: var(--text-lg); line-height: 1.8; margin-bottom: var(--space-10); }
.documents-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: var(--space-6); }
.document-card { padding: var(--space-8); border: 1px solid var(--color-line); background: var(--color-white); }
.document-card__type { color: var(--color-accent); text-transform: uppercase; letter-spacing: .08em; font-size: var(--text-xs); }
.document-card h2 { color: var(--color-primary); font-family: var(--font-display); font-size: var(--text-2xl); margin: var(--space-3) 0; }
.document-card p { color: var(--color-ink-muted); line-height: 1.7; margin-bottom: var(--space-6); }
.document-card a { color: var(--color-primary); font-weight: 600; }
@media (max-width: 639px) { .documents-grid { grid-template-columns: 1fr; } }
</style>
