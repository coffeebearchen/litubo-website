<script setup lang="ts">
import type { ProductMedia, ProductSpecGroup, ProductSpecItem, SourceReviewStatus } from '~/types/product-cms'
import type { EvidenceAuditEntry } from '~/server/api/admin/products/[id]/evidence/audit.get'
import { sourceReviewStatusLabel, sourceFileTypeLabel } from '~/utils/productWorkspace'

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

/** Mirrors the page's EditableEvidenceLink shape. */
interface EditableEvidenceLink {
  id: number | null
  spec_item_id: number
  spec_item_label: string
  spec_group_title: string
  sourceFileId: string | null
  source_name: string
  source_type: string | null
  review_status: SourceReviewStatus
  archived: boolean
  isNew: boolean
  markedForDeletion: boolean
  statusDirty: boolean
  originalReviewStatus: SourceReviewStatus | null
}

const REVIEW_STATUSES: SourceReviewStatus[] = ['needs_review', 'confirmed', 'conflict', 'missing']

const props = defineProps<{
  specGroups: SpecGroupWithItems[]
  linkedMedia: ProductMedia[]
  links: EditableEvidenceLink[]
  auditEntries: EvidenceAuditEntry[]
}>()

const emit = defineEmits<{
  'stage-link': [{ specItemId: number, sourceFileId: string }]
  'update-status': [{ index: number, status: SourceReviewStatus }]
  unstage: [index: number]
}>()

const selectedIndex = ref<number | null>(null)
const pickerOpen = ref(false)
const pickerSpecItemId = ref<number | null>(null)
const pickerSourceFileId = ref<string | null>(null)

const selectedItem = computed(() => selectedIndex.value !== null ? props.links[selectedIndex.value] ?? null : null)

const selectedAudit = computed(() => {
  if (!selectedItem.value?.id) return []
  return props.auditEntries.filter(a => a.evidence_link_id === selectedItem.value!.id)
})

function selectItem(index: number) {
  selectedIndex.value = selectedIndex.value === index ? null : index
}

function unlinkRow(index: number) {
  emit('unstage', index)
  if (selectedIndex.value === index) selectedIndex.value = null
}

function unlinkSelected() {
  if (selectedIndex.value === null) return
  unlinkRow(selectedIndex.value)
}

function removeButtonLabel(link: EditableEvidenceLink): string {
  if (link.isNew) return 'Discard'
  return link.markedForDeletion ? 'Undo removal' : 'Remove evidence'
}

