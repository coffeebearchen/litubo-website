<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * The admin assistant, present on every admin page in the top-right corner.
 *
 * It exists because the same three things are useful wherever the editor happens to be standing: write
 * the search metadata for the item in front of me, describe the picture I have open, and let me fix a
 * value without hunting for the right tab. So it lives in the layout, not in a page.
 *
 * What it may write is deliberately small: a search title and description for one article or content
 * item, or the alt text of one Media Library file - each for one named record, only after the person
 * presses save. The record is read from the URL and sent explicitly, so the server never has to guess
 * which item a panel floating over another page meant.
 *
 * The colours are a bright clash (magenta into orange) against the admin's green: this is a control
 * that must be findable at a glance, and it is the one thing in the shell that is not part of the
 * site's own palette.
 */
interface SeoProposal {
  seoTitle: string
  seoDescription: string
}

type Context =
  | { kind: 'post', id: number, label: string }
  | { kind: 'contentItem', id: number, label: string }
  | { kind: 'media', id: string, label: string }
  | { kind: 'category', id: number, label: string }
  | { kind: 'product', id: number, label: string }

const route = useRoute()

const open = ref(false)
/** 折叠后只留标题栏，方便一边看生成结果、一边看被面板挡住的那部分表单。 */
const collapsed = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')

/**
 * 拖动：面板是浮层，会挡住它本该帮着修改的表单。按住标题栏就能把它挪开，位置只活在这次会话里
 * （刷新回到右上角），因为记住一个被拖到奇怪位置的固定面板，比每次都回到默认位置更烦人。
 */
const dragX = ref(0)
const dragY = ref(0)
const dragging = ref(false)
let dragStart = { x: 0, y: 0, baseX: 0, baseY: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function startDrag(event: PointerEvent) {
  // 标题栏上的按钮（折叠、关闭）不是拖动手柄。
  if ((event.target as HTMLElement | null)?.closest('button')) return
  dragging.value = true
  dragStart = { x: event.clientX, y: event.clientY, baseX: dragX.value, baseY: dragY.value }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
}

function onDrag(event: PointerEvent) {
  if (!dragging.value) return
  const panel = document.getElementById('admin-ai-panel')
  const width = panel?.offsetWidth ?? 420
  const height = panel?.offsetHeight ?? 300
  // 允许在视口内移动，不让面板被拖出屏幕（右上角是原点，所以 x 只能为负、y 有上下限）。
  dragX.value = clamp(dragStart.baseX + (event.clientX - dragStart.x), -(window.innerWidth - width - 32), 0)
  dragY.value = clamp(dragStart.baseY + (event.clientY - dragStart.y), -(window.innerHeight - height - 24), 160)
}

function endDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
}

const proposalRef = ref('')
const draftTitle = ref('')
const draftDescription = ref('')

const altRef = ref('')
const altDraft = ref('')

// 分类：介绍 + 两个 SEO 字段
const catRef = ref('')
const catIntro = ref('')
const catTitle = ref('')
const catDescription = ref('')

// 产品：复用已有的文案 AI（草稿才可用）
const productRef = ref('')
const productSummary = ref('')
const productSeoTitle = ref('')
const productSeoDescription = ref('')
const productCategoryName = ref('')

const savedText = ref('')

// 批量：媒体页可用，一次最多 5 张，逐条确认后才写
interface BatchRow {
  fileId: string
  filename: string
  productName: string | null
  altText: string
  proposalRef: string
  error: string
}
const batchBusy = ref(false)
const batchRows = ref<BatchRow[]>([])
const batchMeta = ref<{ scanned: number, undescribed: number } | null>(null)

