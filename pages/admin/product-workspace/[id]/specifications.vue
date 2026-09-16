<script setup lang="ts">
import type { AdminProduct, ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'
import { workspaceHeroUrl } from '~/utils/productWorkspace'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)
const productId = Number(id)

const [{ data: product, error: productError }, { data: specsData, refresh: refreshSpecs }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<(ProductSpecGroup & { items: ProductSpecItem[] })[]>(`/api/admin/products/${id}/specs`),
])

const notFound = computed(() => Boolean(productError.value) || !product.value)
const previewHref = computed(() => `/admin/products/${id}/preview`)

/**
 * FINAL-RELEASE-FIX-F (D-037) — only a Draft is editable. The server refuses a
 * write to any other status, so Save is taken away here rather than offered and
 * then refused.
 */
const isDraft = computed(() => (product.value?.status ?? 'draft') === 'draft')

// ── Editable local copies. Nothing here writes until handleSave() runs. ─────

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

function toEditableItem(i: ProductSpecItem): EditableItem {
  return {
    id: i.id,
    label_en: i.label_en ?? '',
    value_en: i.value_en ?? '',
    note_en: i.note_en ?? '',
    enabled: i.enabled,
    isNew: false,
    markedForDeletion: false,
  }
}

function toEditableGroup(g: ProductSpecGroup & { items: ProductSpecItem[] }): EditableGroup {
  return {
    id: g.id,
    title_en: g.title_en ?? '',
    enabled: g.enabled,
    isNew: false,
    markedForDeletion: false,
    items: (g.items ?? []).map(toEditableItem),
  }
}

const groups = ref<EditableGroup[]>((specsData.value ?? []).map(toEditableGroup))

// Original snapshots — dirty is computed against these, never against the API directly.
// Keyed by id so Save only writes rows that actually changed, never every row.
interface GroupSnapshot { title_en: string, enabled: boolean }
interface ItemSnapshot { label_en: string, value_en: string, note_en: string, enabled: boolean }

function groupSnapshotMap(rows: EditableGroup[]): Map<number | null, GroupSnapshot> {
  return new Map(rows.map(g => [g.id, { title_en: g.title_en, enabled: g.enabled }]))
}

function itemSnapshotMap(rows: EditableGroup[]): Map<number | null, ItemSnapshot> {
  const map = new Map<number | null, ItemSnapshot>()
  for (const g of rows) {
    for (const i of g.items) {
      map.set(i.id, { label_en: i.label_en, value_en: i.value_en, note_en: i.note_en, enabled: i.enabled })
    }
  }
  return map
}

let originalGroups = JSON.stringify(groups.value)
let originalGroupsById = groupSnapshotMap(groups.value)
let originalItemsById = itemSnapshotMap(groups.value)

function resyncSnapshots() {
  groups.value = (specsData.value ?? []).map(toEditableGroup)
  originalGroups = JSON.stringify(groups.value)
  originalGroupsById = groupSnapshotMap(groups.value)
  originalItemsById = itemSnapshotMap(groups.value)
}

function groupChanged(group: EditableGroup): boolean {
  const original = originalGroupsById.get(group.id)
  if (!original) return true
  return original.title_en !== group.title_en || original.enabled !== group.enabled
}

function itemChanged(item: EditableItem): boolean {
  const original = originalItemsById.get(item.id)
  if (!original) return true
  return original.label_en !== item.label_en || original.value_en !== item.value_en
    || original.note_en !== item.note_en || original.enabled !== item.enabled
}

const isDirty = computed(() => JSON.stringify(groups.value) !== originalGroups)

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

// ── Group mutations (local only) ─────────────────────────────────────────────

function addGroup(titleEn: string) {
  groups.value.push({ id: null, title_en: titleEn, enabled: true, isNew: true, markedForDeletion: false, items: [] })
}

function removeGroup(groupIndex: number) {
  const group = groups.value[groupIndex]
  if (!group) return
  if (group.isNew) { groups.value.splice(groupIndex, 1); return }
  group.markedForDeletion = !group.markedForDeletion
}

function updateGroupTitle(groupIndex: number, value: string) {
  const group = groups.value[groupIndex]
  if (group) group.title_en = value
}

function toggleGroupEnabled(groupIndex: number) {
  const group = groups.value[groupIndex]
  if (group) group.enabled = !group.enabled
}

// ── Item mutations (local only) ──────────────────────────────────────────────

function addItem(groupIndex: number, labelEn: string, valueEn: string) {
  const group = groups.value[groupIndex]
  if (!group) return
  group.items.push({ id: null, label_en: labelEn, value_en: valueEn, note_en: '', enabled: true, isNew: true, markedForDeletion: false })
}

