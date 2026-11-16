<script setup lang="ts">
/**
 * Header search: trigger button + centred dialog.
 *
 * States handled explicitly: empty (real entry points, never invented "popular searches"),
 * loading, no results, request failure with retry. Queries are debounced and only sent from two
 * Latin/Arabic characters (one CJK character), so typing does not fire a request per keystroke.
 */
interface SearchHit {
  type: 'product' | 'application' | 'insight'
  title: string
  subtitle: string
  to: string
}
interface SearchResponse {
  q: string
  type: string
  total: number
  hits: SearchHit[]
  error: boolean
}

const { t } = useI18n()
const localePath = useLocalePath()

const open = ref(false)
const query = ref('')
const type = ref<'all' | 'products' | 'applications' | 'insights'>('all')
const loading = ref(false)
const error = ref(false)
const result = ref<SearchResponse | null>(null)

const input = ref<HTMLInputElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const filters = [
  { key: 'all', label: 'All' },
  { key: 'products', label: 'Products' },
  { key: 'applications', label: 'Applications' },
  { key: 'insights', label: 'Insights' },
] as const

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? 'Result'
}

const TYPE_LABELS: Record<string, string> = {
  product: 'Product',
  application: 'Application',
  insight: 'Insight',
}

/** Empty-state entry points — real, public pages only. */
const suggestions = computed(() => [
  { label: 'Inspection systems', to: localePath('/products') },
  { label: 'Inspection by application', to: localePath('/applications') },
  { label: 'Blog & insights', to: localePath('/resources') },
  { label: 'Technical specifications', to: localePath('/technical-matching') },
])

function isSearchable(q: string): boolean {
  if (!q) return false
  if (/[\u4e00-\u9fff]/.test(q)) return true
  return q.trim().length >= 2
}

let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function run() {
  const q = query.value.trim()
  if (!isSearchable(q)) {
    result.value = null
    loading.value = false
    error.value = false
    return
  }
  const mine = ++seq
  loading.value = true
  error.value = false
  try {
    const res = await $fetch<SearchResponse>('/api/search', { query: { q, type: type.value } })
    if (mine !== seq) return // a newer keystroke won
    result.value = res
    error.value = res.error
  }
  catch {
    if (mine !== seq) return
    error.value = true
    result.value = null
  }
  finally {
    if (mine === seq) loading.value = false
  }
}

watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(run, 300)
})
watch(type, () => { void run() })

function show() {
  open.value = true
  nextTick(() => input.value?.focus())
}

function hide() {
  open.value = false
  nextTick(() => trigger.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    hide()
  }
}

