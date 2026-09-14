import { ref, watch } from 'vue'
import {
  buildLibraryFilesQuery,
  flattenFolderTree,
  libraryShowsFiles,
  UNCLASSIFIED_FOLDER,
  type LibraryTypeFilter,
} from '~/utils/mediaDisplay'

/**
 * CC-IMP-04 — browsing the Media Library for a picker, shared.
 *
 * The same request rules the Product Workspace picker established
 * (MEDIA-AI-LINK-PICKER-01 / -R1): the existing `/api/admin/media/files` and
 * `/api/admin/media/folders` endpoints, `buildLibraryFilesQuery` (which asks the
 * server to exclude archived files from the result itself), the root rule, and
 * "only the newest request may fill the list". Browsing is read-only; linking is
 * always the caller's explicit, staged pick.
 */

export interface MediaLibraryFile {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  /** Discovery only — never used to decide what a file belongs to. */
  folder: string | null
}

export interface MediaLibraryFolder {
  id: string
  name: string
  parent: string | null
  full_path: string
  management: string
  children: MediaLibraryFolder[]
}

export function useMediaLibraryBrowser(pageSize = 60) {
  const open = ref(false)
  const files = ref<MediaLibraryFile[]>([])
  const loading = ref(false)
  const error = ref(false)
  const total = ref(0)
  const search = ref('')
  const typeFilter = ref<LibraryTypeFilter>('')
  const folderId = ref<string | null>(null)
  const folders = ref<MediaLibraryFolder[]>([])
  const foldersError = ref(false)
  let offset = 0
  let request = 0
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  async function loadFiles(reset = false) {
    const current = ++request
    if (reset) { offset = 0; files.value = []; total.value = 0 }
    error.value = false
    const state = { folder: folderId.value, search: search.value, type: typeFilter.value }
    if (!libraryShowsFiles(state)) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const res = await $fetch<{ data: MediaLibraryFile[], meta?: { filter_count: number } }>('/api/admin/media/files', {
        query: buildLibraryFilesQuery({ ...state, limit: pageSize, offset }),
      })
      if (current !== request) return
      files.value = reset ? (res.data ?? []) : [...files.value, ...(res.data ?? [])]
      total.value = res.meta?.filter_count ?? res.data?.length ?? 0
      offset += res.data?.length ?? 0
    } catch {
      if (current === request) error.value = true
    } finally {
      if (current === request) loading.value = false
    }
  }

  async function loadFolders() {
    foldersError.value = false
    try {
      folders.value = await $fetch<MediaLibraryFolder[]>('/api/admin/media/folders')
    } catch {
      foldersError.value = true
    }
  }

  /** Opens the picker, optionally narrowed to a format (hero and inline media are images). */
  async function openLibrary(type?: LibraryTypeFilter) {
    if (type !== undefined) typeFilter.value = type
    open.value = true
    void loadFiles(true)
    await loadFolders()
    const id = folderId.value
    if (id !== null && id !== UNCLASSIFIED_FOLDER && !foldersError.value && !flattenFolderTree(folders.value).some(f => f.id === id)) {
      folderId.value = null
    }
  }

  function closeLibrary() {
    open.value = false
  }

  function navigateFolder(id: string | null) {
    clearTimeout(searchTimer)
    folderId.value = id
  }

  function updateSearch(value: string) {
    search.value = value
  }

  function updateTypeFilter(value: LibraryTypeFilter) {
    typeFilter.value = value
  }

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => loadFiles(true), 350)
  })
  watch([folderId, typeFilter], () => { if (open.value) void loadFiles(true) })

  return {
    open, files, loading, error, total, search, typeFilter, folderId, folders, foldersError,
    loadFiles, loadFolders, openLibrary, closeLibrary, navigateFolder, updateSearch, updateTypeFilter,
  }
}
