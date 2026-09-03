<script setup lang="ts">
import type { AdminProduct, ProductCategory, ProductPreset } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const form = ref<Partial<AdminProduct>>({ status: 'draft' })
const saving = ref(false)
const error = ref('')

const [{ data: cats }, { data: presets }] = await Promise.all([
  useFetch<ProductCategory[]>('/api/admin/categories'),
  useFetch<ProductPreset[]>('/api/admin/presets'),
])

const categories = computed(() => cats.value ?? [])
const presetList = computed(() => presets.value ?? [])

async function save() {
  error.value = ''
  if (!form.value.name_en?.trim()) { error.value = '产品名称（EN）为必填项'; return }
  if (!form.value.slug?.trim()) { error.value = 'Slug 为必填项'; return }
  if (!form.value.category_id) { error.value = '产品分类为必填项'; return }

  saving.value = true
  try {
    const result = await $fetch<{ id: number }>('/api/admin/products', {
      method: 'POST',
      body: form.value,
    })
    router.push(`/admin/products/${result.id}`)
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message ?? '保存失败，请重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">新建产品</h1>
    </div>

    <div class="content-card">
      <p v-if="error" class="error-banner">{{ error }}</p>

      <ProductBasicForm
        v-model="form"
        :categories="categories"
        :presets="presetList"
        :loading="saving"
        @save="save"
      />
    </div>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); max-width: 760px; }

.page-header { margin-bottom: var(--space-6); }

.back-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; display: block; margin-bottom: var(--space-3); }
.back-link:hover { text-decoration: underline; }

.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); margin: 0; }

.content-card {
  background: white;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-8);
}

.error-banner {
  background: #FDF0EE;
  border-radius: var(--radius-sm);
  border: 1px solid #F5C6C2;
  color: #C0392B;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
}
</style>
