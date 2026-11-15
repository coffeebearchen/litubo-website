<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AdminContentSeoLocales } from '~/types/content-center'
import { DEFAULT_CONTENT_LOCALE, type ContentLocale } from '~/utils/contentLocales'
import { workspaceMediaThumbUrl } from '~/utils/productWorkspace'
import { fileKind } from '~/utils/mediaDisplay'
import {
  CONTENT_LOCALE_LABELS,
  contentEditorLocaleRoute,
  interpretContentApiError,
  type ContentApiErrorView,
} from '~/utils/contentCenter'
import { isImageMimeType } from '~/utils/contentMediaRelations'
import { formatContentFileSize } from '~/utils/contentMediaRelationsEditor'
import {
  CONTENT_CANONICAL_PATH_MAX,
  CONTENT_SEO_DESCRIPTION_MAX,
  CONTENT_SEO_TITLE_MAX,
  CONTENT_TITLE_MAX,
  contentSeoChecklist,
  effectiveSeoDescription,
  effectiveSeoTitle,
  isContentSlugLocked,
  socialImageSource,
  validateCanonicalPath,
} from '~/utils/contentSeo'
import { CONTENT_SLUG_MAX } from '~/utils/contentSlug'
import {
  SEO_LOCALES_SWITCH_MESSAGE,
  buildSeoLocalesSaveBody,
  interpretSeoLocalesSaveError,
  isOgImageChanged,
  localeStartBody,
  seoChangedFields,
  seoFormFromRow,
  seoLocaleTabs,
  stagedOgFrom,
  suggestedLocaleSlug,
  type SeoFormState,
  type SeoSaveError,
  type StagedOgImage,
} from '~/utils/contentSeoLocalesEditor'
import { useMediaLibraryBrowser } from '~/composables/useMediaLibraryBrowser'
import MediaLibraryPicker from '~/components/admin/media/MediaLibraryPicker.vue'

/**
 * CC-IMP-05 — CC-04 SEO & Locales (CC-VIS-04-SEO-LOCALES-D1440).
 *
 * One language at a time: its slug, SEO title, meta description, canonical path
 * and noindex, plus the item's Open Graph image. Edits and image picks are staged
 * and sent once with Save. Starting a language is a separate explicit action that
 * creates an untranslated Draft; nothing here translates, generates or publishes.
 * Previews use the Draft values only and never show a public URL.
 */
const props = defineProps<{
  initial: AdminContentSeoLocales
  locale: ContentLocale
}>()

const emit = defineEmits<{
  saved: [value: AdminContentSeoLocales]
  reloaded: [value: AdminContentSeoLocales]
  locale: [locale: ContentLocale]
  status: [status: { dirty: boolean, saving: boolean, justSaved: boolean, conflict: boolean }]
}>()

const current = ref<AdminContentSeoLocales>(props.initial)
const activeLocale = ref<ContentLocale>(props.locale)
const original = ref<SeoFormState | null>(null)
const form = ref<SeoFormState | null>(null)
const revision = ref(0)
const originalOg = ref<StagedOgImage | null>(null)
const og = ref<StagedOgImage | null>(null)

const startTitle = ref('')
const startSlug = ref('')

function initialize(value: AdminContentSeoLocales) {
  current.value = value
  const row = value.locales.find(l => l.locale === activeLocale.value) ?? null
  original.value = row ? seoFormFromRow(row) : null
  form.value = row ? seoFormFromRow(row) : null
  revision.value = row?.draft_revision ?? 0
  originalOg.value = stagedOgFrom(value.og_image)
  og.value = stagedOgFrom(value.og_image)
  startTitle.value = ''
  startSlug.value = suggestedLocaleSlug(value)
}

initialize(props.initial)

const saving = ref(false)
const reloading = ref(false)
const starting = ref(false)
const justSaved = ref(false)
const error = ref<SeoSaveError | null>(null)
const conflict = ref(false)
const confirmReload = ref(false)
const startError = ref<ContentApiErrorView | null>(null)
const pickerNotice = ref<string | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined

const browser = useMediaLibraryBrowser()

