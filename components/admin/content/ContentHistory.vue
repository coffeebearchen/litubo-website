<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { AdminContentHistory, AdminContentLifecycleResult } from '~/types/content-center'
import {
  CONTENT_LOCALE_LABELS,
  CONTENT_STATUS_LABELS,
  formatContentDateTime,
} from '~/utils/contentCenter'
import {
  ARCHIVE_CONFIRMATION,
  HISTORY_CATEGORY_TONE,
  RESTORE_CONFIRMATION,
  historyEventDetail,
  interpretLifecycleError,
  lifecycleOutcomeMessage,
  type LifecycleConfirmation,
} from '~/utils/contentHistory'

/**
 * CC-IMP-07 — CC-HIST Change History (PW-VIS-09-CHANGE-HISTORY-D1440 pattern) with the item's
 * lifecycle panel. The trail is read-only (no rollback, revert or delete). Archive and Restore
 * each open a confirmation and send one request with the lifecycle fingerprint shown here.
 */
const props = defineProps<{ initial: AdminContentHistory }>()
const emit = defineEmits<{ state: [value: AdminContentHistory] }>()

const history = ref<AdminContentHistory>(props.initial)
const busy = ref<'page' | 'lifecycle' | null>(null)
const notice = ref<{ tone: 'success' | 'warning' | 'error', message: string, reload: boolean } | null>(null)
const dialog = ref<LifecycleConfirmation | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)

const apiBase = computed(() => `/api/admin/content-center/${encodeURIComponent(String(history.value.item.id))}`)
const lifecycle = computed(() => history.value.lifecycle)

function setHistory(value: AdminContentHistory) {
  history.value = value
  emit('state', value)
}

async function loadPage(page: number) {
  busy.value = 'page'
  try {
    setHistory(await $fetch<AdminContentHistory>(`${apiBase.value}/history`, { query: { page } }))
  } catch (err) {
    notice.value = { tone: 'error', message: interpretLifecycleError(err).message, reload: false }
  } finally {
    busy.value = null
  }
}

async function reload() {
  notice.value = null
  await loadPage(1)
}

async function openDialog(kind: 'archive' | 'restore') {
  if (busy.value) return
  dialog.value = kind === 'archive' ? ARCHIVE_CONFIRMATION : RESTORE_CONFIRMATION
  await nextTick()
  cancelButton.value?.focus()
}

async function confirmDialog() {
  const current = dialog.value
  if (!current) return
  dialog.value = null
  busy.value = 'lifecycle'
  try {
    const res = await $fetch<AdminContentLifecycleResult>(`${apiBase.value}/${current.kind}`, {
      method: 'POST',
      body: { expectedLifecycleFingerprint: lifecycle.value.lifecycleFingerprint },
    })
    notice.value = { tone: 'success', message: lifecycleOutcomeMessage(res.result), reload: false }
    busy.value = null
    await loadPage(1)
  } catch (err) {
    const view = interpretLifecycleError(err)
    notice.value = { tone: view.kind === 'partial' ? 'warning' : 'error', message: view.message, reload: view.kind === 'conflict' || view.kind === 'partial' }
  } finally {
    busy.value = null
  }
}

function onDialogKey(event: KeyboardEvent) {
  if (event.key === 'Escape') dialog.value = null
}

const hasPrevious = computed(() => history.value.page > 1)
const hasNext = computed(() => history.value.page < history.value.pages)
</script>

