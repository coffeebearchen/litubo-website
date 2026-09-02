<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()
const slug = String(route.params.slug)

const { post, error, localized } = usePostDetail(slug)

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, fatal: true })
}

const title = computed(() => localized(post.value?.title) || 'Insight')
const excerpt = computed(() => localized(post.value?.excerpt))
const bodyHtml = computed(() => localized(post.value?.bodyHtml))
const seoTitle = computed(() => localized(post.value?.seo?.title) || `${title.value} | LITUBO`)
const seoDesc = computed(() => localized(post.value?.seo?.description) || excerpt.value)

useSeoHead({
  title: seoTitle,
  description: seoDesc,
  canonicalPath: computed(() => post.value?.seo?.canonicalPath ?? ''),
  ogImage: computed(() => post.value?.seo?.ogImage),
  noIndex: computed(() => post.value?.seo?.noIndex),
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
            { label: 'Insights', to: localePath('/resources') + '?content_type=insight' },
            { label: title },
          ]"
        />
        <p v-if="post?.publishDate" class="post-meta">
          {{ new Date(post.publishDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) }}
          <span v-if="post.author"> · {{ post.author }}</span>
        </p>
        <h1 class="page-hero__title">{{ title }}</h1>
        <p v-if="excerpt" class="page-hero__sub">{{ excerpt }}</p>
      </div>
    </section>

    <section v-if="post" class="section-gap">
      <div class="container post-layout">
        <div v-if="post.coverImageUrl" class="post-cover">
          <img :src="post.coverImageUrl" :alt="title" class="post-cover__img" loading="eager">
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="post-body rich-text" v-html="bodyHtml" />
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
}
.page-hero__sub {
  font-size: var(--text-lg);
  color: rgba(255,255,255,0.8);
  max-width: 640px;
  line-height: var(--leading-normal);
  margin-top: var(--space-2);
}
.post-meta { font-size: var(--text-sm); color: rgba(255,255,255,0.65); margin-bottom: var(--space-2); }

.section-gap { padding: var(--space-16) 0; }
.post-layout { max-width: 760px; }

.post-cover { margin-bottom: var(--space-8); border-radius: var(--radius-sm); overflow: hidden; }
.post-cover__img { width: 100%; height: auto; display: block; max-height: 420px; object-fit: cover; }

.post-body :deep(h2) {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-primary);
  margin: var(--space-8) 0 var(--space-4);
}
.post-body :deep(h3) {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-primary);
  margin: var(--space-6) 0 var(--space-3);
}
.post-body :deep(p) { font-size: var(--text-base); line-height: var(--leading-relaxed); margin-bottom: var(--space-4); color: var(--color-ink); }
.post-body :deep(ul),
.post-body :deep(ol) { padding-left: var(--space-6); margin-bottom: var(--space-4); }
.post-body :deep(li) { font-size: var(--text-base); line-height: var(--leading-relaxed); margin-bottom: var(--space-1); color: var(--color-ink); }
.post-body :deep(a) { color: var(--color-primary); text-decoration: underline; }
.post-body :deep(a:hover) { color: var(--color-accent); }
.post-body :deep(blockquote) {
  border-left: 3px solid var(--color-accent);
  padding: var(--space-3) var(--space-5);
  margin: var(--space-6) 0;
  background: var(--color-canvas);
  font-style: italic;
}
.post-body :deep(table) { width: 100%; border-collapse: collapse; margin-bottom: var(--space-6); overflow-x: auto; display: block; }
.post-body :deep(th),
.post-body :deep(td) { padding: var(--space-2) var(--space-3); border: 1px solid var(--color-line); font-size: var(--text-sm); text-align: left; }
.post-body :deep(th) { background: var(--color-canvas); font-weight: 600; color: var(--color-primary); }
.post-body :deep(code) { font-family: monospace; font-size: 0.9em; background: var(--color-canvas); padding: 0 var(--space-1); border-radius: 2px; }
.post-body :deep(pre) { background: var(--color-canvas); padding: var(--space-4); border-radius: var(--radius-sm); overflow-x: auto; margin-bottom: var(--space-4); }
.post-body :deep(img) { max-width: 100%; height: auto; border-radius: var(--radius-sm); margin: var(--space-4) 0; }
</style>
