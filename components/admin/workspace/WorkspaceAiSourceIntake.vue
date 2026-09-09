<script setup lang="ts">
import { computed } from 'vue'
import { MAX_FILES_PER_REQUEST, SUPPORTED_TEXT_SOURCE_FORMATS_LABEL, type AiIntakeSource } from '~/utils/aiProposal'

interface AiProviderSummary { id: string, label: string, configured: boolean, isDefault: boolean }
interface FileOutcome { displayName: string, status: 'read' | 'unsupported' | 'unreadable', reason?: string }

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — this component renders the AI-safe source
 * DTO only. It has no access to Directus ids, raw filenames, captions or alt
 * text, because the server never sends them here: each source arrives as an
 * opaque `sourceRef` plus already-sanitized display fields, and the reason a
 * file cannot be analyzed is decided server-side rather than re-derived from a
 * MIME type in the browser.
 */
const props = defineProps<{
  sources: AiIntakeSource[]
  selectedRefs: string[]
  mediaResourcesHref: string
  providers: AiProviderSummary[]
  providersLoading: boolean
  providersError: boolean
  /** True when the source-list request itself failed — never conflated with "this product has no files". */
  sourcesError: boolean
  sourcesLoading: boolean
  selectedProviderId: string | null
  analyzing: boolean
  analyzeError: string | null
  fileResults: FileOutcome[]
}>()

const emit = defineEmits<{
  toggle: [sourceRef: string]
  'update:selectedProviderId': [id: string]
  analyze: []
  'retry-providers': []
  'retry-sources': []
}>()

const selectedSet = computed(() => new Set(props.selectedRefs))

function isSelected(sourceRef: string): boolean {
  return selectedSet.value.has(sourceRef)
}

const analyzableSources = computed(() => props.sources.filter(s => s.analyzable))
const hasAnyAnalyzableSource = computed(() => analyzableSources.value.length > 0)

const configuredProviders = computed(() => props.providers.filter(p => p.configured))
const hasConfiguredProvider = computed(() => configuredProviders.value.length > 0)

const atSelectionCap = computed(() => props.selectedRefs.length >= MAX_FILES_PER_REQUEST)

/** Disabled when the server says the file is not analyzable, OR the cap is reached and this file is not already selected. */
function isCheckboxDisabled(source: AiIntakeSource): boolean {
  if (!source.analyzable) return true
  if (isSelected(source.sourceRef)) return false
  return atSelectionCap.value
}

const canAnalyze = computed(() =>
  props.selectedRefs.length > 0 && hasConfiguredProvider.value && !props.analyzing,
)
</script>

<template>
  <section class="ws-ai-intake" aria-labelledby="ws-ai-intake-heading">
    <p class="ws-scope-hint">
      Selecting a file never calls an AI model or writes anything. Only clicking "Analyze selected sources" below sends the selected text sources to the configured AI provider.
    </p>

    <!-- 4-step flow indicator - Select sources is the current step -->
    <ol class="ws-steps" aria-label="AI proposal workflow">
      <li class="ws-step ws-step--current"><span class="ws-step-index">1</span> Select sources</li>
      <li class="ws-step"><span class="ws-step-index">2</span> Analyze</li>
      <li class="ws-step"><span class="ws-step-index">3</span> Review proposals</li>
      <li class="ws-step"><span class="ws-step-index">4</span> Apply to Draft</li>
    </ol>

    <section class="ws-card" aria-labelledby="ws-ai-provider-heading">
      <h2 id="ws-ai-provider-heading" class="ws-card-title">AI provider</h2>
      <p v-if="providersLoading" class="ws-empty">Loading provider status…</p>
      <div v-else-if="providersError" class="ws-provider-error">
        <p>Could not read provider status.</p>
        <button type="button" class="ws-retry-btn" @click="emit('retry-providers')">Retry</button>
      </div>
      <p v-else-if="!hasConfiguredProvider" class="ws-provider-empty">AI provider is not configured.</p>
      <div v-else class="ws-provider-row">
        <label v-for="p in configuredProviders" :key="p.id" class="ws-provider-option">
          <input
            type="radio"
            name="ws-ai-provider"
            :value="p.id"
            :checked="selectedProviderId === p.id"
            @change="emit('update:selectedProviderId', p.id)"
          >
          {{ p.label }}<span v-if="p.isDefault" class="ws-provider-default"> (default)</span>
        </label>
      </div>
    </section>

    <section class="ws-card" aria-labelledby="ws-ai-intake-heading">
      <div class="ws-card-header">
        <h2 id="ws-ai-intake-heading" class="ws-card-title">Select source files for this product</h2>
        <span class="ws-selected-count">{{ selectedRefs.length }} / {{ MAX_FILES_PER_REQUEST }} selected</span>
      </div>

      <!--
        A failed request is never presented as "no files": that would tell an
        editor their product is empty when the server could not be reached,
        and would hide files that do exist.
      -->
      <p v-if="sourcesLoading" class="ws-empty">Loading this product&apos;s files…</p>

      <div v-else-if="sourcesError" class="ws-provider-error" role="alert">
        <p>Could not load this product&apos;s files. This is a loading error, not an empty product.</p>
        <button type="button" class="ws-retry-btn" @click="emit('retry-sources')">Retry</button>
      </div>

      <p v-else-if="sources.length === 0" class="ws-empty">
        This product has no associated files yet.
        <NuxtLink :to="mediaResourcesHref">Go to Media &amp; resources</NuxtLink> to associate one first.
      </p>

      <p v-else-if="!hasAnyAnalyzableSource" class="ws-empty ws-empty--no-readable">
        None of this product&apos;s linked files can be analyzed as text yet — they may all be images, disabled for this product, or another unsupported format.
        Supported formats: {{ SUPPORTED_TEXT_SOURCE_FORMATS_LABEL }}.
        <NuxtLink :to="mediaResourcesHref">Go to Media &amp; resources</NuxtLink> to link a readable file.
      </p>

      <ul v-if="!sourcesLoading && !sourcesError && sources.length > 0" class="ws-file-grid" role="list">
        <li
          v-for="source in sources"
          :key="source.sourceRef"
          class="ws-file-card"
          :class="{ 'ws-file-card--selected': isSelected(source.sourceRef) }"
        >
          <label class="ws-file-label" :class="{ 'ws-file-label--disabled': isCheckboxDisabled(source) }">
            <input
              type="checkbox"
              class="ws-file-checkbox"
              :disabled="isCheckboxDisabled(source)"
              :checked="isSelected(source.sourceRef)"
              @change="emit('toggle', source.sourceRef)"
            >
            <span class="ws-file-name">{{ source.displayName }}</span>
          </label>
          <dl class="ws-file-facts">
            <dt>Type</dt>
            <dd>{{ source.typeLabel }}</dd>
            <dt>Role</dt>
            <dd>{{ source.roleLabel }}</dd>
          </dl>
          <p v-if="source.unavailableReason" class="ws-file-unsupported">{{ source.unavailableReason }}</p>
        </li>
      </ul>

      <div class="ws-analyze-row">
        <p v-if="selectedRefs.length > 0" class="ws-analyze-note">
          Selected text sources will be sent to the configured AI provider to create draft specification proposals. Nothing will be written or published.
        </p>
        <button
          type="button"
          class="btn btn-primary btn-analyze"
          :disabled="!canAnalyze"
          @click="emit('analyze')"
        >
          {{ analyzing ? 'Analyzing…' : '✨ Analyze selected sources' }}
        </button>
        <p v-if="analyzeError" class="ws-analyze-error" role="alert">{{ analyzeError }}</p>
        <ul v-if="fileResults.some(f => f.status !== 'read')" class="ws-file-result-list">
          <li v-for="(f, i) in fileResults.filter(r => r.status !== 'read')" :key="i" class="ws-file-result-item">
            {{ f.displayName }}: {{ f.reason }}
          </li>
        </ul>
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

