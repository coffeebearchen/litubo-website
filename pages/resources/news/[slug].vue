<script setup lang="ts">
// CC-IMP-10 (D-004 / D-013 / D-035) — News is not public in Phase 1. Every News URL
// is 404, whatever exists in legacy posts or Content Center. No data is changed.
const { t } = useI18n()

useSeoHead({ title: t('seo.404.title'), description: '', canonicalPath: '', noIndex: true })

throw createError({ statusCode: 404, fatal: true })
</script>

<template>
  <div />
</template>
