<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AdminContentAiAnalyzeResult, AdminContentAiSourceIntake } from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import { CONTENT_LOCALE_LABELS, contentAiProposalReviewRoute, contentMediaRelationsRoute, contentSeoLocalesRoute, contentTypeLabel } from '~/utils/contentCenter'
import { AI_READABLE_FORMATS_LABEL } from '~/utils/aiSourceFormats'
import {
  CONTENT_AI_ANALYZE_DISCLOSURE,
  CONTENT_AI_DATA_DISCLOSURE,
  CONTENT_AI_OWNERSHIP_NOTE,
  CONTENT_AI_PROPOSAL_NOTE,
  CONTENT_AI_SELECTION_DISCLOSURE,
  canSelectContentAiSource,
  contentAiIntakeCounts,
  interpretContentAiAnalyzeError,
  toggleContentAiSelection,
} from '~/utils/contentAiIntake'

interface AiProviderSummary { id: string, label: string, configured: boolean, isDefault: boolean }

/**
 * CC-IMP-08 — CC-AI-01 AI Source Intake (CC-AI-01-SOURCE-INTAKE-D1440).
 *
 * Shows the files ALREADY linked to this content item as source documents,
 * downloads or inline media, with their real role and whether each can be read.
 * Ticking a source changes only this page's selection. The one request that can
 * reach an AI provider is the explicit "Analyze selected sources" call, which
 * writes nothing and prepares an in-memory proposal. There is no Add / Remove /
 * Upload here — links belong to Media & Relations — and no Accept / Edit /
 * Reject / Apply: those live in AI Proposal Review (CC-IMP-09).
 */
const props = defineProps<{
  intake: AdminContentAiSourceIntake
  providers: AiProviderSummary[]
  providersError: boolean
}>()

const emit = defineEmits<{ locale: [locale: ContentLocale] }>()

const selected = ref<string[]>([])
const analyzing = ref(false)
const analyzeError = ref<string | null>(null)
const result = ref<AdminContentAiAnalyzeResult | null>(null)

const configured = computed(() => props.providers.filter(p => p.configured))
const providerId = ref<string | null>(configured.value.find(p => p.isDefault)?.id ?? configured.value[0]?.id ?? null)

const archived = computed(() => props.intake.item.status === 'archived')
const readOnly = computed(() => archived.value || !props.intake.locale_started)
const counts = computed(() => contentAiIntakeCounts(props.intake.sources, selected.value))
const limits = computed(() => props.intake.limits)
const atImageCap = computed(() => counts.value.images >= limits.value.max_images)
const mediaHref = computed(() => contentMediaRelationsRoute(props.intake.item.id))
const seoHref = computed(() => contentSeoLocalesRoute(props.intake.item.id, props.intake.locale))
const reviewHref = computed(() => contentAiProposalReviewRoute(props.intake.item.id, props.intake.locale))
const canAnalyze = computed(() => !readOnly.value && !analyzing.value && selected.value.length > 0 && providerId.value !== null)

function isChecked(ref: string) {
  return selected.value.includes(ref)
}

function toggle(sourceRef: string) {
  if (readOnly.value || analyzing.value) return
  const source = props.intake.sources.find(s => s.sourceRef === sourceRef)
  if (!source) return
  selected.value = toggleContentAiSelection(source, props.intake.sources, selected.value, limits.value)
  result.value = null
  analyzeError.value = null
}

function selectable(sourceRef: string): boolean {
  const source = props.intake.sources.find(s => s.sourceRef === sourceRef)
  return !readOnly.value && !!source && canSelectContentAiSource(source, props.intake.sources, selected.value, limits.value)
}

function switchLocale(locale: ContentLocale) {
  if (locale === props.intake.locale || analyzing.value) return
  selected.value = []
  result.value = null
  analyzeError.value = null
  emit('locale', locale)
}

