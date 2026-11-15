<script setup lang="ts">
import type { ProductMedia, ProductSpecGroup, ProductSpecItem, SourceReviewStatus } from '~/types/product-cms'
import type { EvidenceLinkSummary } from '~/server/api/admin/products/[id]/evidence/index.get'
import { sourceReviewStatusLabel, sourceFileTypeLabel } from '~/utils/productWorkspace'

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

const REVIEW_STATUSES: SourceReviewStatus[] = ['needs_review', 'confirmed', 'conflict', 'missing']

const props = defineProps<{
  specGroups: SpecGroupWithItems[]
  linkedMedia: ProductMedia[]
  links: EvidenceLinkSummary[]
  pending: boolean
}>()

const emit = defineEmits<{
  'link-evidence': [{ specItemId: number, sourceFileId: string, reviewStatus: SourceReviewStatus }]
  'update-verification': [{ linkId: number, reviewStatus: SourceReviewStatus }]
  'remove-evidence': [linkId: number]
}>()

// ── Selected row (display-only — shows only safe evidence fields and verification) ──
const selectedId = ref<number | null>(null)
const selectedItem = computed(() => props.links.find(l => l.id === selectedId.value) ?? null)

function selectItem(id: number) {
  selectedId.value = selectedId.value === id ? null : id
}

// ── Remove requires an explicit, in-place confirmation before it writes ──────
const confirmingId = ref<number | null>(null)

function askRemove(id: number) {
  confirmingId.value = id
}

function cancelRemove() {
  confirmingId.value = null
}

function confirmRemove(id: number) {
  confirmingId.value = null
  emit('remove-evidence', id)
}

// ── Record verification: a draft dropdown that only writes on explicit click ──
const verifyDraftOpen = ref(false)
const verifyDraftStatus = ref<SourceReviewStatus>('needs_review')

function openVerifyDraft() {
  if (!selectedItem.value) return
  verifyDraftStatus.value = selectedItem.value.review_status ?? 'needs_review'
  verifyDraftOpen.value = true
}

function cancelVerifyDraft() {
  verifyDraftOpen.value = false
}

function confirmVerifyDraft() {
  if (!selectedItem.value) return
  emit('update-verification', { linkId: selectedItem.value.id, reviewStatus: verifyDraftStatus.value })
  verifyDraftOpen.value = false
}

watch(selectedId, () => { verifyDraftOpen.value = false })

// ── Link evidence picker — dropdowns never write; only the button does ──────
const pickerOpen = ref(false)
const pickerSpecItemId = ref<number | null>(null)
const pickerSourceFileId = ref<string | null>(null)
const pickerReviewStatus = ref<SourceReviewStatus>('needs_review')

