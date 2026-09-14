<script setup lang="ts">
import type { AdminContentList } from '~/types/content-center'
import {
  CONTENT_CENTER_NEW_ROUTE,
  CONTENT_LOCALE_OPTIONS,
  CONTENT_SEARCH_MAX,
  CONTENT_STATUS_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  type ContentListFilterState,
  buildContentListQuery,
  contentListApiQuery,
  contentPageCount,
  hasActiveContentFilters,
  interpretContentApiError,
  parseContentListQuery,
} from '~/utils/contentCenter'

/** CC-IMP-02 — CC-00 Content Center List: browse, search, filter, create, open. */
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

// Filter state is initialised from the URL so a refresh or an inbound link keeps scope.
const initial = parseContentListQuery(route.query as Record<string, unknown>)
const searchRaw = ref(initial.search)
const search = ref(initial.search)
const contentType = ref(initial.contentType)
const status = ref(initial.status)
const locale = ref(initial.locale)
const page = ref(initial.page)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchRaw, (value: string) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = value.trim() }, 300)
})

watch([search, contentType, status, locale], () => { page.value = 1 })

const filterState = computed<ContentListFilterState>(() => ({
  search: search.value,
  contentType: contentType.value,
  status: status.value,
  locale: locale.value,
  page: page.value,
}))

// State → URL, compared first so the two watchers converge instead of looping.
watch(filterState, (state: ContentListFilterState) => {
  const next = buildContentListQuery(state)
  const current = buildContentListQuery(parseContentListQuery(route.query as Record<string, unknown>))
  if (JSON.stringify(next) !== JSON.stringify(current)) router.replace({ query: next })
})

// URL → state, for inbound links and history navigation.
watch(() => route.query, (query: Record<string, unknown>) => {
  if (route.path !== '/admin/content-center') return
  const next = parseContentListQuery(query)
  if (next.search !== search.value) { search.value = next.search; searchRaw.value = next.search }
  if (next.contentType !== contentType.value) contentType.value = next.contentType
  if (next.status !== status.value) status.value = next.status
  if (next.locale !== locale.value) locale.value = next.locale
  if (next.page !== page.value) page.value = next.page
})

const hasFilters = computed(() => hasActiveContentFilters(filterState.value))

function clearFilters() {
  searchRaw.value = ''
  search.value = ''
  contentType.value = ''
  status.value = ''
  locale.value = ''
  page.value = 1
}

const { data, pending, error, refresh } = await useFetch<AdminContentList>('/api/admin/content-center', {
  query: computed(() => contentListApiQuery(filterState.value)),
})

const items = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageCount = computed(() => contentPageCount(total.value))
const errorMessage = computed(() => (error.value ? interpretContentApiError(error.value).message : null))
const countLabel = computed(() => {
  if (!data.value) return ''
  const one = total.value === 1
  if (!hasFilters.value) return `${total.value} ${one ? 'record' : 'records'}`
  return `${total.value} ${one ? 'record matches' : 'records match'} the current filters`
})
</script>

<template>
  <div class="page">
    <div class="cc-page-header">
      <div class="cc-heading">
        <h1 class="page-title">Content Center</h1>
        <p class="cc-subtitle">
          Create and manage technical articles, application solutions, case studies, resources and news as drafts.
        </p>
      </div>
      <NuxtLink :to="CONTENT_CENTER_NEW_ROUTE" class="cc-new">+ New content</NuxtLink>
    </div>

    <div class="cc-panel">
      <div class="cc-panel-header">
        <h2 class="cc-panel-title">All content</h2>
        <p class="cc-panel-count" aria-live="polite">{{ countLabel }}</p>
      </div>

      <div class="cc-filters">
        <input
          v-model="searchRaw"
          type="search"
          class="cc-filter cc-filter-search"
          placeholder="Search title or slug…"
          aria-label="Search content by title or slug"
          :maxlength="CONTENT_SEARCH_MAX"
        >
        <select v-model="contentType" class="cc-filter" aria-label="Filter by content type">
          <option value="">Type: all</option>
          <option v-for="option in CONTENT_TYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <select v-model="status" class="cc-filter" aria-label="Filter by status">
          <option value="">Status: all</option>
          <option v-for="option in CONTENT_STATUS_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <select v-model="locale" class="cc-filter" aria-label="Filter by language draft">
          <option value="">Language: all</option>
          <option v-for="option in CONTENT_LOCALE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <button v-if="hasFilters" type="button" class="cc-clear" @click="clearFilters">Clear filters</button>
      </div>

      <div class="cc-content">
        <ContentList
          :items="items"
          :loading="pending && !data && !error"
          :error="errorMessage"
          :has-filters="hasFilters"
          @retry="refresh()"
          @clear-filters="clearFilters"
        />

        <div v-if="data && total > 0 && !error" class="cc-pagination">
          <button type="button" class="cc-page-btn" :disabled="page <= 1" @click="page--">← Prev</button>
          <span class="cc-page-info">Page {{ page }} / {{ pageCount }}</span>
          <button type="button" class="cc-page-btn" :disabled="page >= pageCount" @click="page++">Next →</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.cc-heading { min-width: 0; }

.cc-subtitle {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.5;
}

.cc-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.cc-new:hover { background: var(--color-primary-deep); }

.cc-panel {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.cc-panel-header { padding: var(--space-4) var(--space-4) 0; }

.cc-panel-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.cc-panel-count {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: var(--space-1) 0 0;
  min-height: 1.2em;
}

.cc-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-3);
}

.cc-filter {
  min-height: 40px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface);
  font-family: inherit;
  min-width: 170px;
}

.cc-filter:focus { border-color: var(--color-primary); outline: none; }
.cc-filter-search { flex: 1; min-width: 220px; padding: 0 var(--space-3); }

.cc-clear {
  min-height: 40px;
  background: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  color: var(--color-ink-muted);
  cursor: pointer;
  white-space: nowrap;
}

.cc-clear:hover { border-color: var(--color-ink); color: var(--color-ink); }

.cc-content { border-top: 1px solid var(--color-line); }

.cc-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
}

.cc-page-btn {
  min-height: 36px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.cc-page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cc-page-info { font-size: var(--text-xs); color: var(--color-ink-muted); white-space: nowrap; }

/* ── ≤767px: single column, no horizontal page overflow ── */
@media (max-width: 767px) {
  .cc-page-header { flex-direction: column; align-items: stretch; }
  .cc-new { width: 100%; }
  .cc-panel-header { padding: var(--space-3) var(--space-3) 0; }

  .cc-filters {
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-3);
  }

  .cc-filter, .cc-filter-search, .cc-clear { min-width: 0; width: 100%; }
  .cc-pagination { justify-content: space-between; }
}
</style>
