<script setup lang="ts">
import type { PublicContentDetail } from '~/types/content-public'

// CC-IMP-10 (D-035) — Case Study public detail: Content Center only, exact locale
// and slug, published snapshot only. No legacy posts fallback.
const route = useRoute()
const { locale } = useI18n()
const slug = String(route.params.slug)

const { data, error } = await useAsyncData<PublicContentDetail>(
  `public-content-case_study-${locale.value}-${slug}`,
  () => $fetch<PublicContentDetail>(`/api/cms/content/case_study/${encodeURIComponent(slug)}`, { query: { locale: locale.value } }),
)

if (error.value || !data.value) {
  throw createError({ statusCode: error.value?.statusCode ?? 404, fatal: true })
}
</script>

<template>
  <PublicContentArticle v-if="data" :content="data" section-label="Case Studies" />
</template>