async function analyze() {
  if (!canAnalyze.value) return
  analyzing.value = true
  analyzeError.value = null
  result.value = null
  try {
    const response = await $fetch<AdminContentAiAnalyzeResult>(`/api/admin/content-center/${props.intake.item.id}/ai-source-intake`, {
      method: 'POST',
      body: { locale: props.intake.locale, providerId: providerId.value, sourceRefs: [...selected.value] },
    })
    result.value = response
    if (!response.ok) analyzeError.value = response.error
  } catch (err: unknown) {
    analyzeError.value = interpretContentAiAnalyzeError(err)
  } finally {
    analyzing.value = false
  }
}

const failedFiles = computed(() => (result.value?.fileResults ?? []).filter(f => f.status !== 'read'))
</script>

<template>
  <div class="cai">
    <p class="cai-disclosure">{{ CONTENT_AI_SELECTION_DISCLOSURE }} {{ CONTENT_AI_ANALYZE_DISCLOSURE }}</p>

    <div class="cai-grid">
      <div class="cai-main">
        <section class="cai-card" aria-labelledby="cai-context-title">
          <h2 id="cai-context-title" class="cai-card-title">Current draft</h2>
          <dl class="cai-facts">
            <div><dt>Title</dt><dd>{{ intake.item.title || 'Untitled' }}</dd></div>
            <div><dt>Content type</dt><dd>{{ contentTypeLabel(intake.item.content_type) }}</dd></div>
            <div><dt>Draft revision</dt><dd>{{ intake.draft_revision ?? '—' }}</dd></div>
          </dl>
          <div class="cai-locales" role="group" aria-label="Current language">
            <span class="cai-locales-label">Current language</span>
            <button
              v-for="locale in intake.site_locales"
              :key="locale"
              type="button"
              class="cai-locale"
              :class="{ 'cai-locale--current': locale === intake.locale }"
              :aria-pressed="locale === intake.locale"
              :disabled="analyzing"
              @click="switchLocale(locale)"
            >
              {{ CONTENT_LOCALE_LABELS[locale] }}<span v-if="!intake.started_locales.includes(locale)" class="cai-locale-note"> · Not started</span>
            </button>
          </div>
        </section>

        <p v-if="archived" class="cai-notice" role="status">This content item is archived. Sources cannot be analyzed until it is restored to draft.</p>

        <section v-if="!intake.locale_started" class="cai-card" role="status">
          <h2 class="cai-card-title">{{ CONTENT_LOCALE_LABELS[intake.locale] }} has not been started</h2>
          <p class="cai-hint">This language has not been started yet. Go to SEO &amp; locales to start it.</p>
          <NuxtLink :to="seoHref" class="cai-link">Go to SEO &amp; locales</NuxtLink>
        </section>

        <section v-else class="cai-card cai-sources" aria-labelledby="cai-sources-title">
          <div class="cai-card-head">
            <div>
              <h2 id="cai-sources-title" class="cai-card-title">Linked sources</h2>
              <p class="cai-hint">{{ CONTENT_AI_OWNERSHIP_NOTE }}</p>
            </div>
            <span class="cai-count" aria-live="polite">{{ counts.selected }} / {{ limits.max_files }} selected</span>
          </div>
          <p class="cai-hint">Up to {{ limits.max_files }} sources and {{ limits.max_images }} images per analysis. Readable formats: {{ AI_READABLE_FORMATS_LABEL }}.</p>
          <p v-if="atImageCap" class="cai-hint cai-warn">The image limit is reached — other file types can still be selected.</p>

          <div v-if="counts.readable === 0" class="cai-empty">
            <p>No AI-readable linked sources.</p>
            <NuxtLink :to="mediaHref" class="cai-link">Manage files in Media &amp; Relations</NuxtLink>
          </div>

          <ul v-if="intake.sources.length > 0" class="cai-list" role="list">
            <li
              v-for="source in intake.sources"
              :key="source.sourceRef"
              class="cai-source"
              :class="{ 'cai-source--selected': isChecked(source.sourceRef), 'cai-source--unavailable': !source.analyzable }"
            >
              <label class="cai-source-label">
                <input
                  type="checkbox"
                  class="cai-check"
                  :checked="isChecked(source.sourceRef)"
                  :disabled="!selectable(source.sourceRef) || analyzing"
                  @change="toggle(source.sourceRef)"
                >
                <span class="cai-source-name">{{ source.displayName }}</span>
              </label>
              <p class="cai-badges">
                <span class="cai-badge">{{ source.typeLabel }}</span>
                <span class="cai-badge cai-badge--role">{{ source.roleLabel }}</span>
                <span v-if="source.analyzable" class="cai-badge cai-badge--ok">Readable</span>
                <span v-else class="cai-badge cai-badge--off">Unavailable</span>
              </p>
              <p v-if="source.unavailableReason" class="cai-reason">{{ source.unavailableReason }}</p>
            </li>
          </ul>

          <div class="cai-analyze">
            <fieldset v-if="configured.length > 0" class="cai-provider">
              <legend class="cai-provider-legend">AI provider</legend>
              <label v-for="p in configured" :key="p.id" class="cai-provider-option">
                <input v-model="providerId" type="radio" name="cai-provider" :value="p.id" :disabled="analyzing || readOnly">
                {{ p.label }}<span v-if="p.isDefault" class="cai-hint"> (default)</span>
              </label>
            </fieldset>
            <p v-else class="cai-hint cai-warn">{{ providersError ? 'Could not read provider status.' : 'AI provider is not configured.' }}</p>
            <p v-if="counts.selected > 0" class="cai-hint">{{ CONTENT_AI_DATA_DISCLOSURE }}</p>
            <button type="button" class="cai-analyze-btn" :disabled="!canAnalyze" @click="analyze">
              {{ analyzing ? 'Analyzing…' : 'Analyze selected sources' }}
            </button>
            <p v-if="analyzeError" class="cai-error" role="alert">{{ analyzeError }}</p>
            <ul v-if="failedFiles.length" class="cai-file-results">
              <li v-for="(f, i) in failedFiles" :key="i">{{ f.displayName }}: {{ f.reason }}</li>
            </ul>
          </div>
        </section>

        <section v-if="result && result.ok" class="cai-card cai-prepared" role="status" aria-labelledby="cai-prepared-title">
          <h2 id="cai-prepared-title" class="cai-card-title">Proposal prepared</h2>
          <p>
            {{ result.item_count }} suggested change(s)<template v-if="result.conflict_count"> and {{ result.conflict_count }} conflict(s)</template>
            for {{ CONTENT_LOCALE_LABELS[intake.locale] }} draft revision {{ result.draft_revision }}. Nothing was written to the draft.
          </p>
          <p class="cai-hint">{{ CONTENT_AI_PROPOSAL_NOTE }}</p>
          <NuxtLink :to="reviewHref" class="cai-link">Review proposal</NuxtLink>
        </section>
      </div>

      <aside class="cai-aside">
        <section class="cai-card" aria-labelledby="cai-summary-title">
          <h2 id="cai-summary-title" class="cai-card-title">Intake summary</h2>
          <dl class="cai-stats">
            <div><dt>Selected</dt><dd>{{ counts.selected }}</dd></div>
            <div><dt>Readable</dt><dd>{{ counts.readable }}</dd></div>
            <div><dt>Unavailable</dt><dd>{{ counts.unavailable }}</dd></div>
          </dl>
        </section>
        <section class="cai-card" aria-labelledby="cai-rules-title">
          <h2 id="cai-rules-title" class="cai-card-title">AI intake rules</h2>
          <ol class="cai-rules">
            <li>AI turns selected sources into a proposal only.</li>
            <li>AI never publishes and never writes the draft by itself.</li>
            <li>Only linked source documents, downloads and inline media can be analyzed — never hero or Open Graph images.</li>
          </ol>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cai { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.cai-disclosure { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); line-height: 1.55; max-width: 80ch; }
