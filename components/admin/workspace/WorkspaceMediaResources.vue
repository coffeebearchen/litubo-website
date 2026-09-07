<script setup lang="ts">
import type { ProductMedia } from '~/types/product-cms'
import { fileRoleLabel, sourceFileTypeLabel, workspaceMediaThumbUrl, workspaceMediaIsImage } from '~/utils/productWorkspace'

interface LibraryFile {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
}

const props = defineProps<{
  media: ProductMedia[]
  libraryOpen: boolean
  libraryFiles: LibraryFile[]
  libraryLoading: boolean
  libraryTotal: number
  librarySearch: string
  libraryTypeFilter: '' | 'image' | 'pdf'
}>()

const emit = defineEmits<{
  'open-library': []
  'close-library': []
  'update-search': [value: string]
  'update-type-filter': [value: '' | 'image' | 'pdf']
  'load-more': []
  'pick-file': [fileId: string]
  unlink: [mediaId: number]
}>()

const activeTab = ref<'media' | 'documents'>('media')
const selectedId = ref<number | null>(null)

const imageMedia = computed(() => props.media.filter(m => workspaceMediaIsImage(m.type ?? null)))
const documentMedia = computed(() => props.media.filter(m => !workspaceMediaIsImage(m.type ?? null)))

const selectedItem = computed(() => props.media.find(m => m.id === selectedId.value) ?? null)

const existingFileIds = computed(() => new Set(props.media.map(m => m.directus_files_id).filter((v): v is string => Boolean(v))))

function selectItem(id: number) {
  selectedId.value = selectedId.value === id ? null : id
}

function unlinkSelected() {
  if (selectedId.value === null) return
  emit('unlink', selectedId.value)
  selectedId.value = null
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function libraryThumb(id: string): string {
  return workspaceMediaThumbUrl(id, { width: 160, height: 120 }) ?? ''
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
        <div class="ws-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="ws-tab"
            :class="{ 'ws-tab--active': activeTab === 'media' }"
            :aria-selected="activeTab === 'media'"
            @click="activeTab = 'media'"
          >
            Product media
          </button>
          <button
            type="button"
            role="tab"
            class="ws-tab"
            :class="{ 'ws-tab--active': activeTab === 'documents' }"
            :aria-selected="activeTab === 'documents'"
            @click="activeTab = 'documents'"
          >
            Documents & access
          </button>
        </div>

        <!-- ── Product media tab ─────────────────────────────────────────── -->
        <section v-if="activeTab === 'media'" class="ws-card" aria-labelledby="ws-media-heading">
          <div class="ws-card-header">
            <div>
              <h2 id="ws-media-heading" class="ws-card-title">Product media</h2>
              <p class="ws-card-hint">
                {{ imageMedia.length }} asset{{ imageMedia.length === 1 ? '' : 's' }} linked to this product from Media Library.
              </p>
            </div>
            <button type="button" class="btn btn-primary" @click="emit('open-library')">
              + Select from Media Library
            </button>
          </div>

          <p v-if="imageMedia.length === 0" class="ws-empty">No media linked to this product yet.</p>

          <div v-else class="ws-media-grid">
            <button
              v-for="item in imageMedia"
              :key="item.id"
              type="button"
              class="ws-media-card"
              :class="{ 'ws-media-card--selected': selectedId === item.id, 'ws-media-card--disabled': !item.enabled }"
              @click="selectItem(item.id)"
            >
              <div class="ws-media-card__thumb">
                <img
                  v-if="item.directus_files_id"
                  :src="workspaceMediaThumbUrl(item.directus_files_id) ?? ''"
                  :alt="item.alt_en ?? item.filename_download ?? ''"
                  loading="lazy"
                >
                <span v-if="item.file_role" class="ws-role-badge">{{ fileRoleLabel(item.file_role) }}</span>
              </div>
              <p class="ws-media-card__name">{{ item.filename_download ?? 'Untitled asset' }}</p>
              <p class="ws-media-card__tag">🔗 Linked from Media Library</p>
            </button>

            <button type="button" class="ws-media-card ws-media-card--add" @click="emit('open-library')">
              <span class="ws-add-icon">+</span>
              <span>Add product media</span>
              <span class="ws-add-hint">Select approved assets from Media Library</span>
            </button>
          </div>
        </section>

        <!-- ── Documents & access tab ────────────────────────────────────── -->
        <section v-else class="ws-card" aria-labelledby="ws-docs-heading">
          <div class="ws-card-header">
            <div>
              <h2 id="ws-docs-heading" class="ws-card-title">Documents & access</h2>
              <p class="ws-card-hint">
                {{ documentMedia.length }} document{{ documentMedia.length === 1 ? '' : 's' }} linked to this product from Media Library.
              </p>
            </div>
            <button type="button" class="btn btn-primary" @click="emit('open-library')">
              + Select from Media Library
            </button>
          </div>

          <p v-if="documentMedia.length === 0" class="ws-empty">No documents linked to this product yet.</p>

          <div v-else class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Language</th>
                  <th scope="col">Document role</th>
                  <th scope="col">Version</th>
                  <th scope="col">Association</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in documentMedia"
                  :key="item.id"
                  class="ws-doc-row"
                  :class="{ 'ws-doc-row--selected': selectedId === item.id }"
                  @click="selectItem(item.id)"
                >
                  <td data-label="Name" class="ws-doc-name">
                    {{ item.filename_download ?? 'Untitled document' }}
                  </td>
                  <td data-label="Language">{{ item.language ?? 'all' }}</td>
                  <td data-label="Document role">{{ fileRoleLabel(item.file_role) }}</td>
                  <td data-label="Version">{{ item.version_label ?? '—' }}</td>
                  <td data-label="Association">🔗 Linked from Media Library</td>
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
            Remove association
          </button>
          <p class="ws-detail-lock">🔒 Original asset editing happens in Media Library.</p>
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
                @change="emit('update-type-filter', ($event.target as HTMLSelectElement).value as '' | 'image' | 'pdf')"
              >
                <option value="">All formats</option>
                <option value="image">Image</option>
                <option value="pdf">PDF</option>
              </select>
              <span class="ws-lib-count">{{ libraryTotal }} file(s)</span>
            </div>

            <div v-if="libraryLoading && libraryFiles.length === 0" class="ws-lib-loading">Loading…</div>
            <div v-else-if="!libraryLoading && libraryFiles.length === 0" class="ws-lib-empty">
              No files found in Media Library.
            </div>

            <div v-else class="ws-lib-grid">
              <button
                v-for="f in libraryFiles"
                :key="f.id"
                type="button"
                class="ws-lib-card"
                :class="{ 'ws-lib-card--already': existingFileIds.has(f.id) }"
                :disabled="existingFileIds.has(f.id)"
                :title="existingFileIds.has(f.id) ? 'Already linked to this product' : (f.title ?? f.filename_download ?? f.id)"
                @click="emit('pick-file', f.id)"
              >
                <div class="ws-lib-card__thumb">
                  <img v-if="workspaceMediaIsImage(f.type)" :src="libraryThumb(f.id)" :alt="f.title ?? ''" loading="lazy">
                  <div v-else class="ws-lib-card__icon">{{ sourceFileTypeLabel(f.type) }}</div>
                  <span v-if="existingFileIds.has(f.id)" class="ws-lib-card__badge">Linked</span>
                </div>
                <p class="ws-lib-card__name">{{ f.title ?? f.filename_download ?? f.id.slice(0, 8) }}</p>
                <p class="ws-lib-card__size">{{ formatSize(f.filesize) }}</p>
              </button>
            </div>

            <div v-if="libraryFiles.length < libraryTotal && !libraryLoading" class="ws-lib-more">
              <button type="button" class="btn btn-secondary" @click="emit('load-more')">Load more</button>
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
.ws-media-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }

.ws-tabs { display: flex; gap: var(--space-2); border-bottom: 1px solid var(--color-line); }
.ws-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink-muted);
  cursor: pointer;
}
.ws-tab--active { color: var(--color-primary-deep); border-bottom-color: var(--color-primary); font-weight: 600; }

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
.ws-doc-name { font-weight: 500; overflow-wrap: anywhere; }

