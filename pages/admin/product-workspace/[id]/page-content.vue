<script setup lang="ts">
import type { AdminProduct, ProductFaq, ProductSection, SectionType } from '~/types/product-cms'
import { SECTION_TYPES } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

const [{ data: product, error: productError }, { data: sectionsData, refresh: refreshSections }, { data: faqData, refresh: refreshFaqs }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductSection[]>(`/api/admin/products/${id}/sections`),
  useFetch<ProductFaq[]>(`/api/admin/products/${id}/faq`),
])

const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

// ── Editable local copies. Nothing here writes until handleSave() runs. ─────

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

function toEditableSection(s: ProductSection): EditableSection {
  return {
    id: s.id,
    type: s.type,
    title_en: s.title_en ?? '',
    enabled: s.enabled,
    isNew: false,
    markedForDeletion: false,
  }
}

function toEditableFaq(f: ProductFaq): EditableFaq {
  return {
    id: f.id,
    question_en: f.question_en ?? '',
    answer_en: f.answer_en ?? '',
    source_note: f.source_note ?? '',
    enabled: f.enabled,
    isNew: false,
    markedForDeletion: false,
  }
}

const sections = ref<EditableSection[]>((sectionsData.value ?? []).map(toEditableSection))
const faqs = ref<EditableFaq[]>((faqData.value ?? []).map(toEditableFaq))

// Original snapshots — dirty is computed against these, never against the API directly.
// Keyed by id so Save only PATCHes rows that actually changed, never every row.
interface SectionSnapshot { type: SectionType, title_en: string, enabled: boolean }
interface FaqSnapshot { question_en: string, answer_en: string, source_note: string, enabled: boolean }

function sectionSnapshotMap(rows: EditableSection[]): Map<number | null, SectionSnapshot> {
  return new Map(rows.map(s => [s.id, { type: s.type, title_en: s.title_en, enabled: s.enabled }]))
}

function faqSnapshotMap(rows: EditableFaq[]): Map<number | null, FaqSnapshot> {
  return new Map(rows.map(f => [f.id, { question_en: f.question_en, answer_en: f.answer_en, source_note: f.source_note, enabled: f.enabled }]))
}

let originalSections = JSON.stringify(sections.value)
let originalFaqs = JSON.stringify(faqs.value)
let originalSectionsById = sectionSnapshotMap(sections.value)
let originalFaqsById = faqSnapshotMap(faqs.value)

function resyncSnapshots() {
  sections.value = (sectionsData.value ?? []).map(toEditableSection)
  faqs.value = (faqData.value ?? []).map(toEditableFaq)
  originalSections = JSON.stringify(sections.value)
  originalFaqs = JSON.stringify(faqs.value)
  originalSectionsById = sectionSnapshotMap(sections.value)
  originalFaqsById = faqSnapshotMap(faqs.value)
}

function sectionChanged(row: EditableSection): boolean {
  const original = originalSectionsById.get(row.id)
  if (!original) return true
  return original.type !== row.type || original.title_en !== row.title_en || original.enabled !== row.enabled
}

function faqChanged(row: EditableFaq): boolean {
  const original = originalFaqsById.get(row.id)
  if (!original) return true
  return original.question_en !== row.question_en || original.answer_en !== row.answer_en
    || original.source_note !== row.source_note || original.enabled !== row.enabled
}

const isDirty = computed(() => {
  return JSON.stringify(sections.value) !== originalSections
    || JSON.stringify(faqs.value) !== originalFaqs
})

type SaveState = 'idle' | 'dirty' | 'saving' | 'success' | 'error'
const saving = ref(false)
const saveError = ref('')
const justSaved = ref(false)

const saveState = computed<SaveState>(() => {
  if (saving.value) return 'saving'
  if (saveError.value) return 'error'
  if (justSaved.value) return 'success'
  return isDirty.value ? 'dirty' : 'idle'
})

watch(isDirty, (dirty: boolean) => {
  if (dirty) { justSaved.value = false; saveError.value = '' }
})

// ── Section mutations (local only) ───────────────────────────────────────────

function addSection(type: SectionType, titleEn: string) {
  sections.value.push({ id: null, type, title_en: titleEn, enabled: true, isNew: true, markedForDeletion: false })
}

function removeSection(index: number) {
  const row = sections.value[index]
  if (!row) return
  if (row.isNew) { sections.value.splice(index, 1); return }
  row.markedForDeletion = !row.markedForDeletion
}

