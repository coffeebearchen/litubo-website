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
// ML-CLOUD-02 — `filename` is the human-visible download name, a different
// thing from `title`. Keeping them as separate fields here is the point: the
// old panel let you edit a display title and left people believing they had
// renamed the file.
const editForm = ref({ filename: '', title: '', description: '', folder: '' })
const editSaving = ref(false)

// Upload state
const uploading = ref(false)
const uploadErrors = ref<Array<{ filename: string; message: string }>>([])
const uploadFolder = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)

// ML-CLOUD-02 — duplicate warning. `pendingFiles` holds the picked files while
// the operator decides; `duplicates` is what the server recognised.
interface DuplicateMatch {
  filename: string
  size: number
  existing: Array<{ id: string; filename_download: string | null; filesize: number | null }>
}
const pendingFiles = ref<File[]>([])
const duplicateMatches = ref<DuplicateMatch[]>([])
const duplicateChecking = ref(false)

// ML-CLOUD-03 — per-file upload outcome, so a partly failed batch is legible.
interface UploadResult {
  filename: string
  ok: boolean
  size?: number
  message?: string
}
const uploadResults = ref<UploadResult[]>([])
const uploadOkCount = computed(() => uploadResults.value.filter((r: UploadResult) => r.ok).length)

/**
 * ML-CLOUD-03 — drag-and-drop state.
 *
 * `dragDepth` counts enter/leave pairs: dragging over a child element fires
 * `dragleave` on the parent, so a boolean flag flickers off the moment the
 * cursor crosses any nested node. Counting is the fix, and resetting to zero
 * on drop is what stops a missed leave from leaving the page stuck in its
 * drag state.
 */
const dragDepth = ref(0)
const dragActive = computed(() => dragDepth.value > 0)

/** Thumbnails that failed to load, so the card can fall back once and stay stable. */
const thumbFailed = ref<Set<string>>(new Set())
function onThumbError(id: string) {
  if (thumbFailed.value.has(id)) return
  thumbFailed.value = new Set([...thumbFailed.value, id])
}

// Multi-select
const selectedIds = ref<Set<string>>(new Set())
const batchMovingFolder = ref(false)
const batchTargetFolder = ref('')
const batchArchiving = ref(false)
const batchArchiveConfirm = ref(false)

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
  references: Array<{ product_id: number; product_name: string; file_role: string | null }>
}
const detailRefs = ref<RefsResult | null>(null)
const detailArchived = ref(false)
const detailRefsLoading = ref(false)
/**
 * ML-CLOUD-02 — set when the reference lookup itself failed. "We could not
 * find out" and "there are none" must never render the same way: showing a
 * confident zero for a call that errored is how a referenced asset gets
 * archived by someone who trusted the screen.
 */
const detailRefsUnavailable = ref(false)
const archiveConfirm = ref(false)
const restoreConfirm = ref(false)
const lifecycleWorking = ref(false)

// Folder tree
const { data: foldersData, refresh: loadFolders } = await useFetch<FolderNode[]>('/api/admin/media/folders')
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
type FlatFolder = {
  id: string
  name: string
  depth: number
  policy_state: FolderNode['policy_state']
  allow_upload: boolean
  allow_move_target: boolean
  /** ML-CLOUD-01 — may the folder itself be renamed/moved. Separate from the file-content flags above. */
  management: FolderNode['management']
  can_create_children: boolean
  full_path: string
  zone_root: string | null
}
function flattenFolders(nodes: FolderNode[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = []
  for (const n of nodes) {
    result.push({
      id: n.id,
      name: n.name,
      depth,
      policy_state: n.policy_state,
      allow_upload: n.allow_upload,
      allow_move_target: n.allow_move_target,
      management: n.management,
      can_create_children: n.can_create_children,
      full_path: n.full_path,
      zone_root: n.zone_root,
    })
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
      /**
       * ML-CLOUD-V1-FINAL — Search is a Media Library search, not a search of
       * the folder you happen to be standing in.
       *
       * Combining the folder filter with the query made it silently local: an
       * operator inside products/xray searching for a file that lives in
       * products/conveyor was told it does not exist. Every result card already
       * shows its folder path, so a global result set stays readable.
       */
      const searching = searchQuery.value.trim() !== ''
      if (selectedFolder.value && !searching) params.folder = selectedFolder.value
      if (typeFilter.value) params.type = typeFilter.value
      if (searching) params.search = searchQuery.value.trim()

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
  // The upload report describes the folder it happened in; carrying it into
  // another folder makes it look like it describes that one.
  uploadResults.value = []
  uploadErrors.value = []
  /**
   * ML-CLOUD-03 — browsing into a folder that accepts files makes it the
   * upload destination. Otherwise "drop files here" would silently mean
   * "drop them wherever the dropdown was last left", which is the kind of
   * quiet mismatch that files things in the wrong place.
   */
  if (id && id !== 'root' && flatFolders.value.some((f: FlatFolder) => f.id === id && f.allow_upload)) {
    uploadFolder.value = id
  }
}

function toggleArchivedView() {
  showArchivedView.value = !showArchivedView.value
  if (showArchivedView.value) selectedFolder.value = null
}

// Label for the current view (breadcrumb-style topbar heading)
// ── ML-CLOUD-01: customer folder management ──────────────────────────────────
//
// Every action re-validates on the server before it writes; the disabled
// buttons and the submitting flag here are the client half of that, not the
// guarantee. Nothing below assumes the browser's view of policy is authoritative.

const currentFolder = computed<FlatFolder | null>(() => {
  const id = selectedFolder.value
  if (!id || id === 'root' || showArchivedView.value) return null
  return flatFolders.value.find((f: FlatFolder) => f.id === id) ?? null
})

/**
 * Folders the current folder may be moved into: somewhere that can hold
 * customer folders, inside the same declared zone (D-023), and neither the
 * folder itself nor one of its own descendants.
 *
 * The server refuses all three anyway. Listing them here would only offer the
 * operator a destination that is guaranteed to fail.
 */
const folderMoveTargets = computed(() => {
  const current = currentFolder.value
  if (!current) return []
  return flatFolders.value.filter((f: FlatFolder) =>
    f.can_create_children
    && f.zone_root === current.zone_root
    && f.id !== current.id
    && !f.full_path.startsWith(`${current.full_path}/`),
  )
})

const canCreateFolderHere = computed(() => currentFolder.value?.can_create_children === true)
const canManageCurrentFolder = computed(() => currentFolder.value?.management === 'customer-managed')

type FolderDialog = 'none' | 'create' | 'rename' | 'move'
const folderDialog = ref<FolderDialog>('none')
const folderNameInput = ref('')
const folderMoveTarget = ref('')
const folderSubmitting = ref(false)
const folderError = ref<string | null>(null)

function openFolderDialog(kind: Exclude<FolderDialog, 'none'>) {
  folderError.value = null
  folderNameInput.value = kind === 'rename' ? (currentFolder.value?.name ?? '') : ''
  folderMoveTarget.value = ''
  folderDialog.value = kind
}

function closeFolderDialog() {
  folderDialog.value = 'none'
  folderError.value = null
}

/** Shared submit path: one in-flight request at a time, refresh the tree, keep the user where they were. */
async function submitFolderAction(run: () => Promise<void>) {
  if (folderSubmitting.value) return
  folderSubmitting.value = true
  folderError.value = null
  try {
    await run()
    await loadFolders()
    closeFolderDialog()
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string }, message?: string }
    folderError.value = fe.data?.message ?? fe.message ?? 'That did not work. Try again.'
  }
  finally {
    folderSubmitting.value = false
  }
}

