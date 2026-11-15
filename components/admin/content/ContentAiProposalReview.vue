<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  AdminContentAiApplyResult,
  AdminContentAiBlockValue,
  AdminContentAiReview,
  AdminContentAiReviewConflict,
  AdminContentAiReviewItem,
} from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import {
  CONTENT_BLOCK_LABELS,
  CONTENT_LOCALE_LABELS,
  contentAiSourceIntakeRoute,
  contentEditorLocaleRoute,
  contentSeoLocalesRoute,
  contentTypeLabel,
} from '~/utils/contentCenter'
import {
  CONTENT_AI_REVIEW_DISCLOSURE,
  CONTENT_AI_REVIEW_DRAFT_ONLY,
  CONTENT_AI_REVIEW_MEMORY_NOTE,
  CONTENT_AI_REVIEW_UNAVAILABLE,
  CONTENT_AI_REVIEW_UNAVAILABLE_HINT,
  acceptAllSafe,
  appliedMessage,
  applyAvailability,
  blockValueLines,
  buildApplyRequest,
  conflictEditProblem,
  editedBlockProblem,
  editedFieldProblem,
  initialReviewState,
  interpretContentAiApplyError,
  isReviewDirty,
  itemEditProblem,
  paragraphsFromText,
  reviewCounts,
  withConflictState,
  withItemState,
  type ContentAiReviewState,
} from '~/utils/contentAiReview'

/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review (CC-AI-02-PROPOSAL-REVIEW-D1440).
 *
 * Accept / Edit / Reject each proposed change and resolve each conflict by choosing a
 * value, editing it or rejecting it. Decisions live on this page only. The one request
 * this component makes is "Apply approved changes", which sends one decision per
 * proposal item; the server takes every target, operation and block type from its own
 * stored proposal and writes this language's working draft only. There is no Publish,
 * no confidence score and no page citation.
 */
const props = defineProps<{ review: AdminContentAiReview }>()

const emit = defineEmits<{
  locale: [locale: ContentLocale]
  dirty: [dirty: boolean]
}>()

type BlockData = Record<string, unknown>
type ListEntry = Record<string, unknown>

const proposal = computed(() => props.review.proposal)
const state = ref<ContentAiReviewState>(proposal.value ? initialReviewState(proposal.value) : { items: {}, conflicts: {} })
const editing = ref<string | null>(null)
const draftValue = ref('')
const draftBlock = ref<BlockData>({})
const draftParagraphs = ref('')
const editError = ref<string | null>(null)
const chosen = ref<Record<string, number | null>>({})
const applying = ref(false)
const applyError = ref<string | null>(null)
const applied = ref<AdminContentAiApplyResult | null>(null)

const intakeHref = computed(() => contentAiSourceIntakeRoute(props.review.item.id, props.review.locale))
const seoHref = computed(() => contentSeoLocalesRoute(props.review.item.id, props.review.locale))
const editorHref = computed(() => contentEditorLocaleRoute(props.review.item.id, props.review.locale))
const counts = computed(() => (proposal.value ? reviewCounts(proposal.value, state.value) : null))
const availability = computed(() => applyAvailability(props.review, state.value))
const dirty = computed(() => applied.value === null && isReviewDirty(state.value))
const readOnly = computed(() => {
  const p = proposal.value
  return !p || applied.value !== null || applying.value || p.applyState !== 'ready' || p.stale || p.lifecycleChanged || props.review.item.status === 'archived'
})
const pendingSafe = computed(() => (counts.value?.pending ?? 0) > 0)

const statusLabel = computed(() => {
  const p = proposal.value
  if (!props.review.locale_started) return 'Language not started'
  if (!p) return 'No proposal'
  if (applied.value || p.applyState === 'applied' || p.applyState === 'partial') return 'Applied'
  if (p.stale) return 'Draft changed'
  if (p.lifecycleChanged) return 'Content changed'
  return 'Ready for review'
})

const blockedNotice = computed(() => {
  const p = proposal.value
  if (!p || applied.value) return null
  if (props.review.item.status === 'archived') return 'This content item is archived. The proposal can be read but not applied.'
  if (p.applyState === 'applied' || p.applyState === 'partial') return 'This proposal has already been applied. Analyze again for new suggestions.'
  if (p.stale) return 'The draft changed since this analysis, so this proposal can no longer be applied. Analyze again.'
  if (p.lifecycleChanged) return 'This content was archived, restored, published or unpublished since the analysis, so this proposal can no longer be applied. Analyze again.'
  return null
})

