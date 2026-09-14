<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileRole } from '~/types/product-cms'
import { fileRoleLabel, sourceFileTypeLabel, workspaceMediaThumbUrl, workspaceMediaIsImage } from '~/utils/productWorkspace'
import type { LibraryTypeFilter } from '~/utils/mediaDisplay'
import MediaLibraryPicker from '~/components/admin/media/MediaLibraryPicker.vue'

interface LibraryFile {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  folder: string | null
}

/**
 * MEDIA-AI-LINK-PICKER-01 — the part of a Media Library folder the picker needs:
 * a subset of the folders endpoint's `FolderNode`, so this component does not
 * depend on the server type.
 */
interface PickerFolder {
  id: string
  name: string
  parent: string | null
  full_path: string
  management: string
  children: PickerFolder[]
}

/** Mirrors the page's EditableMedia shape — a row that may not exist on the
 * server yet (isNew) or may be staged for removal (markedForDeletion). */
interface EditableMedia {
  id: number | null
  directus_files_id: string
  filename_download: string | null
  type: string | null
  filesize: number | null
  file_role: FileRole | null
  alt_en: string | null
  language: string | null
  version_label: string | null
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
}

const props = defineProps<{
  media: EditableMedia[]
  libraryOpen: boolean
  libraryFiles: LibraryFile[]
  libraryLoading: boolean
  libraryError: boolean
  libraryTotal: number
  librarySearch: string
  libraryTypeFilter: LibraryTypeFilter
  libraryFolders: PickerFolder[]
  libraryFoldersError: boolean
  libraryFolderId: string | null
}>()

const emit = defineEmits<{
  'open-library': []
  'close-library': []
  'update-search': [value: string]
  'update-type-filter': [value: LibraryTypeFilter]
  'navigate-folder': [folderId: string | null]
  'retry-folders': []
  'retry-files': []
  'load-more': []
  'pick-file': [fileId: string]
  unlink: [rowIndex: number]
}>()

const selectedIndex = ref<number | null>(null)

interface IndexedRow { row: EditableMedia, index: number }

const rowsWithIndex = computed<IndexedRow[]>(() => props.media.map((row, index) => ({ row, index })))
const imageRows = computed(() => rowsWithIndex.value.filter((r: IndexedRow) => workspaceMediaIsImage(r.row.type ?? null)))
const documentRows = computed(() => rowsWithIndex.value.filter((r: IndexedRow) => !workspaceMediaIsImage(r.row.type ?? null)))

const selectedItem = computed(() => selectedIndex.value !== null ? props.media[selectedIndex.value] ?? null : null)

// Every currently staged file (linked, or pending removal — still present until Save)
// counts toward "already linked" so the picker can never stage the same file twice.
const existingFileIds = computed(() => new Set(props.media.map(m => m.directus_files_id)))

function selectItem(index: number) {
  selectedIndex.value = selectedIndex.value === index ? null : index
}

function unlinkRow(index: number) {
  emit('unlink', index)
  if (selectedIndex.value === index) selectedIndex.value = null
}

function unlinkSelected() {
  if (selectedIndex.value === null) return
  unlinkRow(selectedIndex.value)
}

function removeButtonLabel(row: EditableMedia): string {
  if (row.isNew) return 'Discard'
  return row.markedForDeletion ? 'Undo removal' : 'Remove association'
}

/** CC-IMP-04 — the picker itself is the shared MediaLibraryPicker; this component still decides what counts as linked. */
const linkedFileIds = computed(() => [...existingFileIds.value])
</script>

