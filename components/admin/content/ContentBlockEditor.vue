<script setup lang="ts">
import { computed } from 'vue'
import { BLOCK_TEXT_LIMITS as L, type ContentBlock } from '~/utils/contentBlocks'
import { CONTENT_BLOCK_LABELS } from '~/utils/contentCenter'
import { blockPreviewText, isBlockEmpty, isEditorBlockType, moveListEntry, removeListEntry } from '~/utils/contentEditor'

/**
 * CC-IMP-03 — one structured section in the Content Editor.
 * Emits a whole new block on every change (never mutates the prop). Text, key
 * points, FAQ and CTA are edited here as plain text fields; image, related
 * content and downloads are managed in Media & relations and are only shown,
 * moved and kept exactly as they are.
 */
const props = defineProps<{
  block: ContentBlock
  position: number
  total: number
  expanded: boolean
  errors: string[]
  confirmingRemove: boolean
  disabled: boolean
}>()

type BlockData = Record<string, unknown>

const emit = defineEmits<{
  /**
   * An updater applied by the editor to the *latest* block data. Emitting a
   * finished block built from this component's prop would lose an earlier
   * change when two edits happen before the prop re-renders.
   */
  'update': [updater: (data: BlockData) => BlockData]
  'move': [delta: number]
  'toggle': []
  'request-remove': []
  'confirm-remove': []
  'cancel-remove': []
}>()

const typeLabel = computed(() => CONTENT_BLOCK_LABELS[props.block.type] ?? props.block.type)
const editable = computed(() => isEditorBlockType(props.block.type))
const preview = computed(() => blockPreviewText(props.block))
const empty = computed(() => isBlockEmpty(props.block))
const uid = computed(() => `ccb-${props.block.id}`)
const data = computed(() => props.block.data ?? {})

type Item = Record<string, string | undefined>

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function valueOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function listOf<T>(source: BlockData, key: string): T[] {
  const value = source[key]
  return Array.isArray(value) ? value as T[] : []
}

/** Rendering only; every change below is computed from the latest data inside the updater. */
function list<T>(key: string): T[] {
  return listOf<T>(data.value, key)
}

function setField(key: string, event: Event) {
  const value = valueOf(event)
  emit('update', d => ({ ...d, [key]: value }))
}

function setParagraph(index: number, event: Event) {
  const value = valueOf(event)
  emit('update', (d) => {
    const next = [...listOf<string>(d, 'paragraphs')]
    next[index] = value
    return { ...d, paragraphs: next }
  })
}

function setItemField(index: number, field: string, event: Event) {
  const value = valueOf(event)
  emit('update', d => ({ ...d, items: listOf<Item>(d, 'items').map((item, i) => (i === index ? { ...item, [field]: value } : item)) }))
}

function addEntry(key: string, entry: unknown) {
  emit('update', d => ({ ...d, [key]: [...listOf(d, key), entry] }))
}

function removeEntry(key: string, index: number) {
  emit('update', d => ({ ...d, [key]: removeListEntry(listOf(d, key), index) }))
}

function moveEntry(key: string, index: number, delta: number) {
  emit('update', d => ({ ...d, [key]: moveListEntry(listOf(d, key), index, delta) }))
}
</script>

