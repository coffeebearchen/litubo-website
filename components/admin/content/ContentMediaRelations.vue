<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AdminContentMediaRelations } from '~/types/content-center'
import { workspaceMediaThumbUrl } from '~/utils/productWorkspace'
import { fileKind } from '~/utils/mediaDisplay'
import { CONTENT_LOCALE_LABELS } from '~/utils/contentCenter'
import {
  CONTENT_DOWNLOAD_LANGUAGES,
  CONTENT_DOWNLOAD_LANGUAGE_LABELS,
  CONTENT_MEDIA_ALT_MAX,
  CONTENT_MEDIA_CAPTION_MAX,
  CONTENT_MEDIA_ROLE_LABELS,
  CONTENT_MEDIA_VERSION_MAX,
  isImageMimeType,
  type ContentManagedMediaRole,
} from '~/utils/contentMediaRelations'
import {
  MEDIA_RELATIONS_CONFLICT_MESSAGE,
  buildMediaRelationsSaveBody,
  cloneMediaRelationsState,
  formatContentFileSize,
  interpretMediaRelationsSaveError,
  isMediaRelationsDirty,
  mediaOfRole,
  mediaRelationsStateFrom,
  moveMediaWithinRole,
  moveRelation,
  relationKindLabel,
  saveBodyLabels,
  stagedMediaFromFile,
  stagedRelationFromContent,
  stagedRelationFromProduct,
  summarizeMediaRelations,
  type MediaRelationsSaveError,
  type MediaRelationsState,
  type RelationCandidate,
  type StagedMediaLink,
} from '~/utils/contentMediaRelationsEditor'
import { useMediaLibraryBrowser } from '~/composables/useMediaLibraryBrowser'
import MediaLibraryPicker from '~/components/admin/media/MediaLibraryPicker.vue'
import ContentRelationPicker from './ContentRelationPicker.vue'

/**
 * CC-IMP-04 — CC-03 Media & Relations (CC-VIS-03-MEDIA-RELATIONS-D1440).
 *
 * Select / Replace / Remove / reorder / metadata only change staged state; Save
 * sends the whole desired inventory once. Files come from the shared Media
 * Library picker (archived files excluded), relations from the existing Product
 * Center and Content Center lists. Nothing here uploads, changes file lifecycle
 * or visibility, edits blocks, or touches the content status.
 */
const props = defineProps<{ initial: AdminContentMediaRelations }>()

const emit = defineEmits<{
  saved: [value: AdminContentMediaRelations]
  reloaded: [value: AdminContentMediaRelations]
  status: [status: { dirty: boolean, saving: boolean, justSaved: boolean, conflict: boolean }]
}>()

const current = ref<AdminContentMediaRelations>(props.initial)
const original = ref<MediaRelationsState>(mediaRelationsStateFrom(props.initial))
const state = ref<MediaRelationsState>(cloneMediaRelationsState(original.value))

function initialize(value: AdminContentMediaRelations) {
  current.value = value
  original.value = mediaRelationsStateFrom(value)
  state.value = cloneMediaRelationsState(original.value)
  if (selectedKey.value && !state.value.media.some(m => m.key === selectedKey.value)) selectedKey.value = null
}

const selectedKey = ref<string | null>(null)
const saving = ref(false)
const reloading = ref(false)
const justSaved = ref(false)
const error = ref<MediaRelationsSaveError | null>(null)
const conflict = ref(false)
const confirmReload = ref(false)
const pickerRole = ref<ContentManagedMediaRole | null>(null)
const relationKind = ref<'product' | 'content' | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined

const browser = useMediaLibraryBrowser()

