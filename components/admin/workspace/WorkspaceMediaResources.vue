<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileRole } from '~/types/product-cms'
import { fileRoleLabel, sourceFileTypeLabel, workspaceMediaThumbUrl, workspaceMediaIsImage } from '~/utils/productWorkspace'
import { isAiSourceReadableNow } from '~/utils/aiSourceFormats'
import {
  directChildFolders,
  fileKind,
  flattenFolderTree,
  folderPathLabel,
  folderTrail,
  libraryShowsFiles,
  systemFolderLabel,
  UNCLASSIFIED_FOLDER,
  type LibraryTypeFilter,
} from '~/utils/mediaDisplay'

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

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function libraryThumb(id: string): string {
  return workspaceMediaThumbUrl(id, { width: 96, height: 96 }) ?? ''
}

// ── Picker browsing — derived from the folder tree and where the picker is ──

const pickerFolders = computed(() => flattenFolderTree(props.libraryFolders))
const pickerParentOf = computed(() => Object.fromEntries(pickerFolders.value.map(f => [f.id, f.parent])))
const pickerFolderById = computed(() => new Map(pickerFolders.value.map(f => [f.id, f])))

/** The folders directly inside the current location — the same rule Media Library's own navigation uses. */
const pickerChildFolders = computed(() => directChildFolders(pickerFolders.value, pickerParentOf.value, props.libraryFolderId))
const pickerTrail = computed(() => folderTrail(pickerFolders.value, props.libraryFolderId))
const pickerAtRoot = computed(() => props.libraryFolderId === null)
const pickerAtUnclassified = computed(() => props.libraryFolderId === UNCLASSIFIED_FOLDER)
const pickerShowsFiles = computed(() => libraryShowsFiles({
  folder: props.libraryFolderId,
  search: props.librarySearch,
  type: props.libraryTypeFilter,
}))

const pickerEmptyText = computed(() => {
  const where = pickerAtRoot.value ? 'in Media Library' : pickerAtUnclassified.value ? 'without a folder' : 'in this folder'
  if (props.librarySearch.trim() || props.libraryTypeFilter) return `No matching files ${where}.`
  return pickerAtUnclassified.value ? 'Every file is in a folder.' : 'No files in this folder.'
})

/** System folders are stored as slugs and shown title-cased, exactly as Media Library shows them. */
function pickerFolderName(f: { name: string, management: string }): string {
  return f.management === 'customer-managed' ? f.name : systemFolderLabel(f.name)
}