function openPicker() {
  pickerSpecItemId.value = props.specGroups[0]?.items[0]?.id ?? null
  pickerSourceFileId.value = props.linkedMedia[0]?.directus_files_id ?? null
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function confirmPick() {
  if (pickerSpecItemId.value === null || !pickerSourceFileId.value) return
  emit('stage-link', { specItemId: pickerSpecItemId.value, sourceFileId: pickerSourceFileId.value })
  closePicker()
}

function sourceDisplayName(m: ProductMedia): string {
  return m.filename_download ?? m.directus_files_id?.slice(0, 8) ?? 'Untitled source'
}

function auditActionLabel(action: EvidenceAuditEntry['action']): string {
  if (action === 'linked') return 'Evidence linked'
  if (action === 'archived') return 'Evidence archived'
  if (action === 'status_changed') return 'Review status changed'
  return 'Updated'
}
</script>

<template>
  <section class="ws-evidence" aria-labelledby="ws-evidence-links-heading">
    <div class="ws-evidence-body">
      <div class="ws-evidence-main">
        <div class="ws-card-header">
          <div>
            <h2 id="ws-evidence-links-heading" class="ws-card-title">Specification evidence</h2>
            <p class="ws-card-hint">
              Link a specification parameter to a source already associated with this product, and record its
              verification status. Only this product's own parameters and already-linked media may be chosen.
            </p>
          </div>
          <button type="button" class="btn btn-primary" @click="openPicker">
            + Link evidence
          </button>
        </div>

        <p v-if="links.length === 0" class="ws-empty">No specification evidence linked for this product yet.</p>

        <div v-else class="ws-table-wrap">
          <table class="ws-table">
            <thead>
              <tr>
                <th scope="col">Specification</th>
                <th scope="col">Cited source</th>
                <th scope="col">Verification</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(link, index) in links"
                :key="link.id ?? `new-${index}`"
                class="ws-evidence-row"
                :class="{ 'ws-evidence-row--selected': selectedIndex === index, 'ws-evidence-row--pending-delete': link.markedForDeletion }"
                @click="selectItem(index)"
              >
                <td data-label="Specification" class="ws-spec-cell">
                  <span class="ws-spec-group">{{ link.spec_group_title }}</span>
                  <span class="ws-spec-label">{{ link.spec_item_label }}</span>
                </td>
                <td data-label="Cited source">{{ link.source_name }}</td>
                <td data-label="Verification">
                  <span v-if="link.isNew" class="ws-pending ws-pending--new">New — not saved yet</span>
                  <span v-else-if="link.markedForDeletion" class="ws-pending ws-pending--delete">Will be archived on Save</span>
                  <select
                    v-else
                    class="ws-status-select"
                    :class="`ws-status-select--${link.review_status}`"
                    :value="link.review_status"
                    @click.stop
                    @change="emit('update-status', { index, status: ($event.target as HTMLSelectElement).value as SourceReviewStatus })"
                  >
                    <option v-for="s in REVIEW_STATUSES" :key="s" :value="s">{{ sourceReviewStatusLabel(s) }}</option>
                  </select>
                  <span v-if="link.statusDirty" class="ws-pending ws-pending--new">Staged</span>
                </td>
                <td data-label="" class="ws-evidence-actions">
                  <button type="button" class="ws-remove-btn" @click.stop="unlinkRow(index)">
                    {{ removeButtonLabel(link) }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Right rail: selected evidence ────────────────────────────────── -->
      <aside class="ws-detail">
        <h3 class="ws-detail-title">Selected evidence</h3>

        <p v-if="!selectedItem" class="ws-detail-empty">Select a row above to see its details.</p>

        <div v-else class="ws-detail-body">
          <p class="ws-detail-spec">{{ selectedItem.spec_group_title }} / {{ selectedItem.spec_item_label }}</p>

          <dl class="ws-detail-facts">
            <dt>Source</dt>
            <dd>{{ selectedItem.source_name }}</dd>
            <dt>File type</dt>
            <dd>{{ sourceFileTypeLabel(selectedItem.source_type) }}</dd>
            <dt>Verification</dt>
            <dd>{{ sourceReviewStatusLabel(selectedItem.review_status) }}</dd>
          </dl>

          <p v-if="selectedItem.isNew" class="ws-pending ws-pending--new">New — not saved yet</p>
          <p v-else-if="selectedItem.markedForDeletion" class="ws-pending ws-pending--delete">Will be archived on Save</p>

          <button type="button" class="btn btn-secondary ws-detail-unlink" @click="unlinkSelected">
            {{ removeButtonLabel(selectedItem) }}
          </button>

          <div class="ws-audit">
            <p class="ws-audit-title">Evidence history</p>
            <p v-if="selectedItem.isNew" class="ws-audit-empty">History appears here after this evidence link is saved.</p>
            <p v-else-if="selectedAudit.length === 0" class="ws-audit-empty">No recorded activity yet.</p>
            <ul v-else class="ws-audit-list">
              <li v-for="entry in selectedAudit" :key="entry.id" class="ws-audit-entry">
                <span class="ws-audit-action">{{ auditActionLabel(entry.action) }}</span>
                <span v-if="entry.action === 'status_changed'" class="ws-audit-transition">
                  {{ sourceReviewStatusLabel(entry.from_status) }} → {{ sourceReviewStatusLabel(entry.to_status) }}
                </span>
                <span class="ws-audit-meta">{{ entry.actor }} · {{ entry.at ? entry.at.slice(0, 10) : '—' }}</span>
              </li>
            </ul>
          </div>

          <p class="ws-detail-lock">
            🔒 Original evidence file lives in Media Library. Changes here are staged until Save.
          </p>
        </div>
      </aside>
    </div>

    <!-- ── Evidence picker ───────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="ws-picker-overlay" @click.self="closePicker">
        <div class="ws-picker-modal" role="dialog" aria-modal="true" aria-label="Link specification evidence">
          <div class="ws-picker-header">
            <h3 class="ws-picker-title">Link specification evidence</h3>
            <button type="button" class="ws-picker-close" aria-label="Close" @click="closePicker">✕</button>
          </div>

          <div class="ws-picker-body">
            <p class="ws-picker-note">Staging a link only prepares it here — nothing is sent until you click Save changes.</p>

            <div class="ws-form-group">
              <label class="ws-form-label" for="ws-picker-spec">Specification parameter</label>
              <select id="ws-picker-spec" v-model.number="pickerSpecItemId" class="ws-form-input">
                <optgroup v-for="group in specGroups" :key="group.id" :label="group.title_en || 'Specifications'">
                  <option v-for="item in group.items" :key="item.id" :value="item.id">
                    {{ item.label_en || `Parameter ${item.id}` }}
                  </option>
                </optgroup>
              </select>
              <p v-if="specGroups.length === 0" class="ws-form-hint">
                This product has no specification parameters yet — add one in Specifications first.
              </p>
            </div>

            <div class="ws-form-group">
              <label class="ws-form-label" for="ws-picker-source">Source (already linked to this product)</label>
              <select id="ws-picker-source" v-model="pickerSourceFileId" class="ws-form-input">
                <option v-for="m in linkedMedia" :key="m.directus_files_id ?? m.id" :value="m.directus_files_id">
                  {{ sourceDisplayName(m) }} · {{ sourceFileTypeLabel(m.type ?? null) }}
                </option>
              </select>
              <p v-if="linkedMedia.length === 0" class="ws-form-hint">
                This product has no linked media yet — add one in Media & resources first.
              </p>
            </div>

            <div class="ws-picker-actions">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="pickerSpecItemId === null || !pickerSourceFileId"
                @click="confirmPick"
              >
                Stage evidence
              </button>
              <button type="button" class="btn btn-secondary" @click="closePicker">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.ws-evidence { margin-top: var(--space-5); }

.ws-evidence-body { display: flex; align-items: flex-start; gap: var(--space-5); }
.ws-evidence-main {
  flex: 1;
  min-width: 0;
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
.ws-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; max-width: 60ch; }

.ws-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-4) 0; }