<template>
  <div class="ws-media">
    <p class="ws-media-hint">
      Only files explicitly linked to this product appear below. Materials from similar models,
      historical versions, or other products are never inherited or mixed in automatically.
    </p>

    <div class="ws-media-body">
      <div class="ws-media-main">
        <!-- ── Product media — same page as Documents & access, per PW-VIS-04 ── -->
        <section class="ws-card" aria-labelledby="ws-media-heading">
          <div class="ws-card-header">
            <div>
              <h2 id="ws-media-heading" class="ws-card-title">Product media</h2>
              <p class="ws-card-hint">
                {{ imageRows.length }} asset{{ imageRows.length === 1 ? '' : 's' }} linked to this product from Media Library.
              </p>
            </div>
            <button type="button" class="btn btn-primary" @click="emit('open-library')">
              + Select from Media Library
            </button>
          </div>

          <p v-if="imageRows.length === 0" class="ws-empty">No media linked to this product yet.</p>

          <div v-else class="ws-media-grid">
            <div
              v-for="entry in imageRows"
              :key="entry.row.id ?? `new-${entry.index}`"
              class="ws-media-card"
              :class="{
                'ws-media-card--selected': selectedIndex === entry.index,
                'ws-media-card--disabled': !entry.row.enabled,
                'ws-media-card--pending-delete': entry.row.markedForDeletion,
              }"
              role="button"
              tabindex="0"
              @click="selectItem(entry.index)"
              @keydown.enter="selectItem(entry.index)"
            >
              <div class="ws-media-card__thumb">
                <img
                  v-if="entry.row.directus_files_id"
                  :src="workspaceMediaThumbUrl(entry.row.directus_files_id) ?? ''"
                  :alt="entry.row.alt_en ?? entry.row.filename_download ?? ''"
                  loading="lazy"
                >
                <span v-if="entry.row.file_role" class="ws-role-badge">{{ fileRoleLabel(entry.row.file_role) }}</span>
              </div>
              <p class="ws-media-card__name">{{ entry.row.filename_download ?? 'Untitled asset' }}</p>
              <p v-if="entry.row.isNew" class="ws-media-card__pending ws-media-card__pending--new">New — not saved yet</p>
              <p v-else-if="entry.row.markedForDeletion" class="ws-media-card__pending ws-media-card__pending--delete">Will be removed on Save</p>
              <p v-else class="ws-media-card__tag">🔗 Linked from Media Library</p>
              <button type="button" class="ws-media-card__remove" @click.stop="unlinkRow(entry.index)">
                {{ removeButtonLabel(entry.row) }}
              </button>
            </div>

            <button type="button" class="ws-media-card ws-media-card--add" @click="emit('open-library')">
              <span class="ws-add-icon">+</span>
              <span>Add product media</span>
              <span class="ws-add-hint">Select approved assets from Media Library</span>
            </button>
          </div>
        </section>

        <!-- ── Documents & access — same page as Product media, per PW-VIS-04 ── -->
        <section class="ws-card" aria-labelledby="ws-docs-heading">
          <div class="ws-card-header">
            <div>
              <h2 id="ws-docs-heading" class="ws-card-title">Documents & access</h2>
              <p class="ws-card-hint">
                {{ documentRows.length }} document{{ documentRows.length === 1 ? '' : 's' }} linked to this product from Media Library.
              </p>
            </div>
            <button type="button" class="btn btn-primary" @click="emit('open-library')">
              + Add documents
            </button>
          </div>

          <p v-if="documentRows.length === 0" class="ws-empty">No documents linked to this product yet.</p>

          <div v-else class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Language</th>
                  <th scope="col">Document role</th>
                  <th scope="col">Version</th>
                  <th scope="col">Association</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in documentRows"
                  :key="entry.row.id ?? `new-${entry.index}`"
                  class="ws-doc-row"
                  :class="{ 'ws-doc-row--selected': selectedIndex === entry.index, 'ws-doc-row--pending-delete': entry.row.markedForDeletion }"
                  @click="selectItem(entry.index)"
                >
                  <td data-label="Name" class="ws-doc-name">
                    {{ entry.row.filename_download ?? 'Untitled document' }}
                  </td>
                  <td data-label="Language">{{ entry.row.language ?? 'all' }}</td>
                  <td data-label="Document role">{{ fileRoleLabel(entry.row.file_role) }}</td>
                  <td data-label="Version">{{ entry.row.version_label ?? '—' }}</td>
                  <td data-label="Association">
                    <span v-if="entry.row.isNew" class="ws-media-card__pending ws-media-card__pending--new">New — not saved yet</span>
                    <span v-else-if="entry.row.markedForDeletion" class="ws-media-card__pending ws-media-card__pending--delete">Will be removed on Save</span>
                    <span v-else>🔗 Linked from Media Library</span>
                  </td>
                  <td data-label="" class="ws-doc-actions">
                    <button type="button" class="ws-media-card__remove" @click.stop="unlinkRow(entry.index)">
                      {{ removeButtonLabel(entry.row) }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- ── Right rail: selected asset ─────────────────────────────────── -->
      <aside class="ws-detail">
        <h3 class="ws-detail-title">Selected asset</h3>

        <p v-if="!selectedItem" class="ws-detail-empty">Select an asset above to see its details.</p>

        <div v-else class="ws-detail-body">
          <div class="ws-detail-preview">
            <img
              v-if="workspaceMediaIsImage(selectedItem.type ?? null) && selectedItem.directus_files_id"
              :src="workspaceMediaThumbUrl(selectedItem.directus_files_id, { width: 320, height: 240 }) ?? ''"
              :alt="selectedItem.alt_en ?? ''"
            >
            <div v-else class="ws-detail-preview__icon">{{ sourceFileTypeLabel(selectedItem.type) }}</div>
          </div>

          <p v-if="selectedItem.isNew" class="ws-media-card__pending ws-media-card__pending--new">New — not saved yet</p>
          <p v-else-if="selectedItem.markedForDeletion" class="ws-media-card__pending ws-media-card__pending--delete">Will be removed on Save</p>

          <dl class="ws-detail-facts">
            <dt>Source</dt>
            <dd>Media Library</dd>
            <dt>File type</dt>
            <dd>{{ sourceFileTypeLabel(selectedItem.type) }}</dd>
            <dt>File name</dt>
            <dd>{{ selectedItem.filename_download ?? '—' }}</dd>
            <dt>Alt text</dt>
            <dd>{{ selectedItem.alt_en ?? 'Not set' }}</dd>
            <dt>Role</dt>
            <dd>{{ fileRoleLabel(selectedItem.file_role) }}</dd>
          </dl>

          <button type="button" class="btn btn-secondary ws-detail-unlink" @click="unlinkSelected">
            {{ removeButtonLabel(selectedItem) }}
          </button>
          <p class="ws-detail-lock">🔒 Original asset editing happens in Media Library. Changes here are staged until Save.</p>
        </div>
      </aside>
    </div>

    <!-- ── Media Library picker (shared with Content Center, CC-IMP-04) ─── -->
    <MediaLibraryPicker
      :open="libraryOpen"
      :files="libraryFiles"
      :loading="libraryLoading"
      :error="libraryError"
      :total="libraryTotal"
      :search="librarySearch"
      :type-filter="libraryTypeFilter"
      :folders="libraryFolders"
      :folders-error="libraryFoldersError"
      :folder-id="libraryFolderId"
      :linked-file-ids="linkedFileIds"
      linked-title="Already linked to this product"
      staging-note="Selecting a file stages it here — nothing is sent until you click Save changes."
      show-ai-readable
      @close="emit('close-library')"
      @update-search="emit('update-search', $event)"
      @update-type-filter="emit('update-type-filter', $event)"
      @navigate-folder="emit('navigate-folder', $event)"
      @retry-folders="emit('retry-folders')"
      @retry-files="emit('retry-files')"
      @load-more="emit('load-more')"
      @pick-file="emit('pick-file', $event)"
    />
  </div>
</template>

<style scoped>
.ws-media { display: flex; flex-direction: column; gap: var(--space-4); }

.ws-media-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; max-width: 68ch; }