.ws-steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.ws-step {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: 999px;
}
.ws-step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-surface-alt);
  font-weight: 600;
  flex-shrink: 0;
}
.ws-step--current {
  color: var(--color-primary-deep);
  font-weight: 600;
  border-color: var(--color-primary);
  background: rgba(15,92,75,0.06);
}
.ws-step--current .ws-step-index { background: var(--color-primary); color: white; }

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

.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }

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

.ws-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-2) 0; line-height: 1.6; }
.ws-empty a { color: var(--color-primary); }
.ws-empty--no-readable { background: var(--color-surface-alt); border-radius: var(--radius-sm); padding: var(--space-3); }

.ws-provider-empty {
  font-size: var(--text-sm);
  color: #856404;
  background: #FFF3CD;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}
.ws-provider-error {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: #C0392B;
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}
.ws-provider-error p { margin: 0; }
.ws-retry-btn {
  background: none;
  border: 1px solid #C0392B;
  color: #C0392B;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.ws-provider-row { display: flex; flex-wrap: wrap; gap: var(--space-4); }
.ws-provider-option { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); cursor: pointer; }
.ws-provider-default { color: var(--color-ink-muted); font-size: var(--text-xs); }

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
.ws-file-label--disabled { cursor: not-allowed; opacity: 0.6; }
.ws-file-checkbox { flex-shrink: 0; width: 16px; height: 16px; }
.ws-file-name { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); overflow-wrap: anywhere; }

.ws-file-facts { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--space-2); margin: 0; font-size: var(--text-xs); }
.ws-file-facts dt { color: var(--color-ink-muted); white-space: nowrap; }
.ws-file-facts dd { color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }

.ws-file-unsupported { font-size: 0.6875rem; color: var(--color-ink-muted); font-style: italic; margin: 0; }

.ws-analyze-row { margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }
.ws-analyze-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; max-width: 60ch; line-height: 1.5; }

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
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; background: var(--color-surface-alt); color: var(--color-ink-muted); }

.btn-analyze { font-weight: 700; font-size: var(--text-base); padding: var(--space-3) var(--space-6); box-shadow: 0 1px 2px rgba(15,92,75,0.25); }
.btn-analyze:disabled { box-shadow: none; }

.ws-analyze-error {
  font-size: var(--text-sm);
  color: #C0392B;
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.ws-file-result-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.ws-file-result-item { font-size: var(--text-xs); color: var(--color-ink-muted); }

/* ── ≤767px: single-column cards, never a compressed grid ── */
@media (max-width: 767px) {
  .ws-file-grid { grid-template-columns: 1fr; }
  .ws-steps { gap: var(--space-1); }
}
</style>
