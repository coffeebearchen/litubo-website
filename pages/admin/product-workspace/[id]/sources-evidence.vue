<script setup lang="ts">
import type { AdminProduct, ProductMedia, ProductSpecGroup, ProductSpecItem, SourceReviewStatus } from '~/types/product-cms'
import type { SourceRecordSummary } from '~/server/api/admin/products/[id]/sources/index.get'
import type { EvidenceLinkSummary } from '~/server/api/admin/products/[id]/evidence/index.get'
import { workspaceHeroUrl } from '~/utils/productWorkspace'

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

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
] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<SourceRecordSummary[]>(`/api/admin/products/${id}/sources`),
  useFetch<SpecGroupWithItems[]>(`/api/admin/products/${id}/specs`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
  useFetch<EvidenceLinkSummary[]>(`/api/admin/products/${id}/evidence`),
])

const sources = computed(() => sourcesData.value ?? [])
const specGroups = computed<SpecGroupWithItems[]>(() => specsData.value ?? [])
const linkedMedia = computed<ProductMedia[]>(() => mediaData.value ?? [])
const links = computed<EvidenceLinkSummary[]>(() => evidenceData.value ?? [])
const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

const actionError = ref('')
const pending = ref(false)

/**
 * Every write on this page is immediate and explicit — there is no batched
 * dirty-state/Save flow here (unlike Page content/Specifications/Media &
 * resources). Loading, selecting a row, opening/closing the picker and
 * changing a dropdown never write; only clicking Link evidence, Update
 * verification or a confirmed Remove does.
 */
async function linkEvidence(payload: { specItemId: number, sourceFileId: string, reviewStatus: SourceReviewStatus }) {
  if (pending.value) return
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/products/${productId}/evidence`, {
      method: 'POST',
      body: { spec_item_id: payload.specItemId, source_file_id: payload.sourceFileId, review_status: payload.reviewStatus },
    })
    await refreshEvidence()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    actionError.value = fe.data?.message ?? 'Could not link this evidence. Please try again.'
  } finally {
    pending.value = false
  }
}

async function updateVerification(payload: { linkId: number, reviewStatus: SourceReviewStatus }) {
  if (pending.value) return
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/products/${productId}/evidence/${payload.linkId}`, {
      method: 'PATCH',
      body: { review_status: payload.reviewStatus },
    })
    await refreshEvidence()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    actionError.value = fe.data?.message ?? 'Could not update verification. Please try again.'
  } finally {
    pending.value = false
  }
}

async function removeEvidence(linkId: number) {
  if (pending.value) return
  pending.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/products/${productId}/sources/${linkId}/archive`, { method: 'POST' })
    await refreshEvidence()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    actionError.value = fe.data?.message ?? 'Could not remove this evidence. Please try again.'
  } finally {
    pending.value = false
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

    <p class="ws-scope-hint">
      Internal workspace — Link a product parameter to an already associated source file. This information is never public.
    </p>

    <p v-if="actionError" class="ws-save-error" role="alert">{{ actionError }}</p>

    <WorkspaceSourcesEvidence :sources="sources" />

    <WorkspaceEvidenceLinks
      :spec-groups="specGroups"
      :linked-media="linkedMedia"
      :links="links"
      :pending="pending"
      @link-evidence="linkEvidence"
      @update-verification="updateVerification"
      @remove-evidence="removeEvidence"
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

.ws-scope-hint {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
  line-height: 1.55;
  max-width: 72ch;
}

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
