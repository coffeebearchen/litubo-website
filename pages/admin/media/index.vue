<script setup lang="ts">
import type { FolderNode } from '~/server/api/admin/media/folders.get'

definePageMeta({ layout: 'admin' })

interface MediaFile {
  id: string
  filename_disk: string | null
  filename_download: string | null
  title: string | null
  description: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  folder: string | null
  uploaded_on: string | null
  focal_point_x: number | null
  focal_point_y: number | null
}

interface ApiFilesResult {
  data: MediaFile[]
  meta?: { total_count: number; filter_count: number }
}

// ── State ─────────────────────────────────────────────────────────────────────
const selectedFolder = ref<string | null>(null)   // null = all files
const searchQuery = ref('')
const typeFilter = ref<'' | 'image' | 'pdf'>('')
const offset = ref(0)
const PAGE = 100

const files = ref<MediaFile[]>([])
const totalCount = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const selectedFile = ref<MediaFile | null>(null)
const editForm = ref({ title: '', description: '', folder: '' })
const editSaving = ref(false)

// Upload state
const uploading = ref(false)
const uploadErrors = ref<Array<{ filename: string; message: string }>>([])
const uploadFolder = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// Multi-select
const selectedIds = ref<Set<string>>(new Set())
const batchMovingFolder = ref(false)
const batchTargetFolder = ref('')

// Lifecycle / archived filter
const showArchivedView = ref(false)
const archivedFileIds = ref<Set<string>>(new Set())

// Mobile: show legacy section
const showLegacyMobile = ref(false)

// Detail panel: references + lifecycle
interface RefsResult {
  product_count: number
  section_count: number
  total: number
  can_archive: boolean
  references: Array<{ product_id: number; product_name: string; file_role: string }>
}
const detailRefs = ref<RefsResult | null>(null)
const detailArchived = ref(false)
const detailRefsLoading = ref(false)
const archiveConfirm = ref(false)
const restoreConfirm = ref(false)
const lifecycleWorking = ref(false)

// Folder tree
const { data: foldersData } = await useFetch<FolderNode[]>('/api/admin/media/folders')
const folderTree = computed(() => foldersData.value ?? [])

// Flat folder map id→name
const folderMap = computed(() => {
  const m: Record<string, string> = {}
  function walk(nodes: FolderNode[]) {
    for (const n of nodes) { m[n.id] = n.name; walk(n.children) }
  }
  walk(folderTree.value)
  return m
})

// Parent map id→parentId (null = root)
const parentMap = computed(() => {
  const m: Record<string, string | null> = {}
  function walk(nodes: FolderNode[], pid: string | null = null) {
    for (const n of nodes) { m[n.id] = pid; walk(n.children, n.id) }
  }
  walk(folderTree.value)
  return m
})

// Full display path: "products / xray"
function folderPath(folderId: string | null): string {
  if (!folderId) return 'Unclassified'
  const parts: string[] = []
  let id: string | null = folderId
  while (id) {
    const name = folderMap.value[id]
    if (name) parts.unshift(name)
    id = parentMap.value[id] ?? null
  }
  return parts.join(' / ') || '—'
}

// Flatten all folders (for folderMap, parentMap building)
type FlatFolder = { id: string; name: string; depth: number; policy_state: FolderNode['policy_state']; allow_upload: boolean; allow_move_target: boolean }
function flattenFolders(nodes: FolderNode[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = []
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth, policy_state: n.policy_state, allow_upload: n.allow_upload, allow_move_target: n.allow_move_target })
    result.push(...flattenFolders(n.children, depth + 1))
  }
  return result
}
const flatFolders = computed(() => flattenFolders(folderTree.value))

// Filter folder tree: show active-canonical and container-only in sidebar "正式目录"
function filterCanonicalTree(nodes: FolderNode[]): FolderNode[] {
  return nodes
    .filter(n => n.policy_state === 'active-canonical' || n.policy_state === 'container-only')
    .map(n => ({ ...n, children: filterCanonicalTree(n.children) }))
}
const canonicalTree = computed(() => filterCanonicalTree(folderTree.value))
const canonicalFlatFolders = computed(() => flattenFolders(canonicalTree.value))
// Write-target dropdown: only active-canonical (allow_upload) folders
const uploadableFlatFolders = computed(() => flatFolders.value.filter((f: FlatFolder) => f.allow_upload))

// Legacy folders (flat, for sidebar Legacy tier)
const legacyFlatFolders = computed(() =>
  flatFolders.value.filter((f: FlatFolder) => f.policy_state === 'legacy-read-only')
)

// Conflict-frozen folders (flat, for sidebar Conflict tier — browsable, not writable)
const conflictFlatFolders = computed(() =>
  flatFolders.value.filter((f: FlatFolder) => f.policy_state === 'conflict-frozen')
)

