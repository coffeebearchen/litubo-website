<script setup lang="ts">
import type { PublicContentDetail } from '~/types/content-public'

// CC-IMP-10 (D-035) — Technical Article public detail: Content Center only, exact
// locale and slug, published snapshot only. No legacy posts fallback.
const route = useRoute()
const { locale } = useI18n()
const slug = String(route.params.slug)

const { data, error } = await useAsyncData<PublicContentDetail>(
  `public-content-technical_article-${locale.value}-${slug}`,
  () => $fetch<PublicContentDetail>(`/api/cms/content/technical_article/${encodeURIComponent(slug)}`, { query: { locale: locale.value } }),
)

if (error.value || !data.value) {
  throw createError({ statusCode: error.value?.statusCode ?? 404, fatal: true })
}
</script>

<template>
  <PublicContentArticle v-if="data" :content="data" section-label="Insights" />
</template>
