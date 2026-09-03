<script setup lang="ts">
import type { AdminProduct, ProductMedia, FileRole } from '~/types/product-cms'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

const error = ref('')
const success = ref('')

const [{ data: productData }, { data: mediaData, refresh: refreshMedia }] = await Promise.all([
  useFetch<AdminProduct>(`/api/admin/products/${id}`),
  useFetch<ProductMedia[]>(`/api/admin/products/${id}/media`),
])

if (!productData.value) await navigateTo('/admin/products')

const mediaList = computed(() => mediaData.value ?? [])

const FILE_ROLE_LABELS: Record<FileRole, string> = {
  hero: '主图',
  overview: '概览图',
  application: '应用场景图',
  detail: '细节图',
  gallery: '图库',
  video_poster: '视频封面',
  brochure: '产品手册',
  datasheet: '规格书',
  drawing: '工程图纸',
  manual: '操作手册',
  certificate: '认证证书',
}

async function toggleEnabled(item: ProductMedia) {
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/media/${item.id}`, {
      method: 'PATCH', body: { enabled: !item.enabled },
    })
    await refreshMedia()
  } catch (e: unknown) {
    const fe = e as { data?: { message?: string } }
    error.value = fe.data?.message ?? '操作失败'
  }
}

async function removeMedia(mid: number) {
  if (!confirm('确认移除此媒体记录？这只会删除与产品的关联，不会删除原始文件。')) return
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${id}/media/${mid}`, { method: 'DELETE' })
    await refreshMedia()
    success.value = '媒体记录已移除'
    setTimeout(() => (success.value = ''), 3000)
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
        <h2 class="card-title">图片与资料</h2>
        <span class="card-note">通过 Directus 媒体库上传文件后，在此绑定到产品</span>
      </div>

      <div v-if="mediaList.length === 0" class="empty-state">
        <p class="empty-title">此产品暂无媒体文件</p>
        <p class="empty-hint">请先在 Directus 后台（:8055）上传产品图片或文件，然后通过 API 绑定到此产品。</p>
        <p class="empty-note">支持角色：主图、概览图、应用图、规格书、手册、证书等 11 种类型。</p>
      </div>

      <div v-else class="media-list">
        <div
          v-for="item in mediaList"
          :key="item.id"
          class="media-row"
          :class="{ 'media-row--disabled': !item.enabled }"
        >
          <div class="media-info">
            <span v-if="item.file_role" class="media-role-badge">
              {{ FILE_ROLE_LABELS[item.file_role as FileRole] ?? item.file_role }}
            </span>
            <span v-else class="media-role-badge media-role-badge--none">未设置角色</span>
            <span class="media-file-id">文件 ID: {{ item.directus_files_id?.slice(0, 12) ?? '—' }}…</span>
            <span v-if="item.alt_en" class="media-alt">alt: {{ item.alt_en }}</span>
          </div>
          <div class="media-actions">
            <button class="btn-icon" :title="item.enabled ? '隐藏' : '启用'" @click="toggleEnabled(item)">
              {{ item.enabled ? '✅' : '⬜' }}
            </button>
            <button class="btn-icon btn-icon--danger" title="移除关联" @click="removeMedia(item.id)">🗑</button>
          </div>
        </div>
      </div>
    </div>

    <div class="desktop-hint">
      <p>💡 上传新文件、批量管理、设置 alt 文字建议在桌面端操作。媒体文件通过 Directus Admin（:8055）上传后绑定此产品。</p>
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
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-line); flex-wrap: wrap; gap: var(--space-2); }
.card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }
.card-note { font-size: var(--text-xs); color: var(--color-ink-muted); }

.empty-state { text-align: center; padding: var(--space-12) var(--space-8); }
.empty-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-2); }
.empty-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.media-list { display: flex; flex-direction: column; gap: var(--space-2); }
.media-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-line); border-radius: var(--radius-sm); }
.media-row--disabled { opacity: 0.55; }
.media-info { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; flex-wrap: wrap; }
.media-role-badge { font-size: var(--text-xs); background: #e8f4f1; color: var(--color-primary); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
.media-role-badge--none { background: #f0f0f0; color: var(--color-ink-muted); }
.media-file-id { font-size: var(--text-xs); color: var(--color-ink-muted); font-family: monospace; }
.media-alt { font-size: var(--text-xs); color: var(--color-ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

.btn-icon { background: none; border: none; cursor: pointer; padding: 4px; font-size: 14px; border-radius: var(--radius-sm); }
.btn-icon:hover { background: var(--color-line); }
.btn-icon--danger:hover { background: #fdf0ee; }

.desktop-hint { margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background: #fffbf0; border: 1px solid #f0e0b0; border-radius: var(--radius-sm); font-size: var(--text-xs); color: #7a6030; }
.error-banner { background: #FDF0EE; border: 1px solid #F5C6C2; border-radius: var(--radius-sm); color: #C0392B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }
.success-banner { background: #D1F0E8; border: 1px solid #A3DBC8; border-radius: var(--radius-sm); color: #0F5C4B; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-5); }

@media (max-width: 767px) {
  .page { padding: var(--space-4); }
  .card-header { flex-direction: column; align-items: flex-start; }
}
</style>
