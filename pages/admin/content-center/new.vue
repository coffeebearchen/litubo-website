<script setup lang="ts">
import { CONTENT_CENTER_LIST_ROUTE, contentOverviewRoute } from '~/utils/contentCenter'

/** CC-IMP-02 — Create Draft (static route; takes precedence over `[id]`). */
definePageMeta({ layout: 'admin' })

async function openCreated(id: number) {
  await navigateTo(contentOverviewRoute(id))
}
</script>

<template>
  <div class="page cc-new-page">
    <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-back">← Content Center</NuxtLink>
    <h1 class="page-title">New content</h1>
    <p class="cc-intro">Start a draft. You can open its workspace as soon as it is created.</p>

    <div class="cc-card">
      <ContentCreateForm @created="openCreated" />
    </div>
  </div>
</template>

<style scoped>
.cc-new-page { max-width: 760px; }

.cc-back {
  display: inline-block;
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
  margin-bottom: var(--space-3);
}

.cc-back:hover { text-decoration: underline; }

.cc-intro {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 var(--space-5);
}

.cc-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-8);
}

@media (max-width: 767px) {
  .cc-card { padding: var(--space-4); }
}
</style>