const TITLE_IDEAL = { min: 30, max: 65 }
const DESCRIPTION_IDEAL = { min: 70, max: 165 }
const ALT_IDEAL = 125

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Which record the panel is looking at, read from the admin URL. */
const context = computed<Context | null>(() => {
  const path = route.path

  const content = /^\/admin\/content-center\/(\d+)(?:\/|$)/.exec(path)
  if (content) return { kind: 'contentItem', id: Number(content[1]), label: `Content item #${content[1]}` }

  // The posts editor is a single page with a list; it puts the open article in ?id=.
  if (path === '/admin/posts' || path === '/admin/posts/') {
    const id = String(route.query.id ?? '')
    if (/^\d+$/.test(id)) return { kind: 'post', id: Number(id), label: `Article #${id}` }
  }

  // The media library is also a single page; it puts the open file in ?id=.
  if (path.startsWith('/admin/media')) {
    const fileId = String(route.query.id ?? '')
    if (UUID_RE.test(fileId)) return { kind: 'media', id: fileId, label: 'Media file' }
  }

  // A single product category editor.
  const category = /^\/admin\/products\/categories\/(\d+)(?:\/|$)/.exec(path)
  if (category) return { kind: 'category', id: Number(category[1]), label: `Category #${category[1]}` }

  // A single product editor. `/new`, `/import` and the categories index do not match the id pattern.
  const product = /^\/admin\/products\/(\d+)(?:\/|$)/.exec(path)
  if (product) return { kind: 'product', id: Number(product[1]), label: `Product #${product[1]}` }

  return null
})

const contextText = computed(() => context.value?.label ?? 'No single item on this page')
const actionLabel = computed(() => {
  const kind = context.value?.kind
  if (!kind) return 'Nothing to write here'
  if (kind === 'media') return 'Write this file’s alt text'
  if (kind === 'category') return 'Write this category’s intro'
  if (kind === 'product') return 'Suggest this product’s copy'
  return 'Write this page’s SEO'
})

function resetProposal() {
  proposalRef.value = ''
  draftTitle.value = ''
  draftDescription.value = ''
  altRef.value = ''
  altDraft.value = ''
  catRef.value = ''
  catIntro.value = ''
  catTitle.value = ''
  catDescription.value = ''
  productRef.value = ''
  productSummary.value = ''
  productSeoTitle.value = ''
  productSeoDescription.value = ''
  productCategoryName.value = ''
}

function openPanel() {
  open.value = true
  collapsed.value = false
  error.value = ''
  notice.value = ''
  savedText.value = ''
}

function closePanel() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) closePanel()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function describeError(e: unknown, fallback: string): string {
  const fe = e as { data?: { message?: string, statusCode?: number }, statusCode?: number }
  const status = fe?.data?.statusCode ?? fe?.statusCode
  if (status === 401) return 'Your session expired. Sign in again.'
  return fe?.data?.message ?? fallback
}

