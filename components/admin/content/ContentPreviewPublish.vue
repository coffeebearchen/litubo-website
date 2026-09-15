<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  AdminContentPreviewMedia,
  AdminContentPreviewPublish,
  AdminContentPublicationResult,
  ContentReadinessCheck,
  ContentRendererImage as RendererImage,
  ContentRendererListEntry as RendererListEntry,
} from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import ContentBlocksRenderer from '~/components/content/ContentBlocksRenderer.vue'
import {
  CONTENT_LOCALE_LABELS,
  CONTENT_LOCALE_STATE_LABELS,
  CONTENT_STATUS_LABELS,
  contentSeoLocalesRoute,
  formatContentDateTime,
} from '~/utils/contentCenter'
import {
  DRAFT_PREVIEW_BANNER,
  currentDraftRevision,
  interpretPublicationError,
  previewImageUrl,
  previewMediaName,
  previewMediaStatus,
  publicationLocaleTabs,
  publicationOutcomeMessage,
  publishAction,
  publishConfirmMessage,
  readinessCounts,
  readinessHeadline,
  unpublishConfirmMessage,
} from '~/utils/contentPreviewPublish'

/**
 * CC-IMP-06 — CC-05 Preview & Publish Readiness (CC-VIS-05-PREVIEW-PUBLISH-READINESS-D1440).
 *
 * Admin-only Draft preview of one language, the server's deterministic readiness
 * checklist, the publication state, and the two manual actions. Publish and
 * Unpublish each need an explicit confirmation and send one request; the server
 * re-checks everything. Not in V1 (Freeze §23): legal / brand review, QR codes,
 * share or distribution features, percentages and scores.
 */
const props = defineProps<{ initial: AdminContentPreviewPublish }>()

const emit = defineEmits<{
  state: [value: AdminContentPreviewPublish]
  locale: [code: ContentLocale]
  status: [value: { enabled: boolean, label: string, reason: string | null, busy: boolean }]
}>()

const state = ref<AdminContentPreviewPublish>(props.initial)
const busy = ref<'publish' | 'unpublish' | 'locale' | null>(null)
const notice = ref<{ tone: 'success' | 'warning' | 'error', message: string, reload: boolean } | null>(null)

const apiBase = computed(() => `/api/admin/content-center/${encodeURIComponent(String(state.value.item.id))}`)
const preview = computed(() => state.value.preview)
const localeName = computed(() => CONTENT_LOCALE_LABELS[state.value.locale])
const tabs = computed(() => publicationLocaleTabs(state.value))
const action = computed(() => publishAction(state.value))
const counts = computed(() => readinessCounts(state.value.readiness))
const localeRow = computed(() => state.value.locales.find(l => l.locale === state.value.locale) ?? null)

watch([action, busy], () => {
  emit('status', { ...action.value, busy: busy.value !== null })
}, { immediate: true })

function setState(value: AdminContentPreviewPublish) {
  state.value = value
  emit('state', value)
}

async function load(locale: ContentLocale): Promise<void> {
  setState(await $fetch<AdminContentPreviewPublish>(`${apiBase.value}/preview-publish`, { query: { locale } }))
}

async function selectLocale(code: ContentLocale) {
  if (busy.value || code === state.value.locale) return
  busy.value = 'locale'
  try {
    await load(code)
    notice.value = null
    emit('locale', code)
  } catch (err) {
    notice.value = { tone: 'error', message: interpretPublicationError(err).message, reload: false }
  } finally {
    busy.value = null
  }
}

async function reload() {
  if (busy.value) return
  busy.value = 'locale'
  try {
    await load(state.value.locale)
    notice.value = null
  } catch (err) {
    notice.value = { tone: 'error', message: interpretPublicationError(err).message, reload: true }
  } finally {
    busy.value = null
  }
}