watch(dirty, value => emit('dirty', value), { immediate: true })

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

function switchLocale(locale: ContentLocale) {
  if (locale === props.review.locale || applying.value) return
  emit('locale', locale)
}

// ── Display helpers ─────────────────────────────────────────────────────────

function valueLines(value: string | AdminContentAiBlockValue | null | undefined): string[] {
  if (value === null || value === undefined) return []
  return typeof value === 'string' ? [value] : blockValueLines(value)
}

function itemStatus(item: AdminContentAiReviewItem) {
  return state.value.items[item.proposalItemId]?.status ?? 'pending'
}

function conflictStatus(conflict: AdminContentAiReviewConflict) {
  return state.value.conflicts[conflict.proposalItemId]?.status ?? 'unresolved'
}

const STATE_LABELS: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', edited: 'Edited', rejected: 'Rejected', unresolved: 'Review required', chosen: 'Value selected',
}

function kindLabel(item: AdminContentAiReviewItem): string {
  if (item.kind === 'field') return 'Field'
  return item.kind === 'block_insert' ? 'New section' : 'Section replacement'
}

function shownValue(item: AdminContentAiReviewItem): string[] {
  const s = state.value.items[item.proposalItemId]
  if (s?.status === 'edited') {
    return item.kind === 'field' ? valueLines(s.value ?? '') : valueLines({ type: (item.proposedValue as AdminContentAiBlockValue).type, data: s.blockData ?? {} })
  }
  return valueLines(item.proposedValue)
}

function conflictResult(conflict: AdminContentAiReviewConflict): string | null {
  const s = state.value.conflicts[conflict.proposalItemId]
  if (s?.status === 'chosen') return conflict.candidateValues[s.index] ?? null
  if (s?.status === 'edited') return s.value
  return null
}

function evidenceText(item: AdminContentAiReviewItem): string {
  return item.evidence.length ? item.evidence.map(e => (e.displayName ? `${e.label} · ${e.displayName}` : e.label)).join(', ') : 'No source label given'
}

function blockTypeLabel(item: AdminContentAiReviewItem): string {
  return CONTENT_BLOCK_LABELS[(item.proposedValue as AdminContentAiBlockValue).type] ?? 'Section'
}

// ── Decisions ───────────────────────────────────────────────────────────────

function closeEdit() {
  editing.value = null
  editError.value = null
}

function decide(item: AdminContentAiReviewItem, status: 'accepted' | 'rejected') {
  if (readOnly.value) return
  state.value = withItemState(state.value, item.proposalItemId, { status })
  if (editing.value === item.proposalItemId) closeEdit()
  applyError.value = null
}

function startItemEdit(item: AdminContentAiReviewItem) {
  if (readOnly.value) return
  const s = state.value.items[item.proposalItemId]
  editError.value = null
  editing.value = item.proposalItemId
  if (item.kind === 'field') {
    draftValue.value = s?.status === 'edited' ? s.value ?? '' : String(item.proposedValue)
    return
  }
  const base = s?.status === 'edited' && s.blockData ? s.blockData : (item.proposedValue as AdminContentAiBlockValue).data
  draftBlock.value = JSON.parse(JSON.stringify(base)) as BlockData
  draftParagraphs.value = Array.isArray(draftBlock.value.paragraphs) ? (draftBlock.value.paragraphs as unknown[]).map(String).join('\n\n') : ''
}

function saveItemEdit(item: AdminContentAiReviewItem) {
  if (item.kind === 'field') {
    const problem = editedFieldProblem(draftValue.value, item.maxLength, item.targetLabel)
    if (problem) {
      editError.value = problem
      return
    }
    state.value = withItemState(state.value, item.proposalItemId, { status: 'edited', value: draftValue.value.trim() })
  } else {
    const type = (item.proposedValue as AdminContentAiBlockValue).type
    const data: BlockData = type === 'text' ? { ...draftBlock.value, paragraphs: paragraphsFromText(draftParagraphs.value) } : { ...draftBlock.value }
    const problem = editedBlockProblem({ type, data })
    if (problem) {
      editError.value = problem
      return
    }
    state.value = withItemState(state.value, item.proposalItemId, { status: 'edited', blockData: data })
  }
  applyError.value = null
  closeEdit()
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function setDraftField(key: string, event: Event) {
  draftBlock.value = { ...draftBlock.value, [key]: inputValue(event) }
}

function draftList(): ListEntry[] {
  return Array.isArray(draftBlock.value.items) ? draftBlock.value.items as ListEntry[] : []
}

function setDraftItem(index: number, field: string, event: Event) {
  const value = inputValue(event)
  draftBlock.value = { ...draftBlock.value, items: draftList().map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)) }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function useSelected(conflict: AdminContentAiReviewConflict) {
  const index = chosen.value[conflict.proposalItemId]
  if (readOnly.value || index === null || index === undefined) return
  state.value = withConflictState(state.value, conflict.proposalItemId, { status: 'chosen', index })
  if (editing.value === conflict.proposalItemId) closeEdit()
  applyError.value = null
}

