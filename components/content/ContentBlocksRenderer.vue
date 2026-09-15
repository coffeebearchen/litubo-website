<script setup lang="ts">
import { computed } from 'vue'
import type { ContentRendererImage, ContentRendererListEntry } from '~/types/content-center'

/**
 * CC-IMP-06 — safe structured-content renderer (CONTENT-CENTER-BLUEPRINT-V1 §9).
 *
 * Renders the registered block types as plain text only — there is no `v-html`
 * anywhere, so no stored value can become markup. A block of an unknown type or
 * with an unexpected shape is skipped (shown as a notice in `preview` mode),
 * never guessed at. Media, downloads and relations arrive already resolved by the
 * caller, so this component never fetches, links files or decides eligibility.
 *
 * Today it serves only the admin Draft preview (`preview`: placeholders for empty
 * text, inert call-to-action links). It creates no public page or route.
 */

const props = withDefaults(defineProps<{
  blocks: unknown[]
  /** Resolved inline images by `fileLinkId`. */
  images?: Record<number, ContentRendererImage>
  downloads?: ContentRendererListEntry[]
  relations?: ContentRendererListEntry[]
  /** Admin Draft preview: show placeholders and notices, never navigate. */
  preview?: boolean
}>(), { images: () => ({}), downloads: () => [], relations: () => [], preview: false })

type Text = string

type View =
  | { id: string, kind: 'text', heading: Text, paragraphs: Text[] }
  | { id: string, kind: 'key_points', heading: Text, items: Array<{ title: Text, body: Text }> }
  | { id: string, kind: 'faq', heading: Text, items: Array<{ question: Text, answer: Text }> }
  | { id: string, kind: 'cta', heading: Text, body: Text, label: Text, href: Text }
  | { id: string, kind: 'image', linkId: number, caption: Text }
  | { id: string, kind: 'related_content', heading: Text }
  | { id: string, kind: 'downloads', heading: Text }
  | { id: string, kind: 'unsupported', type: string }

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const list = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object') : []

function toView(raw: unknown, index: number): View {
  const block = raw && typeof raw === 'object' ? raw as { id?: unknown, type?: unknown, data?: unknown } : {}
  const id = typeof block.id === 'string' ? block.id : `block-${index}`
  const data = block.data && typeof block.data === 'object' ? block.data as Record<string, unknown> : null
  const type = typeof block.type === 'string' ? block.type : 'unknown'
  if (!data) return { id, kind: 'unsupported', type }
  switch (type) {
    case 'text':
      return Array.isArray(data.paragraphs)
        ? { id, kind: 'text', heading: text(data.heading), paragraphs: data.paragraphs.map(text) }
        : { id, kind: 'unsupported', type }
    case 'key_points':
      return { id, kind: 'key_points', heading: text(data.heading), items: list(data.items).map(i => ({ title: text(i.title), body: text(i.body) })) }
    case 'faq':
      return { id, kind: 'faq', heading: text(data.heading), items: list(data.items).map(i => ({ question: text(i.question), answer: text(i.answer) })) }
    case 'cta':
      return { id, kind: 'cta', heading: text(data.heading), body: text(data.body), label: text(data.label), href: text(data.href) }
    case 'image':
      return Number.isInteger(data.fileLinkId)
        ? { id, kind: 'image', linkId: data.fileLinkId as number, caption: text(data.caption) }
        : { id, kind: 'unsupported', type }
    case 'related_content':
      return { id, kind: 'related_content', heading: text(data.heading) }
    case 'downloads':
      return { id, kind: 'downloads', heading: text(data.heading) }
    default:
      return { id, kind: 'unsupported', type }
  }
}

const views = computed(() => (Array.isArray(props.blocks) ? props.blocks : []).map(toView))
const blank = (value: string) => value.trim().length === 0
/** Internal paths and https:// only — the same rule block validation enforces on save. */
const safeHref = (href: string) => /^\/(?!\/)\S*$/.test(href) || /^https:\/\/\S+$/.test(href)
</script>

