<script setup lang="ts">
// PUBLIC-CLAIMS-CLEANUP-01 (D-036, D-014, D-020) — per-industry Application pages stay closed until real,
// confirmed content exists. The DEMO fixtures are kept for development and tests but are never served as public
// content, so every Application detail URL is 404 with no indexable placeholder metadata. No data is changed.
const { t } = useI18n()

useSeoHead({ title: t('seo.404.title'), description: '', canonicalPath: '', noIndex: true })

throw createError({ statusCode: 404, fatal: true })
</script>

<template>
  <div />
</template>
