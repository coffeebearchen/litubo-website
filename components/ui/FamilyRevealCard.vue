<script setup lang="ts">
/**
 * Scheme-C product family card: a media stage that swaps between the representative product
 * photo and a short description, over an always-visible title and category link.
 *
 * Interaction contract (01-DESIGN-SPEC):
 * - hover previews the description and leaving restores the photo;
 * - click / Enter / Space pins the description open, repeating it restores the photo;
 * - Escape closes the current card; touch only needs a tap (never hover);
 * - the title and the "Explore systems" link never disappear, so the category route stays reachable
 *   without any interaction;
 * - no scale, no rotation, no 3D flip; images stay `contain` at their real proportions.
 *
 * Motion is fixed in the component: no per-card animation settings are exposed in the CMS.
 */
const props = withDefaults(defineProps<{
  title: string
  description: string
  to: string
  imageSrc?: string
  imageAlt?: string
  modelLabel?: string
  exploreLabel?: string
  index?: number
}>(), {
  imageAlt: '',
  modelLabel: '',
  exploreLabel: 'Explore systems',
  index: 0,
})

const imgError = ref(false)
const expanded = ref(false)
const pinned = ref(false)
/** Only pinpoint pointers get the hover preview; touch and coarse pointers rely on tap. */
const canHover = ref(false)

const copyId = computed(() => `family-copy-${props.index}`)
const order = computed(() => String(props.index + 1).padStart(2, '0'))

onMounted(() => {
  canHover.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
})

function preview() {
  if (canHover.value && !pinned.value) expanded.value = true
}

function restore() {
  if (!pinned.value) expanded.value = false
}

function toggle() {
  pinned.value = !pinned.value
  expanded.value = pinned.value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && expanded.value) {
    pinned.value = false
    expanded.value = false
  }
}
</script>

<template>
  <article class="family-reveal" :class="{ 'is-open': expanded }">
    <button
      type="button"
      class="reveal-stage"
      :aria-expanded="expanded"
      :aria-controls="copyId"
      :aria-label="`${expanded ? 'Show image for' : 'Show description for'} ${title}`"
      @mouseenter="preview"
      @mouseleave="restore"
      @click="toggle"
      @keydown="onKeydown"
      @blur="restore"
    >
      <span class="reveal-photo" :aria-hidden="expanded">
        <img
          v-if="imageSrc && !imgError"
          :src="imageSrc"
          :alt="imageAlt || title"
          loading="lazy"
          @error="imgError = true"
        >
        <span v-else class="reveal-photo__placeholder img-placeholder img-placeholder--warm-light" aria-hidden="true" />
        <span v-if="modelLabel" class="source-model">{{ modelLabel }}</span>
      </span>

      <span :id="copyId" class="reveal-copy" :aria-hidden="!expanded">
        <span class="copy-kicker">{{ order }} / DESCRIPTION</span>
        <span class="copy-body">{{ description }}</span>
      </span>

      <span class="reveal-symbol" aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
    </button>

    <div class="family-footer">
      <h3>{{ title }}</h3>
      <!-- Readable without JS: the description is not reachable behind the toggle in that case. -->
      <noscript><p class="family-noscript">{{ description }}</p></noscript>
      <NuxtLink :to="to" class="family-link">
        {{ exploreLabel }}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="M5 19L19 5M5 5h14v14" />
        </svg>
      </NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.family-reveal {
  border: 1px solid var(--color-line);
  background: var(--color-white);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color 220ms, box-shadow 320ms var(--reveal-easing), transform 320ms var(--reveal-easing);
}
.family-reveal.is-open {
  border-color: #C7A05C;
  box-shadow: 0 12px 28px #1B42240D;
  transform: translateY(-2px);
}

.reveal-stage {
  display: block;
  position: relative;
  isolation: isolate;
  aspect-ratio: 4 / 3;
  width: 100%;
  text-align: left;
  background: #F9F4E9;
  overflow: hidden;
  border: 0;
  color: var(--color-ink);
  cursor: pointer;
}
.reveal-stage:focus-visible { outline-offset: -5px; }

.reveal-photo,
.reveal-copy {
  position: absolute;
  inset: 0;
  display: flex;
  min-width: 0;
  transition: opacity 300ms var(--reveal-easing), transform var(--reveal-duration) var(--reveal-easing), visibility 300ms;
}

.reveal-photo {
  padding: 24px 28px 50px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
/* Contain, never scale: a family representative photo must stay recognisable. */
.reveal-photo img {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  transform: none !important;
}
.reveal-photo__placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
}

.source-model {
  position: absolute;
  bottom: 44px;
  left: 24px;
  right: 24px;
  text-align: center;
  font-size: var(--text-xs);
  color: #6B614D;
}

.reveal-copy {
  padding: 28px 28px 52px;
  background: #FBF6EA;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
}
.copy-kicker {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--color-link-on-light);
}
.copy-body {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-ink-muted);
}

.reveal-stage[aria-expanded="true"] .reveal-photo {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
}
.reveal-stage[aria-expanded="true"] .reveal-copy {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.reveal-symbol {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid #D0B47A;
  background: #FFFCF5E8;
  border-radius: 50%;
  font-size: 26px;
  color: var(--color-link-on-light);
  z-index: 2;
}
.reveal-hint {
  position: absolute;
  bottom: 14px;
  left: 24px;
  right: 24px;
  font-size: var(--text-xs);
  color: #806019;
  z-index: 2;
}

.family-footer {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 160px;
}
.family-footer h3 {
  font-size: var(--text-xl);
  line-height: 1.3;
  color: var(--color-primary-deep);
}
.family-noscript { font-size: var(--text-sm); color: var(--color-ink-muted); }

.family-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  margin-top: auto;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}
.family-link svg {
  flex: none;
  transition: transform 180ms var(--reveal-easing);
}
.family-link:hover svg { transform: translate(2px, -2px); }

@media (max-width: 760px) {
  .reveal-stage { aspect-ratio: auto; height: 320px; }
  .family-footer { min-height: 0; padding: 22px; }
  .reveal-copy { padding: 30px 26px 50px; gap: 18px; }
  .copy-body { font-size: var(--text-base); }
}

@media (prefers-reduced-motion: reduce) {
  .family-reveal,
  .reveal-photo,
  .reveal-copy,
  .family-link svg,
  .reveal-symbol {
    transition: none !important;
    transform: none !important;
  }
  .family-reveal.is-open { transform: none; }
}
</style>
