<script setup lang="ts">
/**
 * V2-03 — Blog & FAQ editor.
 *
 * Edits `posts`, the collection the public site reads, so a change here is visible on the site. The
 * Structured Content tools are a different model and stay where they are; the footer link says so
 * rather than pretending they are the same thing.
 *
 * Layout follows UI-04: record list on the left (~30%), editor on the right (~70%), and on a narrow
 * screen the list comes first, then the editor — never a horizontally scrolling table.
 */
definePageMeta({ layout: 'admin' })

interface PostRow {
  id: number
  slug: string
  title_en: string
  status: string
  content_type: string
  publish_date: string | null
  cover_image: string | null
  updated_at: string | null
}

const route = useRoute()
const router = useRouter()

const tab = ref<'blog' | 'faq'>('blog')
const q = ref('')
const rows = ref<PostRow[]>([])
const selected = ref<PostRow | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')

const form = reactive({
  title_en: '',
  excerpt_en: '',
  body_en: '',
  cover_image: '' as string | null,
  cover_fit: '' as '' | 'contain' | 'cover',
  status: '',
  seo_title_en: '',
  seo_description_en: '',
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ tab: tab.value })
    if (q.value.trim()) params.set('q', q.value.trim())
    const r = await $fetch<{ posts: PostRow[] }>(`/api/admin/posts?${params}`)
    rows.value = r.posts
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Could not load records'
  } finally {
    loading.value = false
  }
}

async function edit(row: PostRow): Promise<void> {
  error.value = ''
  notice.value = ''
  try {
    // Read the full row from the public reader so the editor and the site agree on the fields.
    const full = await $fetch<Record<string, unknown>>(`/api/cms/posts/${encodeURIComponent(row.slug)}`)
    selected.value = row
    // 当前记录写进 URL：刷新后仍停在这篇，全局 AI 助手也能知道"当前是哪一篇"。
    if (route.query.id !== String(row.id)) void router.replace({ query: { ...route.query, id: String(row.id) } })
    form.title_en = String(full.title ? (full.title as Record<string, string>).en ?? '' : '')
    form.excerpt_en = String(full.excerpt ? (full.excerpt as Record<string, string>).en ?? '' : '')
    form.body_en = String(full.bodyHtml ?? '')
    form.cover_image = (full.coverImageId as string) ?? null
    form.cover_fit = ((full.coverFit as string) === 'contain' || (full.coverFit as string) === 'cover')
      ? (full.coverFit as 'contain' | 'cover')
      : ''
    form.status = row.status
    const seo = (full.seo ?? {}) as { title?: Record<string, string>, description?: Record<string, string> }
    form.seo_title_en = String(seo.title?.en ?? '')
    form.seo_description_en = String(seo.description?.en ?? '')
  } catch {
    error.value = 'Could not load that record'
  }
}

async function save(): Promise<void> {
  if (!selected.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch(`/api/admin/posts/${selected.value.id}`, {
      method: 'PATCH',
      body: {
        title_en: form.title_en,
        excerpt_en: form.excerpt_en,
        body_en: form.body_en,
        cover_image: form.cover_image,
        cover_fit: form.cover_fit === '' ? null : form.cover_fit,
        status: form.status,
      },
    })
    notice.value = 'Saved. The public page reads this record straight away.'
    await load()
  } catch (e: unknown) {
    // Keep every typed value: the editor must never clear the author's work on a failed save.
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Save failed — your text is unchanged'
  } finally {
    saving.value = false
  }
}

watch(tab, () => { selected.value = null; load() })
onMounted(load)
</script>

