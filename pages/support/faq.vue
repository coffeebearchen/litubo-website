<script setup lang="ts">
import type { PostsResult, FaqGroup } from '~/types/content'

type Lang = 'en' | 'es' | 'pt'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// FINAL-RELEASE-FIX-C (RSG-05): FAQ items are legacy posts. An unpublished locale is a 404, and an item is
// listed only with text in the current locale; another locale's text is never shown instead.
assertPublishedLocale()

useSeoHead({ title: t('seo.faq.title'), description: t('seo.faq.description'), canonicalPath: '/support/faq' })

const { data: faqData, error: faqError } = await useAsyncData<PostsResult>(
  'cms-faq-list',
  () => $fetch<PostsResult>('/api/cms/posts?content_type=faq&sort=publish_date'),
  { default: () => ({ posts: [], cmsError: false }) },
)

const faqs = computed(() => (faqData.value?.posts ?? []).filter(f => Boolean(f.title[locale.value as Lang])))
// A refused or failed FAQ request (for example a production server not configured for Directus, which answers
// 503) shows the unavailable state, never an empty FAQ list.
const cmsError = computed(() => Boolean(faqError.value) || (faqData.value?.cmsError ?? false))

const GROUP_ORDER: FaqGroup[] = [
  'xray', 'metal-detection', 'checkweighing', 'applications', 'service-support', 'general',
]
const GROUP_LABELS: Record<FaqGroup, string> = {
  'xray': 'X-Ray Inspection',
  'metal-detection': 'Metal Detection',
  'checkweighing': 'Checkweighing',
  'applications': 'Applications & Industries',
  'service-support': 'Service & Support',
  'general': 'General',
}

const groupedFaqs = computed(() => {
  const map = new Map<string, typeof faqs.value>()
  for (const f of faqs.value) {
    const g = f.faqGroup ?? 'general'
    const key = g || 'general'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  // Return groups in defined order, then any extra groups not in the predefined list
  const ordered: { group: string; label: string; items: typeof faqs.value }[] = []
  for (const g of GROUP_ORDER) {
    if (map.has(g)) {
      ordered.push({ group: g, label: GROUP_LABELS[g], items: map.get(g)! })
      map.delete(g)
    }
  }
  // Any remaining groups not in GROUP_ORDER
  for (const [g, items] of map) {
    ordered.push({ group: g, label: g, items })
  }
  return ordered
})

function faqQuestion(f: (typeof faqs.value)[number]): string {
  return f.title[locale.value as Lang] ?? ''
}
function faqAnswer(f: (typeof faqs.value)[number]): string {
  if (!f.bodyHtml) return ''
  return f.bodyHtml[locale.value as Lang] ?? ''
}

// Search + category filter (ANYI-style sidebar).
const searchQuery = ref('')
const activeGroup = ref<string>('all')

const visibleFaqs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return faqs.value.filter((f) => {
    if (activeGroup.value !== 'all' && (f.faqGroup ?? 'general') !== activeGroup.value) return false
    if (!q) return true
    const haystack = `${faqQuestion(f)} ${faqAnswer(f).replace(/<[^>]*>/g, ' ')}`.toLowerCase()
    return haystack.includes(q)
  })
})