<template>
  <div class="chi">
    <div v-if="notice" class="chi-notice" :class="`chi-notice--${notice.tone}`" :role="notice.tone === 'success' ? 'status' : 'alert'">
      <span>{{ notice.message }}</span>
      <button v-if="notice.reload" type="button" class="chi-btn" @click="reload()">Reload</button>
    </div>

    <div class="chi-grid">
      <section class="chi-card" aria-labelledby="chi-trail-title">
        <div class="chi-card-head">
          <h2 id="chi-trail-title" class="chi-card-title">Content audit trail</h2>
          <p class="chi-card-hint">Newest first · {{ history.total }} {{ history.total === 1 ? 'event' : 'events' }}</p>
        </div>

        <p v-if="history.events.length === 0" class="chi-empty">No history yet.</p>

        <ol v-else class="chi-events" role="list">
          <li v-for="event in history.events" :key="event.id" class="chi-event" :class="`chi-event--${HISTORY_CATEGORY_TONE[event.category]}`">
            <span class="chi-time">{{ formatContentDateTime(event.timestamp) }}</span>
            <span class="chi-dot" aria-hidden="true" />
            <div class="chi-event-body">
              <div class="chi-event-top">
                <span class="chi-category">{{ event.category }}</span>
                <span class="chi-label">{{ event.label }}</span>
              </div>
              <p v-if="historyEventDetail(event)" class="chi-detail">{{ historyEventDetail(event) }}</p>
              <p class="chi-actor">By {{ event.actor }}</p>
            </div>
          </li>
        </ol>

        <nav v-if="history.pages > 1" class="chi-pager" aria-label="History pages">
          <button type="button" class="chi-btn" :disabled="!hasPrevious || busy !== null" @click="loadPage(history.page - 1)">Previous</button>
          <span class="chi-page">Page {{ history.page }} of {{ history.pages }}</span>
          <button type="button" class="chi-btn" :disabled="!hasNext || busy !== null" @click="loadPage(history.page + 1)">Next</button>
        </nav>
      </section>

      <aside class="chi-side" aria-label="Lifecycle">
        <section class="chi-card" aria-labelledby="chi-lifecycle-title">
          <h2 id="chi-lifecycle-title" class="chi-card-title">Lifecycle</h2>
          <dl class="chi-rows">
            <div class="chi-row"><dt>Status</dt><dd>{{ CONTENT_STATUS_LABELS[lifecycle.status] }}</dd></div>
            <div class="chi-row"><dt>First published</dt><dd>{{ lifecycle.first_published_at ? formatContentDateTime(lifecycle.first_published_at) : 'Never' }}</dd></div>
            <div class="chi-row">
              <dt>Published languages</dt>
              <dd>{{ lifecycle.published_locales.length ? lifecycle.published_locales.map(l => CONTENT_LOCALE_LABELS[l]).join(', ') : 'None' }}</dd>
            </div>
            <div v-if="lifecycle.archived_at" class="chi-row"><dt>Archived</dt><dd>{{ formatContentDateTime(lifecycle.archived_at) }}</dd></div>
          </dl>

          <template v-if="lifecycle.can_restore">
            <p class="chi-card-hint">Archived content is read-only and not eligible for public delivery.</p>
            <button type="button" class="chi-primary" :disabled="busy !== null" @click="openDialog('restore')">
              {{ busy === 'lifecycle' ? 'Restoring…' : 'Restore to draft' }}
            </button>
            <p class="chi-card-hint">Restoring does not publish the content.</p>
          </template>
          <template v-else-if="lifecycle.can_archive">
            <button type="button" class="chi-archive" :disabled="busy !== null" @click="openDialog('archive')">
              {{ busy === 'lifecycle' ? 'Archiving…' : 'Archive content' }}
            </button>
            <p class="chi-card-hint">Archiving keeps the draft, media, relations and history. Nothing is deleted.</p>
          </template>
        </section>

        <section class="chi-card" aria-labelledby="chi-records-title">
          <h2 id="chi-records-title" class="chi-card-title">Audit records</h2>
          <p class="chi-card-hint">Entries come from Directus revisions and cannot be edited or rolled back here.</p>
          <ul class="chi-limits" role="list">
            <li v-for="line in history.limitations" :key="line">{{ line }}</li>
          </ul>
        </section>
      </aside>
    </div>

    <div v-if="dialog" class="chi-overlay" @keydown="onDialogKey">
      <div class="chi-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chi-dialog-title" aria-describedby="chi-dialog-text">
        <h2 id="chi-dialog-title" class="chi-dialog-title">{{ dialog.title }}</h2>
        <div id="chi-dialog-text" class="chi-dialog-text">
          <p v-for="line in dialog.lines" :key="line">{{ line }}</p>
        </div>
        <div class="chi-dialog-actions">
          <button ref="cancelButton" type="button" class="chi-btn" @click="dialog = null">Cancel</button>
          <button type="button" :class="dialog.kind === 'archive' ? 'chi-archive' : 'chi-primary'" @click="confirmDialog()">{{ dialog.confirmLabel }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chi { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.chi-notice { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); }
.chi-notice--success { background: #D1F0E8; color: #0F5C4B; }
.chi-notice--warning { background: #FFF4E0; color: #7A4400; }
.chi-notice--error { background: #FDECEC; color: #9B1C1C; }

.chi-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-4); align-items: start; }
.chi-side { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.chi-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); min-width: 0; }
.chi-card-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
.chi-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.chi-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-2) 0; line-height: 1.5; }
.chi-empty { font-size: var(--text-sm); color: var(--color-ink-muted); padding: var(--space-6) 0; text-align: center; margin: 0; }

