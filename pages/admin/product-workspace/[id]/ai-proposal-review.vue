<script setup lang="ts">
import type { AdminProduct, ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'
import { workspaceHeroUrl } from '~/utils/productWorkspace'
import { workspaceAiSourceIntakeRoute } from '~/utils/productCentre'

definePageMeta({ layout: 'admin' })

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

const [
  { data: product, error: productError },
  { data: specsData },
] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<SpecGroupWithItems[]>(`/api/admin/products/${id}/specs`),
])

const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)
const sourceIntakeHref = computed(() => workspaceAiSourceIntakeRoute(id))
const existingSpecGroups = computed<SpecGroupWithItems[]>(() => specsData.value ?? [])

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
    title="AI Proposal Review"
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
      <WorkspaceAiProposalReview
        :product-id="productId"
        :proposal="proposalSession!.proposal"
        :file-results="proposalSession!.fileResults"
        :existing-spec-groups="existingSpecGroups"
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
</style>
