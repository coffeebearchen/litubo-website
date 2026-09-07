<script setup lang="ts">
interface EditableItem {
  id: number | null
  label_en: string
  value_en: string
  note_en: string
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
}

interface EditableGroup {
  id: number | null
  title_en: string
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
  items: EditableItem[]
}

defineProps<{
  groups: EditableGroup[]
}>()

const emit = defineEmits<{
  'add-group': [titleEn: string]
  'remove-group': [groupIndex: number]
  'update-group-title': [{ groupIndex: number, value: string }]
  'toggle-group-enabled': [groupIndex: number]
  'add-item': [{ groupIndex: number, labelEn: string, valueEn: string }]
  'remove-item': [{ groupIndex: number, itemIndex: number }]
  'update-item-field': [{ groupIndex: number, itemIndex: number, field: 'label_en' | 'value_en' | 'note_en', value: string }]
  'toggle-item-enabled': [{ groupIndex: number, itemIndex: number }]
}>()

const collapsed = ref<Set<number>>(new Set())

function isCollapsed(groupIndex: number): boolean {
  return collapsed.value.has(groupIndex)
}

function toggleCollapsed(groupIndex: number) {
  if (collapsed.value.has(groupIndex)) collapsed.value.delete(groupIndex)
  else collapsed.value.add(groupIndex)
}

const showAddGroup = ref(false)
const newGroupTitle = ref('')

function submitAddGroup() {
  if (!newGroupTitle.value.trim()) return
  emit('add-group', newGroupTitle.value)
  newGroupTitle.value = ''
  showAddGroup.value = false
}

const addItemForms = ref<Record<number, { label_en: string, value_en: string }>>({})

function addItemForm(groupIndex: number) {
  return (addItemForms.value[groupIndex] ??= { label_en: '', value_en: '' })
}

function submitAddItem(groupIndex: number) {
  const form = addItemForm(groupIndex)
  if (!form.label_en.trim()) return
  emit('add-item', { groupIndex, labelEn: form.label_en, valueEn: form.value_en })
  addItemForms.value[groupIndex] = { label_en: '', value_en: '' }
}
</script>

