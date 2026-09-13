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
/**
 * ML-CLOUD-UI-CLEANUP-01 — the upload destination IS the folder you are in.
 *
 * A separate destination dropdown alongside a breadcrumb gave the page two
 * competing answers to "where am I", and the dropdown was the one that decided
 * where files actually landed. The breadcrumb is now the only current-location
 * concept, and this reads from it.
 */
const uploadFolder = computed<string>(() => {
  if (showArchivedView.value) return ''
  const id = selectedFolder.value
  if (!id || id === 'root') return ''
  return flatFolders.value.some((f: FlatFolder) => f.id === id && f.allow_upload) ? id : ''
})
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

// Write-target dropdown: only active-canonical (allow_upload) folders
const uploadableFlatFolders = computed(() => flatFolders.value.filter((f: FlatFolder) => f.allow_upload))



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
  /**
   * HOTFIX — a folder action belongs to the folder it was opened for.
   *
   * Leaving the New folder / Rename / Move panel open across a navigation
   * left it describing a folder the operator was no longer in: once the view
   * moved to All files or Archived there was no current folder at all, and the
   * title rendered "New folder in undefined". Submitting from that state sent
   * an undefined parent. The panel closes with the view it belonged to.
   */
  closeFolderDialog()
  // The upload report describes the folder it happened in; carrying it into
  // another folder makes it look like it describes that one.
  uploadResults.value = []
  uploadErrors.value = []
}

function toggleArchivedView() {
  showArchivedView.value = !showArchivedView.value
  if (showArchivedView.value) selectedFolder.value = null
  // Same reason as selectFolder: the archived view has no current folder, so a
  // folder action left open here has nothing to act on.
  closeFolderDialog()
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
  // Destinations for the folder the Move dialog was opened on, not for
  // whatever folder happens to be on screen behind the dialog.
  const current = folderActionTarget.value
  if (!current) return []
  return flatFolders.value.filter((f: FlatFolder) =>
    f.can_create_children
    && f.zone_root === current.zone_root
    && f.id !== current.id
    && !f.full_path.startsWith(`${current.full_path}/`),
  )
})

const canCreateFolderHere = computed(() => currentFolder.value?.can_create_children === true)

type FolderDialog = 'none' | 'create' | 'rename' | 'move'
const folderDialog = ref<FolderDialog>('none')
const folderNameInput = ref('')
const folderMoveTarget = ref('')
const folderSubmitting = ref(false)
const folderError = ref<string | null>(null)

/**
 * ML-CLOUD-UI-CLEANUP-01 — every folder dialog names the folder it acts on.
 *
 * `create` targets the folder being browsed (that is what "New folder" means
 * here); `rename` and `move` target the folder whose menu was opened. Storing
 * the target explicitly is what lets the dialog say which folder it is about,
 * instead of the operator inferring it.
 */
function openFolderDialog(kind: Exclude<FolderDialog, 'none'>, target?: FlatFolder | null) {
  folderError.value = null
  folderActionTarget.value = kind === 'create' ? (currentFolder.value ?? null) : (target ?? null)
  folderNameInput.value = kind === 'rename' ? (folderActionTarget.value?.name ?? '') : ''
  folderMoveTarget.value = ''
  folderDialog.value = kind
  closeFolderMenu()
  uploadMenuOpen.value = false
}

function closeFolderDialog() {
  folderDialog.value = 'none'
  folderError.value = null
  folderActionTarget.value = null
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
  const parent = folderActionTarget.value?.id
  if (!parent) return
  return submitFolderAction(async () => {
    await $fetch('/api/admin/media/folders', {
      method: 'POST',
      body: { name: folderNameInput.value, parent },
    })
  })
}

function renameFolder() {
  const id = folderActionTarget.value?.id
  if (!id) return
  return submitFolderAction(async () => {
    await $fetch(`/api/admin/media/folders/${id}`, {
      method: 'PATCH',
      body: { name: folderNameInput.value },
    })
  })
}

function moveFolder() {
  const id = folderActionTarget.value?.id
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

// ── ML-CLOUD-UI-CLEANUP-01: information architecture ─────────────────────────

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — layered folder navigation.
 *
 * The navigation used to be two groups: every top-level area in one flat list,
 * and frozen folders behind one disclosure. On a phone that stacked into a
 * single undifferentiated column where a customer's own folder, a protected
 * system folder and a frozen one all looked the same, and the page ran long
 * before any file was visible.
 *
 * `folderSection()` partitions the tree by the governance the server already
 * decided, so each folder is listed exactly once and each section says what
 * kind of thing it holds. Only Quick access is open by default; the rest are
 * progressive disclosure, and that open/closed state is browser-only — it is
 * never persisted anywhere.
 */
/**
 * Quick access is a fixed shortcut to the top-level areas, and the desktop
 * sidebar's "Folders" list. It never changes with where you are standing.
 */
const quickAccessFolders = computed(() => flatFolders.value.filter((f: FlatFolder) => folderSection(f) === 'quick-access'))

/** Every frozen folder, in one place — the sealed V1 desktop disclosure. */
const protectedFolders = computed(() => flatFolders.value.filter((f: FlatFolder) => folderSection(f) === 'protected'))

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R1 — the phone's governance sections list
 * the DIRECT CHILDREN of where you are, never the whole tree.
 *
 * The first cut filtered `flatFolders` globally, which collected every
 * customer-managed folder in the library into one list regardless of depth:
 * `LT180C`, its `manuals`, and a `photos` folder from an unrelated model all
 * appeared as siblings. That is a second, flattened folder tree pretending to
 * be navigation — it hides the real parent of every row and contradicts the
 * hierarchy the library actually has.
 *
 * A section with no direct children of its kind renders nothing at all. An
 * empty "Customer folders" heading kept only to match the sample data in the
 * visual master would be a claim about this library that is not true.
 */
const navChildren = computed<FlatFolder[]>(() => {
  // At a library view (All files / Unclassified / Archived) the context is the root.
  const id = selectedFolder.value
  const context = (id === null || id === 'root' || showArchivedView.value) ? null : id
  return directChildFolders(flatFolders.value, parentMap.value, context)
})

const navCustomerFolders = computed(() => navChildren.value.filter((f: FlatFolder) => folderSection(f) === 'customer'))
const navSystemFolders = computed(() => navChildren.value.filter((f: FlatFolder) => folderSection(f) === 'system'))
const navProtectedFolders = computed(() => navChildren.value.filter((f: FlatFolder) => folderSection(f) === 'protected'))

/**
 * Whether a real folder is open, as opposed to a library view.
 *
 * In folder view the phone shows the folder's own contents — child folders and
 * files — and nothing else. Keeping the root sections on screen there would
 * offer two competing answers to "what is inside this?", and push the contents
 * below a navigation block the operator has already used.
 */
const inFolderView = computed(() =>
  selectedFolder.value !== null && selectedFolder.value !== 'root' && !showArchivedView.value,
)

const quickAccessOpen = ref(true)
const customerFoldersOpen = ref(false)
const systemFoldersOpen = ref(false)
const protectedFoldersOpen = ref(false)

/**
 * The folders that live inside the folder currently being browsed — the
 * "Folders" section of the main area. At a library view (All files,
 * Unclassified, Archived) there is no folder to look inside, so there is
 * nothing to list.
 */
const childFolders = computed(() => {
  const id = selectedFolder.value
  if (!id || id === 'root' || showArchivedView.value || searchActive.value) return []
  return flatFolders.value.filter((f: FlatFolder) => parentMap.value[f.id] === id)
})

/** Ancestors of the current folder, nearest last — the breadcrumb trail. */
const breadcrumbTrail = computed<FlatFolder[]>(() => {
  const id = selectedFolder.value
  if (!id || id === 'root' || showArchivedView.value) return []
  const chain: FlatFolder[] = []
  let cur: string | null = id
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const node = flatFolders.value.find((f: FlatFolder) => f.id === cur)
    if (!node) break
    chain.unshift(node)
    cur = parentMap.value[cur] ?? null
  }
  return chain
})