<template>
  <div class="posts-page">
    <div class="page-head">
      <p class="crumb">Content / Blog &amp; FAQ</p>
      <h1>Blog &amp; FAQ</h1>
      <p class="sub">Edit the content the current website actually reads.</p>
      <p class="source">Source: <code>posts</code></p>
    </div>

    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'blog'" class="tab" :class="{ 'tab--on': tab === 'blog' }" @click="tab = 'blog'">Blog</button>
      <button role="tab" :aria-selected="tab === 'faq'" class="tab" :class="{ 'tab--on': tab === 'faq' }" @click="tab = 'faq'">FAQ</button>
    </div>

    <p v-if="error" class="banner banner--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="banner banner--ok" role="status">{{ notice }}</p>

    <div class="split">
      <section class="list">
        <label class="field">
          <span>Find a record</span>
          <input v-model="q" type="search" placeholder="Search existing titles" @keyup.enter="load">
        </label>

        <p v-if="loading" class="muted">Loading…</p>
        <ul v-else class="rows" role="list">
          <li v-for="row in rows" :key="row.id">
            <button class="row" :class="{ 'row--on': selected?.id === row.id }" @click="edit(row)">
              <span class="row__title">{{ row.title_en }}</span>
              <span class="row__meta">{{ row.status }} · {{ row.slug }}</span>
            </button>
          </li>
        </ul>

        <p class="note">
          <strong>Advanced content is separate.</strong>
          Structured Content keeps its own models, snapshots and AI tools.
          <NuxtLink to="/admin/content-center">Open Structured Content →</NuxtLink>
        </p>
      </section>

      <section class="editor">
        <template v-if="selected">
          <div class="editor__head">
            <h2>Article editor</h2>
            <span class="chip">posts</span>
          </div>
          <p class="muted">Existing post fields · no data migration</p>

          <label class="field"><span>Title</span><input v-model="form.title_en" type="text"></label>
          <label class="field"><span>Summary</span><input v-model="form.excerpt_en" type="text"></label>

          <div class="field">
            <span>Cover image</span>
            <div class="cover">
              <p class="cover__value">{{ form.cover_image ? 'Existing media on this record' : 'No cover set' }}</p>
              <p class="cover__hint">Public eligibility is still required for a cover to appear on the site.</p>
            </div>
          </div>

          <label class="field">
            <span>Image fit</span>
            <select v-model="form.cover_fit">
              <option value="">Existing default</option>
              <option value="contain">Contain — show the entire machine</option>
              <option value="cover">Cover — fill the frame</option>
            </select>
            <span class="hint">The only added field: <code>posts.cover_fit</code> (nullable).</span>
          </label>

          <label class="field"><span>Article body</span><textarea v-model="form.body_en" rows="10" /></label>
          <p class="hint">Rich-text sanitisation and the existing content structure are unchanged.</p>

          <label class="field">
            <span>Status</span>
            <select v-model="form.status">
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </label>

          <div class="actions">
            <button class="btn btn--primary" :disabled="saving" @click="save">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
          <p class="hint">Published edits stay local until you save. A draft can stay a draft.</p>
        </template>

        <p v-else class="empty">Select a record on the left to edit it.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.posts-page { max-width: 1280px; }
.page-head { margin-bottom: 24px; }
.crumb { margin: 0 0 8px; font-size: 14px; color: #52665C; }
h1 { margin: 0 0 6px; font-size: 28px; line-height: 1.2; color: #20352B; }
.sub { margin: 0; font-size: 16px; color: #52665C; }
.source { margin: 6px 0 0; font-size: 14px; color: #52665C; }
.source code { background: #EEF5EF; padding: 1px 6px; border-radius: 4px; color: #2F6B3A; }

.tabs { display: flex; gap: 20px; border-bottom: 1px solid #DEE6E1; margin-bottom: 20px; }
.tab { padding: 10px 2px; border: 0; background: none; font-size: 16px; color: #52665C; cursor: pointer; border-bottom: 2px solid transparent; }
.tab--on { color: #20352B; border-bottom-color: #2F6B3A; font-weight: 600; }

.banner { padding: 12px 16px; border-radius: 8px; font-size: 16px; margin: 0 0 16px; }
.banner--error { background: #FFF1EF; border: 1px solid #F3B5AC; color: #B42318; }
.banner--ok { background: #EEF5EF; border: 1px solid #C7D8CA; color: #2F6B3A; }

.split { display: grid; grid-template-columns: minmax(0, 30%) minmax(0, 70%); gap: 24px; align-items: start; }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; font-size: 16px; color: #20352B; }
.field span { font-weight: 600; }
.field input, .field select, .field textarea {
  min-height: 48px; padding: 10px 12px; border: 1px solid #B9C8BF; border-radius: 6px;
  font: inherit; font-size: 18px; color: #20352B; background: #fff;
}
.field textarea { min-height: 160px; }

.rows { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { width: 100%; text-align: start; padding: 14px 16px; border: 1px solid #DEE6E1; border-radius: 8px; background: #fff; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
.row--on { border-color: #2F6B3A; background: #EEF5EF; }
.row__title { font-size: 18px; color: #20352B; }
.row__meta { font-size: 14px; color: #52665C; }

.note { margin-top: 16px; padding: 16px; border-radius: 8px; background: #EEF5EF; font-size: 15px; line-height: 1.5; color: #52665C; }
.note a { color: #2F6B3A; }

.editor { padding: 24px; border: 1px solid #DEE6E1; border-radius: 10px; background: #fff; }
.editor__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.editor__head h2 { margin: 0; font-size: 22px; color: #20352B; }
.chip { padding: 2px 8px; border-radius: 999px; background: #EEF5EF; font-size: 13px; color: #2F6B3A; }

.cover { padding: 16px; border: 1px dashed #B9C8BF; border-radius: 8px; }
.cover__value { margin: 0; font-size: 16px; color: #20352B; }
.cover__hint { margin: 4px 0 0; font-size: 14px; color: #52665C; }

.hint { margin: 4px 0 0; font-size: 14px; color: #52665C; }
.muted { margin: 0 0 8px; font-size: 15px; color: #52665C; }
.empty { padding: 40px 0; text-align: center; color: #52665C; }
.actions { margin-top: 20px; }
.btn { min-height: 46px; padding: 0 18px; border-radius: 6px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.btn--primary { background: #2F6B3A; color: #fff; border: 0; }
.btn--primary:disabled { opacity: .6; cursor: default; }

@media (max-width: 900px) {
  .split { grid-template-columns: minmax(0, 1fr); }
}
</style>
