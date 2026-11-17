<script setup lang="ts">
/**
 * 从资料导入产品（批量）—— 一次最多 10 份，逐份提炼、逐份确认、逐份发布。
 *
 * 刻意不做"全部发布"：每份产品的分类、摘要、参数都可能需要人看一眼，批量发布会把一处错误放大成
 * 十处。这里只批量"读取和提炼"，发布永远是一份一次。
 *
 * 单份导入也走同一套队列（长度为 1），所以不存在两套行为不一致的代码路径。
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

type Status = 'idle' | 'working' | 'ready' | 'error' | 'published'

interface Item {
  key: string
  file: File
  code: string
  fileId: string
  status: Status
  error: string
  proposal: Proposal | null
  proposalRef: string
  categories: Category[]
  chosenCategoryId: number
  accept: { summary: boolean, seo: boolean, category: boolean, specs: boolean }
  specChecked: boolean[]
  product: CreatedProduct | null
}

const MAX_FILES = 10

const items = ref<Item[]>([])
const selectedKey = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')

const selected = computed(() => items.value.find((i: Item) => i.key === selectedKey.value) ?? null)
const readyCount = computed(() => items.value.filter((i: Item) => i.status === 'ready').length)
const doneCount = computed(() => items.value.filter((i: Item) => i.status === 'published').length)
const errorCount = computed(() => items.value.filter((i: Item) => i.status === 'error').length)
const specCount = computed(() => selected.value?.specChecked.filter((on: boolean) => on).length ?? 0)

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$|^[A-Z0-9]$/

/** 从文件名推一个品号候选，让人少打字；是否重复由服务端在发布前拦截。 */
function codeFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  error.value = ''
  notice.value = ''
  if (files.length === 0) return
  if (items.value.length + files.length > MAX_FILES) {
    error.value = `一次最多 ${MAX_FILES} 份。当前已有 ${items.value.length} 份，请先清空或处理完再选。`
    return
  }
  for (const file of files) {
    items.value.push({
      key: `${file.name}::${file.size}::${Date.now()}::${items.value.length}`,
      file,
      code: codeFromFilename(file.name),
      fileId: '',
      status: 'idle',
      error: '',
      proposal: null,
      proposalRef: '',
      categories: [],
      chosenCategoryId: 0,
      accept: { summary: true, seo: true, category: true, specs: true },
      specChecked: [],
      product: null,
    })
  }
  notice.value = `已加入 ${files.length} 份资料，逐份生成后可分别确认发布。`
}

function removeItem(key: string) {
  items.value = items.value.filter((i: Item) => i.key !== key)
  if (selectedKey.value === key) selectedKey.value = items.value[0]?.key ?? ''
}

function clearAll() {
  items.value = []
  selectedKey.value = ''
  error.value = ''
  notice.value = ''
}

async function uploadFile(item: Item): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', item.file, item.file.name)
  const res = await $fetch<{ uploaded?: Array<{ id: string }>, errors?: Array<{ message: string }> }>(
    '/api/admin/media/upload',
    { method: 'POST', body: fd },
  )
  if (res.errors?.length) {
    item.error = res.errors[0]?.message ?? '上传失败'
    return null
  }
  const id = res.uploaded?.[0]?.id
  if (!id) {
    item.error = '上传失败：没有返回文件信息'
    return null
  }
  return id
}