/**
 * Whether files may be uploaded where we are standing.
 *
 * MEDIA-UPLOAD-BLOCKER-HOTFIX-02 — "All files" and "Archived" are library
 * views, not places. Offering Upload there implied the page knew a
 * destination when it did not; the operator opens a folder first.
 *
 * R1 added "Unclassified" to that list. It reads like a folder but it is the
 * set of files that are in none, so uploading "into" it meant uploading with
 * no folder at all.
 */
const canUploadHere = computed(() => {
  if (showArchivedView.value) return false
  const id = selectedFolder.value
  if (id === null) return false // "All files" is a view, not a destination
  /**
   * ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R1 — "Unclassified" is a FILTER: the files
   * that have no folder yet. It is not a folder, so it cannot be a destination.
   * Uploading "into" it previously meant uploading with no folder at all, which
   * quietly made "leave this file unfiled" the easiest path in the interface —
   * the opposite of what the view exists to help you fix.
   */
  if (id === 'root') return false
  return flatFolders.value.some((f: FlatFolder) => f.id === id && f.allow_upload)
})

/** Why uploading is unavailable here, said in terms of what to do next. */
const uploadBlockedReason = computed(() => {
  if (showArchivedView.value) return 'Archived files cannot be added to. Open a folder to upload.'
  if (selectedFolder.value === null) return 'Open a folder to upload.'
  if (selectedFolder.value === 'root') return 'Unclassified lists files that have no folder yet. Open a folder to upload.'
  if (!canUploadHere.value) return 'This folder does not accept file uploads.'
  return ''
})

// ── Folder actions, aimed at one named folder ────────────────────────────────

/**
 * Rename and Move used to sit permanently in the toolbar acting on "the
 * current folder", which left the operator to work out what that was. They are
 * now opened from a specific folder tile, and `folderActionTarget` is the
 * folder they act on.
 */
const folderActionTarget = ref<FlatFolder | null>(null)
const folderMenuOpenFor = ref<string | null>(null)

function toggleFolderMenu(id: string) {
  folderMenuOpenFor.value = folderMenuOpenFor.value === id ? null : id
}
function closeFolderMenu() {
  folderMenuOpenFor.value = null
}

/**
 * A folder's display label: system slugs are title-cased, customer folder
 * names are shown exactly as the customer typed them.
 */
function folderLabel(f: { name: string, management: FolderNode['management'] }): string {
  return f.management === 'customer-managed' ? f.name : systemFolderLabel(f.name)
}

const folderDialogTitle = computed(() => {
  if (folderDialog.value === 'create') return 'Create new folder'
  if (folderDialog.value === 'rename') return 'Rename folder'
  return 'Move folder'
})

const uploadMenuOpen = ref(false)

function clearSearch() {
  searchQuery.value = ''
}

/**
 * HOTFIX — recover from a transient backend failure without a manual reload.
 *
 * The folder tree is refreshed too, not just the file list: a failed tree
 * refresh is what empties the sidebar, and an empty sidebar is what leaves the
 * rest of the page unable to describe where anything is.
 */
