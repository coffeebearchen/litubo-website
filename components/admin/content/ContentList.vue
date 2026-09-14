<script setup lang="ts">
import { computed } from 'vue'
import type { AdminContentListItem } from '~/types/content-center'
import { CONTENT_CENTER_NEW_ROUTE, contentListRow } from '~/utils/contentCenter'

/**
 * CC-IMP-02 — CC-00 list body: loading, error, empty, desktop table and the
 * ≤1023px card list (Product Center list pattern). Presentational only — the
 * page owns the data request; this component emits `retry` / `clear-filters`.
 */
const props = defineProps<{
  items: AdminContentListItem[]
  loading: boolean
  error: string | null
  hasFilters: boolean
}>()

const emit = defineEmits<{ 'retry': [], 'clear-filters': [] }>()

const rows = computed(() => props.items.map(contentListRow))
</script>

<template>
  <div class="cc-list">
    <div v-if="loading" class="cc-state" role="status">
      <span class="cc-state-hint">Loading content…</span>
    </div>

    <div v-else-if="error" class="cc-error" role="alert">
      <p class="cc-error-text">{{ error }}</p>
      <button type="button" class="cc-link-btn" @click="emit('retry')">Retry</button>
    </div>

    <div v-else-if="rows.length === 0" class="cc-state">
      <template v-if="hasFilters">
        <p class="cc-state-title">No content matches these filters.</p>
        <button type="button" class="cc-link-btn" @click="emit('clear-filters')">Clear filters</button>
      </template>
      <template v-else>
        <p class="cc-state-title">No content yet.</p>
        <p class="cc-state-hint">Create your first draft.</p>
        <NuxtLink :to="CONTENT_CENTER_NEW_ROUTE" class="cc-state-action">+ New content</NuxtLink>
      </template>
    </div>

    <template v-else>
      <div class="cc-table-wrap">
        <table class="cc-table">
          <thead>
            <tr>
              <th>Title / slug</th>
              <th>Content type</th>
              <th>Status</th>
              <th>Languages</th>
              <th>Last updated</th>
              <th><span class="cc-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="cc-title-cell">
                <NuxtLink :to="row.overviewRoute" class="cc-title-link">{{ row.title }}</NuxtLink>
                <span v-if="row.slug" class="cc-slug">{{ row.slug }}</span>
              </td>
              <td>{{ row.typeLabel }}</td>
              <td><StatusBadge :status="row.status" /></td>
              <td>
                <span v-for="code in row.localeCodes" :key="code" class="cc-locale-chip">{{ code }}</span>
              </td>
              <td class="cc-date">{{ row.updated }}</td>
              <td class="cc-action">
                <NuxtLink :to="row.overviewRoute" class="cc-open" :aria-label="`Open ${row.title}`">Open</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="cc-cards" role="list">
        <li v-for="row in rows" :key="row.id" class="cc-card">
          <div class="cc-card-top">
            <span class="cc-card-type">{{ row.typeLabel }}</span>
            <StatusBadge :status="row.status" />
          </div>
          <p class="cc-card-title">{{ row.title }}</p>
          <p v-if="row.slug" class="cc-slug">{{ row.slug }}</p>
          <div class="cc-card-meta">
            <span>
              <span v-for="code in row.localeCodes" :key="code" class="cc-locale-chip">{{ code }}</span>
            </span>
            <span class="cc-date">Updated {{ row.updated }}</span>
          </div>
          <NuxtLink :to="row.overviewRoute" class="cc-card-open" :aria-label="`Open ${row.title}`">Open record</NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.cc-state { padding: var(--space-12) var(--space-6); text-align: center; }
.cc-state-title { font-size: var(--text-base); color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-state-hint { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0 0 var(--space-4); display: block; }

.cc-state-action {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-sm);
  text-decoration: none;
}

.cc-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  background: #fff0f0;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  color: #991b1b;
  margin: var(--space-4);
}

.cc-error-text { margin: 0; font-size: var(--text-sm); }

.cc-link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  font-size: var(--text-sm) !important;
  padding: 0 !important;
  min-height: 0 !important;
}

.cc-table-wrap { width: 100%; }
.cc-cards { display: none; }

.cc-table { width: 100%; border-collapse: collapse; }
.cc-table thead { background: var(--color-surface-alt); }

.cc-table th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--color-line);
}

.cc-table td {
  border-bottom: 1px solid var(--color-line);
  font-size: var(--text-sm);
  vertical-align: middle;
}

.cc-table tbody tr:last-child td { border-bottom: none; }
.cc-table tbody tr:hover { background: var(--color-surface-alt); }

.cc-title-cell { max-width: 420px; }

.cc-title-link {
  display: block;
  font-weight: 600;
  color: var(--color-ink);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.cc-title-link:hover { color: var(--color-primary); text-decoration: underline; }

.cc-slug {
  display: block;
  font-family: 'Courier New', monospace;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
  margin: 0;
}

.cc-locale-chip {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-ink);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 0 6px;
  margin-right: 4px;
}

.cc-date { white-space: nowrap; color: var(--color-ink-muted); }
.cc-action { width: 80px; text-align: right; }

.cc-open {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--text-xs);
}

.cc-open:hover { text-decoration: underline; }

.cc-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.cc-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.cc-card-type { font-size: var(--text-xs); color: var(--color-ink-muted); }

.cc-card-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.cc-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.cc-card-open {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 var(--space-4);
  margin-top: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

.cc-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── ≤1023px: stacked cards instead of the table ── */
@media (max-width: 1023px) {
  .cc-table-wrap { display: none; }

  .cc-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    list-style: none;
    margin: 0;
    padding: var(--space-3);
  }
}
</style>