async function runAction(kind: 'publish' | 'unpublish') {
  const current = state.value
  const locale = current.locale
  const url = `${apiBase.value}/locales/${locale}/${kind}`
  busy.value = kind
  try {
    const res = kind === 'publish'
      ? await $fetch<AdminContentPublicationResult>(url, {
          method: 'POST',
          body: { expectedDraftRevision: currentDraftRevision(current), expectedPublicationInputFingerprint: current.publicationInputFingerprint },
        })
      : await $fetch<AdminContentPublicationResult>(url, { method: 'POST', body: {} })
    setState(res.state)
    notice.value = { tone: 'success', message: publicationOutcomeMessage(res.result, res.state), reload: false }
  } catch (err) {
    const view = interpretPublicationError(err)
    notice.value = { tone: view.kind === 'partial' ? 'warning' : 'error', message: view.message, reload: view.kind === 'conflict' }
    if (['not_ready', 'partial', 'archived'].includes(view.kind)) {
      try { await load(locale) } catch { /* the notice already explains the failure */ }
    }
  } finally {
    busy.value = null
  }
}

/** Manual, confirmed Publish. The button being enabled is not authority — the server re-checks. */
async function publish() {
  if (busy.value || !action.value.enabled) return
  if (!window.confirm(publishConfirmMessage(state.value))) return
  await runAction('publish')
}

async function unpublish() {
  if (busy.value || !state.value.can_unpublish) return
  if (!window.confirm(unpublishConfirmMessage(state.value))) return
  await runAction('unpublish')
}

defineExpose({ publish })

// ── Preview data ──

const heroUrl = computed(() => previewImageUrl(preview.value?.hero ?? null))

const images = computed<Record<number, RendererImage>>(() => Object.fromEntries((preview.value?.inline ?? []).map(media => [
  media.link_id,
  { src: previewImageUrl(media, 960), alt: media.alt ?? '', caption: media.caption, note: previewMediaStatus(media) },
])))

