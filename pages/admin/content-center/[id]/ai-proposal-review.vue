<script setup lang="ts">
import type { AdminContentAiReview } from '~/types/content-center'
import type { ContentLocale } from '~/utils/contentLocales'
import ContentAiProposalReview from '~/components/admin/content/ContentAiProposalReview.vue'
import {
  CONTENT_CENTER_LIST_ROUTE,
  contentApiErrorStatus,
  contentTypeLabel,
  interpretContentApiError,
  parseContentLocaleQuery,
} from '~/utils/contentCenter'
import { CONTENT_AI_REVIEW_LEAVE_MESSAGE } from '~/utils/contentAiReview'
import { DEFAULT_CONTENT_LOCALE } from '~/utils/contentLocales'

/**
 * CC-IMP-09 — CC-AI-02 AI Proposal Review for one content record and one language (`?locale=`).
 * Admin only. Review decisions stay on this page until "Apply approved changes"; Apply writes
 * that language's working draft only and never publishes.
 */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const requestedLocale = parseContentLocaleQuery(route.query.locale)
const locale = ref<string>(requestedLocale ?? String(route.query.locale ?? ''))
const dirty = ref(false)

const { data, pending, error, refresh } = await useFetch<AdminContentAiReview>(
  `/api/admin/content-center/${encodeURIComponent(id)}/ai-proposal-review`,
  { key: `content-center-ai-review-${id}`, query: { locale } },
)

const errorStatus = computed(() => (error.value ? contentApiErrorStatus(error.value) : 0))
const notFound = computed(() => errorStatus.value === 404 || errorStatus.value === 400)
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))
const recordTitle = computed(() => data.value?.item.title || (data.value ? `Untitled content #${data.value.item.id}` : ''))

function changeLocale(next: ContentLocale) {
  if (dirty.value && !window.confirm(CONTENT_AI_REVIEW_LEAVE_MESSAGE)) return
  dirty.value = false
  locale.value = next
  void router.replace({ query: next === DEFAULT_CONTENT_LOCALE ? {} : { locale: next } })
}

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm(CONTENT_AI_REVIEW_LEAVE_MESSAGE)) return false
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
    <p class="cc-page-state-title">AI Proposal Review could not be loaded</p>
    <p class="cc-page-state-hint">{{ errorMessage ?? 'Content Center is temporarily unavailable. Try again in a moment.' }}</p>
    <div class="cc-page-state-actions">
      <button type="button" class="cc-page-state-retry" @click="refresh()">Retry</button>
      <NuxtLink :to="CONTENT_CENTER_LIST_ROUTE" class="cc-page-state-link">← Back to Content Center</NuxtLink>
    </div>
  </div>

  <ContentWorkspaceShell
    v-else
    :record-title="recordTitle"
    page-title="AI Proposal Review"
    subtitle="Review AI proposals before anything is written. Accept, edit or reject each one, then apply approved changes to the draft."
    :status="data.item.status"
    :show-refresh="false"
  >
    <template #nav>
      <ContentWorkspaceNav
        :item-id="data.item.id"
        :title="recordTitle"
        :type-label="contentTypeLabel(data.item.content_type)"
        :status="data.item.status"
        active-key="ai-proposal-review"
      />
    </template>

    <ContentAiProposalReview
      :key="`${data.locale}-${data.proposal?.proposalRef ?? 'none'}`"
      :review="data"
      @locale="changeLocale"
      @dirty="dirty = $event"
    />
  </ContentWorkspaceShell>
</template>

<style scoped>
.cc-page-state { max-width: 520px; margin: var(--space-8) auto; padding: var(--space-6); text-align: center; }
.cc-page-state-title { font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-page-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); overflow-wrap: anywhere; }
.cc-page-state-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--space-4); }
.cc-page-state-retry { min-height: 40px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); cursor: pointer; }
.cc-page-state-link { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; }
.cc-page-state-link:hover { text-decoration: underline; }
</style>
