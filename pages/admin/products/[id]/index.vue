<script setup lang="ts">
import type { AdminProduct, ProductCategory, ProductPreset, ProductStatus } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const saving = ref(false)
const error = ref('')
const success = ref('')

const [{ data: productData }, { data: cats }, { data: presets }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductCategory[]>('/api/admin/categories'),
  useFetch<ProductPreset[]>('/api/admin/presets'),
])

const form = ref<Partial<AdminProduct>>(productData.value ? { ...productData.value } : {})

const categories = computed(() => cats.value ?? [])
const presetList = computed(() => presets.value ?? [])

watch(productData, (val: AdminProduct | null) => {
  if (val) form.value = { ...val }
})

async function save() {
  error.value = ''
  success.value = ''
  if (!form.value.name_en?.trim()) { error.value = '产品名称（EN）为必填项'; return }

  saving.value = true
  try {
    const updated = await $fetch<AdminProduct>(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: {
        name_en: form.value.name_en,
        name_es: form.value.name_es,
        name_pt: form.value.name_pt,
        slug: form.value.slug,
        model_or_series: form.value.model_or_series,
        summary_en: form.value.summary_en,
        summary_es: form.value.summary_es,
        summary_pt: form.value.summary_pt,
        category_id: form.value.category_id,
        page_preset_id: form.value.page_preset_id,
        review_notes: form.value.review_notes,
      },
    })
    form.value = { ...updated }
    success.value = '已保存'
    setTimeout(() => (success.value = ''), 3000)
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message ?? '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

async function changeStatus(newStatus: ProductStatus) {
  error.value = ''
  saving.value = true
  try {
    const updated = await $fetch<AdminProduct>(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    form.value = { ...updated }
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message ?? '状态更新失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">{{ productData?.name_en ?? '产品详情' }}</h1>
    </div>

    <ProductSubNav :product-id="id" />

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="success" class="success-banner">{{ success }}</p>

    <div class="layout-grid">
      <div class="main-col">
        <div class="content-card">
          <h2 class="card-title">基础信息</h2>
          <ProductBasicForm
            v-model="form"
            :categories="categories"
            :presets="presetList"
            :loading="saving"
            @save="save"
          />
        </div>
      </div>

      <div class="side-col">
        <PublishPanel
          v-if="form.status"
          :status="(form.status as ProductStatus)"
          :published-at="form.published_at ?? null"
          :loading="saving"
          @status-change="changeStatus"
        />

        <div class="meta-card">
          <p class="meta-label">ID</p>
          <p class="meta-value">{{ id }}</p>
          <p class="meta-label">创建时间</p>
          <p class="meta-value">{{ form.date_created ? new Date(form.date_created).toLocaleString('zh-CN') : '—' }}</p>
          <p class="meta-label">最后更新</p>
          <p class="meta-value">{{ form.date_updated ? new Date(form.date_updated).toLocaleString('zh-CN') : '—' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); }

.page-header { margin-bottom: var(--space-6); }

.back-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-3);
}
.back-link:hover { text-decoration: underline; }

.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); margin: 0; }

.layout-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-6);
  align-items: start;
}

.content-card {
  background: white;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-8);
}

.card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.side-col { display: flex; flex-direction: column; gap: var(--space-4); }

.meta-card {
  background: white;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.meta-label { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.meta-value { font-size: var(--text-sm); color: var(--color-ink); margin: 0 0 var(--space-3); font-family: monospace; }
.meta-value:last-child { margin-bottom: 0; }

@media (max-width: 720px) {
  .page { padding: var(--space-4); }
  .page-title { font-size: var(--text-xl); word-break: break-word; }
  .layout-grid { grid-template-columns: 1fr; }
  /* status card stays in DOM order (after main-col) */
}

.error-banner {
  background: #FDF0EE;
  border: 1px solid #F5C6C2;
  border-radius: var(--radius-sm);
  color: #C0392B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
}

.success-banner {
  background: #D1F0E8;
  border: 1px solid #A3DBC8;
  border-radius: var(--radius-sm);
  color: #0F5C4B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
}
</style>
