<script setup lang="ts">
import type { AdminProduct, ProductMedia, FileRole } from '~/types/product-cms'
import type { FolderNode } from '~/server/api/admin/media/folders.get'
import { workspaceHeroUrl } from '~/utils/productWorkspace'
import {
  buildLibraryFilesQuery,
  flattenFolderTree,
  libraryShowsFiles,
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
  /**
   * MEDIA-AI-LINK-PICKER-01 — where the file sits, so a match can be told apart
   * from its copies in other folders. Discovery only: nothing reads it to decide
   * which product a file belongs to.
   */
  folder: string | null
}

/**
 * A row on screen. `isNew` rows have never been sent to the server — they
 * only exist locally until Save. `markedForDeletion` rows are still real,
 * saved associations that will be removed on Save. Nothing else about an
 * association is editable in this module, so this local/original diff is
 * the entire dirty surface — there is no per-field PATCH.
 */
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

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

const [{ data: product, error: productError }, { data: mediaData, refresh: refreshMedia }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
])

const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

function toEditableMedia(m: ProductMedia): EditableMedia {
  return {
    id: m.id,
    directus_files_id: m.directus_files_id ?? '',
    filename_download: m.filename_download ?? null,
    type: m.type ?? null,
    filesize: m.filesize ?? null,
    file_role: m.file_role,
    alt_en: m.alt_en,
    language: m.language,
    version_label: m.version_label,
    enabled: m.enabled,
    isNew: false,
    markedForDeletion: false,
  }
}

function fromLibraryFile(file: LibraryFile): EditableMedia {
  return {
    id: null,
    directus_files_id: file.id,
    filename_download: file.filename_download ?? file.title,
    type: file.type,
    filesize: file.filesize,
    file_role: null,
    alt_en: null,
    language: null,
    version_label: null,
    enabled: true,
    isNew: true,
    markedForDeletion: false,
  }
}

const mediaRows = ref<EditableMedia[]>((mediaData.value ?? []).map(toEditableMedia))

function resyncMediaRows() {
  mediaRows.value = (mediaData.value ?? []).map(toEditableMedia)
}

const isDirty = computed(() => mediaRows.value.some((r: EditableMedia) => r.isNew || r.markedForDeletion))

type SaveState = 'idle' | 'dirty' | 'saving' | 'success' | 'error'
const saving = ref(false)
const saveError = ref('')
const justSaved = ref(false)

const saveState = computed<SaveState>(() => {
  if (saving.value) return 'saving'
  if (saveError.value) return 'error'
  if (justSaved.value) return 'success'
  return isDirty.value ? 'dirty' : 'idle'
})

watch(isDirty, (dirty: boolean) => {
  if (dirty) { justSaved.value = false; saveError.value = '' }
})

// ── Media Library picker: browsing the library is read-only — nothing here
//    or anywhere else on this page issues a write until handleSave() runs. ──
const libraryOpen = ref(false)
const libraryFiles = ref<LibraryFile[]>([])
const libraryLoading = ref(false)
const libraryError = ref(false)
const libraryTotal = ref(0)
const librarySearch = ref('')
const libraryTypeFilter = ref<LibraryTypeFilter>('')
const LIB_PAGE = 60
const libraryOffset = ref(0)
let librarySearchTimer: ReturnType<typeof setTimeout>

/**
 * MEDIA-AI-LINK-PICKER-01 — the picker browses the Media Library tree instead of
 * listing every file in the library newest-first.
 *
 * `libraryFolder` is where it is looking: `null` is the library root,
 * `UNCLASSIFIED_FOLDER` the files in no folder, anything else a folder id. It
 * survives closing the picker, because linking three sources for one model
 * otherwise means walking back down to the same folder three times.
 */
const libraryFolder = ref<string | null>(null)
const libraryFolders = ref<FolderNode[]>([])
const libraryFoldersError = ref(false)

/**
 * Only the newest request may fill the list. Clicking through folders makes it
 * easy to move on before a slow response arrives, and without this the previous
 * folder's files could land under the new folder's breadcrumb.
 */
let libraryRequest = 0

async function loadLibraryFiles(reset = false) {
  const request = ++libraryRequest
  if (reset) { libraryOffset.value = 0; libraryFiles.value = []; libraryTotal.value = 0 }
  libraryError.value = false
  const state = { folder: libraryFolder.value, search: librarySearch.value, type: libraryTypeFilter.value }
  // At the root with nothing narrowed there is no honest file list to show — only folders.
  if (!libraryShowsFiles(state)) {
    libraryLoading.value = false
    return
  }
  libraryLoading.value = true
  try {
    const res = await $fetch<{ data: LibraryFile[], meta?: { filter_count: number } }>('/api/admin/media/files', {
      query: buildLibraryFilesQuery({ ...state, limit: LIB_PAGE, offset: libraryOffset.value }),
    })
    if (request !== libraryRequest) return
    libraryFiles.value = reset ? (res.data ?? []) : [...libraryFiles.value, ...(res.data ?? [])]
    libraryTotal.value = res.meta?.filter_count ?? res.data?.length ?? 0
    libraryOffset.value += res.data?.length ?? 0
  } catch {
    if (request === libraryRequest) libraryError.value = true
  } finally {
    if (request === libraryRequest) libraryLoading.value = false
  }
}

