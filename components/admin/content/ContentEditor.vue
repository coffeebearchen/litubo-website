<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { AdminContentDraft } from '~/types/content-center'
import { MAX_BLOCKS_PER_LOCALE } from '~/utils/contentBlocks'
import { DEFAULT_CONTENT_LOCALE, type ContentLocale } from '~/utils/contentLocales'
import { CONTENT_BLOCK_LABELS, CONTENT_LOCALE_LABELS, contentTypeLabel, formatContentDateTime } from '~/utils/contentCenter'
import {
  EDITOR_BLOCK_LIMIT_MESSAGE,
  EDITOR_CONFLICT_MESSAGE,
  type ContentEditorState,
  type EditorBlockType,
  type EditorSaveError,
  buildEditorSaveBody,
  cloneEditorState,
  contentLocaleSaveUrl,
  editorAddableBlockTypes,
  editorLimitProblem,
  editorOutline,
  editorStateFromLocale,
  interpretEditorSaveError,
  isEditorDirty,
  moveListEntry,
  newEditorBlock,
  removeListEntry,
} from '~/utils/contentEditor'
import ContentBlockEditor from './ContentBlockEditor.vue'
import ContentEditorOutline from './ContentEditorOutline.vue'

/**
 * CC-IMP-03 — CC-02 Content Editor (CC-VIS-02-CONTENT-EDITOR-D1440).
 *
 * Server draft → local working copy → one explicit Save. A save sends one PATCH
 * with `expectedDraftRevision` and only the changed fields; the database revision
 * guard decides. A 409 never replaces the local edits: the user chooses to keep
 * editing or, after an explicit confirmation, reload the latest saved version.
 */
const props = withDefaults(defineProps<{
  draft: AdminContentDraft
  locale?: ContentLocale
  newId?: () => string
}>(), {
  locale: DEFAULT_CONTENT_LOCALE,
  newId: () => globalThis.crypto.randomUUID(),
})

const emit = defineEmits<{
  saved: [draft: AdminContentDraft]
  reloaded: [draft: AdminContentDraft]
  status: [status: { dirty: boolean, saving: boolean, justSaved: boolean, conflict: boolean, revision: number }]
}>()

const current = ref<AdminContentDraft>(props.draft)
const original = ref<ContentEditorState | null>(null)
const state = ref<ContentEditorState | null>(null)
const revision = ref(0)

function initialize(draft: AdminContentDraft) {
  current.value = draft
  const row = draft.locales.find(l => l.locale === props.locale) ?? null
  original.value = row ? editorStateFromLocale(row) : null
  state.value = original.value ? cloneEditorState(original.value) : null
  revision.value = row?.draft_revision ?? 0
}

initialize(props.draft)

const saving = ref(false)
const reloading = ref(false)
const justSaved = ref(false)
const error = ref<EditorSaveError | null>(null)
const conflict = ref(false)
const confirmReload = ref(false)
const addOpen = ref(false)
const pendingRemove = ref<string | null>(null)
const expanded = reactive<Record<string, boolean>>({})
let savedTimer: ReturnType<typeof setTimeout> | undefined

const localeLabel = computed(() => CONTENT_LOCALE_LABELS[props.locale])
const typeLabel = computed(() => contentTypeLabel(current.value.content_type))
const archived = computed(() => current.value.status === 'archived')
const locked = computed(() => saving.value || reloading.value || archived.value)
const dirty = computed(() => Boolean(original.value && state.value && isEditorDirty(original.value, state.value)))
const canSave = computed(() => dirty.value && !locked.value)
const addable = computed(() => editorAddableBlockTypes(current.value.content_type))
const atLimit = computed(() => (state.value?.blocks.length ?? 0) >= MAX_BLOCKS_PER_LOCALE)
const outline = computed(() => editorOutline(state.value?.blocks ?? []))
const lastUpdated = computed(() => formatContentDateTime(current.value.date_updated ?? current.value.date_created))
const fieldError = computed(() => (error.value?.kind === 'field' ? error.value : null))
const generalError = computed(() => (error.value && !['conflict', 'field'].includes(error.value.kind) ? error.value : null))

