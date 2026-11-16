<script setup lang="ts">
/**
 * /support/request-spare-parts — the spare-parts request.
 *
 * Layout and behaviour live in SupportRequestPage; this file only selects the mode, so the three
 * support requests cannot drift apart.
 */
const { t } = useI18n()

useSeoHead({
  title: 'Request Spare Parts — LITUBO',
  description: 'Submit a spare parts request to the LITUBO support team.',
  canonicalPath: '/support/request-spare-parts',
})
</script>

<template>
  <SupportRequestPage mode="spare-parts" />
</template>