function clearQuery() {
  query.value = ''
  result.value = null
  error.value = false
  input.value?.focus()
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="site-search__trigger"
    aria-label="Search"
    :aria-expanded="open"
    @click="show"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.7" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
  </button>

  <Teleport to="body">
    <div v-if="open" class="site-search" @keydown="onKeydown">
      <div class="site-search__overlay" @click="hide" />
      <div
        class="site-search__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div class="site-search__head">
          <p class="site-search__title">What are you looking for?</p>
          <button type="button" class="site-search__close" aria-label="Close search" @click="hide">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="site-search__field">
          <svg class="site-search__field-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.7" />
            <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <input
            ref="input"
            v-model="query"
            type="search"
            class="site-search__input"
            placeholder="Search products, applications or insights"
            autocomplete="off"
            aria-label="Search products, applications or insights"
          >
          <button
            v-if="query"
            type="button"
            class="site-search__clear"
            aria-label="Clear search"
            @click="clearQuery"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="site-search__filters" role="tablist" aria-label="Search category">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            role="tab"
            class="site-search__filter"
            :class="{ 'is-active': type === f.key }"
            :aria-selected="type === f.key"
            @click="type = f.key"
          >
            {{ f.label }}
          </button>
        </div>

        <div class="site-search__body">
          <!-- Empty input: real entry points, no invented popular searches. -->
          <template v-if="!query.trim()">
            <p class="site-search__hint">Start typing, or jump to a section:</p>
            <ul class="site-search__suggestions" role="list">
              <li v-for="s in suggestions" :key="s.to">
                <NuxtLink :to="s.to" class="site-search__suggestion" @click="hide">{{ s.label }} →</NuxtLink>
              </li>
            </ul>
          </template>

          <p v-else-if="loading" class="site-search__state">Searching…</p>

          <template v-else-if="error">
            <p class="site-search__state site-search__state--error">
              Search is temporarily unavailable.
            </p>
            <button type="button" class="site-search__retry" @click="run">Try again</button>
          </template>

          <template v-else-if="result">
            <p class="site-search__count">
              {{ result.total }} {{ result.total === 1 ? 'result' : 'results' }} for “{{ result.q }}”
            </p>

            <div v-if="!result.hits.length" class="site-search__empty">
              <p class="site-search__state">No results for “{{ result.q }}”.</p>
              <p class="site-search__hint">
                Try a broader term, or
                <NuxtLink :to="localePath('/technical-matching')" @click="hide">ask our team</NuxtLink>
                about your application.
              </p>
              <button type="button" class="site-search__retry" @click="clearQuery">Clear filters</button>
            </div>

            <ul v-else class="site-search__results" role="list">
              <li v-for="hit in result.hits" :key="hit.to">
                <NuxtLink :to="localePath(hit.to)" class="site-search__result" @click="hide">
                  <span class="site-search__type">{{ typeLabel(hit.type) }}</span>
                  <span class="site-search__result-title">{{ hit.title }}</span>
                  <span v-if="hit.subtitle" class="site-search__result-sub">{{ hit.subtitle }}</span>
                </NuxtLink>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.site-search__trigger {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.site-search__trigger:hover { background: #F2F8F4; color: var(--color-primary); }

.site-search {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 110px;
}

.site-search__overlay {
  position: absolute;
  inset: 0;
  background: rgba(20, 51, 33, 0.33);
}

.site-search__dialog {
  position: relative;
  width: min(880px, calc(100vw - 48px));
  max-height: calc(100dvh - 140px);
  overflow: auto;
  background: #fff;
  border: 1px solid #DAE3DD;
  border-radius: 10px;
  padding: var(--space-8);
  box-shadow: 0 20px 60px rgba(20, 51, 33, 0.22);
}

.site-search__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }
.site-search__title { margin: 0; font-family: var(--font-display); font-size: var(--text-2xl); color: #203C32; }
.site-search__close {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: #60716A;
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.site-search__close:hover { background: #F2F8F4; }

.site-search__field {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding: 0 var(--space-4);
  border: 1.5px solid #2F6B3A;
  border-radius: 8px;
}
.site-search__field-icon { flex: none; color: #2F6B3A; }
.site-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  padding: var(--space-4) 0;
  font-size: var(--text-base);
  color: #203C32;
  background: transparent;
}
.site-search__input::-webkit-search-cancel-button,
.site-search__input::-webkit-search-decoration { appearance: none; display: none; }

.site-search__clear {
  flex: none;
  border: 0;
  background: transparent;
  color: #2F6B3A;
  cursor: pointer;
  padding: var(--space-1);
}

.site-search__filters { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.site-search__filter {
  padding: 8px 16px;
  border: 1px solid #DAE3DD;
  border-radius: 999px;
  background: #fff;
  font-size: var(--text-sm);
  color: #203C32;
  cursor: pointer;
}
.site-search__filter.is-active { background: #1B4224; border-color: #1B4224; color: #fff; }

.site-search__body { margin-top: var(--space-5); }
.site-search__hint { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: #60716A; }
.site-search__state { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: #60716A; }
.site-search__state--error { color: #9a3412; }
.site-search__count { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: #60716A; }

.site-search__suggestions { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
.site-search__suggestion {
  display: inline-block;
  padding: 10px 16px;
  border: 1px solid #DAE3DD;
  border-radius: 999px;
  font-size: var(--text-sm);
  color: #203C32;
  text-decoration: none;
}
.site-search__suggestion:hover { background: #F2F8F4; }

.site-search__results { list-style: none; margin: 0; padding: 0; }
.site-search__result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-4) 0;
  border-top: 1px solid #DAE3DD;
  text-decoration: none;
  color: #203C32;
}
.site-search__results li:first-child .site-search__result { border-top: 0; }
.site-search__result:hover .site-search__result-title { text-decoration: underline; }
.site-search__type { font-size: var(--text-xs); letter-spacing: 0.12em; text-transform: uppercase; color: #60716A; }
.site-search__result-title { font-size: var(--text-lg); line-height: 1.3; }
.site-search__result-sub {
  color: #60716A;
  font-size: var(--text-sm);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.site-search__retry {
  margin-top: var(--space-2);
  padding: 10px 18px;
  border: 1px solid #DAE3DD;
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: var(--text-sm);
  cursor: pointer;
}

.site-search__empty { padding-block: var(--space-2); }

@media (max-width: 760px) {
  .site-search { padding-top: 90px; }
  .site-search__dialog { width: calc(100% - 32px); padding: var(--space-5); }
  .site-search__title { font-size: var(--text-xl); }
}
</style>