const statusLabel = computed(() => {
  if (saving.value) return 'Saving…'
  if (conflict.value) return 'Not saved — the draft changed'
  if (error.value && dirty.value) return 'Not saved'
  if (justSaved.value) return 'Saved'
  return dirty.value ? 'Unsaved changes' : 'All changes saved'
})

watch([dirty, saving, justSaved, conflict, revision], () => {
  emit('status', { dirty: dirty.value, saving: saving.value, justSaved: justSaved.value, conflict: conflict.value, revision: revision.value })
}, { immediate: true })

watch(dirty, (value: boolean) => {
  if (value) justSaved.value = false
})

function blockErrorsAt(index: number): string[] {
  return error.value?.blockErrors[index] ?? []
}

async function focusBlock(id: string) {
  const block = state.value?.blocks.find(b => b.id === id)
  if (!block) return
  if (block.type !== 'image' && block.type !== 'related_content' && block.type !== 'downloads') expanded[id] = true
  await nextTick()
  const el = document.getElementById(`ccb-${id}`)
  el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  el?.focus?.({ preventScroll: true })
}

function addBlock(type: EditorBlockType) {
  if (!state.value || atLimit.value) return
  const block = newEditorBlock(type, props.newId)
  state.value.blocks.push(block)
  addOpen.value = false
  void focusBlock(block.id)
}

/** Applies a section's change to the latest state, by block id, so consecutive edits compose. */
function updateBlock(id: string, updater: (data: Record<string, unknown>) => Record<string, unknown>) {
  if (!state.value) return
  const index = state.value.blocks.findIndex(b => b.id === id)
  if (index < 0) return
  const block = state.value.blocks[index]
  state.value.blocks.splice(index, 1, { ...block, data: updater(block.data ?? {}) })
}

function moveBlock(index: number, delta: number) {
  if (state.value) state.value.blocks = moveListEntry(state.value.blocks, index, delta)
}

function confirmRemove(index: number) {
  if (state.value) state.value.blocks = removeListEntry(state.value.blocks, index)
  pendingRemove.value = null
}

async function save() {
  if (!canSave.value || !state.value || !original.value) return
  const body = buildEditorSaveBody(original.value, state.value, revision.value)
  if (!body) return
  const limitProblem = body.blocks ? editorLimitProblem(body.blocks) : null
  if (limitProblem) {
    error.value = { kind: 'too_large', status: 0, message: limitProblem, field: null, blockErrors: {}, currentDraftRevision: null }
    return
  }

  saving.value = true
  error.value = null
  try {
    const saved = await $fetch<AdminContentDraft>(contentLocaleSaveUrl(current.value.id, props.locale), {
      method: 'PATCH',
      body,
    })
    initialize(saved)
    conflict.value = false
    confirmReload.value = false
    justSaved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { justSaved.value = false }, 3000)
    emit('saved', saved)
  } catch (err: unknown) {
    const view = interpretEditorSaveError(err)
    error.value = view
    conflict.value = view.kind === 'conflict'
    for (const index of Object.keys(view.blockErrors)) {
      const block = state.value?.blocks[Number(index)]
      if (block) expanded[block.id] = true
    }
  } finally {
    saving.value = false
  }
}

async function reloadLatest() {
  reloading.value = true
  try {
    const latest = await $fetch<AdminContentDraft>(`/api/admin/content-center/${current.value.id}`)
    initialize(latest)
    conflict.value = false
    confirmReload.value = false
    error.value = null
    emit('reloaded', latest)
  } catch (err: unknown) {
    error.value = interpretEditorSaveError(err)
  } finally {
    reloading.value = false
  }
}

