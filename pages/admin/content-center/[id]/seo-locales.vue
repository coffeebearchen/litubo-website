<script setup lang="ts">
import type { AdminContentSeoLocales } from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import ContentSeoLocales from '~/components/admin/content/ContentSeoLocales.vue'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
  parseContentLocaleQuery,
} from '~/utils/contentCenter'
import { DEFAULT_CONTENT_LOCALE } from '~/utils/contentLocales'
import { SEO_LOCALES_LEAVE_MESSAGE } from '~/utils/contentSeoLocalesEditor'

/** CC-IMP-05 — CC-04 SEO & Locales for one content record. `?locale=` opens one language. */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const initialLocale: ContentLocale = parseContentLocaleQuery(route.query.locale) ?? DEFAULT_CONTENT_LOCALE

const { data, pending, error, refresh } = await useFetch<AdminContentSeoLocales>(
  `/api/admin/content-center/${encodeURIComponent(id)}/seo-locales`,
  { key: `content-center-seo-locales-${id}` },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))
const recordTitle = computed(() => data.value?.item.title || (data.value ? `Untitled content #${data.value.item.id}` : ''))

const panelRef = ref<InstanceType<typeof ContentSeoLocales> | null>(null)
const status = ref({ dirty: false, saving: false, justSaved: false, conflict: false })

const statusLabel = computed(() => {
  if (status.value.saving) return 'Saving…'
  if (status.value.conflict) return 'Not saved'
  if (status.value.justSaved) return 'Saved'
  return status.value.dirty ? 'Unsaved changes' : 'All changes saved'
})

function syncShell(value: AdminContentSeoLocales) {
  data.value = value
}

/** The panel already confirmed any discard; the URL only records the open language. */
function syncLocale(locale: ContentLocale) {
  void router.replace({ query: locale === DEFAULT_CONTENT_LOCALE ? {} : { locale } })
}

onBeforeRouteLeave(() => {
  if (status.value.dirty && !window.confirm(SEO_LOCALES_LEAVE_MESSAGE)) return false
})
</script>

<template>
  <div v-if="pending && !data && !error" class="cc-page-state" role="status">
    <p class="cc-page-state-hint">Loading content record…</p>
  </div>

  <div v-else-if="notFound" class="cc-page-state">
    <p class="cc-page-state-title">Content not found</p>
    <p class="cc-page-state-hint">No content record exists for ID “{{ id }}”.</p>
    <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-page-state-link">← Back to Content Center</NuxtLink>
  </div>

  <div v-else-if="error || !data" class="cc-page-state" role="alert">
    <p class="cc-page-state-title">This content record could not be loaded</p>
    <p class="cc-page-state-hint">{{ errorMessage ?? 'Content Center is temporarily unavailable. Try again in a moment.' }}</p>
    <div class="cc-page-state-actions">
      <button type="button" class="cc-page-state-retry" @click="refresh()">Retry</button>
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-page-state-link">← Back to Content Center</NuxtLink>
    </div>
  </div>

  <ContentWorkspaceShell
    v-else
    :record-title="recordTitle"
    page-title="SEO & locales"
    subtitle="Search settings and language drafts for this content."
    :status="data.item.status"
    :show-refresh="false"
  >
    <template #actions>
      <div class="cc-panel-actions">
        <span class="cc-panel-status" aria-live="polite">{{ statusLabel }}</span>
        <button
          type="button"
          class="cc-panel-save"
          :disabled="!status.dirty || status.saving"
          @click="panelRef?.save()"
        >{{ status.saving ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </template>

    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.item.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.item.content_type)"
        :status="data.item.status"
        active-key="seo-locales"
      />
    </template>

    <ContentSeoLocales
      ref="panelRef"
      :initial="data"
      :locale="initialLocale"
      @status="status = $event"
      @saved="syncShell"
      @reloaded="syncShell"
      @locale="syncLocale"
    />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-panel-actions { display: flex; align-items: center; gap: var(--space-3); }
.cc-panel-status { font-size: var(--text-sm); color: var(--color-ink-muted); white-space: nowrap; }

.cc-panel-save {
  min-height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.cc-panel-save:hover:not(:disabled) { background: var(--color-primary-deep); }
.cc-panel-save:disabled { opacity: 0.55; cursor: not-allowed; }

.cc-page-state { max-width: 520px; margin: var(--space-8) auto; padding: var(--space-6); text-align: center; }
.cc-page-state-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-page-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); overflow-wrap: anywhere; }
.cc-page-state-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--space-4); }
.cc-page-state-retry { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); cursor: pointer; }
.cc-page-state-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-page-state-link:hover { text-decoration: underline; }

@media (max-width: 767px) {
  .cc-panel-actions { flex: 1 1 100%; justify-content: space-between; }
  .cc-panel-save { flex: 1 1 auto; }
}
</style>
