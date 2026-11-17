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

/**
 * FINAL-RELEASE-FIX-F (D-037) — only a Draft is editable. Review, Published and
 * Archived are read-only here because the server refuses the write; this just
 * stops an administrator typing into a form that cannot save.
 */
const isDraft = computed(() => (form.value.status ?? 'draft') === 'draft')

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
        // V2-01: the form rendered these three controls but the payload never carried them, so any
        // change was silently dropped. `false` and `null` are sent as-is: false means reviewed and not
        // an L-series variant, null means not reviewed yet.
        checkweigher_series: form.value.checkweigher_series ?? null,
        checkweigher_configuration: form.value.checkweigher_configuration ?? null,
        checkweigher_l_series: form.value.checkweigher_l_series ?? null,
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

/**
 * Product Centre AI — a Draft-only suggestion for this product's listing copy.
 *
 * It writes nothing until a person accepts items: the proposal lives in the server's one-time
 * reference, and the Confirm call is the only writer. Each item is accepted separately, because an
 * editor may like the summary and dislike the SEO title.
 */
interface ListingProposal {
  summary: string
  seoTitle: string
  seoDescription: string
  categoryId: number | null
}
interface ListingProposalResponse {
  ok: boolean
  unavailable?: boolean
  error?: string
  proposal?: ListingProposal
  proposalRef?: string
  categories?: Array<{ id: number, name: string }>
}

const aiProposal = ref<ListingProposal | null>(null)
const aiRef = ref('')
const aiCategories = ref<Array<{ id: number, name: string }>>([])
const aiGenerating = ref(false)
const aiSaving = ref(false)
const aiError = ref('')
const aiFeedback = ref('')
const aiAccept = reactive({ summary: true, seoTitle: true, seoDescription: true, category: true })

const acceptedCategoryName = computed(() => {
  const id = aiProposal.value?.categoryId
  if (id === null || id === undefined) return ''
  return aiCategories.value.find(c => c.id === id)?.name ?? `#${id}`
})

async function generateListingSuggestion() {
  aiGenerating.value = true
  aiError.value = ''
  aiFeedback.value = ''
  try {
    const res = await $fetch<ListingProposalResponse>(`/api/admin/products/${id}/ai-listing-proposal`, { method: 'POST', body: {} })
    if (!res.ok || !res.proposal || !res.proposalRef) {
      aiError.value = res.error ?? 'A suggestion could not be generated. The product is unchanged.'
      return
    }
    aiProposal.value = res.proposal
    aiRef.value = res.proposalRef
    aiCategories.value = res.categories ?? []
    aiAccept.summary = true
    aiAccept.seoTitle = true
    aiAccept.seoDescription = true
    aiAccept.category = res.proposal.categoryId !== null
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    aiError.value = fe.data?.message ?? 'A suggestion could not be generated. The product is unchanged.'
  } finally {
    aiGenerating.value = false
  }
}

function discardListingSuggestion() {
  aiProposal.value = null
  aiRef.value = ''
  aiError.value = ''
  aiFeedback.value = 'Suggestion discarded. Nothing was saved.'
}

