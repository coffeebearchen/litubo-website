<script setup lang="ts">
import type { PostsResult } from '~/types/content'
import type { PublicContentList } from '~/types/content-public'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const publishedLocales = useRuntimeConfig().public.publishedLocales

useSeoHead({
  title: t('seo.resources.title'),
  description: t('seo.resources.description'),
  canonicalPath: '/resources',
})

/**
 * CC-IMP-10 (D-035) — Phase 1 route ownership of "Latest from LITUBO":
 *   Insights (Technical Articles) and Case Studies → Content Center public API only
 *   Technical Guides → legacy posts
 *   News → not public in Phase 1 (no filter, no cards)
 * A source that fails shows the unavailable state; it is never shown as an empty list.
 */
type HubKind = 'technical_article' | 'technical_guide' | 'case_study'

interface HubCard {
  key: string
  kind: HubKind
  typeLabel: string
  title: string
  summary: string
  date: string | null
  href: string
  imageUrl: string
  imageAlt: string
}

const TYPE_LABELS: Record<HubKind, string> = {
  technical_article: 'Insight',
  technical_guide: 'Technical Guide',
  case_study: 'Case Study',
}

const { data: hub } = await useAsyncData(
  `resources-hub-${locale.value}`,
  async () => {
    const query = { locale: locale.value }
    const [articles, caseStudies, guides, insights] = await Promise.allSettled([
      $fetch<PublicContentList>('/api/cms/content/technical_article', { query }),
      $fetch<PublicContentList>('/api/cms/content/case_study', { query }),
      $fetch<PostsResult>('/api/cms/posts?content_type=technical_guide'),
      $fetch<PostsResult>('/api/cms/posts?content_type=insight&limit=50'),
    ])
    let unavailable = false
    const cards: HubCard[] = []
    for (const result of [articles, caseStudies]) {
      if (result.status !== 'fulfilled') {
        unavailable = true
        continue
      }
      for (const item of result.value.items) {
        const kind = item.type as HubKind
        cards.push({
          key: `${kind}:${item.href}`,
          kind,
          typeLabel: TYPE_LABELS[kind] ?? item.typeLabel,
          title: item.title,
          summary: item.summary,
          date: item.publishedAt,
          href: item.href,
          imageUrl: item.image?.url ?? '',
          imageAlt: item.image?.alt || item.title,
        })
      }
    }
    if (guides.status !== 'fulfilled' || guides.value.cmsError) {
      unavailable = true
    } else if (isPublishedLocale(locale.value, publishedLocales)) {
      // FINAL-RELEASE-FIX-C (RSG-05): a legacy guide is listed only in a published locale, with its own
      // text in that locale; another locale's text is never shown instead.
      const lang = locale.value as 'en' | 'es' | 'pt'
      for (const post of guides.value.posts.filter(p => p.contentType === 'technical_guide' && p.title[lang])) {
        const title = post.title[lang]
        cards.push({
          key: `technical_guide:${post.slug}`,
          kind: 'technical_guide',
          typeLabel: TYPE_LABELS.technical_guide,
          title,
          summary: post.excerpt[lang] ?? '',
          date: post.publishDate,
          href: localePath(`/resources/technical-guides/${post.slug}`),
          imageUrl: post.coverImageUrl,
          imageAlt: title,
        })
      }
    }
    if (insights.status === 'fulfilled' && !insights.value.cmsError && isPublishedLocale(locale.value, publishedLocales)) {
      const lang = locale.value as 'en' | 'es' | 'pt'
      for (const post of insights.value.posts.filter(p => p.contentType === 'insight' && p.title[lang])) {
        const title = post.title[lang]
        cards.push({
          key: `insight:${post.slug}`,
          kind: 'technical_article',
          typeLabel: 'Insight',
          title,
          summary: post.excerpt[lang] ?? '',
          date: post.publishDate,
          href: localePath(`/resources/insights/${post.slug}`),
          imageUrl: post.coverImageUrl,
          imageAlt: title,
        })
      }
    }
    cards.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    return { cards, unavailable }
  },
  { default: () => ({ cards: [] as HubCard[], unavailable: false }) },
)

const allCards = computed<HubCard[]>(() => hub.value?.cards ?? [])
const unavailable = computed<boolean>(() => hub.value?.unavailable ?? false)

type FilterType = 'all' | HubKind
const activeFilter = ref<FilterType>('all')

// Only types that actually have published content. A tab for an empty type filters to nothing and
// reads as a broken section, so it is not offered until a post of that type is published.
const filterTabs: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'technical_article', label: 'Insights' },
]

const filteredCards = computed<HubCard[]>(() =>
  activeFilter.value === 'all'
    ? allCards.value
    : allCards.value.filter((card: HubCard) => card.kind === activeFilter.value),
)

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

const imgErrors = ref<Record<string, boolean>>({})
function onImgError(key: string) { imgErrors.value[key] = true }

const categories = [
  {
    key: 'insights',
    title: t('nav_resources.insights'),
    body: 'Technical articles and application guides written by our engineering team.',
    to: localePath('/resources/insights'),
  },
  {
    key: 'downloads',
    title: t('nav_resources.downloads'),
    body: 'Datasheets, manuals and product specifications, requested by model.',
    to: localePath('/resources/downloads'),
  },
  {
    // Three entries only. Case studies and certificates have no published content, so a card for
    // them would describe a library that does not exist.
    key: 'videos',
    title: t('nav_resources.videos'),
    body: 'Request a demonstration of a system running your own product type.',
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

        <!-- Unavailable state: a content source failed (never shown as an empty list) -->
        <div v-if="unavailable" class="cms-error-state">
          <p>Content is temporarily unavailable. Please try again later.</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredCards.length === 0" class="empty-state">
          <p>No articles available in this category yet.</p>
        </div>

        <!-- Resource cards -->
        <div v-else class="resource-grid">
          <article
            v-for="card in filteredCards"
            :key="card.key"
            class="resource-card"
          >
            <NuxtLink :to="card.href" class="resource-card__link">
              <div class="resource-card__media">
                <img
                  v-if="card.imageUrl && !imgErrors[card.key]"
                  :src="card.imageUrl"
                  :alt="card.imageAlt"
                  class="resource-card__img"
                  loading="lazy"
                  @error="onImgError(card.key)"
                >
                <div v-else class="resource-card__photo-placeholder img-placeholder img-placeholder--warm-light" aria-hidden="true" />
              </div>
              <div class="resource-card__body">
                <p class="resource-card__type">{{ card.typeLabel }}</p>
                <h3 class="resource-card__title">{{ card.title }}</h3>
                <p class="resource-card__summary">{{ card.summary }}</p>
                <p class="resource-card__date">{{ formatDate(card.date) }}</p>
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
  background: linear-gradient(180deg, #F4E5C8 0%, #FAF8F3 100%);
  padding: var(--space-12) 0;
  color: var(--color-ink);
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
  color: var(--color-ink-muted);
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
  box-shadow: 0 2px 12px rgba(27, 66, 36,0.10);
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
  box-shadow: 0 4px 16px rgba(27, 66, 36,0.12);
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
}
.resource-card__body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
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
  overflow-wrap: anywhere;
}
.resource-card__summary {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
  overflow-wrap: anywhere;
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
