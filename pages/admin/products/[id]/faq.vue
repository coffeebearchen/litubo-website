<script setup lang="ts">
import type { AdminProduct, ProductFaq } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const saving = ref(false)
const error = ref('')
const success = ref('')
const showAddForm = ref(false)

const addForm = ref({ question_en: '', answer_en: '', source_note: '' })

const [{ data: productData }, { data: faqData, refresh: refreshFaq }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductFaq[]>(`/api/admin/products/${id}/faq`),
])

if (!productData.value) await navigateTo('/admin/products')

const faqs = computed(() => faqData.value ?? [])

async function addFaq() {
  if (!addForm.value.question_en.trim()) { error.value = '问题（EN）为必填项'; return }
  if (!addForm.value.answer_en.trim()) { error.value = '答案（EN）为必填项'; return }
  error.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/products/${id}/faq`, {
      method: 'POST',
      body: {
        question_en: addForm.value.question_en,
        answer_en: addForm.value.answer_en,
        source_note: addForm.value.source_note || null,
      },
    })
    await refreshFaq()
    showAddForm.value = false
    addForm.value = { question_en: '', answer_en: '', source_note: '' }
    success.value = 'FAQ 已添加'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '添加失败'
  } finally { saving.value = false }
}

async function deleteFaq(fid: number) {
  if (!confirm('确认删除此 FAQ 条目？')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/faq/${fid}`, { method: 'DELETE' })
    await refreshFaq()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '删除失败'
  }
}

async function toggleEnabled(faq: ProductFaq) {
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/faq/${faq.id}`, {
      method: 'PATCH', body: { enabled: !faq.enabled },
    })
    await refreshFaq()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '操作失败'
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
        <h2 class="card-title">产品 FAQ</h2>
        <button class="btn btn-primary" @click="showAddForm = !showAddForm">
          {{ showAddForm ? '取消' : '＋ 添加 FAQ' }}
        </button>
      </div>

      <div v-if="showAddForm" class="add-form">
        <div class="form-group">
          <label class="form-label">问题（EN） <span class="required">*</span></label>
          <input v-model="addForm.question_en" type="text" class="form-input" placeholder="What is...?" >
        </div>
        <div class="form-group">
          <label class="form-label">答案（EN） <span class="required">*</span></label>
          <textarea v-model="addForm.answer_en" class="form-textarea" rows="3" placeholder="The answer is..." />
        </div>
        <div class="form-group">
          <label class="form-label">来源备注（内部用）</label>
          <input v-model="addForm.source_note" type="text" class="form-input" placeholder="如：来自产品手册第 3 页" >
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" :disabled="saving" @click="addFaq">
            {{ saving ? '添加中…' : '确认添加' }}
          </button>
        </div>
      </div>

      <div v-if="faqs.length === 0 && !showAddForm" class="empty-state">
        <p class="empty-title">此产品暂无 FAQ</p>
        <p class="empty-hint">点击「添加 FAQ」创建第一条常见问题。FAQ 内容来自真实客户疑问或产品文档。</p>
      </div>

      <div v-else class="faq-list">
        <div
          v-for="faq in faqs"
          :key="faq.id"
          class="faq-item"
          :class="{ 'faq-item--disabled': !faq.enabled }"
        >
          <div class="faq-header">
            <div class="faq-q">Q: {{ faq.question_en || '（无问题文字）' }}</div>
            <div class="faq-actions">
              <button class="btn-icon" :title="faq.enabled ? '隐藏' : '启用'" @click="toggleEnabled(faq)">
                {{ faq.enabled ? '✅' : '⬜' }}
              </button>
              <button class="btn-icon btn-icon--danger" @click="deleteFaq(faq.id)">🗑</button>
            </div>
          </div>
          <div class="faq-a">A: {{ faq.answer_en || '（无答案文字）' }}</div>
          <div v-if="faq.source_note" class="faq-note">来源: {{ faq.source_note }}</div>
        </div>
      </div>
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
.form-textarea { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; resize: vertical; }
.form-actions { display: flex; justify-content: flex-end; }

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

.faq-list { display: flex; flex-direction: column; gap: var(--space-3); }
.faq-item { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-4); }
.faq-item--disabled { opacity: 0.55; }
.faq-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-2); }
.faq-q { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); flex: 1; }
.faq-a { font-size: var(--text-sm); color: var(--color-ink-muted); line-height: 1.5; }
.faq-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin-top: var(--space-2); border-top: 1px solid var(--color-line); padding-top: var(--space-2); }
.faq-actions { display: flex; gap: var(--space-1); flex-shrink: 0; }

.btn-icon { background: none; border: none; cursor: pointer; padding: 4px; font-size: 14px; border-radius: var(--radius-sm); }
.btn-icon:hover { background: var(--color-line); }
.btn-icon--danger:hover { background: #fdf0ee; }
.btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border: none; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #0F5C4B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .card-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
}
</style>