<template>
  <section
    :id="uid"
    class="ccb"
    :class="{ 'ccb--error': errors.length > 0, 'ccb--managed': !editable }"
    :aria-labelledby="`${uid}-title`"
    tabindex="-1"
  >
    <header class="ccb-head">
      <span class="ccb-pos" aria-hidden="true">{{ position }}</span>
      <div class="ccb-titles">
        <h3 :id="`${uid}-title`" class="ccb-type">
          <span class="ccb-sr-only">Section {{ position }}: </span>{{ typeLabel }}
        </h3>
        <p class="ccb-preview">{{ preview || (editable ? 'No text yet' : 'Managed in Media & relations') }}</p>
      </div>
      <span v-if="!editable" class="ccb-chip">Media &amp; relations</span>
      <span v-else-if="empty" class="ccb-chip ccb-chip--muted">Empty</span>
      <div class="ccb-controls">
        <button
          type="button"
          class="btn-icon ccb-icon"
          :disabled="disabled || position === 1"
          :aria-label="`Move ${typeLabel} section ${position} up`"
          @click="emit('move', -1)"
        >↑</button>
        <button
          type="button"
          class="btn-icon ccb-icon"
          :disabled="disabled || position === total"
          :aria-label="`Move ${typeLabel} section ${position} down`"
          @click="emit('move', 1)"
        >↓</button>
        <button
          v-if="editable"
          type="button"
          class="ccb-btn"
          :aria-expanded="expanded"
          :aria-controls="`${uid}-body`"
          @click="emit('toggle')"
        >{{ expanded ? 'Done' : 'Edit' }}</button>
        <button
          v-if="editable"
          type="button"
          class="ccb-btn ccb-btn--danger"
          :disabled="disabled"
          @click="emit('request-remove')"
        >Remove</button>
      </div>
    </header>

    <div v-if="confirmingRemove" class="ccb-confirm" role="alert">
      <p>Remove this {{ typeLabel }} section? It is removed from the draft when you save.</p>
      <div class="ccb-confirm-actions">
        <button type="button" class="ccb-btn ccb-btn--danger" @click="emit('confirm-remove')">Remove section</button>
        <button type="button" class="ccb-btn" @click="emit('cancel-remove')">Cancel</button>
      </div>
    </div>

    <ul v-if="errors.length > 0" class="ccb-errors" role="alert">
      <li v-for="(message, i) in errors" :key="i">{{ message }}</li>
    </ul>

    <p v-if="!editable" class="ccb-managed-note">
      <template v-if="block.type === 'image'">Image file link #{{ data.fileLinkId }}<template v-if="text(data.caption)"> · {{ text(data.caption) }}</template>. </template>
      <template v-else-if="text(data.heading)">Heading: {{ text(data.heading) }}. </template>
      Managed in Media &amp; relations, which is not built yet. This section is kept exactly as it is when you save.
    </p>

    <div v-else-if="expanded" :id="`${uid}-body`" class="ccb-body">
      <div class="ccb-field">
        <label :for="`${uid}-heading`">Heading <span class="ccb-optional">(optional)</span></label>
        <input :id="`${uid}-heading`" type="text" :value="text(data.heading)" :maxlength="L.heading" @input="setField('heading', $event)">
      </div>

      <template v-if="block.type === 'text'">
        <div v-for="(paragraph, i) in list<string>('paragraphs')" :key="i" class="ccb-item">
          <div class="ccb-item-head">
            <label :for="`${uid}-p${i}`">Paragraph {{ i + 1 }}</label>
            <div class="ccb-item-controls">
              <button type="button" class="btn-icon ccb-icon" :disabled="i === 0" :aria-label="`Move paragraph ${i + 1} up`" @click="moveEntry('paragraphs', i, -1)">↑</button>
              <button type="button" class="btn-icon ccb-icon" :disabled="i === list('paragraphs').length - 1" :aria-label="`Move paragraph ${i + 1} down`" @click="moveEntry('paragraphs', i, 1)">↓</button>
              <button type="button" class="ccb-link" :disabled="list('paragraphs').length <= 1" @click="removeEntry('paragraphs', i)">Remove</button>
            </div>
          </div>
          <textarea :id="`${uid}-p${i}`" rows="4" :value="paragraph" :maxlength="L.paragraph" @input="setParagraph(i, $event)" />
        </div>
        <button type="button" class="ccb-add" :disabled="list('paragraphs').length >= L.paragraphsMax" @click="addEntry('paragraphs', '')">+ Add paragraph</button>
      </template>

      <template v-else-if="block.type === 'key_points'">
        <div v-for="(item, i) in list<Item>('items')" :key="i" class="ccb-item">
          <div class="ccb-item-head">
            <span class="ccb-item-title">Point {{ i + 1 }}</span>
            <div class="ccb-item-controls">
              <button type="button" class="btn-icon ccb-icon" :disabled="i === 0" :aria-label="`Move point ${i + 1} up`" @click="moveEntry('items', i, -1)">↑</button>
              <button type="button" class="btn-icon ccb-icon" :disabled="i === list('items').length - 1" :aria-label="`Move point ${i + 1} down`" @click="moveEntry('items', i, 1)">↓</button>
              <button type="button" class="ccb-link" :disabled="list('items').length <= 1" @click="removeEntry('items', i)">Remove</button>
            </div>
          </div>
          <label :for="`${uid}-kp${i}-title`">Title</label>
          <input :id="`${uid}-kp${i}-title`" type="text" :value="text(item.title)" :maxlength="L.keyPointTitle" @input="setItemField(i, 'title', $event)">
          <label :for="`${uid}-kp${i}-body`">Description <span class="ccb-optional">(optional)</span></label>
          <textarea :id="`${uid}-kp${i}-body`" rows="2" :value="text(item.body)" :maxlength="L.keyPointBody" @input="setItemField(i, 'body', $event)" />
        </div>
        <button type="button" class="ccb-add" :disabled="list('items').length >= L.keyPointsMax" @click="addEntry('items', { title: '' })">+ Add point</button>
      </template>

      <template v-else-if="block.type === 'faq'">
        <div v-for="(item, i) in list<Item>('items')" :key="i" class="ccb-item">
          <div class="ccb-item-head">
            <span class="ccb-item-title">Question {{ i + 1 }}</span>
            <div class="ccb-item-controls">
              <button type="button" class="btn-icon ccb-icon" :disabled="i === 0" :aria-label="`Move question ${i + 1} up`" @click="moveEntry('items', i, -1)">↑</button>
              <button type="button" class="btn-icon ccb-icon" :disabled="i === list('items').length - 1" :aria-label="`Move question ${i + 1} down`" @click="moveEntry('items', i, 1)">↓</button>
              <button type="button" class="ccb-link" :disabled="list('items').length <= 1" @click="removeEntry('items', i)">Remove</button>
            </div>
          </div>
          <label :for="`${uid}-faq${i}-q`">Question</label>
          <input :id="`${uid}-faq${i}-q`" type="text" :value="text(item.question)" :maxlength="L.faqQuestion" @input="setItemField(i, 'question', $event)">
          <label :for="`${uid}-faq${i}-a`">Answer</label>
          <textarea :id="`${uid}-faq${i}-a`" rows="3" :value="text(item.answer)" :maxlength="L.faqAnswer" @input="setItemField(i, 'answer', $event)" />
        </div>
        <button type="button" class="ccb-add" :disabled="list('items').length >= L.faqItemsMax" @click="addEntry('items', { question: '', answer: '' })">+ Add question</button>
      </template>

      <template v-else-if="block.type === 'cta'">
        <div class="ccb-field">
          <label :for="`${uid}-cta-body`">Text <span class="ccb-optional">(optional)</span></label>
          <textarea :id="`${uid}-cta-body`" rows="2" :value="text(data.body)" :maxlength="L.ctaBody" @input="setField('body', $event)" />
        </div>
        <div class="ccb-field">
          <label :for="`${uid}-cta-label`">Button label</label>
          <input :id="`${uid}-cta-label`" type="text" :value="text(data.label)" :maxlength="L.ctaLabel" @input="setField('label', $event)">
        </div>
        <div class="ccb-field">
          <label :for="`${uid}-cta-href`">Link</label>
          <input :id="`${uid}-cta-href`" type="text" spellcheck="false" :value="text(data.href)" :maxlength="L.ctaHref" :aria-describedby="`${uid}-cta-href-hint`" @input="setField('href', $event)">
          <p :id="`${uid}-cta-href-hint`" class="ccb-hint">Leave empty, use a site path such as /contact, or an https:// link.</p>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.ccb {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  min-width: 0;
  scroll-margin-top: 72px;
}

