<script setup lang="ts">
import type { AdminProduct, ProductMedia } from '~/types/product-cms'
import { workspaceHeroUrl } from '~/utils/productWorkspace'
import { workspaceMediaResourcesRoute } from '~/utils/productCentre'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const [
  { data: product, error: productError },
  { data: mediaData },
] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
])

const linkedMedia = computed<ProductMedia[]>(() => mediaData.value ?? [])
const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)
const mediaResourcesHref = computed(() => workspaceMediaResourcesRoute(id))

/**
 * Selection is purely local UI state, scoping a hypothetical future AI run —
 * it is never sent anywhere. This page issues no write request of any kind.
 */
const selectedIds = ref<number[]>([])

function toggleSelection(mediaId: number) {
  const idx = selectedIds.value.indexOf(mediaId)
  if (idx === -1) selectedIds.value.push(mediaId)
  else selectedIds.value.splice(idx, 1)
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
      @toggle="toggleSelection"
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
