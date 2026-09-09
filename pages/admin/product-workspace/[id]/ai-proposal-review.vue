<script setup lang="ts">
import type { ProductStatus, ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'
import { workspaceAiSourceIntakeRoute } from '~/utils/productCentre'
import type { AiProductContext } from '~/utils/aiProposal'

definePageMeta({ layout: 'admin' })

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the AI-safe product context, not the
 * general product record. The existing specifications ARE still loaded, because
 * comparing proposals against them is this screen's entire purpose.
 */
const [
  { data: context, error: contextError },
  { data: specsData, error: specsFetchError },
] = await Promise.all([
  useFetch<AiProductContext>(`/api/admin/products/${id}/ai/context`),
  useFetch<SpecGroupWithItems[]>(`/api/admin/products/${id}/specs`),
])

const notFound = computed(() => Boolean(contextError.value) || !context.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

/** The two fields the Workspace shell actually renders — nothing else is available to it here. */
const shellProduct = computed(() => ({
  name_en: context.value?.productName ?? null,
  status: (context.value?.lifecycleStatus ?? 'draft') as ProductStatus,
}))
const sourceIntakeHref = computed(() => workspaceAiSourceIntakeRoute(id))
const existingSpecGroups = computed<SpecGroupWithItems[]>(() => specsData.value ?? [])

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — the existing specifications are what
 * every "Review required" / duplicate warning on this screen is computed
 * from. Falling back to `[]` when that request fails would silently present
 * every proposed row as brand new and conflict-free, which is the most
 * dangerous possible misreading. The failure is surfaced instead.
 */
const specsLoading = ref(false)
const specsError = ref(Boolean(specsFetchError.value))

async function retrySpecs() {
  specsLoading.value = true
  specsError.value = false
  try {
    specsData.value = await $fetch<SpecGroupWithItems[]>(`/api/admin/products/${id}/specs`)
  } catch {
    specsError.value = true
  } finally {
    specsLoading.value = false
  }
}

const proposalSession = useAiProposalSession()

/**
 * The proposal only ever comes from this SPA session's in-memory state
 * (set by AI Source Intake's Analyze step) — never from the URL, never
 * persisted. A full reload, or opening this route directly, always resets
 * `proposalSession` to null: the honest empty state below is the only
 * thing that can ever render then.
 */
const hasActiveProposal = computed(() =>
  proposalSession.value !== null && proposalSession.value.productId === productId,
)

const applying = ref(false)
const applyError = ref<string | null>(null)
const applySuccessMessage = ref<string | null>(null)

function clearProposal() {
  proposalSession.value = null
}

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — leaving this screen discards the unsaved
 * proposal, which is what the on-screen warning already promised. Previously
 * the session survived in memory, so navigating away and back re-displayed a
 * proposal the reviewer had walked away from — including any accept/reject
 * decisions — as though it were still live.
 */
onBeforeRouteLeave(() => {
  proposalSession.value = null
})
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
    title="AI Proposal Review"
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

    <!--
      Kept OUTSIDE the hasActiveProposal branch on purpose: Apply success
      clears the session (so re-applying the same proposal is impossible),
      which would otherwise unmount WorkspaceAiProposalReview — and the
      success message with it — the instant it appears. This banner stays
      visible across that transition.
    -->
    <p v-if="applySuccessMessage" class="ws-apply-success-banner" role="status">{{ applySuccessMessage }}</p>

    <div v-if="!hasActiveProposal" class="ws-empty-proposal">
      <p class="ws-empty-proposal-text">No active proposal. Return to AI Source Intake.</p>
      <NuxtLink :to="sourceIntakeHref" class="btn btn-primary">Go to AI Source Intake</NuxtLink>
    </div>

    <template v-else>
      <p class="ws-refresh-warning">Refreshing this page or navigating away will lose this unsaved proposal.</p>

      <!--
        Shown above the proposal rather than replacing it: the suggestions are
        still readable, but the reviewer is told plainly that the comparison
        against existing specifications is missing, so an absent "Review
        required" flag must not be read as "no conflict".
      -->
      <div v-if="specsError" class="ws-specs-error" role="alert">
        <p>
          Could not load this product's existing specifications, so proposals below are
          <strong>not</strong> being checked against them. An item shown as new may already exist.
        </p>
        <button type="button" class="ws-retry-btn" :disabled="specsLoading" @click="retrySpecs">
          {{ specsLoading ? 'Retrying…' : 'Retry' }}
        </button>
      </div>

      <WorkspaceAiProposalReview
        :product-id="productId"
        :proposal="proposalSession!.proposal"
        :file-results="proposalSession!.fileResults"
        :existing-spec-groups="existingSpecGroups"
        :comparison-ready="!specsError"
        :applying="applying"
        :apply-error="applyError"
        @applying="applying = $event"
        @apply-error="applyError = $event"
        @apply-success="(msg: string) => { applySuccessMessage = msg; clearProposal() }"
      />
    </template>
  </WorkspaceShell>
</template>

<style scoped>
.ws-not-found {
  max-width: 480px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  text-align: center;
}
.ws-not-found-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.ws-not-found-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); }
.ws-not-found-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.ws-not-found-link:hover { text-decoration: underline; }

.ws-empty-proposal {
  max-width: 480px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
}
.ws-empty-proposal-text { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: var(--color-primary-deep); }

.ws-apply-success-banner {
  font-size: var(--text-sm);
  color: #1E6B4E;
  background: #E3F3EC;
  border: 1px solid #BFE3D2;
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}

.ws-refresh-warning {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0 0 var(--space-4);
}

.ws-specs-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: #C0392B;
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}
.ws-specs-error p { margin: 0; flex: 1 1 20ch; min-width: 0; }

.ws-retry-btn {
  background: var(--color-surface);
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-sm);
  min-height: 36px;
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  flex-shrink: 0;
}
.ws-retry-btn:hover:not(:disabled) { background: #FBE3E0; }
.ws-retry-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