async function suggest() {
  const ctx = context.value
  if (!ctx || busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  resetProposal()
  savedText.value = ''
  try {
    if (ctx.kind === 'media') {
      const res = await $fetch<{
        ok: boolean
        unavailable?: boolean
        error?: string
        proposal?: { altText: string }
        proposalRef?: string
        reused?: boolean
      }>('/api/admin/ai/media-alt-proposal', { method: 'POST', body: { fileId: ctx.id } })
      if (!res.ok || !res.proposal) {
        error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'No suggestion could be generated.')
        return
      }
      altRef.value = res.proposalRef ?? ''
      altDraft.value = res.proposal.altText
      notice.value = res.reused ? 'This is the suggestion already generated for this file.' : ''
      if (!res.proposal.altText) {
        error.value = 'The file name gives the model nothing to describe. Look at the picture and write the alt yourself.'
      }
      return
    }

    if (ctx.kind === 'category') {
      const res = await $fetch<{
        ok: boolean
        unavailable?: boolean
        error?: string
        proposal?: { intro: string, seoTitle: string, seoDescription: string }
        proposalRef?: string
        reused?: boolean
        productCount?: number
      }>('/api/admin/ai/category-proposal', { method: 'POST', body: { id: ctx.id } })
      if (!res.ok || !res.proposal) {
        error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'The suggestion could not be generated.')
        return
      }
      catRef.value = res.proposalRef ?? ''
      catIntro.value = res.proposal.intro
      catTitle.value = res.proposal.seoTitle
      catDescription.value = res.proposal.seoDescription
      notice.value = res.reused
        ? 'This is the suggestion already generated for this category.'
        : `Based on ${res.productCount ?? 0} published products in this category.`
      return
    }

    if (ctx.kind === 'product') {
      const res = await $fetch<{
        ok: boolean
        unavailable?: boolean
        error?: string
        proposal?: { summary: string, seoTitle: string, seoDescription: string, categoryId: number | null }
        proposalRef?: string
        reused?: boolean
        categories?: Array<{ id: number, name: string }>
      }>(`/api/admin/products/${ctx.id}/ai-listing-proposal`, { method: 'POST', body: {} })
      if (!res.ok || !res.proposal) {
        error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'The suggestion could not be generated.')
        return
      }
      productRef.value = res.proposalRef ?? ''
      productSummary.value = res.proposal.summary
      productSeoTitle.value = res.proposal.seoTitle
      productSeoDescription.value = res.proposal.seoDescription
      productCategoryName.value = (res.categories ?? []).find(c => c.id === res.proposal?.categoryId)?.name ?? ''
      notice.value = res.reused ? 'This is the suggestion already generated for this product.' : ''
      return
    }

    const res = await $fetch<{
      ok: boolean
      unavailable?: boolean
      error?: string
      proposal?: SeoProposal
      proposalRef?: string
      reused?: boolean
    }>('/api/admin/ai/seo-proposal', { method: 'POST', body: { entity: ctx.kind, id: ctx.id } })
    if (!res.ok || !res.proposal) {
      error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'The suggestion could not be generated.')
      return
    }
    proposalRef.value = res.proposalRef ?? ''
    draftTitle.value = res.proposal.seoTitle
    draftDescription.value = res.proposal.seoDescription
    notice.value = res.reused ? 'This is the suggestion already generated for this item.' : ''
  }
  catch (e: unknown) {
    error.value = describeError(e, 'The suggestion could not be generated.')
  }
  finally {
    busy.value = false
  }
}

async function saveSeo() {
  const ctx = context.value
  if (!ctx || ctx.kind === 'media' || !proposalRef.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok: boolean, saved: SeoProposal }>('/api/admin/ai/seo-confirm', {
      method: 'POST',
      body: {
        entity: ctx.kind,
        id: ctx.id,
        proposalRef: proposalRef.value,
        seoTitle: draftTitle.value,
        seoDescription: draftDescription.value,
      },
    })
    savedText.value = `${res.saved.seoTitle}\n${res.saved.seoDescription}`
    notice.value = 'Saved. Reload the page to see the stored values in the form.'
    resetProposal()
  }
  catch (e: unknown) {
    error.value = describeError(e, 'Saving failed.')
  }
  finally {
    busy.value = false
  }
}

async function saveAlt() {
  const ctx = context.value
  if (!ctx || ctx.kind !== 'media' || !altRef.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok: boolean, altText: string }>('/api/admin/ai/media-alt-confirm', {
      method: 'POST',
      body: { fileId: ctx.id, proposalRef: altRef.value, altText: altDraft.value },
    })
    savedText.value = res.altText
    notice.value = 'Saved. Reload the page to see the stored alt text.'
    resetProposal()
  }
  catch (e: unknown) {
    error.value = describeError(e, 'Saving failed.')
  }
  finally {
    busy.value = false
  }
}

async function saveCategory() {
  const ctx = context.value
  if (!ctx || ctx.kind !== 'category' || !catRef.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok: boolean, saved: { intro: string, seoTitle: string, seoDescription: string } }>(
      '/api/admin/ai/category-confirm',
      {
        method: 'POST',
        body: {
          id: ctx.id,
          proposalRef: catRef.value,
          intro: catIntro.value,
          seoTitle: catTitle.value,
          seoDescription: catDescription.value,
        },
      },
    )
    savedText.value = `${res.saved.intro}\n${res.saved.seoTitle}\n${res.saved.seoDescription}`
    notice.value = 'Saved. Reload the page to see the stored values.'
    resetProposal()
  }
  catch (e: unknown) {
    error.value = describeError(e, 'Saving failed.')
  }
  finally {
    busy.value = false
  }
}