async function generateOne(item: Item): Promise<boolean> {
  item.status = 'working'
  item.error = ''
  try {
    if (!CODE_RE.test(item.code.trim().toUpperCase())) {
      item.status = 'error'
      item.error = '品号只能使用大写字母、数字和连字符（例如 LT-180C）'
      return false
    }
    let id = item.fileId
    if (!id) {
      id = (await uploadFile(item)) ?? ''
      if (!id) { item.status = 'error'; return false }
      item.fileId = id
    }

    const res = await $fetch<{
      ok: boolean
      error?: string
      proposal?: Proposal
      proposalRef?: string
      categories?: Array<{ id: number, name: string }>
    }>('/api/admin/products/intake/proposal', {
      method: 'POST',
      body: { fileId: id, productCode: item.code.trim().toUpperCase(), instruction: '' },
    })
    if (!res.ok || !res.proposal || !res.proposalRef) {
      item.status = 'error'
      item.error = res.error ?? '这份资料没有提炼出可用的产品信息'
      return false
    }
    item.proposal = res.proposal
    item.proposalRef = res.proposalRef
    item.categories = (res.categories ?? []).map(c => ({ id: c.id, name: c.name }))
    item.chosenCategoryId = res.proposal.categoryId > 0 ? res.proposal.categoryId : (item.categories[0]?.id ?? 0)
    item.accept.summary = Boolean(res.proposal.summary)
    item.accept.seo = Boolean(res.proposal.seoTitle || res.proposal.seoDescription)
    item.accept.category = true
    item.accept.specs = res.proposal.specs.length > 0
    item.specChecked = res.proposal.specs.map(() => true)
    item.status = 'ready'
    return true
  }
  catch (e: unknown) {
    item.status = 'error'
    item.error = (e as { data?: { message?: string } })?.data?.message ?? '生成失败'
    return false
  }
}

/** 逐份处理：一份失败不影响后面几份，失败原因留在那一行。 */
async function generateAll() {
  error.value = ''
  notice.value = ''
  const pending = items.value.filter((i: Item) => i.status === 'idle' || i.status === 'error')
  if (pending.length === 0) { error.value = '没有待处理的资料'; return }
  busy.value = true
  let ok = 0
  try {
    for (const item of pending) {
      const success = await generateOne(item)
      if (success) ok += 1
      if (!selectedKey.value) selectedKey.value = item.key
      await new Promise(r => setTimeout(r, 300))
    }
    notice.value = `生成完成：成功 ${ok} 份，失败 ${pending.length - ok} 份。`
  }
  finally {
    busy.value = false
  }
}

async function publishItem(item: Item) {
  if (!item.proposal || !item.proposalRef) return
  if (item.accept.category && !item.chosenCategoryId) {
    item.error = '请选择技术分类'
    return
  }
  item.status = 'working'
  item.error = ''
  try {
    const specIndexes = item.specChecked.map((on: boolean, i: number) => (on ? i : -1)).filter((i: number) => i >= 0)
    const res = await $fetch<{ ok: boolean, product?: CreatedProduct }>('/api/admin/products/intake/confirm', {
      method: 'POST',
      body: {
        proposalRef: item.proposalRef,
        productCode: item.code.trim().toUpperCase(),
        acceptSummary: item.accept.summary,
        acceptSeo: item.accept.seo,
        acceptCategory: item.accept.category,
        acceptSpecs: item.accept.specs,
        categoryId: item.chosenCategoryId,
        specIndexes,
      },
    })
    if (!res.ok || !res.product) {
      item.status = 'error'
      item.error = '创建失败：服务端没有返回产品'
      return
    }
    item.product = res.product
    item.status = 'published'
    item.proposal = null
    item.proposalRef = ''
    notice.value = `${res.product.productCode} 已创建并发布。`
  }
  catch (e: unknown) {
    item.status = 'error'
    item.error = (e as { data?: { message?: string } })?.data?.message ?? '创建或发布失败'
  }
}

const statusLabel: Record<Status, string> = {
  idle: '待生成',
  working: '处理中…',
  ready: '待确认',
  error: '失败',
  published: '已发布',
}

