<script setup lang="ts">
import type { AdminProduct, ProductMedia, ProductSpecGroup, ProductSpecItem, SourceReviewStatus } from '~/types/product-cms'
import type { SourceRecordSummary } from '~/server/api/admin/products/[id]/sources/index.get'
import type { EvidenceLinkSummary } from '~/server/api/admin/products/[id]/evidence/index.get'
import type { EvidenceAuditEntry } from '~/server/api/admin/products/[id]/evidence/audit.get'
import { workspaceHeroUrl } from '~/utils/productWorkspace'

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

/**
 * A row on screen. `isNew` rows have never been sent to the server — they
 * only exist locally until Save, and carry the source file id needed to
 * create them. `markedForDeletion` archives an existing, real link.
 * `statusDirty` marks a staged review-status change on an existing link.
 * Nothing else about a link is editable in this module.
 */
interface EditableEvidenceLink {
  id: number | null
  spec_item_id: number
  spec_item_label: string
  spec_group_title: string
  sourceFileId: string | null
  source_name: string
  source_type: string | null
  review_status: SourceReviewStatus
  archived: boolean
  isNew: boolean
  markedForDeletion: boolean
  statusDirty: boolean
  originalReviewStatus: SourceReviewStatus | null
}

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

const [
  { data: product, error: productError },
  { data: sourcesData },
  { data: specsData },
  { data: mediaData },
  { data: evidenceData, refresh: refreshEvidence },
  { data: auditData, refresh: refreshAudit },
] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<SourceRecordSummary[]>(`/api/admin/products/${id}/sources`),
  useFetch<SpecGroupWithItems[]>(`/api/admin/products/${id}/specs`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
  useFetch<EvidenceLinkSummary[]>(`/api/admin/products/${id}/evidence`),
  useFetch<EvidenceAuditEntry[]>(`/api/admin/products/${id}/evidence/audit`),
])

const sources = computed(() => sourcesData.value ?? [])
const specGroups = computed<SpecGroupWithItems[]>(() => specsData.value ?? [])
const linkedMedia = computed<ProductMedia[]>(() => mediaData.value ?? [])
const auditEntries = computed<EvidenceAuditEntry[]>(() => auditData.value ?? [])
const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

function toEditableLink(e: EvidenceLinkSummary): EditableEvidenceLink {
  return {
    id: e.id,
    spec_item_id: e.spec_item_id,
    spec_item_label: e.spec_item_label,
    spec_group_title: e.spec_group_title,
    sourceFileId: null,
    source_name: e.source_name,
    source_type: e.source_type,
    review_status: e.review_status ?? 'needs_review',
    archived: e.archived,
    isNew: false,
    markedForDeletion: false,
    statusDirty: false,
    originalReviewStatus: e.review_status ?? 'needs_review',
  }
}

const links = ref<EditableEvidenceLink[]>((evidenceData.value ?? []).map(toEditableLink))

function resyncLinks() {
  links.value = (evidenceData.value ?? []).map(toEditableLink)
}

const isDirty = computed(() => links.value.some((l: EditableEvidenceLink) => l.isNew || l.markedForDeletion || l.statusDirty))

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

// ── Local-only staging. Neither of these ever issues a write request. ───────

function stageLink(specItemId: number, sourceFileId: string) {
  const item = specGroups.value
    .flatMap((g: SpecGroupWithItems) => g.items.map((i: ProductSpecItem) => ({ item: i, group: g })))
    .find((x: { item: ProductSpecItem, group: SpecGroupWithItems }) => x.item.id === specItemId)
  const media = linkedMedia.value.find((m: ProductMedia) => m.directus_files_id === sourceFileId)
  if (!item || !media) return

  const alreadyStaged = links.value.some((l: EditableEvidenceLink) =>
    l.spec_item_id === specItemId
    && !l.markedForDeletion
    && (l.sourceFileId === sourceFileId || (!l.isNew && l.source_name === media.filename_download)),
  )
  if (alreadyStaged) return

  links.value.push({
    id: null,
    spec_item_id: specItemId,
    spec_item_label: item.item.label_en || `Parameter ${specItemId}`,
    spec_group_title: item.group.title_en || 'Specifications',
    sourceFileId: sourceFileId,
    source_name: media.filename_download ?? 'Untitled source',
    source_type: media.type,
    review_status: 'needs_review',
    archived: false,
    isNew: true,
    markedForDeletion: false,
    statusDirty: false,
    originalReviewStatus: null,
  })
}

function setStatus(index: number, status: SourceReviewStatus) {
  const link = links.value[index]
  if (!link || link.markedForDeletion) return
  link.review_status = status
  link.statusDirty = !link.isNew && status !== link.originalReviewStatus
}

function handleStageLink(payload: { specItemId: number, sourceFileId: string }) {
  stageLink(payload.specItemId, payload.sourceFileId)
}

function handleUpdateStatus(payload: { index: number, status: SourceReviewStatus }) {
  setStatus(payload.index, payload.status)
}

/** Toggles a link's pending state: a brand-new link is discarded outright; an
 * already-saved link is marked/unmarked for archival — either way, nothing is
 * sent to the server until Save. */
function unstage(index: number) {
  const link = links.value[index]
  if (!link) return
  if (link.isNew) {
    links.value.splice(index, 1)
    return
  }
  link.markedForDeletion = !link.markedForDeletion
}

// ── Save: the only place that ever issues a write request ───────────────────

async function handleSave() {
  if (!isDirty.value || saving.value) return
  saving.value = true
  saveError.value = ''

  try {
    for (const link of links.value) {
      if (link.isNew) {
        await $fetch<{ id: number }>(`/api/admin/products/${productId}/evidence`, {
          method: 'POST',
          body: { spec_item_id: link.spec_item_id, source_file_id: link.sourceFileId, review_status: link.review_status },
        })
      } else if (link.markedForDeletion) {
        await $fetch(`/api/admin/products/${productId}/sources/${link.id}/archive`, { method: 'POST' })
      } else if (link.statusDirty) {
        await $fetch(`/api/admin/products/${productId}/evidence/${link.id}`, {
          method: 'PATCH',
          body: { review_status: link.review_status },
        })
      }
    }

    await Promise.all([refreshEvidence(), refreshAudit()])
    resyncLinks()
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
    title="Sources & evidence"
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
        active-key="sources-evidence"
      />
    </template>

    <p v-if="saveError" class="ws-save-error" role="alert">{{ saveError }}</p>

    <WorkspaceSourcesEvidence :sources="sources" />

    <WorkspaceEvidenceLinks
      :spec-groups="specGroups"
      :linked-media="linkedMedia"
      :links="links"
      :audit-entries="auditEntries"
      @stage-link="handleStageLink"
      @update-status="handleUpdateStatus"
      @unstage="unstage"
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
