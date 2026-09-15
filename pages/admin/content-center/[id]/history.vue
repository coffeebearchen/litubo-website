<script setup lang="ts">
import type { AdminContentHistory } from '~/types/content-center'
import ContentHistory from '~/components/admin/content/ContentHistory.vue'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
} from '~/utils/contentCenter'

/** CC-IMP-07 — CC-HIST Change History and lifecycle (Archive / Restore) for one content record. Admin only. */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const { data, pending, error, refresh } = await useFetch<AdminContentHistory>(
  `/api/admin/content-center/${encodeURIComponent(id)}/history`,
  { key: `content-center-history-${id}` },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))
const recordTitle = computed(() => data.value?.item.title || (data.value ? `Untitled content #${data.value.item.id}` : ''))

function syncState(value: AdminContentHistory) {
  data.value = value
}
</script>

<template>
  <div v-if="pending && !data && !error" class="cc-page-state" role="status">
    <p class="cc-page-state-hint">Loading content record…</p>
  </div>

  <div v-else-if="notFound" class="cc-page-state">
    <p class="cc-page-state-title">Content not found</p>
    <p class="cc-page-state-hint">No content record exists for ID “{{ id }}”.</p>
    <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-page-state-link">← Back to Content Center</NuxtLink>
  </div>

  <div v-else-if="error || !data" class="cc-page-state" role="alert">
    <p class="cc-page-state-title">This content record could not be loaded</p>
    <p class="cc-page-state-hint">{{ errorMessage ?? 'Content Center is temporarily unavailable. Try again in a moment.' }}</p>
    <div class="cc-page-state-actions">
      <button type="button" class="cc-page-state-retry" @click="refresh()">Retry</button>
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-page-state-link">← Back to Content Center</NuxtLink>
    </div>
  </div>

  <ContentWorkspaceShell
    v-else
    :record-title="recordTitle"
    page-title="Change history"
    subtitle="Track edits, publication and lifecycle events for this content."
    :status="data.item.status"
    :show-refresh="false"
  >
    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.item.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.item.content_type)"
        :status="data.item.status"
        active-key="history"
      />
    </template>

    <ContentHistory :initial="data" @state="syncState" />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-page-state { max-width: 520px; margin: var(--space-8) auto; padding: var(--space-6); text-align: center; }
.cc-page-state-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-page-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); overflow-wrap: anywhere; }
.cc-page-state-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--space-4); }
.cc-page-state-retry { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); cursor: pointer; }
.cc-page-state-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-page-state-link:hover { text-decoration: underline; }
</style>
