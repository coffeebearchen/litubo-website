<script setup lang="ts">
import type { ProductStatus } from '~/types/product-cms'
import { workspaceMediaResourcesRoute, workspaceAiProposalReviewRoute } from '~/utils/productCentre'
import { MAX_FILES_PER_REQUEST, MAX_IMAGES_PER_ANALYSIS, type AiProductContext, type AiIntakeSource, type SpecificationProposal, type SourceFileOutcome } from '~/utils/aiProposal'

interface AiProviderSummary { id: string, label: string, configured: boolean, isDefault: boolean }
interface GenerateResponse {
  ok: boolean
  proposal?: SpecificationProposal
  fileResults: SourceFileOutcome[]
  error?: string
  /** PWS-AI-DUP-GUARD-01 — server-minted handle Apply must send back. */
  proposalRef?: string
  /** True when the server reused a still-valid analysis of unchanged sources instead of calling the provider. */
  reused?: boolean
  /** True when that reused analysis has already been written to the Draft. */
  alreadyApplied?: boolean
}

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const productId = Number(id)

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — this screen reads its own AI-safe
 * product context, not the general `/api/admin/products/:id` record. That
 * record carries the hero image's Directus UUID, internal review notes, SEO
 * fields and highlights, none of which this screen needs or should receive.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — it likewise reads its own AI-safe source
 * list, not the general product media endpoint. The general endpoint answers
 * with Directus file UUIDs, raw `filename_download`, captions and alt text;
 * none of that is needed here, so none of it is sent to the browser. What
 * arrives instead is a sanitized display name, plain labels, and an opaque
 * `sourceRef` that only the server can resolve.
 */
const [
  { data: context, error: contextError },
  { data: sourcesData, error: sourcesFetchError },
  { data: providersData, error: providersFetchError },
] = await Promise.all([
  useFetch<AiProductContext>(`/api/admin/products/${id}/ai/context`),
  useFetch<AiIntakeSource[]>(`/api/admin/products/${id}/ai/sources`),
  useFetch<AiProviderSummary[]>('/api/admin/ai/providers'),
])

const sources = computed<AiIntakeSource[]>(() => sourcesData.value ?? [])
const notFound = computed(() => Boolean(contextError.value) || !context.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

/** The two fields the Workspace shell actually renders — nothing else is available to it here. */
const shellProduct = computed(() => ({
  name_en: context.value?.productName ?? null,
  status: (context.value?.lifecycleStatus ?? 'draft') as ProductStatus,
}))
const mediaResourcesHref = computed(() => workspaceMediaResourcesRoute(id))

/**
 * FINAL-RELEASE-FIX-F (D-037) — AI analysis is Draft-only. The server refuses
 * Generate for any other status BEFORE it reaches a provider, so offering the
 * button here would only spend a click to earn a 409.
 */
const isDraft = computed(() => (context.value?.lifecycleStatus ?? 'draft') === 'draft')

/**
 * A failed source request is tracked separately from an empty list. Falling
 * back to `[]` made a server error render as "this product has no associated
 * files yet", which is a different (and false) statement about the product.
 */
const sourcesLoading = ref(false)
const sourcesError = ref(Boolean(sourcesFetchError.value))

const providers = computed<AiProviderSummary[]>(() => providersData.value ?? [])
const providersLoading = ref(false)
const providersError = ref(Boolean(providersFetchError.value))
const selectedProviderId = ref<string | null>(
  providers.value.find((p: AiProviderSummary) => p.configured && p.isDefault)?.id
  ?? providers.value.find((p: AiProviderSummary) => p.configured)?.id
  ?? null,
)

async function retrySources() {
  sourcesLoading.value = true
  sourcesError.value = false
  try {
    sourcesData.value = await $fetch<AiIntakeSource[]>(`/api/admin/products/${id}/ai/sources`)
    // Refs are freshly minted by that response; a selection made against the
    // previous list would be stale, so it is cleared rather than carried over.
    selectedRefs.value = []
  } catch {
    sourcesError.value = true
  } finally {
    sourcesLoading.value = false
  }
}

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
 * Selection is purely local UI state, held as opaque refs. Nothing here writes
 * anything — the only request this page can ever issue is the one explicit
 * Analyze call below, and even that never writes product data.
 */
const selectedRefs = ref<string[]>([])

function toggleSelection(sourceRef: string) {
  const idx = selectedRefs.value.indexOf(sourceRef)
  if (idx === -1) {
    if (selectedRefs.value.length >= MAX_FILES_PER_REQUEST) return
    // AI-IMAGE-OCR-SOURCE-01 — a fourth image is not added; the server refuses one too.
    const isImage = (ref: string) => sources.value.find((s: AiIntakeSource) => s.sourceRef === ref)?.isImage === true
    if (isImage(sourceRef) && selectedRefs.value.filter(isImage).length >= MAX_IMAGES_PER_ANALYSIS) return
    selectedRefs.value.push(sourceRef)
  } else {
    selectedRefs.value.splice(idx, 1)
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
  // Discard any earlier proposal BEFORE the new run starts: if this analysis
  // fails, the reviewer must not be left looking at the previous run's
  // suggestions as though they were the new result.
  proposalSession.value = null
  try {
    const result = await $fetch<GenerateResponse>(`/api/admin/products/${productId}/ai/specification-proposal/generate`, {
      method: 'POST',
      body: { providerId: selectedProviderId.value, sourceRefs: [...selectedRefs.value] },
    })
    lastFileResults.value = result.fileResults
    if (!result.ok || !result.proposal) {
      analyzeError.value = result.error ?? 'Could not generate a proposal right now.'
      return
    }
    proposalSession.value = {
      productId,
      proposal: result.proposal,
      fileResults: result.fileResults,
      proposalRef: result.proposalRef ?? '',
      reused: result.reused === true,
      alreadyApplied: result.alreadyApplied === true,
    }
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
    :product="shellProduct"
    title="AI Source Intake"
    :preview-href="previewHref"
  >
    <template #nav>
      <WorkspaceModuleNav
        :product-id="productId"
        :product-name="context!.productName"
        :product-code="context!.productCode"
        :product-status="context!.lifecycleStatus as ProductStatus"
        :product-hero-url="context!.thumbnailUrl"
        active-key="ai-source-intake"
      />
    </template>

    <div v-if="!isDraft" class="ws-not-found">
      <p class="ws-not-found-hint">
        AI changes are available only while the product is in Draft. Return it to Draft to analyze sources.
      </p>
      <NuxtLink to="/admin/products" class="ws-not-found-link">← Back to Product Center</NuxtLink>
    </div>

    <WorkspaceAiSourceIntake
      v-else
      :sources="sources"
      :selected-refs="selectedRefs"
      :media-resources-href="mediaResourcesHref"
      :providers="providers"
      :providers-loading="providersLoading"
      :providers-error="providersError"
      :sources-error="sourcesError"
      :sources-loading="sourcesLoading"
      :selected-provider-id="selectedProviderId"
      :analyzing="analyzing"
      :analyze-error="analyzeError"
      :file-results="lastFileResults"
      @toggle="toggleSelection"
      @update:selected-provider-id="selectedProviderId = $event"
      @analyze="analyze"
      @retry-providers="retryProviders"
      @retry-sources="retrySources"
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
