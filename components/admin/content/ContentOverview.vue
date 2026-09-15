<script setup lang="ts">
import { computed } from 'vue'
import type { AdminContentDraftDetail } from '~/types/content-center'
import {
  CONTENT_AI_UNAVAILABLE,
  CONTENT_LOCALE_LABELS,
  CONTENT_READINESS_UNAVAILABLE,
  CONTENT_WORKSPACE_MODULES,
  contentAllowedBlockLabels,
  contentBlockSummary,
  contentLocaleSummary,
  contentSeoLocalesRoute,
  contentSeoSummary,
  contentTypeLabel,
  formatContentDateTime,
  primaryContentLocale,
} from '~/utils/contentCenter'

/**
 * CC-IMP-02 — CC-01 Overview panels (CC-VIS-01-CONTENT-CENTER-OVERVIEW-D1440).
 * Read-only and write-free: it shows only what the admin BFF returns. Modules
 * that do not exist yet (readiness, AI, editing, linking) are stated as
 * unavailable — never estimated, scored or shown as progress.
 */
const props = defineProps<{ draft: AdminContentDraftDetail }>()

const primary = computed(() => primaryContentLocale(props.draft.locales))
const primaryLocaleLabel = computed(() =>
  primary.value ? CONTENT_LOCALE_LABELS[primary.value.locale] : null)
const typeLabel = computed(() => contentTypeLabel(props.draft.content_type))
const allowedBlocks = computed(() => contentAllowedBlockLabels(props.draft.content_type))
const locales = computed(() => contentLocaleSummary(props.draft))
const blocks = computed(() => contentBlockSummary(primary.value))
const seo = computed(() => contentSeoSummary(primary.value))
</script>

