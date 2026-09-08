<script setup lang="ts">
import type { SourceRecordSummary } from '~/server/api/admin/products/[id]/sources/index.get'
import { sourceFileTypeLabel, sourceReviewStatusLabel } from '~/utils/productWorkspace'

defineProps<{
  sources: SourceRecordSummary[]
}>()

function fieldLabel(factKey: string | null): string {
  return factKey ?? 'Not linked to a field yet'
}

function statusClass(status: string | null): string {
  const label = sourceReviewStatusLabel(status)
  if (label === 'Verified') return 'ws-status--verified'
  if (label === 'Needs review') return 'ws-status--needs-review'
  return 'ws-status--pending'
}
</script>

<template>
  <div class="ws-sources">
    <section class="ws-card" aria-labelledby="ws-evidence-heading">
      <h3 id="ws-evidence-heading" class="ws-card-title">Evidence register</h3>

      <p v-if="sources.length === 0" class="ws-empty ws-empty--compact">
        No sources recorded for this product yet.
      </p>

      <div v-else class="ws-table-wrap">
        <table class="ws-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">File type</th>
              <th scope="col">Related field</th>
              <th scope="col">Verification</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sources" :key="row.id">
              <td class="ws-source-name" data-label="Source">{{ row.source_name }}</td>
              <td data-label="File type">{{ sourceFileTypeLabel(row.source_type) }}</td>
              <td data-label="Related field">{{ fieldLabel(row.fact_key) }}</td>
              <td data-label="Verification">
                <span class="ws-status-badge" :class="statusClass(row.review_status)">
                  {{ sourceReviewStatusLabel(row.review_status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ws-sources { display: flex; flex-direction: column; gap: var(--space-4); }

.ws-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.ws-card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-4);
}

.ws-empty {
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  margin: 0;
  padding: var(--space-4) 0;
}

.ws-empty--compact { padding: var(--space-2) 0; }

.ws-table-wrap { overflow-x: auto; }

.ws-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.ws-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-line);
  white-space: nowrap;
}

.ws-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink);
  vertical-align: top;
}

.ws-table tr:last-child td { border-bottom: none; }

.ws-source-name { font-weight: 500; overflow-wrap: anywhere; }

.ws-status-badge {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  white-space: nowrap;
}

.ws-status--verified { background: #E3F3EC; color: #1E6B4E; }
.ws-status--needs-review { background: #FDEAEA; color: #A23B3B; }
.ws-status--pending { background: #FFF3CD; color: #856404; }

/* ── ≤767px: table becomes stacked cards, never a horizontally scrolling grid ── */
@media (max-width: 767px) {
  .ws-table-wrap { overflow-x: visible; }

  .ws-table, .ws-table thead, .ws-table tbody, .ws-table tr, .ws-table th, .ws-table td {
    display: block;
  }

  .ws-table thead { display: none; }

  .ws-table tr {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .ws-table tr:last-child { margin-bottom: 0; }

  .ws-table td {
    border-bottom: none;
    padding: var(--space-1) 0;
  }

  .ws-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    margin-bottom: 2px;
  }
}
</style>
