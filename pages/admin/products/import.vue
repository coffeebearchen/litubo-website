<script setup lang="ts">
/**
 * 从资料导入产品 —— 上传一份文档，AI 提炼，人看一眼，一次点击创建并发布。
 *
 * 三层边界写在界面上，而不是只写在代码里：
 *  - AI 只出建议，任何一项都可以不采纳；分类可以改。
 *  - 参数可以逐行去掉；去掉的行不会写进产品。
 *  - 图片不在这里导入，必须去媒体库人工上传。
 */
definePageMeta({ layout: 'admin' })
useHead({ title: '从资料导入产品 — LITUBO Admin' })

interface Category { id: number, name: string }
interface SpecRow { group: string, parameter: string, value: string }
interface Proposal {
  name: string
  modelOrSeries: string
  summary: string
  seoTitle: string
  seoDescription: string
  categoryId: number
  specs: SpecRow[]
}
interface CreatedProduct { id: number, slug: string, name: string, productCode: string }

const picked = ref<File | null>(null)
const productCode = ref('')
const instruction = ref('')

const fileId = ref('')
const fileName = ref('')
const proposal = ref<Proposal | null>(null)
const proposalRef = ref('')
const categories = ref<Category[]>([])
const chosenCategoryId = ref(0)
const accept = reactive({ summary: true, seo: true, category: true, specs: true })
const specChecked = ref<boolean[]>([])

const busy = ref(false)
const step = ref<'pick' | 'preview' | 'done'>('pick')
const error = ref('')
const notice = ref('')
const result = ref<CreatedProduct | null>(null)

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/
const codeOk = computed(() => CODE_RE.test(productCode.value.trim().toUpperCase()))
const specCount = computed(() => specChecked.value.filter(Boolean).length)

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  picked.value = input.files?.[0] ?? null
  error.value = ''
  notice.value = ''
  // A different document invalidates the proposal on screen.
  proposal.value = null
  proposalRef.value = ''
  fileId.value = ''
  step.value = 'pick'
}

async function upload(): Promise<string | null> {
  if (!picked.value) return null
  const fd = new FormData()
  fd.append('file', picked.value, picked.value.name)
  const res = await $fetch<{ uploaded?: Array<{ id: string, filename_download: string }>, errors?: Array<{ message: string }> }>(
    '/api/admin/media/upload',
    { method: 'POST', body: fd },
  )
  if (res.errors?.length) {
    error.value = res.errors[0]?.message ?? '上传失败'
    return null
  }
  const file = res.uploaded?.[0]
  if (!file) {
    error.value = '上传失败：没有返回文件信息'
    return null
  }
  fileId.value = file.id
  fileName.value = file.filename_download
  return file.id
}

async function generate() {
  error.value = ''
  notice.value = ''
  if (!picked.value) { error.value = '请先选择一份资料'; return }
  if (!codeOk.value) { error.value = '品号只能使用大写字母、数字和连字符，例如 LT-180C'; return }

  busy.value = true
  try {
    let id = fileId.value
    if (!id) id = (await upload()) ?? ''
    if (!id) return

    const res = await $fetch<{
      ok: boolean
      error?: string
      unavailable?: boolean
      proposal?: Proposal
      proposalRef?: string
      categories?: Array<{ id: number, name: string }>
    }>('/api/admin/products/intake/proposal', {
      method: 'POST',
      body: { fileId: id, productCode: productCode.value.trim().toUpperCase(), instruction: instruction.value.trim() },
    })
    if (!res.ok || !res.proposal || !res.proposalRef) {
      error.value = res.error ?? '这份资料没有提炼出可用的产品信息'
      return
    }
    proposal.value = res.proposal
    proposalRef.value = res.proposalRef
    categories.value = (res.categories ?? []).map(c => ({ id: c.id, name: c.name }))
    chosenCategoryId.value = res.proposal.categoryId > 0 ? res.proposal.categoryId : (categories.value[0]?.id ?? 0)
    accept.summary = Boolean(res.proposal.summary)
    accept.seo = Boolean(res.proposal.seoTitle || res.proposal.seoDescription)
    accept.category = true
    accept.specs = res.proposal.specs.length > 0
    specChecked.value = res.proposal.specs.map(() => true)
    step.value = 'preview'
  }
  catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? '生成失败，请重试'
  }
  finally {
    busy.value = false
  }
}