function createFolder() {
  const parent = currentFolder.value?.id
  if (!parent) return
  return submitFolderAction(async () => {
    await $fetch('/api/admin/media/folders', {
      method: 'POST',
      body: { name: folderNameInput.value, parent },
    })
  })
}

function renameFolder() {
  const id = currentFolder.value?.id
  if (!id) return
  return submitFolderAction(async () => {
    await $fetch(`/api/admin/media/folders/${id}`, {
      method: 'PATCH',
      body: { name: folderNameInput.value },
    })
  })
}

function moveFolder() {
  const id = currentFolder.value?.id
  if (!id || !folderMoveTarget.value) return
  return submitFolderAction(async () => {
    await $fetch(`/api/admin/media/folders/${id}`, {
      method: 'PATCH',
      body: { parent: folderMoveTarget.value },
    })
  })
}

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
  batchArchiveConfirm.value = false
}

/**
 * ML-CLOUD-02 — archive the selection, one reference check per file.
 *
 * The server judges each file with the same protection single-file Archive
 * uses, so a referenced file is skipped rather than archived and the rest of
 * the batch still goes through. The summary below reports exactly what
 * happened to each group instead of a single "done".
 */
async function batchArchiveSelected() {
  if (selectedIds.value.size === 0) return
  batchArchiving.value = true
  batchArchiveConfirm.value = false
  errorMsg.value = ''
  try {
    const res = await $fetch<{
      archived: number
      skipped: number
      results: Array<{ id: string; outcome: string; message?: string }>
    }>('/api/admin/media/batch-archive', {
      method: 'POST',
      body: { file_ids: [...selectedIds.value] },
    })

    const referenced = res.results.filter(r => r.outcome === 'referenced').length
    const already = res.results.filter(r => r.outcome === 'already-archived').length
    const failed = res.results.filter(r => r.outcome === 'failed' || r.outcome === 'not-found').length

    const parts = [`${res.archived} archived`]
    if (referenced > 0) parts.push(`${referenced} still referenced (kept)`)
    if (already > 0) parts.push(`${already} already archived`)
    if (failed > 0) parts.push(`${failed} failed`)
    const summary = parts.join(' · ')

    if (failed > 0) errorMsg.value = summary
    else {
      successMsg.value = summary
      setTimeout(() => (successMsg.value = ''), 5000)
    }

    clearSelection()
    await loadArchivedIds()
    await loadFiles(true)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    errorMsg.value = fe.data?.message ?? 'Batch archive failed'
  } finally {
    batchArchiving.value = false
  }
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
    filename: f.filename_download ?? f.filename_disk ?? '',
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
  detailRefsUnavailable.value = false
  try {
    const res = await $fetch<RefsResult>(`/api/admin/media/${uuid}/references`)
    detailRefs.value = res
  } catch {
    detailRefs.value = null
    detailRefsUnavailable.value = true
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
    // ML-CLOUD-02 — a real rename of the downloadable filename. The server
    // keeps the extension and refuses a name already used in this folder.
    const currentFilename = selectedFile.value.filename_download ?? selectedFile.value.filename_disk ?? ''
    if (editForm.value.filename.trim() !== currentFilename) {
      payload.filename_download = editForm.value.filename
    }
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

/**
 * ML-CLOUD-03 — Upload folder, implemented as the cheap version it is allowed
 * to be: a second input carrying `webkitdirectory`, feeding the same pipeline.
 *
 * The files import FLAT into the destination folder. Rebuilding a local
 * directory tree as business folders is explicitly not wanted — a folder
 * structure from someone's laptop is not the product classification — and
 * building it would be the "new folder mapping architecture" this module must
 * not add.
 */
function triggerFolderUpload() {
  folderInputRef.value?.click()
}

/**
 * ML-CLOUD-02 — check for possible duplicates before uploading anything.
 *
 * The check runs first and covers the whole selection, so the operator makes
 * one decision instead of being interrupted mid-batch. Nothing is uploaded
 * until they answer, and answering "cancel" drops only the flagged files —
 * one suspected duplicate never blocks the rest of the batch.
 */
async function onFilesSelected(evt: Event) {
  const input = evt.target as HTMLInputElement
  const fileList = input.files
  if (!fileList || fileList.length === 0) return

  const picked = Array.from(fileList)
  input.value = ''
  await beginUpload(picked)
}

/**
 * ML-CLOUD-03 — the single entry point for uploading, whatever picked the
 * files.
 *
 * The Upload button and a drag-and-drop both land here, so drag-and-drop
 * cannot end up with its own duplicate rules, its own folder validation or its
 * own error handling. It is a second way to choose files, not a second upload
 * path.
 */
async function beginUpload(picked: File[]) {
  if (picked.length === 0) return
  uploadErrors.value = []
  uploadResults.value = []
  errorMsg.value = ''
  duplicateMatches.value = []

  duplicateChecking.value = true
  try {
    // The endpoint caps a request at 50 candidates. Chunking here rather than
    // capping the selection means picking a folder with 200 files still gets
    // checked, instead of the warning quietly switching itself off.
    const CHUNK = 50
    const found: DuplicateMatch[] = []
    for (let i = 0; i < picked.length; i += CHUNK) {
      const res = await $fetch<{ duplicates: DuplicateMatch[] }>('/api/admin/media/duplicate-check', {
        method: 'POST',
        body: {
          folder: uploadFolder.value || null,
          candidates: picked.slice(i, i + CHUNK).map(f => ({ filename: f.name, size: f.size })),
        },
      })
      found.push(...(res.duplicates ?? []))
    }
    duplicateMatches.value = found
  } catch {
    // A failed check must not block uploading — it is a convenience, not a gate.
    duplicateMatches.value = []
  } finally {
    duplicateChecking.value = false
  }

  if (duplicateMatches.value.length > 0) {
    pendingFiles.value = picked
    return
  }
  await uploadFiles(picked)
}

/** Names the duplicate check flagged, lowercased for comparison. */
const duplicateNames = computed(
  () => new Set(duplicateMatches.value.map((d: DuplicateMatch) => d.filename.trim().toLowerCase())),
)

/** Upload everything that was not flagged, and drop the flagged ones. */
function skipDuplicates() {
  const keep = pendingFiles.value.filter((f: File) => !duplicateNames.value.has(f.name.trim().toLowerCase()))
  const skipped = pendingFiles.value.length - keep.length
  pendingFiles.value = []
  duplicateMatches.value = []
  if (keep.length > 0) {
    uploadFiles(keep)
  } else {
    successMsg.value = `${skipped} duplicate file(s) skipped — nothing uploaded`
    setTimeout(() => (successMsg.value = ''), 4000)
  }
}

/** Upload the whole selection, duplicates included, because the operator said so. */
function uploadAnyway() {
  const all = pendingFiles.value
  pendingFiles.value = []
  duplicateMatches.value = []
  if (all.length > 0) uploadFiles(all)
}

function cancelUploadSelection() {
  pendingFiles.value = []
  duplicateMatches.value = []
}

async function uploadFiles(picked: File[]) {
  uploading.value = true
  const allErrors: Array<{ filename: string; message: string }> = []
  // ML-CLOUD-03 — one row per file, so a partly failed batch says which file
  // failed and why instead of a single "Upload failed" for the whole thing.
  const results: UploadResult[] = []

  await Promise.all(picked.map(async (file) => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    // Server enforces folder policy; pass folder UUID if selected
    if (uploadFolder.value) fd.append('folder', uploadFolder.value)
    try {
      const res = await $fetch<{ uploaded: unknown[]; errors: Array<{ filename: string; message: string }> }>(
        '/api/admin/media/upload',
        { method: 'POST', body: fd },
      )
      if (res.errors?.length) {
        allErrors.push(...res.errors)
        for (const err of res.errors) {
          results.push({ filename: err.filename || file.name, ok: false, message: err.message })
        }
      }
      else {
        results.push({ filename: file.name, ok: true, size: file.size })
      }
    } catch (e: unknown) {
      const fe = e as { data?: { message?: string }, statusMessage?: string }
      const message = fe.data?.message ?? fe.statusMessage ?? 'Upload failed'
      allErrors.push({ filename: file.name, message })
      results.push({ filename: file.name, ok: false, message })
    }
  }))

  uploading.value = false
  uploadErrors.value = allErrors
  uploadResults.value = results

  const okCount = results.filter(r => r.ok).length
  if (okCount > 0) {
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

/** Whether a card should show a picture at all: an image whose thumbnail has not failed. */
function showsThumbnail(f: MediaFile): boolean {
  return isImage(f.type) && !thumbFailed.value.has(f.id)
}

// ── ML-CLOUD-03: drag and drop ───────────────────────────────────────────────

/** Whether files dropped right now would have a folder to land in. */
const dropTargetLabel = computed(() => {
  if (showArchivedView.value) return null
  if (!uploadFolder.value) return 'Needs Classification'
  return folderPath(uploadFolder.value)
})

function onDragEnter(evt: DragEvent) {
  if (!evt.dataTransfer?.types?.includes('Files')) return
  dragDepth.value++
}

function onDragOver(evt: DragEvent) {
  if (!evt.dataTransfer?.types?.includes('Files')) return
  // Without this the browser navigates to the dropped file instead.
  evt.preventDefault()
  evt.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  if (dragDepth.value > 0) dragDepth.value--
}

async function onDrop(evt: DragEvent) {
  dragDepth.value = 0
  const dropped = Array.from(evt.dataTransfer?.files ?? [])
  if (dropped.length === 0) return

  if (showArchivedView.value) {
    errorMsg.value = 'Switch out of the archived view before uploading.'
    return
  }
  // Straight into the shared pipeline: same folder rules, same duplicate
  // check, same server-side format validation as the Upload button.
  await beginUpload(dropped)
}

// ── ML-CLOUD-03: selection and navigation helpers ────────────────────────────

const allVisibleSelected = computed(
  () => files.value.length > 0 && files.value.every((f: MediaFile) => selectedIds.value.has(f.id)),
)

function toggleSelectAll() {
  selectedIds.value = allVisibleSelected.value
    ? new Set()
    : new Set(files.value.map((f: MediaFile) => f.id))
  batchArchiveConfirm.value = false
}

/** Total bytes of the current selection — what the operator is about to act on. */
const selectedTotalSize = computed(() => files.value
  .filter((f: MediaFile) => selectedIds.value.has(f.id))
  .reduce((sum: number, f: MediaFile) => sum + Number(f.filesize ?? 0), 0))

/** The folder one level up from here, when there is one to go to. */
const parentFolderId = computed<string | null>(() => {
  const id = selectedFolder.value
  if (!id || id === 'root' || showArchivedView.value) return null
  return parentMap.value[id] ?? null
})

const searchActive = computed(() => searchQuery.value.trim() !== '')

function clearSearch() {
  searchQuery.value = ''
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
        <!-- ML-CLOUD-03 — one click back up the tree, next to where you are. -->
        <button
          v-if="parentFolderId !== null || (selectedFolder && selectedFolder !== 'root')"
          class="breadcrumb-up"
          title="Go to parent folder"
          @click="selectFolder(parentFolderId)"
        >↑ Up</button>
        <button class="breadcrumb-root" @click="selectFolder(null)">Media Library</button>
        <template v-if="currentViewLabel !== 'All files'">
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">{{ currentViewLabel }}</span>
        </template>
        <span v-if="currentFolder && currentFolder.management !== 'customer-managed'" class="breadcrumb-lock" title="Protected system folder">🔒</span>
      </div>

      <div class="ml-topbar-actions">
        <!--
          ML-CLOUD-01 — folder actions, shown only where they are actually
          permitted. A protected system folder simply does not offer Rename or
          Move; the server refuses them regardless, but an admin should not be
          invited to try.
        -->
        <template v-if="selectedIds.size === 0 && currentFolder">
          <button
            v-if="canCreateFolderHere"
            class="btn-folder-action"
            :disabled="folderSubmitting"
            @click="openFolderDialog('create')"
          >New folder</button>
          <button
            v-if="canManageCurrentFolder"
            class="btn-folder-action"
            :disabled="folderSubmitting"
            @click="openFolderDialog('rename')"
          >Rename</button>
          <button
            v-if="canManageCurrentFolder"
            class="btn-folder-action"
            :disabled="folderSubmitting"
            @click="openFolderDialog('move')"
          >Move</button>
          <span v-if="!canManageCurrentFolder && !canCreateFolderHere" class="folder-system-note">System folder</span>
        </template>

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
          <!-- ML-CLOUD-02 — Archive is recoverable; referenced files are kept, not archived. -->
          <template v-if="!batchArchiveConfirm">
            <button class="btn-batch-archive" :disabled="batchArchiving" @click="batchArchiveConfirm = true">
              Archive
            </button>
          </template>
          <template v-else>
            <span class="batch-confirm-msg">Archive {{ selectedIds.size }} file(s)? Referenced files are kept.</span>
            <button class="btn-batch-archive-confirm" :disabled="batchArchiving" @click="batchArchiveSelected">
              {{ batchArchiving ? 'Archiving…' : 'Confirm' }}
            </button>
            <button class="btn-cancel-sel" @click="batchArchiveConfirm = false">Cancel</button>
          </template>
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
          <button class="btn-upload" :disabled="uploading || duplicateChecking" @click="triggerUpload">
            {{ uploading ? 'Uploading…' : duplicateChecking ? 'Checking…' : 'Upload files' }}
          </button>
        </template>
        <!-- ML-CLOUD-03 — same accept list, same handler; only the picker differs. -->
        <input
          ref="folderInputRef"
          type="file"
          multiple
          webkitdirectory
          class="hidden-input"
          @change="onFilesSelected"
        >
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

    <!--
      ML-CLOUD-02 — possible-duplicate warning.

      Shown before anything is uploaded. It states what it compared (name and
      size in this folder) so nobody reads it as a content check, and it never
      decides: the operator skips the duplicates or uploads them anyway.
    -->
    <div v-if="duplicateMatches.length > 0" class="ml-dup-panel">
      <p class="dup-panel-title">
        Possible duplicate{{ duplicateMatches.length > 1 ? 's' : '' }}
        in {{ uploadFolder ? folderPath(uploadFolder) : 'Needs Classification' }}
      </p>
      <p class="dup-panel-note">Same filename and same size as a file already here. Nothing has been uploaded yet.</p>

      <ul class="dup-list">
        <li v-for="dup in duplicateMatches" :key="dup.filename" class="dup-item">
          <div class="dup-col">
            <span class="dup-col-label">New</span>
            <span class="dup-name">{{ dup.filename }}</span>
            <span class="dup-meta">{{ formatSize(dup.size) }}</span>
          </div>
          <div class="dup-col">
            <span class="dup-col-label">Existing</span>
            <span v-for="hit in dup.existing" :key="hit.id" class="dup-existing">
              <span class="dup-name">{{ hit.filename_download }}</span>
              <span class="dup-meta">
                {{ uploadFolder ? folderPath(uploadFolder) : 'Needs Classification' }} · {{ formatSize(hit.filesize) }}
              </span>
            </span>
          </div>
        </li>
      </ul>

      <p class="dup-panel-note">
        {{ pendingFiles.length - duplicateMatches.length }} other file(s) in this selection are not duplicates
        and will upload either way.
      </p>

      <div class="dup-actions">
        <button class="btn-dup-skip" :disabled="uploading" @click="skipDuplicates">Cancel duplicates</button>
        <button class="btn-dup-anyway" :disabled="uploading" @click="uploadAnyway">Upload anyway</button>
        <button class="btn-cancel-sel" :disabled="uploading" @click="cancelUploadSelection">Cancel all</button>
      </div>
    </div>

    <!-- Folder action panel — one at a time, inline, no modal stack -->
    <div v-if="folderDialog !== 'none'" class="ml-folder-panel">
      <p class="folder-panel-title">
        {{ folderDialog === 'create' ? `New folder in ${currentFolder?.name}`
          : folderDialog === 'rename' ? `Rename ${currentFolder?.name}`
            : `Move ${currentFolder?.name}` }}
      </p>

      <div class="folder-panel-row">
        <input
          v-if="folderDialog !== 'move'"
          v-model="folderNameInput"
          class="folder-panel-input"
          type="text"
          placeholder="Folder name"
          :disabled="folderSubmitting"
          @keyup.enter="folderDialog === 'create' ? createFolder() : renameFolder()"
        >
        <select v-else v-model="folderMoveTarget" class="folder-panel-input" :disabled="folderSubmitting">
          <option value="">— Choose a destination —</option>
          <option v-for="f in folderMoveTargets" :key="f.id" :value="f.id">
            {{ '—'.repeat(f.depth) }} {{ f.name }}
          </option>
        </select>

        <button
          class="btn-folder-confirm"
          :disabled="folderSubmitting || (folderDialog === 'move' ? !folderMoveTarget : folderNameInput.trim() === '')"
          @click="folderDialog === 'create' ? createFolder() : folderDialog === 'rename' ? renameFolder() : moveFolder()"
        >
          {{ folderSubmitting ? 'Working…' : folderDialog === 'create' ? 'Create' : folderDialog === 'rename' ? 'Rename' : 'Move' }}
        </button>
        <button class="btn-folder-cancel" :disabled="folderSubmitting" @click="closeFolderDialog">Cancel</button>
      </div>

      <p v-if="folderError" class="folder-panel-error" role="alert">{{ folderError }}</p>
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
    <!--
      ML-CLOUD-03 — the outcome of every file in the batch, not one verdict for
      all of them. When four uploads succeed and one is the wrong format, the
      operator needs to know which one and why, not "Upload failed".
    -->
    <div v-if="uploadResults.length && uploadErrors.length" class="banner banner--warn">
      <strong>
        Upload finished with problems —
        {{ uploadOkCount }} uploaded,
        {{ uploadResults.length - uploadOkCount }} failed
      </strong>
      <ul class="error-list">
        <li v-for="(r, i) in uploadResults" :key="`${r.filename}-${i}`" :class="r.ok ? 'result-ok' : 'result-fail'">
          <span class="result-mark">{{ r.ok ? '✓' : '✕' }}</span>
          <strong>{{ r.filename }}</strong>
          <template v-if="r.ok"> — uploaded</template>
          <template v-else> — {{ r.message }}</template>
        </li>
      </ul>
      <button class="btn-dismiss-results" @click="uploadResults = []; uploadErrors = []">Dismiss</button>
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
      <!--
        ML-CLOUD-03 — the drop surface is the file area itself. The dashed
        strip only appears where an upload could actually land, and the page
        highlights only while something is being dragged over it, so the
        workspace is not permanently occupied by an upload box.
      -->
      <div
        class="ml-main"
        :class="{ 'ml-main--dragging': dragActive && dropTargetLabel }"
        @dragenter="onDragEnter"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <!-- Selection summary — what is selected and how to stop -->
        <div v-if="selectedIds.size > 0" class="selection-bar">
          <span class="selection-bar__count">{{ selectedIds.size }} selected</span>
          <span class="selection-bar__size">{{ formatSize(selectedTotalSize) }}</span>
          <label class="selection-bar__all">
            <input type="checkbox" :checked="allVisibleSelected" @change="toggleSelectAll">
            Select all in this view
          </label>
          <button class="selection-bar__clear" @click="clearSelection">Clear selection</button>
        </div>

        <!--
          ML-CLOUD-V1-FINAL — say so when a search widens the view past the
          folder the operator is standing in, so results from elsewhere are not
          mistaken for contents of this folder.
        -->
        <p v-if="searchActive && selectedFolder" class="search-scope-note">
          Searching the whole Media Library — results below may live outside
          <strong>{{ currentViewLabel }}</strong>. Each card shows its folder.
        </p>

        <!-- Drop zone — only where files may actually be uploaded -->
        <div v-if="dropTargetLabel && !showArchivedView" class="ml-dropzone" :class="{ 'ml-dropzone--active': dragActive }">
          <span class="dropzone-text">
            <!-- A phone has no drag-and-drop; it gets the honest label. -->
            <strong class="desktop-only">Drag and drop files here</strong>
            <strong class="mobile-only">Add files to this folder</strong>
            <span class="dropzone-sub">
              Uploads to <strong>{{ dropTargetLabel }}</strong> · JPG, PNG, WebP, PDF, TXT, CSV, TSV
            </span>
          </span>
          <span class="dropzone-actions">
            <button class="btn-dropzone-upload" :disabled="uploading || duplicateChecking" @click="triggerUpload">
              {{ uploading ? 'Uploading…' : duplicateChecking ? 'Checking…' : 'Select files' }}
            </button>
            <button
              class="btn-dropzone-folder"
              :disabled="uploading || duplicateChecking"
              title="Import every file in a folder. The files land here flat; the local folder structure is not recreated."
              @click="triggerFolderUpload"
            >Select folder</button>
          </span>
        </div>

        <!-- Loading -->
        <div v-if="loading && files.length === 0" class="loading-state">
          <span class="loading-dot" />Loading…
        </div>

        <!-- Empty — the reason it is empty decides what to say next -->
        <div v-else-if="!loading && files.length === 0" class="empty-state">
          <template v-if="searchActive">
            <p class="empty-title">No files found</p>
            <p class="empty-hint">Nothing matches “{{ searchQuery }}” anywhere in the Media Library.</p>
            <button class="btn-empty-action" @click="clearSearch">Clear search</button>
          </template>
          <template v-else-if="showArchivedView">
            <p class="empty-title">No archived files</p>
            <p class="empty-hint">Files you archive appear here and can be restored at any time.</p>
          </template>
          <template v-else-if="typeFilter">
            <p class="empty-title">No {{ typeFilter === 'pdf' ? 'PDF' : 'image' }} files here</p>
            <p class="empty-hint">Try clearing the format filter.</p>
            <button class="btn-empty-action" @click="typeFilter = ''">Show all formats</button>
          </template>
          <template v-else-if="selectedFolder === 'root'">
            <p class="empty-title">Nothing needs classification</p>
            <p class="empty-hint">Every file has been filed into a folder.</p>
          </template>
          <template v-else>
            <p class="empty-title">This folder is empty</p>
            <p class="empty-hint">Upload files or drag files here to get started.</p>
            <button v-if="dropTargetLabel" class="btn-empty-action" :disabled="uploading" @click="triggerUpload">
              Upload files
            </button>
          </template>
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
            <!--
              ML-CLOUD-03 — the thumbnail area is a fixed box that always
              renders something. A broken image swaps to the same block a
              non-image gets, so a failed load cannot collapse the card or
              spill alt text across the filename below it. `alt` is empty
              because the filename is already right there in the card.
            -->
            <div class="file-card__thumb">
              <img
                v-if="showsThumbnail(f)"
                :src="thumbUrl(f.id)"
                alt=""
                class="file-card__img"
                loading="lazy"
                @error="onThumbError(f.id)"
              >
              <div v-else class="file-card__icon" :class="`file-card__icon--${fileKind(f.type).toLowerCase()}`">
                <span class="icon-kind">{{ fileKind(f.type) }}</span>
                <span v-if="isImage(f.type)" class="icon-note">Image unavailable</span>
              </div>
            </div>
            <div class="file-card__info">
              <p class="file-card__title" :title="f.filename_download ?? ''">
                {{ f.filename_download ?? f.filename_disk ?? f.id.slice(0, 8) }}
              </p>
              <p v-if="f.title && f.title !== f.filename_download" class="file-card__subtitle" :title="f.title">
                {{ f.title }}
              </p>
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
            v-if="showsThumbnail(selectedFile)"
            :src="thumbUrl(selectedFile.id)"
            alt=""
            class="detail-preview__img"
            @error="onThumbError(selectedFile.id)"
          >
          <div v-else class="detail-preview__icon">
            <span>{{ fileKind(selectedFile.type) }}</span>
            <span v-if="isImage(selectedFile.type)" class="preview-note">Image unavailable</span>
          </div>
        </div>

        <!-- File facts (read-only) — single source of truth from selectedFile -->
        <dl class="detail-info">
          <dt>Filename</dt>
          <dd class="detail-filename">{{ selectedFile.filename_download ?? selectedFile.filename_disk ?? '—' }}</dd>
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
                  {{ ref.product_name }} · <code>{{ ref.file_role ?? 'media' }}</code>
                </li>
              </ul>
            </template>
          </div>
          <!--
            Not "0 references". The lookup failed, and saying nothing was found
            would invite someone to archive a file that is in use.
          -->
          <div v-else-if="detailRefsUnavailable" class="refs-unavailable">
            References unavailable — could not check what uses this file. Archiving is disabled until it can.
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

          <!--
            ML-CLOUD-02 — Filename, Title and Description are three different
            things and the panel says so. Filename is what downloads; Title is
            what the CMS displays; Description is internal.
          -->
          <div class="field-row">
            <label class="field-label">Filename</label>
            <input
              v-model="editForm.filename"
              type="text"
              class="field-input"
              placeholder="File name for download"
              maxlength="255"
            >
            <p class="field-hint">
              The name people download. The file keeps its ID, its content and its format —
              product and AI references are unaffected. The extension is kept.
            </p>
          </div>
          <div class="field-row">
            <label class="field-label">Title</label>
            <input v-model="editForm.title" type="text" class="field-input" placeholder="Display title" maxlength="255">
            <p class="field-hint">Display name used by the CMS. Not the filename.</p>
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
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.breadcrumb-root:hover { color: var(--color-primary-deep); text-decoration: underline; }
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

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }
.btn-empty-action {
  margin-top: var(--space-4);
  min-height: 36px; padding: 0 var(--space-4);
  background: var(--color-primary-deep); color: white;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer;
}
.btn-empty-action:hover:not(:disabled) { background: var(--color-primary); }
.btn-empty-action:disabled { opacity: 0.55; cursor: not-allowed; }

.search-scope-note {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
}

/* ── ML-CLOUD-03: drag and drop ── */
.ml-main--dragging { outline: 2px dashed var(--color-primary); outline-offset: -6px; }

.ml-dropzone {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-4); flex-wrap: wrap;
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: background 120ms ease, border-color 120ms ease;
}
.ml-dropzone--active { border-color: var(--color-primary); background: #eef6f3; }
.dropzone-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dropzone-text > strong { font-size: var(--text-sm); color: var(--color-ink); }
.dropzone-sub { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }
.btn-dropzone-upload {
  min-height: 36px; padding: 0 var(--space-4);
  background: var(--color-primary-deep); color: white;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap;
}
.btn-dropzone-upload:hover:not(:disabled) { background: var(--color-primary); }
.btn-dropzone-upload:disabled { opacity: 0.55; cursor: not-allowed; }
.dropzone-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.btn-dropzone-folder {
  min-height: 36px; padding: 0 var(--space-4);
  background: var(--color-surface); color: var(--color-ink);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm); cursor: pointer; white-space: nowrap;
}
.btn-dropzone-folder:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary-deep); }
.btn-dropzone-folder:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── ML-CLOUD-03: selection summary ── */
.selection-bar {
  display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: #eef6f3;
  border: 1px solid #bcdcd0;
  border-radius: var(--radius-md);
}
.selection-bar__count { font-size: var(--text-sm); font-weight: 600; color: var(--color-primary-deep); }
.selection-bar__size { font-size: var(--text-xs); color: var(--color-ink-muted); }
.selection-bar__all {
  display: flex; align-items: center; gap: var(--space-1);
  font-size: var(--text-xs); color: var(--color-ink); cursor: pointer;
}
.selection-bar__clear {
  margin-left: auto;
  background: none; border: none; padding: 0;
  font-size: var(--text-xs); color: var(--color-primary-deep);
  text-decoration: underline; cursor: pointer;
}