// ── File loading ──────────────────────────────────────────────────────────────
async function loadFiles(reset = false) {
  if (reset) { offset.value = 0; files.value = [] }
  loading.value = true
  errorMsg.value = ''
  try {
    if (showArchivedView.value) {
      const lcRes = await $fetch<{ data: Array<{ file_id: string }> }>('/api/admin/media/lifecycle')
      archivedFileIds.value = new Set(lcRes.data.map(r => r.file_id))
      const uuids = lcRes.data.map(r => r.file_id)
      if (uuids.length === 0) {
        files.value = []; totalCount.value = 0; return
      }
      const allFiles: MediaFile[] = []
      for (const uuid of uuids) {
        try {
          const res = await $fetch<ApiFilesResult>('/api/admin/media/files', {
            query: { search: uuid, limit: '1' },
          })
          if (res.data?.length) allFiles.push(res.data[0])
        } catch { /* skip */ }
      }
      files.value = allFiles
      totalCount.value = allFiles.length
    } else {
      const params: Record<string, string> = {
        limit: String(PAGE),
        offset: String(offset.value),
      }
      if (selectedFolder.value) params.folder = selectedFolder.value
      if (typeFilter.value) params.type = typeFilter.value
      if (searchQuery.value.trim()) params.search = searchQuery.value.trim()

      const res = await $fetch<ApiFilesResult>('/api/admin/media/files', { query: params })
      if (reset) {
        files.value = res.data ?? []
      } else {
        files.value = [...files.value, ...(res.data ?? [])]
      }
      totalCount.value = res.meta?.filter_count ?? res.data?.length ?? 0
      offset.value += res.data?.length ?? 0
    }
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Failed to load files'
  } finally {
    loading.value = false
  }
}

async function loadArchivedIds() {
  try {
    const res = await $fetch<{ data: Array<{ file_id: string }> }>('/api/admin/media/lifecycle')
    archivedFileIds.value = new Set(res.data.map(r => r.file_id))
  } catch {
    archivedFileIds.value = new Set()
  }
}

onMounted(() => {
  loadFiles(true)
  loadArchivedIds()
})

watch([selectedFolder, typeFilter, showArchivedView], () => loadFiles(true))

let searchTimer: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadFiles(true), 350)
})

// ── Folder navigation ─────────────────────────────────────────────────────────
function selectFolder(id: string | null) {
  showArchivedView.value = false
  selectedFolder.value = id
}

function toggleArchivedView() {
  showArchivedView.value = !showArchivedView.value
  if (showArchivedView.value) selectedFolder.value = null
}

// Label for the current view (breadcrumb-style topbar heading)
const currentViewLabel = computed(() => {
  if (showArchivedView.value) return 'Archived'
  if (selectedFolder.value === null) return 'All files'
  if (selectedFolder.value === 'root') return 'Unclassified'
  return folderPath(selectedFolder.value)
})

// ── Multi-select ──────────────────────────────────────────────────────────────
function toggleSelect(id: string, evt: Event) {
  evt.stopPropagation()
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function clearSelection() {
  selectedIds.value = new Set()
  batchTargetFolder.value = ''
}

async function batchMoveToFolder() {
  if (!batchTargetFolder.value || selectedIds.value.size === 0) return
  batchMovingFolder.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ moved: number; failed: number; errors?: unknown[] }>(
      '/api/admin/media/batch-move',
      { method: 'POST', body: { file_ids: [...selectedIds.value], folder: batchTargetFolder.value } },
    )
    if (res.failed === 0) {
      successMsg.value = `Moved ${res.moved} file(s) to ${folderPath(batchTargetFolder.value)}`
      setTimeout(() => (successMsg.value = ''), 3000)
      clearSelection()
      await loadFiles(true)
    } else {
      errorMsg.value = `${res.failed} of ${res.moved + res.failed} file(s) failed to move — please retry`
    }
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Batch move failed'
  } finally {
    batchMovingFolder.value = false
  }
}

// ── File detail ───────────────────────────────────────────────────────────────
async function openFile(f: MediaFile) {
  selectedFile.value = f
  editForm.value = {
    title: f.title ?? '',
    description: f.description ?? '',
    // Keep actual folder UUID — dropdown will show blank if it's a legacy folder,
    // which is intentional (user must pick canonical or leave unchanged).
    folder: f.folder ?? '',
  }
  editSaving.value = false
  archiveConfirm.value = false
  restoreConfirm.value = false
  detailRefs.value = null
  detailArchived.value = archivedFileIds.value.has(f.id)
  await loadDetailRefs(f.id)
}

function closeDetail() {
  selectedFile.value = null
  detailRefs.value = null
  archiveConfirm.value = false
  restoreConfirm.value = false
}

async function loadDetailRefs(uuid: string) {
  detailRefsLoading.value = true
  try {
    const res = await $fetch<RefsResult>(`/api/admin/media/${uuid}/references`)
    detailRefs.value = res
  } catch {
    detailRefs.value = null
  } finally {
    detailRefsLoading.value = false
  }
}

async function archiveFile() {
  if (!selectedFile.value) return
  lifecycleWorking.value = true
  archiveConfirm.value = false
  errorMsg.value = ''
  try {
    await $fetch(`/api/admin/media/${selectedFile.value.id}/archive`, { method: 'POST' })
    successMsg.value = 'File archived'
    setTimeout(() => (successMsg.value = ''), 3000)
    detailArchived.value = true
    archivedFileIds.value = new Set([...archivedFileIds.value, selectedFile.value.id])
    await loadDetailRefs(selectedFile.value.id)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Archive failed'
  } finally {
    lifecycleWorking.value = false
  }
}