const itemId = computed(() => current.value.item.id)
const tabs = computed(() => seoLocaleTabs(current.value))
const activeTab = computed(() => tabs.value.find(t => t.code === activeLocale.value) ?? tabs.value[0])
const row = computed(() => activeTab.value.row)
const localeLabel = computed(() => activeTab.value.label)
const defaultLabel = computed(() => CONTENT_LOCALE_LABELS[current.value.default_locale] ?? CONTENT_LOCALE_LABELS[DEFAULT_CONTENT_LOCALE])
const archivedItem = computed(() => current.value.item.status === 'archived')
const locked = computed(() => saving.value || reloading.value || starting.value || archivedItem.value)
const seoDirty = computed(() => Boolean(original.value && form.value && Object.keys(seoChangedFields(original.value, form.value)).length > 0))
const ogDirty = computed(() => isOgImageChanged(originalOg.value, og.value))
const dirty = computed(() => seoDirty.value || ogDirty.value)
const canSave = computed(() => dirty.value && !locked.value)
const slugLocked = computed(() => isContentSlugLocked(row.value))
const canonicalCheck = computed(() => validateCanonicalPath(form.value?.canonical_path ?? ''))
const fieldError = computed(() => (error.value?.kind === 'field' ? error.value : null))
const hero = computed(() => current.value.hero)

const previewSource = computed(() => ({
  title: row.value?.title ?? null,
  summary: row.value?.summary ?? null,
  seo_title: form.value?.seo_title ?? null,
  seo_description: form.value?.seo_description ?? null,
}))
const previewTitle = computed(() => effectiveSeoTitle(previewSource.value))
const previewDescription = computed(() => effectiveSeoDescription(previewSource.value))
const imageSource = computed(() => socialImageSource(og.value, hero.value))
const previewImage = computed(() => (imageSource.value === 'og_image' ? og.value : imageSource.value === 'hero' ? hero.value : null))

const checklist = computed(() => (form.value
  ? contentSeoChecklist({
      ...previewSource.value,
      slug: form.value.slug,
      canonical_path: form.value.canonical_path,
      noindex: form.value.noindex,
      slugLocked: slugLocked.value,
      ogImage: og.value ? { archived: og.value.file.archived } : null,
      hero: hero.value ? { archived: hero.value.file.archived } : null,
    })
  : []))

const statusLabel = computed(() => {
  if (saving.value) return 'Saving…'
  if (conflict.value) return 'Not saved — this page changed'
  if (error.value && dirty.value) return 'Not saved'
  if (justSaved.value) return 'Saved'
  return dirty.value ? 'Unsaved changes' : 'All changes saved'
})

watch([dirty, saving, justSaved, conflict], () => {
  emit('status', { dirty: dirty.value, saving: saving.value, justSaved: justSaved.value, conflict: conflict.value })
}, { immediate: true })

watch(dirty, (value: boolean) => { if (value) justSaved.value = false })

const brokenThumbs = ref(new Set<string>())

function thumb(image: { directus_files_id: string, file: { type: string | null } } | null, width = 480): string | null {
  if (!image || !isImageMimeType(image.file.type) || brokenThumbs.value.has(image.directus_files_id)) return null
  return workspaceMediaThumbUrl(image.directus_files_id, { width, height: Math.round(width * 0.525) })
}

function markBroken(fileId: string) {
  brokenThumbs.value = new Set([...brokenThumbs.value, fileId])
}

function countOf(value: string | undefined): number {
  return (value ?? '').length
}

// ── Language switching (staged changes are never dropped silently) ───────────

function switchLocale(code: ContentLocale) {
  if (code === activeLocale.value) return
  if (dirty.value && !window.confirm(SEO_LOCALES_SWITCH_MESSAGE)) return
  activeLocale.value = code
  error.value = null
  conflict.value = false
  confirmReload.value = false
  startError.value = null
  pickerNotice.value = null
  initialize(current.value)
  emit('locale', code)
}

// ── Start a language: an explicit, untranslated Draft ────────────────────────

async function startLocale() {
  if (locked.value || dirty.value || row.value) return
  startError.value = null
  const body = localeStartBody(activeLocale.value, startTitle.value, startSlug.value)
  if (!body.title) { startError.value = { status: 0, field: 'title', message: `Enter a ${localeLabel.value} title.` }; return }
  if (!body.slug) { startError.value = { status: 0, field: 'slug', message: 'Enter a slug.' }; return }

  starting.value = true
  try {
    await $fetch(`/api/admin/content-center/${itemId.value}/locales`, { method: 'POST', body })
  } catch (err: unknown) {
    startError.value = interpretContentApiError(err)
    starting.value = false
    return
  }
  try {
    const latest = await $fetch<AdminContentSeoLocales>(`/api/admin/content-center/${itemId.value}/seo-locales`)
    initialize(latest)
    emit('saved', latest)
  } catch {
    startError.value = { status: 0, field: null, message: `The ${localeLabel.value} draft was created, but this page could not refresh. Reload the page to continue.` }
  } finally {
    starting.value = false
  }
}

// ── Open Graph image (staged) ────────────────────────────────────────────────

function openOgPicker() {
  pickerNotice.value = null
  void browser.openLibrary('image')
}