const itemId = computed(() => current.value.item.id)
const archivedItem = computed(() => current.value.item.status === 'archived')
const locked = computed(() => saving.value || reloading.value || archivedItem.value)
const dirty = computed(() => isMediaRelationsDirty(original.value, state.value))
const canSave = computed(() => dirty.value && !locked.value)
const localeLabel = computed(() => CONTENT_LOCALE_LABELS[current.value.locale])
const hero = computed(() => mediaOfRole(state.value.media, 'hero')[0] ?? null)
const inline = computed(() => mediaOfRole(state.value.media, 'inline'))
const downloads = computed(() => mediaOfRole(state.value.media, 'download'))
const summary = computed(() => summarizeMediaRelations(state.value))
const selected = computed(() => state.value.media.find(m => m.key === selectedKey.value) ?? null)
const pickerLinkedIds = computed(() => (pickerRole.value ? mediaOfRole(state.value.media, pickerRole.value).map(m => m.directus_files_id) : []))
const linkedRelationKeys = computed(() => state.value.relations.map(r => r.key))

const statusLabel = computed(() => {
  if (saving.value) return 'Saving…'
  if (conflict.value) return 'Not saved — media or relations changed'
  if (error.value && dirty.value) return 'Not saved'
  if (justSaved.value) return 'Saved'
  return dirty.value ? 'Unsaved changes' : 'All changes saved'
})

watch([dirty, saving, justSaved, conflict], () => {
  emit('status', { dirty: dirty.value, saving: saving.value, justSaved: justSaved.value, conflict: conflict.value })
}, { immediate: true })

watch(dirty, (value: boolean) => { if (value) justSaved.value = false })

/** Thumbnails come from the Media Library's own preview route, the one its picker uses. */
const brokenThumbs = ref(new Set<string>())

function thumb(link: StagedMediaLink, size = 240): string | null {
  if (!isImageMimeType(link.file.type) || brokenThumbs.value.has(link.directus_files_id)) return null
  return workspaceMediaThumbUrl(link.directus_files_id, { width: size, height: Math.round(size * 0.66) })
}

function markBroken(link: StagedMediaLink) {
  brokenThumbs.value = new Set([...brokenThumbs.value, link.directus_files_id])
}

function visibilityLabel(link: StagedMediaLink): string {
  if (link.file.is_public === null) return 'Shown after save'
  return link.file.is_public ? 'Public file' : 'Private file'
}

// ── Staging: nothing below issues a request ──────────────────────────────────

function openPicker(role: ContentManagedMediaRole) {
  pickerRole.value = role
  void browser.openLibrary(role === 'download' ? '' : 'image')
}

function closePicker() {
  browser.closeLibrary()
  pickerRole.value = null
}

function pickFile(fileId: string) {
  const role = pickerRole.value
  const file = browser.files.value.find(f => f.id === fileId)
  if (!role || !file) return
  const staged = stagedMediaFromFile(file, role)
  if (state.value.media.some(m => m.key === staged.key)) return
  if (role === 'hero') state.value.media = state.value.media.filter(m => m.file_role !== 'hero')
  state.value.media.push(staged)
  selectedKey.value = staged.key
  closePicker()
}

function removeMedia(key: string) {
  const link = state.value.media.find(m => m.key === key)
  if (!link || link.used_by_image_blocks) return
  state.value.media = state.value.media.filter(m => m.key !== key)
  if (selectedKey.value === key) selectedKey.value = null
}

function moveMedia(key: string, delta: number) {
  state.value.media = moveMediaWithinRole(state.value.media, key, delta)
}

function pickRelation(candidate: RelationCandidate) {
  const staged = candidate.kind === 'product'
    ? stagedRelationFromProduct({ id: candidate.id, name_en: candidate.label, product_code: candidate.code, status: candidate.status })
    : stagedRelationFromContent({ id: candidate.id, title: candidate.label, content_type: candidate.content_type, status: candidate.status })
  if (!state.value.relations.some(r => r.key === staged.key)) state.value.relations.push(staged)
  relationKind.value = null
}

function removeRelation(key: string) {
  state.value.relations = state.value.relations.filter(r => r.key !== key)
}

