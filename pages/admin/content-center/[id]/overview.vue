<script setup lang="ts">
import type { AdminContentDraftDetail } from '~/types/content-center'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
  primaryContentLocale,
} from '~/utils/contentCenter'

/** CC-IMP-02 — CC-01 Workspace Overview of one content record (read-only). */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const { data, pending, error, refresh } = await useFetch<AdminContentDraftDetail>(
  `/api/admin/content-center/${encodeURIComponent(id)}`,
  { key: `content-center-overview-${id}` },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
// 400 (not a valid id) and 404 both mean there is no such record.
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))

const recordTitle = computed(() => {
  const draft = data.value
  if (!draft) return ''
  return primaryContentLocale(draft.locales)?.title || `Untitled content #${draft.id}`
})
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
    page-title="Overview"
    subtitle="Review all information for this content record in one place."
    :status="data.status"
    :refreshing="pending"
    @refresh="refresh()"
  >
    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.content_type)"
        :status="data.status"
        active-key="overview"
      />
    </template>

    <ContentOverview :draft="data" />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-page-state {
  max-width: 520px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  text-align: center;
}

.cc-page-state-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-2);
}

.cc-page-state-hint {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
  overflow-wrap: anywhere;
}

.cc-page-state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.cc-page-state-retry {
  min-height: 40px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cc-page-state-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

.cc-page-state-link:hover { text-decoration: underline; }
</style>
