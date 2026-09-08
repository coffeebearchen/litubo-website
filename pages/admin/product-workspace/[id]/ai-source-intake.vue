<script setup lang="ts">
import type { AdminProduct, ProductMedia } from '~/types/product-cms'
import { workspaceHeroUrl } from '~/utils/productWorkspace'
import { workspaceMediaResourcesRoute, workspaceAiProposalReviewRoute } from '~/utils/productCentre'
import { MAX_FILES_PER_REQUEST, type SpecificationProposal, type SourceFileOutcome } from '~/utils/aiProposal'

interface AiProviderSummary { id: string, label: string, configured: boolean, isDefault: boolean }
interface GenerateResponse {
  ok: boolean
  proposal?: SpecificationProposal
  fileResults: SourceFileOutcome[]
  error?: string
}

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const productId = Number(id)

const [
  { data: product, error: productError },
  { data: mediaData },
  { data: providersData, error: providersFetchError },
] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
  useFetch<AiProviderSummary[]>('/api/admin/ai/providers'),
])

const linkedMedia = computed<ProductMedia[]>(() => mediaData.value ?? [])
const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)
const mediaResourcesHref = computed(() => workspaceMediaResourcesRoute(id))

const providers = computed<AiProviderSummary[]>(() => providersData.value ?? [])
const providersLoading = ref(false)
const providersError = ref(Boolean(providersFetchError.value))
const selectedProviderId = ref<string | null>(
  providers.value.find((p: AiProviderSummary) => p.configured && p.isDefault)?.id
  ?? providers.value.find((p: AiProviderSummary) => p.configured)?.id
  ?? null,
)

async function retryProviders() {
  providersLoading.value = true
  providersError.value = false
  try {
    providersData.value = await $fetch<AiProviderSummary[]>('/api/admin/ai/providers')
    selectedProviderId.value = providers.value.find((p: AiProviderSummary) => p.configured && p.isDefault)?.id
      ?? providers.value.find((p: AiProviderSummary) => p.configured)?.id
      ?? null
  } catch {
    providersError.value = true
  } finally {
    providersLoading.value = false
  }
}

/**
 * Selection is purely local UI state. Nothing here writes anything — the
 * only request this page can ever issue is the one explicit Analyze call
 * below, and even that never writes product data (it only reads text and
 * calls the AI provider).
 */
const selectedIds = ref<number[]>([])

function toggleSelection(mediaId: number) {
  const idx = selectedIds.value.indexOf(mediaId)
  if (idx === -1) {
    if (selectedIds.value.length >= MAX_FILES_PER_REQUEST) return
    selectedIds.value.push(mediaId)
  } else {
    selectedIds.value.splice(idx, 1)
  }
}

const analyzing = ref(false)
const analyzeError = ref<string | null>(null)
const lastFileResults = ref<SourceFileOutcome[]>([])
const proposalSession = useAiProposalSession()

async function analyze() {
  if (analyzing.value || !selectedProviderId.value) return
  analyzing.value = true
  analyzeError.value = null
  lastFileResults.value = []
  try {
    const result = await $fetch<GenerateResponse>(`/api/admin/products/${productId}/ai/specification-proposal/generate`, {
      method: 'POST',
      body: { providerId: selectedProviderId.value, mediaIds: [...selectedIds.value] },
    })
    lastFileResults.value = result.fileResults
    if (!result.ok || !result.proposal) {
      analyzeError.value = result.error ?? 'Could not generate a proposal right now.'
      return
    }
    proposalSession.value = { productId, proposal: result.proposal, fileResults: result.fileResults }
    await router.push(workspaceAiProposalReviewRoute(id))
  } catch (e: unknown) {
    const fe = e as { data?: { error?: string, message?: string } }
    analyzeError.value = fe.data?.error ?? fe.data?.message ?? 'Could not generate a proposal right now.'
  } finally {
    analyzing.value = false
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
    title="AI Source Intake"
    :preview-href="previewHref"
  >
    <template #nav>
      <WorkspaceModuleNav
        :product-id="(product as AdminProduct).id"
        :product-name="(product as AdminProduct).name_en"
        :product-code="(product as AdminProduct).product_code"
        :product-status="(product as AdminProduct).status"
        :product-hero-url="workspaceHeroUrl(product as AdminProduct)"
        active-key="ai-source-intake"
      />
    </template>

    <WorkspaceAiSourceIntake
      :linked-media="linkedMedia"
      :selected-ids="selectedIds"
      :media-resources-href="mediaResourcesHref"
      :providers="providers"
      :providers-loading="providersLoading"
      :providers-error="providersError"
      :selected-provider-id="selectedProviderId"
      :analyzing="analyzing"
      :analyze-error="analyzeError"
      :file-results="lastFileResults"
      @toggle="toggleSelection"
      @update:selected-provider-id="selectedProviderId = $event"
      @analyze="analyze"
      @retry-providers="retryProviders"
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
</style>
