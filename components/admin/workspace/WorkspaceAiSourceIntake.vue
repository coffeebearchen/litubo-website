<script setup lang="ts">
import type { ProductMedia } from '~/types/product-cms'
import {
  sourceFileTypeLabel,
  fileRoleLabel,
  aiIntakeFileDisplayName,
  mediaReadableLabel,
} from '~/utils/productWorkspace'

const props = defineProps<{
  linkedMedia: ProductMedia[]
  selectedIds: number[]
  mediaResourcesHref: string
}>()

const emit = defineEmits<{
  toggle: [id: number]
}>()

const selectedSet = computed(() => new Set(props.selectedIds))

function isSelected(id: number): boolean {
  return selectedSet.value.has(id)
}

/**
 * A later proposal-review step does not exist yet, and this task is
 * explicitly scoped to source *selection* only — Continue never calls a
 * model, writes a product parameter, or navigates anywhere. Clicking it
 * while enabled only reveals an honest inline note; it stays fully local.
 */
const continueClicked = ref(false)
</script>

<template>
  <section class="ws-ai-intake" aria-labelledby="ws-ai-intake-heading">
    <p class="ws-scope-hint">
      AI source selection only — nothing here calls an AI model, writes a product parameter, or publishes anything. Original files stay in Media Library.
    </p>

    <section class="ws-card" aria-labelledby="ws-ai-intake-heading">
      <div class="ws-card-header">
        <h2 id="ws-ai-intake-heading" class="ws-card-title">Select source files for this product</h2>
        <span class="ws-selected-count">{{ selectedIds.length }} selected</span>
      </div>

      <p v-if="linkedMedia.length === 0" class="ws-empty">
        This product has no associated files yet.
        <NuxtLink :to="mediaResourcesHref">Go to Media &amp; resources</NuxtLink> to associate one first.
      </p>

      <ul v-else class="ws-file-grid" role="list">
        <li v-for="m in linkedMedia" :key="m.id" class="ws-file-card" :class="{ 'ws-file-card--selected': isSelected(m.id) }">
          <label class="ws-file-label">
            <input
              type="checkbox"
              class="ws-file-checkbox"
              :checked="isSelected(m.id)"
              @change="emit('toggle', m.id)"
            >
            <span class="ws-file-name">{{ aiIntakeFileDisplayName(m) }}</span>
          </label>
          <dl class="ws-file-facts">
            <dt>Type</dt>
            <dd>{{ sourceFileTypeLabel(m.type ?? null) }}</dd>
            <dt>Role</dt>
            <dd>{{ fileRoleLabel(m.file_role) }}</dd>
            <dt>Status</dt>
            <dd>{{ mediaReadableLabel(m.enabled) }}</dd>
          </dl>
        </li>
      </ul>

      <div class="ws-continue-row">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="selectedIds.length === 0"
          @click="continueClicked = true"
        >
          Continue to proposal review
        </button>
        <p v-if="continueClicked" class="ws-continue-note">
          The next step is not built yet in this Workspace. No model was called on any file, and nothing was written or published.
        </p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.ws-ai-intake { display: flex; flex-direction: column; gap: var(--space-4); }

.ws-scope-hint {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0;
  line-height: 1.55;
  max-width: 72ch;
}

.ws-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.ws-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }

.ws-selected-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  white-space: nowrap;
}

.ws-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-2) 0; }
.ws-empty a { color: var(--color-primary); }

.ws-file-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.ws-file-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ws-file-card--selected { border-color: var(--color-primary); background: rgba(15,92,75,0.06); }

.ws-file-label { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }
.ws-file-checkbox { flex-shrink: 0; width: 16px; height: 16px; }
.ws-file-name { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); overflow-wrap: anywhere; }

.ws-file-facts { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--space-2); margin: 0; font-size: var(--text-xs); }
.ws-file-facts dt { color: var(--color-ink-muted); white-space: nowrap; }
.ws-file-facts dd { color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }

.ws-continue-row { margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }

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
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.ws-continue-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0;
  max-width: 60ch;
  line-height: 1.5;
}

/* ── ≤767px: single-column cards, never a compressed grid ── */
@media (max-width: 767px) {
  .ws-file-grid { grid-template-columns: 1fr; }
}
</style>
