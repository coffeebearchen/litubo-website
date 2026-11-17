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

// A01: an upstream failure is 503, not 404. Only a genuine "not this post" is 404.
const status = publicPageStatus(error.value, Boolean(post.value))
if (status) throw createError({ statusCode: status, fatal: true })
const resolved = post.value
if (!resolved) throw createError({ statusCode: 404, fatal: true })
if (resolved.contentType !== 'insight') throw createError({ statusCode: 404, fatal: true })

  // The API has always returned a per-language `seo` block (title / description / OG image) and
  // this page used to ignore it, so every article used its own title as the <title> and its
  // excerpt as the description. The editorial fields now win; the old values stay as fallback.
  useSeoHead({
    title: resolved.seo.title[l] || resolved.title[l] || resolved.title.en,
    description: resolved.seo.description[l] || resolved.excerpt[l] || resolved.excerpt.en,
    canonicalPath: `/resources/insights/${slug}`,
    ogImage: resolved.seo.ogImage,
  })

/**
 * A08 - a device photograph must not be cropped, so it is contained; a scene fills the frame.
 * The API carries no per-image fit field, so this is a controlled list for the ten published
 * Insights rather than a guess at render time. Unknown slugs fall back to cover.
 */
const CONTAIN_SLUGS = new Set([
  'how-x-ray-inspection-works',
  'x-ray-or-metal-detection',
  'how-metal-detection-works',
  'checkweighing-basics',
  'combination-inspection',
])

const coverFit = computed(() => {
  // V2-05: the record wins once it has a value; a null keeps the previous per-slug behaviour so no
  // existing article changes appearance just because the column was added.
  const fromRecord = post.value?.coverFit
  if (fromRecord === 'contain') return 'post-cover__img--contain'
  if (fromRecord === 'cover') return ''
  return CONTAIN_SLUGS.has(slug) ? 'post-cover__img--contain' : ''
})

/** A08 - the cover carried no alt text at all. The article title describes it truthfully. */
const coverAlt = computed(() => (resolved?.title[l] || resolved?.title.en || ''))

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
        <!-- Cover: the same record field the list and home cards read, so one edit updates all three.
             Device photographs are contained so no machine is cropped; scenes fill the frame. -->
        <figure v-if="post.coverImageUrl" class="post-cover">
          <img
            :src="post.coverImageUrl"
            :alt="coverAlt"
            class="post-cover__img"
            :class="coverFit"
            loading="eager"
            decoding="async"
          >
        </figure>

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
  color: var(--color-ink-muted);
  margin: var(--space-3) 0 var(--space-2);
  letter-spacing: 0.02em;
}

.page-hero__title {
  color: var(--color-ink);
}

.page-hero__sub {
  color: var(--color-ink-muted);
}

/* The hero is light now, so the breadcrumb keeps the shared dark styling. No page-level override. */

.post-cover {
  margin: 0 0 var(--space-8);
  border-radius: 6px;
  overflow: hidden;
  background: #F2F8F4;
}
.post-cover__img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 460px;
  object-fit: cover;
}
.post-cover__img--contain {
  object-fit: contain;
  max-height: 520px;
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