async function restoreFile() {
  if (!selectedFile.value) return
  lifecycleWorking.value = true
  restoreConfirm.value = false
  errorMsg.value = ''
  try {
    await $fetch(`/api/admin/media/${selectedFile.value.id}/restore`, { method: 'POST' })
    successMsg.value = 'File restored'
    setTimeout(() => (successMsg.value = ''), 3000)
    detailArchived.value = false
    const ids = new Set(archivedFileIds.value)
    ids.delete(selectedFile.value.id)
    archivedFileIds.value = ids
    await loadDetailRefs(selectedFile.value.id)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Restore failed'
  } finally {
    lifecycleWorking.value = false
  }
}

async function saveMetadata() {
  if (!selectedFile.value) return
  editSaving.value = true
  errorMsg.value = ''
  try {
    const payload: Record<string, unknown> = {}
    if (editForm.value.title !== (selectedFile.value.title ?? '')) {
      payload.title = editForm.value.title
    }
    if (editForm.value.description !== (selectedFile.value.description ?? '')) {
      payload.description = editForm.value.description
    }
    // Only send folder if it actually changed; server enforces policy
    const currentFolder = selectedFile.value.folder ?? ''
    if (editForm.value.folder !== currentFolder) {
      payload.folder = editForm.value.folder || null
    }
    if (Object.keys(payload).length === 0) {
      editSaving.value = false
      return
    }
    await $fetch(`/api/admin/media/${selectedFile.value.id}/meta`, {
      method: 'PATCH',
      body: payload,
    })
    successMsg.value = 'Metadata saved'
    setTimeout(() => (successMsg.value = ''), 3000)
    Object.assign(selectedFile.value, {
      title: editForm.value.title || null,
      description: editForm.value.description || null,
      folder: editForm.value.folder || null,
    })
    await loadFiles(true)
    closeDetail()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Save failed'
  } finally {
    editSaving.value = false
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────
function triggerUpload() {
  fileInputRef.value?.click()
}

async function onFilesSelected(evt: Event) {
  const input = evt.target as HTMLInputElement
  const fileList = input.files
  if (!fileList || fileList.length === 0) return

  uploading.value = true
  uploadErrors.value = []
  errorMsg.value = ''

  const uploadPromises: Promise<void>[] = []
  const allErrors: Array<{ filename: string; message: string }> = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    uploadPromises.push(
      (async () => {
        const fd = new FormData()
        fd.append('file', file, file.name)
        // Server enforces folder policy; pass folder UUID if selected
        if (uploadFolder.value) fd.append('folder', uploadFolder.value)
        try {
          const res = await $fetch<{ uploaded: unknown[]; errors: Array<{ filename: string; message: string }> }>(
            '/api/admin/media/upload',
            { method: 'POST', body: fd },
          )
          if (res.errors?.length) allErrors.push(...res.errors)
        } catch (e: unknown) {
          const fe = e as { data?: { message?: string } }
          allErrors.push({ filename: file.name, message: fe.data?.message ?? 'Upload failed' })
        }
      })(),
    )
  }

  await Promise.all(uploadPromises)
  uploading.value = false
  uploadErrors.value = allErrors
  input.value = ''

  if (allErrors.length < fileList.length) {
    const okCount = fileList.length - allErrors.length
    successMsg.value = `${okCount} file(s) uploaded successfully`
    setTimeout(() => (successMsg.value = ''), 4000)
    await loadFiles(true)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isImage(type: string | null | undefined) {
  return (type ?? '').startsWith('image/')
}

function thumbUrl(id: string) {
  return `/api/admin/media/${id}?width=240&height=180&fit=cover`
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatType(type: string | null | undefined) {
  if (!type) return '—'
  if (type === 'application/pdf') return 'PDF'
  return type.split('/')[1]?.toUpperCase() ?? type
}

const hasMore = computed(() => files.value.length < totalCount.value)

// Whether the currently selected file's folder is legacy (highlight "move" call to action)
const selectedFileFolderIsLegacy = computed(() => {
  if (!selectedFile.value?.folder) return false
  const entry = flatFolders.value.find((f: FlatFolder) => f.id === selectedFile.value!.folder)
  return entry?.policy_state === 'legacy-read-only'
})
</script>

<template>
  <div class="ml-shell">
    <!-- Top bar -->
    <div class="ml-topbar">
      <div class="ml-breadcrumb">
        <span class="breadcrumb-root">Media Library</span>
        <template v-if="currentViewLabel !== 'All files'">
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">{{ currentViewLabel }}</span>
        </template>
      </div>

      <div class="ml-topbar-actions">
        <!-- Batch actions -->
        <template v-if="selectedIds.size > 0">
          <span class="selection-count">{{ selectedIds.size }} selected</span>
          <select v-model="batchTargetFolder" class="folder-select" title="Move to approved folder">
            <option value="">— Move to approved folder —</option>
            <option v-for="f in uploadableFlatFolders" :key="f.id" :value="f.id">
              {{ '—'.repeat(f.depth) + (f.depth > 0 ? ' ' : '') }}{{ f.name }}
            </option>
          </select>
          <button class="btn-batch-move" :disabled="batchMovingFolder || !batchTargetFolder" @click="batchMoveToFolder">
            {{ batchMovingFolder ? 'Moving…' : 'Move' }}
          </button>
          <button class="btn-cancel-sel" @click="clearSelection">Deselect all</button>
        </template>

        <!-- Upload actions -->
        <template v-else>
          <select v-model="uploadFolder" class="folder-select" title="Upload destination folder">
            <option value="">— Needs Classification —</option>
            <option v-for="f in uploadableFlatFolders" :key="f.id" :value="f.id">
              {{ '—'.repeat(f.depth) + (f.depth > 0 ? ' ' : '') }}{{ f.name }}
            </option>
          </select>
          <button class="btn-upload" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? 'Uploading…' : 'Upload files' }}
          </button>
        </template>
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.tsv,image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,text/tab-separated-values"
          class="hidden-input"
          @change="onFilesSelected"
        >
      </div>
    </div>

    <!-- Search + filter bar -->
    <div class="ml-filterbar">
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Search by filename or title…"
      >
      <select v-model="typeFilter" class="type-select">
        <option value="">All formats</option>
        <option value="image">Image</option>
        <option value="pdf">PDF</option>
      </select>
      <span class="file-count">{{ totalCount }} file(s)</span>
    </div>

    <!-- Banners -->
    <div v-if="errorMsg" class="banner banner--error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="banner banner--success">{{ successMsg }}</div>
    <div v-if="uploadErrors.length" class="banner banner--warn">
      <strong>Some files failed to upload:</strong>
      <ul class="error-list">
        <li v-for="e in uploadErrors" :key="e.filename">
          <strong>{{ e.filename }}</strong>：{{ e.message }}
        </li>
      </ul>
    </div>

    <div class="ml-body">
      <!-- ── Left sidebar ─────────────────────────────────────────────────── -->
      <aside class="ml-sidebar">
        <!-- Tier 1: System Views -->
        <p class="sidebar-section-label">System views</p>
        <button
          class="folder-item"
          :class="{ 'folder-item--active': selectedFolder === null && !showArchivedView }"
          @click="selectFolder(null)"
        >All files</button>
        <button
          class="folder-item"
          :class="{ 'folder-item--active': selectedFolder === 'root' && !showArchivedView }"
          @click="selectFolder('root')"
        >Unclassified</button>
        <button
          class="folder-item folder-item--archived"
          :class="{ 'folder-item--active': showArchivedView }"
          @click="toggleArchivedView"
        >Archived</button>

        <!-- Tier 2: Active destinations -->
        <div class="sidebar-divider" />
        <p class="sidebar-section-label">Active destinations</p>
        <template v-for="f in canonicalFlatFolders" :key="f.id">
          <button
            class="folder-item"
            :class="{ 'folder-item--active': selectedFolder === f.id && !showArchivedView }"
            :style="{ paddingLeft: `calc(var(--space-3) + ${f.depth * 10}px)` }"
            @click="selectFolder(f.id)"
          >{{ f.name }}</button>
        </template>
        <p v-if="canonicalFlatFolders.length === 0" class="sidebar-empty">No active folders</p>

        <!-- Tier 3: Legacy — read only -->
        <template v-if="legacyFlatFolders.length > 0">
          <div class="sidebar-divider" />
          <!-- Mobile: toggle -->
          <button class="sidebar-legacy-toggle mobile-only" @click="showLegacyMobile = !showLegacyMobile">
            Legacy (read only) {{ showLegacyMobile ? '▲' : '▼' }}
          </button>
          <p class="sidebar-section-label desktop-only">Legacy — read only</p>
          <template v-for="f in legacyFlatFolders" :key="f.id">
            <button
              v-show="showLegacyMobile"
              class="folder-item folder-item--legacy"
              :class="{
                'folder-item--active': selectedFolder === f.id && !showArchivedView,
                'mobile-legacy-hidden': !showLegacyMobile,
              }"
              :style="{ paddingLeft: `calc(var(--space-3) + ${f.depth * 10}px)` }"
              @click="selectFolder(f.id)"
            >{{ f.name }}</button>
          </template>
        </template>

        <!-- Tier 4: Conflict — read only -->
        <template v-if="conflictFlatFolders.length > 0">
          <div class="sidebar-divider" />
          <p class="sidebar-section-label">Conflict — read only</p>
          <template v-for="f in conflictFlatFolders" :key="f.id">
            <button
              class="folder-item folder-item--conflict"
              :class="{ 'folder-item--active': selectedFolder === f.id && !showArchivedView }"
              :style="{ paddingLeft: `calc(var(--space-3) + ${f.depth * 10}px)` }"
              @click="selectFolder(f.id)"
            >{{ f.name }}</button>
          </template>
        </template>
      </aside>

      <!-- ── Main content ──────────────────────────────────────────────────── -->
      <div class="ml-main">
        <!-- Loading -->
        <div v-if="loading && files.length === 0" class="loading-state">
          <span class="loading-dot" />Loading…
        </div>

        <!-- Empty -->
        <div v-else-if="!loading && files.length === 0" class="empty-state">
          <p class="empty-title">No files found</p>
          <p class="empty-hint">
            <template v-if="showArchivedView">No archived files</template>
            <template v-else-if="selectedFolder === 'root'">All files have been moved to approved folders</template>
            <template v-else>Click "Upload files" to add media assets</template>
          </p>
        </div>

        <!-- File grid -->
        <div v-else class="file-grid">
          <div
            v-for="f in files"
            :key="f.id"
            class="file-card"
            :class="{
              'file-card--selected': selectedFile?.id === f.id,
              'file-card--checked': selectedIds.has(f.id),
              'file-card--archived': archivedFileIds.has(f.id),
            }"
            role="button"
            tabindex="0"
            @click="openFile(f)"
            @keydown.enter="openFile(f)"
          >
            <label class="file-card__check" @click.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(f.id)"
                class="check-input"
                @change="toggleSelect(f.id, $event)"
              >
            </label>
            <span v-if="archivedFileIds.has(f.id)" class="archived-badge">Archived</span>
            <div class="file-card__thumb">
              <img
                v-if="isImage(f.type)"
                :src="thumbUrl(f.id)"
                :alt="f.title ?? f.filename_download ?? ''"
                class="file-card__img"
                loading="lazy"
              >
              <div v-else class="file-card__icon">
                <span v-if="f.type === 'application/pdf'" class="icon-pdf">PDF</span>
                <span v-else class="icon-file">FILE</span>
              </div>
            </div>
            <div class="file-card__info">
              <p class="file-card__title">{{ f.title ?? f.filename_download ?? f.id.slice(0, 8) }}</p>
              <p class="file-card__meta">
                <span class="meta-type">{{ formatType(f.type) }}</span>
                <span class="meta-size">{{ formatSize(f.filesize) }}</span>
              </p>
              <!-- Folder path — single source of truth from server data -->
              <p class="file-card__folder">
                <span v-if="f.folder && folderMap[f.folder]">{{ folderPath(f.folder) }}</span>
                <span v-else class="folder-unset">Unclassified</span>
              </p>
            </div>
          </div>
        </div>

        <div v-if="hasMore && !loading" class="load-more">
          <button class="btn-load-more" @click="loadFiles(false)">
            Load more ({{ totalCount - files.length }} remaining)
          </button>
        </div>
        <div v-if="loading && files.length > 0" class="loading-inline">Loading…</div>
      </div>

      <!-- ── Detail panel ──────────────────────────────────────────────────── -->
      <aside v-if="selectedFile" class="ml-detail">
        <div class="detail-header">
          <h3 class="detail-title">File details</h3>
          <button class="detail-close" aria-label="Close" @click="closeDetail">✕</button>
        </div>

        <!-- Preview -->
        <div class="detail-preview">
          <img
            v-if="isImage(selectedFile.type)"
            :src="thumbUrl(selectedFile.id)"
            :alt="selectedFile.title ?? ''"
            class="detail-preview__img"
          >
          <div v-else class="detail-preview__icon">{{ formatType(selectedFile.type) }}</div>
        </div>

        <!-- File facts (read-only) — single source of truth from selectedFile -->
        <dl class="detail-info">
          <dt>Filename</dt>
          <dd>{{ selectedFile.filename_download ?? selectedFile.filename_disk ?? '—' }}</dd>
          <dt>Format</dt>
          <dd>{{ selectedFile.type ?? '—' }}</dd>
          <template v-if="selectedFile.width && selectedFile.height">
            <dt>Resolution</dt>
            <dd>{{ selectedFile.width }} × {{ selectedFile.height }}</dd>
          </template>
          <dt>Size</dt>
          <dd>{{ formatSize(selectedFile.filesize) }}</dd>
          <dt>Uploaded</dt>
          <dd>{{ selectedFile.uploaded_on ? selectedFile.uploaded_on.slice(0, 10) : '—' }}</dd>
          <!-- Current folder path — always from server data, never from editForm -->
          <dt>Current path</dt>
          <dd :class="{ 'path-legacy': selectedFileFolderIsLegacy, 'path-unset': !selectedFile.folder }">
            {{ folderPath(selectedFile.folder) }}
            <span v-if="selectedFileFolderIsLegacy" class="legacy-tag">Legacy</span>
          </dd>
        </dl>

        <!-- Used in / References + lifecycle -->
        <div class="detail-lifecycle">
          <div class="lifecycle-header">
            <span class="lifecycle-label">Reference status</span>
            <span v-if="detailArchived" class="lifecycle-archived-tag">Archived</span>
          </div>

          <div v-if="detailRefsLoading" class="lifecycle-loading">Loading references…</div>
          <div v-else-if="detailRefs" class="lifecycle-refs">
            <p v-if="detailRefs.total === 0" class="refs-none">Not referenced — safe to archive</p>
            <template v-else>
              <p class="refs-count">
                Referenced {{ detailRefs.total }} time(s)
                by {{ detailRefs.product_count }} product(s)
              </p>
              <p class="refs-note">ALT / caption / file_role are set in product or content references and cannot be edited here</p>
              <ul v-if="detailRefs.references.length" class="refs-list">
                <li v-for="ref in detailRefs.references" :key="`${ref.product_id}-${ref.file_role}`">
                  {{ ref.product_name }} · <code>{{ ref.file_role }}</code>
                </li>
              </ul>
            </template>
          </div>
          <div v-else class="lifecycle-loading">Reference information unavailable</div>

          <!-- Archive action -->
          <div v-if="!detailArchived" class="lifecycle-action">
            <template v-if="!archiveConfirm">
              <button
                class="btn-lifecycle btn-archive"
                :disabled="lifecycleWorking || !detailRefs || !detailRefs.can_archive"
                :title="detailRefs && !detailRefs.can_archive ? 'Referenced by a product — cannot archive' : (detailRefs ? '' : 'Reference information unavailable')"
                @click="archiveConfirm = true"
              >Archive file</button>
            </template>
            <template v-else>
              <p class="confirm-msg">Archive this file? It can be restored at any time.</p>
              <div class="confirm-btns">
                <button class="btn-lifecycle btn-archive-confirm" :disabled="lifecycleWorking" @click="archiveFile">
                  {{ lifecycleWorking ? 'Archiving…' : 'Confirm archive' }}
                </button>
                <button class="btn-lifecycle btn-lifecycle-cancel" @click="archiveConfirm = false">Cancel</button>
              </div>
            </template>
          </div>

          <!-- Restore action -->
          <div v-if="detailArchived" class="lifecycle-action">
            <template v-if="!restoreConfirm">
              <button class="btn-lifecycle btn-restore" :disabled="lifecycleWorking" @click="restoreConfirm = true">
                Restore file
              </button>
            </template>
            <template v-else>
              <p class="confirm-msg">Restore this file?</p>
              <div class="confirm-btns">
                <button class="btn-lifecycle btn-restore-confirm" :disabled="lifecycleWorking" @click="restoreFile">
                  {{ lifecycleWorking ? 'Restoring…' : 'Confirm restore' }}
                </button>
                <button class="btn-lifecycle btn-lifecycle-cancel" @click="restoreConfirm = false">Cancel</button>
              </div>
            </template>
          </div>
        </div>

        <!-- Editable metadata -->
        <div class="detail-edit">
          <!-- Legacy folder warning -->
          <div v-if="selectedFileFolderIsLegacy" class="legacy-notice">
            This file is in a legacy folder (read only). Move it to an approved folder.
          </div>

          <div class="field-row">
            <label class="field-label">Title</label>
            <input v-model="editForm.title" type="text" class="field-input" placeholder="Display title" maxlength="255">
          </div>
          <div class="field-row">
            <label class="field-label">Internal description</label>
            <textarea
              v-model="editForm.description"
              class="field-textarea"
              placeholder="Internal notes (not shown publicly)"
              rows="3"
              maxlength="1000"
            />
          </div>
          <div class="field-row">
            <label class="field-label">Move to approved folder</label>
            <select v-model="editForm.folder" class="field-input">
              <option value="">— Needs Classification —</option>
              <option v-for="f in uploadableFlatFolders" :key="f.id" :value="f.id">
                {{ '—'.repeat(f.depth) + (f.depth > 0 ? ' ' : '') }}{{ f.name }}
              </option>
            </select>
            <p class="field-hint">Legacy folders are not listed; selecting a folder here overwrites the current path.</p>
          </div>
          <div class="detail-actions">
            <button class="btn-save" :disabled="editSaving" @click="saveMetadata">
              {{ editSaving ? 'Saving…' : 'Save' }}
            </button>
            <button class="btn-cancel" @click="closeDetail">Cancel</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ── */
