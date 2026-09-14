<script setup lang="ts">
import { contentOverviewRoute } from '~/utils/contentCenter'

/** CC-IMP-02 — bare `/admin/content-center/:id` opens the record's Overview. */
definePageMeta({ layout: 'admin' })

const route = useRoute()
await navigateTo(contentOverviewRoute(String(route.params.id)), { replace: true })
</script>

<template>
  <div />
</template>