function mediaMeta(media: AdminContentPreviewMedia): string | null {
  const parts = [media.language && media.language !== 'all' ? media.language.toUpperCase() : null, media.version_label, media.file_date].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

const downloads = computed<RendererListEntry[]>(() => (preview.value?.downloads ?? []).map(media => ({
  key: media.link_id, label: previewMediaName(media), meta: mediaMeta(media), note: previewMediaStatus(media),
})))

const relations = computed<RendererListEntry[]>(() => (preview.value?.relations ?? []).map(relation => ({
  key: relation.id,
  label: relation.label ?? (relation.relation_kind === 'product'
    ? `Product #${relation.target_id}`
    : `Content #${relation.target_id} — no ${localeName.value} version`),
  meta: relation.relation_kind === 'product' ? 'Product' : 'Content',
  note: relation.status && relation.status !== 'published' ? `${relation.status[0].toUpperCase()}${relation.status.slice(1)} — not shown publicly` : null,
})))

const stateLabel = (check: ContentReadinessCheck) => (check.state === 'pass' ? 'Pass' : check.state === 'fail' ? 'Blocker' : 'Warning')
</script>

<template>
  <div class="cpp">
    <div class="cpp-tabs" role="tablist" aria-label="Language">
      <button
        v-for="tab in tabs"
        :key="tab.code"
        type="button"
        role="tab"
        class="cpp-tab"
        :class="{ 'cpp-tab--active': tab.active }"
        :aria-selected="tab.active"
        :disabled="busy !== null && !tab.active"
        @click="selectLocale(tab.code)"
      >
        <span class="cpp-tab-label">{{ tab.label }}<template v-if="tab.isDefault"> (default)</template></span>
        <span class="cpp-tab-state">{{ tab.stateLabel }}</span>
      </button>
    </div>

    <div v-if="notice" class="cpp-notice" :class="`cpp-notice--${notice.tone}`" :role="notice.tone === 'success' ? 'status' : 'alert'">
      <span>{{ notice.message }}</span>
      <button v-if="notice.reload" type="button" class="cpp-btn" @click="reload()">Reload</button>
    </div>

    <div class="cpp-grid">
      <div class="cpp-main">
        <section class="cpp-card" aria-labelledby="cpp-preview-title">
          <div class="cpp-card-head">
            <div>
              <h2 id="cpp-preview-title" class="cpp-card-title">Draft preview</h2>
              <p class="cpp-card-hint">Working copy of the {{ localeName }} version, visible to administrators only.</p>
            </div>
          </div>

          <p class="cpp-banner" role="note">{{ DRAFT_PREVIEW_BANNER }}</p>

          <article v-if="preview" class="cpp-page" :lang="state.locale">
            <p class="cpp-eyebrow">{{ state.type.label }}</p>
            <h1 class="cpp-page-title">{{ preview.title || 'Untitled' }}</h1>
            <p v-if="preview.summary" class="cpp-page-summary">{{ preview.summary }}</p>
            <p v-else class="cpp-placeholder">No summary</p>

            <figure v-if="preview.hero" class="cpp-hero">
              <img v-if="heroUrl" :src="heroUrl" :alt="preview.hero.alt ?? ''" class="cpp-hero-image">
              <div v-else class="cpp-hero-missing">Hero image not available</div>
              <figcaption v-if="previewMediaStatus(preview.hero)" class="cpp-media-status">
                Hero image: {{ previewMediaStatus(preview.hero) }}
              </figcaption>
            </figure>

            <ContentBlocksRenderer :blocks="preview.blocks" :images="images" :downloads="downloads" :relations="relations" preview />
          </article>

          <div v-else class="cpp-empty">
            <p class="cpp-empty-title">{{ localeName }} has not been started</p>
            <p class="cpp-card-hint">Nothing from another language is shown in its place.</p>
            <NuxtLink :to="contentSeoLocalesRoute(state.item.id, state.locale)" class="cpp-link">Start it in SEO &amp; locales</NuxtLink>
          </div>

          <div v-if="preview" class="cpp-seo" aria-label="Search appearance (draft)">
            <p class="cpp-subheading">Search appearance (draft)</p>
            <p class="cpp-seo-title">{{ preview.seo.title || 'No title' }}</p>
            <p class="cpp-seo-description">{{ preview.seo.description || 'No description' }}</p>
            <p class="cpp-seo-meta">
              <span>{{ preview.seo.noindex ? 'Noindex on' : 'Indexing allowed' }}</span>
              <span>Canonical: {{ preview.seo.canonical_path ?? 'default' }} — not emitted by this admin preview</span>
            </p>
          </div>
        </section>

        <section class="cpp-card" aria-labelledby="cpp-checklist-title">
          <h2 id="cpp-checklist-title" class="cpp-card-title">Readiness checklist</h2>
          <p class="cpp-card-hint">Checked by the server for {{ localeName }}. Passing every check never publishes anything by itself.</p>

          <div class="cpp-check-groups">
            <div class="cpp-check-group">
              <h3 class="cpp-subheading">Required to publish</h3>
              <ul class="cpp-checks" role="list">
                <li v-for="check in state.readiness.hard" :key="check.key" class="cpp-check" :class="`cpp-check--${check.state}`">
                  <span class="cpp-check-badge">{{ stateLabel(check) }}</span>
                  <span class="cpp-check-text">
                    <span class="cpp-check-label">{{ check.label }}</span>
                    <span v-if="check.detail && check.state !== 'pass'" class="cpp-check-detail">{{ check.detail }}</span>
                  </span>
                </li>
              </ul>
            </div>
            <div class="cpp-check-group">
              <h3 class="cpp-subheading">Warnings</h3>
              <ul v-if="state.readiness.soft.length" class="cpp-checks" role="list">
                <li v-for="check in state.readiness.soft" :key="check.key" class="cpp-check" :class="`cpp-check--${check.state}`">
                  <span class="cpp-check-badge">{{ stateLabel(check) }}</span>
                  <span class="cpp-check-text">
                    <span class="cpp-check-label">{{ check.label }}</span>
                    <span v-if="check.detail" class="cpp-check-detail">{{ check.detail }}</span>
                  </span>
                </li>
              </ul>
              <p v-else class="cpp-card-hint">No warnings until this language is started.</p>
            </div>
          </div>
        </section>
      </div>

      <aside class="cpp-side" aria-label="Publication">
        <section class="cpp-card" aria-labelledby="cpp-publication-title">
          <h2 id="cpp-publication-title" class="cpp-card-title">Publication</h2>
          <dl class="cpp-rows">
            <div class="cpp-row"><dt>{{ localeName }}</dt><dd>{{ localeRow ? CONTENT_LOCALE_STATE_LABELS[localeRow.state] : 'Not started' }}</dd></div>
            <div class="cpp-row"><dt>Content status</dt><dd>{{ CONTENT_STATUS_LABELS[state.item.status] }}</dd></div>
            <div class="cpp-row"><dt>Draft revision</dt><dd>{{ localeRow?.draft_revision ?? '—' }}</dd></div>
            <div class="cpp-row"><dt>Published revision</dt><dd>{{ state.publication.published_revision ?? '—' }}</dd></div>
            <div class="cpp-row"><dt>Last published</dt><dd>{{ state.publication.published_at ? formatContentDateTime(state.publication.published_at) : 'Never' }}</dd></div>
            <div class="cpp-row"><dt>First published</dt><dd>{{ state.publication.first_published_at ? formatContentDateTime(state.publication.first_published_at) : 'Never' }}</dd></div>
          </dl>

          <p v-if="action.reason" class="cpp-blocked" :class="{ 'cpp-blocked--info': action.label === 'Published' }">
            <strong>{{ action.label === 'Published' ? 'Up to date.' : 'Publish is blocked.' }}</strong>
            {{ action.label === 'Published' ? '' : action.reason }}
          </p>
          <button
            type="button"
            class="cpp-publish"
            :disabled="!action.enabled || busy !== null"
            :aria-describedby="action.reason ? 'cpp-publish-reason' : undefined"
            @click="publish()"
          >{{ busy === 'publish' ? 'Publishing…' : action.label }}</button>
          <p v-if="action.reason" id="cpp-publish-reason" class="cpp-sr-only">{{ action.reason }}</p>

          <template v-if="state.can_unpublish">
            <button type="button" class="cpp-btn cpp-unpublish" :disabled="busy !== null" @click="unpublish()">
              {{ busy === 'unpublish' ? 'Unpublishing…' : `Unpublish ${localeName}` }}
            </button>
            <p class="cpp-card-hint">
              <template v-if="state.locale === state.default_locale">Unpublishing {{ localeName }} unpublishes every language. Drafts are kept.</template>
              <template v-else>Other languages are not affected. The draft is kept.</template>
            </p>
          </template>
        </section>

        <section class="cpp-card" aria-labelledby="cpp-summary-title">
          <h2 id="cpp-summary-title" class="cpp-card-title">Readiness</h2>
          <p class="cpp-headline" :class="state.readiness.ready ? 'cpp-headline--ready' : 'cpp-headline--blocked'">
            {{ readinessHeadline(state.readiness) }}
          </p>
          <p class="cpp-card-hint">
            {{ counts.blockers }} {{ counts.blockers === 1 ? 'blocker' : 'blockers' }} ·
            {{ counts.warnings }} {{ counts.warnings === 1 ? 'warning' : 'warnings' }}
          </p>
        </section>

        <section class="cpp-card" aria-labelledby="cpp-rules-title">
          <h2 id="cpp-rules-title" class="cpp-card-title">Publishing rules</h2>
          <ul class="cpp-rules" role="list">
            <li>Publishing is a manual action by an administrator. AI never publishes.</li>
            <li>Each language is published on its own. Nothing falls back to another language.</li>
            <li>Media must be public and active in the Media Library. Publishing never changes a file.</li>
            <li>Public pages for Content Center are not enabled yet.</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cpp { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.cpp-tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.cpp-tab { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; min-height: 44px; padding: var(--space-2) var(--space-4); border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font-family: inherit; cursor: pointer; text-align: left; }
.cpp-tab--active { border-color: var(--color-primary); background: rgba(15, 92, 75, 0.08); }
.cpp-tab:disabled { cursor: not-allowed; opacity: 0.6; }
.cpp-tab-label { font-size: var(--text-sm); font-weight: 600; }
.cpp-tab-state { font-size: var(--text-xs); color: var(--color-ink-muted); }

.cpp-notice { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); }
.cpp-notice--success { background: #D1F0E8; color: #0F5C4B; }
.cpp-notice--warning { background: #FFF4E0; color: #7A4400; }
.cpp-notice--error { background: #FDECEC; color: #9B1C1C; }

.cpp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-4); align-items: start; }
.cpp-main, .cpp-side { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.cpp-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); min-width: 0; }
.cpp-card-head { display: flex; justify-content: space-between; gap: var(--space-3); }
.cpp-card-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-1); }
.cpp-card-hint { font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0 0 var(--space-3); line-height: 1.5; }
.cpp-subheading { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-ink-muted); margin: 0 0 var(--space-2); }