<template>
  <div class="cbr">
    <template v-for="view in views" :key="view.id">
      <section v-if="view.kind === 'text'" class="cbr-section">
        <h2 v-if="!blank(view.heading)" class="cbr-heading">{{ view.heading }}</h2>
        <template v-for="(paragraph, i) in view.paragraphs" :key="i">
          <p v-if="!blank(paragraph)" class="cbr-paragraph">{{ paragraph }}</p>
          <p v-else-if="preview" class="cbr-placeholder">Empty paragraph</p>
        </template>
      </section>

      <section v-else-if="view.kind === 'key_points'" class="cbr-section">
        <h2 v-if="!blank(view.heading)" class="cbr-heading">{{ view.heading }}</h2>
        <ul class="cbr-points" role="list">
          <li v-for="(item, i) in view.items" :key="i" class="cbr-point">
            <span v-if="!blank(item.title)" class="cbr-point-title">{{ item.title }}</span>
            <span v-else-if="preview" class="cbr-placeholder">Empty key point</span>
            <span v-if="!blank(item.body)" class="cbr-point-body">{{ item.body }}</span>
          </li>
        </ul>
      </section>

      <section v-else-if="view.kind === 'faq'" class="cbr-section">
        <h2 class="cbr-heading">{{ blank(view.heading) ? 'Frequently asked questions' : view.heading }}</h2>
        <div class="cbr-faq">
          <details v-for="(item, i) in view.items" :key="i" class="cbr-faq-item">
            <summary class="cbr-faq-question">
              <template v-if="!blank(item.question)">{{ item.question }}</template>
              <span v-else-if="preview" class="cbr-placeholder">Empty question</span>
            </summary>
            <p v-if="!blank(item.answer)" class="cbr-paragraph">{{ item.answer }}</p>
            <p v-else-if="preview" class="cbr-placeholder">Empty answer</p>
          </details>
        </div>
      </section>

      <section v-else-if="view.kind === 'cta'" class="cbr-section cbr-cta">
        <h2 v-if="!blank(view.heading)" class="cbr-heading">{{ view.heading }}</h2>
        <p v-if="!blank(view.body)" class="cbr-paragraph">{{ view.body }}</p>
        <div class="cbr-cta-row">
          <a v-if="!preview && !blank(view.label) && safeHref(view.href)" :href="view.href" class="cbr-cta-button">{{ view.label }}</a>
          <span v-else class="cbr-cta-button cbr-cta-button--inert" aria-disabled="true">{{ blank(view.label) ? 'Empty button label' : view.label }}</span>
          <span v-if="preview" class="cbr-cta-href">Link: {{ blank(view.href) ? 'not set' : view.href }} · not followed in preview</span>
        </div>
      </section>

      <figure v-else-if="view.kind === 'image'" class="cbr-section cbr-figure">
        <img v-if="images[view.linkId]?.src" :src="images[view.linkId].src!" :alt="images[view.linkId].alt" class="cbr-image" loading="lazy">
        <div v-else-if="preview" class="cbr-image-missing">Image not available</div>
        <figcaption v-if="!blank(view.caption) || images[view.linkId]?.note" class="cbr-caption">
          {{ view.caption }}
          <span v-if="preview && images[view.linkId]?.note" class="cbr-note">{{ images[view.linkId].note }}</span>
        </figcaption>
      </figure>

      <section v-else-if="view.kind === 'related_content'" class="cbr-section">
        <h2 class="cbr-heading">{{ blank(view.heading) ? 'Related' : view.heading }}</h2>
        <ul v-if="relations.length" class="cbr-list" role="list">
          <li v-for="entry in relations" :key="entry.key" class="cbr-list-item">
            <span class="cbr-list-label">{{ entry.label }}</span>
            <span v-if="entry.meta" class="cbr-list-meta">{{ entry.meta }}</span>
            <span v-if="preview && entry.note" class="cbr-note">{{ entry.note }}</span>
          </li>
        </ul>
        <p v-else-if="preview" class="cbr-placeholder">No related items</p>
      </section>

      <section v-else-if="view.kind === 'downloads'" class="cbr-section">
        <h2 class="cbr-heading">{{ blank(view.heading) ? 'Downloads' : view.heading }}</h2>
        <ul v-if="downloads.length" class="cbr-list" role="list">
          <li v-for="entry in downloads" :key="entry.key" class="cbr-list-item">
            <span class="cbr-list-label">{{ entry.label }}</span>
            <span v-if="entry.meta" class="cbr-list-meta">{{ entry.meta }}</span>
            <span v-if="preview && entry.note" class="cbr-note">{{ entry.note }}</span>
          </li>
        </ul>
        <p v-else-if="preview" class="cbr-placeholder">No enabled downloads</p>
      </section>

      <p v-else-if="preview" class="cbr-unsupported">Unsupported section ({{ view.type }}) — not rendered.</p>
    </template>
  </div>