<template>
  <div class="cc-overview">
    <section class="cc-card cc-card--identity" aria-labelledby="cc-identity-heading">
      <h2 id="cc-identity-heading" class="cc-card-title">Content identity</h2>
      <p class="cc-card-hint">
        <template v-if="primaryLocaleLabel">From the {{ primaryLocaleLabel }} draft.</template>
        <template v-else>No language draft exists for this record.</template>
      </p>

      <dl class="cc-fields">
        <div class="cc-field">
          <dt>Title</dt>
          <dd>{{ primary?.title ?? 'Not set' }}</dd>
        </div>
        <div class="cc-field">
          <dt>Slug</dt>
          <dd class="cc-mono">{{ primary?.slug ?? 'Not set' }}</dd>
        </div>
        <div class="cc-field">
          <dt>Summary</dt>
          <dd :class="{ 'cc-muted': !primary?.summary }">{{ primary?.summary || 'Not set' }}</dd>
        </div>
      </dl>
    </section>

    <section class="cc-card" aria-labelledby="cc-type-heading">
      <h2 id="cc-type-heading" class="cc-card-title">Content type</h2>
      <p class="cc-card-hint">Set when the record was created and cannot be changed.</p>
      <p class="cc-type-value">{{ typeLabel }}</p>
      <p class="cc-subheading">Sections this type allows</p>
      <ul class="cc-chips" role="list">
        <li v-for="label in allowedBlocks" :key="label" class="cc-chip">{{ label }}</li>
      </ul>
    </section>

    <section class="cc-card" aria-labelledby="cc-lifecycle-heading">
      <h2 id="cc-lifecycle-heading" class="cc-card-title">Lifecycle status</h2>
      <p class="cc-card-hint">Current state of this content record.</p>
      <StatusBadge :status="draft.status" />
      <dl class="cc-rows">
        <div class="cc-row">
          <dt>Created</dt>
          <dd>{{ formatContentDateTime(draft.date_created) }}</dd>
        </div>
        <div class="cc-row">
          <dt>Last updated</dt>
          <dd>{{ formatContentDateTime(draft.date_updated ?? draft.date_created) }}</dd>
        </div>
        <div class="cc-row">
          <dt>Draft revision</dt>
          <dd>{{ primary ? primary.draft_revision : '—' }}</dd>
        </div>
        <div class="cc-row">
          <dt>First published</dt>
          <dd>{{ draft.first_published_at ? formatContentDateTime(draft.first_published_at) : 'Never published' }}</dd>
        </div>
      </dl>
      <p class="cc-card-note">Publishing is not available yet. Nothing here is public.</p>
    </section>

    <section class="cc-card" aria-labelledby="cc-readiness-heading">
      <h2 id="cc-readiness-heading" class="cc-card-title">Readiness</h2>
      <p class="cc-card-hint">Publishing checks for this record.</p>
      <p class="cc-pill cc-pill--neutral">{{ CONTENT_READINESS_UNAVAILABLE }}</p>
      <p class="cc-card-note">Readiness checks arrive with Preview &amp; publish readiness.</p>
    </section>

    <section class="cc-card" aria-labelledby="cc-locales-heading">
      <h2 id="cc-locales-heading" class="cc-card-title">Language status</h2>
      <p class="cc-card-hint">Drafts per site language.</p>
      <ul class="cc-locale-list" role="list">
        <li v-for="row in locales" :key="row.code" class="cc-locale">
          <span class="cc-locale-name">
            {{ row.label }}<template v-if="row.isDefault"> (default)</template>
            <span v-if="row.draftRevision !== null" class="cc-locale-rev">Revision {{ row.draftRevision }}</span>
          </span>
          <span class="cc-pill" :class="row.state === 'not_started' ? 'cc-pill--muted' : 'cc-pill--neutral'">
            {{ row.stateLabel }}
          </span>
        </li>
      </ul>
      <p class="cc-card-note">
        Languages are started and their search settings edited in
        <NuxtLink :to="contentSeoLocalesRoute(draft.id)" class="cc-note-link">SEO &amp; locales</NuxtLink>.
      </p>
    </section>

    <section class="cc-card" aria-labelledby="cc-structure-heading">
      <h2 id="cc-structure-heading" class="cc-card-title">Structured content</h2>
      <p class="cc-card-hint">Sections in the {{ primaryLocaleLabel ?? 'default' }} draft.</p>
      <p class="cc-count">
        <span class="cc-count-value">{{ blocks.total }}</span>
        {{ blocks.total === 1 ? 'section' : 'sections' }}
      </p>
      <ul v-if="blocks.total > 0" class="cc-chips" role="list">
        <li v-for="entry in blocks.byType" :key="entry.type" class="cc-chip">
          {{ entry.label }}<template v-if="entry.count > 1"> × {{ entry.count }}</template>
        </li>
      </ul>
      <p v-else class="cc-card-note">No content sections yet.</p>
      <p class="cc-card-note">Section text is edited in Content editor.</p>
    </section>

    <section class="cc-card" aria-labelledby="cc-seo-heading">
      <h2 id="cc-seo-heading" class="cc-card-title">SEO status</h2>
      <p class="cc-card-hint">Search settings of the {{ primaryLocaleLabel ?? 'default' }} draft.</p>
      <dl class="cc-rows">
        <div class="cc-row">
          <dt>SEO title</dt>
          <dd>{{ seo.seoTitle ? 'Set' : 'Missing — title is used' }}</dd>
        </div>
        <div class="cc-row">
          <dt>Meta description</dt>
          <dd>{{ seo.seoDescription ? 'Set' : 'Missing — summary is used' }}</dd>
        </div>
        <div class="cc-row">
          <dt>Canonical</dt>
          <dd>{{ seo.canonicalOverride ? 'Custom path' : 'Default' }}</dd>
        </div>
        <div class="cc-row">
          <dt>Search indexing</dt>
          <dd>{{ seo.noindex ? 'Noindex on' : 'Allowed' }}</dd>
        </div>
      </dl>
    </section>

    <section class="cc-card" aria-labelledby="cc-links-heading">
      <h2 id="cc-links-heading" class="cc-card-title">Media &amp; relations</h2>
      <p class="cc-card-hint">Media Library files and related records linked to this content.</p>
      <p class="cc-count">
        <span class="cc-count-value">{{ draft.linkCounts.media }}</span> linked media
      </p>
      <p class="cc-count">
        <span class="cc-count-value">{{ draft.linkCounts.relations }}</span> related records
      </p>
      <p class="cc-card-note">Linking is done in Media &amp; relations.</p>
    </section>

    <section class="cc-card" aria-labelledby="cc-ai-heading">
      <h2 id="cc-ai-heading" class="cc-card-title">AI-assisted content</h2>
      <p class="cc-card-hint">Source-based suggestions for this draft.</p>
      <p class="cc-pill cc-pill--muted">{{ CONTENT_AI_UNAVAILABLE }}</p>
      <p class="cc-card-note">AI never publishes. Suggestions will be reviewed before anything reaches the draft.</p>
    </section>

    <section class="cc-card cc-card--modules" aria-labelledby="cc-modules-heading">
      <h2 id="cc-modules-heading" class="cc-card-title">Workspace modules</h2>
      <p class="cc-card-hint">Which parts of this workspace are available today.</p>
      <ul class="cc-module-list" role="list">
        <li v-for="module in CONTENT_WORKSPACE_MODULES" :key="module.key" class="cc-module">
          <span class="cc-module-name">{{ module.label }}</span>
          <span class="cc-pill" :class="module.enabled ? 'cc-pill--ok' : 'cc-pill--muted'">
            {{ module.enabled ? 'Available' : module.disabledReason ?? 'Not built yet' }}
          </span>
        </li>
      </ul>
    </section>

    <p class="cc-footnote">
      Content, SEO, media and AI suggestions all converge into one draft record before publication.
      Nothing is published until a person reviews and publishes it.
    </p>
  </div>
