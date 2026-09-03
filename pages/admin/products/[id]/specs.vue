<script setup lang="ts">
import type { AdminProduct, ProductSpecGroup } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const saving = ref(false)
const error = ref('')
const success = ref('')
const showAddGroupForm = ref(false)
const expandedGroups = ref<Set<number>>(new Set())
const addItemForms = ref<Record<number, { label_en: string; value_en: string }>>({})

const addGroupForm = ref({ title_en: '' })

const [{ data: productData }, { data: specsData, refresh: refreshSpecs }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductSpecGroup[]>(`/api/admin/products/${id}/specs`),
])

if (!productData.value) await navigateTo('/admin/products')

const specs = computed(() => specsData.value ?? [])

function toggleGroup(gid: number) {
  if (expandedGroups.value.has(gid)) expandedGroups.value.delete(gid)
  else expandedGroups.value.add(gid)
}

async function addGroup() {
  if (!addGroupForm.value.title_en.trim()) { error.value = '参数组标题（EN）为必填项'; return }
  error.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/products/${id}/specs`, {
      method: 'POST', body: { title_en: addGroupForm.value.title_en },
    })
    await refreshSpecs()
    showAddGroupForm.value = false
    addGroupForm.value = { title_en: '' }
    success.value = '参数组已添加'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '添加失败，请重试'
  } finally { saving.value = false }
}

async function deleteGroup(gid: number) {
  if (!confirm('确认删除此参数组（含其下所有参数条目）？')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/specs/${gid}`, { method: 'DELETE' })
    await refreshSpecs()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '删除失败'
  }
}

async function addItem(gid: number) {
  const form = addItemForms.value[gid]
  if (!form) return
  error.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/products/${id}/specs/${gid}/items`, {
      method: 'POST', body: { label_en: form.label_en || null, value_en: form.value_en || null },
    })
    await refreshSpecs()
    addItemForms.value[gid] = { label_en: '', value_en: '' }
    success.value = '参数已添加'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '添加失败'
  } finally { saving.value = false }
}

async function deleteItem(gid: number, iid: number) {
  if (!confirm('确认删除此参数条目？')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/specs/${gid}/items/${iid}`, { method: 'DELETE' })
    await refreshSpecs()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '删除失败'
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">{{ productData?.name_en ?? '产品编辑' }}</h1>
    </div>

    <ProductSubNav :product-id="id" />

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="success" class="success-banner">{{ success }}</p>

    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">技术参数</h2>
        <button class="btn btn-primary" @click="showAddGroupForm = !showAddGroupForm">
          {{ showAddGroupForm ? '取消' : '＋ 添加参数组' }}
        </button>
      </div>

      <div v-if="showAddGroupForm" class="add-form">
        <div class="form-group">
          <label class="form-label">参数组标题（EN） <span class="required">*</span></label>
          <input v-model="addGroupForm.title_en" type="text" class="form-input" placeholder="如：General Specifications" >
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" :disabled="saving" @click="addGroup">
            {{ saving ? '添加中…' : '确认添加' }}
          </button>
        </div>
      </div>

      <div v-if="specs.length === 0 && !showAddGroupForm" class="empty-state">
        <p class="empty-title">此产品暂无技术参数</p>
        <p class="empty-hint">点击「添加参数组」创建第一组参数。每个参数组下可添加多条参数条目。</p>
        <p class="empty-note">建议在桌面端操作以便同时查看多语言字段。</p>
      </div>

      <div v-else class="groups-list">
        <div v-for="group in specs" :key="group.id" class="group-card">
          <div class="group-header" @click="toggleGroup(group.id)">
            <span class="group-toggle">{{ expandedGroups.has(group.id) ? '▼' : '▶' }}</span>
            <span class="group-title">{{ group.title_en || '（无标题）' }}</span>
            <span class="group-count">{{ group.items?.length ?? 0 }} 条</span>
            <button class="btn-icon btn-icon--danger" @click.stop="deleteGroup(group.id)">🗑</button>
          </div>

          <div v-if="expandedGroups.has(group.id)" class="group-body">
            <div v-if="!group.items?.length" class="items-empty">暂无参数条目</div>
            <table v-else class="items-table">
              <thead>
                <tr><th>标签（EN）</th><th>值（EN）</th><th>备注</th><th/></tr>
              </thead>
              <tbody>
                <tr v-for="item in group.items" :key="item.id">
                  <td>{{ item.label_en || '—' }}</td>
                  <td>{{ item.value_en || '—' }}</td>
                  <td>{{ item.note_en || '—' }}</td>
                  <td>
                    <button class="btn-icon btn-icon--danger" @click="deleteItem(group.id, item.id)">🗑</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- 快速添加条目 -->
            <div class="item-add-row">
              <input
                v-model="(addItemForms[group.id] ??= { label_en: '', value_en: '' }).label_en"
                type="text" class="form-input form-input--sm" placeholder="标签（EN）"
              >
              <input
                v-model="(addItemForms[group.id] ??= { label_en: '', value_en: '' }).value_en"
                type="text" class="form-input form-input--sm" placeholder="值（EN）"
              >
              <button class="btn btn-secondary" :disabled="saving" @click="addItem(group.id)">添加</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="desktop-hint">
      <p>💡 多语言参数（ES / PT）及备注建议在桌面端通过 Directus 直接编辑。</p>
    </div>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); }
