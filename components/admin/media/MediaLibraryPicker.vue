<script setup lang="ts">
import { computed } from 'vue'
import { workspaceMediaThumbUrl, workspaceMediaIsImage } from '~/utils/productWorkspace'
import { AI_READABLE_FORMATS_LABEL, MEDIA_ONLY_FORMATS_LABEL, isAiSourceReadableNow } from '~/utils/aiSourceFormats'
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

/**
 * Select from Media Library — the one picker every workspace uses.
 *
 * Moved unchanged out of the Product Workspace Media & resources component
 * (MEDIA-AI-LINK-PICKER-01 / -R1) so Content Center (CC-IMP-04) reuses it instead
 * of building a second media browser. It only browses and emits: the caller owns
 * loading (archived files are excluded by the server query), staging and Save.
 */

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

interface PickerFolder {
  id: string
  name: string
  parent: string | null
  full_path: string
  management: string
  children: PickerFolder[]
}

const props = withDefaults(defineProps<{
  open: boolean
  files: LibraryFile[]
  loading: boolean
  error: boolean
  total: number
  search: string
  typeFilter: LibraryTypeFilter
  folders: PickerFolder[]
  foldersError: boolean
  folderId: string | null
  linkedFileIds: readonly string[]
  title?: string
  linkedTitle?: string
  stagingNote?: string
  showAiReadable?: boolean
}>(), {
  title: 'Select from Media Library',
  linkedTitle: 'Already linked',
  stagingNote: 'Selecting a file stages it here — nothing is sent until you click Save changes.',
  showAiReadable: false,
})

const emit = defineEmits<{
  'close': []
  'update-search': [value: string]
  'update-type-filter': [value: LibraryTypeFilter]
  'navigate-folder': [folderId: string | null]
  'retry-folders': []
  'retry-files': []
  'load-more': []
  'pick-file': [fileId: string]
}>()

const existingFileIds = computed(() => new Set(props.linkedFileIds))

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function libraryThumb(id: string): string {
  return workspaceMediaThumbUrl(id, { width: 96, height: 96 }) ?? ''
}

const pickerFolders = computed(() => flattenFolderTree(props.folders))
const pickerParentOf = computed(() => Object.fromEntries(pickerFolders.value.map(f => [f.id, f.parent])))
const pickerFolderById = computed(() => new Map(pickerFolders.value.map(f => [f.id, f])))

/** The folders directly inside the current location — the same rule Media Library's own navigation uses. */
const pickerChildFolders = computed(() => directChildFolders(pickerFolders.value, pickerParentOf.value, props.folderId))
const pickerTrail = computed(() => folderTrail(pickerFolders.value, props.folderId))
const pickerAtRoot = computed(() => props.folderId === null)
const pickerAtUnclassified = computed(() => props.folderId === UNCLASSIFIED_FOLDER)
const pickerShowsFiles = computed(() => libraryShowsFiles({
  folder: props.folderId,
  search: props.search,
  type: props.typeFilter,
}))

const pickerEmptyText = computed(() => {
  const where = pickerAtRoot.value ? 'in Media Library' : pickerAtUnclassified.value ? 'without a folder' : 'in this folder'
  if (props.search.trim() || props.typeFilter) return `No matching files ${where}.`
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
  <Teleport to="body">
    <div v-if="open" class="ws-lib-overlay" @click.self="emit('close')">
      <div class="ws-lib-modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="ws-lib-header">
          <h3 class="ws-lib-title">{{ title }}</h3>
          <button type="button" class="ws-lib-close" aria-label="Close" @click="emit('close')">✕</button>
        </div>

        <div class="ws-lib-body">
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
              <p v-if="foldersError" class="ws-lib-error" role="alert">
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
                  :value="search"
                  type="search"
                  class="ws-lib-search"
                  placeholder="Search by filename or title…"
                  aria-label="Search Media Library"
                  @input="emit('update-search', ($event.target as HTMLInputElement).value)"
                >
                <select
                  :value="typeFilter"
                  class="ws-lib-type"
                  aria-label="File format"
                  @change="emit('update-type-filter', ($event.target as HTMLSelectElement).value as LibraryTypeFilter)"
                >
                  <option value="">All formats</option>
                  <option value="image">Image</option>
                  <option value="pdf">PDF</option>
                  <option value="text">Text (TXT, CSV, TSV)</option>
                </select>
                <span v-if="pickerShowsFiles" class="ws-lib-count">{{ total }} file(s)</span>
              </div>

              <p class="ws-lib-note">{{ stagingNote }}</p>
              <p v-if="showAiReadable" class="ws-lib-note">
                <span class="ws-lib-card__ai">AI-readable</span>
                marks the {{ AI_READABLE_FORMATS_LABEL }} files AI Source Intake can analyze today.<template v-if="MEDIA_ONLY_FORMATS_LABEL"> {{ MEDIA_ONLY_FORMATS_LABEL }} files can be linked, but not analyzed.</template><template v-else> Images are read for their visible text only.</template>
              </p>

              <p v-if="!pickerShowsFiles" class="ws-lib-prompt">
                Open a folder to see its files, or search or choose a format to look across Media Library.
              </p>
              <p v-else-if="error" class="ws-lib-error" role="alert">
                Files could not be loaded.
                <button type="button" class="ws-lib-retry" @click="emit('retry-files')">Retry</button>
              </p>
              <div v-else-if="loading && files.length === 0" class="ws-lib-loading">Loading…</div>
              <div v-else-if="!loading && files.length === 0" class="ws-lib-empty">{{ pickerEmptyText }}</div>

              <ul v-else class="ws-lib-list">
                <li v-for="f in files" :key="f.id">
                  <button
                    type="button"
                    class="ws-lib-card"
                    :class="{ 'ws-lib-card--already': existingFileIds.has(f.id) }"
                    :disabled="existingFileIds.has(f.id)"
                    :title="existingFileIds.has(f.id) ? linkedTitle : (f.filename_download ?? f.title ?? '')"
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
                        <span v-if="showAiReadable && isAiSourceReadableNow(f.type)" class="ws-lib-card__ai">AI-readable</span>
                      </span>
                      <span v-if="pickerFilePath(f)" class="ws-lib-card__path">{{ pickerFilePath(f) }}</span>
                    </span>
                    <span v-if="existingFileIds.has(f.id)" class="ws-lib-card__badge">Already linked</span>
                  </button>
                </li>
              </ul>

              <div v-if="pickerShowsFiles && !error && files.length < total && !loading" class="ws-lib-more">
                <button type="button" class="ws-lib-more-btn" @click="emit('load-more')">Load more</button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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

.ws-lib-trail { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-1); font-size: var(--text-sm); min-width: 0; }
.ws-lib-trail__link {
  background: none; border: none; padding: var(--space-1); cursor: pointer;
  color: var(--color-primary); font-size: inherit; font-family: inherit; text-align: left; overflow-wrap: anywhere;
}
.ws-lib-trail__link:hover { text-decoration: underline; }
.ws-lib-trail__current { padding: var(--space-1); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.ws-lib-trail__sep { color: var(--color-ink-muted); }

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
.ws-lib-more-btn {
  min-height: 40px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

@media (max-width: 767px) {
  .ws-lib-modal { max-height: 92vh; }
  .ws-lib-body { padding: var(--space-3); }
}
</style>