async function retryLoad() {
  errorMsg.value = ''
  try {
    await loadFolders()
  } catch { /* loadFiles reports the failure below */ }
  await loadArchivedIds()
  await loadFiles(true)
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
      <!--
        ML-CLOUD-UI-CLEANUP-01 — the breadcrumb is the ONLY statement of where
        you are. Every ancestor is a link, so it navigates as well as informs,
        and nothing else on the page claims to hold a "current folder".
      -->
      <nav class="ml-breadcrumb" aria-label="Location">
        <button
          v-if="breadcrumbTrail.length > 0"
          class="breadcrumb-up"
          title="Go to parent folder"
          @click="selectFolder(parentFolderId)"
        >↑</button>
        <button class="breadcrumb-root" @click="selectFolder(null)">Media Library</button>
        <template v-for="(crumb, i) in breadcrumbTrail" :key="crumb.id">
          <span class="breadcrumb-sep">/</span>
          <button
            v-if="i < breadcrumbTrail.length - 1"
            class="breadcrumb-link"
            @click="selectFolder(crumb.id)"
          >{{ folderLabel(crumb) }}</button>
          <span v-else class="breadcrumb-current">{{ folderLabel(crumb) }}</span>
        </template>
        <template v-if="breadcrumbTrail.length === 0 && currentViewLabel !== 'All files'">
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">{{ currentViewLabel }}</span>
        </template>
        <span
          v-if="currentFolder && currentFolder.management !== 'customer-managed'"
          class="breadcrumb-lock"
          title="Protected system folder"
        >🔒</span>
      </nav>

      <!--
        ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — the phone header names the page the
        way 07 does. On desktop the surrounding chrome already says what this
        screen is, so the line is hidden there rather than repeated.
      -->
      <p class="ml-subtitle">Manage and organize your media files</p>

      <div class="ml-topbar-actions">
        <!-- Batch actions replace the normal toolbar while files are selected -->
        <template v-if="selectedIds.size > 0">
          <span class="selection-count">{{ selectedIds.size }} selected</span>
          <select v-model="batchTargetFolder" class="folder-select" title="Move to approved folder">
            <option value="">— Move to folder —</option>
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
          <button class="btn-cancel-sel" @click="clearSelection">Clear</button>
        </template>

        <!--
          Normal state: two actions, both about the folder in the breadcrumb.
          Rename and Move are gone from here — they belong to a named folder,
          and are opened from that folder's own menu.
        -->
        <template v-else>
          <button
            v-if="canCreateFolderHere"
            class="btn-folder-action"
            :disabled="folderSubmitting"
            @click="openFolderDialog('create')"
          >+ New folder</button>

          <!-- Where there is no destination, say so instead of showing a dead button. -->
          <span v-if="!canUploadHere" class="upload-hint">{{ uploadBlockedReason }}</span>
          <div v-else class="upload-menu">
            <button
              class="btn-upload"
              :disabled="uploading || duplicateChecking"
              :title="uploadBlockedReason"
              @click="uploadMenuOpen = !uploadMenuOpen"
            >
              {{ uploading ? 'Uploading…' : duplicateChecking ? 'Checking…' : 'Upload' }}
              <span class="upload-caret">▾</span>
            </button>
            <div v-if="uploadMenuOpen" class="upload-menu__list">
              <!--
                "Select folder" used to name this action, which reads as
                "choose the Media Library folder to put things in". It picks a
                folder on the operator's own computer and imports what is
                inside it — flat — so it says that instead.
              -->
              <button class="upload-menu__item" @click="uploadMenuOpen = false; triggerUpload()">
                Upload files
              </button>
              <!--
                ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R2 — this action was named for
                what it picks, not for what it does, and understated its reach
                twice. `webkitdirectory` hands back every file in the chosen
                folder INCLUDING its subfolders, and `onFilesSelected` ignores
                `webkitRelativePath` entirely, so all of them land side by side
                in the folder you are standing in. "Imports the files inside a
                folder" reads as "the files I can see in it, arranged as they
                are" — the opposite of both. Say the reach and the flattening,
                because both are surprises worth having before the upload, not
                after.
              -->
              <button class="upload-menu__item" @click="uploadMenuOpen = false; triggerFolderUpload()">
                Upload files from a folder
                <span class="upload-menu__hint">
                  Picks a folder on your computer and adds every file in it — subfolders included —
                  directly into this folder. The folder structure is not recreated.
                </span>
              </button>
            </div>
          </div>
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
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.tsv,.xlsx,image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
    <!--
      HOTFIX — the panel requires a current folder to exist. Without the
      `currentFolder` guard it could outlive the folder it was opened for and
      render "New folder in undefined"; `closeFolderDialog()` on every view
      change is the primary fix, and this is the guard that makes the bad
      render impossible rather than merely unlikely.
    -->
    <!--
      ML-CLOUD-UI-CLEANUP-01 — folder actions are a dialog, not a slab of form
      wedged into the top of the page.

      The inline panel pushed the whole library down and gave no answer to
      "which folder is this about" beyond a title. The dialog states the
      Location explicitly, and it is bound to `folderActionTarget`, so the
      folder it names is the folder it acts on.
    -->
    <div v-if="folderDialog !== 'none' && folderActionTarget" class="ml-modal-backdrop" @click.self="closeFolderDialog">
      <div class="ml-modal" role="dialog" aria-modal="true" :aria-label="folderDialogTitle">
        <div class="ml-modal__header">
          <h2 class="ml-modal__title">{{ folderDialogTitle }}</h2>
          <button class="ml-modal__close" aria-label="Close" :disabled="folderSubmitting" @click="closeFolderDialog">✕</button>
        </div>

        <div class="ml-modal__body">
          <div class="modal-field">
            <span class="modal-field__label">{{ folderDialog === 'create' ? 'Location' : 'Folder' }}</span>
            <span class="modal-field__value">{{ folderActionTarget.full_path }}</span>
          </div>

          <label v-if="folderDialog !== 'move'" class="modal-field">
            <span class="modal-field__label">Folder name</span>
            <input
              v-model="folderNameInput"
              class="modal-input"
              type="text"
              placeholder="e.g. Manuals"
              :disabled="folderSubmitting"
              @keyup.enter="folderDialog === 'create' ? createFolder() : renameFolder()"
            >
          </label>

          <label v-else class="modal-field">
            <span class="modal-field__label">Move to</span>
            <select v-model="folderMoveTarget" class="modal-input" :disabled="folderSubmitting">
              <option value="">— Choose a destination —</option>
              <option v-for="f in folderMoveTargets" :key="f.id" :value="f.id">
                {{ '—'.repeat(f.depth) }} {{ f.name }}
              </option>
            </select>
            <span class="modal-field__hint">A folder can only move within its own product area.</span>
          </label>

          <p v-if="folderError" class="modal-error" role="alert">{{ folderError }}</p>
        </div>

        <div class="ml-modal__footer">
          <button class="btn-modal-cancel" :disabled="folderSubmitting" @click="closeFolderDialog">Cancel</button>
          <button
            class="btn-modal-confirm"
            :disabled="folderSubmitting || (folderDialog === 'move' ? !folderMoveTarget : folderNameInput.trim() === '')"
            @click="folderDialog === 'create' ? createFolder() : folderDialog === 'rename' ? renameFolder() : moveFolder()"
          >
            {{ folderSubmitting ? 'Working…' : folderDialog === 'create' ? 'Create folder' : folderDialog === 'rename' ? 'Rename' : 'Move' }}
          </button>
        </div>
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
    <!--
      HOTFIX — a failed load has to offer a way out of itself.
      A transient BFF outage (a dev server restarting, a dropped connection)
      left "Failed to load files" on screen with no route back except the
      operator knowing to reload the page by hand. Retry re-runs the same two
      loads the page runs on mount.
    -->
    <div v-if="errorMsg" class="banner banner--error">
      <span>{{ errorMsg }}</span>
      <button class="btn-retry" :disabled="loading" @click="retryLoad">
        {{ loading ? 'Retrying…' : 'Retry' }}
      </button>
    </div>
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
      <!--
        ML-CLOUD-UI-CLEANUP-01 — the sidebar answers "which area?" and nothing
        else.

        It used to flatten the whole tree into one column — system views,
        product categories, every customer folder, every TEST ONLY folder —
        which made it compete with the folder browser for the same job and
        buried the handful of places a person actually starts from. Depth now
        lives in the main area, reached by opening folders and read back from
        the breadcrumb.
      -->
      <aside class="ml-sidebar">
        <!--
          ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — two presentations of ONE
          classification.

          The phone and the desktop want different things from this column. A
          1440px workspace has a persistent sidebar beside a folder browser, so
          it lists the areas you start from and keeps governance states behind a
          single disclosure. A 375px screen has no beside — the column stacks on
          top of the files — so it needs the four groups spelled out and closed
          by default, which is what 07-mobile-layered-folder-navigation.png
          shows.

          Both are rendered from the SAME computeds (`folderSection()`), so the
          duplication here is presentation only: there is one classification
          rule, one badge rule, and one place to change either. CSS decides
          which block is shown, so the choice survives SSR without a hydration
          flash.

          The desktop block below is the sealed V1 markup, unchanged.
        -->
        <div class="ml-nav ml-nav--desktop">
          <p class="sidebar-section-label">Library</p>
          <button
            class="nav-item"
            :class="{ 'nav-item--active': selectedFolder === null && !showArchivedView }"
            @click="selectFolder(null)"
          >All files</button>
          <button
            class="nav-item"
            :class="{ 'nav-item--active': selectedFolder === 'root' && !showArchivedView }"
            @click="selectFolder('root')"
          >Unclassified</button>
          <button
            class="nav-item nav-item--archived"
            :class="{ 'nav-item--active': showArchivedView }"
            @click="toggleArchivedView"
          >Archived</button>

          <p class="sidebar-section-label">Folders</p>
          <button
            v-for="f in quickAccessFolders"
            :key="f.id"
            class="nav-item"
            :class="{ 'nav-item--active': selectedFolder === f.id && !showArchivedView }"
            @click="selectFolder(f.id)"
          >
            <span class="nav-item__icon" aria-hidden="true">📁</span>{{ folderLabel(f) }}
          </button>
          <p v-if="quickAccessFolders.length === 0" class="sidebar-empty">No folders</p>

          <!--
            Legacy and conflict folders are governance states, not places people
            go. One collapsed disclosure keeps them reachable without making the
            library look like a debugging console.
          -->
          <template v-if="protectedFolders.length > 0">
            <p class="sidebar-section-label">System</p>
            <button
              class="nav-item nav-item--disclosure"
              :aria-expanded="protectedFoldersOpen"
              @click="protectedFoldersOpen = !protectedFoldersOpen"
            >
              System folders
              <span class="nav-item__caret">{{ protectedFoldersOpen ? '▾' : '▸' }}</span>
            </button>
            <template v-if="protectedFoldersOpen">
              <button
                v-for="f in protectedFolders"
                :key="f.id"
                class="nav-item nav-item--sub"
                :class="{
                  'nav-item--active': selectedFolder === f.id && !showArchivedView,
                  'nav-item--legacy': f.policy_state === 'legacy-read-only',
                  'nav-item--conflict': f.policy_state === 'conflict-frozen',
                }"
                @click="selectFolder(f.id)"
              >
                {{ f.name }}
                <span class="nav-item__tag">{{ folderBadge(f) }}</span>
              </button>
            </template>
          </template>
        </div>

        <!--
          The phone: four sections, partitioned by the governance the server
          already decided. Each folder appears in exactly one of them, so the
          list never repeats itself, and each heading says what kind of folder
          is inside.

          Only Quick access opens by default. The rest are progressive
          disclosure: the whole navigation is then about one screen tall instead
          of a column the operator has to scroll past to reach any file.
        -->
        <div class="ml-nav ml-nav--mobile">
          <!--
            File STATE is not folder navigation. It answers "which slice of the
            library am I looking at?", so it sits above the folder sections and
            renders as one segmented control rather than three rows that read
            like folders.
          -->
          <div class="file-state">
            <button
              class="nav-item"
              :class="{ 'nav-item--active': selectedFolder === null && !showArchivedView }"
              @click="selectFolder(null)"
            >All files</button>
            <!--
              ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R2 — "Unclassified" means files
              that are in no folder at all, so inside a folder it is a
              contradiction: nothing here can ever be unclassified. Offering it
              beside the folder's own contents invited a tap that silently
              abandons the folder you are standing in. "All files" and
              "Archived" stay, because those remain coherent places to jump to.
            -->
            <button
              v-if="!inFolderView"
              class="nav-item"
              :class="{ 'nav-item--active': selectedFolder === 'root' && !showArchivedView }"
              @click="selectFolder('root')"
            >Unclassified</button>
            <button
              class="nav-item nav-item--archived"
              :class="{ 'nav-item--active': showArchivedView }"
              @click="toggleArchivedView"
            >Archived</button>
          </div>

          <!--
            The root sections belong to the root. Once a folder is open, its
            contents are the answer to "what is in here?", and the main area
            below already gives them — child folders first, then files.
          -->
          <template v-if="!inFolderView">
          <section class="nav-section">
            <button
              class="nav-section__head"
              :aria-expanded="quickAccessOpen"
              @click="quickAccessOpen = !quickAccessOpen"
            >
              <span class="nav-section__icon" aria-hidden="true">★</span>
              <span class="nav-section__text">
                <span class="nav-section__title">Quick access</span>
                <span class="nav-section__sub">Your main folders</span>
              </span>
              <span class="nav-section__caret" aria-hidden="true">{{ quickAccessOpen ? '▾' : '▸' }}</span>
            </button>
            <div v-if="quickAccessOpen" class="nav-section__body">
              <button
                v-for="f in quickAccessFolders"
                :key="f.id"
                class="folder-row"
                :class="{ 'folder-row--active': selectedFolder === f.id && !showArchivedView }"
                @click="selectFolder(f.id)"
              >
                <span class="folder-row__icon" aria-hidden="true">📁</span>
                <span class="folder-row__name" :title="f.full_path">{{ folderLabel(f) }}</span>
                <!--
                  A shortcut must not make a folder look safer than it is: the
                  badge is computed from the same state wherever the row is drawn.
                -->
                <span
                  v-if="folderBadge(f)"
                  class="folder-row__badge"
                  :class="`folder-row__badge--${folderBadge(f) === 'Conflict' ? 'conflict' : 'muted'}`"
                >{{ folderBadge(f) }}</span>
                <span class="folder-row__chevron" aria-hidden="true">›</span>
              </button>
              <p v-if="quickAccessFolders.length === 0" class="nav-section__empty">No folders</p>
            </div>
          </section>

          <section v-if="navCustomerFolders.length > 0" class="nav-section">
            <button
              class="nav-section__head"
              :aria-expanded="customerFoldersOpen"
              @click="customerFoldersOpen = !customerFoldersOpen"
            >
              <span class="nav-section__icon" aria-hidden="true">👥</span>
              <span class="nav-section__text">
                <span class="nav-section__title">Customer folders</span>
                <span class="nav-section__sub">Folders you can create, rename and move</span>
              </span>
              <span class="nav-section__caret" aria-hidden="true">{{ customerFoldersOpen ? '▾' : '▸' }}</span>
            </button>
            <div v-if="customerFoldersOpen" class="nav-section__body">
              <button
                v-for="f in navCustomerFolders"
                :key="f.id"
                class="folder-row"
                :class="{ 'folder-row--active': selectedFolder === f.id && !showArchivedView }"
                @click="selectFolder(f.id)"
              >
                <span class="folder-row__icon" aria-hidden="true">📁</span>
                <span class="folder-row__name" :title="f.full_path">{{ folderLabel(f) }}</span>
                <span class="folder-row__chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </section>

          <section v-if="navSystemFolders.length > 0" class="nav-section">
            <button
              class="nav-section__head"
              :aria-expanded="systemFoldersOpen"
              @click="systemFoldersOpen = !systemFoldersOpen"
            >
              <span class="nav-section__icon" aria-hidden="true">⚙</span>
              <span class="nav-section__text">
                <span class="nav-section__title">System folders</span>
                <span class="nav-section__sub">Business classification, managed by LITUBO</span>
              </span>
              <span class="nav-section__caret" aria-hidden="true">{{ systemFoldersOpen ? '▾' : '▸' }}</span>
            </button>
            <div v-if="systemFoldersOpen" class="nav-section__body">
              <button
                v-for="f in navSystemFolders"
                :key="f.id"
                class="folder-row"
                :class="{ 'folder-row--active': selectedFolder === f.id && !showArchivedView }"
                @click="selectFolder(f.id)"
              >
                <span class="folder-row__icon" aria-hidden="true">📁</span>
                <span class="folder-row__name" :title="f.full_path">{{ folderLabel(f) }}</span>
                <span
                  v-if="folderBadge(f)"
                  class="folder-row__badge folder-row__badge--muted"
                >{{ folderBadge(f) }}</span>
                <span class="folder-row__chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </section>

          <section v-if="navProtectedFolders.length > 0" class="nav-section">
            <button
              class="nav-section__head"
              :aria-expanded="protectedFoldersOpen"
              @click="protectedFoldersOpen = !protectedFoldersOpen"
            >
              <span class="nav-section__icon" aria-hidden="true">🔒</span>
              <span class="nav-section__text">
                <span class="nav-section__title">Protected folders</span>
                <span class="nav-section__sub">Read-only folders</span>
              </span>
              <span class="nav-section__caret" aria-hidden="true">{{ protectedFoldersOpen ? '▾' : '▸' }}</span>
            </button>
            <div v-if="protectedFoldersOpen" class="nav-section__body">
              <button
                v-for="f in navProtectedFolders"
                :key="f.id"
                class="folder-row"
                :class="{ 'folder-row--active': selectedFolder === f.id && !showArchivedView }"
                @click="selectFolder(f.id)"
              >
                <span class="folder-row__icon" aria-hidden="true">📁</span>
                <span class="folder-row__name" :title="f.full_path">{{ folderLabel(f) }}</span>
                <span
                  v-if="folderBadge(f)"
                  class="folder-row__badge"
                  :class="`folder-row__badge--${folderBadge(f) === 'Conflict' ? 'conflict' : 'muted'}`"
                >{{ folderBadge(f) }}</span>
                <span class="folder-row__chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </section>
          </template>
        </div>
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
        <!--
          ML-CLOUD-UI-CLEANUP-01 — the drop hint appears while dragging, not
          permanently. A banner that size sitting above every folder was the
          loudest thing on the page and said nothing most of the time.
        -->
        <div v-if="dragActive && canUploadHere" class="ml-dropzone ml-dropzone--active">
          <strong>Drop files here</strong>
          <span class="dropzone-sub">Uploads to {{ dropTargetLabel }}</span>
        </div>

        <!--
          Folders come before files, and look like folders. Without the split,
          a directory of subfolders and a directory of documents were the same
          undifferentiated wall of cards.
        -->
        <section v-if="childFolders.length > 0" class="folders-section">
          <h2 class="section-label">Folders</h2>
          <div class="folder-grid">
            <div
              v-for="f in childFolders"
              :key="f.id"
              class="folder-tile"
              :class="{ 'folder-tile--protected': f.management !== 'customer-managed' }"
              role="button"
              tabindex="0"
              @click="selectFolder(f.id)"
              @keydown.enter="selectFolder(f.id)"
            >
              <span class="folder-tile__icon" aria-hidden="true">📁</span>
              <span class="folder-tile__name" :title="f.full_path">{{ folderLabel(f) }}</span>
              <span v-if="f.management !== 'customer-managed'" class="folder-tile__lock" title="Protected system folder">🔒</span>
              <!--
                Rename and Move belong to a folder, so they are opened from it.
                A protected folder shows no menu at all: the server refuses
                these actions anyway, and offering them invites a dead end.
              -->
              <button
                v-if="f.management === 'customer-managed'"
                class="folder-tile__menu"
                :aria-label="`Actions for ${f.name}`"
                @click.stop="toggleFolderMenu(f.id)"
              >⋯</button>
              <div v-if="folderMenuOpenFor === f.id" class="folder-menu" @click.stop>
                <button class="folder-menu__item" @click="openFolderDialog('rename', f)">Rename</button>
                <button class="folder-menu__item" @click="openFolderDialog('move', f)">Move</button>
              </div>
            </div>
          </div>
        </section>

        <h2 v-if="childFolders.length > 0 && files.length > 0" class="section-label">Files</h2>

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
          <template v-else-if="childFolders.length > 0">
            <p class="empty-title">No files in this folder</p>
            <p class="empty-hint">Open one of the folders above, or add files here.</p>
            <button v-if="canUploadHere" class="btn-empty-action" :disabled="uploading" @click="triggerUpload">
              Upload files
            </button>
          </template>
          <template v-else>
            <!-- An empty folder is where a loud drop hint earns its space. -->
            <p class="empty-title">This folder is empty</p>
            <p class="empty-hint">
              <span class="desktop-only">Drop files here, or upload them.</span>
              <span class="mobile-only">Upload files to get started.</span>
            </p>
            <button v-if="canUploadHere" class="btn-empty-action" :disabled="uploading" @click="triggerUpload">
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
              /*
                A document has no picture to look at, so its card is carrying a
                NAME. On a phone that name is the whole point, and it is what a
                two-column grid squeezes hardest. Marked here; laid out as a
                full-width row in the 767px block.
              */
              'file-card--doc': !isImage(f.type),
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

