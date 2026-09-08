<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'
import type { SpecificationProposal, SourceFileOutcome } from '~/utils/aiProposal'

type SpecGroupWithItems = ProductSpecGroup & { items: ProductSpecItem[] }

type ReviewMatchKind = 'none' | 'exact' | 'ambiguous'

interface ReviewRow {
  key: string
  group: string
  parameter: string
  value: string
  note: string
  status: 'pending' | 'accepted' | 'rejected'
  editing: boolean
  draftValue: string
  draftNote: string
  matchKind: ReviewMatchKind
  matchedSpecItemId: number | null
  matchedCurrentValue: string | null
  matchedGroupTitle: string | null
}

const props = defineProps<{
  productId: number
  proposal: SpecificationProposal
  fileResults: SourceFileOutcome[]
  existingSpecGroups: SpecGroupWithItems[]
  applying: boolean
  applyError: string | null
}>()

const emit = defineEmits<{
  applying: [boolean]
  'apply-error': [string | null]
  'apply-success': [string]
}>()

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Every existing item keyed by `group::parameter` (for a safe, unambiguous Update target)... */
const existingByGroupAndParam = computed(() => {
  const map = new Map<string, { specItemId: number, value: string, groupTitle: string }>()
  for (const group of props.existingSpecGroups) {
    for (const item of group.items ?? []) {
      if (!item.label_en) continue
      map.set(`${normalize(group.title_en ?? '')}::${normalize(item.label_en)}`, {
        specItemId: item.id,
        value: item.value_en ?? '',
        groupTitle: group.title_en ?? '',
      })
    }
  }
  return map
})

/** ...and, separately, how many existing items share a parameter name regardless of group — used only to flag "Review required", never to auto-pick an Update target. */
const existingNameOccurrences = computed(() => {
  const counts = new Map<string, Array<{ value: string, groupTitle: string }>>()
  for (const group of props.existingSpecGroups) {
    for (const item of group.items ?? []) {
      if (!item.label_en) continue
      const key = normalize(item.label_en)
      const list = counts.get(key) ?? []
      list.push({ value: item.value_en ?? '', groupTitle: group.title_en ?? '' })
      counts.set(key, list)
    }
  }
  return counts
})

/**
 * `proposal.groups` may contain more than one group object with the same
 * name (a model can return "Detection performance" twice) — merging by
 * normalized name here means the template renders each group heading and
 * every row exactly once, never duplicated.
 */
const mergedGroups = computed(() => {
  const order: string[] = []
  const itemsByKey = new Map<string, { displayName: string, items: Array<{ parameter: string, value: string, note?: string }> }>()
  for (const g of props.proposal.groups) {
    const key = normalize(g.group)
    if (!itemsByKey.has(key)) {
      itemsByKey.set(key, { displayName: g.group, items: [] })
      order.push(key)
    }
    itemsByKey.get(key)!.items.push(...g.items)
  }
  return order.map(key => itemsByKey.get(key)!)
})

const rows = ref<ReviewRow[]>(
  mergedGroups.value.flatMap((g, gi) =>
    g.items.map((it, ii) => {
      const exactKey = `${normalize(g.displayName)}::${normalize(it.parameter)}`
      const exact = existingByGroupAndParam.value.get(exactKey)
      const nameMatches = existingNameOccurrences.value.get(normalize(it.parameter)) ?? []

      let matchKind: ReviewMatchKind = 'none'
      let matchedSpecItemId: number | null = null
      let matchedCurrentValue: string | null = null
      let matchedGroupTitle: string | null = null

      if (exact) {
        matchKind = 'exact'
        matchedSpecItemId = exact.specItemId
        matchedCurrentValue = exact.value
        matchedGroupTitle = exact.groupTitle
      } else if (nameMatches.length > 0) {
        matchKind = 'ambiguous'
        matchedCurrentValue = nameMatches[0].value
        matchedGroupTitle = nameMatches.length === 1 ? nameMatches[0].groupTitle : `${nameMatches.length} other groups`
      }

      return {
        key: `${gi}-${ii}`,
        group: g.displayName,
        parameter: it.parameter,
        value: it.value,
        note: it.note ?? '',
        status: 'pending' as const,
        editing: false,
        draftValue: it.value,
        draftNote: it.note ?? '',
        matchKind,
        matchedSpecItemId,
        matchedCurrentValue,
        matchedGroupTitle,
      }
    }),
  ),
)

const unsupportedFiles = computed(() => props.fileResults.filter(f => f.status !== 'read'))
const readFiles = computed(() => props.fileResults.filter(f => f.status === 'read'))

const acceptedCount = computed(() => rows.value.filter((r: ReviewRow) => r.status === 'accepted').length)
// PWS-AI-ENGINE-01R2 — Apply is disabled: no real atomic transaction exists
// yet for this write path (see aiSpecificationApply.ts), so the button stays
// disabled regardless of how many rows are accepted. Review still works.
const canApply = computed(() => false)

function rowsForGroup(displayName: string): ReviewRow[] {
  return rows.value.filter((r: ReviewRow) => r.group === displayName)
}

