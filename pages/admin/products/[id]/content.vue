<script setup lang="ts">
import type { AdminProduct, ProductSection, SectionType } from '~/types/product-cms'
import { SECTION_TYPES } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const saving = ref(false)
const error = ref('')
const success = ref('')
const showAddForm = ref(false)

const addForm = ref<{ type: SectionType; title_en: string; enabled: boolean }>({
  type: 'overview',
  title_en: '',
  enabled: true,
})

const [{ data: productData }, { data: sectionsData, refresh: refreshSections }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductSection[]>(`/api/admin/products/${id}/sections`),
])

if (!productData.value) {
  await navigateTo('/admin/products')
}

const sections = computed(() => sectionsData.value ?? [])

const SECTION_LABELS: Record<SectionType, string> = {
  text: '文本',
  feature_list: '功能列表',
  overview: '概览',
  image_text: '图文',
  benefits: '优势亮点',
  applications: '应用场景',
  detection_targets: '检测对象',
  working_principle: '工作原理',
  configuration_options: '选型配置',
  line_integration: '产线集成',
  quotation_reminder: '报价提醒',
  video: '视频',
  case_studies: '案例',
}

async function toggleEnabled(section: ProductSection) {
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/sections/${section.id}`, {
      method: 'PATCH',
      body: { enabled: !section.enabled },
    })
    await refreshSections()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '操作失败，请重试'
  }
}

async function deleteSection(sectionId: number) {
  if (!confirm('确认删除该模块？此操作不可撤销。')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/sections/${sectionId}`, { method: 'DELETE' })
    await refreshSections()
    success.value = '模块已删除'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '删除失败，请重试'
  }
}

async function addSection() {
  error.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/products/${id}/sections`, {
      method: 'POST',
      body: {
        type: addForm.value.type,
        title_en: addForm.value.title_en || null,
        enabled: addForm.value.enabled,
      },
    })
    await refreshSections()
    showAddForm.value = false
    addForm.value = { type: 'overview', title_en: '', enabled: true }
    success.value = '模块已添加'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '添加失败，请重试'
  } finally {
    saving.value = false
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
        <h2 class="card-title">页面模块</h2>
        <button class="btn btn-primary" @click="showAddForm = !showAddForm">
          {{ showAddForm ? '取消' : '＋ 添加模块' }}
        </button>
      </div>

      <!-- 添加表单 -->
      <div v-if="showAddForm" class="add-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">模块类型 <span class="required">*</span></label>
            <select v-model="addForm.type" class="form-select">
              <option v-for="t in SECTION_TYPES" :key="t" :value="t">
                {{ SECTION_LABELS[t as SectionType] ?? t }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">标题（EN）</label>
            <input v-model="addForm.title_en" type="text" class="form-input" placeholder="可留空" >
          </div>
        </div>
        <div class="form-actions">
          <label class="checkbox-label">
            <input v-model="addForm.enabled" type="checkbox" >
            立即启用
          </label>
          <button class="btn btn-primary" :disabled="saving" @click="addSection">
            {{ saving ? '添加中…' : '确认添加' }}
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="sections.length === 0 && !showAddForm" class="empty-state">
        <p class="empty-title">此产品暂无页面模块</p>
        <p class="empty-hint">点击「添加模块」创建第一个内容区块。每个模块对应产品详情页的一个展示区域。</p>
        <p class="empty-note">建议先创建 overview（概览）模块。</p>
      </div>

      <!-- 模块列表 -->
      <div v-else class="section-list">
        <div
          v-for="section in sections"
          :key="section.id"
          class="section-row"
          :class="{ 'section-row--disabled': !section.enabled }"
        >
          <span class="section-sort">{{ section.sort ?? '—' }}</span>
          <span class="section-type-badge">{{ SECTION_LABELS[section.type as SectionType] ?? section.type }}</span>
          <span class="section-title">{{ section.title_en || '（无标题）' }}</span>
          <div class="section-actions">
            <button
              class="btn-icon"
              :title="section.enabled ? '点击隐藏' : '点击启用'"
              @click="toggleEnabled(section)"
            >
              {{ section.enabled ? '✅' : '⬜' }}
            </button>
            <button class="btn-icon btn-icon--danger" title="删除" @click="deleteSection(section.id)">
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="desktop-hint">
      <p>💡 模块内容（标题、正文、图片、条目）建议在桌面端编辑，字段较多。</p>
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

.add-form { background: var(--color-bg-subtle, #f8f9fa); border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-5); margin-bottom: var(--space-5); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
.form-group { display: flex; flex-direction: column; gap: var(--space-2); }
.form-label { font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); }
.required { color: #c0392b; }
.form-select, .form-input { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; }
.form-actions { display: flex; justify-content: space-between; align-items: center; }
.checkbox-label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); cursor: pointer; }

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-2); }
.empty-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.section-list { display: flex; flex-direction: column; gap: var(--space-2); }
.section-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: white; }
.section-row--disabled { opacity: 0.55; }
.section-sort { font-size: var(--text-xs); color: var(--color-ink-muted); width: 24px; text-align: center; flex-shrink: 0; }
.section-type-badge { font-size: var(--text-xs); background: #e8f4f1; color: var(--color-primary); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
.section-title { font-size: var(--text-sm); color: var(--color-ink); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
.btn-icon { background: none; border: none; cursor: pointer; padding: var(--space-1); font-size: 14px; border-radius: var(--radius-sm); }
.btn-icon:hover { background: var(--color-line); }
.btn-icon--danger:hover { background: #fdf0ee; }

.btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border: none; transition: opacity 0.15s; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.desktop-hint { margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background: #fffbf0; border: 1px solid #f0e0b0; border-radius: var(--radius-sm); font-size: var(--text-xs); color: #7a6030; }

.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #2F6B3A; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .form-row { grid-template-columns: 1fr; }
  .card-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
  .section-row { flex-wrap: wrap; }
  .section-title { width: 100%; flex: none; }
  .btn, .btn--primary, .btn--secondary { min-height: 44px; }
  .form-input, .form-select, .form-textarea { min-height: 44px; }
}
</style>
