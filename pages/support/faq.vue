<script setup lang="ts">
import type { PostsResult, FaqGroup } from '~/types/content'

const { t } = useI18n()
const localePath = useLocalePath()
const { locale } = useI18n()

useHead({ title: t('seo.faq.title'), meta: [{ name: 'description', content: t('seo.faq.description') }] })

const { data: faqData } = await useAsyncData<PostsResult>(
  'cms-faq-list',
  () => $fetch<PostsResult>('/api/cms/posts?content_type=faq&sort=publish_date'),
  { default: () => ({ posts: [], cmsError: false }) },
)

const faqs = computed(() => faqData.value?.posts ?? [])
const cmsError = computed(() => faqData.value?.cmsError ?? false)

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
  return f.title[locale.value as 'en' | 'es' | 'pt'] || f.title.en
}
function faqAnswer(f: (typeof faqs.value)[number]): string {
  if (!f.bodyHtml) return ''
  return f.bodyHtml[locale.value as 'en' | 'es' | 'pt'] || f.bodyHtml.en
}
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
      <div class="container faq-container">
        <!-- CMS error state -->
        <div v-if="cmsError" class="cms-error-state">
          <p>FAQ content is temporarily unavailable. Please try again later.</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="groupedFaqs.length === 0" class="empty-state">
          <p>No FAQ items available yet.</p>
        </div>

        <!-- Grouped FAQ accordion -->
        <template v-else>
          <div
            v-for="group in groupedFaqs"
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
    </section>
  </div>
</template>

<style scoped>
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title { font-family: var(--font-display); font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl)); font-weight: 600; line-height: var(--leading-tight); margin: var(--space-4) 0; }
.section-gap { padding: var(--space-16) 0; }
.faq-container { max-width: 760px; }

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
