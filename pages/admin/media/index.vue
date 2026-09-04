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
const selectedFolder = ref<string | null>(null) // null = all, 'root' = uncategorised
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

// Folder tree
const { data: foldersData } = await useFetch<FolderNode[]>('/api/admin/media/folders')
const folderTree = computed(() => foldersData.value ?? [])

// Flat folder map id→name for display
const folderMap = computed(() => {
  const m: Record<string, string> = {}
  function walk(nodes: FolderNode[]) {
    for (const n of nodes) { m[n.id] = n.name; walk(n.children) }
  }
  walk(folderTree.value)
  return m
})

// ── File loading ──────────────────────────────────────────────────────────────
async function loadFiles(reset = false) {
  if (reset) { offset.value = 0; files.value = [] }
  loading.value = true
  errorMsg.value = ''
  try {
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
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? '加载文件列表失败'
  } finally {
    loading.value = false
  }
}

// Initial load deferred to onMounted to avoid SSR/CSR hydration mismatch on admin pages
onMounted(() => loadFiles(true))

// Reload when filters change
watch([selectedFolder, typeFilter], () => loadFiles(true))

let searchTimer: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadFiles(true), 350)
})

// ── Folder selection ──────────────────────────────────────────────────────────
function selectFolder(id: string | null) {
  selectedFolder.value = id
}

// ── File detail ───────────────────────────────────────────────────────────────
function openFile(f: MediaFile) {
  selectedFile.value = f
  editForm.value = {
    title: f.title ?? '',
    description: f.description ?? '',
    folder: f.folder ?? '',
  }
  editSaving.value = false
}

function closeDetail() {
  selectedFile.value = null
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
    if (editForm.value.folder !== (selectedFile.value.folder ?? '')) {
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
    successMsg.value = '元数据已保存'
    setTimeout(() => (successMsg.value = ''), 3000)
    // Update local state
    Object.assign(selectedFile.value, {
      title: editForm.value.title || null,
      description: editForm.value.description || null,
      folder: editForm.value.folder || null,
    })
    // Refresh list to reflect changes
    await loadFiles(true)
    closeDetail()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? '保存失败'
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

  // Upload files in parallel, one FormData per file
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    uploadPromises.push(
      (async () => {
        const fd = new FormData()
        fd.append('file', file, file.name)
        if (uploadFolder.value) fd.append('folder', uploadFolder.value)
        try {
          const res = await $fetch<{ uploaded: unknown[]; errors: Array<{ filename: string; message: string }> }>(
            '/api/admin/media/upload',
            { method: 'POST', body: fd },
          )
          if (res.errors?.length) allErrors.push(...res.errors)
        } catch (e: unknown) {
          const fe = e as { data?: { message?: string } }
          allErrors.push({ filename: file.name, message: fe.data?.message ?? '上传失败' })
        }
      })(),
    )
  }

  await Promise.all(uploadPromises)

  uploading.value = false
  uploadErrors.value = allErrors
  input.value = ''

  if (allErrors.length < fileList.length) {
    // At least some succeeded
    const okCount = fileList.length - allErrors.length
    successMsg.value = `成功上传 ${okCount} 个文件`
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

// Recursive folder tree component helper
function flattenFolders(nodes: FolderNode[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = []
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth })
    result.push(...flattenFolders(n.children, depth + 1))
  }
  return result
}

const flatFolders = computed(() => flattenFolders(folderTree.value))

const hasMore = computed(() => files.value.length < totalCount.value)
</script>

