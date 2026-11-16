<script setup lang="ts">
import type { PostsResult, PostListItem } from '~/types/content'

/**
 * Blog listing — every published insight, found without guessing a URL.
 *
 * The articles already existed as detail pages under `/resources/insights/<slug>` but there was no
 * index, so nothing linked to them. This page is that index: it lists only what is actually
 * published, shows no invented dates or authors, and degrades to an explicit empty state instead of
 * an empty grid.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoHead({
  title: t('seo.resources.title'),
  description: t('seo.resources.description'),
  canonicalPath: '/resources/insights',
})

const { data, error } = await useAsyncData(
  `insights-index-${locale.value}`,
  () => $fetch<PostsResult>('/api/cms/posts', { query: { locale: locale.value, limit: 100 } }),
)

function pick(value: { en: string, es: string, pt: string } | undefined): string {
  if (!value) return ''
  const code = locale.value as 'en' | 'es' | 'pt'
  return value[code] || value.en || ''
}

const articles = computed<PostListItem[]>(() =>
  (data.value?.posts ?? [])
    .filter(p => p.contentType === 'insight')
    .sort((a, b) => (b.publishDate ?? '').localeCompare(a.publishDate ?? '')),
)

const featured = computed(() => articles.value[0] ?? null)
const rest = computed(() => articles.value.slice(1))

function articlePath(slug: string): string {
  return localePath(`/resources/insights/${slug}`)
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.resources'), to: localePath('/resources') },
            { label: 'Insights' },
          ]"
        />
        <h1 class="page-hero__title">Blog &amp; Insights</h1>
        <p class="page-hero__sub">
          Practical notes on inspection, packaging and production lines — written by the team that
          builds the systems.
        </p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <!-- Upstream failure is its own state; it is never shown as "no articles". -->
        <div v-if="error || data?.cmsError" class="insights-empty">
          <p class="insights-empty__title">Articles are temporarily unavailable.</p>
          <p class="insights-empty__body">Please try again shortly.</p>
        </div>

        <div v-else-if="!articles.length" class="insights-empty">
          <p class="insights-empty__title">No published articles yet.</p>
          <p class="insights-empty__body">
            <NuxtLink :to="localePath('/contact')">Talk to our team</NuxtLink> and we will answer your
            question directly.
          </p>
        </div>

        <template v-else>
          <!-- Featured: the newest published article, two columns. -->
          <NuxtLink v-if="featured" :to="articlePath(featured.slug)" class="insight-featured">
            <div class="insight-featured__media">
              <img
                v-if="featured.coverImageUrl"
                :src="featured.coverImageUrl"
                alt=""
                loading="eager"
                decoding="async"
              >
              <div v-else class="insight-media-empty" aria-hidden="true" />
            </div>
            <div class="insight-featured__body">
              <span class="insight-eyebrow">Featured</span>
              <h2 class="insight-featured__title">{{ pick(featured.title) }}</h2>
              <p class="insight-featured__excerpt">{{ pick(featured.excerpt) }}</p>
              <span class="insight-more">Read article →</span>
            </div>
          </NuxtLink>

          <ul v-if="rest.length" class="insight-grid" role="list">
            <li v-for="post in rest" :key="post.id">
              <NuxtLink :to="articlePath(post.slug)" class="insight-card">
                <div class="insight-card__media">
                  <img
                    v-if="post.coverImageUrl"
                    :src="post.coverImageUrl"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  >
                  <div v-else class="insight-media-empty" aria-hidden="true" />
                </div>
                <div class="insight-card__body">
                  <h3 class="insight-card__title">{{ pick(post.title) }}</h3>
                  <p class="insight-card__excerpt">{{ pick(post.excerpt) }}</p>
                  <p class="insight-card__meta">
                    <time v-if="formatDate(post.publishDate)" :datetime="post.publishDate ?? undefined">
                      {{ formatDate(post.publishDate) }}
                    </time>
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </template>
      </div>
    </section>

    <CTABanner
      :title="t('common.talkToEngineer')"
      :primary-label="t('nav.contact')"
      :primary-to="localePath('/contact')"
      :secondary-label="t('common.learnMore')"
      :secondary-to="localePath('/applications')"
    />
  </div>
</template>

<style scoped>
.insights-empty {
  padding: var(--space-12) 0;
  text-align: center;
}
.insights-empty__title {
  margin: 0 0 var(--space-3);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: #203C32;
}
.insights-empty__body { margin: 0; color: #60716A; }

/* ── Featured ─────────────────────────────────────── */
.insight-featured {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 0;
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-fast);
}
.insight-featured:hover { box-shadow: 0 6px 24px rgba(27, 66, 36, 0.10); }

.insight-featured__media {
  position: relative;
  background: #F2F8F4;
  min-height: 320px;
}
.insight-featured__media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.insight-featured__body {
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-3);
}
.insight-eyebrow {
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #60716A;
}
.insight-featured__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.2;
  color: #203C32;
}
.insight-featured__excerpt {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.6;
  color: #60716A;
}
.insight-more { font-size: var(--text-sm); color: var(--color-link-on-light); }

/* ── Grid ─────────────────────────────────────────── */
.insight-grid {
  list-style: none;
  margin: var(--space-10) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}
.insight-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #DAE3DD;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: transform 180ms ease, box-shadow 180ms ease;
}
/* A 3px lift only — no scale, no rotation. */
.insight-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(27, 66, 36, 0.10);
}

.insight-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: #F2F8F4;
}
.insight-card__media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* No cover: a quiet block, never a fabricated image. */
.insight-media-empty {
  position: absolute;
  inset: 0;
  background: #F2F8F4;
}

.insight-card__body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}
.insight-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: 1.3;
  color: #203C32;
}
.insight-card__excerpt {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: #60716A;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.insight-card__meta {
  margin: auto 0 0;
  font-size: var(--text-xs);
  color: #60716A;
}

@media (max-width: 1023px) {
  .insight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .insight-featured { grid-template-columns: 1fr; }
  .insight-featured__media { min-height: 220px; }
  .insight-featured__body { padding: 24px 20px; }
}

@media (max-width: 700px) {
  .insight-grid { grid-template-columns: 1fr; gap: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .insight-card { transition: none; }
  .insight-card:hover { transform: none; }
}
</style>