</template>

<style scoped>
.cbr { display: flex; flex-direction: column; gap: var(--space-6); min-width: 0; }
.cbr-section { min-width: 0; margin: 0; }
.cbr-heading { font-family: var(--font-display, inherit); font-size: var(--text-xl); font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-3); overflow-wrap: anywhere; }
.cbr-paragraph { font-size: var(--text-base); line-height: 1.65; color: var(--color-ink); margin: 0 0 var(--space-3); overflow-wrap: anywhere; white-space: pre-line; }
.cbr-placeholder { font-size: var(--text-sm); color: var(--color-ink-muted); font-style: italic; margin: 0 0 var(--space-2); }
.cbr-note { display: inline-block; margin-left: var(--space-2); font-size: var(--text-xs); font-weight: 600; color: #8A4B00; background: #FFF4E0; border-radius: var(--radius-sm); padding: 0 var(--space-2); }

.cbr-points { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4); }
.cbr-point { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3) var(--space-4); border-left: 3px solid var(--color-primary); background: var(--color-surface-alt); min-width: 0; }
.cbr-point-title { font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
.cbr-point-body { font-size: var(--text-sm); color: var(--color-ink-muted); overflow-wrap: anywhere; }

.cbr-faq { display: flex; flex-direction: column; border-top: 1px solid var(--color-line); }
.cbr-faq-item { border-bottom: 1px solid var(--color-line); padding: var(--space-3) 0; }
.cbr-faq-question { cursor: pointer; font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; min-height: 32px; }
.cbr-faq-item .cbr-paragraph { margin-top: var(--space-2); }

.cbr-cta { background: var(--color-surface-alt); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: var(--space-5); }
.cbr-cta-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.cbr-cta-button { display: inline-flex; align-items: center; min-height: 40px; padding: var(--space-2) var(--space-5); border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 500; text-decoration: none; }
.cbr-cta-button--inert { cursor: default; }
.cbr-cta-href { font-size: var(--text-xs); color: var(--color-ink-muted); overflow-wrap: anywhere; }

.cbr-figure { display: flex; flex-direction: column; gap: var(--space-2); }
.cbr-image { width: 100%; max-width: 100%; height: auto; border-radius: var(--radius-md); display: block; }
.cbr-image-missing { aspect-ratio: 16 / 9; max-width: 100%; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--color-line); border-radius: var(--radius-md); color: var(--color-ink-muted); font-size: var(--text-sm); }
.cbr-caption { font-size: var(--text-sm); color: var(--color-ink-muted); overflow-wrap: anywhere; }

.cbr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cbr-list-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-sm); min-width: 0; }
.cbr-list-label { font-weight: 500; color: var(--color-ink); overflow-wrap: anywhere; }
.cbr-list-meta { font-size: var(--text-xs); color: var(--color-ink-muted); }
.cbr-unsupported { font-size: var(--text-xs); color: var(--color-ink-muted); border: 1px dashed var(--color-line); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); margin: 0; }
</style>
