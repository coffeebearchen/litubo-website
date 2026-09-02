<script setup lang="ts">
const { t } = useI18n()

useSeoHead({ title: t('seo.404.title'), description: '', canonicalPath: '', noIndex: true })

throw createError({ statusCode: 404, fatal: true })
</script>

<template>
  <div />
</template>