<template>
  <div class="ws-specs">
    <section class="ws-card" aria-labelledby="ws-specs-heading">
      <div class="ws-card-header">
        <div>
          <h2 id="ws-specs-heading" class="ws-card-title">Technical specifications</h2>
          <p class="ws-card-hint">Maintain approved, structured parameters for this product.</p>
        </div>
        <button type="button" class="btn btn-secondary" @click="showAddGroup = !showAddGroup">
          {{ showAddGroup ? 'Cancel' : '+ Add group' }}
        </button>
      </div>

      <div v-if="showAddGroup" class="ws-add-form">
        <div class="ws-form-group">
          <label class="ws-form-label" for="new-group-title">Group title (EN)</label>
          <input
            id="new-group-title"
            v-model="newGroupTitle"
            type="text"
            class="ws-form-input"
            placeholder="e.g. Detection performance"
            @keyup.enter="submitAddGroup"
          >
        </div>
        <div class="ws-form-actions">
          <button type="button" class="btn btn-primary" @click="submitAddGroup">Add group</button>
        </div>
      </div>

      <p v-if="groups.length === 0" class="ws-empty">No specification groups for this product yet.</p>

      <ul v-else class="ws-group-list" role="list">
        <li
          v-for="(group, groupIndex) in groups"
          :key="group.id ?? `new-group-${groupIndex}`"
          class="ws-group"
          :class="{ 'ws-group--pending-delete': group.markedForDeletion }"
        >
          <div class="ws-group-header">
            <button
              type="button"
              class="ws-group-toggle"
              :aria-expanded="!isCollapsed(groupIndex)"
              :aria-label="isCollapsed(groupIndex) ? 'Expand group' : 'Collapse group'"
              @click="toggleCollapsed(groupIndex)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: isCollapsed(groupIndex) ? 'rotate(-90deg)' : 'none' }">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <input
              type="text"
              class="ws-group-title-input"
              placeholder="Group title (EN)"
              :value="group.title_en"
              @input="emit('update-group-title', { groupIndex, value: ($event.target as HTMLInputElement).value })"
            >

            <span class="ws-group-count">{{ group.items.length }} {{ group.items.length === 1 ? 'parameter' : 'parameters' }}</span>

            <div class="ws-item-controls">
              <label class="ws-toggle" :title="group.enabled ? 'Enabled — visible on the public page' : 'Not enabled — hidden from the public page'">
                <input type="checkbox" :checked="group.enabled" @change="emit('toggle-group-enabled', groupIndex)">
                <span class="ws-toggle-track"><span class="ws-toggle-thumb" /></span>
                <span class="ws-toggle-label">{{ group.enabled ? 'Enabled' : 'Disabled' }}</span>
              </label>
              <button
                type="button"
                class="ws-item-remove"
                :class="{ 'ws-item-remove--undo': group.markedForDeletion }"
                :title="group.markedForDeletion ? 'Undo remove' : 'Remove this group and its parameters'"
                @click="emit('remove-group', groupIndex)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <template v-if="group.markedForDeletion">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </template>
                  <template v-else>
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z" />
                  </template>
                </svg>
              </button>
            </div>
          </div>

          <p v-if="group.isNew" class="ws-item-badge ws-item-badge--new">New — not saved yet</p>
          <p v-else-if="group.markedForDeletion" class="ws-item-badge ws-item-badge--delete">Group and all its parameters will be removed on Save</p>

          <div v-if="!isCollapsed(groupIndex) && !group.markedForDeletion" class="ws-group-body">
            <p v-if="group.items.length === 0" class="ws-empty ws-empty--tight">No parameters in this group yet.</p>

            <div v-else class="ws-params-table-wrap">
              <table class="ws-params-table">
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Value</th>
                    <th scope="col">Note</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, itemIndex) in group.items"
                    :key="item.id ?? `new-item-${itemIndex}`"
                    :class="{ 'ws-row--pending-delete': item.markedForDeletion }"
                  >
                    <td data-label="Parameter">
                      <input
                        type="text"
                        class="ws-cell-input"
                        placeholder="Parameter name"
                        :value="item.label_en"
                        @input="emit('update-item-field', { groupIndex, itemIndex, field: 'label_en', value: ($event.target as HTMLInputElement).value })"
                      >
                    </td>
                    <td data-label="Value">
                      <input
                        type="text"
                        class="ws-cell-input"
                        placeholder="e.g. 0.8 mm, IP65, AC 220V"
                        :value="item.value_en"
                        @input="emit('update-item-field', { groupIndex, itemIndex, field: 'value_en', value: ($event.target as HTMLInputElement).value })"
                      >
                    </td>
                    <td data-label="Note">
                      <input
                        type="text"
                        class="ws-cell-input"
                        placeholder="Optional"
                        :value="item.note_en"
                        @input="emit('update-item-field', { groupIndex, itemIndex, field: 'note_en', value: ($event.target as HTMLInputElement).value })"
                      >
                    </td>
                    <td data-label="" class="ws-cell-controls">
                      <label class="ws-toggle ws-toggle--compact" :title="item.enabled ? 'Enabled' : 'Disabled'">
                        <input type="checkbox" :checked="item.enabled" @change="emit('toggle-item-enabled', { groupIndex, itemIndex })">
                        <span class="ws-toggle-track"><span class="ws-toggle-thumb" /></span>
                      </label>
                      <button
                        type="button"
                        class="ws-item-remove"
                        :class="{ 'ws-item-remove--undo': item.markedForDeletion }"
                        :title="item.markedForDeletion ? 'Undo remove' : 'Remove this parameter'"
                        @click="emit('remove-item', { groupIndex, itemIndex })"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <template v-if="item.markedForDeletion">
                            <path d="M3 12a9 9 0 1 0 3-6.7" />
                            <path d="M3 4v5h5" />
                          </template>
                          <template v-else>
                            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z" />
                          </template>
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="ws-add-item-row">
              <input
                v-model="addItemForm(groupIndex).label_en"
                type="text"
                class="ws-form-input"
                placeholder="Parameter name"
                @keyup.enter="submitAddItem(groupIndex)"
              >
              <input
                v-model="addItemForm(groupIndex).value_en"
                type="text"
                class="ws-form-input"
                placeholder="Value (optional)"
                @keyup.enter="submitAddItem(groupIndex)"
              >
              <button type="button" class="btn btn-secondary ws-add-item-btn" @click="submitAddItem(groupIndex)">+ Add parameter</button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section class="ws-card" aria-labelledby="ws-readiness-heading">
      <h2 id="ws-readiness-heading" class="ws-card-title">Readiness</h2>
      <p class="ws-card-hint">Content readiness for publishing.</p>
      <p class="ws-readiness-value">Not assessed — rule not configured</p>
    </section>
  </div>
</template>

<style scoped>
.ws-specs { display: flex; flex-direction: column; gap: var(--space-5); }

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
.ws-empty--tight { padding: var(--space-3) 0; }

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
.ws-form-actions { display: flex; justify-content: flex-end; }

.ws-group-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }

