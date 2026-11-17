<script setup lang="ts">
/**
 * V2-04 — page content: pick a page and edit its hero, in one screen.
 *
 * Layout follows UI-01/UI-02. There is one route, not one per page: the selected page lives in the
 * `?page=` query so a link can be shared and the back button works.
 *
 * There is no draft row. Edits live in this browser until a person presses Publish; that is stated
 * plainly, because a writer who closes the tab would otherwise assume the work was saved.
 */
definePageMeta({ layout: 'admin' })

interface HeroRow {
  id: number
  status: string
  heroImage: string | null
  eyebrow: string
  title: string
  body: string
  ctaPrimaryLabel: string
  ctaPrimaryPath: string
  ctaSecondaryLabel: string
  ctaSecondaryPath: string
  updatedAt: string | null
}
interface HeroPage {
  pageKey: string
  contentKey: string
  label: string
  path: string
  zone: string
  scope: string
  state: string
  defaults: Record<string, string>
  row: HeroRow | null
}

const route = useRoute()
const router = useRouter()

const pages = ref<HeroPage[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
/** True once a field differs from what the row/public page currently shows. */
const dirty = ref(false)

const selectedKey = computed(() => (typeof route.query.page === 'string' ? route.query.page : ''))
const current = computed(() => pages.value.find((p: HeroPage) => p.pageKey === selectedKey.value) ?? null)

const form = reactive({
  eyebrow: '', title: '', body: '',
  heroImage: '', ctaPrimaryLabel: '', ctaPrimaryPath: '',
  ctaSecondaryLabel: '', ctaSecondaryPath: '',
})

function fillFrom(page: HeroPage): void {
  const src = page.row ?? page.defaults
  form.eyebrow = src.eyebrow ?? ''
  form.title = src.title ?? ''
  form.body = src.body ?? ''
  form.heroImage = page.row?.heroImage ?? ''
  form.ctaPrimaryLabel = page.row?.ctaPrimaryLabel ?? page.defaults.ctaPrimaryLabel ?? ''
  form.ctaPrimaryPath = page.row?.ctaPrimaryPath ?? page.defaults.ctaPrimaryPath ?? ''
  form.ctaSecondaryLabel = page.row?.ctaSecondaryLabel ?? page.defaults.ctaSecondaryLabel ?? ''
  form.ctaSecondaryPath = page.row?.ctaSecondaryPath ?? page.defaults.ctaSecondaryPath ?? ''
  dirty.value = false
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const r = await $fetch<{ pages: HeroPage[] }>('/api/admin/page-content')
    pages.value = r.pages
    if (current.value) fillFrom(current.value)
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Could not load page content'
  } finally {
    loading.value = false
  }
}

function open(page: HeroPage): void {
  router.push({ query: { page: page.pageKey } })
}

async function publish(): Promise<void> {
  if (!current.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch('/api/admin/page-content', {
      method: 'PATCH',
      body: {
        pageKey: current.value.pageKey,
        action: 'publish',
        eyebrow: form.eyebrow,
        title: form.title,
        body: form.body,
        heroImage: form.heroImage || null,
        ctaPrimaryLabel: form.ctaPrimaryLabel,
        ctaPrimaryPath: form.ctaPrimaryPath,
        ctaSecondaryLabel: form.ctaSecondaryLabel,
        ctaSecondaryPath: form.ctaSecondaryPath,
      },
    })
    notice.value = 'Published. The public page now uses these values.'
    await load()
  } catch (e: unknown) {
    // Keep every typed value on failure; a lost paragraph is worse than a retry.
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Publish failed — your text is unchanged'
  } finally {
    saving.value = false
  }
}

async function withdraw(): Promise<void> {
  if (!current.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/page-content', {
      method: 'PATCH',
      body: { pageKey: current.value.pageKey, action: 'withdraw' },
    })
    notice.value = 'Override withdrawn. The public page is back to its approved default.'
    await load()
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Withdraw failed'
  } finally {
    saving.value = false
  }
}

watch(selectedKey, () => { if (current.value) fillFrom(current.value) })
watch(form, () => { dirty.value = true }, { deep: true })
onMounted(load)
</script>

