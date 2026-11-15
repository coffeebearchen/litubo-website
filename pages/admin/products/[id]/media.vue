<script setup lang="ts">
import type { AdminProduct, ProductMedia, FileRole } from '~/types/product-cms'

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
interface LibraryFolder { id: string; name: string; parent: string | null; children: LibraryFolder[] }

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const error = ref('')
const success = ref('')

const [{ data: productData }, { data: mediaData, refresh: refreshMedia }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
])

if (!productData.value) await navigateTo('/admin/products')

const mediaList = computed(() => mediaData.value ?? [])

// Editing state
const editingId = ref<number | null>(null)
const editForm = ref<Partial<ProductMedia>>({})

function startEdit(item: ProductMedia) {
  editingId.value = item.id
  editForm.value = {
    file_role: item.file_role,
    alt_en: item.alt_en,
    caption_en: item.caption_en,
    sort: item.sort,
    enabled: item.enabled,
    focal_point_x: item.focal_point_x ?? 50,
    focal_point_y: item.focal_point_y ?? 50,
  }
}

function cancelEdit() {
  editingId.value = null
  editForm.value = {}
}

const FILE_ROLE_LABELS: Record<FileRole, string> = {
  hero: 'Hero 主图',
  overview: '概览图',
  application: '应用场景',
  detail: '细节图',
  gallery: '图库',
  video_poster: '视频封面',
  brochure: '产品手册',
  datasheet: '规格书',
  drawing: '工程图纸',
  manual: '操作手册',
  certificate: '认证证书',
}

const FILE_ROLES: FileRole[] = [
  'hero', 'overview', 'application', 'detail', 'gallery',
  'video_poster', 'brochure', 'datasheet', 'drawing', 'manual', 'certificate',
]