.ws-group {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ws-group--pending-delete { opacity: 0.6; border-style: dashed; }

.ws-group-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-alt);
  flex-wrap: wrap;
}

.ws-group-toggle {
  background: none;
  border: none;
  color: var(--color-ink-muted);
  cursor: pointer;
  display: inline-flex;
  padding: var(--space-1);
  flex-shrink: 0;
}

.ws-group-toggle svg { transition: transform var(--transition-fast, 0.15s); }

.ws-group-title-input {
  flex: 1;
  min-width: 160px;
  border: 1px solid transparent;
  background: transparent;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  padding: var(--space-1) 0;
  font-family: inherit;
}

.ws-group-title-input:hover, .ws-group-title-input:focus { border-bottom-color: var(--color-line); outline: none; }

.ws-group-count { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; flex-shrink: 0; }

.ws-item-controls { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }

.ws-toggle { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }
.ws-toggle input { position: absolute; opacity: 0; width: 1px; height: 1px; }

.ws-toggle-track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--color-line);
  flex-shrink: 0;
  transition: background var(--transition-fast, 0.15s);
}

.ws-toggle--compact .ws-toggle-track { width: 28px; height: 16px; }

.ws-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform var(--transition-fast, 0.15s);
}

.ws-toggle--compact .ws-toggle-thumb { width: 12px; height: 12px; top: 2px; left: 2px; }

.ws-toggle input:checked + .ws-toggle-track { background: var(--color-primary); }
.ws-toggle input:checked + .ws-toggle-track .ws-toggle-thumb { transform: translateX(14px); }
.ws-toggle--compact input:checked + .ws-toggle-track .ws-toggle-thumb { transform: translateX(12px); }
.ws-toggle input:focus-visible + .ws-toggle-track { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.ws-toggle-label { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; min-width: 3.5em; }

.ws-item-remove {
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: var(--color-ink-muted);
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.ws-item-remove:hover { border-color: #C0392B; color: #C0392B; background: #FDF0EE; }
.ws-item-remove--undo:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-surface-alt); }

.ws-item-badge {
  font-size: 0.6875rem;
  font-weight: 500;
  margin: 0;
  padding: 0 var(--space-4) var(--space-2);
}
.ws-item-badge--new { color: #1E6B4E; }
.ws-item-badge--delete { color: #A23B3B; }

.ws-group-body { padding: var(--space-4); border-top: 1px solid var(--color-line); }

.ws-params-table-wrap { overflow-x: auto; margin-bottom: var(--space-3); }

.ws-params-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }

.ws-params-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-1) var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--color-line);
  white-space: nowrap;
}

.ws-params-table td {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--color-line);
  vertical-align: middle;
}

.ws-params-table tr:last-child td { border-bottom: none; }
.ws-row--pending-delete { opacity: 0.55; }

.ws-cell-input {
  width: 100%;
  min-width: 120px;
  border: 1px solid transparent;
  background: transparent;
  font-size: var(--text-sm);
  color: var(--color-ink);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  box-sizing: border-box;
  font-family: inherit;
}

.ws-cell-input:hover, .ws-cell-input:focus { border-color: var(--color-line); outline: none; }

.ws-cell-controls { display: flex; align-items: center; gap: var(--space-2); white-space: nowrap; }

.ws-add-item-row { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
.ws-add-item-row .ws-form-input { flex: 1; min-width: 140px; }
.ws-add-item-btn { flex-shrink: 0; white-space: nowrap; }

.ws-readiness-value {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 500;
  color: #856404;
  background: #FFF3CD;
  border: 1px solid #F0E0A0;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

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

/* ── ≤767px: stacked cards, no horizontal table scroll, everything reachable ── */
@media (max-width: 767px) {
  .ws-group-header { flex-direction: column; align-items: stretch; }
  .ws-group-title-input { width: 100%; }
  .ws-item-controls { width: 100%; justify-content: space-between; }

  .ws-params-table-wrap { overflow-x: visible; }
  .ws-params-table, .ws-params-table thead, .ws-params-table tbody, .ws-params-table tr, .ws-params-table th, .ws-params-table td {
    display: block;
  }
  .ws-params-table thead { display: none; }
  .ws-params-table tr {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .ws-params-table tr:last-child { margin-bottom: 0; }
  .ws-params-table td { border-bottom: none; padding: var(--space-1) var(--space-2); }
  .ws-params-table td[data-label]:not([data-label=""])::before {
    content: attr(data-label);
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin-bottom: 2px;
  }
  .ws-cell-controls { justify-content: flex-start; padding-top: var(--space-1); }

  .ws-add-item-row { flex-direction: column; align-items: stretch; }
  .ws-add-item-btn { width: 100%; }
}
</style>