async function confirmListingSuggestion() {
  if (!aiProposal.value) return
  if (!aiAccept.summary && !aiAccept.seoTitle && !aiAccept.seoDescription && !aiAccept.category) {
    aiError.value = 'Choose at least one suggestion to save.'
    return
  }
  aiSaving.value = true
  aiError.value = ''
  aiFeedback.value = ''
  try {
    const res = await $fetch<{ ok: boolean, saved: string[] }>(`/api/admin/products/${id}/ai-listing-confirm`, {
      method: 'POST',
      body: {
        proposalRef: aiRef.value,
        acceptSummary: aiAccept.summary,
        acceptSeoTitle: aiAccept.seoTitle,
        acceptSeoDescription: aiAccept.seoDescription,
        acceptCategory: aiAccept.category,
      },
    })
    aiProposal.value = null
    aiRef.value = ''
    aiFeedback.value = `Saved ${res.saved.length} field(s).`
    const fresh = await $fetch<AdminProduct>(`/api/admin/products/${id}`)
    form.value = { ...fresh }
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    aiError.value = fe.data?.message ?? 'The suggestion could not be saved. Nothing was written.'
  } finally {
    aiSaving.value = false
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
          <p v-if="!isDraft" class="lock-banner" role="status">
            This product is {{ form.status }}. Product details are read-only — return it to Draft to edit.
          </p>
          <ProductBasicForm
            v-model="form"
            :categories="categories"
            :presets="presetList"
            :loading="saving"
            :readonly="!isDraft"
            @save="save"
          />
        </div>
      </div>

      <div class="side-col">
        <div class="ai-card">
          <div class="ai-head">
            <h2 class="ai-title">AI 协助</h2>
            <span class="ai-chip">{{ isDraft ? '草稿可用' : '已锁定' }}</span>
          </div>

          <p v-if="!isDraft" class="ai-hint">
            只有 Draft 状态能接受 AI 建议。当前状态：{{ form.status }}。
          </p>

          <template v-else>
            <p v-if="!aiProposal" class="ai-hint">
              根据本产品已有信息，建议摘要、SEO 标题/描述和技术分类。不会自动保存，也不会发布。
            </p>

            <button type="button" class="ai-btn" :disabled="aiGenerating" @click="generateListingSuggestion">
              {{ aiGenerating ? '生成中…' : (aiProposal ? '重新生成' : '生成建议') }}
            </button>

            <div v-if="aiProposal" class="ai-proposal">
              <label class="ai-item">
                <input v-model="aiAccept.summary" type="checkbox">
                <span><strong>摘要</strong><br>{{ aiProposal.summary }}</span>
              </label>

              <label v-if="aiProposal.seoTitle" class="ai-item">
                <input v-model="aiAccept.seoTitle" type="checkbox">
                <span><strong>SEO 标题</strong><br>{{ aiProposal.seoTitle }}</span>
              </label>

              <label v-if="aiProposal.seoDescription" class="ai-item">
                <input v-model="aiAccept.seoDescription" type="checkbox">
                <span><strong>SEO 描述</strong><br>{{ aiProposal.seoDescription }}</span>
              </label>

              <label v-if="aiProposal.categoryId !== null" class="ai-item">
                <input v-model="aiAccept.category" type="checkbox">
                <span><strong>技术分类</strong><br>{{ acceptedCategoryName }}</span>
              </label>
              <p v-else class="ai-hint">AI 没有找到合适的分类，分类字段保持不动。</p>

              <div class="ai-actions">
                <button type="button" class="ai-btn" :disabled="aiSaving" @click="confirmListingSuggestion">
                  {{ aiSaving ? '保存中…' : '保存勾选项' }}
                </button>
                <button type="button" class="ai-btn ai-btn--ghost" :disabled="aiSaving" @click="discardListingSuggestion">
                  丢弃
                </button>
              </div>
            </div>

            <p v-if="aiError" class="ai-error" role="alert">{{ aiError }}</p>
            <p v-if="aiFeedback" class="ai-hint" role="status">{{ aiFeedback }}</p>
            <p class="ai-note">AI 只写摘要、SEO 标题/描述、技术分类。不改名称、slug、code、状态，也不发布。</p>
          </template>
        </div>

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

/* Product Centre AI */
.ai-card {
  background: white;
  border: 1px solid #D9CFEA;
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.ai-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2); }
.ai-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }
.ai-chip { padding: 2px 8px; border-radius: 999px; background: #F4F0FA; color: #7250A2; font-size: 11px; font-weight: 600; }
.ai-hint { margin: 0 0 var(--space-3); font-size: 12px; line-height: 1.5; color: var(--color-ink-muted); }
.ai-note { margin: var(--space-3) 0 0; font-size: 11px; line-height: 1.5; color: var(--color-ink-muted); }
.ai-proposal { margin-top: var(--space-3); border-top: 1px solid #EDE7F6; padding-top: var(--space-3); }
.ai-item { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.5; color: var(--color-ink); margin-bottom: var(--space-2); }
.ai-item input { margin-top: 3px; accent-color: #7250A2; }
.ai-item strong { font-weight: 600; }
.ai-actions { display: flex; gap: var(--space-2); margin-top: var(--space-3); }
.ai-btn {
  flex: 1;
  min-height: 36px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: #7250A2;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ai-btn--ghost { background: #fff; color: #7250A2; border: 1px solid #D9CFEA; }
.ai-btn:disabled { opacity: .6; cursor: default; }
.ai-error { margin: var(--space-2) 0 0; font-size: 12px; line-height: 1.5; color: #B42318; }

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

.lock-banner {
  background: #FFF8E6;
  border: 1px solid #F0DFAE;
  border-radius: var(--radius-sm);
  color: #8A5A00;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin: 0 0 var(--space-5);
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
  color: #2F6B3A;
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
}
</style>
