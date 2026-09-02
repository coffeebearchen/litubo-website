<script setup lang="ts">
import type { PostsResult, PostListItem, ContentType } from '~/types/content'

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('seo.resources.title'),
  meta: [{ name: 'description', content: t('seo.resources.description') }],
})

const { data: postsData } = await useAsyncData<PostsResult>(
  'cms-posts-list',
  () => $fetch<PostsResult>('/api/cms/posts?exclude_type=faq'),
  { default: () => ({ posts: [], cmsError: false }) },
)

const allPosts = computed<PostListItem[]>(() => postsData.value?.posts ?? [])
const cmsError = computed<boolean>(() => postsData.value?.cmsError ?? false)

type FilterType = 'all' | ContentType
const activeFilter = ref<FilterType>('all')

const TYPE_LABELS: Record<ContentType, string> = {
  insight: 'Insight',
  technical_guide: 'Technical Guide',
  case_study: 'Case Study',
  news: 'News',
  faq: 'FAQ',
}

const TYPE_ROUTE: Record<ContentType, string> = {
  insight: 'insights',
  technical_guide: 'technical-guides',
  case_study: 'case-studies',
  news: 'news',
  faq: 'faq',
}

const filterTabs: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'insight', label: 'Insights' },
  { key: 'technical_guide', label: 'Technical Guides' },
  { key: 'case_study', label: 'Case Studies' },
  { key: 'news', label: 'News' },
]

const filteredPosts = computed<PostListItem[]>(() =>
  activeFilter.value === 'all'
    ? allPosts.value
    : allPosts.value.filter((p: PostListItem) => p.contentType === activeFilter.value),
)

function postTitle(post: PostListItem): string {
  return post.title[locale.value as 'en' | 'es' | 'pt'] || post.title.en
}
function postExcerpt(post: PostListItem): string {
  return post.excerpt[locale.value as 'en' | 'es' | 'pt'] || post.excerpt.en
}
function postRoute(post: PostListItem): string {
  return localePath(`/resources/${TYPE_ROUTE[post.contentType]}/${post.slug}`)
}
function postTypeLabel(post: PostListItem): string {
  return TYPE_LABELS[post.contentType]
}
function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

const imgErrors = ref<Record<string, boolean>>({})
function onImgError(slug: string) { imgErrors.value[slug] = true }

const categories = [
  {
    key: 'insights',
    title: t('nav_resources.insights'),
    body: 'Technical articles, application guides and industry whitepapers.',
    to: localePath('/resources') + '#latest',
  },
  {
    key: 'case-studies',
    title: t('nav_resources.caseStudies'),
    body: 'Real-world results from food manufacturers using LITUBO systems.',
    to: localePath('/resources') + '#latest',
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

    <!-- Latest resources -->
    <section id="latest" class="section-gap">
      <div class="container">
        <div class="section-header">
          <SectionHeading>Latest from LITUBO</SectionHeading>
        </div>

        <!-- Filter tabs -->
        <div class="filter-tabs" role="tablist" aria-label="Content type filter">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ 'filter-tab--active': activeFilter === tab.key }"
            role="tab"
            :aria-selected="activeFilter === tab.key"
            @click="activeFilter = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- CMS error state (CMS_MODE=directus, Directus unavailable) -->
        <div v-if="cmsError" class="cms-error-state">
          <p>Content is temporarily unavailable. Please try again later.</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredPosts.length === 0" class="empty-state">
          <p>No articles available in this category yet.</p>
        </div>

        <!-- Resource cards -->
        <div v-else class="resource-grid">
          <article
            v-for="post in filteredPosts"
            :key="post.slug"
            class="resource-card"
          >
            <NuxtLink :to="postRoute(post)" class="resource-card__link">
              <div class="resource-card__media">
                <img
                  v-if="post.coverImageUrl && !imgErrors[post.slug]"
                  :src="post.coverImageUrl"
                  :alt="postTitle(post)"
                  class="resource-card__img"
                  loading="lazy"
                  @error="onImgError(post.slug)"
                >
                <div v-else class="resource-card__photo-placeholder" aria-hidden="true" />
              </div>
              <div class="resource-card__body">
                <p class="resource-card__type">{{ postTypeLabel(post) }}</p>
                <h3 class="resource-card__title">{{ postTitle(post) }}</h3>
                <p class="resource-card__summary">{{ postExcerpt(post) }}</p>
                <p class="resource-card__date">{{ formatDate(post.publishDate) }}</p>
              </div>
            </NuxtLink>
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

/* ── Category nav strip ──────────────────────────────────────── */
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

/* ── Latest section ──────────────────────────────────────────── */
.section-gap { padding: var(--space-16) 0; }
.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

/* ── Filter tabs ─────────────────────────────────────────────── */
.filter-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-8);
}
.filter-tab {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;
}
.filter-tab:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.filter-tab--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-white);
}

/* ── Error / empty states ────────────────────────────────────── */
.cms-error-state,
.empty-state {
  padding: var(--space-12) 0;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

/* ── Resource grid ───────────────────────────────────────────── */
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
.resource-card__link {
  display: flex;
  flex-direction: column;
  flex: 1;
  text-decoration: none;
  color: inherit;
}
.resource-card__media {
  aspect-ratio: 16 / 9;
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

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .cat-nav-grid { grid-template-columns: repeat(2, 1fr); }
  .resource-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 639px) {
  .cat-nav-grid { grid-template-columns: 1fr; }
  .resource-grid { grid-template-columns: 1fr; }
  .filter-tabs { gap: var(--space-1); }
  .filter-tab { font-size: var(--text-xs); padding: var(--space-2) var(--space-3); }
}
</style>