/* ── ML-CLOUD-03: per-file upload results ── */
.result-ok { color: var(--color-ink-muted); }
.result-fail { color: var(--color-ink); }
.result-mark { display: inline-block; width: 1em; font-weight: 700; }
.result-ok .result-mark { color: #1e7a52; }
.result-fail .result-mark { color: #c0392b; }
.btn-dismiss-results {
  margin-top: var(--space-2);
  background: none; border: none; padding: 0;
  font-size: var(--text-xs); color: var(--color-ink-muted);
  text-decoration: underline; cursor: pointer;
}

/* ── ML-CLOUD-03: breadcrumb navigation ── */
.breadcrumb-up {
  min-height: 28px; padding: 0 var(--space-2);
  background: var(--color-surface); border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs); color: var(--color-ink); cursor: pointer;
  white-space: nowrap;
}
.breadcrumb-up:hover { border-color: var(--color-primary); color: var(--color-primary-deep); }
.breadcrumb-lock { font-size: var(--text-xs); }

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

/*
  ML-CLOUD-03 — the fallback fills the same fixed 120px box a thumbnail would,
  so a broken image changes what the card shows and never how tall it is.
*/
.file-card__icon {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; width: 100%; height: 100%; padding: var(--space-2); box-sizing: border-box;
}
.icon-kind {
  font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.04em;
  background: #7f8c8d; color: white;
  padding: 6px 10px; border-radius: var(--radius-sm);
}
.file-card__icon--pdf .icon-kind { background: #c0392b; }
.file-card__icon--csv .icon-kind,
.file-card__icon--tsv .icon-kind { background: #1e7a52; }
.file-card__icon--txt .icon-kind { background: #4a6572; }
.file-card__icon--image .icon-kind { background: #b06a2c; }
.icon-note {
  font-size: 10px; color: var(--color-ink-muted); text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}

.file-card__info { padding: var(--space-2) var(--space-3); flex: 1; min-width: 0; }
.file-card__title {
  font-size: var(--text-xs); font-weight: 600; color: var(--color-ink);
  margin: 0 0 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* ML-CLOUD-03 — Title is secondary and visibly distinct from the filename above it. */
.file-card__subtitle {
  font-size: 10px; color: var(--color-ink-muted); font-style: italic;
  margin: 0 0 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card__meta {
  display: flex; gap: var(--space-2); margin: 0; align-items: center;
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
/* ML-CLOUD-03 — same fixed box whether there is a picture or not. */
.detail-preview__icon {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-lg); font-weight: 700;
  color: var(--color-ink-muted);
}
.detail-preview__icon > span:first-child {
  background: #7f8c8d; color: white;
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm);
}
.preview-note { font-size: var(--text-xs); font-weight: 400; color: var(--color-ink-muted); }

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
.btn-cancel-sel:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── ML-CLOUD-02: batch archive ── */
.btn-batch-archive,
.btn-batch-archive-confirm {
  height: 36px; padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap;
}
.btn-batch-archive {
  background: white; color: #8a4b08; border: 1px solid #d9a26a;
}
.btn-batch-archive:hover:not(:disabled) { background: #fdf3e7; }
.btn-batch-archive-confirm {
  background: #8a4b08; color: white; border: 1px solid transparent;
}
.btn-batch-archive-confirm:hover:not(:disabled) { background: #6d3b06; }
.btn-batch-archive:disabled,
.btn-batch-archive-confirm:disabled { opacity: 0.55; cursor: not-allowed; }
.batch-confirm-msg { font-size: var(--text-xs); color: #8a4b08; }

/* ── ML-CLOUD-02: duplicate warning ── */
.ml-dup-panel {
  margin: var(--space-3) var(--space-6) 0;
  padding: var(--space-3);
  background: #fdf6ec;
  border: 1px solid #d9a26a;
  border-radius: var(--radius-md);
}
.dup-panel-title {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm); font-weight: 600; color: #8a4b08;
  overflow-wrap: anywhere;
}
.dup-panel-note {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs); color: var(--color-ink-muted);
}
.dup-list { list-style: none; margin: 0 0 var(--space-2); padding: 0; }
.dup-item {
  display: flex; gap: var(--space-4); flex-wrap: wrap;
  padding: var(--space-2) 0;
  border-top: 1px solid #eddcc4;
}
.dup-col { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 200px; }
.dup-col-label {
  font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.dup-existing { display: flex; flex-direction: column; gap: 2px; }
.dup-name { font-size: var(--text-sm); color: var(--color-ink); overflow-wrap: anywhere; }
.dup-meta { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }
.dup-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.btn-dup-skip,
.btn-dup-anyway {
  height: 36px; padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap;
}
.btn-dup-skip { background: var(--color-primary-deep); color: white; border: 1px solid transparent; }
.btn-dup-skip:hover:not(:disabled) { background: var(--color-primary); }
.btn-dup-anyway { background: white; color: #8a4b08; border: 1px solid #d9a26a; }
.btn-dup-anyway:hover:not(:disabled) { background: #fdf3e7; }
.btn-dup-skip:disabled, .btn-dup-anyway:disabled { opacity: 0.55; cursor: not-allowed; }

/* References that could not be checked must not read like "none". */
.refs-unavailable {
  font-size: var(--text-xs); color: #8a4b08;
  background: #fdf6ec; border: 1px solid #d9a26a;
  border-radius: var(--radius-sm); padding: var(--space-2);
}
.detail-filename { overflow-wrap: anywhere; }

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
  .mobile-only { display: initial; }

  .ml-main { padding: var(--space-3); overflow: visible; }
  /*
    ML-CLOUD-03 — two fixed columns on a phone, matching the mobile master.
    `auto-fill minmax(140px)` gave two columns at 375px and three on a slightly
    wider phone, which shrank the filename to unreadable. Two is the layout.
  */
  .file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }

  /* Detail: full-width below grid */
  .ml-detail {
    width: 100%;
    border-left: none;
    border-top: 2px solid var(--color-primary);
  }

  .folder-select { min-width: 140px; max-width: 200px; }
}

/* ── ML-CLOUD-01: customer folder management ─────────────────────────────── */

.btn-folder-action {
  min-height: 36px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  cursor: pointer;
  white-space: nowrap;
}
.btn-folder-action:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary-deep); }
.btn-folder-action:disabled { opacity: 0.5; cursor: not-allowed; }

.folder-system-note { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; }

.ml-folder-panel {
  margin: var(--space-3) var(--space-6) 0;
  padding: var(--space-3);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
.folder-panel-title { margin: 0 0 var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.folder-panel-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.folder-panel-input {
  flex: 1 1 220px;
  min-width: 0;
  min-height: 36px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  box-sizing: border-box;
}
.btn-folder-confirm {
  min-height: 36px;
  padding: var(--space-1) var(--space-4);
  background: var(--color-primary);
  color: #fff;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  white-space: nowrap;
}
.btn-folder-confirm:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-folder-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-folder-cancel {
  min-height: 36px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-ink);
  cursor: pointer;
}
.btn-folder-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

.folder-panel-error {
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
  color: #C0392B;
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  /* Keep the actions reachable without a horizontal scroll on a phone. */
  .ml-folder-panel { margin-left: var(--space-4); margin-right: var(--space-4); }
  .folder-panel-row { flex-direction: column; align-items: stretch; }
  .folder-panel-input { flex: 1 1 auto; }
  .btn-folder-action { flex: 1 1 auto; }

  /* ML-CLOUD-02 — the duplicate decision has to be reachable on a phone. */
  .ml-dup-panel { margin-left: var(--space-4); margin-right: var(--space-4); }
  /*
    Once the row stacks, `flex: 1 1 200px` is a 200px basis in the COLUMN
    direction — a 200px-tall blank block under each label. Height here is
    whatever the text needs.
  */
  .dup-item { flex-direction: column; gap: var(--space-2); }
  .dup-col { flex: 0 0 auto; }
  .dup-actions { flex-direction: column; align-items: stretch; }
  .btn-dup-skip, .btn-dup-anyway { width: 100%; }
  .batch-confirm-msg { flex: 1 1 100%; }

  /*
    ML-CLOUD-03 — a phone has no drag-and-drop, so the strip becomes what it
    is useful as there: a labelled Upload button that names the destination.
  */
  .ml-dropzone { flex-direction: column; align-items: stretch; gap: var(--space-2); }
  .dropzone-actions { flex-direction: column; }
  .btn-dropzone-upload, .btn-dropzone-folder { width: 100%; }
  .dropzone-text > strong { font-size: var(--text-xs); }

  /* Batch actions stack rather than shrink below a comfortable tap target. */
  .selection-bar { gap: var(--space-2); }
  .selection-bar__clear { margin-left: 0; }
  .ml-topbar-actions .btn-batch-move,
  .ml-topbar-actions .btn-batch-archive,
  .ml-topbar-actions .btn-batch-archive-confirm,
  .ml-topbar-actions .btn-cancel-sel { flex: 1 1 auto; min-width: 96px; }
  /*
    The destination dropdown takes the full row on a phone, but `min-width: 0`
    is what actually lets it. A flex item defaults to `min-width: auto`, so a
    <select> holding a long folder name refuses to shrink below that name and
    pushes the whole topbar past the viewport.
  */
  .ml-topbar-actions {
    min-width: 0;
    max-width: 100%;
  }
  .ml-topbar-actions .folder-select {
    flex: 1 1 100%;
    /*
      `width: 0` matters as much as `min-width: 0`. A <select> is sized by its
      widest <option>, and a folder named "ZZ-ML-CLOUD-01 TEST ONLY — NOT FOR
      PUBLICATION" is far wider than a phone. Zeroing the base width makes the
      flex basis decide instead of the option text.
    */
    width: 0;
    min-width: 0;
    max-width: 100%;
  }
}
</style>