.ws-table-wrap { overflow-x: auto; }
.ws-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.ws-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-line);
  white-space: nowrap;
}
.ws-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); color: var(--color-ink); vertical-align: middle; }
.ws-table tr:last-child td { border-bottom: none; }

.ws-evidence-row { cursor: pointer; }
.ws-evidence-row:hover { background: var(--color-surface-alt); }
.ws-evidence-row--selected { background: rgba(15,92,75,0.06); }
.ws-evidence-row--pending-delete { opacity: 0.6; }

.ws-spec-cell { display: flex; flex-direction: column; gap: 2px; }
.ws-spec-group { font-size: 0.6875rem; color: var(--color-ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.ws-spec-label { font-weight: 500; }

.ws-status-select {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  background: var(--color-surface);
  color: var(--color-ink);
}
.ws-status-select--confirmed { color: #1E6B4E; }
.ws-status-select--conflict, .ws-status-select--missing { color: #A23B3B; }
.ws-status-select--needs_review { color: #856404; }

.ws-pending { display: inline-block; font-size: 0.6875rem; font-weight: 500; margin-left: var(--space-2); }
.ws-pending--new { color: #1E6B4E; }
.ws-pending--delete { color: #A23B3B; }

.ws-evidence-actions { white-space: nowrap; }
.ws-remove-btn {
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
}
.ws-remove-btn:hover { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }

.ws-detail {
  width: 280px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
@media (min-width: 768px) {
  .ws-detail { position: sticky; top: var(--space-4); }
}
.ws-detail-title { font-size: var(--text-sm); font-weight: 700; color: var(--color-ink); margin: 0 0 var(--space-3); }
.ws-detail-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }
.ws-detail-spec { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }

.ws-detail-facts { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--space-2); margin: 0 0 var(--space-3); font-size: var(--text-xs); }
.ws-detail-facts dt { color: var(--color-ink-muted); white-space: nowrap; }
.ws-detail-facts dd { color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }

.ws-detail-unlink { width: 100%; margin: var(--space-2) 0; }

.ws-audit { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line); }
.ws-audit-title { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-ink-muted); margin: 0 0 var(--space-2); }
.ws-audit-empty { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.ws-audit-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.ws-audit-entry { display: flex; flex-direction: column; font-size: var(--text-xs); }
.ws-audit-action { font-weight: 600; color: var(--color-ink); }
.ws-audit-transition { color: var(--color-ink-muted); }
.ws-audit-meta { color: var(--color-ink-muted); font-size: 0.6875rem; }

.ws-detail-lock { font-size: 10px; color: var(--color-ink-muted); margin: var(--space-3) 0 0; line-height: 1.5; }

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
.btn-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.btn-secondary:hover { background: var(--color-surface-alt); }

/* ── Evidence picker modal ── */
.ws-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
}
@media (min-width: 768px) { .ws-picker-overlay { align-items: center; } }

.ws-picker-modal {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.ws-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-line);
  flex-shrink: 0;
}
.ws-picker-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-ink); margin: 0; }
.ws-picker-close {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: var(--color-ink-muted);
  border-radius: var(--radius-sm); font-size: var(--text-base);
}
.ws-picker-close:hover { background: var(--color-line); }

.ws-picker-body { flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
.ws-picker-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.ws-form-group { display: flex; flex-direction: column; gap: var(--space-1); }
.ws-form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted); }
.ws-form-input {
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
.ws-form-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.ws-picker-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }

/* ── ≤767px: stacked cards, no compressed desktop layouts ── */
@media (max-width: 767px) {
  .ws-evidence-body { flex-direction: column; }
  .ws-detail { width: 100%; }

  .ws-table-wrap { overflow-x: visible; }
  .ws-table, .ws-table thead, .ws-table tbody, .ws-table tr, .ws-table th, .ws-table td { display: block; }
  .ws-table thead { display: none; }
  .ws-table tr { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); }
  .ws-table tr:last-child { margin-bottom: 0; }
  .ws-table td { border-bottom: none; padding: var(--space-1) 0; }
  .ws-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin-bottom: 2px;
  }

  .ws-picker-modal { max-height: 92vh; }
  .ws-picker-body { padding: var(--space-3); }
}
</style>