function rejectConflict(conflict: AdminContentAiReviewConflict) {
  if (readOnly.value) return
  state.value = withConflictState(state.value, conflict.proposalItemId, { status: 'rejected' })
  if (editing.value === conflict.proposalItemId) closeEdit()
  applyError.value = null
}

function startConflictEdit(conflict: AdminContentAiReviewConflict) {
  if (readOnly.value) return
  const s = state.value.conflicts[conflict.proposalItemId]
  editError.value = null
  editing.value = conflict.proposalItemId
  const index = chosen.value[conflict.proposalItemId]
  draftValue.value = s?.status === 'edited' ? s.value : (index !== null && index !== undefined ? conflict.candidateValues[index] ?? '' : '')
}

function saveConflictEdit(conflict: AdminContentAiReviewConflict) {
  const problem = editedFieldProblem(draftValue.value, conflict.maxLength, conflict.targetLabel)
  if (problem) {
    editError.value = problem
    return
  }
  state.value = withConflictState(state.value, conflict.proposalItemId, { status: 'edited', value: draftValue.value.trim() })
  applyError.value = null
  closeEdit()
}

function onAcceptAllSafe() {
  if (readOnly.value || !proposal.value) return
  state.value = acceptAllSafe(proposal.value, state.value)
  applyError.value = null
}

async function apply() {
  if (readOnly.value || !availability.value.canApply) return
  applying.value = true
  applyError.value = null
  try {
    applied.value = await $fetch<AdminContentAiApplyResult>(`/api/admin/content-center/${props.review.item.id}/ai-proposal-review`, {
      method: 'POST',
      body: buildApplyRequest(props.review, state.value),
    })
    closeEdit()
  } catch (err: unknown) {
    applyError.value = interpretContentAiApplyError(err)
  } finally {
    applying.value = false
  }
}

const itemProblems = computed(() => Object.fromEntries((proposal.value?.items ?? []).map(i => [i.proposalItemId, itemEditProblem(i, state.value)])))
const conflictProblems = computed(() => Object.fromEntries((proposal.value?.conflicts ?? []).map(c => [c.proposalItemId, conflictEditProblem(c, state.value)])))
</script>

