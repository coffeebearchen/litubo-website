<script setup lang="ts">
const { t } = useI18n()

useHead({
  title: t('seo.404.title'),
  meta: [{ name: 'robots', content: 'noindex' }],
})

throw createError({ statusCode: 404, fatal: true })
</script>

<template>
  <div />
</template>
