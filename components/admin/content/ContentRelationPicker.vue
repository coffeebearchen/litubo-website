<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AdminContentList } from '~/types/content-center'
import { contentTypeLabel, primaryContentLocale } from '~/utils/contentCenter'
import { relationKey, type RelationCandidate } from '~/utils/contentMediaRelationsEditor'

/**
 * CC-IMP-04 — choose a product or content item to relate. Reads the existing
 * Product Center and Content Center list BFFs (no second data source), only ids
 * are staged, and the server re-checks every target on Save. Content items that
 * are archived, and the current item itself, are not offered.
 */

const props = defineProps<{
  open: boolean
  kind: 'product' | 'content'
  itemId: number
  linkedKeys: readonly string[]
}>()

const emit = defineEmits<{ close: [], pick: [candidate: RelationCandidate] }>()

const search = ref('')
const results = ref<RelationCandidate[]>([])
const loading = ref(false)
const failed = ref(false)
let request = 0
let timer: ReturnType<typeof setTimeout> | undefined

async function load() {
  const current = ++request
  loading.value = true
  failed.value = false
  try {
    const term = search.value.trim() || undefined
    if (props.kind === 'product') {
      const res = await $fetch<{ data: Array<{ id: number, name_en: string | null, product_code: string | null, status: string | null }> }>(
        '/api/admin/products', { query: { search: term, limit: 20 } },
      )
      if (current !== request) return
      results.value = (res.data ?? []).map(p => ({ kind: 'product', id: p.id, label: p.name_en ?? `Product ${p.id}`, code: p.product_code, status: p.status, content_type: null }))
    } else {
      const res = await $fetch<AdminContentList>('/api/admin/content-center', { query: { search: term, limit: 25 } })
      if (current !== request) return
      results.value = (res.data ?? [])
        .filter(item => item.id !== props.itemId && item.status !== 'archived')
        .map(item => ({
          kind: 'content', id: item.id, label: primaryContentLocale(item.locales)?.title || `Content item ${item.id}`,
          code: null, status: item.status, content_type: item.content_type,
        }))
    }
  } catch {
    if (current === request) failed.value = true
  } finally {
    if (current === request) loading.value = false
  }
}

watch(() => [props.open, props.kind], () => {
  if (props.open) {
    search.value = ''
    void load()
  }
}, { immediate: true })

watch(search, () => {
  if (!props.open) return
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="crp-overlay" @click.self="emit('close')">
      <div class="crp-modal" role="dialog" aria-modal="true" :aria-label="kind === 'product' ? 'Link a product' : 'Link content'">
        <div class="crp-header">
          <h3 class="crp-title">{{ kind === 'product' ? 'Link a product' : 'Link content' }}</h3>
          <button type="button" class="crp-close" aria-label="Close" @click="emit('close')">✕</button>
        </div>
        <div class="crp-body">
          <input
            v-model="search"
            type="search"
            class="crp-search"
            maxlength="100"
            :placeholder="kind === 'product' ? 'Search product name or code…' : 'Search title or slug…'"
            :aria-label="kind === 'product' ? 'Search products' : 'Search content'"
          >
          <p class="crp-note">
            <template v-if="kind === 'product'">Only the product id is stored. Name, image and details stay in Product Center; unpublished products are never shown publicly.</template>
            <template v-else>Resources are content items of type Resource / Download. Only published targets are shown publicly later.</template>
          </p>
          <p v-if="failed" class="crp-error" role="alert">
            Results could not be loaded. <button type="button" class="crp-retry" @click="load">Retry</button>
          </p>
          <p v-else-if="loading && results.length === 0" class="crp-empty">Loading…</p>
          <p v-else-if="results.length === 0" class="crp-empty">
            {{ kind === 'product' ? 'No products match.' : 'No other content items are available to relate.' }}
          </p>
          <ul v-else class="crp-list">
            <li v-for="candidate in results" :key="`${candidate.kind}-${candidate.id}`">
              <button
                type="button"
                class="crp-item"
                :disabled="linkedKeys.includes(relationKey(candidate.kind, candidate.id))"
                @click="emit('pick', candidate)"
              >
                <span class="crp-item-label">{{ candidate.label }}</span>
                <span class="crp-item-meta">
                  <template v-if="candidate.kind === 'product'">{{ candidate.code ?? 'No product code' }}</template>
                  <template v-else>{{ contentTypeLabel(candidate.content_type) }}</template>
                  · {{ candidate.status ?? 'unknown status' }}
                </span>
                <span v-if="linkedKeys.includes(relationKey(candidate.kind, candidate.id))" class="crp-item-badge">Already related</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.crp-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
}

@media (min-width: 768px) { .crp-overlay { align-items: center; } }

.crp-modal {
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.crp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
}

.crp-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); margin: 0; }

.crp-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-ink-muted);
}

.crp-body { flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }

.crp-search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
}

.crp-note, .crp-empty { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.crp-empty { padding: var(--space-6) 0; text-align: center; font-size: var(--text-sm); }
.crp-error { font-size: var(--text-sm); color: #C0392B; margin: 0; }
.crp-retry { background: none; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; cursor: pointer; }

.crp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }

.crp-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  font-family: inherit;
}

.crp-item:hover:not(:disabled) { border-color: var(--color-primary); }
.crp-item:disabled { opacity: 0.6; cursor: not-allowed; }
.crp-item-label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.crp-item-meta { font-size: var(--text-xs); color: var(--color-ink-muted); }
.crp-item-badge { font-size: 10px; font-weight: 600; color: white; background: var(--color-primary); border-radius: 999px; padding: 1px 8px; }

@media (max-width: 767px) {
  .crp-modal { max-height: 92vh; }
  .crp-body { padding: var(--space-3); }
}
</style>