function pickOgImage(fileId: string) {
  const file = browser.files.value.find(f => f.id === fileId)
  if (!file) return
  browser.closeLibrary()
  if (!isImageMimeType(file.type)) {
    pickerNotice.value = 'The Open Graph image must be an image. Choose a picture file.'
    return
  }
  og.value = {
    directus_files_id: file.id,
    file: {
      filename_download: file.filename_download ?? file.title,
      title: file.title,
      type: file.type,
      width: file.width,
      height: file.height,
      filesize: file.filesize,
      is_public: false,
      archived: false,
    },
  }
}

function removeOgImage() {
  og.value = null
  pickerNotice.value = null
}

// ── Save / reload ────────────────────────────────────────────────────────────

async function save() {
  if (!canSave.value) return
  if (seoDirty.value && !canonicalCheck.value.ok) {
    error.value = {
      kind: 'field', status: 0, message: canonicalCheck.value.message, field: 'canonical_path',
      currentDraftRevision: null, seoSaved: false, ogImageRetryable: false,
    }
    return
  }
  const body = buildSeoLocalesSaveBody({
    locale: activeLocale.value,
    revision: revision.value,
    original: original.value,
    current: form.value,
    originalOg: originalOg.value,
    currentOg: og.value,
    ogVersion: current.value.og_version,
  })
  if (!body) return

  saving.value = true
  error.value = null
  try {
    const saved = await $fetch<AdminContentSeoLocales>(`/api/admin/content-center/${itemId.value}/seo-locales`, {
      method: 'PUT',
      body,
    })
    initialize(saved)
    conflict.value = false
    confirmReload.value = false
    justSaved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { justSaved.value = false }, 3000)
    emit('saved', saved)
  } catch (err: unknown) {
    const view = interpretSeoLocalesSaveError(err)
    if (view.kind === 'partial' && view.seoSaved && form.value) {
      // The SEO fields are stored; only the image change is still staged.
      original.value = { ...form.value }
      if (view.currentDraftRevision) revision.value = view.currentDraftRevision
    }
    error.value = view
    conflict.value = view.kind === 'conflict' || view.kind === 'og_conflict' || (view.kind === 'partial' && !view.ogImageRetryable)
  } finally {
    saving.value = false
  }
}

async function reloadLatest() {
  reloading.value = true
  try {
    const latest = await $fetch<AdminContentSeoLocales>(`/api/admin/content-center/${itemId.value}/seo-locales`)
    initialize(latest)
    conflict.value = false
    confirmReload.value = false
    error.value = null
    emit('reloaded', latest)
  } catch (err: unknown) {
    error.value = interpretSeoLocalesSaveError(err)
  } finally {
    reloading.value = false
  }
}

function keepEditing() {
  conflict.value = false
  confirmReload.value = false
  error.value = null
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  clearTimeout(savedTimer)
})

defineExpose({ save, dirty, canSave })
</script>