.ml-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #F4F6F5;
}

/* ── Top bar ── */
.ml-topbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  background: white;
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
  flex-wrap: wrap;
  min-height: 56px;
}

/* Breadcrumb */
.ml-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.breadcrumb-root {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-ink);
}
.breadcrumb-sep {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}
.breadcrumb-current {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary-deep);
  overflow: hidden;
  text-overflow: ellipsis;
}

.ml-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.folder-select {
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
  min-width: 180px;
  max-width: 260px;
}

.btn-upload {
  height: 36px;
  padding: 0 var(--space-5);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast);
}
.btn-upload:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-upload:disabled { opacity: 0.55; cursor: not-allowed; }

.hidden-input { display: none; }

/* ── Filter bar ── */
.ml-filterbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-6);
  background: white;
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 160px;
  max-width: 400px;
  height: 34px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
}
.search-input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }

.type-select {
  height: 34px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
}

.file-count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  white-space: nowrap;
  margin-left: auto;
}

/* ── Banners ── */
.banner {
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  flex-shrink: 0;
}
.banner--error { background: #fdf0ee; color: #c0392b; border-bottom: 1px solid #f5c6c2; }
.banner--success { background: #d1f0e8; color: #0f5c4b; border-bottom: 1px solid #a3dbc8; }
.banner--warn { background: #fffbf0; color: #7a6030; border-bottom: 1px solid #f0e0b0; }
.error-list { margin: var(--space-1) 0 0 var(--space-4); padding: 0; }
.error-list li { margin: 2px 0; }

/* ── Body ── */
.ml-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Left sidebar ── */
.ml-sidebar {
  width: 190px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid var(--color-line);
  overflow-y: auto;
  padding: var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3) var(--space-1);
  margin: 0;
}

.sidebar-empty {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  padding: var(--space-1) var(--space-3);
  margin: 0;
  font-style: italic;
}

.folder-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.folder-item:hover { background: rgba(18, 60, 50, 0.05); color: var(--color-ink); }
.folder-item--active { background: rgba(18, 60, 50, 0.1); color: var(--color-primary-deep); font-weight: 600; }

/* Legacy folder items — italic + muted */
.folder-item--legacy {
  color: var(--color-ink-muted);
  font-style: italic;
  font-size: calc(var(--text-sm) - 1px);
}
.folder-item--legacy:hover { color: var(--color-ink); background: rgba(18,60,50,0.04); }
.folder-item--legacy.folder-item--active { background: rgba(18,60,50,0.08); color: var(--color-ink); font-weight: 600; }

.folder-item--conflict {
  color: #7a3a3a;
  font-style: italic;
  font-size: calc(var(--text-sm) - 1px);
}
.folder-item--conflict:hover { color: var(--color-ink); background: rgba(122,58,58,0.06); }
.folder-item--conflict.folder-item--active { background: rgba(122,58,58,0.1); color: var(--color-ink); font-weight: 600; }

/* Archived special item */
.folder-item--archived { color: #8a5a00; }
.folder-item--archived.folder-item--active { background: rgba(180,120,0,0.12); color: #7a4e00; font-weight: 600; }

.sidebar-divider { height: 1px; background: var(--color-line); margin: var(--space-2) var(--space-3); }

.sidebar-legacy-toggle {
  display: none; /* shown only on mobile via .mobile-only */
  width: 100%;
  text-align: left;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink-muted);
  background: none;
  border: none;
  cursor: pointer;
}

/* ── Main ── */
.ml-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── States ── */
.loading-state, .loading-inline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  padding: var(--space-4);
}
.loading-dot {
  width: 16px; height: 16px;
  border: 2px solid var(--color-line);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; padding: var(--space-16) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

/* ── File grid ── */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
}

.file-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: white;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.file-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(18,60,50,0.1); }
.file-card--selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(18,60,50,0.15); }
.file-card--checked { border-color: var(--color-primary); background: rgba(18,60,50,0.03); }
.file-card--archived { opacity: 0.65; }