.chi-events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.chi-event { display: grid; grid-template-columns: 150px 16px minmax(0, 1fr); gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--color-line); align-items: start; }
.chi-event:last-child { border-bottom: none; }
.chi-time { font-size: var(--text-xs); color: var(--color-ink-muted); padding-top: 2px; }
.chi-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; background: #9AA7A2; }
.chi-event--lifecycle .chi-dot { background: #B7791F; }
.chi-event--publication .chi-dot { background: var(--color-primary); }
.chi-event-body { min-width: 0; }
.chi-event-top { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.chi-category { font-size: 0.6875rem; font-weight: 600; border-radius: var(--radius-sm); padding: 1px var(--space-2); background: var(--color-surface-alt); color: var(--color-ink-muted); border: 1px solid var(--color-line); }
.chi-event--lifecycle .chi-category { background: #FFF4E0; color: #7A4400; border-color: #F0D9B5; }
.chi-event--publication .chi-category { background: #D1F0E8; color: #0F5C4B; border-color: #B5E3D6; }
.chi-label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.chi-detail { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-1) 0 0; overflow-wrap: anywhere; }
.chi-actor { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-1) 0 0; overflow-wrap: anywhere; }

.chi-pager { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-4); }
.chi-page { font-size: var(--text-xs); color: var(--color-ink-muted); }

.chi-rows { margin: 0 0 var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
.chi-row { display: flex; justify-content: space-between; gap: var(--space-3); min-width: 0; }
.chi-row dt { font-size: var(--text-xs); color: var(--color-ink-muted); }
.chi-row dd { font-size: var(--text-xs); color: var(--color-ink); margin: 0; text-align: right; overflow-wrap: anywhere; }
.chi-limits { margin: 0; padding-left: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-ink-muted); line-height: 1.5; }

.chi-btn { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font-family: inherit; cursor: pointer; padding: var(--space-2) var(--space-4); }
.chi-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.chi-primary { width: 100%; min-height: 44px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 600; font-family: inherit; cursor: pointer; padding: var(--space-2) var(--space-4); }
.chi-archive { width: 100%; min-height: 44px; border: 1px solid #C98A2B; border-radius: var(--radius-sm); background: #FFF6E8; color: #6B4300; font-weight: 600; font-family: inherit; cursor: pointer; padding: var(--space-2) var(--space-4); }
.chi-primary:disabled, .chi-archive:disabled { opacity: 0.5; cursor: not-allowed; }

.chi-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.5); display: flex; align-items: flex-end; justify-content: center; padding: var(--space-4); }
.chi-dialog { width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; background: var(--color-surface); border-radius: var(--radius-md); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); padding: var(--space-5); box-sizing: border-box; }
.chi-dialog-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); margin: 0 0 var(--space-3); }
.chi-dialog-text p { font-size: var(--text-sm); color: var(--color-ink); margin: 0 0 var(--space-2); line-height: 1.5; }
.chi-dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-4); }
.chi-dialog-actions .chi-primary, .chi-dialog-actions .chi-archive { width: auto; }

@media (min-width: 768px) { .chi-overlay { align-items: center; } }

@media (max-width: 1279px) {
  .chi-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .chi-card { padding: var(--space-4); }
  .chi-event { grid-template-columns: 12px minmax(0, 1fr); }
  .chi-time { grid-column: 2; grid-row: 2; }
  .chi-dot { grid-column: 1; grid-row: 1; }
  .chi-event-body { grid-column: 2; grid-row: 1; }
  .chi-dialog-actions { flex-direction: column-reverse; }
  .chi-dialog-actions > * { width: 100%; }
}
</style>
