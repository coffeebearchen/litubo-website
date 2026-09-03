<script setup lang="ts">
import type { AdminProduct, ProductSeoFields } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const saving = ref(false)
const error = ref('')
const success = ref('')

const [{ data: productData }, { data: seoData }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductSeoFields>(`/api/admin/products/${id}/seo`),
])

if (!productData.value) await navigateTo('/admin/products')

const form = ref<ProductSeoFields>({
  seo_title_en: seoData.value?.seo_title_en ?? null,
  seo_description_en: seoData.value?.seo_description_en ?? null,
  seo_noindex: seoData.value?.seo_noindex ?? false,
})

const titleLen = computed(() => (form.value.seo_title_en ?? '').length)
const descLen = computed(() => (form.value.seo_description_en ?? '').length)

async function save() {
  error.value = ''
  saving.value = true
  try {
    await $fetch<ProductSeoFields>(`/api/admin/products/${id}/seo`, {
      method: 'PATCH',
      body: {
        seo_title_en: form.value.seo_title_en || null,
        seo_description_en: form.value.seo_description_en || null,
        seo_noindex: form.value.seo_noindex,
      },
    })
    success.value = 'SEO 信息已保存'
    setTimeout(() => (success.value = ''), 3000)
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '保存失败，请重试'
  } finally { saving.value = false }
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

    <div class="layout-grid">
      <div class="main-col">
        <div class="content-card">
          <h2 class="card-title">SEO 设置</h2>

          <div class="form-group">
            <label class="form-label">
              页面标题（EN）
              <span class="char-count" :class="{ 'char-count--warn': titleLen > 90, 'char-count--error': titleLen > 120 }">
                {{ titleLen }}/120
              </span>
            </label>
            <input
              v-model="form.seo_title_en"
              type="text"
              class="form-input"
              maxlength="120"
              placeholder="产品名称 — LITUBO"
            >
            <p class="form-hint">建议 50–70 个字符，留空则使用产品名称作为默认标题</p>
          </div>

          <div class="form-group">
            <label class="form-label">
              页面描述（EN）
              <span class="char-count" :class="{ 'char-count--warn': descLen > 250, 'char-count--error': descLen > 320 }">
                {{ descLen }}/320
              </span>
            </label>
            <textarea
              v-model="form.seo_description_en"
              class="form-textarea"
              maxlength="320"
              rows="3"
              placeholder="简洁描述产品核心价值，约 120–160 个字符效果最佳"
            />
          </div>

          <div class="form-group form-group--inline">
            <label class="checkbox-label">
              <input v-model="form.seo_noindex" type="checkbox" >
              noindex（禁止搜索引擎收录此页面）
            </label>
            <p class="form-hint">草稿或未完善页面建议勾选；发布正式页面时取消勾选</p>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : '保存 SEO' }}
            </button>
          </div>
        </div>
      </div>

      <div class="side-col">
        <div class="preview-card">
          <h3 class="preview-title">搜索预览（示意）</h3>
          <div class="serp-preview">
            <div class="serp-url">litubo.com/products/…/{{ productData?.slug ?? '…' }}</div>
            <div class="serp-title">{{ form.seo_title_en || productData?.name_en || '产品标题' }}</div>
            <div class="serp-desc">{{ form.seo_description_en || productData?.summary_en || '（暂无描述）' }}</div>
          </div>
          <p v-if="form.seo_noindex" class="noindex-warning">⚠️ 此页面已设为 noindex，搜索引擎不会收录</p>
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

.layout-grid { display: grid; grid-template-columns: 1fr 280px; gap: var(--space-6); align-items: start; }
.side-col { display: flex; flex-direction: column; gap: var(--space-4); }

.content-card { background: white; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-8); }
.card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-line); }

.form-group { margin-bottom: var(--space-5); }
.form-group--inline { display: flex; flex-direction: column; gap: var(--space-2); }
.form-label { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-sm); font-weight: 500; color: var(--color-ink); margin-bottom: var(--space-2); }
.char-count { font-size: var(--text-xs); color: var(--color-ink-muted); font-weight: 400; }
.char-count--warn { color: #e67e22; }
.char-count--error { color: #c0392b; }
.form-input { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; }
.form-textarea { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-ink); background: white; width: 100%; box-sizing: border-box; resize: vertical; }
.form-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-1) 0 0; }
.checkbox-label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); cursor: pointer; }
.form-actions { margin-top: var(--space-6); display: flex; justify-content: flex-end; }

.preview-card { background: white; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-4); }
.preview-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink-muted); margin: 0 0 var(--space-3); }
.serp-preview { padding: var(--space-3); background: #f8f9fa; border-radius: var(--radius-sm); }
.serp-url { font-size: 12px; color: #0c6e4e; margin-bottom: 2px; }
.serp-title { font-size: 14px; color: #1a0dab; font-weight: 500; margin-bottom: 4px; line-height: 1.3; }
.serp-desc { font-size: 12px; color: #545454; line-height: 1.4; }
.noindex-warning { font-size: var(--text-xs); color: #c0392b; margin: var(--space-3) 0 0; padding: var(--space-2); background: #fdf0ee; border-radius: var(--radius-sm); }

.btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border: none; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #0F5C4B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .layout-grid { grid-template-columns: 1fr; }
  /* side preview 放在 form 下方 (order: 1 默认) */
  .btn { min-height: 44px; }
  .form-input, .form-textarea { min-height: 44px; }
}
</style>