/** Where a file sits, in the form Media Library file cards use. Empty when the folder tree is unavailable. */
function pickerFilePath(f: LibraryFile): string {
  if (!f.folder) return 'Unclassified'
  return folderPathLabel(pickerFolderById.value.get(f.folder)?.full_path)
}
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

    <!-- ── Media Library picker ─────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="libraryOpen" class="ws-lib-overlay" @click.self="emit('close-library')">
        <div class="ws-lib-modal" role="dialog" aria-modal="true" aria-label="Select from Media Library">
          <div class="ws-lib-header">
            <h3 class="ws-lib-title">Select from Media Library</h3>
            <button type="button" class="ws-lib-close" aria-label="Close" @click="emit('close-library')">✕</button>
          </div>

          <div class="ws-lib-body">
            <!--
              MEDIA-AI-LINK-PICKER-01 — the picker browses the tree Media Library
              shows, one level at a time, instead of listing the whole library
              newest-first. Where a file sits is discovery only: linking is still
              an explicit pick, and nothing here decides a file belongs to this
              product because of the folder it is in.
            -->
            <nav class="ws-lib-trail" aria-label="Location in Media Library">
              <button v-if="!pickerAtRoot" type="button" class="ws-lib-trail__link" @click="emit('navigate-folder', null)">Media Library</button>
              <span v-else class="ws-lib-trail__current">Media Library</span>
              <template v-if="pickerAtUnclassified">
                <span class="ws-lib-trail__sep" aria-hidden="true">/</span>
                <span class="ws-lib-trail__current">Unclassified</span>
              </template>
              <template v-for="(crumb, i) in pickerTrail" :key="crumb.id">
                <span class="ws-lib-trail__sep" aria-hidden="true">/</span>
                <button
                  v-if="i < pickerTrail.length - 1"
                  type="button"
                  class="ws-lib-trail__link"
                  @click="emit('navigate-folder', crumb.id)"
                >{{ pickerFolderName(crumb) }}</button>
                <span v-else class="ws-lib-trail__current">{{ pickerFolderName(crumb) }}</span>
              </template>
            </nav>

            <div class="ws-lib-browse">
              <section class="ws-lib-folders" aria-label="Folders">
                <p v-if="libraryFoldersError" class="ws-lib-error" role="alert">
                  Folders could not be loaded.
                  <button type="button" class="ws-lib-retry" @click="emit('retry-folders')">Retry</button>
                </p>
                <template v-else>
                  <button
                    v-for="f in pickerChildFolders"
                    :key="f.id"
                    type="button"
                    class="ws-lib-folder"
                    @click="emit('navigate-folder', f.id)"
                  >
                    <span class="ws-lib-folder__icon" aria-hidden="true">📁</span>
                    <span class="ws-lib-folder__name" :title="f.full_path">{{ pickerFolderName(f) }}</span>
                    <span class="ws-lib-folder__chevron" aria-hidden="true">›</span>
                  </button>
                  <!-- Unclassified is a view of files in no folder, offered where the whole library is in scope. -->
                  <button
                    v-if="pickerAtRoot"
                    type="button"
                    class="ws-lib-folder ws-lib-folder--view"
                    @click="emit('navigate-folder', UNCLASSIFIED_FOLDER)"
                  >
                    <span class="ws-lib-folder__icon" aria-hidden="true">🗂</span>
                    <span class="ws-lib-folder__name">Unclassified files</span>
                    <span class="ws-lib-folder__chevron" aria-hidden="true">›</span>
                  </button>
                  <p v-if="!pickerAtRoot && pickerChildFolders.length === 0" class="ws-lib-folders-empty">No subfolders</p>
                </template>
              </section>

              <section class="ws-lib-files" aria-label="Files">
                <div class="ws-lib-filter">
                  <input
                    :value="librarySearch"
                    type="search"
                    class="ws-lib-search"
                    placeholder="Search by filename or title…"
                    @input="emit('update-search', ($event.target as HTMLInputElement).value)"
                  >
                  <select
                    :value="libraryTypeFilter"
                    class="ws-lib-type"
                    @change="emit('update-type-filter', ($event.target as HTMLSelectElement).value as LibraryTypeFilter)"
                  >
                    <option value="">All formats</option>
                    <option value="image">Image</option>
                    <option value="pdf">PDF</option>
                    <option value="text">Text (TXT, CSV, TSV)</option>
                  </select>
                  <span v-if="pickerShowsFiles" class="ws-lib-count">{{ libraryTotal }} file(s)</span>
                </div>

                <p class="ws-lib-note">Selecting a file stages it here — nothing is sent until you click Save changes.</p>
                <!-- Honest about today's AI scope: a PDF can be linked, but AI Source Intake cannot read it. -->
                <p class="ws-lib-note">
                  <span class="ws-lib-card__ai">AI-readable</span>
                  marks the TXT, CSV and TSV files AI Source Intake can analyze today. PDF and images can be linked, but not analyzed.
                </p>

                <p v-if="!pickerShowsFiles" class="ws-lib-prompt">
                  Open a folder to see its files, or search or choose a format to look across Media Library.
                </p>
                <p v-else-if="libraryError" class="ws-lib-error" role="alert">
                  Files could not be loaded.
                  <button type="button" class="ws-lib-retry" @click="emit('retry-files')">Retry</button>
                </p>
                <div v-else-if="libraryLoading && libraryFiles.length === 0" class="ws-lib-loading">Loading…</div>
                <div v-else-if="!libraryLoading && libraryFiles.length === 0" class="ws-lib-empty">{{ pickerEmptyText }}</div>

                <ul v-else class="ws-lib-list">
                  <li v-for="f in libraryFiles" :key="f.id">
                    <button
                      type="button"
                      class="ws-lib-card"
                      :class="{ 'ws-lib-card--already': existingFileIds.has(f.id) }"
                      :disabled="existingFileIds.has(f.id)"
                      :title="existingFileIds.has(f.id) ? 'Already linked to this product' : (f.filename_download ?? f.title ?? '')"
                      @click="emit('pick-file', f.id)"
                    >
                      <span class="ws-lib-card__thumb">
                        <img v-if="workspaceMediaIsImage(f.type)" :src="libraryThumb(f.id)" alt="" loading="lazy">
                        <span v-else class="ws-lib-card__kind">{{ fileKind(f.type) }}</span>
                      </span>
                      <span class="ws-lib-card__body">
                        <span class="ws-lib-card__name">{{ f.filename_download ?? f.title ?? 'Untitled file' }}</span>
                        <span v-if="f.title && f.title !== f.filename_download" class="ws-lib-card__title">{{ f.title }}</span>
                        <span class="ws-lib-card__meta">
                          {{ fileKind(f.type) }} · {{ formatSize(f.filesize) }}
                          <span v-if="isAiSourceReadableNow(f.type)" class="ws-lib-card__ai">AI-readable</span>
                        </span>
                        <span v-if="pickerFilePath(f)" class="ws-lib-card__path">{{ pickerFilePath(f) }}</span>
                      </span>
                      <span v-if="existingFileIds.has(f.id)" class="ws-lib-card__badge">Already linked</span>
                    </button>
                  </li>
                </ul>

                <div v-if="pickerShowsFiles && !libraryError && libraryFiles.length < libraryTotal && !libraryLoading" class="ws-lib-more">
                  <button type="button" class="btn btn-secondary" @click="emit('load-more')">Load more</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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

