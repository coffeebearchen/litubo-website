<script setup lang="ts">
/**
 * /support/send-product-test — the product-test request.
 *
 * Layout and behaviour live in SupportRequestPage; this file only selects the mode, so the three
 * support requests cannot drift apart.
 */
const { t } = useI18n()

useSeoHead({
  title: 'Send Product Test — LITUBO',
  description: 'Submit a product test request to the LITUBO support team.',
  canonicalPath: '/support/send-product-test',
})
</script>

<template>
  <SupportRequestPage mode="product-test" page-key="support.send-product-test" />
</template>