const filteredGroups = computed(() => {
  const map = new Map<string, typeof faqs.value>()
  for (const f of visibleFaqs.value) {
    const key = f.faqGroup ?? 'general'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  const ordered: { group: string; label: string; items: typeof faqs.value }[] = []
  for (const g of GROUP_ORDER) {
    if (map.has(g)) {
      ordered.push({ group: g, label: GROUP_LABELS[g], items: map.get(g)! })
      map.delete(g)
    }
  }
  for (const [g, items] of map) ordered.push({ group: g, label: g, items })
  return ordered
})

// The category list shown in the sidebar (only groups that actually have items).
const sidebarGroups = computed(() => {
  const present = new Set(faqs.value.map(f => f.faqGroup ?? 'general'))
  return GROUP_ORDER.filter(g => present.has(g)).map(g => ({ key: g, label: GROUP_LABELS[g] }))
})
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.support'), to: localePath('/support') },
            { label: t('nav_support.faq') },
          ]"
        />
        <h1 class="page-hero__title">{{ t('pages.faq.heroTitle') }}</h1>
      </div>
    </section>

    <section class="section-gap">
      <div class="container">
        <!-- Search -->
        <div class="faq-search">
          <label class="faq-search__label" for="faq-search-input">Search the answers</label>
          <div class="faq-search__row">
            <input
              id="faq-search-input"
              v-model="searchQuery"
              type="search"
              class="faq-search__input"
              placeholder="e.g. connections, drawings, samples"
            >
            <button type="button" class="faq-search__btn" @click="searchQuery = searchQuery.trim()">Search</button>
          </div>
        </div>

        <div class="faq-layout">
          <!-- Category sidebar -->
          <aside class="faq-sidebar" aria-label="FAQ categories">
            <p class="faq-sidebar__title">Categories</p>
            <ul role="list" class="faq-sidebar__list">
              <li>
                <button
                  type="button"
                  class="faq-sidebar__link"
                  :class="{ 'is-active': activeGroup === 'all' }"
                  @click="activeGroup = 'all'"
                >
                  All categories
                </button>
              </li>
              <li v-for="g in sidebarGroups" :key="g.key">
                <button
                  type="button"
                  class="faq-sidebar__link"
                  :class="{ 'is-active': activeGroup === g.key }"
                  @click="activeGroup = g.key"
                >
                  {{ g.label }}
                </button>
              </li>
            </ul>
          </aside>

          <!-- Questions -->
          <div class="faq-main">
            <!-- CMS error state -->
            <div v-if="cmsError" class="cms-error-state">
              <p>FAQ content is temporarily unavailable. Please try again later.</p>
            </div>

            <!-- No FAQ items at all -->
            <div v-else-if="faqs.length === 0" class="empty-state">
              <p>No FAQ items available yet.</p>
            </div>

            <!-- No match for the current filter -->
            <div v-else-if="filteredGroups.length === 0" class="empty-state">
              <p>No answers match that search. Try a different word or <NuxtLink :to="localePath('/contact')">contact us</NuxtLink>.</p>
            </div>

            <!-- Grouped FAQ accordion -->
            <template v-else>
              <div
                v-for="group in filteredGroups"
                :key="group.group"
                class="faq-group"
              >
                <h2 class="faq-group__title">{{ group.label }}</h2>
                <Accordion
                  v-for="faq in group.items"
                  :key="faq.slug"
                  :title="faqQuestion(faq)"
                >
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div class="faq-answer rich-text" v-html="faqAnswer(faq)" />
                </Accordion>
              </div>
            </template>

            <p class="faq-more">
              Have a question not listed here?
              <NuxtLink :to="localePath('/contact')">Contact us</NuxtLink>.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }

/* ─── Search + category sidebar ─── */
.faq-search { margin-bottom: var(--space-8); }
.faq-search__label { display: block; font-size: var(--text-sm); color: var(--color-ink-muted); margin-bottom: var(--space-2); }
.faq-search__row { display: flex; gap: var(--space-3); max-width: 760px; }
.faq-search__input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font: inherit;
  background: var(--color-white);
  color: var(--color-ink);
}
.faq-search__input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.faq-search__btn {
  padding: 12px 24px;
  background: var(--color-primary);
  color: var(--color-white);
  border: 0;
  border-radius: var(--radius-sm);
  font: 600 var(--text-sm)/1 var(--font-body);
  cursor: pointer;
}
.faq-search__btn:hover { background: var(--color-primary-deep); }

.faq-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--space-12); align-items: start; }
.faq-sidebar__title { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink); margin: 0 0 var(--space-3); }
.faq-sidebar__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.faq-sidebar__link {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  background: none;
  border: 0;
  border-left: 3px solid transparent;
  color: var(--color-ink-muted);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}
.faq-sidebar__link:hover { color: var(--color-primary); }
.faq-sidebar__link.is-active {
  color: var(--color-primary);
  border-left-color: var(--color-accent);
  background: var(--color-canvas);
  font-weight: 600;
}
.faq-main { min-width: 0; }

@media (max-width: 900px) {
  .faq-layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); }
  .faq-sidebar__list { flex-direction: row; flex-wrap: wrap; gap: var(--space-2); }
  .faq-sidebar__link { border-left: 0; border-bottom: 2px solid transparent; width: auto; }
  .faq-sidebar__link.is-active { border-bottom-color: var(--color-accent); }
}

.faq-group { margin-bottom: var(--space-10); }
.faq-group__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 2px solid var(--color-line);
}

.faq-answer :deep(p) { font-size: var(--text-base); line-height: var(--leading-relaxed); margin-bottom: var(--space-2); color: var(--color-ink); }
.faq-answer :deep(p:last-child) { margin-bottom: 0; }
.faq-answer :deep(ul), .faq-answer :deep(ol) { padding-left: var(--space-5); margin-bottom: var(--space-2); }
.faq-answer :deep(li) { font-size: var(--text-base); line-height: var(--leading-relaxed); color: var(--color-ink); }
.faq-answer :deep(a) { color: var(--color-primary); text-decoration: underline; }

.cms-error-state, .empty-state { font-size: var(--text-base); color: var(--color-ink-muted); padding: var(--space-8) 0; }
.faq-more { margin-top: var(--space-8); font-size: var(--text-sm); color: var(--color-ink-muted); }
.faq-more a { color: var(--color-primary); text-decoration: underline; }
</style>