<template>
  <div class="ml-shell">
    <!-- Top bar -->
    <div class="ml-topbar">
      <h1 class="ml-title">Media Library</h1>
      <div class="ml-topbar-actions">
        <select v-model="uploadFolder" class="folder-select" title="上传目标文件夹">
          <option value="">— 不选文件夹 —</option>
          <option v-for="f in flatFolders" :key="f.id" :value="f.id">
            {{ '—'.repeat(f.depth) + (f.depth > 0 ? ' ' : '') }}{{ f.name }}
          </option>
        </select>
        <button class="btn-upload" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? '上传中…' : '上传文件' }}
        </button>
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          class="hidden-input"
          @change="onFilesSelected"
        >
      </div>
    </div>

    <!-- Banners -->
    <div v-if="errorMsg" class="banner banner--error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="banner banner--success">{{ successMsg }}</div>
    <div v-if="uploadErrors.length" class="banner banner--warn">
      <strong>部分文件上传失败：</strong>
      <ul class="error-list">
        <li v-for="e in uploadErrors" :key="e.filename">
          <strong>{{ e.filename }}</strong>：{{ e.message }}
        </li>
      </ul>
    </div>

    <div class="ml-body">
      <!-- Left: folder tree -->
      <aside class="ml-sidebar">
        <p class="sidebar-label">文件夹</p>
        <button
          class="folder-item"
          :class="{ 'folder-item--active': selectedFolder === null }"
          @click="selectFolder(null)"
        >
          全部文件
        </button>
        <button
          class="folder-item"
          :class="{ 'folder-item--active': selectedFolder === 'root' }"
          @click="selectFolder('root')"
        >
          未分类
        </button>
        <div class="folder-divider" />
        <button
          v-for="f in flatFolders"
          :key="f.id"
          class="folder-item"
          :class="{ 'folder-item--active': selectedFolder === f.id }"
          :style="{ paddingLeft: `calc(var(--space-3) + ${f.depth * 12}px)` }"
          @click="selectFolder(f.id)"
        >
          {{ f.name }}
        </button>
      </aside>

      <!-- Right: main content -->
      <div class="ml-main">
        <!-- Search + filter bar -->
        <div class="filter-bar">
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="搜索文件名 / 标题…"
          >
          <select v-model="typeFilter" class="type-select">
            <option value="">所有格式</option>
            <option value="image">图片</option>
            <option value="pdf">PDF</option>
          </select>
          <span class="file-count">{{ totalCount }} 个文件</span>
        </div>

        <!-- Loading -->
        <div v-if="loading && files.length === 0" class="loading-state">
          <span class="loading-dot" />加载中…
        </div>

        <!-- Empty -->
        <div v-else-if="!loading && files.length === 0" class="empty-state">
          <p class="empty-title">暂无文件</p>
          <p class="empty-hint">点击"上传文件"添加媒体资产</p>
        </div>

        <!-- File grid -->
        <div v-else class="file-grid">
          <button
            v-for="f in files"
            :key="f.id"
            class="file-card"
            :class="{ 'file-card--selected': selectedFile?.id === f.id }"
            @click="openFile(f)"
          >
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
                <span v-else class="icon-file">📄</span>
              </div>
            </div>
            <div class="file-card__info">
              <p class="file-card__title">{{ f.title ?? f.filename_download ?? f.id.slice(0, 8) }}</p>
              <p class="file-card__meta">
                <span class="meta-type">{{ formatType(f.type) }}</span>
                <span class="meta-size">{{ formatSize(f.filesize) }}</span>
              </p>
              <p v-if="f.folder && folderMap[f.folder]" class="file-card__folder">
                📁 {{ folderMap[f.folder] }}
              </p>
            </div>
          </button>
        </div>

        <!-- Load more -->
        <div v-if="hasMore && !loading" class="load-more">
          <button class="btn-load-more" @click="loadFiles(false)">加载更多（还有 {{ totalCount - files.length }} 个）</button>
        </div>
        <div v-if="loading && files.length > 0" class="loading-inline">加载中…</div>
      </div>

      <!-- Detail panel -->
      <aside v-if="selectedFile" class="ml-detail">
        <div class="detail-header">
          <h3 class="detail-title">文件详情</h3>
          <button class="detail-close" aria-label="关闭" @click="closeDetail">✕</button>
        </div>

        <!-- Preview -->
        <div class="detail-preview">
          <img
            v-if="isImage(selectedFile.type)"
            :src="thumbUrl(selectedFile.id)"
            :alt="selectedFile.title ?? ''"
            class="detail-preview__img"
          >
          <div v-else class="detail-preview__icon">
            {{ formatType(selectedFile.type) }}
          </div>
        </div>

        <!-- File info (read-only) -->
        <dl class="detail-info">
          <dt>文件名</dt>
          <dd>{{ selectedFile.filename_download ?? selectedFile.filename_disk ?? '—' }}</dd>
          <dt>格式</dt>
          <dd>{{ selectedFile.type ?? '—' }}</dd>
          <template v-if="selectedFile.width && selectedFile.height">
            <dt>分辨率</dt>
            <dd>{{ selectedFile.width }} × {{ selectedFile.height }}</dd>
          </template>
          <dt>大小</dt>
          <dd>{{ formatSize(selectedFile.filesize) }}</dd>
          <dt>上传时间</dt>
          <dd>{{ selectedFile.uploaded_on ? selectedFile.uploaded_on.slice(0, 10) : '—' }}</dd>
        </dl>

        <!-- Editable fields -->
        <div class="detail-edit">
          <div class="field-row">
            <label class="field-label">标题</label>
            <input v-model="editForm.title" type="text" class="field-input" placeholder="文件显示标题" maxlength="255">
          </div>
          <div class="field-row">
            <label class="field-label">描述 / ALT（备用）</label>
            <textarea v-model="editForm.description" class="field-textarea" placeholder="图片描述，未来可用于 alt 文字" rows="3" maxlength="1000" />
          </div>
          <div class="field-row">
            <label class="field-label">文件夹</label>
            <select v-model="editForm.folder" class="field-input">
              <option value="">— 不分组 —</option>
              <option v-for="f in flatFolders" :key="f.id" :value="f.id">
                {{ '—'.repeat(f.depth) + (f.depth > 0 ? ' ' : '') }}{{ f.name }}
              </option>
            </select>
          </div>
          <div class="detail-actions">
            <button class="btn-save" :disabled="editSaving" @click="saveMetadata">
              {{ editSaving ? '保存中…' : '保存' }}
            </button>
            <button class="btn-cancel" @click="closeDetail">取消</button>
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
  padding: var(--space-4) var(--space-6);
  background: white;
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.ml-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  flex: 1;
  white-space: nowrap;
}