function moveRel(key: string, delta: number) {
  state.value.relations = moveRelation(state.value.relations, key, delta)
}

// ── Save / reload: the only requests that change or re-read the inventory ───

async function save() {
  if (!canSave.value) return
  const body = buildMediaRelationsSaveBody(state.value, current.value.inventory_version, current.value.locale)
  const labels = saveBodyLabels(state.value)
  saving.value = true
  error.value = null
  try {
    const saved = await $fetch<AdminContentMediaRelations>(`/api/admin/content-center/${itemId.value}/media-relations`, {
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
    const view = interpretMediaRelationsSaveError(err, labels)
    error.value = view
    conflict.value = view.kind === 'conflict' || view.kind === 'partial'
  } finally {
    saving.value = false
  }
}

async function reloadLatest() {
  reloading.value = true
  try {
    const latest = await $fetch<AdminContentMediaRelations>(`/api/admin/content-center/${itemId.value}/media-relations`, {
      query: { locale: current.value.locale },
    })
    initialize(latest)
    conflict.value = false
    confirmReload.value = false
    error.value = null
    emit('reloaded', latest)
  } catch (err: unknown) {
    error.value = interpretMediaRelationsSaveError(err)
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
  <div class="cmr">
    <div v-if="conflict" class="cmr-conflict" role="alert">
      <p class="cmr-conflict-title">{{ error?.kind === 'partial' ? 'Saving stopped part-way.' : MEDIA_RELATIONS_CONFLICT_MESSAGE }}</p>
      <p class="cmr-conflict-text">
        {{ error?.kind === 'partial' ? error.message : 'Your staged changes below were not saved and are still here.' }}
      </p>
      <div v-if="!confirmReload" class="cmr-actions">
        <button type="button" class="cmr-btn" @click="keepEditing">Keep editing</button>
        <button type="button" class="cmr-btn cmr-btn--warn" @click="confirmReload = true">Reload latest</button>
      </div>
      <div v-else class="cmr-actions">
        <p class="cmr-conflict-warn">Reloading discards your staged changes and shows what is saved now.</p>
        <button type="button" class="cmr-btn cmr-btn--warn" :disabled="reloading" @click="reloadLatest">
          {{ reloading ? 'Reloading…' : 'Discard my changes and reload' }}
        </button>
        <button type="button" class="cmr-btn" :disabled="reloading" @click="confirmReload = false">Cancel</button>
      </div>
    </div>

    <div v-else-if="error" class="cmr-error" role="alert">
      <p>{{ error.message }}</p>
      <ul v-if="error.errors.length" class="cmr-error-list">
        <li v-for="(line, i) in error.errors" :key="i">{{ line }}</li>
      </ul>
    </div>

    <p v-if="archivedItem" class="cmr-notice" role="status">This content item is archived. Its media and relations cannot be changed.</p>

    <div class="cmr-grid">
      <fieldset class="cmr-main" :disabled="locked">
        <legend class="cmr-sr-only">Media and relations</legend>

        <!-- Hero -->
        <section class="cmr-card" aria-labelledby="cmr-hero-title">
          <div class="cmr-card-head">
            <div>
              <h2 id="cmr-hero-title" class="cmr-card-title">Hero media</h2>
              <p class="cmr-card-hint">Main cover image for this content. One image, selected from Media Library.</p>
            </div>
            <div class="cmr-card-actions">
              <button v-if="hero" type="button" class="cmr-btn" @click="selectedKey = hero.key">View details</button>
              <button type="button" class="cmr-btn cmr-btn--primary" @click="openPicker('hero')">{{ hero ? 'Replace' : 'Select from Media Library' }}</button>
              <button v-if="hero" type="button" class="cmr-btn cmr-btn--danger" @click="removeMedia(hero.key)">Remove</button>
            </div>
          </div>
          <div v-if="hero" class="cmr-hero" :class="{ 'cmr-selected': selectedKey === hero.key }">
            <div class="cmr-hero-thumb">
              <img v-if="thumb(hero, 480)" :src="thumb(hero, 480)!" :alt="hero.alt || ''" loading="lazy" @error="markBroken(hero)">
              <span v-else class="cmr-kind">{{ fileKind(hero.file.type) }}</span>
            </div>
            <div class="cmr-hero-info">
              <p class="cmr-file-name">{{ hero.file.filename_download ?? 'Untitled file' }}</p>
              <p class="cmr-file-meta">
                <template v-if="hero.file.width && hero.file.height">{{ hero.file.width }} × {{ hero.file.height }} · </template>{{ formatContentFileSize(hero.file.filesize) }}
              </p>
              <p class="cmr-badges">
                <span v-if="hero.id === null" class="cmr-badge cmr-badge--new">New — not saved yet</span>
                <span v-if="hero.file.archived" class="cmr-badge cmr-badge--warn">Archived in Media Library — replace or remove</span>
                <span class="cmr-badge">{{ visibilityLabel(hero) }}</span>
              </p>
            </div>
          </div>
          <p v-else class="cmr-empty">No hero media selected.</p>
        </section>

        <!-- Inline -->
        <section class="cmr-card" aria-labelledby="cmr-inline-title">
          <div class="cmr-card-head">
            <div>
              <h2 id="cmr-inline-title" class="cmr-card-title">Inline media</h2>
              <p class="cmr-card-hint">Images available to image sections in the content.</p>
            </div>
            <button type="button" class="cmr-btn cmr-btn--primary" @click="openPicker('inline')">Add media</button>
          </div>
          <p v-if="inline.length === 0" class="cmr-empty">No inline media linked.</p>
          <ul v-else class="cmr-tiles" role="list">
            <li v-for="(link, i) in inline" :key="link.key" class="cmr-tile" :class="{ 'cmr-selected': selectedKey === link.key }">
              <button type="button" class="cmr-tile-main" :aria-label="`Details for ${link.file.filename_download ?? 'file'}`" @click="selectedKey = link.key">
                <span class="cmr-tile-thumb">
                  <img v-if="thumb(link)" :src="thumb(link)!" :alt="link.alt || ''" loading="lazy" @error="markBroken(link)">
                  <span v-else class="cmr-kind">{{ fileKind(link.file.type) }}</span>
                </span>
                <span class="cmr-file-name">{{ link.file.filename_download ?? 'Untitled file' }}</span>
                <span class="cmr-file-meta">{{ formatContentFileSize(link.file.filesize) }}</span>
              </button>
              <p class="cmr-badges">
                <span v-if="link.id === null" class="cmr-badge cmr-badge--new">New</span>
                <span v-if="link.file.archived" class="cmr-badge cmr-badge--warn">Archived</span>
                <span v-if="link.used_by_image_blocks" class="cmr-badge">Used by an image section</span>
              </p>
              <div class="cmr-row-actions">
                <button type="button" class="btn-icon cmr-icon" :disabled="i === 0" :aria-label="`Move ${link.file.filename_download ?? 'file'} up`" @click="moveMedia(link.key, -1)">↑</button>
                <button type="button" class="btn-icon cmr-icon" :disabled="i === inline.length - 1" :aria-label="`Move ${link.file.filename_download ?? 'file'} down`" @click="moveMedia(link.key, 1)">↓</button>
                <button
                  type="button"
                  class="cmr-link-btn"
                  :disabled="link.used_by_image_blocks"
                  :title="link.used_by_image_blocks ? 'Remove the image section in Content editor first' : undefined"
                  @click="removeMedia(link.key)"
                >Remove</button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Downloads -->
        <section class="cmr-card" aria-labelledby="cmr-downloads-title">
          <div class="cmr-card-head">
            <div>
              <h2 id="cmr-downloads-title" class="cmr-card-title">Downloads &amp; attachments</h2>
              <p class="cmr-card-hint">Downloadable files such as PDFs and data sheets, referenced from Media Library.</p>
            </div>
            <button type="button" class="cmr-btn cmr-btn--primary" @click="openPicker('download')">Add download</button>
          </div>
          <p v-if="downloads.length === 0" class="cmr-empty">No downloads linked.</p>
          <ul v-else class="cmr-rows" role="list">
            <li v-for="(link, i) in downloads" :key="link.key" class="cmr-row" :class="{ 'cmr-selected': selectedKey === link.key }">
              <button type="button" class="cmr-row-main" @click="selectedKey = link.key">
                <span class="cmr-row-kind">{{ fileKind(link.file.type) }}</span>
                <span class="cmr-row-text">
                  <span class="cmr-file-name">{{ link.file.filename_download ?? 'Untitled file' }}</span>
                  <span class="cmr-file-meta">
                    {{ link.language ? CONTENT_DOWNLOAD_LANGUAGE_LABELS[link.language] : 'Language not set' }}
                    <template v-if="link.version_label"> · {{ link.version_label }}</template>
                    <template v-if="link.file_date"> · {{ link.file_date }}</template>
                    <template v-if="!link.enabled"> · Disabled</template>
                  </span>
                </span>
              </button>
              <p class="cmr-badges">
                <span v-if="link.id === null" class="cmr-badge cmr-badge--new">New</span>
                <span v-if="link.file.archived" class="cmr-badge cmr-badge--warn">Archived</span>
              </p>
              <div class="cmr-row-actions">
                <button type="button" class="btn-icon cmr-icon" :disabled="i === 0" :aria-label="`Move ${link.file.filename_download ?? 'file'} up`" @click="moveMedia(link.key, -1)">↑</button>
                <button type="button" class="btn-icon cmr-icon" :disabled="i === downloads.length - 1" :aria-label="`Move ${link.file.filename_download ?? 'file'} down`" @click="moveMedia(link.key, 1)">↓</button>
                <button type="button" class="cmr-link-btn" @click="removeMedia(link.key)">Remove</button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Relations -->
        <section class="cmr-card" aria-labelledby="cmr-relations-title">
          <div class="cmr-card-head">
            <div>
              <h2 id="cmr-relations-title" class="cmr-card-title">Related content</h2>
              <p class="cmr-card-hint">Related products, articles and resources. Only ids are stored.</p>
            </div>
            <div class="cmr-card-actions">
              <button type="button" class="cmr-btn" @click="relationKind = 'product'">Link product</button>
              <button type="button" class="cmr-btn" @click="relationKind = 'content'">Link content</button>
            </div>
          </div>
          <p v-if="state.relations.length === 0" class="cmr-empty">No related items.</p>
          <ul v-else class="cmr-rows" role="list">
            <li v-for="(relation, i) in state.relations" :key="relation.key" class="cmr-row">
              <div class="cmr-row-main cmr-row-main--static">
                <span class="cmr-kind-badge" :class="`cmr-kind-badge--${relation.relation_kind}`">{{ relationKindLabel(relation) }}</span>
                <span class="cmr-row-text">
                  <span class="cmr-file-name">{{ relation.label }}</span>
                  <span class="cmr-file-meta">
                    <template v-if="relation.code">{{ relation.code }} · </template>{{ relation.status ?? 'unknown status' }}
                    <template v-if="relation.status && relation.status !== 'published'"> — not shown publicly until published</template>
                  </span>
                </span>
              </div>
              <p class="cmr-badges">
                <span v-if="relation.id === null" class="cmr-badge cmr-badge--new">New</span>
              </p>
              <div class="cmr-row-actions">
                <button type="button" class="btn-icon cmr-icon" :disabled="i === 0" :aria-label="`Move ${relation.label} up`" @click="moveRel(relation.key, -1)">↑</button>
                <button type="button" class="btn-icon cmr-icon" :disabled="i === state.relations.length - 1" :aria-label="`Move ${relation.label} down`" @click="moveRel(relation.key, 1)">↓</button>
                <button type="button" class="cmr-link-btn" @click="removeRelation(relation.key)">Remove</button>
              </div>
            </li>
          </ul>
        </section>
      </fieldset>

      <aside class="cmr-aside">
        <section class="cmr-card" aria-labelledby="cmr-summary-title">
          <h2 id="cmr-summary-title" class="cmr-card-title">Content media summary</h2>
          <dl class="cmr-facts">
            <div><dt>Hero media</dt><dd>{{ summary.hero }}</dd></div>
            <div><dt>Inline media</dt><dd>{{ summary.inline }}</dd></div>
            <div><dt>Downloads</dt><dd>{{ summary.downloads }}</dd></div>
            <div><dt>Related products</dt><dd>{{ summary.products }}</dd></div>
            <div><dt>Related content</dt><dd>{{ summary.content }}</dd></div>
            <div><dt>Related resources</dt><dd>{{ summary.resources }}</dd></div>
          </dl>
          <p v-if="summary.archived" class="cmr-card-hint cmr-warn-text">{{ summary.archived }} linked file(s) are archived in Media Library.</p>
          <p v-if="current.preserved_role_counts.og_image || current.preserved_role_counts.source_document" class="cmr-card-hint">
            Kept unchanged here: {{ current.preserved_role_counts.og_image }} Open Graph image link(s) (SEO &amp; locales) and
            {{ current.preserved_role_counts.source_document }} source document link(s) (AI Source Intake).
          </p>
        </section>

        <section class="cmr-card" aria-labelledby="cmr-details-title">
          <h2 id="cmr-details-title" class="cmr-card-title">Selected asset</h2>
          <p v-if="!selected" class="cmr-card-hint">Select a hero, inline or download file to see its details.</p>
          <fieldset v-else class="cmr-details" :disabled="locked">
            <legend class="cmr-sr-only">Selected asset details</legend>
            <div v-if="thumb(selected, 320)" class="cmr-details-thumb">
              <img :src="thumb(selected, 320)!" :alt="selected.alt || ''" @error="markBroken(selected)">
            </div>
            <dl class="cmr-facts">
              <div><dt>File name</dt><dd>{{ selected.file.filename_download ?? '—' }}</dd></div>
              <div><dt>Type</dt><dd>{{ fileKind(selected.file.type) }}</dd></div>
              <div><dt>Size</dt><dd>{{ formatContentFileSize(selected.file.filesize) }}</dd></div>
              <div v-if="selected.file.width && selected.file.height"><dt>Dimensions</dt><dd>{{ selected.file.width }} × {{ selected.file.height }}</dd></div>
              <div><dt>Role</dt><dd>{{ CONTENT_MEDIA_ROLE_LABELS[selected.file_role] }}</dd></div>
              <div><dt>Media Library</dt><dd>{{ selected.file.archived ? 'Archived' : 'Active' }}</dd></div>
              <div><dt>Visibility</dt><dd>{{ visibilityLabel(selected) }}</dd></div>
              <div class="cmr-facts-wide"><dt>Media UUID</dt><dd class="cmr-mono">{{ selected.directus_files_id }}</dd></div>
            </dl>

            <label class="cmr-field-label" for="cmr-alt">Alt text ({{ localeLabel }})</label>
            <input id="cmr-alt" v-model="selected.alt" class="cmr-input" type="text" :maxlength="CONTENT_MEDIA_ALT_MAX">
            <label class="cmr-field-label" for="cmr-caption">Caption ({{ localeLabel }})</label>
            <textarea id="cmr-caption" v-model="selected.caption" class="cmr-input" rows="2" :maxlength="CONTENT_MEDIA_CAPTION_MAX" />

            <template v-if="selected.file_role === 'download'">
              <label class="cmr-field-label" for="cmr-language">Language</label>
              <select id="cmr-language" v-model="selected.language" class="cmr-input">
                <option value="">Not set</option>
                <option v-for="lang in CONTENT_DOWNLOAD_LANGUAGES" :key="lang" :value="lang">{{ CONTENT_DOWNLOAD_LANGUAGE_LABELS[lang] }}</option>
              </select>
              <label class="cmr-field-label" for="cmr-version">Version</label>
              <input id="cmr-version" v-model="selected.version_label" class="cmr-input" type="text" :maxlength="CONTENT_MEDIA_VERSION_MAX">
              <label class="cmr-field-label" for="cmr-date">File date</label>
              <input id="cmr-date" v-model="selected.file_date" class="cmr-input" type="date">
            </template>

            <label class="cmr-check">
              <input v-model="selected.enabled" type="checkbox"> Enabled
            </label>
            <p class="cmr-card-hint">The file itself — name, folder, visibility, archive — is managed in Media Library.</p>
          </fieldset>
        </section>
      </aside>
    </div>

    <div v-if="dirty || saving || conflict || justSaved" class="cmr-savebar" role="region" aria-label="Save changes">
      <span class="cmr-savebar-status" aria-live="polite">{{ statusLabel }}</span>
      <button type="button" class="cmr-save" :disabled="!canSave" @click="save">{{ saving ? 'Saving…' : 'Save changes' }}</button>
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
      :linked-file-ids="pickerLinkedIds"
      :title="pickerRole ? `Select ${CONTENT_MEDIA_ROLE_LABELS[pickerRole].toLowerCase()} from Media Library` : 'Select from Media Library'"
      linked-title="Already linked in this role"
      @close="closePicker"
      @update-search="browser.updateSearch"
      @update-type-filter="browser.updateTypeFilter"
      @navigate-folder="browser.navigateFolder"
      @retry-folders="browser.loadFolders"
      @retry-files="browser.loadFiles(true)"
      @load-more="browser.loadFiles(false)"
      @pick-file="pickFile"
    />

    <ContentRelationPicker
      :open="relationKind !== null"
      :kind="relationKind ?? 'product'"
      :item-id="itemId"
      :linked-keys="linkedRelationKeys"
      @close="relationKind = null"
      @pick="pickRelation"
    />
  </div>
</template>

<style scoped>
.cmr { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.cmr-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--space-4);
  align-items: start;
}

.cmr-main {
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cmr-aside { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; position: sticky; top: var(--space-4); }

.cmr-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  min-width: 0;
}

.cmr-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.cmr-card-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.cmr-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.cmr-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; line-height: 1.5; }
.cmr-warn-text { color: #8A5A00; margin-top: var(--space-2); }
.cmr-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); }

.cmr-btn {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cmr-btn--primary { border-color: var(--color-primary); color: var(--color-primary); font-weight: 500; }
.cmr-btn--danger { color: #B03A2E; }
.cmr-btn--warn { border-color: #B8860B; color: #5C4300; font-weight: 600; }
.cmr-btn:disabled, .cmr-link-btn:disabled, .cmr-icon:disabled { opacity: 0.45; cursor: not-allowed; }

.cmr-icon {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cmr-link-btn { background: none; border: none; color: #B03A2E; text-decoration: underline; cursor: pointer; }

.cmr-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
.cmr-hero-thumb, .cmr-tile-thumb, .cmr-details-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}

.cmr-hero-thumb { aspect-ratio: 16 / 10; }
.cmr-hero-thumb img, .cmr-tile-thumb img, .cmr-details-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmr-hero-info { min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cmr-kind { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--color-ink-muted); }

.cmr-file-name { font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }
.cmr-file-meta { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; overflow-wrap: anywhere; }

.cmr-badges { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; }
.cmr-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 1px var(--space-2);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  color: var(--color-ink-muted);
}

.cmr-badge--new { background: #E3F3EC; border-color: #BFE3D2; color: #1E6B4E; }
.cmr-badge--warn { background: #FFF6E0; border-color: #E8C66A; color: #5C4300; }

.cmr-tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: var(--space-3);
}

.cmr-tile {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.cmr-tile-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
  background: none;
  border: none;
  padding: 0 !important;
  cursor: pointer;
  font-family: inherit;
  min-width: 0;
}

.cmr-tile-thumb { aspect-ratio: 3 / 2; width: 100%; }

.cmr-row-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }

.cmr-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }

.cmr-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  min-width: 0;
}

.cmr-row-main {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  background: none;
  border: none;
  padding: 0 !important;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.cmr-row-main--static { cursor: default; }
.cmr-row-text { display: flex; flex-direction: column; min-width: 0; }

.cmr-row-kind {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-ink-muted);
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.cmr-kind-badge {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px var(--space-2);
  background: #EEF2FA;
  color: #34507A;
  white-space: nowrap;
}

.cmr-kind-badge--product { background: #E3F3EC; color: #1E6B4E; }

.cmr-selected { border-color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary); }

.cmr-facts { margin: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cmr-facts > div { display: flex; justify-content: space-between; gap: var(--space-3); min-width: 0; }
.cmr-facts dt { font-size: var(--text-xs); color: var(--color-ink-muted); flex-shrink: 0; }
.cmr-facts dd { font-size: var(--text-xs); color: var(--color-ink); margin: 0; text-align: right; overflow-wrap: anywhere; min-width: 0; }
.cmr-facts-wide { flex-direction: column; }
.cmr-facts-wide dd { text-align: left; }
.cmr-mono { font-family: 'Courier New', monospace; }

.cmr-details { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cmr-details-thumb { aspect-ratio: 4 / 3; }
.cmr-field-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); margin-top: var(--space-1); }

.cmr-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
}

.cmr-check { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-ink); }

.cmr-conflict, .cmr-error { border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); font-size: var(--text-sm); }
.cmr-conflict { background: #FFF6E0; border: 1px solid #E8C66A; color: #5C4300; }
.cmr-conflict-title { font-weight: 700; margin: 0 0 var(--space-1); }
.cmr-conflict-text, .cmr-conflict-warn { margin: 0 0 var(--space-3); }
.cmr-error { background: #FDF0EE; border: 1px solid #F5C6C2; color: #C0392B; }
.cmr-error p { margin: 0; }
.cmr-error-list { margin: var(--space-2) 0 0; padding-left: var(--space-5); overflow-wrap: anywhere; }
.cmr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.cmr-actions .cmr-conflict-warn { flex-basis: 100%; }
.cmr-notice { margin: 0; padding: var(--space-4); border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }

.cmr-savebar {
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
  box-shadow: 0 4px 16px rgba(18, 60, 50, 0.12);
}

.cmr-savebar-status { font-size: var(--text-sm); color: var(--color-ink); }

.cmr-save {
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.cmr-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.cmr-save:disabled { opacity: 0.55; cursor: not-allowed; }

.cmr-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── ≤1279px: the summary and details stack below the lists ── */
@media (max-width: 1279px) {
  .cmr-grid { grid-template-columns: minmax(0, 1fr); }
  .cmr-aside { position: static; }
}

@media (max-width: 767px) {
  .cmr-card { padding: var(--space-4); }
  .cmr-card-head { flex-direction: column; align-items: stretch; }
  .cmr-card-head .cmr-btn, .cmr-card-actions { width: 100%; }
  .cmr-card-actions .cmr-btn { flex: 1 1 100%; }
  .cmr-hero { grid-template-columns: minmax(0, 1fr); }
  .cmr-tiles { grid-template-columns: minmax(0, 1fr); }
  .cmr-actions .cmr-btn { flex: 1 1 100%; }
  .cmr-savebar { flex-direction: column; align-items: stretch; bottom: var(--space-2); }
  .cmr-save { width: 100%; }
}
</style>