.file-card__check {
  position: absolute; top: 6px; left: 6px; z-index: 2;
  display: flex; cursor: pointer;
}
.check-input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }

.archived-badge {
  position: absolute; top: 6px; right: 6px; z-index: 2;
  background: rgba(0,0,0,0.55); color: white;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 99px;
}

.file-card__thumb {
  height: 120px;
  background: #e8edf0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.file-card__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.file-card__icon { display: flex; align-items: center; justify-content: center; }
.icon-pdf {
  font-size: var(--text-sm); font-weight: 700;
  background: #e74c3c; color: white;
  padding: 6px 10px; border-radius: var(--radius-sm);
}
.icon-file {
  font-size: var(--text-xs); font-weight: 700;
  background: #7f8c8d; color: white;
  padding: 6px 10px; border-radius: var(--radius-sm);
}

.file-card__info { padding: var(--space-2) var(--space-3); flex: 1; min-width: 0; }
.file-card__title {
  font-size: var(--text-xs); font-weight: 600; color: var(--color-ink);
  margin: 0 0 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card__meta {
  display: flex; gap: var(--space-2); margin: 0;
}
.meta-type {
  font-size: 10px; font-weight: 600; color: var(--color-primary);
  background: #e8f4f1; padding: 1px 5px; border-radius: 99px;
}
.meta-size { font-size: 10px; color: var(--color-ink-muted); }
.file-card__folder {
  font-size: 10px; color: var(--color-ink-muted);
  margin: 2px 0 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.folder-unset { font-style: italic; }

/* ── Load more ── */
.load-more { text-align: center; padding: var(--space-4); }
.btn-load-more {
  height: 36px; padding: 0 var(--space-5);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: white; cursor: pointer;
}
.btn-load-more:hover { background: var(--color-line); }

/* ── Detail panel ── */
.ml-detail {
  width: 300px;
  flex-shrink: 0;
  background: white;
  border-left: 1px solid var(--color-line);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}
.detail-title { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink); margin: 0; }
.detail-close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  color: var(--color-ink-muted); border-radius: var(--radius-sm); font-size: var(--text-sm);
}
.detail-close:hover { background: var(--color-line); }

.detail-preview {
  width: 100%; height: 180px;
  background: #e8edf0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.detail-preview__img { width: 100%; height: 100%; object-fit: contain; display: block; }
.detail-preview__icon {
  font-size: var(--text-2xl); font-weight: 700;
  background: #7f8c8d; color: white;
  padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm);
}

/* File facts */
.detail-info {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin: 0;
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--color-line);
}
.detail-info dt { color: var(--color-ink-muted); white-space: nowrap; padding: 2px 0; }
.detail-info dd {
  color: var(--color-ink); margin: 0; padding: 2px 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.path-legacy { color: #8a5a00; }
.path-unset { color: var(--color-ink-muted); font-style: italic; }
.legacy-tag {
  display: inline-block;
  font-size: 9px; font-weight: 700;
  background: rgba(180,120,0,0.15); color: #8a5a00;
  padding: 0 4px; border-radius: 3px;
  margin-left: 4px; vertical-align: middle;
}

/* Lifecycle / references */
.detail-lifecycle {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-line);
  display: flex; flex-direction: column; gap: var(--space-2);
}
.lifecycle-header { display: flex; align-items: center; gap: var(--space-2); }
.lifecycle-label {
  font-size: 10px; font-weight: 700; color: var(--color-ink-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.lifecycle-archived-tag {
  font-size: 10px; font-weight: 700;
  background: rgba(180,120,0,0.15); color: #7a4e00;
  padding: 1px 8px; border-radius: 99px;
}
.lifecycle-loading { font-size: var(--text-xs); color: var(--color-ink-muted); }
.lifecycle-refs { display: flex; flex-direction: column; gap: var(--space-1); }
.refs-none { font-size: var(--text-xs); color: #0f5c4b; margin: 0; }
.refs-count { font-size: var(--text-xs); color: var(--color-ink); margin: 0; }
.refs-note {
  font-size: 10px; color: var(--color-ink-muted);
  background: #f8f8f8; border-radius: var(--radius-sm);
  padding: 4px 8px; margin: 2px 0 0; line-height: 1.5;
}
.refs-list {
  margin: var(--space-1) 0 0 var(--space-3); padding: 0;
  font-size: var(--text-xs); color: var(--color-ink-muted);
  list-style: disc; max-height: 80px; overflow-y: auto;
}
.refs-list li { margin: 1px 0; }
.refs-list code { font-size: 10px; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }

.lifecycle-action { display: flex; flex-direction: column; gap: var(--space-2); }
.confirm-msg { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.confirm-btns { display: flex; gap: var(--space-2); }

.btn-lifecycle {
  height: 32px; padding: 0 var(--space-3);
  border: none; border-radius: var(--radius-sm);
  font-size: var(--text-xs); font-weight: 600; cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast);
}
.btn-lifecycle:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-archive { background: #fef3e2; color: #8a5a00; border: 1px solid #f0d090; }
.btn-archive:hover:not(:disabled) { background: #fde8c0; }
.btn-archive-confirm { background: #e74c3c; color: white; }
.btn-archive-confirm:hover:not(:disabled) { background: #c0392b; }
.btn-restore { background: #e8f4f1; color: var(--color-primary-deep); border: 1px solid #a3dbc8; }
.btn-restore:hover:not(:disabled) { background: #d1f0e8; }
.btn-restore-confirm { background: var(--color-primary); color: white; }
.btn-restore-confirm:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-lifecycle-cancel { background: white; color: var(--color-ink-muted); border: 1px solid var(--color-line); }
.btn-lifecycle-cancel:hover { background: var(--color-line); }

/* Editable metadata */
.detail-edit { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); flex: 1; }

.legacy-notice {
  font-size: var(--text-xs);
  background: rgba(180,120,0,0.08);
  color: #8a5a00;
  border: 1px solid rgba(180,120,0,0.2);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  line-height: 1.5;
}

.field-row { display: flex; flex-direction: column; gap: var(--space-1); }
.field-label {
  font-size: 10px; font-weight: 700;
  color: var(--color-ink-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.field-input {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
  width: 100%;
}
.field-input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.field-textarea {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
  width: 100%;
  resize: vertical;
  font-family: inherit;
  line-height: var(--leading-normal);
}
.field-textarea:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.field-hint {
  font-size: 10px; color: var(--color-ink-muted);
  margin: 0; line-height: 1.4;
}

.detail-actions { display: flex; gap: var(--space-2); margin-top: auto; padding-top: var(--space-2); }
.btn-save {
  flex: 1; height: 36px;
  background: var(--color-primary); color: white; border: none;
  border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 600;
  cursor: pointer; transition: background var(--transition-fast);
}
.btn-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-cancel {
  height: 36px; padding: 0 var(--space-4);
  background: white; color: var(--color-ink-muted);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm); font-size: var(--text-sm); cursor: pointer;
}
.btn-cancel:hover { background: var(--color-line); }

/* ── Batch bar ── */
.selection-count {
  font-size: var(--text-sm); font-weight: 600;
  color: var(--color-primary-deep); white-space: nowrap;
}
.btn-batch-move {
  height: 36px; padding: 0 var(--space-4);
  background: var(--color-primary-deep); color: white;
  border: none; border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap;
}
.btn-batch-move:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-batch-move:hover:not(:disabled) { background: var(--color-primary); }
.btn-cancel-sel {
  height: 36px; padding: 0 var(--space-3);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink-muted);
  background: white; cursor: pointer;
}
.btn-cancel-sel:hover { background: var(--color-line); }

/* ── Responsive helpers ── */
.desktop-only { }
.mobile-only { display: none; }

/* ── Responsive 1024px ── */
@media (max-width: 1023px) {
  .ml-detail { width: 260px; }
}

/* ── Responsive 767px (375px) ── */
@media (max-width: 767px) {
  .ml-shell { height: auto; overflow: visible; }
  .ml-topbar { padding: var(--space-3) var(--space-4); min-height: auto; }
  .ml-filterbar { padding: var(--space-2) var(--space-4); }
  .file-count { display: none; }

  .ml-body { flex-direction: column; overflow: visible; }

  /* Sidebar: horizontal chips */
  .ml-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
    flex-direction: row;
    flex-wrap: wrap;
    overflow-x: auto;
    padding: var(--space-2);
    gap: var(--space-1);
  }

  .sidebar-section-label { display: none; }
  .sidebar-divider { display: none; }
  .sidebar-empty { display: none; }

  .folder-item {
    width: auto;
    flex-shrink: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-line);
    border-radius: 99px;
    font-size: var(--text-xs);
    font-style: normal;
  }
  .folder-item--active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
    font-weight: 600;
  }
  .folder-item--legacy { font-style: normal; }

  /* Mobile: legacy items hidden until toggle */
  @media (max-width: 767px) {
    .mobile-legacy-hidden { display: none; }
  }
  .sidebar-legacy-toggle {
    display: block;
    width: auto;
    flex-shrink: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px dashed var(--color-line);
    border-radius: 99px;
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    cursor: pointer;
    background: none;
  }
  .desktop-only { display: none; }

  .ml-main { padding: var(--space-3); overflow: visible; }
  .file-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-2); }

  /* Detail: full-width below grid */
  .ml-detail {
    width: 100%;
    border-left: none;
    border-top: 2px solid var(--color-primary);
  }

  .folder-select { min-width: 140px; max-width: 200px; }
}
</style>
