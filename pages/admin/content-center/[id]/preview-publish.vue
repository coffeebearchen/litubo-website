<script setup lang="ts">
import type { AdminContentPreviewPublish } from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import ContentPreviewPublish from '~/components/admin/content/ContentPreviewPublish.vue'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
  parseContentLocaleQuery,
} from '~/utils/contentCenter'
import { DEFAULT_CONTENT_LOCALE } from '~/utils/contentLocales'

/**
 * CC-IMP-06 — CC-05 Preview & Publish Readiness for one content record.
 * Admin route only (admin SSR middleware): the Draft preview is never reachable
 * from a public route, carries `noindex` and emits no canonical link.
 */
definePageMeta({ layout: 'admin' })
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const initialLocale: ContentLocale = parseContentLocaleQuery(route.query.locale) ?? DEFAULT_CONTENT_LOCALE

const { data, pending, error, refresh } = await useFetch<AdminContentPreviewPublish>(
  `/api/admin/content-center/${encodeURIComponent(id)}/preview-publish`,
  { key: `content-center-preview-publish-${id}`, query: { locale: initialLocale } },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))
const recordTitle = computed(() => data.value?.item.title || (data.value ? `Untitled content #${data.value.item.id}` : ''))

const panelRef = ref<InstanceType<typeof ContentPreviewPublish> | null>(null)
const publishStatus = ref<{ enabled: boolean, label: string, reason: string | null, busy: boolean }>({ enabled: false, label: 'Publish', reason: null, busy: false })

function syncState(value: AdminContentPreviewPublish) {
  data.value = value
}

function syncLocale(locale: ContentLocale) {
  void router.replace({ query: locale === DEFAULT_CONTENT_LOCALE ? {} : { locale } })
}
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
    page-title="Preview & publish readiness"
    subtitle="Review the draft, check readiness, and publish manually when it is ready."
    :status="data.item.status"
    :show-refresh="false"
  >
    <template #actions>
      <button
        type="button"
        class="cc-header-publish"
        :disabled="!publishStatus.enabled || publishStatus.busy"
        :title="publishStatus.reason ?? undefined"
        @click="panelRef?.publish()"
      >{{ publishStatus.label }}</button>
    </template>

    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.item.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.item.content_type)"
        :status="data.item.status"
        active-key="preview-publish"
      />
    </template>

    <ContentPreviewPublish
      ref="panelRef"
      :initial="data"
      @state="syncState"
      @locale="syncLocale"
      @status="publishStatus = $event"
    />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-header-publish {
  min-height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  padding: var(--space-2) var(--space-5);
  cursor: pointer;
}

.cc-header-publish:hover:not(:disabled) { background: var(--color-primary-deep); }
.cc-header-publish:disabled { opacity: 0.5; cursor: not-allowed; }

.cc-page-state { max-width: 520px; margin: var(--space-8) auto; padding: var(--space-6); text-align: center; }
.cc-page-state-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-page-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); overflow-wrap: anywhere; }
.cc-page-state-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--space-4); }
.cc-page-state-retry { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); cursor: pointer; }
.cc-page-state-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-page-state-link:hover { text-decoration: underline; }
</style>