function keepEditing() {
  conflict.value = false
  confirmReload.value = false
  error.value = null
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  clearTimeout(savedTimer)
})

defineExpose({ save, dirty, canSave, saving })
</script>

<template>
  <div class="cce">
    <p v-if="!state" class="cce-notice" role="status">
      No {{ localeLabel }} draft exists for this content record. Language drafts are managed in SEO &amp; locales, which is not built yet.
    </p>

    <template v-else>
      <div v-if="conflict" class="cce-conflict" role="alert">
        <p class="cce-conflict-title">{{ EDITOR_CONFLICT_MESSAGE }}</p>
        <p class="cce-conflict-text">
          A newer version was saved<template v-if="error?.currentDraftRevision"> (revision {{ error.currentDraftRevision }})</template>.
          Your edits below were not saved and are still here. Copy anything you need before reloading.
        </p>
        <div v-if="!confirmReload" class="cce-actions">
          <button type="button" class="cce-btn" @click="keepEditing">Keep editing</button>
          <button type="button" class="cce-btn cce-btn--warn" @click="confirmReload = true">Reload latest</button>
        </div>
        <div v-else class="cce-actions">
          <p class="cce-conflict-warn">Reloading discards your unsaved changes and shows the latest saved draft.</p>
          <button type="button" class="cce-btn cce-btn--warn" :disabled="reloading" @click="reloadLatest">
            {{ reloading ? 'Reloading…' : 'Discard my changes and reload' }}
          </button>
          <button type="button" class="cce-btn" :disabled="reloading" @click="confirmReload = false">Cancel</button>
        </div>
      </div>

      <div v-else-if="generalError" class="cce-error" role="alert">
        <p>{{ generalError.message }}</p>
        <a v-if="generalError.kind === 'session'" href="/admin/login" target="_blank" rel="noopener" class="cce-error-link">Sign in (new tab)</a>
      </div>

      <p v-if="archived" class="cce-notice" role="status">This content record is archived and cannot be edited.</p>

      <div class="cce-grid">
        <fieldset class="cce-main" :disabled="locked">
          <legend class="cce-sr-only">Draft content</legend>

          <section class="cce-card" aria-labelledby="cce-basic-title">
            <h2 id="cce-basic-title" class="cce-card-title">Basic information</h2>
            <p class="cce-card-hint">{{ localeLabel }} draft · revision {{ revision }}</p>

            <div class="cce-basic">
              <div class="cce-field">
                <label for="cce-title">Title <span class="cce-req" aria-hidden="true">*</span></label>
                <input
                  id="cce-title"
                  v-model="state.title"
                  type="text"
                  maxlength="160"
                  autocomplete="off"
                  :aria-invalid="fieldError?.field === 'title'"
                  :aria-describedby="fieldError?.field === 'title' ? 'cce-title-error' : undefined"
                >
                <div class="cce-field-meta">
                  <p v-if="fieldError?.field === 'title'" id="cce-title-error" class="cce-field-error">{{ fieldError.message }}</p>
                  <span class="cce-count">{{ state.title.length }} / 160</span>
                </div>
              </div>

              <div class="cce-field">
                <span id="cce-type-label" class="cce-label">Content type</span>
                <p class="cce-readonly" aria-labelledby="cce-type-label">{{ typeLabel }}</p>
                <p class="cce-hint">Set when the record was created and cannot be changed.</p>
              </div>

              <div class="cce-field">
                <label for="cce-slug">Slug <span class="cce-req" aria-hidden="true">*</span></label>
                <input
                  id="cce-slug"
                  v-model="state.slug"
                  type="text"
                  maxlength="100"
                  autocomplete="off"
                  spellcheck="false"
                  :aria-invalid="fieldError?.field === 'slug'"
                  :aria-describedby="fieldError?.field === 'slug' ? 'cce-slug-error' : 'cce-slug-hint'"
                >
                <div class="cce-field-meta">
                  <p v-if="fieldError?.field === 'slug'" id="cce-slug-error" class="cce-field-error">{{ fieldError.message }}</p>
                  <p v-else id="cce-slug-hint" class="cce-hint">Lowercase letters, numbers and hyphens. Unique for {{ localeLabel }}.</p>
                  <span class="cce-count">{{ state.slug.length }} / 100</span>
                </div>
              </div>

              <div class="cce-field">
                <label for="cce-summary">Summary</label>
                <textarea
                  id="cce-summary"
                  v-model="state.summary"
                  rows="4"
                  maxlength="400"
                  :aria-invalid="fieldError?.field === 'summary'"
                  :aria-describedby="fieldError?.field === 'summary' ? 'cce-summary-error' : undefined"
                />
                <div class="cce-field-meta">
                  <p v-if="fieldError?.field === 'summary'" id="cce-summary-error" class="cce-field-error">{{ fieldError.message }}</p>
                  <span class="cce-count">{{ state.summary.length }} / 400</span>
                </div>
              </div>
            </div>
          </section>

          <section class="cce-card cce-card--quiet" aria-labelledby="cce-hero-title">
            <h2 id="cce-hero-title" class="cce-card-title">Hero image</h2>
            <p class="cce-hint">Chosen in Media &amp; relations, which is not built yet. The hero is part of the page header, not a content section.</p>
          </section>

          <section class="cce-sections" aria-labelledby="cce-sections-title">
            <div class="cce-sections-head">
              <div>
                <h2 id="cce-sections-title" class="cce-card-title">Content sections</h2>
                <p class="cce-card-hint">{{ state.blocks.length }} of {{ MAX_BLOCKS_PER_LOCALE }} sections · all changes are saved together</p>
              </div>
              <button
                type="button"
                class="cce-add"
                :aria-expanded="addOpen"
                aria-controls="cce-add-menu"
                :disabled="atLimit"
                @click="addOpen = !addOpen"
              >+ Add section</button>
            </div>

            <p v-if="atLimit" class="cce-hint">{{ EDITOR_BLOCK_LIMIT_MESSAGE }}</p>

            <div v-if="addOpen && !atLimit" id="cce-add-menu" class="cce-add-menu" role="group" aria-label="Choose a section type">
              <button
                v-for="type in addable.addable"
                :key="type"
                type="button"
                class="cce-add-option"
                @click="addBlock(type)"
              >{{ CONTENT_BLOCK_LABELS[type] }}</button>
              <button
                v-for="type in addable.managedElsewhere"
                :key="type"
                type="button"
                class="cce-add-option"
                disabled
              >
                {{ CONTENT_BLOCK_LABELS[type] }}
                <span class="cce-add-note">Available in Media &amp; relations</span>
              </button>
            </div>

            <p v-if="state.blocks.length === 0" class="cce-empty">No sections yet. Add a section to start writing.</p>

            <ContentBlockEditor
              v-for="(block, index) in state.blocks"
              :key="block.id"
              :block="block"
              :position="index + 1"
              :total="state.blocks.length"
              :expanded="Boolean(expanded[block.id])"
              :errors="blockErrorsAt(index)"
              :confirming-remove="pendingRemove === block.id"
              :disabled="locked"
              @update="updateBlock(block.id, $event)"
              @move="moveBlock(index, $event)"
              @toggle="expanded[block.id] = !expanded[block.id]"
              @request-remove="pendingRemove = block.id"
              @confirm-remove="confirmRemove(index)"
              @cancel-remove="pendingRemove = null"
            />
          </section>
        </fieldset>

        <ContentEditorOutline
          class="cce-aside"
          :items="outline"
          :locale-label="localeLabel"
          :revision="revision"
          :last-updated="lastUpdated"
          :max-sections="MAX_BLOCKS_PER_LOCALE"
          @select="focusBlock"
        />
      </div>

      <div v-if="dirty || saving || conflict || justSaved" class="cce-savebar" role="region" aria-label="Save changes">
        <span class="cce-savebar-status" aria-live="polite">{{ statusLabel }}</span>
        <button type="button" class="cce-save" :disabled="!canSave" @click="save">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cce { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.cce-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-4);
  align-items: start;
}