.ccb--error { border-color: #C0392B; }
.ccb--managed { background: var(--color-surface-alt); }
.ccb:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.ccb-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  min-width: 0;
}

.ccb-pos {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-ink-muted);
  background: var(--color-surface);
}

.ccb-titles { flex: 1 1 180px; min-width: 0; }

.ccb-type {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.ccb-preview {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.ccb-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px var(--space-2);
  background: #E8EDE8;
  color: #4A5E58;
  white-space: nowrap;
}

.ccb-chip--muted { background: var(--color-surface-alt); color: var(--color-ink-muted); border: 1px solid var(--color-line); }

.ccb-controls,
.ccb-item-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ccb-icon {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.ccb-icon:disabled,
.ccb-btn:disabled,
.ccb-link:disabled,
.ccb-add:disabled { opacity: 0.45; cursor: not-allowed; }

.ccb-btn {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.ccb-btn--danger { color: #B03A2E; }

.ccb-confirm {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid #F5C6C2;
  background: #FDF0EE;
  border-radius: var(--radius-sm);
}

.ccb-confirm p { margin: 0 0 var(--space-2); font-size: var(--text-sm); color: var(--color-ink); }
.ccb-confirm-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.ccb-errors {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  background: #FDF0EE;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-xs);
  overflow-wrap: anywhere;
}

.ccb-managed-note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ccb-body {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.ccb-field,
.ccb-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.ccb-item {
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
}

.ccb-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ccb-item-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }

.ccb-body input,
.ccb-body textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
}

.ccb-body input:focus,
.ccb-body textarea:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }

.ccb-optional { font-weight: 400; color: var(--color-ink-muted); }
.ccb-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.ccb-link {
  background: none;
  border: none;
  color: #B03A2E;
  cursor: pointer;
  text-decoration: underline;
}

.ccb-add {
  align-self: flex-start;
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-primary);
  cursor: pointer;
}

.ccb-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 767px) {
  .ccb { padding: var(--space-3); }
  .ccb-controls { width: 100%; }
  .ccb-controls .ccb-btn { flex: 1 1 0; }
  .ccb-add { align-self: stretch; }
}
</style>