<template>
  <div class="pc-page">
    <div class="page-head">
      <p class="crumb">Content / Page Content</p>
      <h1>Page Content</h1>
      <p class="sub">Choose a page. Edit its hero without rebuilding the page.</p>
      <p class="source">Source: <code>site_content</code> — one row per page</p>
    </div>

    <p v-if="error" class="banner banner--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="banner banner--ok" role="status">{{ notice }}</p>

    <p v-if="loading" class="muted">Loading…</p>

    <!-- Page list -->
    <template v-if="!selectedKey">
      <div class="explain">
        <strong>Your existing pages remain the default.</strong>
        Only a published override changes the public page. Full page copy and forms stay in their existing components.
      </div>

      <table class="grid">
        <thead>
          <tr><th>Page</th><th>Editing scope</th><th>State</th><th><span class="sr">Action</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in pages" :key="p.pageKey">
            <td>
              <span class="page-name">{{ p.label }}</span>
              <span class="page-path">{{ p.path }}</span>
            </td>
            <td class="scope">{{ p.scope }}</td>
            <td><span class="state" :class="`state--${p.state.replace(/\s+/g, '-').toLowerCase()}`">{{ p.state }}</span></td>
            <td><button class="link-btn" @click="open(p)">Edit hero →</button></td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Editor -->
    <template v-else-if="current">
      <p class="back"><button class="link-btn" @click="router.push({ query: {} })">← All pages</button></p>

      <h2 class="h2">{{ current.label }} — Hero</h2>
      <p class="state-line"><span class="state" :class="`state--${current.state.replace(/\s+/g, '-').toLowerCase()}`">{{ current.state }}</span></p>

      <div class="warn">
        <strong>Changes stay in this browser until you publish.</strong>
        Refresh discards unpublished edits.
      </div>

      <div class="split">
        <section class="panel">
          <h3>Hero content <span class="chip">Single existing row</span></h3>

          <label class="field"><span>Eyebrow</span><input v-model="form.eyebrow" type="text"></label>
          <label class="field"><span>Title</span><input v-model="form.title" type="text"></label>
          <label class="field"><span>Introduction</span><textarea v-model="form.body" rows="4" /></label>

          <div class="field">
            <span>Hero image</span>
            <div class="imgbox">
              <p class="imgbox__value">{{ form.heroImage ? 'Existing media selected' : 'No image — the page uses its approved default' }}</p>
              <p class="hint">Alt text comes from the existing media title; editing that title affects every use of the file.</p>
            </div>
          </div>

          <div class="two">
            <label class="field"><span>Button label</span><input v-model="form.ctaPrimaryLabel" type="text"></label>
            <label class="field"><span>Link</span><input v-model="form.ctaPrimaryPath" type="text" placeholder="/products"></label>
          </div>

          <div class="actions">
            <button class="btn btn--primary" :disabled="saving" @click="publish">
              {{ saving ? 'Publishing…' : 'Publish changes' }}
            </button>
            <span v-if="dirty" class="dirty">Unpublished changes</span>
          </div>

          <hr>
          <button class="link-btn" :disabled="saving" @click="withdraw">Withdraw override</button>
          <p class="hint">This returns the public page to its approved default. The saved copy is not kept as a live override.</p>
        </section>

        <aside class="panel panel--preview">
          <h3>Page preview</h3>
          <p class="hint">Uses the same Hero presentation. Local preview — not live.</p>
          <div class="preview">
            <p class="preview__eyebrow">{{ form.eyebrow || current.defaults.eyebrow }}</p>
            <p class="preview__title">{{ form.title || current.defaults.title }}</p>
            <p class="preview__body">{{ form.body || current.defaults.body }}</p>
            <p v-if="form.ctaPrimaryLabel" class="preview__cta">{{ form.ctaPrimaryLabel }} →</p>
          </div>
          <p class="note">Everything below the hero stays in place — the page body, forms and SEO keep their current sources.</p>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pc-page { max-width: 1280px; }