.cce-main {
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cce-aside { position: sticky; top: var(--space-4); }

.cce-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  min-width: 0;
}

.cce-card--quiet { background: var(--color-surface-alt); padding: var(--space-4) var(--space-5); }

.cce-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.cce-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-4); }

.cce-basic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.cce-field { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cce-field label, .cce-label { color: var(--color-ink); font-size: var(--admin-label-size, var(--text-sm)); font-weight: 600; }
.cce-req { color: #C0392B; }

.cce-field input,
.cce-field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
}

.cce-field input:focus,
.cce-field textarea:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.cce-field [aria-invalid="true"] { border-color: #C0392B; }

.cce-field-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
.cce-count { font-size: 0.75rem; color: var(--color-ink-muted); margin-left: auto; white-space: nowrap; }
.cce-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
.cce-field-error { font-size: var(--text-xs); color: #C0392B; margin: 0; overflow-wrap: anywhere; }

.cce-readonly {
  margin: 0;
  min-height: var(--admin-input-h, 40px);
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  border: 1px dashed var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.cce-sections { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }

.cce-sections-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.cce-sections-head .cce-card-hint { margin-bottom: 0; }

.cce-add,
.cce-add-option,
.cce-btn {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cce-add { color: var(--color-primary); border-color: var(--color-primary); font-weight: 500; }
.cce-add:disabled, .cce-add-option:disabled, .cce-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cce-add-menu {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.cce-add-option { display: inline-flex; flex-direction: column; align-items: flex-start; text-align: left; }
.cce-add-note { font-size: 0.75rem; color: var(--color-ink-muted); }

.cce-empty,
.cce-notice {
  margin: 0;
  padding: var(--space-4);
  border: 1px dashed var(--color-line);
  border-radius: var(--radius-md);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  background: var(--color-surface);
}

.cce-conflict,
.cce-error {
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-sm);
}

.cce-conflict { background: #FFF6E0; border: 1px solid #E8C66A; color: #5C4300; }
.cce-conflict-title { font-weight: 700; margin: 0 0 var(--space-1); }
.cce-conflict-text, .cce-conflict-warn { margin: 0 0 var(--space-3); }
.cce-error { background: #FDF0EE; border: 1px solid #F5C6C2; color: #C0392B; }
.cce-error p { margin: 0; }
.cce-error-link { color: var(--color-primary); }

.cce-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.cce-actions .cce-conflict-warn { flex-basis: 100%; }
.cce-btn--warn { border-color: #B8860B; color: #5C4300; font-weight: 600; }

.cce-savebar {
  position: sticky;
  bottom: var(--space-3);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgba(18, 60, 50, 0.12);
}

.cce-savebar-status { font-size: var(--text-sm); color: var(--color-ink); }

.cce-save {
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.cce-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.cce-save:disabled { opacity: 0.55; cursor: not-allowed; }

.cce-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── ≤1279px: outline stacks above the sections ── */
@media (max-width: 1279px) {
  .cce-grid { grid-template-columns: minmax(0, 1fr); }
  .cce-aside { position: static; order: -1; }
  .cce-basic { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .cce-card { padding: var(--space-4); }
  .cce-sections-head { flex-direction: column; align-items: stretch; }
  .cce-add { width: 100%; }
  .cce-add-option { flex: 1 1 100%; }
  .cce-actions .cce-btn { flex: 1 1 100%; }
  .cce-savebar { flex-direction: column; align-items: stretch; bottom: var(--space-2); }
  .cce-save { width: 100%; }
}
</style>