/* Phone-only page subtitle — see the note in the template. */
.ml-subtitle { display: none; }

/* Breadcrumb */
.ml-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1 1 0;
  min-width: 0;
  /*
    ML-CLOUD-UI-CLEANUP-01 — the trail now shows every ancestor, so it is much
    longer than the single label it replaced. It wraps rather than pushing the
    toolbar past the viewport, and the last segment (the folder you are in,
    which can be any length a customer typed) is the one that ellipsizes.
  */
  flex-wrap: wrap;
  row-gap: var(--space-1);
}
.ml-breadcrumb > * { min-width: 0; }
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
  white-space: nowrap;
  max-width: 100%;
}
.breadcrumb-link, .breadcrumb-root {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
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
/* HOTFIX — the error banner carries a Retry control, so it lays out as a row. */
.banner--error {
  background: #fdf0ee; color: #c0392b; border-bottom: 1px solid #f5c6c2;
  display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
}
.banner--error > span { min-width: 0; overflow-wrap: anywhere; }
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

/*
  ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — the two navigation presentations.

  `.ml-nav--desktop` is the sealed V1 sidebar and carries no styling of its
  own: it is built from `.sidebar-section-label` / `.nav-item`, exactly as
  before this module.

  Everything below `.ml-nav--mobile` styles markup that ONLY ever renders at
  375px, so it is written as the phone layout directly rather than as a desktop
  look with mobile overrides. Nothing here can reach the desktop sidebar.

  (Replaces the `.folder-item*` / `.sidebar-divider` / `.sidebar-legacy-toggle`
  rules, which had been dead since ML-CLOUD-UI-CLEANUP-01 replaced that markup
  with `.nav-item`.)
*/
.ml-nav { display: flex; flex-direction: column; min-width: 0; }
.ml-nav--desktop { gap: 1px; }
.ml-nav--mobile { display: none; gap: var(--space-3); }

/* File state — three views as one segmented control. */
.file-state {
  display: flex;
  gap: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: 3px;
}
/*
  `min-width: 0` is what keeps "Unclassified" from setting a floor wider than a
  third of a 375px screen and pushing the control past the viewport.
*/
.file-state .nav-item {
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
  min-height: 40px;
  padding: var(--space-1);
  font-size: var(--text-xs);
  border-radius: calc(var(--radius-md) - 3px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Each folder section is a card, so the boundary between groups is visible. */
.nav-section {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.nav-section__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--color-ink);
}

.nav-section__icon { flex-shrink: 0; font-size: var(--text-base); }
.nav-section__text { display: flex; flex-direction: column; min-width: 0; }
.nav-section__title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.nav-section__sub {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-section__caret {
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--text-base);
  color: var(--color-ink-muted);
}

.nav-section__body { display: flex; flex-direction: column; border-top: 1px solid var(--color-line); }
.nav-section__body > .folder-row + .folder-row { border-top: 1px solid var(--color-line); }

.nav-section__empty {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  padding: var(--space-3);
  margin: 0;
  font-style: italic;
}

/*
  One folder row, used by all four sections. A single row shape is the point:
  it is what lets a person compare a customer folder against a protected one
  without re-reading the layout. 44px is the minimum comfortable touch target,
  and every row is the same height whether or not it carries a badge — a list
  whose rows change height by status is harder to scan than the status itself
  is to read.
*/
.folder-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  font-size: var(--text-sm);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}
.folder-row:hover { background: var(--color-surface-alt); }
.folder-row--active { background: var(--color-primary-deep); color: #fff; font-weight: 600; }
.folder-row--active:hover { background: var(--color-primary-deep); }

.folder-row__icon { flex-shrink: 0; font-size: var(--text-base); }

/*
  `min-width: 0` is what allows the ellipsis: a flex item defaults to
  `min-width: auto` and refuses to shrink below its content, which pushes the
  badge and chevron off the right edge instead of truncating the name.
*/
.folder-row__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-row__badge {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1.6;
  padding: 0 6px;
  border-radius: 99px;
  border: 1px solid var(--color-line);
  color: var(--color-ink-muted);
  background: var(--color-surface);
  white-space: nowrap;
}
.folder-row__badge--conflict { color: #8a4b08; border-color: #d9a26a; background: #fdf6ec; }
.folder-row--active .folder-row__badge { color: inherit; border-color: currentColor; background: transparent; }

.folder-row__chevron { flex-shrink: 0; color: var(--color-ink-muted); }
.folder-row--active .folder-row__chevron { color: inherit; }

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

.btn-retry {
  margin-left: auto;
  min-height: 28px;
  padding: 0 var(--space-3);
  background: white;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.btn-retry:disabled { opacity: 0.55; cursor: not-allowed; }

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
  /*
    ML-CLOUD-UI-CLEANUP-01 — readability before density. At 160px the grid fit
    six columns and every business filename truncated to "ZZ-ML-CLOUD-…",
    which is not a filename anyone can act on. This lands at four to five
    columns in the ~1030px main area.
  */
  grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
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
.file-card__icon--tsv .icon-kind,
.file-card__icon--xlsx .icon-kind { background: #1e7a52; }
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
  /*
    ML-CLOUD-UI-CLEANUP-01 — a filename gets two lines before it truncates.
    On one line every descriptive business filename collapsed to
    "ZZ-ML-CLOUD-…", which tells the reader nothing. Two lines are always
    reserved, so cards stay the same height whether the name wraps or not.
  */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  min-height: calc(2 * 1.35em);
  line-height: 1.35;
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

/* ── ML-CLOUD-UI-CLEANUP-01: sidebar navigation ── */
.nav-item {
  display: flex; align-items: center; gap: var(--space-2);
  width: 100%; min-height: 36px;
  padding: var(--space-1) var(--space-3);
  background: none; border: none; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink);
  text-align: left; cursor: pointer;
}
.nav-item:hover { background: var(--color-surface-alt); }
.nav-item--active { background: var(--color-primary-deep); color: #fff; font-weight: 600; }
.nav-item--active:hover { background: var(--color-primary-deep); }
.nav-item__icon { font-size: var(--text-sm); flex-shrink: 0; }
.nav-item__caret { margin-left: auto; font-size: var(--text-xs); color: var(--color-ink-muted); }
.nav-item--active .nav-item__caret { color: inherit; }
.nav-item--archived { color: #8a4b08; }
.nav-item--archived.nav-item--active { color: #fff; }
.nav-item--disclosure { color: var(--color-ink-muted); }
.nav-item--sub { padding-left: var(--space-6); font-size: var(--text-xs); }
.nav-item__tag {
  margin-left: auto; font-size: 10px; color: var(--color-ink-muted);
  border: 1px solid var(--color-line); border-radius: 99px; padding: 0 6px;
}
.nav-item--active .nav-item__tag { color: inherit; border-color: currentColor; }

/* ── Section labels in the main area ── */
.section-label {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--color-ink-muted);
}
.folders-section { margin-bottom: var(--space-5); }

/* ── Folder tiles: a folder must not look like a file ── */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}
.folder-tile {
  position: relative;
  display: flex; align-items: center; gap: var(--space-2);
  /*
    A grid item defaults to `min-width: auto`, so without this the tile refuses
    to shrink below the full width of the folder name inside it and pushes the
    page sideways. The name's own `min-width: 0` is not enough — the tile is
    the grid item, and it is the one that has to agree to be narrow.
  */
  min-width: 0;
  min-height: 52px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.folder-tile:hover { border-color: var(--color-primary); background: #f7fbfa; }
.folder-tile__icon { font-size: var(--text-lg); flex-shrink: 0; }
.folder-tile__name {
  flex: 1; min-width: 0;
  font-size: var(--text-sm); font-weight: 600; color: var(--color-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.folder-tile__lock { font-size: var(--text-xs); flex-shrink: 0; }
.folder-tile--protected { background: var(--color-surface-alt); }
.folder-tile__menu {
  flex-shrink: 0;
  width: 28px; height: 28px;
  background: none; border: 1px solid transparent; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink-muted); cursor: pointer;
  line-height: 1;
}
.folder-tile__menu:hover { border-color: var(--color-line); background: white; color: var(--color-ink); }
.folder-menu {
  position: absolute; top: calc(100% - 4px); right: var(--space-2); z-index: 20;
  min-width: 132px; padding: var(--space-1);
  background: white; border: 1px solid var(--color-line);
  border-radius: var(--radius-md); box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}
.folder-menu__item {
  display: block; width: 100%;
  padding: var(--space-2) var(--space-3);
  background: none; border: none; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); text-align: left; cursor: pointer;
}
.folder-menu__item:hover { background: var(--color-surface-alt); }

/* ── Upload menu ── */
.upload-menu { position: relative; }
/*
  `nowrap` was safe while every reason fitted in a few words. The Unclassified
  reason has to explain what that view IS before it can explain why you cannot
  upload into it, and at 375px an unwrappable 430px sentence pushed the whole
  page 71px past the viewport. The hint wraps; only the toolbar row it sits in
  needs to stay tidy.
*/
.upload-hint { font-size: var(--text-xs); color: var(--color-ink-muted); min-width: 0; }
.upload-caret { margin-left: 6px; font-size: var(--text-xs); }
.upload-menu__list {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 30;
  min-width: 260px; padding: var(--space-1);
  background: white; border: 1px solid var(--color-line);
  border-radius: var(--radius-md); box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}
.upload-menu__item {
  display: flex; flex-direction: column; gap: 2px; width: 100%;
  padding: var(--space-2) var(--space-3);
  background: none; border: none; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink); text-align: left; cursor: pointer;
}
.upload-menu__item:hover { background: var(--color-surface-alt); }
.upload-menu__hint { font-size: var(--text-xs); color: var(--color-ink-muted); }

/* ── Modal ── */
.ml-modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);
  background: rgba(15, 30, 26, 0.38);
}
.ml-modal {
  width: 100%; max-width: 460px;
  background: white; border-radius: var(--radius-md);
  box-shadow: 0 18px 48px rgba(0,0,0,0.24);
  display: flex; flex-direction: column; max-height: 90vh;
}
.ml-modal__header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
}
.ml-modal__title { margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--color-ink); }
.ml-modal__close {
  margin-left: auto; width: 28px; height: 28px;
  background: none; border: none; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-ink-muted); cursor: pointer;
}
.ml-modal__close:hover { background: var(--color-surface-alt); color: var(--color-ink); }
.ml-modal__body {
  padding: var(--space-4) var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
  overflow-y: auto;
}
.modal-field { display: flex; flex-direction: column; gap: var(--space-1); }
.modal-field__label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted); }
.modal-field__value {
  font-size: var(--text-sm); color: var(--color-ink);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-alt); border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
}
.modal-field__hint { font-size: var(--text-xs); color: var(--color-ink-muted); }
.modal-input {
  width: 100%; min-height: 40px; box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}