</template>

<style scoped>
.cc-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: start;
}

.cc-card {
  min-width: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.cc-card--identity { grid-column: span 2; }
.cc-card--modules { grid-column: 1 / -1; }

.cc-card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 var(--space-1);
}

.cc-card-hint {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-4);
}

.cc-card-note {
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  line-height: 1.5;
  margin: var(--space-3) 0 0;
}

.cc-fields { margin: 0; display: flex; flex-direction: column; gap: var(--space-4); }

.cc-field dt,
.cc-subheading {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  margin: 0 0 var(--space-1);
}

.cc-subheading { margin-top: var(--space-4); }

.cc-field dd {
  font-size: var(--text-sm);
  color: var(--color-ink);
  margin: 0;
  overflow-wrap: anywhere;
}

.cc-mono { font-family: 'Courier New', monospace; }
.cc-note-link { color: var(--color-primary); }
.cc-muted { color: var(--color-ink-muted) !important; font-style: italic; }

.cc-type-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.cc-chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cc-chip {
  font-size: var(--text-xs);
  color: var(--color-ink);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: 2px var(--space-3);
}

.cc-rows { margin: var(--space-3) 0 0; display: flex; flex-direction: column; gap: var(--space-2); }

.cc-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}

.cc-row dt { font-size: var(--text-xs); color: var(--color-ink-muted); flex-shrink: 0; }
.cc-row dd { font-size: var(--text-xs); color: var(--color-ink); margin: 0; text-align: right; overflow-wrap: anywhere; }

.cc-pill {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  margin: 0;
  white-space: nowrap;
}

.cc-pill--neutral { background: #E8EDE8; color: #4A5E58; }
.cc-pill--muted { background: var(--color-surface-alt); color: var(--color-ink-muted); border: 1px solid var(--color-line); }
.cc-pill--ok { background: #D1F0E8; color: #0F5C4B; }

.cc-locale-list,
.cc-module-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cc-locale,
.cc-module {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.cc-locale-name,
.cc-module-name {
  font-size: var(--text-sm);
  color: var(--color-ink);
  min-width: 0;
  overflow-wrap: anywhere;
}

.cc-locale-rev {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
}

.cc-module-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--space-6);
}

.cc-count { font-size: var(--text-sm); color: var(--color-ink); margin: 0 0 var(--space-2); }
.cc-count-value { font-size: var(--text-xl); font-weight: 700; margin-right: var(--space-1); }

.cc-footnote {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  line-height: 1.5;
}

/* ── ≤1279px: two columns ── */
@media (max-width: 1279px) {
  .cc-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* ── ≤1023px: one column (the module rail still sits beside the content) ── */
@media (max-width: 1023px) {
  .cc-overview { grid-template-columns: minmax(0, 1fr); }
  .cc-card--identity { grid-column: auto; }
  .cc-module-list { grid-template-columns: minmax(0, 1fr); }
}
</style>
