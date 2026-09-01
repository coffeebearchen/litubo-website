<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const app = computed(() => useApplication(route.params.slug as string))

if (!app.value) {
  throw createError({ statusCode: 404, statusMessage: 'Application not found' })
}

useHead({
  title: app.value?.seo.title.en ?? t('seo.applications.title'),
  meta: [{ name: 'description', content: app.value?.seo.description.en ?? '' }],
})
</script>

<template>
  <div v-if="app">
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.applications'), to: localePath('/applications') },
            { label: app.title.en },
          ]"
        />
        <h1 class="page-hero__title">{{ app.title.en }}</h1>
        <p class="page-hero__sub">{{ app.overview.en }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container content-placeholder">
        <p>Application content is being prepared. <NuxtLink :to="localePath('/contact')">Contact us</NuxtLink> for information about {{ app.title.en }} inspection solutions.</p>
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
  color: rgba(255, 255, 255, 0.8);
  max-width: 560px;
  line-height: var(--leading-normal);
}

.section-gap { padding: var(--space-16) 0; }

.content-placeholder {
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

.content-placeholder a {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