<template>
  <div class="cpr">
    <p class="cpr-disclosure">{{ CONTENT_AI_REVIEW_DISCLOSURE }}</p>

    <div class="cpr-grid">
      <div class="cpr-main">
        <section class="cpr-card" aria-labelledby="cpr-context-title">
          <h2 id="cpr-context-title" class="cpr-card-title">Current content</h2>
          <dl class="cpr-facts">
            <div><dt>Title</dt><dd>{{ review.item.title || 'Untitled' }}</dd></div>
            <div><dt>Content type</dt><dd>{{ contentTypeLabel(review.item.content_type) }}</dd></div>
            <div><dt>Draft revision</dt><dd>{{ review.draft_revision ?? '—' }}</dd></div>
            <div><dt>Proposal status</dt><dd><span class="cpr-status">{{ statusLabel }}</span></dd></div>
          </dl>
          <div class="cpr-locales" role="group" aria-label="Current language">
            <span class="cpr-locales-label">Current language</span>
            <button
              v-for="locale in review.site_locales"
              :key="locale"
              type="button"
              class="cpr-locale"
              :class="{ 'cpr-locale--current': locale === review.locale }"
              :aria-pressed="locale === review.locale"
              :disabled="applying"
              @click="switchLocale(locale)"
            >
              {{ CONTENT_LOCALE_LABELS[locale] }}<span v-if="!review.started_locales.includes(locale)" class="cpr-locale-note"> · Not started</span>
            </button>
          </div>
        </section>

        <section v-if="!review.locale_started" class="cpr-card" role="status">
          <h2 class="cpr-card-title">{{ CONTENT_LOCALE_LABELS[review.locale] }} has not been started</h2>
          <p class="cpr-hint">This language has not been started yet. Go to SEO &amp; locales to start it.</p>
          <NuxtLink :to="seoHref" class="cpr-link">Go to SEO &amp; locales</NuxtLink>
        </section>

        <section v-else-if="!proposal" class="cpr-card cpr-empty" role="status">
          <h2 class="cpr-card-title">{{ CONTENT_AI_REVIEW_UNAVAILABLE }}</h2>
          <p class="cpr-hint">{{ CONTENT_AI_REVIEW_UNAVAILABLE_HINT }}</p>
          <NuxtLink :to="intakeHref" class="cpr-link">Go to AI Source Intake</NuxtLink>
        </section>

        <template v-else>
          <p v-if="blockedNotice" class="cpr-notice" role="status">{{ blockedNotice }}</p>

          <section class="cpr-card" aria-labelledby="cpr-sources-title">
            <div class="cpr-card-head">
              <h2 id="cpr-sources-title" class="cpr-card-title">Sources in this analysis</h2>
              <span v-if="proposal.conflicts.length" class="cpr-conflict-count">{{ proposal.conflicts.length }} conflict{{ proposal.conflicts.length === 1 ? '' : 's' }} need{{ proposal.conflicts.length === 1 ? 's' : '' }} confirmation</span>
            </div>
            <ul v-if="proposal.sources.length" class="cpr-chips" role="list">
              <li v-for="source in proposal.sources" :key="source.label" class="cpr-chip">{{ source.label }} · {{ source.displayName || 'Source file' }}</li>
            </ul>
            <p v-else class="cpr-hint">No source name was recorded for this analysis.</p>
            <NuxtLink :to="intakeHref" class="cpr-link">View sources in AI Source Intake</NuxtLink>
          </section>

          <section class="cpr-card" aria-labelledby="cpr-items-title">
            <h2 id="cpr-items-title" class="cpr-card-title">Proposed changes ({{ proposal.items.length }})</h2>
            <p v-if="proposal.items.length === 0" class="cpr-hint">No direct change was proposed.</p>
            <ul class="cpr-list" role="list">
              <li
                v-for="item in proposal.items"
                :key="item.proposalItemId"
                class="cpr-item"
                :class="`cpr-item--${itemStatus(item)}`"
                :data-item="item.proposalItemId"
              >
                <div class="cpr-item-head">
                  <h3 class="cpr-target">{{ item.targetLabel }}</h3>
                  <span class="cpr-kind">{{ kindLabel(item) }}</span>
                  <span class="cpr-state" :class="`cpr-state--${itemStatus(item)}`">{{ STATE_LABELS[itemStatus(item)] }}</span>
                </div>
                <div class="cpr-compare">
                  <div class="cpr-col">
                    <p class="cpr-col-label">Existing value</p>
                    <template v-if="valueLines(item.existingValue).length">
                      <p v-for="(line, i) in valueLines(item.existingValue)" :key="i" class="cpr-value">{{ line }}</p>
                    </template>
                    <p v-else class="cpr-value cpr-value--empty">{{ item.kind === 'block_insert' ? '(New section)' : '(No existing value)' }}</p>
                  </div>
                  <div class="cpr-col cpr-col--proposed">
                    <p class="cpr-col-label">{{ itemStatus(item) === 'edited' ? 'Edited value' : 'AI proposal' }}</p>
                    <p v-for="(line, i) in shownValue(item)" :key="i" class="cpr-value">{{ line }}</p>
                  </div>
                </div>
                <p class="cpr-evidence">Evidence: {{ evidenceText(item) }}</p>
                <p v-if="itemProblems[item.proposalItemId]" class="cpr-error" role="alert">{{ itemProblems[item.proposalItemId] }}</p>

                <div v-if="editing === item.proposalItemId" class="cpr-edit">
                  <template v-if="item.kind === 'field'">
                    <label :for="`cpr-edit-${item.proposalItemId}`" class="cpr-edit-label">Edit {{ item.targetLabel }} (value only)</label>
                    <textarea :id="`cpr-edit-${item.proposalItemId}`" v-model="draftValue" rows="3" :maxlength="item.maxLength ?? undefined" />
                    <p class="cpr-hint">{{ draftValue.trim().length }} / {{ item.maxLength }} characters</p>
                  </template>
                  <template v-else>
                    <p class="cpr-hint">Edit the text of this {{ blockTypeLabel(item) }} section. Its type and place cannot change.</p>
                    <label :for="`cpr-edit-${item.proposalItemId}-heading`" class="cpr-edit-label">Heading (optional)</label>
                    <input :id="`cpr-edit-${item.proposalItemId}-heading`" type="text" :value="text(draftBlock.heading)" @input="setDraftField('heading', $event)">
                    <template v-if="(item.proposedValue as AdminContentAiBlockValue).type === 'text'">
                      <label :for="`cpr-edit-${item.proposalItemId}-paragraphs`" class="cpr-edit-label">Paragraphs (separate with a blank line)</label>
                      <textarea :id="`cpr-edit-${item.proposalItemId}-paragraphs`" v-model="draftParagraphs" rows="6" />
                    </template>
                    <template v-else-if="(item.proposedValue as AdminContentAiBlockValue).type === 'key_points'">
                      <div v-for="(entry, i) in draftList()" :key="i" class="cpr-edit-entry">
                        <label :for="`cpr-edit-${item.proposalItemId}-kp${i}-title`" class="cpr-edit-label">Point {{ i + 1 }} title</label>
                        <input :id="`cpr-edit-${item.proposalItemId}-kp${i}-title`" type="text" :value="text(entry.title)" @input="setDraftItem(i, 'title', $event)">
                        <label :for="`cpr-edit-${item.proposalItemId}-kp${i}-body`" class="cpr-edit-label">Point {{ i + 1 }} description</label>
                        <textarea :id="`cpr-edit-${item.proposalItemId}-kp${i}-body`" rows="2" :value="text(entry.body)" @input="setDraftItem(i, 'body', $event)" />
                      </div>
                    </template>
                    <template v-else-if="(item.proposedValue as AdminContentAiBlockValue).type === 'faq'">
                      <div v-for="(entry, i) in draftList()" :key="i" class="cpr-edit-entry">
                        <label :for="`cpr-edit-${item.proposalItemId}-faq${i}-q`" class="cpr-edit-label">Question {{ i + 1 }}</label>
                        <input :id="`cpr-edit-${item.proposalItemId}-faq${i}-q`" type="text" :value="text(entry.question)" @input="setDraftItem(i, 'question', $event)">
                        <label :for="`cpr-edit-${item.proposalItemId}-faq${i}-a`" class="cpr-edit-label">Answer {{ i + 1 }}</label>
                        <textarea :id="`cpr-edit-${item.proposalItemId}-faq${i}-a`" rows="3" :value="text(entry.answer)" @input="setDraftItem(i, 'answer', $event)" />
                      </div>
                    </template>
                    <template v-else-if="(item.proposedValue as AdminContentAiBlockValue).type === 'cta'">
                      <label :for="`cpr-edit-${item.proposalItemId}-cta-body`" class="cpr-edit-label">Text (optional)</label>
                      <textarea :id="`cpr-edit-${item.proposalItemId}-cta-body`" rows="2" :value="text(draftBlock.body)" @input="setDraftField('body', $event)" />
                      <label :for="`cpr-edit-${item.proposalItemId}-cta-label`" class="cpr-edit-label">Button label</label>
                      <input :id="`cpr-edit-${item.proposalItemId}-cta-label`" type="text" :value="text(draftBlock.label)" @input="setDraftField('label', $event)">
                      <label :for="`cpr-edit-${item.proposalItemId}-cta-href`" class="cpr-edit-label">Link</label>
                      <input :id="`cpr-edit-${item.proposalItemId}-cta-href`" type="text" spellcheck="false" :value="text(draftBlock.href)" @input="setDraftField('href', $event)">
                    </template>
                  </template>
                  <p v-if="editError" class="cpr-error" role="alert">{{ editError }}</p>
                  <div class="cpr-actions">
                    <button type="button" class="cpr-btn cpr-btn--primary" @click="saveItemEdit(item)">Save edit</button>
                    <button type="button" class="cpr-btn" @click="closeEdit">Cancel</button>
                  </div>
                </div>
                <div v-else class="cpr-actions">
                  <button type="button" class="cpr-btn cpr-btn--accept" :aria-pressed="itemStatus(item) === 'accepted'" :disabled="readOnly" @click="decide(item, 'accepted')">Accept</button>
                  <button type="button" class="cpr-btn" :aria-pressed="itemStatus(item) === 'edited'" :disabled="readOnly" @click="startItemEdit(item)">Edit</button>
                  <button type="button" class="cpr-btn cpr-btn--reject" :aria-pressed="itemStatus(item) === 'rejected'" :disabled="readOnly" @click="decide(item, 'rejected')">Reject</button>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="proposal.conflicts.length" class="cpr-card cpr-card--conflicts" aria-labelledby="cpr-conflicts-title">
            <h2 id="cpr-conflicts-title" class="cpr-card-title">Conflicts to resolve ({{ proposal.conflicts.length }})</h2>
            <p class="cpr-hint">The sources gave different values. Choose one, edit your own value, or reject the change. A conflict is never accepted automatically.</p>
            <ul class="cpr-list" role="list">
              <li
                v-for="conflict in proposal.conflicts"
                :key="conflict.proposalItemId"
                class="cpr-conflict"
                :class="`cpr-conflict--${conflictStatus(conflict)}`"
                :data-item="conflict.proposalItemId"
              >
                <div class="cpr-item-head">
                  <h3 class="cpr-target">{{ conflict.targetLabel }}</h3>
                  <span class="cpr-state" :class="`cpr-state--${conflictStatus(conflict)}`">{{ STATE_LABELS[conflictStatus(conflict)] }}</span>
                </div>
                <p class="cpr-col-label">Existing value</p>
                <p class="cpr-value" :class="{ 'cpr-value--empty': !conflict.existingValue }">{{ conflict.existingValue || '(No existing value)' }}</p>
                <fieldset class="cpr-candidates" :disabled="readOnly">
                  <legend class="cpr-col-label">Values found in the sources</legend>
                  <label v-for="(candidate, index) in conflict.candidateValues" :key="index" class="cpr-candidate">
                    <input v-model="chosen[conflict.proposalItemId]" type="radio" :name="`cpr-conflict-${conflict.proposalItemId}`" :value="index">
                    <span>{{ candidate }}</span>
                  </label>
                </fieldset>
                <p v-if="conflictResult(conflict)" class="cpr-resolved">Will apply: {{ conflictResult(conflict) }}</p>
                <p v-if="conflictProblems[conflict.proposalItemId]" class="cpr-error" role="alert">{{ conflictProblems[conflict.proposalItemId] }}</p>

                <div v-if="editing === conflict.proposalItemId" class="cpr-edit">
                  <label :for="`cpr-edit-${conflict.proposalItemId}`" class="cpr-edit-label">Your value for {{ conflict.targetLabel }}</label>
                  <textarea :id="`cpr-edit-${conflict.proposalItemId}`" v-model="draftValue" rows="3" :maxlength="conflict.maxLength" />
                  <p v-if="editError" class="cpr-error" role="alert">{{ editError }}</p>
                  <div class="cpr-actions">
                    <button type="button" class="cpr-btn cpr-btn--primary" @click="saveConflictEdit(conflict)">Save value</button>
                    <button type="button" class="cpr-btn" @click="closeEdit">Cancel</button>
                  </div>
                </div>
                <div v-else class="cpr-actions">
                  <button
                    type="button"
                    class="cpr-btn cpr-btn--accept"
                    :disabled="readOnly || chosen[conflict.proposalItemId] === null || chosen[conflict.proposalItemId] === undefined"
                    @click="useSelected(conflict)"
                  >Use selected value</button>
                  <button type="button" class="cpr-btn" :aria-pressed="conflictStatus(conflict) === 'edited'" :disabled="readOnly" @click="startConflictEdit(conflict)">Edit value</button>
                  <button type="button" class="cpr-btn cpr-btn--reject" :aria-pressed="conflictStatus(conflict) === 'rejected'" :disabled="readOnly" @click="rejectConflict(conflict)">Reject</button>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <aside class="cpr-aside">
        <section v-if="proposal && counts" class="cpr-card" aria-labelledby="cpr-summary-title">
          <h2 id="cpr-summary-title" class="cpr-card-title">Review summary</h2>
          <dl class="cpr-stats">
            <div><dt>Proposals</dt><dd>{{ counts.total }}</dd></div>
            <div><dt>Pending</dt><dd>{{ counts.pending }}</dd></div>
            <div><dt>Accepted</dt><dd>{{ counts.accepted }}</dd></div>
            <div><dt>Edited</dt><dd>{{ counts.edited }}</dd></div>
            <div><dt>Rejected</dt><dd>{{ counts.rejected }}</dd></div>
            <div><dt>Conflicts</dt><dd>{{ counts.unresolved }} / {{ counts.conflicts }}</dd></div>
          </dl>
          <p v-if="counts.unresolved > 0" class="cpr-callout cpr-callout--warn">{{ counts.unresolved }} conflict{{ counts.unresolved === 1 ? '' : 's' }} need{{ counts.unresolved === 1 ? 's' : '' }} a human decision.</p>

          <button type="button" class="cpr-btn cpr-accept-all" :disabled="readOnly || !pendingSafe" @click="onAcceptAllSafe">Accept all safe</button>
          <p class="cpr-hint">Accepts only pending proposed changes. Conflicts always need your decision.</p>

          <div v-if="applied" class="cpr-success" role="status">
            <p class="cpr-success-title">{{ appliedMessage(applied.applied_count) }}</p>
            <p class="cpr-hint">Draft revision {{ applied.draft_revision }}. This proposal can no longer be applied. Nothing was published.</p>
            <NuxtLink :to="editorHref" class="cpr-link">Open Content editor</NuxtLink>
          </div>
          <template v-else>
            <button type="button" class="cpr-apply-btn" :disabled="readOnly || !availability.canApply" @click="apply">
              {{ applying ? 'Applying…' : 'Apply approved changes' }}
            </button>
            <p v-if="availability.reason && !applying" class="cpr-reason">{{ availability.reason }}</p>
            <p v-if="applyError" class="cpr-error" role="alert">{{ applyError }}</p>
          </template>
          <p class="cpr-hint cpr-draft-only">{{ CONTENT_AI_REVIEW_DRAFT_ONLY }}</p>
          <p class="cpr-hint">{{ CONTENT_AI_REVIEW_MEMORY_NOTE }}</p>
        </section>

        <section class="cpr-card" aria-labelledby="cpr-rules-title">
          <h2 id="cpr-rules-title" class="cpr-card-title">AI review rules</h2>
          <ol class="cpr-rules">
            <li>Nothing changes until you apply approved changes.</li>
            <li>Apply writes this language's draft only and never publishes.</li>
            <li>Only titles, summaries, SEO text and sections can be proposed — never the URL, status, media or relations.</li>
          </ol>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cpr { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.cpr-disclosure { margin: 0; font-size: var(--text-sm); color: var(--color-ink-muted); line-height: 1.55; max-width: 80ch; }
.cpr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-4); align-items: start; }
.cpr-main, .cpr-aside { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.cpr-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); min-width: 0; }
.cpr-card--conflicts { border-color: #E8C58A; }
.cpr-card-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.cpr-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cpr-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-2); line-height: 1.5; overflow-wrap: anywhere; }
.cpr-link { font-size: var(--text-sm); color: var(--color-primary); }
.cpr-facts { margin: 0 0 var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); }
.cpr-facts > div { display: flex; justify-content: space-between; gap: var(--space-3); min-width: 0; }
.cpr-facts dt { font-size: var(--text-xs); color: var(--color-ink-muted); flex-shrink: 0; }
.cpr-facts dd { margin: 0; font-size: var(--text-sm); color: var(--color-ink); text-align: right; overflow-wrap: anywhere; min-width: 0; }
.cpr-status { font-size: var(--text-xs); font-weight: 600; border-radius: 999px; padding: 1px var(--space-2); background: var(--color-surface-alt); border: 1px solid var(--color-line); }
.cpr-locales { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.cpr-locales-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); margin-right: var(--space-1); }
.cpr-locale { border: 1px solid var(--color-line); border-radius: 999px; background: var(--color-surface); color: var(--color-ink); cursor: pointer; font-size: var(--text-xs); padding: var(--space-1) var(--space-3); min-height: 32px; }
.cpr-locale--current { border-color: var(--color-primary); color: var(--color-primary-deep); font-weight: 600; background: rgba(47, 107, 58, 0.06); }
.cpr-locale-note { color: var(--color-ink-muted); font-weight: 400; }
.cpr-notice { margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }
.cpr-empty { text-align: left; }
.cpr-conflict-count { font-size: var(--text-xs); font-weight: 600; color: #8A5A00; background: #FFF4E0; border: 1px solid #F0D5A5; border-radius: 999px; padding: 1px var(--space-3); }
.cpr-chips { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
.cpr-chip { font-size: var(--text-xs); border: 1px solid var(--color-line); border-radius: 999px; padding: var(--space-1) var(--space-3); color: var(--color-ink); overflow-wrap: anywhere; max-width: 100%; }
.cpr-list { list-style: none; margin: var(--space-3) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.cpr-item, .cpr-conflict { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cpr-item--accepted, .cpr-item--edited, .cpr-conflict--chosen, .cpr-conflict--edited { border-color: var(--color-primary); background: rgba(47, 107, 58, 0.04); }
.cpr-item--rejected, .cpr-conflict--rejected { background: var(--color-surface-alt); }
.cpr-conflict--unresolved { border-left: 3px solid #D9A036; background: #FFFBF3; }
.cpr-item-head { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.cpr-target { margin: 0; font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin-right: auto; overflow-wrap: anywhere; }
.cpr-kind { font-size: 0.6875rem; font-weight: 600; border-radius: 999px; padding: 1px var(--space-2); background: #EEF2FA; border: 1px solid #D5DEEE; color: #34507A; }
.cpr-state { font-size: 0.6875rem; font-weight: 600; border-radius: 999px; padding: 1px var(--space-2); border: 1px solid var(--color-line); color: var(--color-ink-muted); background: var(--color-surface); }
.cpr-state--accepted, .cpr-state--edited, .cpr-state--chosen { background: #E3F3EC; border-color: #BFE3D2; color: #1E6B4E; }
.cpr-state--rejected { background: #F4F4F4; color: #6B6B6B; }
.cpr-state--unresolved { background: #FFF4E0; border-color: #F0D5A5; color: #8A5A00; }
.cpr-compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.cpr-col { min-width: 0; border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-3); background: var(--color-surface); }
.cpr-col--proposed { background: rgba(47, 107, 58, 0.05); border-color: #CFE3DB; }
.cpr-col-label { margin: 0 0 var(--space-1); font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted); padding: 0; }
.cpr-value { margin: 0 0 var(--space-1); font-size: var(--text-sm); color: var(--color-ink); white-space: pre-line; overflow-wrap: anywhere; }
.cpr-value--empty { color: var(--color-ink-muted); font-style: italic; }
.cpr-evidence { margin: 0; font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }
.cpr-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.cpr-btn { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); cursor: pointer; font-size: var(--text-sm); padding: var(--space-1) var(--space-4); }
.cpr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpr-btn[aria-pressed="true"] { font-weight: 600; }
.cpr-btn--accept[aria-pressed="true"], .cpr-btn--primary { background: var(--color-primary); border-color: var(--color-primary); color: white; }
.cpr-btn--reject[aria-pressed="true"] { background: #F4F4F4; border-color: #BDBDBD; }
.cpr-edit { display: flex; flex-direction: column; gap: var(--space-2); border-top: 1px dashed var(--color-line); padding-top: var(--space-3); min-width: 0; }
.cpr-edit-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); }
.cpr-edit input, .cpr-edit textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: var(--text-sm); border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2); min-height: 40px; }
.cpr-edit-entry { display: flex; flex-direction: column; gap: var(--space-1); border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2); }
.cpr-candidates { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cpr-candidate { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); min-height: 44px; box-sizing: border-box; overflow-wrap: anywhere; cursor: pointer; }
.cpr-candidate input { flex-shrink: 0; margin-top: 3px; }
.cpr-resolved { margin: 0; font-size: var(--text-sm); color: #1E6B4E; overflow-wrap: anywhere; }
.cpr-error { margin: 0; font-size: var(--text-sm); color: #C0392B; background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); overflow-wrap: anywhere; }
.cpr-stats { margin: 0 0 var(--space-3); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); text-align: center; }
.cpr-stats dt { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cpr-stats dd { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); }
.cpr-callout { margin: 0 0 var(--space-3); font-size: var(--text-sm); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
.cpr-callout--warn { background: #FFF4E0; border: 1px solid #F0D5A5; color: #8A5A00; }
.cpr-accept-all { width: 100%; margin-bottom: var(--space-1); }
.cpr-apply-btn { width: 100%; min-height: 44px; margin: var(--space-2) 0; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 600; cursor: pointer; padding: var(--space-2) var(--space-4); }
.cpr-apply-btn:disabled { opacity: 0.5; cursor: not-allowed; background: var(--color-surface-alt); color: var(--color-ink-muted); border-color: var(--color-line); }
.cpr-reason { margin: 0 0 var(--space-2); font-size: var(--text-xs); color: var(--color-ink-muted); }
.cpr-success { margin: var(--space-2) 0; padding: var(--space-3); border: 1px solid #BFE3D2; background: #E3F3EC; border-radius: var(--radius-sm); }
.cpr-success-title { margin: 0 0 var(--space-1); font-size: var(--text-sm); font-weight: 600; color: #1E6B4E; }
.cpr-draft-only { font-weight: 600; color: var(--color-ink); }
.cpr-rules { margin: 0; padding-left: var(--space-5); font-size: var(--text-sm); color: var(--color-ink); display: flex; flex-direction: column; gap: var(--space-2); }

@media (max-width: 1279px) {
  .cpr-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .cpr-card { padding: var(--space-4); }
  .cpr-compare { grid-template-columns: minmax(0, 1fr); }
  .cpr-actions .cpr-btn { flex: 1 1 auto; min-height: 44px; }
  .cpr-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
