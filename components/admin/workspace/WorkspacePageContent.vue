<script setup lang="ts">
import type { SectionType } from '~/types/product-cms'

interface EditableSection {
  id: number | null
  type: SectionType
  title_en: string
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
}

interface EditableFaq {
  id: number | null
  question_en: string
  answer_en: string
  source_note: string
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
}

defineProps<{
  sections: EditableSection[]
  faqs: EditableFaq[]
  sectionTypes: SectionType[]
}>()

const emit = defineEmits<{
  'add-section': [type: SectionType, titleEn: string]
  'remove-section': [index: number]
  'update-section-title': [{ index: number, value: string }]
  'update-section-type': [{ index: number, value: SectionType }]
  'toggle-section-enabled': [index: number]
  'add-faq': [questionEn: string, answerEn: string, sourceNote: string]
  'remove-faq': [index: number]
  'update-faq-field': [{ index: number, field: 'question_en' | 'answer_en' | 'source_note', value: string }]
  'toggle-faq-enabled': [index: number]
}>()

const SECTION_LABELS: Record<SectionType, string> = {
  text: 'Text',
  feature_list: 'Feature list',
  overview: 'Overview',
  image_text: 'Image + text',
  benefits: 'Benefits',
  applications: 'Applications',
  detection_targets: 'Detection targets',
  working_principle: 'Working principle',
  configuration_options: 'Configuration options',
  line_integration: 'Line integration',
  quotation_reminder: 'Quotation reminder',
  video: 'Video',
  case_studies: 'Case studies',
}

const showAddSection = ref(false)
const newSectionType = ref<SectionType>('overview')
const newSectionTitle = ref('')

function submitAddSection() {
  emit('add-section', newSectionType.value, newSectionTitle.value)
  newSectionType.value = 'overview'
  newSectionTitle.value = ''
  showAddSection.value = false
}

const showAddFaq = ref(false)
const newFaqQuestion = ref('')
const newFaqAnswer = ref('')
const newFaqNote = ref('')
const faqAddError = ref('')

function submitAddFaq() {
  if (!newFaqQuestion.value.trim() || !newFaqAnswer.value.trim()) {
    faqAddError.value = 'Question (EN) and Answer (EN) are both required.'
    return
  }
  faqAddError.value = ''
  emit('add-faq', newFaqQuestion.value, newFaqAnswer.value, newFaqNote.value)
  newFaqQuestion.value = ''
  newFaqAnswer.value = ''
  newFaqNote.value = ''
  showAddFaq.value = false
}
</script>