.modal-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
.modal-error { margin: 0; font-size: var(--text-xs); color: #c0392b; overflow-wrap: anywhere; }
.ml-modal__footer {
  display: flex; justify-content: flex-end; gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-line);
}
.btn-modal-cancel, .btn-modal-confirm {
  min-height: 40px; padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; cursor: pointer;
}
.btn-modal-cancel { background: white; border: 1px solid var(--color-line); color: var(--color-ink); }
.btn-modal-cancel:hover:not(:disabled) { background: var(--color-surface-alt); }
.btn-modal-confirm { background: var(--color-primary-deep); border: 1px solid transparent; color: white; }
.btn-modal-confirm:hover:not(:disabled) { background: var(--color-primary); }
.btn-modal-cancel:disabled, .btn-modal-confirm:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Breadcrumb links ── */
.breadcrumb-link {
  background: none; border: none; padding: 0;
  font-size: var(--text-base); color: var(--color-ink-muted); cursor: pointer;
}
.breadcrumb-link:hover { color: var(--color-primary-deep); text-decoration: underline; }

/* ── Responsive helpers ── */
.desktop-only { }
.mobile-only { display: none; }

/* ── Responsive 1024px ── */
@media (max-width: 1023px) {
  .ml-detail { width: 260px; }
}