.ws-detail {
  width: 260px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
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

.ws-lib-filter { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.ws-lib-search {
  flex: 1; min-width: 140px; height: 36px;
  padding: 0 var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: var(--color-surface);
}
.ws-lib-type { height: 36px; padding: 0 var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm); font-size: var(--text-sm); color: var(--color-ink); background: var(--color-surface); }
.ws-lib-count { font-size: var(--text-xs); color: var(--color-ink-muted); margin-left: auto; }

.ws-lib-loading, .ws-lib-empty { text-align: center; padding: var(--space-8); font-size: var(--text-sm); color: var(--color-ink-muted); }

.ws-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-3); }

.ws-lib-card {
  display: flex; flex-direction: column;
  border: 2px solid var(--color-line); border-radius: var(--radius-md);
  overflow: hidden; cursor: pointer; text-align: left; padding: 0; background: var(--color-surface);
  font-family: inherit;
}
.ws-lib-card:hover:not(:disabled) { border-color: var(--color-primary); }
.ws-lib-card:disabled { opacity: 0.55; cursor: not-allowed; }

.ws-lib-card__thumb { position: relative; height: 100px; background: var(--color-surface-alt); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ws-lib-card__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ws-lib-card__icon { font-size: var(--text-xs); font-weight: 700; color: var(--color-ink-muted); }
.ws-lib-card__badge {
  position: absolute; top: 4px; right: 4px;
  background: var(--color-primary); color: white;
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 999px;
}
.ws-lib-card__name { font-size: 10px; font-weight: 600; color: var(--color-ink); margin: 0; padding: var(--space-2) var(--space-2) 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-lib-card__size { font-size: 10px; color: var(--color-ink-muted); margin: 0; padding: 0 var(--space-2) var(--space-2); }

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
  .ws-lib-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
}
</style>