<template>
  <div class="csl">
    <div v-if="conflict" class="csl-conflict" role="alert">
      <p class="csl-conflict-title">{{ error?.kind === 'partial' ? 'Saving stopped part-way.' : error?.message }}</p>
      <p class="csl-conflict-text">
        <template v-if="error?.kind === 'partial'">{{ error.message }}</template>
        <template v-else>
          A newer version was saved<template v-if="error?.currentDraftRevision"> (revision {{ error.currentDraftRevision }})</template>.
          Your changes below were not saved and are still here.
        </template>
      </p>
      <div v-if="!confirmReload" class="csl-actions">
        <button type="button" class="csl-btn" @click="keepEditing">Keep editing</button>
        <button type="button" class="csl-btn csl-btn--warn" @click="confirmReload = true">Reload latest</button>
      </div>
      <div v-else class="csl-actions">
        <p class="csl-conflict-warn">Reloading discards your unsaved changes and shows what is saved now.</p>
        <button type="button" class="csl-btn csl-btn--warn" :disabled="reloading" @click="reloadLatest">
          {{ reloading ? 'Reloading…' : 'Discard my changes and reload' }}
        </button>
        <button type="button" class="csl-btn" :disabled="reloading" @click="confirmReload = false">Cancel</button>
      </div>
    </div>

    <div v-else-if="error?.kind === 'partial'" class="csl-partial" role="alert">
      <p class="csl-conflict-title">Search settings saved — the Open Graph image was not.</p>
      <p class="csl-conflict-text">{{ error.message }}</p>
    </div>

    <div v-else-if="error && error.kind !== 'field'" class="csl-error" role="alert">
      <p>{{ error.message }}</p>
      <a v-if="error.kind === 'session'" href="/admin/login" target="_blank" rel="noopener" class="csl-error-link">Sign in (new tab)</a>
    </div>

    <p v-if="archivedItem" class="csl-notice" role="status">This content item is archived. Its SEO and languages cannot be changed.</p>

    <div class="csl-grid">
      <div class="csl-main">
        <section class="csl-card" aria-labelledby="csl-lang-title">
          <h2 id="csl-lang-title" class="csl-card-title">Language and SEO settings</h2>
          <p class="csl-card-hint">Search settings are saved per language. Nothing on this page is published.</p>

          <div class="csl-tabs" role="tablist" aria-label="Languages">
            <button
              v-for="tab in tabs"
              :id="`csl-tab-${tab.code}`"
              :key="tab.code"
              type="button"
              role="tab"
              class="csl-tab"
              :class="{ 'csl-tab--active': tab.code === activeLocale }"
              :aria-selected="tab.code === activeLocale"
              aria-controls="csl-tabpanel"
              :disabled="saving || starting"
              @click="switchLocale(tab.code)"
            >
              <span class="csl-tab-label">{{ tab.label }}<template v-if="tab.isDefault"> (default)</template></span>
              <span class="csl-pill" :class="`csl-pill--${tab.state}`">{{ tab.stateLabel }}</span>
            </button>
          </div>

          <div id="csl-tabpanel" role="tabpanel" :aria-labelledby="`csl-tab-${activeLocale}`" class="csl-tabpanel">
            <!-- Not started: nothing is inherited from another language -->
            <div v-if="!row" class="csl-start">
              <h3 class="csl-start-title">{{ localeLabel }} has not been started</h3>
              <p class="csl-start-text">
                Start locale creates an empty Draft for this language. Nothing is translated or published automatically.
              </p>
              <p class="csl-hint">
                Sections start with the same structure as the {{ defaultLabel }} draft, with empty text.
                Until {{ localeLabel }} has its own content, it is never shown in {{ defaultLabel }} instead.
              </p>

              <fieldset class="csl-start-form" :disabled="locked || dirty">
                <legend class="csl-sr-only">Start {{ localeLabel }}</legend>
                <div class="csl-field">
                  <label for="csl-start-title">{{ localeLabel }} title <span class="csl-req" aria-hidden="true">*</span></label>
                  <input
                    id="csl-start-title"
                    v-model="startTitle"
                    type="text"
                    :maxlength="CONTENT_TITLE_MAX"
                    autocomplete="off"
                    :aria-invalid="startError?.field === 'title'"
                  >
                  <p v-if="startError?.field === 'title'" class="csl-field-error">{{ startError.message }}</p>
                  <p v-else class="csl-hint">Write the {{ localeLabel }} title yourself — it is not translated for you.</p>
                </div>
                <div class="csl-field">
                  <label for="csl-start-slug">URL slug <span class="csl-req" aria-hidden="true">*</span></label>
                  <input
                    id="csl-start-slug"
                    v-model="startSlug"
                    type="text"
                    :maxlength="CONTENT_SLUG_MAX"
                    autocomplete="off"
                    spellcheck="false"
                    :aria-invalid="startError?.field === 'slug'"
                  >
                  <p v-if="startError?.field === 'slug'" class="csl-field-error">{{ startError.message }}</p>
                  <p v-else class="csl-hint">Suggested from the {{ defaultLabel }} slug. You can change it; the same slug may be used in another language.</p>
                </div>
                <p v-if="startError && !startError.field" class="csl-field-error" role="alert">{{ startError.message }}</p>
                <button type="button" class="csl-btn csl-btn--primary" @click="startLocale">
                  {{ starting ? 'Starting…' : `Start ${localeLabel} draft` }}
                </button>
              </fieldset>
              <p v-if="dirty" class="csl-hint csl-warn-text">Save or discard your changes before starting a language.</p>
              <p v-if="!activeTab.sitePublished" class="csl-hint">{{ localeLabel }} is not enabled on the public site yet.</p>
            </div>

            <!-- Started: this language's SEO fields -->
            <fieldset v-else-if="form" class="csl-form" :disabled="locked">
              <legend class="csl-sr-only">{{ localeLabel }} SEO settings</legend>
              <p class="csl-meta">
                {{ localeLabel }} draft · revision {{ revision }} · {{ activeTab.stateLabel }}<template v-if="!activeTab.sitePublished"> · not enabled on the public site yet</template>
              </p>

              <div class="csl-row">
                <label class="csl-row-label" for="csl-slug">URL slug</label>
                <div class="csl-field">
                  <input
                    id="csl-slug"
                    v-model="form.slug"
                    type="text"
                    :maxlength="CONTENT_SLUG_MAX"
                    autocomplete="off"
                    spellcheck="false"
                    :disabled="slugLocked"
                    :aria-invalid="fieldError?.field === 'slug'"
                    aria-describedby="csl-slug-hint"
                  >
                  <p v-if="fieldError?.field === 'slug'" class="csl-field-error">{{ fieldError.message }}</p>
                  <p v-if="slugLocked" id="csl-slug-hint" class="csl-hint">Locked — this language has been published. A published URL cannot change.</p>
                  <p v-else id="csl-slug-hint" class="csl-hint">Lowercase letters, numbers and hyphens. Unique for {{ localeLabel }}.</p>
                </div>
              </div>

              <div class="csl-row">
                <label class="csl-row-label" for="csl-seo-title">SEO title</label>
                <div class="csl-field">
                  <input
                    id="csl-seo-title"
                    v-model="form.seo_title"
                    type="text"
                    :maxlength="CONTENT_SEO_TITLE_MAX"
                    autocomplete="off"
                    :aria-invalid="fieldError?.field === 'seo_title'"
                  >
                  <div class="csl-field-meta">
                    <p v-if="fieldError?.field === 'seo_title'" class="csl-field-error">{{ fieldError.message }}</p>
                    <p v-else class="csl-hint">Optional. Leave empty to use the page title.</p>
                    <span class="csl-count">{{ countOf(form.seo_title) }} / {{ CONTENT_SEO_TITLE_MAX }}</span>
                  </div>
                </div>
              </div>

              <div class="csl-row">
                <label class="csl-row-label" for="csl-seo-description">Meta description</label>
                <div class="csl-field">
                  <textarea
                    id="csl-seo-description"
                    v-model="form.seo_description"
                    rows="4"
                    :maxlength="CONTENT_SEO_DESCRIPTION_MAX"
                    :aria-invalid="fieldError?.field === 'seo_description'"
                  />
                  <div class="csl-field-meta">
                    <p v-if="fieldError?.field === 'seo_description'" class="csl-field-error">{{ fieldError.message }}</p>
                    <p v-else class="csl-hint">Optional. Leave empty to use the summary.</p>
                    <span class="csl-count">{{ countOf(form.seo_description) }} / {{ CONTENT_SEO_DESCRIPTION_MAX }}</span>
                  </div>
                </div>
              </div>

              <div class="csl-row">
                <label class="csl-row-label" for="csl-canonical">Canonical path</label>
                <div class="csl-field">
                  <input
                    id="csl-canonical"
                    v-model="form.canonical_path"
                    type="text"
                    :maxlength="CONTENT_CANONICAL_PATH_MAX"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="/path-on-this-site"
                    :aria-invalid="!canonicalCheck.ok || fieldError?.field === 'canonical_path'"
                  >
                  <p v-if="fieldError?.field === 'canonical_path'" class="csl-field-error">{{ fieldError.message }}</p>
                  <p v-else-if="!canonicalCheck.ok" class="csl-field-error">Use a path on this site that starts with “/” — not a full or external URL.</p>
                  <p class="csl-hint">Optional. Leave empty for the default. Default public canonical will be resolved when Public Delivery is enabled.</p>
                </div>
              </div>

              <div class="csl-row">
                <span class="csl-row-label">Noindex</span>
                <div class="csl-field">
                  <label class="csl-check" for="csl-noindex">
                    <input id="csl-noindex" v-model="form.noindex" type="checkbox">
                    Ask search engines not to index this language
                  </label>
                  <p class="csl-hint">Stored with the Draft. It takes effect only when this language is public.</p>
                </div>
              </div>

              <div class="csl-content-link">
                <p>Title, summary and sections for {{ localeLabel }} are edited in Content editor.</p>
                <NuxtLink :to="contentEditorLocaleRoute(itemId, activeLocale)" class="csl-link">Edit {{ localeLabel }} content</NuxtLink>
              </div>
            </fieldset>
          </div>
        </section>

        <section class="csl-card" aria-labelledby="csl-og-title">
          <div class="csl-card-head">
            <div>
              <h2 id="csl-og-title" class="csl-card-title">Open Graph image</h2>
              <p class="csl-card-hint">Image used when this content is shared. One Media Library image for all languages.</p>
            </div>
            <div class="csl-card-actions">
              <button type="button" class="csl-btn csl-btn--primary" :disabled="locked" @click="openOgPicker">
                {{ og ? 'Replace' : 'Select from Media Library' }}
              </button>
              <button v-if="og" type="button" class="csl-btn csl-btn--danger" :disabled="locked" @click="removeOgImage">Remove</button>
            </div>
          </div>

          <p v-if="pickerNotice" class="csl-field-error" role="alert">{{ pickerNotice }}</p>

          <div v-if="og" class="csl-og">
            <div class="csl-og-thumb">
              <img v-if="thumb(og, 320)" :src="thumb(og, 320)!" alt="" loading="lazy" @error="markBroken(og.directus_files_id)">
              <span v-else class="csl-kind">{{ fileKind(og.file.type) }}</span>
            </div>
            <div class="csl-og-info">
              <p class="csl-file-name">{{ og.file.filename_download ?? 'Untitled file' }}</p>
              <p class="csl-file-meta">
                <template v-if="og.file.width && og.file.height">{{ og.file.width }} × {{ og.file.height }} · </template>{{ formatContentFileSize(og.file.filesize) }}
              </p>
              <p class="csl-badges">
                <span v-if="ogDirty" class="csl-badge csl-badge--new">New — not saved yet</span>
                <span v-if="og.file.archived" class="csl-badge csl-badge--warn">Archived in Media Library — replace or remove</span>
              </p>
            </div>
          </div>
          <p v-else class="csl-empty">
            <template v-if="hero">No Open Graph image. Previews use the hero image.</template>
            <template v-else>No Open Graph image and no hero image.</template>
            <template v-if="ogDirty"> Removal is not saved yet.</template>
          </p>
          <p class="csl-hint csl-og-note">Setting or removing the Open Graph image never changes the hero image.</p>
        </section>
      </div>

      <aside class="csl-aside">
        <section class="csl-card" aria-labelledby="csl-search-title">
          <h2 id="csl-search-title" class="csl-card-title">Search preview</h2>
          <p class="csl-draft-badge">Draft preview — public route not enabled</p>
          <div class="csl-serp">
            <p class="csl-serp-locale">{{ localeLabel }}<template v-if="form"> · slug {{ form.slug || '—' }}</template></p>
            <p class="csl-serp-title" :class="{ 'csl-muted': !previewTitle.text }">{{ previewTitle.text || 'No title yet' }}</p>
            <p class="csl-serp-description" :class="{ 'csl-muted': !previewDescription.text }">{{ previewDescription.text || 'No description yet' }}</p>
            <p v-if="form?.noindex" class="csl-serp-noindex">Noindex on — this language would not be listed in search results.</p>
          </div>
          <p v-if="row" class="csl-hint">
            Title from {{ previewTitle.source === 'seo' ? 'SEO title' : 'page title' }} ·
            description from {{ previewDescription.source === 'seo' ? 'meta description' : previewDescription.source === 'fallback' ? 'summary' : 'nothing yet' }}.
          </p>
          <p v-else class="csl-hint">{{ localeLabel }} has no draft yet, so there is nothing to preview.</p>
        </section>

        <section class="csl-card" aria-labelledby="csl-social-title">
          <h2 id="csl-social-title" class="csl-card-title">Social preview</h2>
          <div class="csl-social">
            <div class="csl-social-image">
              <img
                v-if="previewImage && thumb(previewImage)"
                :src="thumb(previewImage)!"
                alt=""
                loading="lazy"
                @error="markBroken(previewImage.directus_files_id)"
              >
              <span v-else class="csl-kind">{{ previewImage ? fileKind(previewImage.file.type) : 'No image' }}</span>
            </div>
            <div class="csl-social-text">
              <p class="csl-social-title" :class="{ 'csl-muted': !previewTitle.text }">{{ previewTitle.text || 'No title yet' }}</p>
              <p class="csl-social-description" :class="{ 'csl-muted': !previewDescription.text }">{{ previewDescription.text || 'No description yet' }}</p>
            </div>
          </div>
          <p class="csl-hint">
            Image: {{ imageSource === 'og_image' ? 'Open Graph image' : imageSource === 'hero' ? 'hero image (fallback)' : 'none' }} · Draft preview · Not public
          </p>
        </section>

        <section class="csl-card" aria-labelledby="csl-check-title">
          <h2 id="csl-check-title" class="csl-card-title">SEO checklist</h2>
          <p class="csl-card-hint">Draft facts for {{ localeLabel }}.</p>
          <ul v-if="checklist.length" class="csl-checklist" role="list">
            <li v-for="check in checklist" :key="check.key" class="csl-check-item" :class="`csl-check-item--${check.state}`">
              <span class="csl-check-icon" aria-hidden="true">{{ check.state === 'ok' ? '✓' : check.state === 'note' ? 'i' : '!' }}</span>
              <span class="csl-check-text">
                <span class="csl-check-label">{{ check.label }}</span>
                <span class="csl-check-detail">{{ check.detail }}</span>
              </span>
            </li>
          </ul>
          <p v-else class="csl-hint">Start {{ localeLabel }} to see its checklist.</p>
        </section>
      </aside>
    </div>

    <div v-if="dirty || saving || conflict || justSaved" class="csl-savebar" role="region" aria-label="Save changes">
      <span class="csl-savebar-status" aria-live="polite">{{ statusLabel }}</span>
      <button type="button" class="csl-save" :disabled="!canSave" @click="save">{{ saving ? 'Saving…' : 'Save changes' }}</button>
    </div>

    <MediaLibraryPicker
      :open="browser.open.value"
      :files="browser.files.value"
      :loading="browser.loading.value"
      :error="browser.error.value"
      :total="browser.total.value"
      :search="browser.search.value"
      :type-filter="browser.typeFilter.value"
      :folders="browser.folders.value"
      :folders-error="browser.foldersError.value"
      :folder-id="browser.folderId.value"
      :linked-file-ids="og ? [og.directus_files_id] : []"
      title="Select an Open Graph image from Media Library"
      linked-title="Current Open Graph image"
      @close="browser.closeLibrary"
      @update-search="browser.updateSearch"
      @update-type-filter="browser.updateTypeFilter"
      @navigate-folder="browser.navigateFolder"
      @retry-folders="browser.loadFolders"
      @retry-files="browser.loadFiles(true)"
      @load-more="browser.loadFiles(false)"
      @pick-file="pickOgImage"
    />
  </div>