/* ── Responsive 767px (375px) ── */
/*
  ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — the phone gets its own hierarchy, not a
  narrowed desktop.

  What was here before turned the sidebar into a horizontal strip of pills:
  every folder, at every governance state, side by side in one scrolling row.
  It fitted, but it flattened the one distinction the operator most needs —
  which folders are theirs, which are the system's, and which cannot be touched
  — and it pushed the file grid below a wall of chips.

  This block does not restyle the desktop sidebar into a phone layout; it swaps
  which of the two navigation blocks is rendered. The sealed V1 sidebar is left
  exactly as it was for every width above this one.
*/
@media (max-width: 767px) {
  .ml-shell { height: auto; overflow: visible; }

  /*
    The header stacks: location, then what this screen is, then its actions.
    The 16px row gap it inherits is meant for a wide toolbar; on a phone the
    three parts sit on their own lines and that gap became 112px of header
    holding one short sentence.
  */
  .ml-topbar {
    padding: var(--space-3) var(--space-4);
    min-height: auto;
    gap: var(--space-2);
    align-items: flex-start;
  }
  .ml-breadcrumb { flex: 1 1 100%; }
  /*
    `.admin-shell button` sets a 20px horizontal padding with `!important` to
    guarantee touch targets. On the breadcrumb root that indented the page
    title 20px past the subtitle beneath it, so the header read as two
    unrelated lines. The vertical padding — and with it the touch target —
    is left alone; only the left inset is removed so the two lines align.
  */
  .ml-shell .ml-topbar .ml-breadcrumb button.breadcrumb-root {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .ml-subtitle {
    display: block;
    flex: 1 1 100%;
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
  }
  .ml-topbar-actions { flex: 1 1 100%; }

  .ml-filterbar { padding: var(--space-2) var(--space-4); }
  .file-count { display: none; }

  .ml-body { flex-direction: column; overflow: visible; }

  .ml-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-surface-alt);
    overflow: visible;
    padding: var(--space-3);
  }

  /* The one swap this whole block exists for. */
  .ml-nav--desktop { display: none; }
  .ml-nav--mobile { display: flex; }

  /*
    The filter is a three-option select; the search field is where a long
    filename gets typed, so the remaining width goes to search rather than
    being split evenly.
  */
  .type-select { flex: 0 0 auto; min-width: 0; width: auto; }

  .ml-main { padding: var(--space-3); overflow: visible; }
  /*
    ML-CLOUD-03 — two fixed columns on a phone, matching the mobile master.
    `auto-fill minmax(140px)` gave two columns at 375px and three on a slightly
    wider phone, which shrank the filename to unreadable. Two is the layout.
  */
  .file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }

  /*
    ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R2 — documents get the full row.

    Two columns suit thumbnails: half a phone is enough to recognise a picture.
    A document card has no picture, so the same half-width column was spending
    120px of height on a coloured TXT chip and then breaking the filename —
    the only thing that identifies the file — across two clipped lines
    ("README-TEST-" / "ONLY.txt"). Given the whole width the card turns on its
    side: a narrow kind strip, then the name on one line with its type, size
    and folder under it.

    Images keep the two-column grid, so a mixed folder reads as what it is
    rather than being flattened to one shape.
  */
  .file-card--doc {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: stretch;
  }
  .file-card--doc .file-card__thumb { height: auto; width: 84px; }
  .file-card--doc .file-card__icon { padding: var(--space-2) 4px; }
  .file-card--doc .file-card__info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
  }
  /* Full width means the name no longer has to be clamped to fit. */
  .file-card--doc .file-card__title {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /*
    The "Archived" badge is pinned to the card's top-right, which was over the
    thumbnail while the card was a column. Turning the card on its side put the
    filename under it, so an archived document read "LT180C-test-general
    CORRUP[Archived]" — the badge covering the very characters that tell the
    two files apart. The title reserves the badge's width instead; only the
    title needs it, since the lines below sit clear of the badge.
  */
  .file-card--doc.file-card--archived .file-card__title { padding-right: 68px; }


  /* Detail: full-width below grid */
  .ml-detail {
    width: 100%;
    border-left: none;
    border-top: 2px solid var(--color-primary);
  }

  .desktop-only { display: none; }
  .mobile-only { display: initial; }

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

  /* ── ML-CLOUD-UI-CLEANUP-01: mobile IA ── */
  /*
    The sidebar becomes a horizontal strip of top-level areas. There are only a
    handful of them now, which is exactly why this works — the old flat tree
    would have scrolled forever sideways.
  */
  .nav-item { width: auto; flex: 0 0 auto; border: 1px solid var(--color-line); }
  .nav-item--sub { padding-left: var(--space-3); }
  .sidebar-section-label { flex: 1 1 100%; margin: var(--space-1) 0 0; }

  /* Folders read as rows on a phone, matching the mobile master. */
  .folder-grid { grid-template-columns: 1fr; gap: var(--space-2); }
  .folder-tile { min-height: 48px; }

  /* Dialogs sit at the bottom of the screen, where a thumb is. */
  .ml-modal-backdrop { align-items: flex-end; padding: 0; }
  .ml-modal { max-width: none; border-radius: var(--radius-md) var(--radius-md) 0 0; max-height: 88vh; }
  .ml-modal__header, .ml-modal__body, .ml-modal__footer { padding-left: var(--space-4); padding-right: var(--space-4); }
  .ml-modal__footer { flex-direction: column-reverse; }
  .btn-modal-cancel, .btn-modal-confirm { width: 100%; }

  /* The trail is the only location statement, so it must fit a phone. */
  .ml-breadcrumb { flex: 1 1 100%; }
  .breadcrumb-current { max-width: 100%; }

  .upload-menu { flex: 1 1 auto; }
  /*
    The list used to be pinned to both edges of the Upload button, so it was
    whatever the button was — about 150px once "+ New folder" takes its half of
    the toolbar. That was wide enough for two-word labels; it broke the folder
    action's new sentence into eleven lines. Anchored to the right edge only,
    it opens leftwards to the page margin. `left: auto` matters: with left,
    right and width all set the box is over-constrained, and CSS drops `right`
    — which sent it off the right of the screen instead.
  */
  .upload-menu__list {
    left: auto;
    right: 0;
    min-width: 0;
    width: min(340px, calc(100vw - 2 * var(--space-4)));
  }
  .btn-upload { width: 100%; }
}
</style>