.page-head { margin-bottom: 24px; }
.crumb { margin: 0 0 8px; font-size: 14px; color: #52665C; }
h1 { margin: 0 0 6px; font-size: 28px; line-height: 1.2; color: #20352B; }
.h2 { margin: 8px 0 4px; font-size: 24px; color: #20352B; }
.sub { margin: 0; font-size: 16px; color: #52665C; }
.source { margin: 6px 0 0; font-size: 14px; color: #52665C; }
.source code { background: #EEF5EF; padding: 1px 6px; border-radius: 4px; color: #2F6B3A; }

.banner { padding: 12px 16px; border-radius: 8px; font-size: 16px; margin: 0 0 16px; }
.banner--error { background: #FFF1EF; border: 1px solid #F3B5AC; color: #B42318; }
.banner--ok { background: #EEF5EF; border: 1px solid #C7D8CA; color: #2F6B3A; }

.explain { padding: 18px 20px; border-radius: 8px; background: #EEF5EF; font-size: 16px; line-height: 1.55; color: #20352B; margin-bottom: 20px; }
.warn { padding: 16px 20px; border-radius: 8px; background: #FFF8E8; border: 1px solid #EBD9AE; font-size: 16px; line-height: 1.5; color: #20352B; margin-bottom: 20px; }

.grid { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #DEE6E1; border-radius: 10px; overflow: hidden; }
.grid th { text-align: start; padding: 12px 16px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #52665C; border-bottom: 1px solid #DEE6E1; }
.grid td { padding: 16px; border-bottom: 1px solid #EEF2EF; font-size: 16px; vertical-align: middle; }
.grid tr:last-child td { border-bottom: 0; }
.page-name { display: block; font-size: 18px; color: #20352B; }
.page-path { display: block; font-size: 14px; color: #52665C; }
.scope { color: #20352B; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.state { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 14px; background: #F0F2F4; color: #52606D; }
.state--published-override { background: #EEF5EF; color: #2F6B3A; }
.state--draft { background: #FFF4E8; color: #945A20; }
.state--using-default { background: #F0F2F4; color: #52606D; }

.link-btn { background: none; border: 0; padding: 0; font: inherit; font-size: 16px; color: #2F6B3A; cursor: pointer; min-height: 44px; }
.back { margin: 0 0 8px; }
.state-line { margin: 0 0 12px; }

.split { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.panel { padding: 24px; border: 1px solid #DEE6E1; border-radius: 10px; background: #fff; }
.panel h3 { margin: 0 0 16px; font-size: 20px; color: #20352B; display: flex; align-items: center; gap: 10px; }
.chip { padding: 2px 8px; border-radius: 999px; background: #EEF5EF; font-size: 12px; font-weight: 500; color: #2F6B3A; }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; font-size: 16px; color: #20352B; }
.field span { font-weight: 600; }
.field input, .field textarea { min-height: 48px; padding: 10px 12px; border: 1px solid #B9C8BF; border-radius: 6px; font: inherit; font-size: 18px; color: #20352B; background: #fff; }
.field textarea { min-height: 112px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.imgbox { padding: 16px; border: 1px dashed #B9C8BF; border-radius: 8px; }
.imgbox__value { margin: 0 0 4px; font-size: 16px; color: #20352B; }
.hint { margin: 4px 0 0; font-size: 14px; color: #52665C; }
.muted { color: #52665C; }

.actions { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
.btn { min-height: 46px; padding: 0 18px; border-radius: 6px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.btn--primary { background: #2F6B3A; color: #fff; border: 0; }
.btn--primary:disabled { opacity: .6; cursor: default; }
.dirty { font-size: 14px; color: #945A20; }
hr { margin: 20px 0 12px; border: 0; border-top: 1px solid #DEE6E1; }

.preview { margin-top: 12px; padding: 20px; border-radius: 8px; background: #F6F8F7; }
.preview__eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #2F6B3A; }
.preview__title { margin: 0 0 10px; font-size: 26px; line-height: 1.2; color: #20352B; }
.preview__body { margin: 0 0 12px; font-size: 16px; line-height: 1.55; color: #52665C; }
.preview__cta { margin: 0; font-size: 16px; color: #2F6B3A; font-weight: 600; }
.note { margin: 16px 0 0; padding: 14px 16px; border-radius: 8px; background: #EEF5EF; font-size: 15px; line-height: 1.5; color: #52665C; }

@media (max-width: 900px) {
  .split { grid-template-columns: minmax(0, 1fr); }
  .two { grid-template-columns: minmax(0, 1fr); }
  .grid th:nth-child(2), .grid td:nth-child(2) { display: none; }
}
</style>