function isImage(type: string | null | undefined) {
  return type?.startsWith('image/') ?? false
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function thumbUrl(fileId: string | null | undefined, fpx?: number | null, fpy?: number | null) {
  if (!fileId) return ''
  const x = fpx ?? 50
  const y = fpy ?? 50
  return `/api/admin/media/${fileId}?width=240&height=180&fit=cover&focal_point_x=${x}&focal_point_y=${y}`
}

// 3×3 focal point grid
const FOCAL_GRID = [
  { label: '左上', x: 10, y: 10 }, { label: '上', x: 50, y: 10 }, { label: '右上', x: 90, y: 10 },
  { label: '左',  x: 10, y: 50 }, { label: '中', x: 50, y: 50 }, { label: '右',  x: 90, y: 50 },
  { label: '左下', x: 10, y: 90 }, { label: '下', x: 50, y: 90 }, { label: '右下', x: 90, y: 90 },
]

function setFocal(x: number, y: number) {
  editForm.value.focal_point_x = x
  editForm.value.focal_point_y = y
}

async function saveEdit(item: ProductMedia) {
  error.value = ''
  try {
    // Save focal point directly to directus_files
    if (item.directus_files_id &&
        (editForm.value.focal_point_x !== undefined || editForm.value.focal_point_y !== undefined)) {
      await $fetch(`/api/admin/files/${item.directus_files_id}/focal`, {
        method: 'PATCH',
        body: {
          focal_point_x: editForm.value.focal_point_x ?? 50,
          focal_point_y: editForm.value.focal_point_y ?? 50,
        },
      })
    }
    // Save junction fields
    await $fetch(`/api/admin/products/${id}/media/${item.id}`, {
      method: 'PATCH',
      body: {
        file_role: editForm.value.file_role,
        alt_en: editForm.value.alt_en,
        caption_en: editForm.value.caption_en,
        sort: editForm.value.sort,
        enabled: editForm.value.enabled,
      },
    })
    success.value = '已保存'
    setTimeout(() => (success.value = ''), 3000)
    cancelEdit()
    await refreshMedia()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '保存失败，请重试'
  }
}

async function toggleEnabled(item: ProductMedia) {
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/media/${item.id}`, {
      method: 'PATCH', body: { enabled: !item.enabled },
    })
    await refreshMedia()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '操作失败'
  }
}

// ── Media Library picker ──────────────────────────────────────────────────────
const libOpen = ref(false)
const libFiles = ref<LibraryFile[]>([])
const libFolders = ref<LibraryFolder[]>([])
const libSelectedFolder = ref<string | null>(null)
const libSearch = ref('')
const libTypeFilter = ref<'' | 'image' | 'pdf'>('')
const libLoading = ref(false)
const libTotal = ref(0)
const LIB_PAGE = 100
const libOffset = ref(0)

function flattenFolders(nodes: LibraryFolder[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  const r: Array<{ id: string; name: string; depth: number }> = []
  for (const n of nodes) { r.push({ id: n.id, name: n.name, depth }); r.push(...flattenFolders(n.children, depth + 1)) }
  return r
}
const libFlatFolders = computed(() => flattenFolders(libFolders.value))

async function openLibrary() {
  libOpen.value = true
  if (libFolders.value.length === 0) {
    const res = await $fetch<LibraryFolder[]>('/api/admin/media/folders').catch(() => [])
    libFolders.value = res
  }
  await loadLibFiles(true)
}

function closeLibrary() { libOpen.value = false }

async function loadLibFiles(reset = false) {
  if (reset) { libOffset.value = 0; libFiles.value = [] }
  libLoading.value = true
  try {
    const params: Record<string, string> = { limit: String(LIB_PAGE), offset: String(libOffset.value) }
    if (libSelectedFolder.value) params.folder = libSelectedFolder.value
    if (libTypeFilter.value) params.type = libTypeFilter.value
    if (libSearch.value.trim()) params.search = libSearch.value.trim()
    const res = await $fetch<{ data: LibraryFile[]; meta?: { filter_count: number } }>('/api/admin/media/files', { query: params })
    if (reset) { libFiles.value = res.data ?? [] } else { libFiles.value = [...libFiles.value, ...(res.data ?? [])] }
    libTotal.value = res.meta?.filter_count ?? res.data?.length ?? 0
    libOffset.value += res.data?.length ?? 0
  } finally { libLoading.value = false }
}

watch([libSelectedFolder, libTypeFilter], () => loadLibFiles(true))
let libSearchTimer: ReturnType<typeof setTimeout>
watch(libSearch, () => { clearTimeout(libSearchTimer); libSearchTimer = setTimeout(() => loadLibFiles(true), 350) })

// Existing file UUIDs already associated with this product
const existingFileIds = computed(() => new Set(mediaList.value.map((m: ProductMedia) => m.directus_files_id).filter(Boolean)))

async function pickFromLibrary(file: LibraryFile) {
  if (existingFileIds.value.has(file.id)) {
    error.value = `文件「${file.title ?? file.filename_download ?? file.id}」已经关联到此产品`
    return
  }
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/media`, {
      method: 'POST',
      body: { directus_files_id: file.id, file_role: null },
    })
    success.value = `已关联「${file.title ?? file.filename_download ?? file.id}」`
    setTimeout(() => (success.value = ''), 3000)
    await refreshMedia()
    closeLibrary()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '关联失败，请重试'
  }
}