.ws-media-body { display: flex; align-items: flex-start; gap: var(--space-5); }
.ws-media-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-5); }

.ws-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.ws-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.ws-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.ws-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-4) 0; }

.ws-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.ws-media-card {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  cursor: pointer;
  padding: 0;
  text-align: left;
  font-family: inherit;
}
.ws-media-card:hover { border-color: var(--color-primary); }
.ws-media-card--selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(15,92,75,0.12); }
.ws-media-card--disabled { opacity: 0.55; }
.ws-media-card--pending-delete { border-style: dashed; opacity: 0.7; }

.ws-media-card__thumb {
  position: relative;
  height: 110px;
  background: var(--color-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ws-media-card__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.ws-role-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(18,60,50,0.85);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.ws-media-card__name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink);
  margin: var(--space-2) var(--space-2) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-media-card__tag {
  font-size: 10px;
  color: var(--color-ink-muted);
  margin: 2px var(--space-2) var(--space-2);
}

.ws-media-card__pending {
  font-size: 0.6875rem;
  font-weight: 500;
  margin: 2px var(--space-2) var(--space-2);
}
.ws-media-card__pending--new { color: #1E6B4E; }
.ws-media-card__pending--delete { color: #A23B3B; }

.ws-media-card__remove {
  margin: 0 var(--space-2) var(--space-2);
  align-self: flex-start;
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
}
.ws-media-card__remove:hover { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }

.ws-media-card--add {
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-style: dashed;
  color: var(--color-ink-muted);
  min-height: 160px;
  text-align: center;
  padding: var(--space-3);
}
.ws-media-card--add:hover { color: var(--color-primary); border-color: var(--color-primary); }
.ws-add-icon { font-size: var(--text-xl); line-height: 1; }
.ws-add-hint { font-size: 10px; }

.ws-table-wrap { overflow-x: auto; }
.ws-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.ws-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-line);
  white-space: nowrap;
}
.ws-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); color: var(--color-ink); vertical-align: top; }
.ws-table tr:last-child td { border-bottom: none; }
.ws-doc-row { cursor: pointer; }
.ws-doc-row:hover { background: var(--color-surface-alt); }
.ws-doc-row--selected { background: rgba(15,92,75,0.06); }
.ws-doc-row--pending-delete { opacity: 0.6; }
.ws-doc-name { font-weight: 500; overflow-wrap: anywhere; }
.ws-doc-actions { white-space: nowrap; }

