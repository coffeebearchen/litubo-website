<script setup lang="ts">
import { computed } from 'vue'
import type { PublicContentDetail } from '~/types/content-public'
import type { ContentRendererImage, ContentRendererListEntry } from '~/types/content-center'

/**
 * CC-IMP-10 — public Content Center article page body (Technical Article, Case Study).
 * Renders only the public payload built from a published snapshot; structured blocks
 * go through the plain-text ContentBlocksRenderer (no HTML).
 */

const props = defineProps<{
  content: PublicContentDetail
  /** Breadcrumb label of the Resources section, e.g. "Insights". */
  sectionLabel: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')

const images = computed<Record<number, ContentRendererImage>>(() => Object.fromEntries(
  Object.entries(props.content.images).map(([key, image]) => [Number(key), { src: image.url, alt: image.alt, caption: image.caption, note: null }]),
))
const toEntries = (links: PublicContentDetail['downloads']): ContentRendererListEntry[] =>
  links.map(link => ({ key: link.key, label: link.label, meta: link.meta, note: null, href: link.href }))
const downloads = computed(() => toEntries(props.content.downloads))
const related = computed(() => toEntries(props.content.related))

const publishedDate = computed(() => (props.content.publishedAt
  ? new Date(props.content.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
  : ''))

useSeoHead({
  title: computed(() => props.content.seo.title),
  description: computed(() => props.content.seo.description),
  canonicalPath: computed(() => props.content.seo.canonicalPath),
  ogImage: computed(() => (props.content.seo.ogImageUrl ? `${siteUrl}${props.content.seo.ogImageUrl}` : undefined)),
  noIndex: computed(() => props.content.seo.noindex),
  ogType: 'article',
})
</script>

<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <Breadcrumb
          :items="[
            { label: 'Home', to: localePath('/') },
            { label: t('nav.resources'), to: localePath('/resources') },
            { label: sectionLabel, to: localePath('/resources') + '#latest' },
            { label: content.title },
          ]"
        />
        <p class="post-meta">
          {{ content.typeLabel }}<span v-if="publishedDate"> · {{ publishedDate }}</span>
        </p>
        <h1 class="page-hero__title">{{ content.title }}</h1>
        <p v-if="content.summary" class="page-hero__sub">{{ content.summary }}</p>
      </div>
    </section>

    <section class="section-gap">
      <div class="container post-layout">
        <figure v-if="content.hero" class="post-cover">
          <img :src="content.hero.url" :alt="content.hero.alt || content.title" class="post-cover__img" loading="eager">
          <figcaption v-if="content.hero.caption" class="post-cover__caption">{{ content.hero.caption }}</figcaption>
        </figure>
        <ContentBlocksRenderer :blocks="content.blocks" :images="images" :downloads="downloads" :relations="related" />
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
.page-hero { background: var(--color-primary); padding: var(--space-12) 0; color: var(--color-white); }
.page-hero__title {
  font-family: var(--font-display);
  font-size: clamp(var(--text-2xl), 3.5vw, var(--text-4xl));
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: var(--space-3) 0;
  overflow-wrap: anywhere;
}
.page-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 640px;
  line-height: var(--leading-normal);
  margin-top: var(--space-2);
  overflow-wrap: anywhere;
}
.post-meta { font-size: var(--text-sm); color: rgba(255,255,255,0.65); margin-bottom: var(--space-2); }
.section-gap { padding: var(--space-16) 0; }
.post-layout { max-width: 760px; min-width: 0; }
.post-cover { margin: 0 0 var(--space-8); border-radius: var(--radius-sm); overflow: hidden; }
.post-cover__img { width: 100%; height: auto; display: block; max-height: 420px; object-fit: cover; }
.post-cover__caption { font-size: var(--text-sm); color: var(--color-ink-muted); padding-top: var(--space-2); overflow-wrap: anywhere; }
</style>