<template>
  <div class="ws-page-content">
    <section class="ws-card" aria-labelledby="ws-sections-heading">
      <div class="ws-card-header">
        <div>
          <h2 id="ws-sections-heading" class="ws-card-title">Page content modules</h2>
          <p class="ws-card-hint">Public product-page sections. Reuses the same module types and fields as the existing product editor.</p>
        </div>
        <button type="button" class="btn btn-secondary" @click="showAddSection = !showAddSection">
          {{ showAddSection ? 'Cancel' : '+ Add module' }}
        </button>
      </div>

      <div v-if="showAddSection" class="ws-add-form">
        <div class="ws-form-row">
          <div class="ws-form-group">
            <label class="ws-form-label" for="new-section-type">Module type</label>
            <select id="new-section-type" v-model="newSectionType" class="ws-form-select">
              <option v-for="t in sectionTypes" :key="t" :value="t">{{ SECTION_LABELS[t] ?? t }}</option>
            </select>
          </div>
          <div class="ws-form-group">
            <label class="ws-form-label" for="new-section-title">Title (EN)</label>
            <input id="new-section-title" v-model="newSectionTitle" type="text" class="ws-form-input" placeholder="Optional">
          </div>
        </div>
        <div class="ws-form-actions">
          <button type="button" class="btn btn-primary" @click="submitAddSection">Add module</button>
        </div>
      </div>

      <p v-if="sections.length === 0" class="ws-empty">No page content modules for this product yet.</p>

      <ul v-else class="ws-item-list" role="list">
        <li
          v-for="(section, index) in sections"
          :key="section.id ?? `new-${index}`"
          class="ws-item"
          :class="{ 'ws-item--pending-delete': section.markedForDeletion }"
        >
          <div class="ws-item-row">
            <select
              class="ws-form-select ws-item-type"
              :value="section.type"
              @change="emit('update-section-type', { index, value: ($event.target as HTMLSelectElement).value as SectionType })"
            >
              <option v-for="t in sectionTypes" :key="t" :value="t">{{ SECTION_LABELS[t] ?? t }}</option>
            </select>
            <input
              type="text"
              class="ws-form-input ws-item-title"
              placeholder="Title (EN)"
              :value="section.title_en"
              @input="emit('update-section-title', { index, value: ($event.target as HTMLInputElement).value })"
            >
            <label class="ws-item-toggle">
              <input type="checkbox" :checked="section.enabled" @change="emit('toggle-section-enabled', index)">
              Enabled
            </label>
            <button type="button" class="ws-item-remove" @click="emit('remove-section', index)">
              {{ section.markedForDeletion ? 'Undo remove' : 'Remove' }}
            </button>
          </div>
          <p v-if="section.isNew" class="ws-item-badge ws-item-badge--new">New — not saved yet</p>
          <p v-else-if="section.markedForDeletion" class="ws-item-badge ws-item-badge--delete">Will be removed on Save</p>
        </li>
      </ul>
    </section>

    <section class="ws-card" aria-labelledby="ws-faq-heading">
      <div class="ws-card-header">
        <div>
          <h2 id="ws-faq-heading" class="ws-card-title">FAQ</h2>
          <p class="ws-card-hint">Existing product FAQ entries.</p>
        </div>
        <button type="button" class="btn btn-secondary" @click="showAddFaq = !showAddFaq">
          {{ showAddFaq ? 'Cancel' : '+ Add FAQ' }}
        </button>
      </div>

      <div v-if="showAddFaq" class="ws-add-form">
        <p v-if="faqAddError" class="ws-form-error">{{ faqAddError }}</p>
        <div class="ws-form-group">
          <label class="ws-form-label" for="new-faq-question">Question (EN)</label>
          <input id="new-faq-question" v-model="newFaqQuestion" type="text" class="ws-form-input" placeholder="What is...?">
        </div>
        <div class="ws-form-group">
          <label class="ws-form-label" for="new-faq-answer">Answer (EN)</label>
          <textarea id="new-faq-answer" v-model="newFaqAnswer" class="ws-form-textarea" rows="3" placeholder="The answer is..." />
        </div>
        <div class="ws-form-group">
          <label class="ws-form-label" for="new-faq-note">Source note (internal)</label>
          <input id="new-faq-note" v-model="newFaqNote" type="text" class="ws-form-input" placeholder="e.g. product manual page 3">
        </div>
        <div class="ws-form-actions">
          <button type="button" class="btn btn-primary" @click="submitAddFaq">Add FAQ</button>
        </div>
      </div>

      <p v-if="faqs.length === 0" class="ws-empty">No FAQ entries for this product yet.</p>

      <ul v-else class="ws-item-list" role="list">
        <li
          v-for="(faq, index) in faqs"
          :key="faq.id ?? `new-${index}`"
          class="ws-item"
          :class="{ 'ws-item--pending-delete': faq.markedForDeletion }"
        >
          <div class="ws-form-group">
            <label class="ws-form-label">Question (EN)</label>
            <input
              type="text"
              class="ws-form-input"
              :value="faq.question_en"
              @input="emit('update-faq-field', { index, field: 'question_en', value: ($event.target as HTMLInputElement).value })"
            >
          </div>
          <div class="ws-form-group">
            <label class="ws-form-label">Answer (EN)</label>
            <textarea
              class="ws-form-textarea"
              rows="2"
              :value="faq.answer_en"
              @input="emit('update-faq-field', { index, field: 'answer_en', value: ($event.target as HTMLTextAreaElement).value })"
            />
          </div>
          <div class="ws-form-group">
            <label class="ws-form-label">Source note (internal)</label>
            <input
              type="text"
              class="ws-form-input"
              :value="faq.source_note"
              @input="emit('update-faq-field', { index, field: 'source_note', value: ($event.target as HTMLInputElement).value })"
            >
          </div>
          <div class="ws-item-row">
            <label class="ws-item-toggle">
              <input type="checkbox" :checked="faq.enabled" @change="emit('toggle-faq-enabled', index)">
              Enabled
            </label>
            <button type="button" class="ws-item-remove" @click="emit('remove-faq', index)">
              {{ faq.markedForDeletion ? 'Undo remove' : 'Remove' }}
            </button>
          </div>
          <p v-if="faq.isNew" class="ws-item-badge ws-item-badge--new">New — not saved yet</p>
          <p v-else-if="faq.markedForDeletion" class="ws-item-badge ws-item-badge--delete">Will be removed on Save</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ws-page-content { display: flex; flex-direction: column; gap: var(--space-5); }

.ws-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.ws-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.ws-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; max-width: 56ch; }

.ws-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-4) 0; }

.ws-add-form {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ws-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.ws-form-group { display: flex; flex-direction: column; gap: var(--space-1); }
.ws-form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted); }
.ws-form-select, .ws-form-input, .ws-form-textarea {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface);
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}
.ws-form-textarea { resize: vertical; }
.ws-form-actions { display: flex; justify-content: flex-end; }
.ws-form-error { color: #C0392B; font-size: var(--text-sm); margin: 0; }

.ws-item-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }

.ws-item {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ws-item--pending-delete { opacity: 0.55; border-style: dashed; }

.ws-item-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.ws-item-type { flex: 0 0 auto; width: auto; min-width: 160px; }
.ws-item-title { flex: 1; min-width: 160px; }

.ws-item-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.ws-item-remove {
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  white-space: nowrap;
}

.ws-item-badge { font-size: 0.6875rem; font-weight: 500; margin: 0; }
.ws-item-badge--new { color: #1E6B4E; }
.ws-item-badge--delete { color: #A23B3B; }

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

.btn-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.btn-secondary:hover { background: var(--color-surface-alt); }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: var(--color-primary-deep); }

/* ── ≤767px: stacked cards, full-width controls, no horizontal scroll ── */
@media (max-width: 767px) {
  .ws-form-row { grid-template-columns: 1fr; }
  .ws-item-row { flex-direction: column; align-items: stretch; }
  .ws-item-type, .ws-item-title { width: 100%; min-width: 0; }
  .ws-item-toggle, .ws-item-remove { align-self: flex-start; }
}
</style>