.ml-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.folder-select {
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
  min-width: 160px;
  max-width: 240px;
}

.btn-upload {
  height: 38px;
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

/* ── Banners ── */
.banner {
  padding: var(--space-3) var(--space-5);
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
  width: 180px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid var(--color-line);
  overflow-y: auto;
  padding: var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  margin: 0;
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

.folder-divider { height: 1px; background: var(--color-line); margin: var(--space-2) var(--space-3); }

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

/* ── Filter bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 180px;
  max-width: 400px;
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
}
.search-input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }

.type-select {
  height: 38px;
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
  display: flex;
  flex-direction: column;
  background: white;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  padding: 0;
}
.file-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(18,60,50,0.1); }
.file-card--selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(18,60,50,0.15); }

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
.file-card__icon { display: flex; align-items: center; justify-content: center; font-size: 2rem; }
.icon-pdf {
  font-size: var(--text-sm); font-weight: 700;
  background: #e74c3c; color: white;
  padding: 6px 10px; border-radius: var(--radius-sm);
}
.icon-file { font-size: 2rem; }

.file-card__info { padding: var(--space-2) var(--space-3); flex: 1; min-width: 0; }
.file-card__title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-card__meta {
  display: flex;
  gap: var(--space-2);
  margin: 0;
}
.meta-type {
  font-size: 10px; font-weight: 600; color: var(--color-primary);
  background: #e8f4f1; padding: 1px 5px; border-radius: 99px;
}
.meta-size { font-size: 10px; color: var(--color-ink-muted); }
.file-card__folder { font-size: 10px; color: var(--color-ink-muted); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Load more ── */
.load-more { text-align: center; padding: var(--space-4); }
.btn-load-more {
  height: 38px;
  padding: 0 var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: white;
  cursor: pointer;
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
  padding: var(--space-4) var(--space-4) var(--space-3);
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
  width: 100%;
  height: 180px;
  background: #e8edf0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.detail-preview__img { width: 100%; height: 100%; object-fit: contain; display: block; }
.detail-preview__icon {
  font-size: var(--text-2xl); font-weight: 700;
  background: #e74c3c; color: white;
  padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm);
}

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

.detail-edit { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); flex: 1; }

.field-row { display: flex; flex-direction: column; gap: var(--space-1); }
.field-label {
  font-size: 10px; font-weight: 600;
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

.detail-actions { display: flex; gap: var(--space-2); margin-top: auto; padding-top: var(--space-2); }
.btn-save {
  flex: 1;
  height: 38px;
  background: var(--color-primary); color: white; border: none;
  border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 600;
  cursor: pointer; transition: background var(--transition-fast);
}
.btn-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-cancel {
  height: 38px;
  padding: 0 var(--space-4);
  background: white; color: var(--color-ink-muted);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm); font-size: var(--text-sm); cursor: pointer;
}
.btn-cancel:hover { background: var(--color-line); }

/* ── Responsive ── */
@media (max-width: 1023px) {
  .ml-detail { width: 260px; }
}

@media (max-width: 767px) {
  .ml-shell { height: auto; overflow: visible; }
  .ml-topbar { padding: var(--space-3) var(--space-4); }
  .ml-body { flex-direction: column; overflow: visible; }
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
  .sidebar-label { display: none; }
  .folder-divider { display: none; }
  .folder-item {
    width: auto;
    flex-shrink: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-line);
    font-size: var(--text-xs);
  }
  .folder-item--active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
  .ml-main { padding: var(--space-3); overflow: visible; }
  .file-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-2); }
  .ml-detail {
    width: 100%;
    border-left: none;
    border-top: 2px solid var(--color-primary);
  }
  .file-count { display: none; }
}
</style>