async function publish() {
  error.value = ''
  notice.value = ''
  if (!proposal.value || !proposalRef.value) return
  if (accept.category && !chosenCategoryId.value) { error.value = '请选择技术分类'; return }

  busy.value = true
  try {
    const specIndexes = specChecked.value.map((on: boolean, i: number) => (on ? i : -1)).filter((i: number) => i >= 0)
    const res = await $fetch<{ ok: boolean, product?: CreatedProduct, specs?: { groups: number, items: number } }>(
      '/api/admin/products/intake/confirm',
      {
        method: 'POST',
        body: {
          proposalRef: proposalRef.value,
          productCode: productCode.value.trim().toUpperCase(),
          acceptSummary: accept.summary,
          acceptSeo: accept.seo,
          acceptCategory: accept.category,
          acceptSpecs: accept.specs,
          categoryId: chosenCategoryId.value,
          specIndexes,
        },
      },
    )
    if (!res.ok || !res.product) {
      error.value = '创建失败：服务端没有返回产品'
      return
    }
    result.value = res.product
    proposal.value = null
    proposalRef.value = ''
    picked.value = null
    step.value = 'done'
  }
  catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? '创建或发布失败'
  }
  finally {
    busy.value = false
  }
}

function startOver() {
  step.value = 'pick'
  proposal.value = null
  proposalRef.value = ''
  fileId.value = ''
  fileName.value = ''
  picked.value = null
  productCode.value = ''
  instruction.value = ''
  specChecked.value = []
  result.value = null
  error.value = ''
  notice.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">从资料导入产品</h1>
      <p class="page-sub">
        上传一份资料，指定品号，AI 提炼产品信息。你确认后一次点击就会创建并发布。
        <strong>图片仍需人工上传。</strong>
      </p>
    </div>

    <p v-if="error" class="banner banner--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="banner banner--ok" role="status">{{ notice }}</p>

    <!-- 1. 选择资料 + 品号 -->
    <section v-if="step === 'pick'" class="card">
      <h2 class="card-title">1. 资料与品号</h2>

      <div class="field">
        <label for="intake-file">资料文件</label>
        <input id="intake-file" type="file" accept=".pdf,.docx,.xlsx,.txt,.csv,.tsv,.jpg,.jpeg,.png,.webp" @change="onPick">
        <p class="hint">支持 PDF、Word(.docx)、Excel(.xlsx)、TXT/CSV、图片（JPG/PNG/WebP）。</p>
        <p v-if="picked" class="picked">已选择：{{ picked.name }}（{{ Math.round(picked.size / 1024) }} KB）</p>
      </div>

      <div class="field">
        <label for="intake-code">品号 <em>*</em></label>
        <input
          id="intake-code"
          v-model="productCode"
          type="text"
          placeholder="例如 LT-180C"
          :class="{ 'is-error': productCode && !codeOk }"
        >
        <p class="hint">可以自己编，不必与资料里写的一致；创建前会检查是否与已有产品重复。</p>
      </div>

      <div class="field">
        <label for="intake-note">对 AI 的要求（可选）</label>
        <textarea id="intake-note" v-model="instruction" rows="3" placeholder="例如：只提取本型号的参数；摘要控制在两句；按资料原文单位。" />
      </div>

      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="busy || !picked || !codeOk" @click="generate">
          {{ busy ? '读取并提炼中…' : '读取资料并生成提案' }}
        </button>
        <span class="hint">这一步只生成提案，不会创建产品。</span>
      </div>
    </section>

    <!-- 2. 预览 + 勾选 -->
    <section v-if="step === 'preview' && proposal" class="card">
      <h2 class="card-title">2. 预览与取舍</h2>
      <p class="hint">
        来自资料：{{ fileName }}。没勾选的项不会写入；分类可以改。
      </p>

      <div class="field">
        <label>产品名称</label>
        <input :value="proposal.name" type="text" readonly>
        <p class="hint">名称是必填项，来自资料；如需修改，请在产品编辑页改（创建后）。</p>
      </div>

      <div class="field">
        <label>型号 / 系列</label>
        <input :value="proposal.modelOrSeries || '（资料未写）'" type="text" readonly>
      </div>

      <div class="field">
        <label class="check">
          <input v-model="accept.category" type="checkbox">
          <span>技术分类 <em>*</em></span>
        </label>
        <select v-model.number="chosenCategoryId" :disabled="!accept.category">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="field">
        <label class="check">
          <input v-model="accept.summary" type="checkbox">
          <span>摘要</span>
        </label>
        <textarea :value="proposal.summary || '（资料未写）'" rows="3" readonly />
      </div>

      <div class="field">
        <label class="check">
          <input v-model="accept.seo" type="checkbox">
          <span>SEO 标题与描述</span>
        </label>
        <input :value="proposal.seoTitle || '（资料未写）'" type="text" readonly>
        <textarea :value="proposal.seoDescription || '（资料未写）'" rows="2" readonly />
      </div>

      <div class="field">
        <label class="check">
          <input v-model="accept.specs" type="checkbox">
          <span>参数（{{ specCount }} / {{ proposal.specs.length }} 条会被写入）</span>
        </label>
        <p v-if="!proposal.specs.length" class="hint">资料里没有可提炼的参数。</p>
        <table v-else class="specs" :class="{ 'is-off': !accept.specs }">
          <thead><tr><th /><th>分组</th><th>参数</th><th>值</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in proposal.specs" :key="`${s.group}-${s.parameter}-${i}`">
              <td><input v-model="specChecked[i]" type="checkbox" :disabled="!accept.specs"></td>
              <td>{{ s.group }}</td>
              <td>{{ s.parameter }}</td>
              <td>{{ s.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="publish">
          {{ busy ? '创建并发布中…' : '确认并发布' }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="generate">重新生成</button>
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="startOver">放弃</button>
      </div>
      <p class="hint">点一次就会：创建产品（草稿）→ 写参数 → 走审核 → 发布。图片不会自动加。</p>
    </section>

    <!-- 3. 完成 -->
    <section v-if="step === 'done' && result" class="card">
      <h2 class="card-title">3. 已创建并发布</h2>
      <ul class="result">
        <li><span>产品</span><strong>{{ result.name }}</strong></li>
        <li><span>品号</span><code>{{ result.productCode }}</code></li>
        <li><span>公开地址</span><code>/products/…/{{ result.slug }}</code></li>
      </ul>
      <div class="actions">
        <NuxtLink :to="`/admin/products/${result.id}`" class="btn btn-primary">打开产品编辑</NuxtLink>
        <button type="button" class="btn" @click="startOver">再导入一份</button>
      </div>
      <p class="hint">记得去媒体库给这个产品上传图片——那一步是人工的。</p>
    </section>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); max-width: 1000px; }
.page-header { margin-bottom: var(--space-6); }
.back-link { display: block; margin-bottom: var(--space-3); font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.back-link:hover { text-decoration: underline; }
.page-title { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); }
.page-sub { margin: var(--space-2) 0 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

.banner { padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); margin-bottom: var(--space-4); }
.banner--error { background: #FDF0EE; border: 1px solid #F5C6C2; color: #C0392B; }
.banner--ok { background: #D1F0E8; border: 1px solid #A3DBC8; color: #2F6B3A; }

.card {
  background: #fff;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-bottom: var(--space-5);
}
.card-title { margin: 0 0 var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-line); font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-4); }
.field > label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.field em { color: var(--color-primary); font-style: normal; }
.field input[type='text'], .field textarea, .field select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #B9C8BF;
  border-radius: var(--radius-sm);
  background: #fff;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-ink);
}
.field input[readonly], .field textarea[readonly] { background: #F7F9F7; }
.field input.is-error { border-color: #B4451F; }
.field textarea { resize: vertical; }
.check { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); font-weight: 600; }
.check input { accent-color: var(--color-primary); }

.hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-ink-muted); }
.picked { margin: 0; font-size: 12px; color: #2F6B3A; }

.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }
.btn { min-height: 42px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: #fff; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
.btn-ghost { border-color: transparent; color: var(--color-ink-muted); }
.btn:disabled { opacity: .6; cursor: default; }

.specs { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.specs th { text-align: left; padding: 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-ink-muted); border-bottom: 1px solid var(--color-line); }
.specs td { padding: 8px; border-bottom: 1px solid #EEF2EF; color: var(--color-ink); }
.specs.is-off { opacity: .45; }
.specs input { accent-color: var(--color-primary); }

.result { list-style: none; margin: 0; padding: 0; }
.result li { display: flex; gap: var(--space-3); padding: 8px 0; border-bottom: 1px solid #EEF2EF; font-size: var(--text-sm); }
.result li span { width: 90px; color: var(--color-ink-muted); }
.result code { font-family: monospace; font-size: 13px; }

@media (max-width: 720px) {
  .page { padding: var(--space-4); }
  .card { padding: var(--space-4); }
  .specs th:nth-child(2), .specs td:nth-child(2) { display: none; }
}
</style>