function label(status: Status): string {
  return statusLabel[status]
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/products" class="back-link">← 产品列表</NuxtLink>
      <h1 class="page-title">从资料导入产品</h1>
      <p class="page-sub">
        一次最多 {{ MAX_FILES }} 份。逐份提炼、逐份确认、逐份发布——不会批量发布，也不会自动加图片。
      </p>
    </div>

    <p v-if="error" class="banner banner--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="banner banner--ok" role="status">{{ notice }}</p>

    <section class="card">
      <h2 class="card-title">1. 选择资料（最多 {{ MAX_FILES }} 份）</h2>
      <div class="field">
        <input type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.csv,.tsv,.jpg,.jpeg,.png,.webp" @change="onPick">
        <p class="hint">支持 PDF、Word(.docx)、Excel(.xlsx)、TXT/CSV、图片（JPG/PNG/WebP）。品号按文件名自动填写，可改。</p>
      </div>

      <table v-if="items.length" class="queue">
        <thead>
          <tr><th>文件</th><th>品号</th><th>状态</th><th><span class="sr">操作</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.key" :class="{ 'row--on': item.key === selectedKey }" @click="selectedKey = item.key">
            <td class="cell-file">{{ item.file.name }}</td>
            <td><input v-model="item.code" class="code-input" type="text" @click.stop></td>
            <td>
              <span class="chip" :class="`chip--${item.status}`">{{ label(item.status) }}</span>
              <span v-if="item.error" class="row-error">{{ item.error }}</span>
            </td>
            <td><button type="button" class="link-btn" @click.stop="removeItem(item.key)">移除</button></td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="busy || !items.length" @click="generateAll">
          {{ busy ? '逐份提炼中…' : '逐份生成提案' }}
        </button>
        <button type="button" class="btn" :disabled="busy || !items.length" @click="clearAll">清空</button>
        <span class="hint">待确认 {{ readyCount }} 份 · 已发布 {{ doneCount }} 份 · 失败 {{ errorCount }} 份</span>
      </div>
    </section>

    <section v-if="selected" class="card">
      <h2 class="card-title">2. 确认：{{ selected.file.name }}</h2>

      <p v-if="selected.status === 'idle'" class="hint">还没生成，点上面的「逐份生成提案」。</p>
      <p v-else-if="selected.status === 'working'" class="hint">处理中…</p>
      <p v-else-if="selected.status === 'error'" class="banner banner--error" role="alert">{{ selected.error }}</p>

      <template v-if="selected.status === 'published' && selected.product">
        <ul class="result">
          <li><span>产品</span><strong>{{ selected.product.name }}</strong></li>
          <li><span>品号</span><code>{{ selected.product.productCode }}</code></li>
          <li><span>公开地址</span><code>/products/…/{{ selected.product.slug }}</code></li>
        </ul>
        <div class="actions">
          <NuxtLink :to="`/admin/products/${selected.product.id}`" class="btn btn-primary">打开产品编辑</NuxtLink>
          <button type="button" class="btn" @click="removeItem(selected.key)">从队列移除</button>
        </div>
      </template>

      <template v-else-if="selected.proposal">
        <div class="field">
          <label>产品名称（来自资料）</label>
          <input :value="selected.proposal.name" type="text" readonly>
        </div>
        <div class="field">
          <label>型号 / 系列</label>
          <input :value="selected.proposal.modelOrSeries || '（资料未写）'" type="text" readonly>
        </div>

        <div class="field">
          <label class="check">
            <input v-model="selected.accept.category" type="checkbox">
            <span>技术分类 <em>*</em></span>
          </label>
          <select v-model.number="selected.chosenCategoryId" :disabled="!selected.accept.category">
            <option v-for="c in selected.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="field">
          <label class="check">
            <input v-model="selected.accept.summary" type="checkbox">
            <span>摘要</span>
          </label>
          <textarea :value="selected.proposal.summary || '（资料未写）'" rows="3" readonly />
        </div>

        <div class="field">
          <label class="check">
            <input v-model="selected.accept.seo" type="checkbox">
            <span>SEO 标题与描述</span>
          </label>
          <input :value="selected.proposal.seoTitle || '（资料未写）'" type="text" readonly>
          <textarea :value="selected.proposal.seoDescription || '（资料未写）'" rows="2" readonly />
        </div>

        <div class="field">
          <label class="check">
            <input v-model="selected.accept.specs" type="checkbox">
            <span>参数（{{ specCount }} / {{ selected.proposal.specs.length }} 条会被写入）</span>
          </label>
          <p v-if="!selected.proposal.specs.length" class="hint">资料里没有可提炼的参数。</p>
          <table v-else class="specs" :class="{ 'is-off': !selected.accept.specs }">
            <thead><tr><th /><th>分组</th><th>参数</th><th>值</th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in selected.proposal.specs" :key="`${s.group}-${s.parameter}-${i}`">
                <td><input v-model="selected.specChecked[i]" type="checkbox" :disabled="!selected.accept.specs"></td>
                <td>{{ s.group }}</td>
                <td>{{ s.parameter }}</td>
                <td>{{ s.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary" :disabled="selected.status === 'working'" @click="publishItem(selected)">
            {{ selected.status === 'working' ? '创建并发布中…' : '确认并发布这一份' }}
          </button>
          <button type="button" class="btn" :disabled="selected.status === 'working'" @click="generateOne(selected)">重新生成</button>
        </div>
        <p class="hint">发布只作用于这一份。点一次＝建草稿 → 写参数 → 审核 → 发布。</p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.page { padding: var(--space-8); max-width: 1100px; }
.page-header { margin-bottom: var(--space-6); }
.back-link { display: block; margin-bottom: var(--space-3); font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.back-link:hover { text-decoration: underline; }
.page-title { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--color-ink); }
.page-sub { margin: var(--space-2) 0 0; font-size: var(--text-sm); line-height: 1.6; color: var(--color-ink-muted); }

.banner { padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); margin-bottom: var(--space-4); }
.banner--error { background: #FDF0EE; border: 1px solid #F5C6C2; color: #C0392B; }
.banner--ok { background: #D1F0E8; border: 1px solid #A3DBC8; color: #2F6B3A; }

.card { background: #fff; border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-6); margin-bottom: var(--space-5); }
.card-title { margin: 0 0 var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-line); font-size: var(--text-base); font-weight: 600; color: var(--color-ink); }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-4); }
.field > label { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.field em { color: var(--color-primary); font-style: normal; }
.field input[type='text'], .field textarea, .field select {
  width: 100%; padding: 10px 12px; border: 1px solid #B9C8BF; border-radius: var(--radius-sm);
  background: #fff; font: inherit; font-size: var(--text-sm); color: var(--color-ink);
}
.field input[readonly], .field textarea[readonly] { background: #F7F9F7; }
.field textarea { resize: vertical; }
.check { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); font-weight: 600; }
.check input { accent-color: var(--color-primary); }

.hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-ink-muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.queue { width: 100%; border-collapse: collapse; margin-bottom: var(--space-4); font-size: var(--text-sm); }
.queue th { text-align: left; padding: 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-ink-muted); border-bottom: 1px solid var(--color-line); }
.queue td { padding: 8px; border-bottom: 1px solid #EEF2EF; vertical-align: middle; }
.queue tr { cursor: pointer; }
.row--on { background: #F4F7F2; }
.cell-file { max-width: 320px; overflow-wrap: anywhere; }
.code-input { width: 160px; padding: 6px 8px; border: 1px solid #B9C8BF; border-radius: var(--radius-sm); font: inherit; font-size: 13px; text-transform: uppercase; }
.row-error { display: block; margin-top: 4px; font-size: 11px; line-height: 1.4; color: #B42318; }

.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #F0F2F4; color: #52606D; }
.chip--ready { background: #FFF4E8; color: #945A20; }
.chip--working { background: #EDF4FC; color: #2563A6; }
.chip--error { background: #FFF1EF; color: #B42318; }
.chip--published { background: #EEF5EF; color: #2F6B3A; }

.link-btn { background: none; border: 0; padding: 0; font: inherit; font-size: 13px; color: var(--color-primary); cursor: pointer; }

.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }
.btn { min-height: 42px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: #fff; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
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
  .queue th:nth-child(1), .queue td:nth-child(1) { display: none; }
}
</style>
