<script setup lang="ts">
import { ref } from 'vue'
import type { EditorOutlineItem } from '~/utils/contentEditor'

/**
 * CC-IMP-03 — Content outline. Purely derived from the editor's blocks state
 * (no state of its own besides the narrow-viewport disclosure). Selecting an
 * entry asks the editor to open and focus that section.
 */
defineProps<{
  items: EditorOutlineItem[]
  localeLabel: string
  revision: number
  lastUpdated: string
  maxSections: number
}>()

const emit = defineEmits<{ select: [id: string] }>()

/** Collapsed by default below 1280px, where the outline stacks above the sections. */
const open = ref(false)
</script>

<template>
  <aside class="cco" :class="{ 'cco--open': open }" aria-labelledby="cco-title">
    <section class="cco-card">
      <div class="cco-head">
        <h2 id="cco-title" class="cco-title">Content outline</h2>
        <button
          type="button"
          class="cco-toggle"
          :aria-expanded="open"
          aria-controls="cco-list"
          @click="open = !open"
        >{{ open ? 'Hide' : `Show (${items.length})` }}</button>
      </div>
      <div id="cco-list" class="cco-body">
        <ol v-if="items.length > 0" class="cco-list">
          <li v-for="item in items" :key="item.id">
            <button type="button" class="cco-item" @click="emit('select', item.id)">
              <span class="cco-num" aria-hidden="true">{{ item.position }}</span>
              <span class="cco-text">
                <span class="cco-label">{{ item.label }}</span>
                <span class="cco-meta">
                  {{ item.typeLabel }}<template v-if="item.managedElsewhere"> · Media &amp; relations</template><template v-else-if="item.empty"> · Empty</template>
                </span>
              </span>
            </button>
          </li>
        </ol>
        <p v-else class="cco-empty">No sections yet.</p>
      </div>
    </section>

    <section class="cco-card" aria-labelledby="cco-draft-title">
      <h2 id="cco-draft-title" class="cco-title">Draft details</h2>
      <dl class="cco-rows">
        <div class="cco-row"><dt>Language</dt><dd>{{ localeLabel }}</dd></div>
        <div class="cco-row"><dt>Draft revision</dt><dd>{{ revision }}</dd></div>
        <div class="cco-row"><dt>Last updated</dt><dd>{{ lastUpdated }}</dd></div>
        <div class="cco-row"><dt>Sections</dt><dd>{{ items.length }} / {{ maxSections }}</dd></div>
      </dl>
      <p class="cco-note">Hero image, SEO, languages, AI and publishing are handled in other workspace modules.</p>
    </section>
  </aside>
</template>

<style scoped>
.cco { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

.cco-card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  min-width: 0;
}

.cco-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.cco-title { font-size: var(--text-base); font-weight: 600; color: var(--color-ink); margin: 0; }

.cco-toggle {
  display: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
}

.cco-body { margin-top: var(--space-3); }

.cco-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

.cco-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) !important;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.cco-item:hover { background: var(--color-surface-alt); }

.cco-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--color-line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.cco-text { min-width: 0; display: flex; flex-direction: column; }
.cco-label { font-size: var(--text-sm); color: var(--color-ink); overflow-wrap: anywhere; }
.cco-meta { font-size: 0.75rem; color: var(--color-ink-muted); }
.cco-empty { font-size: var(--text-sm); color: var(--color-ink-muted); margin: 0; }

.cco-rows { margin: var(--space-3) 0 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cco-row { display: flex; justify-content: space-between; gap: var(--space-3); }
.cco-row dt { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cco-row dd { font-size: var(--text-xs); color: var(--color-ink); margin: 0; text-align: right; overflow-wrap: anywhere; }
.cco-note { font-size: var(--text-xs); color: var(--color-ink-muted); margin: var(--space-3) 0 0; line-height: 1.5; }

/* ── ≤1279px: the outline stacks above the sections and collapses ── */
@media (max-width: 1279px) {
  .cco-toggle { display: inline-flex; align-items: center; }
  .cco-body { display: none; }
  .cco--open .cco-body { display: block; }
}
</style>
