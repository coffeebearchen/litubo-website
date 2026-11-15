<script setup lang="ts">
import type { Post } from '~/types/content'

// Insights are served from the legacy `posts` collection (content_type = insight).
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const slug = String(route.params.slug)
const l = locale.value as 'en' | 'es' | 'pt'

const { data: post, error } = await useAsyncData<Post>(
  `post-insight-${locale.value}-${slug}`,
  () => $fetch<Post>(`/api/cms/posts/${encodeURIComponent(slug)}`),
)

if (error.value || !post.value || post.value.contentType !== 'insight') {
  throw createError({ statusCode: 404, fatal: true })
}

useSeoHead({
  title: post.value.title[l] || post.value.title.en,
  description: post.value.excerpt[l] || post.value.excerpt.en,
  canonicalPath: `/resources/insights/${slug}`,
})

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}
</script>

<template>
  <div v-if="post" class="post-page">
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: 'Resources', to: localePath('/resources') },
            { label: post.title[l] || post.title.en },
          ]"
        />
        <p class="post-meta">{{ formatDate(post.publishDate) }} · Insight</p>
        <h1 class="page-hero__title">{{ post.title[l] || post.title.en }}</h1>
        <p v-if="post.excerpt[l] || post.excerpt.en" class="page-hero__sub">
          {{ post.excerpt[l] || post.excerpt.en }}
        </p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container post-body">
        <!-- bodyHtml is sanitized server-side by legacyPostHtml (allow-list, file gate). -->
        <div v-html="post.bodyHtml[l] || post.bodyHtml.en" />
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
.post-meta {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.75);
  margin: var(--space-3) 0 var(--space-2);
  letter-spacing: 0.02em;
}

.page-hero__title {
  color: var(--color-white);
}

.page-hero__sub {
  color: rgba(255, 255, 255, 0.82);
}

.post-page :deep(.breadcrumb),
.post-page :deep(.breadcrumb a),
.post-page :deep(.breadcrumb span) {
  color: rgba(255, 255, 255, 0.72);
}

.post-body {
  max-width: 820px;
}

.post-body :deep(h2) {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-primary-deep);
  line-height: var(--leading-tight);
  margin: var(--space-10) 0 var(--space-3);
}

.post-body :deep(h2:first-child) { margin-top: 0; }

.post-body :deep(p) {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
}

.post-body :deep(ul) {
  margin: 0 0 var(--space-5);
  padding-left: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.post-body :deep(li) {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-ink-muted);
}

.post-body :deep(a) { color: var(--color-primary); text-decoration: underline; }
.post-body :deep(img) { max-width: 100%; height: auto; border-radius: var(--radius-sm); }

.section-gap { padding: var(--space-16) 0; }
</style>
