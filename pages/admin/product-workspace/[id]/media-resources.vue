<script setup lang="ts">
import type { AdminProduct, ProductMedia } from '~/types/product-cms'
import { workspaceHeroUrl } from '~/utils/productWorkspace'

interface LibraryFile {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
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

const mediaList = computed<ProductMedia[]>(() => mediaData.value ?? [])

const actionError = ref('')
const actionSuccess = ref('')

// ── Media Library picker: browsing the library is read-only; the only writes
//    this page ever issues are the explicit link/unlink calls below. ────────
const libraryOpen = ref(false)
const libraryFiles = ref<LibraryFile[]>([])
const libraryLoading = ref(false)
const libraryTotal = ref(0)
const librarySearch = ref('')
const libraryTypeFilter = ref<'' | 'image' | 'pdf'>('')
const LIB_PAGE = 60
const libraryOffset = ref(0)

async function loadLibraryFiles(reset = false) {
  if (reset) { libraryOffset.value = 0; libraryFiles.value = [] }
  libraryLoading.value = true
  try {
    const params: Record<string, string> = { limit: String(LIB_PAGE), offset: String(libraryOffset.value) }
    if (libraryTypeFilter.value) params.type = libraryTypeFilter.value
    if (librarySearch.value.trim()) params.search = librarySearch.value.trim()
    const res = await $fetch<{ data: LibraryFile[], meta?: { filter_count: number } }>('/api/admin/media/files', { query: params })
    libraryFiles.value = reset ? (res.data ?? []) : [...libraryFiles.value, ...(res.data ?? [])]
    libraryTotal.value = res.meta?.filter_count ?? res.data?.length ?? 0
    libraryOffset.value += res.data?.length ?? 0
  } finally {
    libraryLoading.value = false
  }
}

function openLibrary() {
  libraryOpen.value = true
  actionError.value = ''
  loadLibraryFiles(true)
}

function closeLibrary() {
  libraryOpen.value = false
}

function updateLibrarySearch(value: string) {
  librarySearch.value = value
}

function updateLibraryTypeFilter(value: '' | 'image' | 'pdf') {
  libraryTypeFilter.value = value
}

let librarySearchTimer: ReturnType<typeof setTimeout>
watch(librarySearch, () => {
  clearTimeout(librarySearchTimer)
  librarySearchTimer = setTimeout(() => loadLibraryFiles(true), 350)
})
watch(libraryTypeFilter, () => loadLibraryFiles(true))

function linkedFileIds(list: ProductMedia[]): Set<string> {
  const ids: string[] = []
  for (const item of list) {
    if (item.directus_files_id) ids.push(item.directus_files_id)
  }
  return new Set(ids)
}

const existingFileIds = computed(() => linkedFileIds(mediaList.value))

// ── The only two places that ever write: an explicit link or unlink click ──
async function linkFile(fileId: string) {
  if (existingFileIds.value.has(fileId)) return
  actionError.value = ''
  try {
    await $fetch(`/api/admin/products/${productId}/media`, {
      method: 'POST',
      body: { directus_files_id: fileId, file_role: null },
    })
    await refreshMedia()
    closeLibrary()
    actionSuccess.value = 'Asset linked to this product.'
    setTimeout(() => (actionSuccess.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    actionError.value = fe.data?.message ?? 'Linking failed. Please try again.'
  }
}

async function unlinkMedia(mediaId: number) {
  actionError.value = ''
  try {
    await $fetch(`/api/admin/products/${productId}/media/${mediaId}`, { method: 'DELETE' })
    await refreshMedia()
    actionSuccess.value = 'Association removed. The original file remains in Media Library.'
    setTimeout(() => (actionSuccess.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    actionError.value = fe.data?.message ?? 'Removing the association failed. Please try again.'
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

    <p v-if="actionError" class="ws-save-error" role="alert">{{ actionError }}</p>
    <p v-if="actionSuccess" class="ws-save-success" role="status">{{ actionSuccess }}</p>

    <WorkspaceMediaResources
      :media="mediaList"
      :library-open="libraryOpen"
      :library-files="libraryFiles"
      :library-loading="libraryLoading"
      :library-total="libraryTotal"
      :library-search="librarySearch"
      :library-type-filter="libraryTypeFilter"
      @open-library="openLibrary"
      @close-library="closeLibrary"
      @update-search="updateLibrarySearch"
      @update-type-filter="updateLibraryTypeFilter"
      @load-more="loadLibraryFiles(false)"
      @pick-file="linkFile"
      @unlink="unlinkMedia"
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

.ws-save-success {
  background: #D1F0E8;
  border: 1px solid #A3DBC8;
  border-radius: var(--radius-sm);
  color: #0F5C4B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}
</style>
