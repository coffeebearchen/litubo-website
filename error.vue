<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

defineProps<{
  error: { statusCode: number; message?: string }
}>()

useSeoHead({ title: t('seo.404.title'), description: '', canonicalPath: '', noIndex: true })
</script>

<template>
  <NuxtLayout>
    <section class="error-page">
      <div class="container error-page__inner">
        <p class="error-page__code">{{ error.statusCode }}</p>
        <h1 class="error-page__title">{{ t('pages.404.title') }}</h1>
        <p class="error-page__body">{{ t('pages.404.body') }}</p>
        <NuxtLink :to="localePath('/')" class="btn btn--primary btn--lg">
          {{ t('pages.404.cta') }}
        </NuxtLink>
      </div>
    </section>
  </NuxtLayout>
</template>

<style scoped>
.error-page {
  min-height: calc(100vh - var(--header-height));
  display: flex;
  align-items: center;
  padding: var(--space-16) 0;
}

.error-page__inner {
  max-width: 520px;
}

.error-page__code {
  font-family: var(--font-display);
  font-size: 6rem;
  font-weight: 700;
  color: var(--color-line);
  line-height: 1;
  margin-bottom: var(--space-4);
}

.error-page__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl));
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-4);
}

.error-page__body {
  font-size: var(--text-lg);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-8);
}

:deep(.btn) {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
}
:deep(.btn--primary)       { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
:deep(.btn--primary:hover) { background: #0a4a3b; border-color: #0a4a3b; }
:deep(.btn--lg)            { padding: var(--space-3) var(--space-8); font-size: var(--text-base); }
</style>
