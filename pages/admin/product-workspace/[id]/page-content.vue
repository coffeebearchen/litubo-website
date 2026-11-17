<script setup lang="ts">
/**
 * V2-02 — this path is a duplicate of the unified product editor's "Content" tab.
 *
 * The Workspace tool used to be a second place to edit the same record, which meant two UIs to keep
 * in sync for one model. It now forwards to /admin/products/:id/content. The file is kept rather than
 * deleted so an existing bookmark or a link from a saved note still lands somewhere useful.
 */
const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

await navigateTo(`/admin/products/${id.value}/content`, { redirectCode: 302, replace: true })
</script>

<template>
  <div class="ws-redirect">
    <p>Opening the Content tab of the product editor…</p>
    <NuxtLink :to="`/admin/products/${id}/content`">Continue to Content</NuxtLink>
  </div>
</template>

<style scoped>
.ws-redirect {
  padding: var(--space-8);
  font-size: 16px;
  color: #52665C;
}
.ws-redirect a { color: #2F6B3A; }
</style>