.cpp-banner { margin: 0 0 var(--space-4); padding: var(--space-2) var(--space-3); border: 1px dashed #B7791F; border-radius: var(--radius-sm); background: #FFF8EB; color: #7A4400; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; }

.cpp-page { border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.cpp-eyebrow { font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-primary); margin: 0; }
.cpp-page-title { font-family: var(--font-display, inherit); font-size: var(--text-3xl, 1.875rem); line-height: 1.2; color: var(--color-ink); margin: 0; overflow-wrap: anywhere; }
.cpp-page-summary { font-size: var(--text-lg, 1.125rem); line-height: 1.55; color: var(--color-ink-muted); margin: 0; overflow-wrap: anywhere; }
.cpp-placeholder { font-size: var(--text-sm); color: var(--color-ink-muted); font-style: italic; margin: 0; }
.cpp-hero { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cpp-hero-image { width: 100%; max-width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--radius-md); display: block; }
.cpp-hero-missing { aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }
.cpp-media-status { font-size: var(--text-xs); font-weight: 600; color: #8A4B00; }

.cpp-empty { border: 1px dashed var(--color-line); border-radius: var(--radius-md); padding: var(--space-8) var(--space-5); text-align: center; }
.cpp-empty-title { font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cpp-link { font-size: var(--text-sm); color: var(--color-primary); }

.cpp-seo { margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-line); min-width: 0; }
.cpp-seo-title { font-size: var(--text-base); color: #1A4DB3; margin: 0 0 var(--space-1); overflow-wrap: anywhere; }
.cpp-seo-description { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-2); overflow-wrap: anywhere; }
.cpp-seo-meta { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0; overflow-wrap: anywhere; }

.cpp-check-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); }
.cpp-checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cpp-check { display: flex; align-items: flex-start; gap: var(--space-2); min-width: 0; }
.cpp-check-badge { flex-shrink: 0; min-width: 64px; text-align: center; font-size: 0.6875rem; font-weight: 700; border-radius: var(--radius-sm); padding: 2px var(--space-2); }
.cpp-check--pass .cpp-check-badge { background: #D1F0E8; color: #0F5C4B; }
.cpp-check--fail .cpp-check-badge { background: #FDECEC; color: #9B1C1C; }
.cpp-check--warn .cpp-check-badge { background: #FFF4E0; color: #7A4400; }
.cpp-check-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cpp-check-label { font-size: var(--text-sm); color: var(--color-ink); overflow-wrap: anywhere; }
.cpp-check-detail { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }

.cpp-rows { margin: 0 0 var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.cpp-row { display: flex; justify-content: space-between; gap: var(--space-3); min-width: 0; }
.cpp-row dt { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cpp-row dd { font-size: var(--text-xs); color: var(--color-ink); margin: 0; text-align: right; overflow-wrap: anywhere; }

.cpp-blocked { font-size: var(--text-sm); color: #9B1C1C; background: #FDECEC; border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); margin: 0 0 var(--space-3); overflow-wrap: anywhere; }
.cpp-blocked--info { color: #0F5C4B; background: #D1F0E8; }
.cpp-publish { width: 100%; min-height: 44px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 600; font-family: inherit; cursor: pointer; }
.cpp-publish:hover:not(:disabled) { background: var(--color-primary-deep); }
.cpp-publish:disabled { opacity: 0.5; cursor: not-allowed; }
.cpp-btn { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font-family: inherit; cursor: pointer; padding: var(--space-2) var(--space-4); }
.cpp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpp-unpublish { width: 100%; margin-top: var(--space-3); color: #9B1C1C; border-color: #E8B4B4; }

.cpp-headline { font-size: var(--text-lg, 1.125rem); font-weight: 700; margin: 0 0 var(--space-1); }
.cpp-headline--ready { color: #0F5C4B; }
.cpp-headline--blocked { color: #9B1C1C; }
.cpp-rules { margin: 0; padding-left: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-ink-muted); line-height: 1.5; }

.cpp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1279px) {
  .cpp-grid { grid-template-columns: minmax(0, 1fr); }
  .cpp-check-groups { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .cpp-tab { flex: 1 1 0; }
  .cpp-card { padding: var(--space-4); }
  .cpp-page { padding: var(--space-4); }
  .cpp-page-title { font-size: var(--text-2xl); }
}
</style>