.page-header { margin-bottom: var(--space-6); }
.back-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; display: block; margin-bottom: var(--space-3); }
.back-link:hover { text-decoration: underline; }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); margin: 0; }

.content-card { background: white; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-6); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-line); }
.card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }

.add-form { background: #f8f9fa; border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-5); margin-bottom: var(--space-5); }
.form-group { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
.form-label { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); }
.required { color: #c0392b; }
.form-input { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; }
.form-input--sm { min-width: 0; flex: 1; }
.form-actions { display: flex; justify-content: flex-end; }

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-2); }
.empty-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.groups-list { display: flex; flex-direction: column; gap: var(--space-3); }
.group-card { border: 1px solid var(--color-line); border-radius: var(--radius-sm); overflow: hidden; }
.group-header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); cursor: pointer; background: #f8f9fa; }
.group-header:hover { background: #f0f4f1; }
.group-toggle { font-size: var(--text-xs); color: var(--color-ink-muted); }
.group-title { flex: 1; font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.group-count { font-size: var(--text-xs); color: var(--color-ink-muted); }
.group-body { padding: var(--space-4); }
.items-empty { font-size: var(--text-sm); color: var(--color-ink-muted); text-align: center; padding: var(--space-3); }

.items-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); margin-bottom: var(--space-4); }
.items-table th { text-align: left; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-line); color: var(--color-ink-muted); font-weight: 500; font-size: var(--text-xs); }
.items-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-line); color: var(--color-ink); }
.item-add-row { display: flex; gap: var(--space-2); align-items: center; }

.btn-icon { background: none; border: none; cursor: pointer; padding: 4px; font-size: 14px; border-radius: var(--radius-sm); }
.btn-icon:hover { background: var(--color-line); }
.btn-icon--danger:hover { background: #fdf0ee; }
.btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border: none; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-secondary { background: white; color: var(--color-primary); border: 1px solid var(--color-primary); flex-shrink: 0; }
.btn-secondary:hover:not(:disabled) { background: #f0f9f5; }

.desktop-hint { margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background: #fffbf0; border: 1px solid #f0e0b0; border-radius: var(--radius-sm); font-size: var(--text-xs); color: #7a6030; }
.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #0F5C4B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .card-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
  .item-add-row { flex-direction: column; }
  .form-input--sm { width: 100%; }
  .items-table { font-size: var(--text-xs); }
  .items-table th:nth-child(3), .items-table td:nth-child(3) { display: none; }
}
</style>