.ws-detail {
  width: 260px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

@media (min-width: 768px) {
  .ws-detail { position: sticky; top: var(--space-4); }
}
.ws-detail-title { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink); margin: 0 0 var(--space-3); }
.ws-detail-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

.ws-detail-preview {
  width: 100%;
  height: 140px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
}
.ws-detail-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
.ws-detail-preview__icon { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink-muted); }

.ws-detail-facts { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--space-2); margin: 0 0 var(--space-3); font-size: var(--text-xs); }
.ws-detail-facts dt { color: var(--color-ink-muted); white-space: nowrap; }
.ws-detail-facts dd { color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }

.ws-detail-unlink { width: 100%; margin-bottom: var(--space-2); }
.ws-detail-lock { font-size: 10px; color: var(--color-ink-muted); margin: 0; line-height: 1.5; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: var(--color-primary-deep); }
.btn-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.btn-secondary:hover { background: var(--color-surface-alt); }

/* ── ≤767px: stacked, no compressed desktop layouts ── */
@media (max-width: 767px) {
  .ws-media-body { flex-direction: column; }
  .ws-detail { width: 100%; }

  .ws-table-wrap { overflow-x: visible; }
  .ws-table, .ws-table thead, .ws-table tbody, .ws-table tr, .ws-table th, .ws-table td { display: block; }
  .ws-table thead { display: none; }
  .ws-table tr { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); }
  .ws-table tr:last-child { margin-bottom: 0; }
  .ws-table td { border-bottom: none; padding: var(--space-1) 0; }
  .ws-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin-bottom: 2px;
  }
}
</style>