</template>

<style scoped>
.csl { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.csl-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--space-4);
  align-items: start;
}

.csl-main { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.csl-aside { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; position: sticky; top: var(--space-4); }

.csl-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  min-width: 0;
}

.csl-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.csl-card-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.csl-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.csl-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-4); line-height: 1.5; }
.csl-card-head .csl-card-hint { margin-bottom: 0; }
.csl-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
.csl-warn-text { color: #8A5A00; }
.csl-muted { color: var(--color-ink-muted) !important; font-style: italic; }

/* Tabs */
.csl-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-line);
  margin-bottom: var(--space-4);
}

.csl-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--color-ink);
  font-family: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  min-height: 44px;
}

.csl-tab--active { border-bottom-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
.csl-tab:disabled { cursor: not-allowed; opacity: 0.6; }

.csl-pill {
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  padding: 1px var(--space-2);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.csl-pill--draft { background: #E8EDE8; border-color: #D5DED7; color: #4A5E58; }
.csl-pill--published { background: #D1F0E8; border-color: #B5E2D4; color: #2F6B3A; }
.csl-pill--published_with_changes { background: #FFF6E0; border-color: #E8C66A; color: #5C4300; }

.csl-tabpanel { min-width: 0; }

/* Not started */
.csl-start { display: flex; flex-direction: column; gap: var(--space-3); }
.csl-start-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin: 0; }
.csl-start-text { font-size: var(--text-sm); color: var(--color-ink); margin: 0; }
.csl-start-form { border: none; margin: 0; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); border-radius: var(--radius-md); background: var(--color-surface-alt); min-width: 0; }
.csl-start-form .csl-btn { align-self: flex-start; }

/* SEO form */
.csl-form { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.csl-meta { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }

.csl-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: var(--space-2) var(--space-4);
  align-items: start;
}

.csl-row-label { font-size: var(--admin-label-size, var(--text-sm)); font-weight: 600; color: var(--color-ink); padding-top: var(--space-2); }

.csl-field { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.csl-field > label:not(.csl-check) { font-size: var(--admin-label-size, var(--text-sm)); font-weight: 600; color: var(--color-ink); }
.csl-req { color: #C0392B; }

.csl-field input[type="text"],
.csl-field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
}

.csl-field input[type="text"]:disabled { background: var(--color-surface-alt); color: var(--color-ink-muted); cursor: not-allowed; }
.csl-field input:focus, .csl-field textarea:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.csl-field [aria-invalid="true"] { border-color: #C0392B; }
.csl-field-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
.csl-count { font-size: 0.75rem; color: var(--color-ink-muted); margin-left: auto; white-space: nowrap; }
.csl-field-error { font-size: var(--text-xs); color: #C0392B; margin: 0; overflow-wrap: anywhere; }

.csl-check { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); min-height: 40px; cursor: pointer; }
.csl-check input { width: 18px; height: 18px; flex-shrink: 0; }

.csl-content-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
}

.csl-content-link p { margin: 0; }
.csl-link { color: var(--color-primary); font-weight: 500; text-decoration: none; }
.csl-link:hover { text-decoration: underline; }

/* Buttons */
.csl-btn {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.csl-btn--primary { border-color: var(--color-primary); color: var(--color-primary); font-weight: 500; }
.csl-btn--danger { color: #B03A2E; }
.csl-btn--warn { border-color: #B8860B; color: #5C4300; font-weight: 600; }
.csl-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* OG image */
.csl-og { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: var(--space-4); align-items: start; }
.csl-og-thumb, .csl-social-image {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  aspect-ratio: 1.91 / 1;
  max-width: 100%;
}

.csl-og-thumb img, .csl-social-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.csl-og-info { min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.csl-og-note { margin-top: var(--space-3); }
.csl-kind { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--color-ink-muted); text-transform: uppercase; }
.csl-file-name { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }
.csl-file-meta { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; }
.csl-badges { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; }
.csl-badge { font-size: 0.6875rem; font-weight: 600; border-radius: 999px; padding: 1px var(--space-2); background: var(--color-surface-alt); border: 1px solid var(--color-line); color: var(--color-ink-muted); }
.csl-badge--new { background: #E3F3EC; border-color: #BFE3D2; color: #1E6B4E; }
.csl-badge--warn { background: #FFF6E0; border-color: #E8C66A; color: #5C4300; }
.csl-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); }

/* Previews */
.csl-draft-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  padding: 1px var(--space-2);
  background: #FFF6E0;
  color: #5C4300;
  margin: 0 0 var(--space-3);
}

.csl-serp {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.csl-serp p { margin: 0; overflow-wrap: anywhere; }
.csl-serp-locale { font-size: var(--text-xs); color: var(--color-ink-muted); }
.csl-serp-title { font-size: var(--text-base); color: #1A4D8F; line-height: 1.35; }
.csl-serp-description { font-size: var(--text-sm); color: var(--color-ink); line-height: 1.5; }
.csl-serp-noindex { font-size: var(--text-xs); color: #8A5A00; }

.csl-social {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.csl-social-image { border: none; border-radius: 0; border-bottom: 1px solid var(--color-line); }
.csl-social-text { padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-1); }
.csl-social-text p { margin: 0; overflow-wrap: anywhere; }
.csl-social-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); }
.csl-social-description { font-size: var(--text-xs); color: var(--color-ink-muted); line-height: 1.5; }

/* Checklist */
.csl-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.csl-check-item { display: flex; gap: var(--space-3); align-items: flex-start; min-width: 0; }
.csl-check-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.csl-check-item--ok .csl-check-icon { background: #D1F0E8; color: #2F6B3A; }
.csl-check-item--note .csl-check-icon { background: #E8EDE8; color: #4A5E58; }
.csl-check-item--attention .csl-check-icon { background: #FFF6E0; color: #8A5A00; }
.csl-check-text { display: flex; flex-direction: column; min-width: 0; }
.csl-check-label { font-size: var(--text-sm); color: var(--color-ink); }
.csl-check-detail { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }

/* Banners */
.csl-conflict, .csl-error, .csl-partial { border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); font-size: var(--text-sm); }
.csl-conflict, .csl-partial { background: #FFF6E0; border: 1px solid #E8C66A; color: #5C4300; }
.csl-conflict-title { font-weight: 700; margin: 0 0 var(--space-1); }
.csl-conflict-text, .csl-conflict-warn { margin: 0 0 var(--space-3); }
.csl-partial .csl-conflict-text { margin: 0; }
.csl-error { background: #FDF0EE; border: 1px solid #F5C6C2; color: #C0392B; }
.csl-error p { margin: 0; }
.csl-error-link { color: var(--color-primary); }
.csl-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.csl-actions .csl-conflict-warn { flex-basis: 100%; }
.csl-notice { margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }

.csl-savebar {
  position: sticky;
  bottom: var(--space-3);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgba(27, 66, 36, 0.12);
}

.csl-savebar-status { font-size: var(--text-sm); color: var(--color-ink); }

.csl-save {
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.csl-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.csl-save:disabled { opacity: 0.55; cursor: not-allowed; }

.csl-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ── ≤1279px: previews and checklist stack below the settings ── */
@media (max-width: 1279px) {
  .csl-grid { grid-template-columns: minmax(0, 1fr); }
  .csl-aside { position: static; }
}

@media (max-width: 767px) {
  .csl-card { padding: var(--space-4); }
  .csl-row { grid-template-columns: minmax(0, 1fr); }
  .csl-row-label { padding-top: 0; }
  .csl-tabs { flex-direction: column; align-items: stretch; border-bottom: none; gap: var(--space-1); }
  .csl-tab { justify-content: space-between; border: 1px solid var(--color-line); border-radius: var(--radius-sm); margin-bottom: 0; }
  .csl-tab--active { border-color: var(--color-primary); box-shadow: inset 3px 0 0 var(--color-primary); }
  .csl-card-head { flex-direction: column; align-items: stretch; }
  .csl-card-actions { width: 100%; }
  .csl-card-actions .csl-btn { flex: 1 1 100%; }
  .csl-start-form .csl-btn { align-self: stretch; }
  .csl-og { grid-template-columns: minmax(0, 1fr); }
  .csl-actions .csl-btn { flex: 1 1 100%; }
  .csl-savebar { flex-direction: column; align-items: stretch; bottom: var(--space-2); }
  .csl-save { width: 100%; }
}
</style>