function updateSectionTitle(index: number, value: string) {
  const row = sections.value[index]
  if (row) row.title_en = value
}

function updateSectionType(index: number, value: SectionType) {
  const row = sections.value[index]
  if (row) row.type = value
}

function toggleSectionEnabled(index: number) {
  const row = sections.value[index]
  if (row) row.enabled = !row.enabled
}

// ── FAQ mutations (local only) ────────────────────────────────────────────────

function addFaq(questionEn: string, answerEn: string, sourceNote: string) {
  faqs.value.push({ id: null, question_en: questionEn, answer_en: answerEn, source_note: sourceNote, enabled: true, isNew: true, markedForDeletion: false })
}

function removeFaq(index: number) {
  const row = faqs.value[index]
  if (!row) return
  if (row.isNew) { faqs.value.splice(index, 1); return }
  row.markedForDeletion = !row.markedForDeletion
}

function updateFaqField(index: number, field: 'question_en' | 'answer_en' | 'source_note', value: string) {
  const row = faqs.value[index]
  if (row) row[field] = value
}

function toggleFaqEnabled(index: number) {
  const row = faqs.value[index]
  if (row) row.enabled = !row.enabled
}

// ── Save: the only place that ever issues a write request ───────────────────

async function handleSave() {
  if (!isDirty.value || saving.value) return
  saving.value = true
  saveError.value = ''

  try {
    for (const row of sections.value) {
      if (row.isNew && row.markedForDeletion) continue
      if (row.isNew) {
        await $fetch(`/api/admin/products/${productId}/sections`, {
          method: 'POST',
          body: { type: row.type, title_en: row.title_en || null, enabled: row.enabled },
        })
      } else if (row.markedForDeletion) {
        await $fetch(`/api/admin/products/${productId}/sections/${row.id}`, { method: 'DELETE' })
      } else if (sectionChanged(row)) {
        await $fetch(`/api/admin/products/${productId}/sections/${row.id}`, {
          method: 'PATCH',
          body: { type: row.type, title_en: row.title_en || null, enabled: row.enabled },
        })
      }
    }

    for (const row of faqs.value) {
      if (row.isNew && row.markedForDeletion) continue
      if (row.isNew) {
        await $fetch(`/api/admin/products/${productId}/faq`, {
          method: 'POST',
          body: { question_en: row.question_en, answer_en: row.answer_en, source_note: row.source_note || null },
        })
      } else if (row.markedForDeletion) {
        await $fetch(`/api/admin/products/${productId}/faq/${row.id}`, { method: 'DELETE' })
      } else if (faqChanged(row)) {
        await $fetch(`/api/admin/products/${productId}/faq/${row.id}`, {
          method: 'PATCH',
          body: { question_en: row.question_en, answer_en: row.answer_en, source_note: row.source_note || null, enabled: row.enabled },
        })
      }
    }

    await Promise.all([refreshSections(), refreshFaqs()])
    resyncSnapshots()
    justSaved.value = true
    setTimeout(() => { justSaved.value = false }, 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    saveError.value = fe.data?.message ?? 'Save failed. Your unsaved changes are kept — try again.'
  } finally {
    saving.value = false
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
    :product="(product as AdminProduct)"
    :preview-href="previewHref"
    :save-state="saveState"
    @save="handleSave"
  >
    <template #nav>
      <WorkspaceModuleNav
        :product-id="(product as AdminProduct).id"
        :product-name="(product as AdminProduct).name_en"
        :product-code="(product as AdminProduct).product_code"
        active-key="page-content"
      />
    </template>

    <p v-if="saveError" class="ws-save-error" role="alert">{{ saveError }}</p>

    <WorkspacePageContent
      :sections="sections"
      :faqs="faqs"
      :section-types="SECTION_TYPES"
      @add-section="addSection"
      @remove-section="removeSection"
      @update-section-title="({ index, value }) => updateSectionTitle(index, value)"
      @update-section-type="({ index, value }) => updateSectionType(index, value)"
      @toggle-section-enabled="toggleSectionEnabled"
      @add-faq="addFaq"
      @remove-faq="removeFaq"
      @update-faq-field="({ index, field, value }) => updateFaqField(index, field, value)"
      @toggle-faq-enabled="toggleFaqEnabled"
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

.ws-save-error {
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}
</style>