/* ── Media Library picker modal ── */
.ws-lib-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
}
@media (min-width: 768px) { .ws-lib-overlay { align-items: center; } }

.ws-lib-modal {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 880px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.ws-lib-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}
.ws-lib-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); margin: 0; }
.ws-lib-close {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: var(--color-ink-muted);
  border-radius: var(--radius-sm); font-size: var(--text-base);
}
.ws-lib-close:hover { background: var(--color-line); }

.ws-lib-body { flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }

/* ── Location: every ancestor is a link back up the tree ── */
.ws-lib-trail { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-1); font-size: var(--text-sm); min-width: 0; }
.ws-lib-trail__link {
  background: none; border: none; padding: var(--space-1); cursor: pointer;
  color: var(--color-primary); font-size: inherit; font-family: inherit; text-align: left; overflow-wrap: anywhere;
}
.ws-lib-trail__link:hover { text-decoration: underline; }
.ws-lib-trail__current { padding: var(--space-1); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.ws-lib-trail__sep { color: var(--color-ink-muted); }

/* ── Folders beside the files on a wide screen, above them on a phone ── */
.ws-lib-browse { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
@media (min-width: 768px) {
  .ws-lib-browse { grid-template-columns: minmax(180px, 240px) minmax(0, 1fr); align-items: start; }
}

.ws-lib-folders { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.ws-lib-folder {
  display: flex; align-items: center; gap: var(--space-2);
  width: 100%; min-height: 44px; padding: var(--space-2) var(--space-3);
  background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  color: var(--color-ink); font-size: var(--text-sm); font-family: inherit; text-align: left; cursor: pointer;
}
.ws-lib-folder:hover { border-color: var(--color-primary); }
.ws-lib-folder--view { border-style: dashed; color: var(--color-ink-muted); }
.ws-lib-folder__icon { flex-shrink: 0; }
/* `min-width: 0` lets a long folder name truncate instead of pushing the chevron out of the row. */
.ws-lib-folder__name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-lib-folder__chevron { flex-shrink: 0; color: var(--color-ink-muted); }
.ws-lib-folders-empty { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; padding: var(--space-2) 0; }

.ws-lib-files { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }

.ws-lib-filter { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.ws-lib-search {
  flex: 1; min-width: 140px; height: 36px;
  padding: 0 var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: var(--color-surface);
}
.ws-lib-type { height: 36px; max-width: 100%; padding: 0 var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm); font-size: var(--text-sm); color: var(--color-ink); background: var(--color-surface); }
.ws-lib-count { font-size: var(--text-xs); color: var(--color-ink-muted); margin-left: auto; }

.ws-lib-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.ws-lib-prompt {
  margin: 0; padding: var(--space-6) var(--space-3); text-align: center;
  font-size: var(--text-sm); color: var(--color-ink-muted);
  border: 1px dashed var(--color-line); border-radius: var(--radius-md);
}

.ws-lib-error { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; font-size: var(--text-sm); color: #C0392B; }
.ws-lib-retry {
  background: var(--color-surface); border: 1px solid #F5C6C2; border-radius: var(--radius-sm);
  color: #C0392B; font-size: var(--text-xs); font-family: inherit; padding: var(--space-1) var(--space-2); cursor: pointer;
}

.ws-lib-loading, .ws-lib-empty { text-align: center; padding: var(--space-8); font-size: var(--text-sm); color: var(--color-ink-muted); }

/* ── Files: one per row, so a filename and its folder can both be read ── */
.ws-lib-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }

.ws-lib-card {
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; padding: var(--space-2);
  border: 1px solid var(--color-line); border-radius: var(--radius-md);
  background: var(--color-surface); cursor: pointer; text-align: left; font-family: inherit;
}
.ws-lib-card:hover:not(:disabled) { border-color: var(--color-primary); }
.ws-lib-card:disabled { opacity: 0.6; cursor: not-allowed; }

.ws-lib-card__thumb {
  flex-shrink: 0; width: 48px; height: 48px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-alt); border-radius: var(--radius-sm);
}
.ws-lib-card__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ws-lib-card__kind { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--color-ink-muted); }

.ws-lib-card__body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
/* The filename is what tells manual-v1 from manual-final, so it may take two lines rather than lose its end. */
.ws-lib-card__name {
  font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ws-lib-card__title { font-size: var(--text-xs); font-style: italic; color: var(--color-ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-lib-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); font-size: var(--text-xs); color: var(--color-ink-muted); }
.ws-lib-card__ai {
  font-size: 10px; font-weight: 600; white-space: nowrap;
  color: #1E6B4E; background: #E3F3EC; border: 1px solid #BFE3D2; border-radius: 999px; padding: 0 6px;
}
.ws-lib-card__path { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }
.ws-lib-card__badge {
  flex-shrink: 0; white-space: nowrap;
  background: var(--color-primary); color: white;
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
}

.ws-lib-more { text-align: center; }

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

  .ws-lib-modal { max-height: 92vh; }
  .ws-lib-body { padding: var(--space-3); }
}
</style>