function removeItem(groupIndex: number, itemIndex: number) {
  const group = groups.value[groupIndex]
  if (!group) return
  const item = group.items[itemIndex]
  if (!item) return
  if (item.isNew) { group.items.splice(itemIndex, 1); return }
  item.markedForDeletion = !item.markedForDeletion
}

function updateItemField(groupIndex: number, itemIndex: number, field: 'label_en' | 'value_en' | 'note_en', value: string) {
  const item = groups.value[groupIndex]?.items[itemIndex]
  if (item) item[field] = value
}

function toggleItemEnabled(groupIndex: number, itemIndex: number) {
  const item = groups.value[groupIndex]?.items[itemIndex]
  if (item) item.enabled = !item.enabled
}

// ── Save: the only place that ever issues a write request ───────────────────

async function handleSave() {
  if (!isDraft.value || !isDirty.value || saving.value) return
  saving.value = true
  saveError.value = ''

  try {
    for (const group of groups.value) {
      if (group.isNew && group.markedForDeletion) continue

      let resolvedGroupId: number
      if (group.isNew) {
        const created = await $fetch<{ id: number }>(`/api/admin/products/${productId}/specs`, {
          method: 'POST',
          body: { title_en: group.title_en, enabled: group.enabled },
        })
        resolvedGroupId = created.id
      } else if (group.markedForDeletion) {
        // CASCADE-deletes its items server-side (product_spec_items → product_spec_groups).
        await $fetch(`/api/admin/products/${productId}/specs/${group.id}`, { method: 'DELETE' })
        continue
      } else {
        resolvedGroupId = group.id as number
        if (groupChanged(group)) {
          await $fetch(`/api/admin/products/${productId}/specs/${group.id}`, {
            method: 'PATCH',
            body: { title_en: group.title_en, enabled: group.enabled },
          })
        }
      }

      for (const item of group.items) {
        if (item.isNew && item.markedForDeletion) continue
        if (item.isNew) {
          await $fetch(`/api/admin/products/${productId}/specs/${resolvedGroupId}/items`, {
            method: 'POST',
            body: { label_en: item.label_en || null, value_en: item.value_en || null, note_en: item.note_en || null },
          })
        } else if (item.markedForDeletion) {
          await $fetch(`/api/admin/products/${productId}/specs/${resolvedGroupId}/items/${item.id}`, { method: 'DELETE' })
        } else if (itemChanged(item)) {
          await $fetch(`/api/admin/products/${productId}/specs/${resolvedGroupId}/items/${item.id}`, {
            method: 'PATCH',
            body: { label_en: item.label_en || null, value_en: item.value_en || null, note_en: item.note_en || null, enabled: item.enabled },
          })
        }
      }
    }

    await refreshSpecs()
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
    title="Specifications"
    :preview-href="previewHref"
    :save-state="isDraft ? saveState : 'unavailable'"
    @save="handleSave"
  >
    <template #nav>
      <WorkspaceModuleNav
        :product-id="(product as AdminProduct).id"
        :product-name="(product as AdminProduct).name_en"
        :product-code="(product as AdminProduct).product_code"
        :product-status="(product as AdminProduct).status"
        :product-hero-url="workspaceHeroUrl(product as AdminProduct)"
        active-key="specifications"
      />
    </template>

    <p v-if="!isDraft" class="ws-lock-banner" role="status">
      This product is not a Draft, so it is read-only. Return it to Draft to edit.
    </p>

    <p v-if="saveError" class="ws-save-error" role="alert">{{ saveError }}</p>

    <WorkspaceSpecifications
      :groups="groups"
      @add-group="addGroup"
      @remove-group="removeGroup"
      @update-group-title="({ groupIndex, value }) => updateGroupTitle(groupIndex, value)"
      @toggle-group-enabled="toggleGroupEnabled"
      @add-item="({ groupIndex, labelEn, valueEn }) => addItem(groupIndex, labelEn, valueEn)"
      @remove-item="({ groupIndex, itemIndex }) => removeItem(groupIndex, itemIndex)"
      @update-item-field="({ groupIndex, itemIndex, field, value }) => updateItemField(groupIndex, itemIndex, field, value)"
      @toggle-item-enabled="({ groupIndex, itemIndex }) => toggleItemEnabled(groupIndex, itemIndex)"
    />
  </WorkspaceShell>
</template>

<style scoped>
.ws-lock-banner {
  font-size: var(--text-sm);
  color: #8A5A00;
  background: #FFF8E6;
  border: 1px solid #F0DFAE;
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-4);
}

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