function acceptRow(row: ReviewRow) { row.status = 'accepted' }
function rejectRow(row: ReviewRow) { row.status = 'rejected' }

function startEdit(row: ReviewRow) {
  row.draftValue = row.value
  row.draftNote = row.note
  row.editing = true
}
function cancelEdit(row: ReviewRow) { row.editing = false }
function saveEdit(row: ReviewRow) {
  row.value = row.draftValue.trim()
  row.note = row.draftNote.trim()
  row.editing = false
}

async function applyAccepted() {
  if (!canApply.value) return
  emit('applying', true)
  emit('apply-error', null)
  try {
    const changes = rows.value
      .filter((r: ReviewRow) => r.status === 'accepted')
      .map((r: ReviewRow) => r.matchedSpecItemId
        ? { action: 'update' as const, specItemId: r.matchedSpecItemId, value: r.value, note: r.note || undefined }
        : { action: 'add' as const, group: r.group, parameter: r.parameter, value: r.value, note: r.note || undefined },
      )
    const result = await $fetch<{ message: string }>(
      `/api/admin/products/${props.productId}/ai/specification-proposal/apply`,
      { method: 'POST', body: { changes } },
    )
    emit('apply-success', result.message)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    emit('apply-error', fe.data?.message ?? 'Could not apply these changes right now.')
  } finally {
    emit('applying', false)
  }
}
</script>

<template>
  <section class="ws-ai-review" aria-labelledby="ws-ai-review-heading">
    <p class="ws-scope-hint">
      Only the specification changes you explicitly accept below are ever written — and only when you click Apply accepted changes to Draft.
    </p>

    <ol class="ws-steps" aria-label="AI proposal workflow">
      <li class="ws-step"><span class="ws-step-index">1</span> Select sources</li>
      <li class="ws-step"><span class="ws-step-index">2</span> Analyze</li>
      <li class="ws-step ws-step--current"><span class="ws-step-index">3</span> Review proposals</li>
      <li class="ws-step"><span class="ws-step-index">4</span> Apply to Draft (temporarily unavailable)</li>
    </ol>

    <section v-if="unsupportedFiles.length > 0" class="ws-card ws-card--notice">
      <h3 class="ws-card-title">Some selected files were not analyzed</h3>
      <ul class="ws-file-result-list">
        <li v-for="(f, i) in unsupportedFiles" :key="i">{{ f.displayName }}: {{ f.reason }}</li>
      </ul>
    </section>

    <section class="ws-card" aria-labelledby="ws-ai-review-heading">
      <div class="ws-card-header">
        <h2 id="ws-ai-review-heading" class="ws-card-title">Specification proposals</h2>
        <span class="ws-accepted-count">{{ acceptedCount }} accepted</span>
      </div>
      <p class="ws-card-hint">
        Analyzed {{ readFiles.length }} source file{{ readFiles.length === 1 ? '' : 's' }}. Every item starts as Pending — nothing is accepted by default.
      </p>

      <div v-for="g in mergedGroups" :key="g.displayName" class="ws-group">
        <h3 class="ws-group-title">{{ g.displayName }}</h3>
        <div class="ws-table-wrap">
          <table class="ws-table">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Proposed value</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in rowsForGroup(g.displayName)" :key="row.key">
                <tr :class="{ 'ws-row--accepted': row.status === 'accepted', 'ws-row--rejected': row.status === 'rejected' }">
                  <td data-label="Parameter">
                    {{ row.parameter }}
                    <span v-if="row.matchKind !== 'none'" class="ws-review-required">Review required</span>
                  </td>
                  <td data-label="Proposed value">
                    <div v-if="!row.editing">
                      <div>{{ row.value }}</div>
                      <div v-if="row.note" class="ws-row-note">{{ row.note }}</div>
                      <div v-if="row.matchKind === 'exact'" class="ws-current-value">
                        Current value: {{ row.matchedCurrentValue || '—' }} ({{ row.matchedGroupTitle }})
                      </div>
                      <div v-else-if="row.matchKind === 'ambiguous'" class="ws-current-value ws-current-value--ambiguous">
                        A specification named "{{ row.parameter }}" already exists in {{ row.matchedGroupTitle }} — this will be added as a new item, not merged automatically.
                      </div>
                    </div>
                    <div v-else class="ws-edit-form">
                      <input v-model="row.draftValue" class="ws-form-input" placeholder="Value">
                      <input v-model="row.draftNote" class="ws-form-input" placeholder="Note (optional)">
                      <div class="ws-edit-actions">
                        <button type="button" class="btn btn-secondary" @click="saveEdit(row)">Save</button>
                        <button type="button" class="btn btn-secondary" @click="cancelEdit(row)">Cancel</button>
                      </div>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span class="ws-status-badge" :class="`ws-status-badge--${row.status}`">{{ row.status }}</span>
                  </td>
                  <td data-label="Action" class="ws-row-actions">
                    <template v-if="!row.editing">
                      <button type="button" class="ws-action-btn" @click="acceptRow(row)">
                        {{ row.matchKind === 'exact' ? 'Accept as Update' : 'Accept as Add' }}
                      </button>
                      <button type="button" class="ws-action-btn" @click="rejectRow(row)">Reject</button>
                      <button type="button" class="ws-action-btn" @click="startEdit(row)">Edit</button>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <div class="ws-apply-row">
        <button type="button" class="btn btn-primary btn-apply" disabled title="Apply is temporarily unavailable" @click="applyAccepted">
          Apply accepted changes to Draft
        </button>
        <p class="ws-apply-disabled-note">
          Apply is temporarily unavailable: a verified atomic database transaction for this write path does not exist yet, so no changes can be saved from this screen. Review and Generate are unaffected.
        </p>
        <p v-if="applyError" class="ws-apply-error" role="alert">{{ applyError }}</p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.ws-ai-review { display: flex; flex-direction: column; gap: var(--space-4); }