.cai-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-4); align-items: start; }
.cai-main, .cai-aside { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.cai-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); min-width: 0; }
.cai-card-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-2); }
.cai-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cai-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-2); line-height: 1.5; overflow-wrap: anywhere; }
.cai-warn { color: #8A5A00; }
.cai-link { font-size: var(--text-sm); color: var(--color-primary); }
.cai-facts { margin: 0 0 var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); }
.cai-facts > div { display: flex; justify-content: space-between; gap: var(--space-3); min-width: 0; }
.cai-facts dt { font-size: var(--text-xs); color: var(--color-ink-muted); flex-shrink: 0; }
.cai-facts dd { margin: 0; font-size: var(--text-sm); color: var(--color-ink); text-align: right; overflow-wrap: anywhere; min-width: 0; }
.cai-locales { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.cai-locales-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); margin-right: var(--space-1); }
.cai-locale { border: 1px solid var(--color-line); border-radius: 999px; background: var(--color-surface); color: var(--color-ink); cursor: pointer; font-size: var(--text-xs); padding: var(--space-1) var(--space-3); min-height: 32px; }
.cai-locale--current { border-color: var(--color-primary); color: var(--color-primary-deep); font-weight: 600; background: rgba(47, 107, 58, 0.06); }
.cai-locale-note { color: var(--color-ink-muted); font-weight: 400; }
.cai-notice { margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }
.cai-count { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted); background: var(--color-surface-alt); border: 1px solid var(--color-line); border-radius: 999px; padding: var(--space-1) var(--space-3); white-space: nowrap; }
.cai-empty { margin: var(--space-2) 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--color-ink-muted); }
.cai-empty p { margin: 0 0 var(--space-2); }
.cai-list { list-style: none; margin: var(--space-3) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cai-source { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cai-source--selected { border-color: var(--color-primary); background: rgba(47, 107, 58, 0.06); }
.cai-source--unavailable { background: var(--color-surface-alt); }
.cai-source-label { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; min-width: 0; }
.cai-check { flex-shrink: 0; width: 18px; height: 18px; }
.cai-source-name { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.cai-badges { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; }
.cai-badge { font-size: 0.6875rem; font-weight: 600; border-radius: 999px; padding: 1px var(--space-2); background: var(--color-surface-alt); border: 1px solid var(--color-line); color: var(--color-ink-muted); }
.cai-badge--role { background: #EEF2FA; border-color: #D5DEEE; color: #34507A; }
.cai-badge--ok { background: #E3F3EC; border-color: #BFE3D2; color: #1E6B4E; }
.cai-badge--off { background: #F4F4F4; color: #6B6B6B; }
.cai-reason { margin: 0; font-size: var(--text-xs); color: var(--color-ink-muted); font-style: italic; overflow-wrap: anywhere; }
.cai-analyze { margin-top: var(--space-4); display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); }
.cai-provider { border: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-3); }
.cai-provider-legend { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); margin-bottom: var(--space-1); }
.cai-provider-option { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); }
.cai-analyze-btn { min-height: 44px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 600; cursor: pointer; padding: var(--space-2) var(--space-5); }
.cai-analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; background: var(--color-surface-alt); color: var(--color-ink-muted); border-color: var(--color-line); }
.cai-error { margin: 0; font-size: var(--text-sm); color: #C0392B; background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
.cai-file-results { margin: 0; padding-left: var(--space-5); font-size: var(--text-xs); color: var(--color-ink-muted); }
.cai-prepared { border-color: var(--color-primary); }
.cai-prepared p { margin: 0 0 var(--space-2); font-size: var(--text-sm); color: var(--color-ink); }
.cai-stats { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); text-align: center; }
.cai-stats dt { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cai-stats dd { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); }
.cai-rules { margin: 0; padding-left: var(--space-5); font-size: var(--text-sm); color: var(--color-ink); display: flex; flex-direction: column; gap: var(--space-2); }

@media (max-width: 1279px) {
  .cai-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .cai-card { padding: var(--space-4); }
  .cai-analyze-btn { width: 100%; }
  .cai-analyze { align-items: stretch; }
}
</style>