/** The whole folder tree, re-read on every open so a folder created or renamed in Media Library meanwhile is current. */
async function loadLibraryFolders() {
  libraryFoldersError.value = false
  try {
    libraryFolders.value = await $fetch<FolderNode[]>('/api/admin/media/folders')
  } catch {
    libraryFoldersError.value = true
  }
}

async function openLibrary() {
  libraryOpen.value = true
  loadLibraryFiles(true)
  await loadLibraryFolders()
  // A remembered folder that no longer exists cannot be browsed; fall back to the root.
  const folderId = libraryFolder.value
  if (folderId !== null && folderId !== UNCLASSIFIED_FOLDER && !libraryFoldersError.value
    && !flattenFolderTree(libraryFolders.value).some(f => f.id === folderId)) {
    libraryFolder.value = null
  }
}

function closeLibrary() {
  libraryOpen.value = false
}

function navigateLibraryFolder(folderId: string | null) {
  // The folder watcher reloads with the current search, so a pending search reload is redundant.
  clearTimeout(librarySearchTimer)
  libraryFolder.value = folderId
}

function updateLibrarySearch(value: string) {
  librarySearch.value = value
}

function updateLibraryTypeFilter(value: LibraryTypeFilter) {
  libraryTypeFilter.value = value
}

watch(librarySearch, () => {
  clearTimeout(librarySearchTimer)
  librarySearchTimer = setTimeout(() => loadLibraryFiles(true), 350)
})
watch([libraryFolder, libraryTypeFilter], () => loadLibraryFiles(true))

const existingFileIds = computed(() => new Set(mediaRows.value.map((r: EditableMedia) => r.directus_files_id)))

// ── Local-only staging. Neither of these ever issues a write request. ───────

function stageLink(fileId: string) {
  if (existingFileIds.value.has(fileId)) return
  const file = libraryFiles.value.find((f: LibraryFile) => f.id === fileId)
  if (!file) return
  mediaRows.value.push(fromLibraryFile(file))
  closeLibrary()
}

/** Toggles a row's pending state: a brand-new row is discarded outright; an
 * already-saved row is marked/unmarked for removal — either way, nothing is
 * sent to the server until Save. */
function unstage(rowIndex: number) {
  const row = mediaRows.value[rowIndex]
  if (!row) return
  if (row.isNew) {
    mediaRows.value.splice(rowIndex, 1)
    return
  }
  row.markedForDeletion = !row.markedForDeletion
}

// ── Save: the only place that ever issues a write request ───────────────────

async function handleSave() {
  if (!isDirty.value || saving.value) return
  saving.value = true
  saveError.value = ''

  try {
    for (const row of mediaRows.value) {
      if (row.isNew) {
        await $fetch(`/api/admin/products/${productId}/media`, {
          method: 'POST',
          body: { directus_files_id: row.directus_files_id, file_role: null },
        })
      } else if (row.markedForDeletion) {
        await $fetch(`/api/admin/products/${productId}/media/${row.id}`, { method: 'DELETE' })
      }
    }

    await refreshMedia()
    resyncMediaRows()
    justSaved.value = true
    setTimeout(() => { justSaved.value = false }, 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    saveError.value = fe.data?.message ?? 'Save failed. Your unsaved changes are kept — try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="notFound" class="ws-not-found">
    <p class="ws-not-found-title">Product not found</p>
    <p class="ws-not-found-hint">
      No product record exists for ID "{{ id }}", or it could not be loaded.
    </p>
    <NuxtLink to="/admin/products" class="ws-not-found-link">← Back to Product Center</NuxtLink>
  </div>

  <WorkspaceShell
    v-else
    :product="(product as AdminProduct)"
    title="Media & resources"
    :preview-href="previewHref"
    :save-state="saveState"
    @save="handleSave"
  >
    <template #nav>
      <WorkspaceModuleNav
        :product-id="(product as AdminProduct).id"
        :product-name="(product as AdminProduct).name_en"
        :product-code="(product as AdminProduct).product_code"
        :product-status="(product as AdminProduct).status"
        :product-hero-url="workspaceHeroUrl(product as AdminProduct)"
        active-key="media-resources"
      />
    </template>

    <p v-if="saveError" class="ws-save-error" role="alert">{{ saveError }}</p>

    <WorkspaceMediaResources
      :media="mediaRows"
      :library-open="libraryOpen"
      :library-files="libraryFiles"
      :library-loading="libraryLoading"
      :library-error="libraryError"
      :library-total="libraryTotal"
      :library-search="librarySearch"
      :library-type-filter="libraryTypeFilter"
      :library-folders="libraryFolders"
      :library-folders-error="libraryFoldersError"
      :library-folder-id="libraryFolder"
      @open-library="openLibrary"
      @close-library="closeLibrary"
      @update-search="updateLibrarySearch"
      @update-type-filter="updateLibraryTypeFilter"
      @navigate-folder="navigateLibraryFolder"
      @retry-folders="loadLibraryFolders"
      @retry-files="loadLibraryFiles(true)"
      @load-more="loadLibraryFiles(false)"
      @pick-file="stageLink"
      @unlink="unstage"
    />
  </WorkspaceShell>
</template>

<style scoped>
.ws-not-found {
  max-width: 480px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  text-align: center;
}

.ws-not-found-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-2);
}

.ws-not-found-hint {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
}

.ws-not-found-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

.ws-not-found-link:hover { text-decoration: underline; }

.ws-save-error {
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}
</style>