async function saveProduct() {
  const ctx = context.value
  if (!ctx || ctx.kind !== 'product' || !productRef.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/products/${ctx.id}/ai-listing-confirm`, {
      method: 'POST',
      body: {
        proposalRef: productRef.value,
        // 只写入这三项；分类归属不在面板里改（那是另一个决定）。
        acceptSummary: true,
        acceptSeoTitle: true,
        acceptSeoDescription: true,
        acceptCategory: false,
      },
    })
    savedText.value = `${productSummary.value}\n${productSeoTitle.value}\n${productSeoDescription.value}`
    notice.value = 'Saved. Reload the page to see the stored values.'
    resetProposal()
  }
  catch (e: unknown) {
    error.value = describeError(e, 'Saving failed.')
  }
  finally {
    busy.value = false
  }
}

async function runBatch() {
  if (batchBusy.value) return
  batchBusy.value = true
  error.value = ''
  notice.value = ''
  batchRows.value = []
  batchMeta.value = null
  try {
    const res = await $fetch<{
      ok: boolean
      unavailable?: boolean
      error?: string
      scanned: number
      undescribed: number
      rows: BatchRow[]
    }>('/api/admin/ai/media-alt-batch', { method: 'POST', body: { limit: 5 } })
    if (!res.ok) {
      error.value = res.unavailable ? 'AI is not configured on this server yet.' : (res.error ?? 'The batch could not run.')
      return
    }
    batchRows.value = res.rows
    batchMeta.value = { scanned: res.scanned, undescribed: res.undescribed }
  }
  catch (e: unknown) {
    error.value = describeError(e, 'The batch could not run.')
  }
  finally {
    batchBusy.value = false
  }
}

async function saveBatchRow(row: BatchRow) {
  if (!row.proposalRef || !row.altText.trim()) return
  error.value = ''
  try {
    await $fetch('/api/admin/ai/media-alt-confirm', {
      method: 'POST',
      body: { fileId: row.fileId, proposalRef: row.proposalRef, altText: row.altText },
    })
    row.proposalRef = ''
    row.error = ''
    notice.value = `Saved: ${row.filename}`
  }
  catch (e: unknown) {
    row.error = describeError(e, 'Saving failed.')
  }
}
</script>

<template>
  <div
    class="ai-assist"
    :class="{ 'is-dragging': dragging }"
    :style="{ transform: `translate(${dragX}px, ${dragY}px)` }"
  >
    <button
      type="button"
      class="ai-assist__launch"
      :aria-expanded="open"
      aria-controls="admin-ai-panel"
      @click="open ? closePanel() : openPanel()"
    >
      <span aria-hidden="true">✦</span>
      <span class="ai-assist__launch-text">AI</span>
    </button>

    <section
      v-if="open"
      id="admin-ai-panel"
      class="ai-assist__panel"
      aria-label="LITUBO AI assistant"
    >
      <header class="ai-assist__head" title="拖动可移动面板" @pointerdown="startDrag">
        <div>
          <p class="ai-assist__title">LITUBO AI</p>
          <p class="ai-assist__context">
            <span class="ai-assist__context-dot" aria-hidden="true" />
            {{ contextText }}
          </p>
        </div>
        <div class="ai-assist__head-actions">
          <button
            type="button"
            class="ai-assist__collapse"
            :aria-label="collapsed ? 'Expand assistant' : 'Collapse assistant'"
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
          >
            {{ collapsed ? '▾' : '▴' }}
          </button>
          <button type="button" class="ai-assist__close" aria-label="Close assistant" @click="closePanel">×</button>
        </div>
      </header>

      <div v-show="!collapsed">
        <p v-if="error" class="ai-assist__error" role="alert">{{ error }}</p>
        <p v-if="notice" class="ai-assist__notice">{{ notice }}</p>

        <div class="ai-assist__actions">
          <button
            type="button"
            class="ai-assist__action"
            :disabled="busy || !context"
            @click="suggest"
          >
            {{ busy ? 'Working…' : actionLabel }}
          </button>
          <p v-if="!context" class="ai-assist__hint">
            Open an article, a content item or a media file to use the assistant. This page has nothing to write to.
          </p>
        </div>

        <!-- 媒体库：批量描述没有 alt 的文件（逐条确认） -->
        <div v-if="route.path.startsWith('/admin/media')" class="ai-assist__batch">
          <div class="ai-assist__batch-head">
            <span class="ai-assist__label">Files with no alt text</span>
            <button type="button" class="ai-assist__ghost" :disabled="batchBusy" @click="runBatch">
              {{ batchBusy ? 'Working…' : 'Describe up to 5' }}
            </button>
          </div>
          <p v-if="batchMeta" class="ai-assist__hint">
            {{ batchMeta.undescribed }} of {{ batchMeta.scanned }} files have no description. Showing the next {{ batchRows.length }}.
          </p>
          <div v-for="row in batchRows" :key="row.fileId" class="ai-assist__batch-row">
            <p class="ai-assist__batch-name">{{ row.filename }}</p>
            <input v-model="row.altText" type="text" maxlength="160">
            <p v-if="row.error" class="ai-assist__batch-error">{{ row.error }}</p>
            <div class="ai-assist__row">
              <button
                type="button"
                class="ai-assist__save"
                :disabled="!row.proposalRef || !row.altText.trim()"
                @click="saveBatchRow(row)"
              >
                {{ row.proposalRef ? 'Save this one' : 'Saved' }}
              </button>
            </div>
          </div>
          <p class="ai-assist__hint">Each row is confirmed separately. Nothing is written until you press save on that row.</p>
        </div>

        <!-- 文章 / 内容项：SEO -->
        <div v-if="proposalRef" class="ai-assist__proposal">
          <p class="ai-assist__proposal-head">Review before saving</p>

          <label class="ai-assist__field">
            <span class="ai-assist__label">Search title</span>
            <input v-model="draftTitle" type="text" maxlength="120">
            <span class="ai-assist__count" :class="{ 'is-off': draftTitle.length < TITLE_IDEAL.min || draftTitle.length > TITLE_IDEAL.max }">
              {{ draftTitle.length }} / 120 · ideal {{ TITLE_IDEAL.min }}–{{ TITLE_IDEAL.max }}
            </span>
          </label>

          <label class="ai-assist__field">
            <span class="ai-assist__label">Search description</span>
            <textarea v-model="draftDescription" rows="4" maxlength="320" />
            <span class="ai-assist__count" :class="{ 'is-off': draftDescription.length < DESCRIPTION_IDEAL.min || draftDescription.length > DESCRIPTION_IDEAL.max }">
              {{ draftDescription.length }} / 320 · ideal {{ DESCRIPTION_IDEAL.min }}–{{ DESCRIPTION_IDEAL.max }}
            </span>
          </label>

          <div class="ai-assist__row">
            <button type="button" class="ai-assist__save" :disabled="busy" @click="saveSeo">Save these two fields</button>
            <button type="button" class="ai-assist__ghost" :disabled="busy" @click="resetProposal">Discard</button>
          </div>
          <p class="ai-assist__hint">Only the two fields above are written. Nothing else changes.</p>
        </div>

        <!-- 媒体文件：alt -->
        <div v-if="altRef" class="ai-assist__proposal">
          <p class="ai-assist__proposal-head">Review before saving</p>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Alt text</span>
            <textarea v-model="altDraft" rows="3" maxlength="160" />
            <span class="ai-assist__count" :class="{ 'is-off': altDraft.length > ALT_IDEAL }">
              {{ altDraft.length }} / 160 · ideal ≤ {{ ALT_IDEAL }}
            </span>
          </label>
          <div class="ai-assist__row">
            <button type="button" class="ai-assist__save" :disabled="busy" @click="saveAlt">Save the alt text</button>
            <button type="button" class="ai-assist__ghost" :disabled="busy" @click="resetProposal">Discard</button>
          </div>
          <p class="ai-assist__hint">Writes the file’s title field, which the library and the public pages read as alt. Nothing else changes.</p>
        </div>

        <!-- 产品分类：介绍 + SEO -->
        <div v-if="catRef" class="ai-assist__proposal">
          <p class="ai-assist__proposal-head">Review before saving</p>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Category introduction</span>
            <textarea v-model="catIntro" rows="5" maxlength="400" />
            <span class="ai-assist__count" :class="{ 'is-off': catIntro.length > 320 }">
              {{ catIntro.length }} / 400 · ideal ≤ 320
            </span>
          </label>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Search title</span>
            <input v-model="catTitle" type="text" maxlength="120">
          </label>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Search description</span>
            <textarea v-model="catDescription" rows="3" maxlength="320" />
            <span class="ai-assist__count" :class="{ 'is-off': catDescription.length < DESCRIPTION_IDEAL.min || catDescription.length > DESCRIPTION_IDEAL.max }">
              {{ catDescription.length }} / 320 · ideal {{ DESCRIPTION_IDEAL.min }}–{{ DESCRIPTION_IDEAL.max }}
            </span>
          </label>
          <div class="ai-assist__row">
            <button type="button" class="ai-assist__save" :disabled="busy" @click="saveCategory">Save these three fields</button>
            <button type="button" class="ai-assist__ghost" :disabled="busy" @click="resetProposal">Discard</button>
          </div>
          <p class="ai-assist__hint">Writes the category introduction and its two search fields. The name, slug, image and product list stay untouched.</p>
        </div>

        <!-- 产品：摘要 + SEO（复用产品文案 AI，草稿才可用） -->
        <div v-if="productRef" class="ai-assist__proposal">
          <p class="ai-assist__proposal-head">Review before saving</p>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Product summary</span>
            <textarea v-model="productSummary" rows="4" maxlength="600" />
          </label>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Search title</span>
            <input v-model="productSeoTitle" type="text" maxlength="120">
          </label>
          <label class="ai-assist__field">
            <span class="ai-assist__label">Search description</span>
            <textarea v-model="productSeoDescription" rows="3" maxlength="320" />
          </label>
          <p v-if="productCategoryName" class="ai-assist__hint">Suggested category: {{ productCategoryName }} (not changed by this save).</p>
          <div class="ai-assist__row">
            <button type="button" class="ai-assist__save" :disabled="busy" @click="saveProduct">Save summary and SEO</button>
            <button type="button" class="ai-assist__ghost" :disabled="busy" @click="resetProposal">Discard</button>
          </div>
          <p class="ai-assist__hint">Available while the product is a Draft. Only the summary and the two search fields are written.</p>
        </div>

        <div v-if="savedText" class="ai-assist__saved">
          <p class="ai-assist__label">Saved</p>
          <p v-for="line in savedText.split('\n')" :key="line" class="ai-assist__saved-line">{{ line }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ai-assist {
  position: fixed;
  top: 64px;
  right: 20px;
  z-index: 90;
}

.ai-assist__head-actions { display: flex; align-items: center; gap: 2px; }
.ai-assist__collapse {
  border: 0;
  background: none;
  font-size: 15px;
  line-height: 1;
  color: #4A5E58;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.ai-assist__collapse:hover { background: #FFF1F7; color: #F0208C; }

.ai-assist__launch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: #F0208C;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 6px 18px rgb(240 32 140 / 35%);
}

.ai-assist__launch:hover { background: #FF7A00; box-shadow: 0 6px 18px rgb(255 122 0 / 38%); }
.ai-assist__launch:focus-visible { outline: 3px solid #FF7A00; outline-offset: 2px; }
.ai-assist__launch-text { letter-spacing: 0.08em; }

.ai-assist__panel {
  margin-top: 10px;
  width: min(420px, calc(100vw - 40px));
  max-height: min(620px, calc(100vh - 120px));
  overflow-y: auto;
  background: #fff;
  border: 1px solid #E6D9C6;
  border-top: 4px solid #F0208C;
  border-radius: 10px;
  box-shadow:
    0 28px 64px rgb(24 51 43 / 30%),
    0 6px 16px rgb(24 51 43 / 16%),
    0 0 0 1px rgb(24 51 43 / 6%);

  padding: 16px;
}

.ai-assist__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.ai-assist.is-dragging .ai-assist__head { cursor: grabbing; }
.ai-assist.is-dragging { user-select: none; }
.ai-assist { transition: none; }
.ai-assist__title { margin: 0; font-size: 16px; font-weight: 700; color: #18332B; letter-spacing: 0.02em; }
.ai-assist__context { margin: 4px 0 0; font-size: 12px; color: #4A5E58; display: flex; align-items: center; gap: 6px; }
.ai-assist__context-dot { width: 7px; height: 7px; border-radius: 50%; background: #FF7A00; display: inline-block; }
.ai-assist__close { border: 0; background: none; font-size: 22px; line-height: 1; color: #4A5E58; cursor: pointer; padding: 0 2px; }

.ai-assist__error { margin: 0 0 10px; padding: 8px 10px; background: #FDECEC; border: 1px solid #F3C5C5; border-radius: 6px; color: #B42318; font-size: 13px; }
.ai-assist__notice { margin: 0 0 10px; padding: 8px 10px; background: #FFF4E5; border: 1px solid #FFD8A8; border-radius: 6px; color: #945A20; font-size: 13px; }

.ai-assist__actions { display: flex; flex-direction: column; gap: 6px; }
.ai-assist__action {
  align-self: flex-start;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: #FF7A00;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.ai-assist__action:disabled { opacity: 0.55; cursor: default; }
.ai-assist__hint { margin: 6px 0 0; font-size: 12px; color: #4A5E58; }

.ai-assist__proposal { margin-top: 14px; border-top: 1px dashed #E6D9C6; padding-top: 12px; }
.ai-assist__proposal-head { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #18332B; }
.ai-assist__field { display: block; margin-bottom: 12px; }
.ai-assist__label { display: block; font-size: 12px; font-weight: 600; color: #4A5E58; margin-bottom: 4px; }
.ai-assist__field input, .ai-assist__field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #D8CFC0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  color: #18332B;
  background: #FFFDF8;
}
.ai-assist__count { display: block; margin-top: 4px; font-size: 11px; color: #2F6B3A; }
.ai-assist__count.is-off { color: #B54708; }
.ai-assist__row { display: flex; gap: 8px; }
.ai-assist__save {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: #F0208C;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ai-assist__save:disabled { opacity: 0.55; cursor: default; }
.ai-assist__ghost { height: 34px; padding: 0 12px; border: 1px solid #D8CFC0; border-radius: 6px; background: #fff; color: #4A5E58; font-size: 13px; cursor: pointer; }

.ai-assist__saved { margin-top: 14px; border-top: 1px dashed #E6D9C6; padding-top: 12px; }
.ai-assist__saved-line { margin: 0 0 4px; font-size: 13px; color: #18332B; }

.ai-assist__batch { margin-top: 14px; border-top: 1px dashed #E6D9C6; padding-top: 12px; }
.ai-assist__batch-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.ai-assist__batch-row { padding: 8px 0; border-bottom: 1px solid #F3ECDF; }
.ai-assist__batch-row:last-child { border-bottom: 0; }
.ai-assist__batch-name { margin: 0 0 4px; font-size: 11px; color: #4A5E58; word-break: break-all; }
.ai-assist__batch-row input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid #D8CFC0;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: #18332B;
  background: #FFFDF8;
  margin-bottom: 6px;
}
.ai-assist__batch-error { margin: 0 0 6px; font-size: 12px; color: #B42318; }

@media (max-width: 640px) {
  .ai-assist { top: 60px; right: 12px; }
  .ai-assist__launch-text { display: none; }
  .ai-assist__launch { padding: 0 12px; }
  .ai-assist__panel { width: calc(100vw - 24px); }
}
</style>