function openPicker() {
  pickerSpecItemId.value = props.specGroups[0]?.items[0]?.id ?? null
  pickerSourceFileId.value = props.linkedMedia[0]?.directus_files_id ?? null
  pickerReviewStatus.value = 'needs_review'
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function confirmPick() {
  if (pickerSpecItemId.value === null || !pickerSourceFileId.value) return
  emit('link-evidence', {
    specItemId: pickerSpecItemId.value,
    sourceFileId: pickerSourceFileId.value,
    reviewStatus: pickerReviewStatus.value,
  })
  closePicker()
}

function sourceDisplayName(m: ProductMedia): string {
  return m.filename_download ?? m.directus_files_id?.slice(0, 8) ?? 'Untitled source'
}
</script>

<template>
  <section class="ws-evidence" aria-labelledby="ws-evidence-links-heading">
    <div class="ws-evidence-body">
      <div class="ws-evidence-main">
        <div class="ws-card-header">
          <h2 id="ws-evidence-links-heading" class="ws-card-title">Specification evidence</h2>
          <button type="button" class="btn btn-primary" :disabled="pending" @click="openPicker">
            + Link evidence
          </button>
        </div>

        <p v-if="links.length === 0" class="ws-empty">No specification evidence linked for this product yet.</p>

        <div v-else class="ws-table-wrap">
          <table class="ws-table">
            <thead>
              <tr>
                <th scope="col">Specification</th>
                <th scope="col">Source</th>
                <th scope="col">Verification</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="link in links"
                :key="link.id"
                class="ws-evidence-row"
                :class="{ 'ws-evidence-row--selected': selectedId === link.id }"
                @click="selectItem(link.id)"
              >
                <td data-label="Specification" class="ws-spec-cell">
                  <span class="ws-spec-group">{{ link.spec_group_title }}</span>
                  <span class="ws-spec-label">{{ link.spec_item_label }}</span>
                </td>
                <td data-label="Source">{{ link.source_name }}</td>
                <td data-label="Verification">
                  <span class="ws-status-badge" :class="`ws-status-badge--${link.review_status ?? 'needs_review'}`">
                    {{ sourceReviewStatusLabel(link.review_status) }}
                  </span>
                </td>
                <td data-label="Action" class="ws-evidence-actions">
                  <template v-if="confirmingId === link.id">
                    <button type="button" class="ws-remove-btn ws-remove-btn--danger" :disabled="pending" @click.stop="confirmRemove(link.id)">
                      Confirm remove
                    </button>
                    <button type="button" class="ws-remove-btn" @click.stop="cancelRemove">Cancel</button>
                  </template>
                  <button v-else type="button" class="ws-remove-btn" :disabled="pending" @click.stop="askRemove(link.id)">
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Right rail: selected evidence — safe metadata + Verification only ── -->
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

          <div v-if="verifyDraftOpen" class="ws-verify-draft">
            <select v-model="verifyDraftStatus" class="ws-form-input">
              <option v-for="s in REVIEW_STATUSES" :key="s" :value="s">{{ sourceReviewStatusLabel(s) }}</option>
            </select>
            <div class="ws-verify-draft-actions">
              <button type="button" class="btn btn-primary" :disabled="pending" @click="confirmVerifyDraft">Update</button>
              <button type="button" class="btn btn-secondary" @click="cancelVerifyDraft">Cancel</button>
            </div>
          </div>
          <button v-else type="button" class="btn btn-secondary ws-detail-action" @click="openVerifyDraft">
            Record verification
          </button>

          <template v-if="confirmingId === selectedItem.id">
            <button type="button" class="btn ws-btn-danger ws-detail-action" :disabled="pending" @click="confirmRemove(selectedItem.id)">
              Confirm remove
            </button>
            <button type="button" class="btn btn-secondary ws-detail-action" @click="cancelRemove">Cancel</button>
          </template>
          <button v-else type="button" class="btn btn-secondary ws-detail-action" :disabled="pending" @click="askRemove(selectedItem.id)">
            Remove evidence
          </button>

          <p class="ws-detail-lock">
            🔒 Original evidence file lives in Media Library.
          </p>
        </div>
      </aside>
    </div>

    <!-- ── Link evidence picker ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="ws-picker-overlay" @click.self="closePicker">
        <div class="ws-picker-modal" role="dialog" aria-modal="true" aria-label="Link specification evidence">
          <div class="ws-picker-header">
            <h3 class="ws-picker-title">Link specification evidence</h3>
            <button type="button" class="ws-picker-close" aria-label="Close" @click="closePicker">✕</button>
          </div>

          <div class="ws-picker-body">
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

            <div class="ws-form-group">
              <label class="ws-form-label" for="ws-picker-verification">Verification</label>
              <select id="ws-picker-verification" v-model="pickerReviewStatus" class="ws-form-input">
                <option v-for="s in REVIEW_STATUSES" :key="s" :value="s">{{ sourceReviewStatusLabel(s) }}</option>
              </select>
            </div>

            <div class="ws-picker-actions">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="pickerSpecItemId === null || !pickerSourceFileId || pending"
                @click="confirmPick"
              >
                Link evidence
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
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }

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
.ws-evidence-row--selected { background: rgba(47, 107, 58,0.06); }

.ws-spec-cell { display: flex; flex-direction: column; gap: 2px; }
.ws-spec-group { font-size: 0.6875rem; color: var(--color-ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.ws-spec-label { font-weight: 500; }

.ws-status-badge {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  white-space: nowrap;
}
.ws-status-badge--confirmed { background: #E3F3EC; color: #1E6B4E; }
.ws-status-badge--conflict, .ws-status-badge--missing { background: #FDEAEA; color: #A23B3B; }
.ws-status-badge--needs_review { background: #FFF3CD; color: #856404; }

.ws-evidence-actions { white-space: nowrap; display: flex; gap: var(--space-2); }
.ws-remove-btn {
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
}
.ws-remove-btn:hover:not(:disabled) { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }
.ws-remove-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ws-remove-btn--danger { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }

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

.ws-detail-action { width: 100%; margin: var(--space-2) 0 0; }

.ws-verify-draft { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); }
.ws-verify-draft-actions { display: flex; gap: var(--space-2); }
.ws-verify-draft-actions .btn { flex: 1; }

.ws-btn-danger { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }
.ws-btn-danger:hover:not(:disabled) { background: #F5C6C2; }

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
.btn-secondary:hover:not(:disabled) { background: var(--color-surface-alt); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Link evidence picker modal ── */
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