.ws-scope-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; line-height: 1.55; max-width: 72ch; }

.ws-steps { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.ws-step { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-ink-muted); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-line); border-radius: 999px; }
.ws-step-index { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--color-surface-alt); font-weight: 600; flex-shrink: 0; }
.ws-step--current { color: var(--color-primary-deep); font-weight: 600; border-color: var(--color-primary); background: rgba(15,92,75,0.06); }
.ws-step--current .ws-step-index { background: var(--color-primary); color: white; }

.ws-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); }
.ws-card--notice { border-color: #F5C6C2; background: #FDF0EE; }
.ws-card-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.ws-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.ws-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-4); }

.ws-accepted-count {
  font-size: var(--text-xs); font-weight: 600; color: var(--color-ink-muted);
  background: var(--color-surface-alt); border: 1px solid var(--color-line);
  border-radius: 999px; padding: var(--space-1) var(--space-3); white-space: nowrap;
}

.ws-group { margin-top: var(--space-4); }
.ws-group-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }

.ws-table-wrap { overflow-x: auto; }
.ws-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.ws-table th {
  text-align: left; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--color-ink-muted); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-line); white-space: nowrap;
}
.ws-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); color: var(--color-ink); vertical-align: top; }
.ws-table tr:last-child td { border-bottom: none; }

.ws-row--accepted { background: rgba(15,92,75,0.06); }
.ws-row--rejected { opacity: 0.55; }

.ws-review-required { display: block; font-size: 0.6875rem; font-weight: 600; color: #A23B3B; margin-top: 2px; }
.ws-row-note { font-size: var(--text-xs); color: var(--color-ink-muted); font-style: italic; }
.ws-current-value { font-size: var(--text-xs); color: var(--color-ink-muted); margin-top: var(--space-1); }
.ws-current-value--ambiguous { color: #A23B3B; }

.ws-status-badge { display: inline-block; font-size: var(--text-xs); font-weight: 500; border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); text-transform: capitalize; }
.ws-status-badge--pending { background: #FFF3CD; color: #856404; }
.ws-status-badge--accepted { background: #E3F3EC; color: #1E6B4E; }
.ws-status-badge--rejected { background: var(--color-surface-alt); color: var(--color-ink-muted); }

.ws-row-actions { white-space: nowrap; display: flex; flex-direction: column; gap: var(--space-1); }
.ws-action-btn {
  background: none; border: 1px solid var(--color-line); border-radius: var(--radius-sm);
  color: var(--color-ink); font-size: var(--text-xs); padding: var(--space-1) var(--space-2); cursor: pointer; text-align: left;
}
.ws-action-btn:hover { border-color: var(--color-primary); color: var(--color-primary-deep); }

.ws-edit-form { display: flex; flex-direction: column; gap: var(--space-2); }
.ws-form-input { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); font-size: var(--text-sm); width: 100%; box-sizing: border-box; }
.ws-edit-actions { display: flex; gap: var(--space-2); }

.ws-apply-row { margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-line); display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; min-height: 40px;
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm);
  font-weight: 500; cursor: pointer; border: 1px solid transparent;
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-deep); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); }
.btn-secondary:hover { background: var(--color-surface-alt); }
.btn-apply { font-weight: 600; }

.ws-apply-error { font-size: var(--text-sm); color: #C0392B; background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); margin: 0; }
.ws-apply-disabled-note { font-size: var(--text-xs); color: var(--color-ink-muted); max-width: 60ch; margin: 0; line-height: 1.5; }

.ws-file-result-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: var(--text-xs); color: var(--color-ink); }

/* ── ≤767px: stacked cards, never a horizontally scrolling grid substitute ── */
@media (max-width: 767px) {
  .ws-table-wrap { overflow-x: visible; }
  .ws-table, .ws-table thead, .ws-table tbody, .ws-table tr, .ws-table th, .ws-table td { display: block; }
  .ws-table thead { display: none; }
  .ws-table tr { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); }
  .ws-table tr:last-child { margin-bottom: 0; }
  .ws-table td { border-bottom: none; padding: var(--space-1) 0; }
  .ws-table td::before {
    content: attr(data-label); display: block; font-size: 0.625rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-ink-muted); margin-bottom: 2px;
  }
  .ws-steps { gap: var(--space-1); }
}
</style>