function libIsImage(type: string | null | undefined) { return (type ?? '').startsWith('image/') }
function libThumb(id: string) { return `/api/admin/media/${id}?width=160&height=120&fit=cover` }
function libFmtSize(bytes: number | null | undefined) {
  if (!bytes) return '—'
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

async function removeMedia(mid: number) {
  if (!confirm('确认移除此媒体记录？只删除关联，不删除原始文件。')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/media/${mid}`, { method: 'DELETE' })
    await refreshMedia()
    success.value = '媒体记录已移除'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '删除失败'
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">{{ productData?.name_en ?? '产品编辑' }}</h1>
    </div>

    <ProductSubNav :product-id="id" />

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="success" class="success-banner">{{ success }}</p>

    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">图片与资料</h2>
        <span class="card-note">已绑定 {{ mediaList.length }} 个文件</span>
        <button class="btn-from-lib" @click="openLibrary">从媒体库选择</button>
      </div>

      <div v-if="mediaList.length === 0" class="empty-state">
        <p class="empty-title">此产品暂无媒体文件</p>
        <p class="empty-hint">上传文件后通过"从媒体库选择"关联到产品，或直接上传新文件。</p>
      </div>

      <div v-else class="media-grid">
        <div
          v-for="item in mediaList"
          :key="item.id"
          class="media-card"
          :class="{ 'media-card--disabled': !item.enabled }"
        >
          <!-- Thumbnail / Icon -->
          <div class="media-card__thumb">
            <img
              v-if="isImage(item.type) && item.directus_files_id"
              :src="thumbUrl(item.directus_files_id, item.focal_point_x, item.focal_point_y)"
              :alt="item.alt_en ?? item.filename_download ?? ''"
              class="media-card__img"
              loading="lazy"
            >
            <div v-else class="media-card__icon">
              <span v-if="item.type?.includes('pdf')">PDF</span>
              <span v-else-if="item.type?.includes('video')">▶</span>
              <span v-else>📄</span>
            </div>
            <span class="media-card__sort">{{ item.sort ?? '—' }}</span>
          </div>

          <!-- Meta info -->
          <div class="media-card__info">
            <p class="media-card__filename" :title="item.filename_download ?? ''">
              {{ item.filename_download ?? item.directus_files_id?.slice(0, 16) + '…' }}
            </p>
            <p class="media-card__meta">
              <span v-if="item.type" class="meta-pill">{{ item.type.split('/')[1]?.toUpperCase() }}</span>
              <span v-if="item.width && item.height" class="meta-dim">{{ item.width }}×{{ item.height }}</span>
              <span class="meta-size">{{ formatSize(item.filesize) }}</span>
            </p>
            <p class="media-card__role">
              <span class="role-badge" :class="item.file_role ? 'role-badge--set' : 'role-badge--none'">
                {{ item.file_role ? (FILE_ROLE_LABELS[item.file_role as FileRole] ?? item.file_role) : '未设置角色' }}
              </span>
            </p>
            <p v-if="item.caption_en" class="media-card__caption">{{ item.caption_en }}</p>
          </div>

          <!-- Actions -->
          <div class="media-card__actions">
            <button
              class="btn-toggle"
              :class="item.enabled ? 'btn-toggle--on' : 'btn-toggle--off'"
              :title="item.enabled ? '已启用 — 点击禁用' : '已禁用 — 点击启用'"
              @click="toggleEnabled(item)"
            >{{ item.enabled ? '启用' : '禁用' }}</button>
            <button class="btn-edit" title="编辑" @click="startEdit(item)">编辑</button>
            <button class="btn-del" title="移除关联" @click="removeMedia(item.id)">移除</button>
          </div>

          <!-- Inline edit panel -->
          <div v-if="editingId === item.id" class="media-card__edit">
            <h4 class="edit-title">编辑媒体记录</h4>

            <div class="field-row">
              <label class="field-label">文件角色</label>
              <select v-model="editForm.file_role" class="field-input">
                <option value="">— 未设置 —</option>
                <option v-for="r in FILE_ROLES" :key="r" :value="r">{{ FILE_ROLE_LABELS[r] }}</option>
              </select>
            </div>

            <div class="field-row">
              <label class="field-label">Alt 文字 (EN)</label>
              <input v-model="editForm.alt_en" type="text" class="field-input" placeholder="图片替代文字">
            </div>

            <div class="field-row">
              <label class="field-label">说明文字 (EN)</label>
              <input v-model="editForm.caption_en" type="text" class="field-input" placeholder="图片说明">
            </div>

            <div class="field-row">
              <label class="field-label">排序</label>
              <input v-model.number="editForm.sort" type="number" class="field-input field-input--short">
            </div>

            <!-- Focal point selector -->
            <div v-if="isImage(item.type)" class="field-row focal-row">
              <label class="field-label">图片焦点</label>
              <div class="focal-wrap">
                <div class="focal-grid">
                  <button
                    v-for="pt in FOCAL_GRID"
                    :key="pt.label"
                    class="focal-btn"
                    :class="{
                      'focal-btn--active':
                        editForm.focal_point_x === pt.x && editForm.focal_point_y === pt.y
                    }"
                    :title="pt.label"
                    @click="setFocal(pt.x, pt.y)"
                  >·</button>
                </div>
                <div class="focal-preview">
                  <img
                    v-if="item.directus_files_id"
                    :src="thumbUrl(item.directus_files_id, editForm.focal_point_x, editForm.focal_point_y)"
                    alt="焦点预览"
                    class="focal-preview__img"
                    loading="lazy"
                  >
                  <span class="focal-label">
                    焦点：{{ editForm.focal_point_x ?? 50 }},{{ editForm.focal_point_y ?? 50 }}
                  </span>
                </div>
              </div>
            </div>

            <div class="edit-actions">
              <button class="btn-save" @click="saveEdit(item)">保存</button>
              <button class="btn-cancel" @click="cancelEdit">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Media Library picker modal -->
    <Teleport to="body">
      <div v-if="libOpen" class="lib-overlay" @click.self="closeLibrary">
        <div class="lib-modal" role="dialog" aria-modal="true" aria-label="从媒体库选择文件">
          <div class="lib-modal-header">
            <h3 class="lib-modal-title">从媒体库选择</h3>
            <button class="lib-modal-close" aria-label="关闭" @click="closeLibrary">✕</button>
          </div>

          <div class="lib-modal-body">
            <!-- Folder filter pills -->
            <div class="lib-folders">
              <button
                class="lib-folder-pill"
                :class="{ 'lib-folder-pill--active': libSelectedFolder === null }"
                @click="libSelectedFolder = null"
              >全部</button>
              <button
                v-for="f in libFlatFolders"
                :key="f.id"
                class="lib-folder-pill"
                :class="{ 'lib-folder-pill--active': libSelectedFolder === f.id }"
                @click="libSelectedFolder = f.id"
              >{{ f.name }}</button>
            </div>

            <!-- Search + type -->
            <div class="lib-filter">
              <input v-model="libSearch" type="search" class="lib-search" placeholder="搜索文件名 / 标题…">
              <select v-model="libTypeFilter" class="lib-type">
                <option value="">全部格式</option>
                <option value="image">图片</option>
                <option value="pdf">PDF</option>
              </select>
              <span class="lib-count">{{ libTotal }} 个文件</span>
            </div>

            <!-- Loading -->
            <div v-if="libLoading && libFiles.length === 0" class="lib-loading">加载中…</div>
            <div v-else-if="!libLoading && libFiles.length === 0" class="lib-empty">暂无文件，请先在 Media Library 上传</div>

            <!-- Grid -->
            <div v-else class="lib-grid">
              <button
                v-for="f in libFiles"
                :key="f.id"
                class="lib-card"
                :class="{ 'lib-card--already': existingFileIds.has(f.id) }"
                :title="existingFileIds.has(f.id) ? '此文件已关联到产品' : (f.title ?? f.filename_download ?? f.id)"
                @click="pickFromLibrary(f)"
              >
                <div class="lib-card__thumb">
                  <img
                    v-if="libIsImage(f.type)"
                    :src="libThumb(f.id)"
                    :alt="f.title ?? ''"
                    class="lib-card__img"
                    loading="lazy"
                  >
                  <div v-else class="lib-card__icon">{{ f.type === 'application/pdf' ? 'PDF' : '📄' }}</div>
                  <span v-if="existingFileIds.has(f.id)" class="lib-card__badge">已关联</span>
                </div>
                <p class="lib-card__name">{{ f.title ?? f.filename_download ?? f.id.slice(0, 8) }}</p>
                <p class="lib-card__size">{{ libFmtSize(f.filesize) }}</p>
              </button>
            </div>

            <div v-if="libFiles.length < libTotal && !libLoading" class="lib-more">
              <button class="lib-more-btn" @click="loadLibFiles(false)">加载更多</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); }
.page-header { margin-bottom: var(--space-6); }
.back-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; display: block; margin-bottom: var(--space-3); }
.back-link:hover { text-decoration: underline; }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); margin: 0; }

.content-card { background: white; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-6); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-line); flex-wrap: wrap; gap: var(--space-2); }
.card-title { font-size: var(--text-lg); font-weight: 600; color: var(--color-ink); margin: 0; }
.card-note { font-size: var(--text-sm); color: var(--color-ink-muted); }

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

/* Media grid */
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.media-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  transition: box-shadow var(--transition-fast);
}
.media-card:hover { box-shadow: var(--shadow-card); }
.media-card--disabled { opacity: 0.55; }

/* Thumbnail */
.media-card__thumb {
  position: relative;
  height: 160px;
  background: #e8edf0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.media-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.media-card__icon {
  font-size: 2rem;
  color: var(--color-ink-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-card__sort {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
}

/* Info */
.media-card__info {
  padding: var(--space-3) var(--space-4);
  flex: 1;
  min-width: 0;
}
.media-card__filename {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.media-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  flex-wrap: wrap;
}
.meta-pill {
  font-size: var(--text-xs);
  background: #e8f4f1;
  color: var(--color-primary);
  padding: 2px 7px;
  border-radius: 99px;
  font-weight: 600;
}
.meta-dim, .meta-size {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
}
.media-card__role { margin: 0 0 var(--space-1); }
.role-badge {
  font-size: var(--text-xs);
  padding: 2px 9px;
  border-radius: 99px;
  font-weight: 500;
}
.role-badge--set { background: #d1f0e8; color: #2F6B3A; }
.role-badge--none { background: #f0f0f0; color: var(--color-ink-muted); }
.media-card__caption { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Actions row */
.media-card__actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  background: white;
}

.btn-toggle {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid;
  cursor: pointer;
  min-height: 32px;
}
.btn-toggle--on { background: #d1f0e8; color: #2F6B3A; border-color: #a3dbc8; }
.btn-toggle--off { background: #f0f0f0; color: var(--color-ink-muted); border-color: var(--color-line); }
.btn-toggle--on:hover { background: #a3dbc8; }
.btn-toggle--off:hover { background: #e0e0e0; }

.btn-edit {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-line);
  background: white;
  color: var(--color-ink);
  cursor: pointer;
  min-height: 32px;
}
.btn-edit:hover { background: var(--color-line); }

.btn-del {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid #f5c6c2;
  background: white;
  color: #c0392b;
  cursor: pointer;
  min-height: 32px;
  margin-left: auto;
}
.btn-del:hover { background: #fdf0ee; }

/* Inline edit panel */
.media-card__edit {
  padding: var(--space-4);
  border-top: 2px solid var(--color-primary);
  background: #f6faf9;
}
.edit-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-primary-deep);
  margin: 0 0 var(--space-4);
}
.field-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}
.field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
.field-input--short { max-width: 120px; }
.field-input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; border-color: var(--color-primary); }

/* Focal point */
.focal-row { align-items: flex-start; }
.focal-wrap { display: flex; gap: var(--space-4); align-items: flex-start; flex-wrap: wrap; }
.focal-grid {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 4px;
  flex-shrink: 0;
}
.focal-btn {
  width: 44px; height: 44px;
  background: var(--color-line);
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--color-ink-muted);
  display: flex; align-items: center; justify-content: center;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.focal-btn:hover { background: #d0e8e3; }
.focal-btn--active { background: var(--color-primary); color: white; border-color: var(--color-primary-deep); }

.focal-preview { display: flex; flex-direction: column; gap: var(--space-2); }
.focal-preview__img { width: 120px; height: 90px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-line); display: block; }
.focal-label { font-size: var(--text-xs); color: var(--color-ink-muted); }

.edit-actions { display: flex; gap: var(--space-2); margin-top: var(--space-3); }
.btn-save {
  font-size: var(--text-sm); font-weight: 600;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  background: var(--color-primary); color: white; border: none; cursor: pointer;
  min-height: 40px;
}
.btn-save:hover { background: var(--color-primary-deep); }
.btn-cancel {
  font-size: var(--text-sm); padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: white; color: var(--color-ink-muted); border: 1px solid var(--color-line); cursor: pointer;
  min-height: 40px;
}
.btn-cancel:hover { background: var(--color-line); }

.error-banner { background: #fdf0ee; border: 1px solid #f5c6c2; border-radius: var(--radius-sm); color: #c0392b; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #d1f0e8; border: 1px solid #a3dbc8; border-radius: var(--radius-sm); color: #2F6B3A; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

/* "从媒体库选择" 按钮 */
.btn-from-lib {
  font-size: var(--text-sm);
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary);
  background: white;
  color: var(--color-primary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  min-height: 36px;
}
.btn-from-lib:hover { background: var(--color-primary); color: white; }

/* ── Library modal ── */
.lib-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
}

@media (min-width: 768px) {
  .lib-overlay { align-items: center; }
}

.lib-modal {
  background: white;
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.lib-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}
.lib-modal-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); margin: 0; }
.lib-modal-close {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: var(--color-ink-muted);
  border-radius: var(--radius-sm); font-size: var(--text-base);
}
.lib-modal-close:hover { background: var(--color-line); }

.lib-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Folder pills */
.lib-folders {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.lib-folder-pill {
  padding: var(--space-1) var(--space-3);
  border-radius: 99px;
  border: 1px solid var(--color-line);
  background: white;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-ink-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.lib-folder-pill:hover { background: rgba(27, 66, 36,0.06); color: var(--color-ink); }
.lib-folder-pill--active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

/* Filter */
.lib-filter {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}
.lib-search {
  flex: 1; min-width: 140px; height: 36px;
  padding: 0 var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: white;
}
.lib-search:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.lib-type {
  height: 36px; padding: 0 var(--space-3);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: white;
}
.lib-count { font-size: var(--text-xs); color: var(--color-ink-muted); margin-left: auto; }

/* States */
.lib-loading, .lib-empty {
  text-align: center; padding: var(--space-8);
  font-size: var(--text-sm); color: var(--color-ink-muted);
}

/* Grid */
.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-3);
}

.lib-card {
  display: flex; flex-direction: column;
  border: 2px solid var(--color-line); border-radius: var(--radius-md);
  overflow: hidden; cursor: pointer; text-align: left; padding: 0; background: white;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.lib-card:hover:not(.lib-card--already) { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(27, 66, 36,0.12); }
.lib-card--already { opacity: 0.55; cursor: not-allowed; }

.lib-card__thumb {
  position: relative; height: 100px;
  background: #e8edf0; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.lib-card__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-card__icon { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink-muted); }
.lib-card__badge {
  position: absolute; top: 4px; right: 4px;
  background: var(--color-primary); color: white;
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 99px;
}
.lib-card__name {
  font-size: 10px; font-weight: 600; color: var(--color-ink);
  margin: 0; padding: var(--space-2) var(--space-2) 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lib-card__size { font-size: 10px; color: var(--color-ink-muted); margin: 0; padding: 0 var(--space-2) var(--space-2); }

/* Load more */
.lib-more { text-align: center; }
.lib-more-btn {
  height: 36px; padding: 0 var(--space-5);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); background: white; cursor: pointer;
}
.lib-more-btn:hover { background: var(--color-line); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .media-grid { grid-template-columns: 1fr; }
  .focal-wrap { flex-direction: column; }
  .lib-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .lib-modal { max-height: 92vh; }
  .lib-modal-body { padding: var(--space-3); }
}
</style>
