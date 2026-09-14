<script setup lang="ts">
import type { AdminContentDraft, AdminContentDraftDetail } from '~/types/content-center'
import ContentEditor from '~/components/admin/content/ContentEditor.vue'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
  primaryContentLocale,
} from '~/utils/contentCenter'
import { EDITOR_LEAVE_MESSAGE } from '~/utils/contentEditor'

/** CC-IMP-03 — CC-02 Content Editor for the default-locale working copy. */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const { data, pending, error, refresh } = await useFetch<AdminContentDraftDetail>(
  `/api/admin/content-center/${encodeURIComponent(id)}`,
  { key: `content-center-editor-${id}` },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))

const recordTitle = computed(() => {
  const draft = data.value
  if (!draft) return ''
  return primaryContentLocale(draft.locales)?.title || `Untitled content #${draft.id}`
})

const editorRef = ref<InstanceType<typeof ContentEditor> | null>(null)
const status = ref({ dirty: false, saving: false, justSaved: false, conflict: false, revision: 0 })

const statusLabel = computed(() => {
  if (status.value.saving) return 'Saving…'
  if (status.value.conflict) return 'Not saved'
  if (status.value.justSaved) return 'Saved'
  return status.value.dirty ? 'Unsaved changes' : 'All changes saved'
})

/** Keeps the shell identity (title, status) in step with the saved or reloaded draft. */
function syncShell(draft: AdminContentDraft) {
  if (data.value) data.value = { ...draft, linkCounts: data.value.linkCounts }
}

onBeforeRouteLeave(() => {
  if (status.value.dirty && !window.confirm(EDITOR_LEAVE_MESSAGE)) return false
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
    page-title="Content editor"
    subtitle="Edit core content and structure for this page."
    :status="data.status"
    :show-refresh="false"
  >
    <template #actions>
      <div class="cc-editor-actions">
        <span class="cc-editor-status" aria-live="polite">{{ statusLabel }}</span>
        <button
          type="button"
          class="cc-editor-save"
          :disabled="!status.dirty || status.saving"
          @click="editorRef?.save()"
        >{{ status.saving ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </template>

    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.content_type)"
        :status="data.status"
        active-key="editor"
      />
    </template>

    <ContentEditor
      ref="editorRef"
      :draft="data"
      @status="status = $event"
      @saved="syncShell"
      @reloaded="syncShell"
    />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-editor-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cc-editor-status { font-size: var(--text-sm); color: var(--color-ink-muted); white-space: nowrap; }

.cc-editor-save {
  min-height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.cc-editor-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.cc-editor-save:disabled { opacity: 0.55; cursor: not-allowed; }

.cc-page-state {
  max-width: 520px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  text-align: center;
}

.cc-page-state-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-page-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); overflow-wrap: anywhere; }
.cc-page-state-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--space-4); }

.cc-page-state-retry {
  min-height: 40px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cc-page-state-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-page-state-link:hover { text-decoration: underline; }

@media (max-width: 767px) {
  .cc-editor-actions { flex: 1 1 100%; justify-content: space-between; }
  .cc-editor-save { flex: 1 1 auto; }
}
</style>
