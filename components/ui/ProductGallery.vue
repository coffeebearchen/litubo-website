<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface GalleryImage { id: string; url: string; alt: string }

const props = withDefaults(defineProps<{
  images: GalleryImage[]
  ratio?: string
}>(), { ratio: '1 / 1' })

const active = ref(0)
const zoomed = ref(false)

const list = computed(() => props.images.filter(i => i && i.url))
const current = computed(() => list.value[active.value] ?? null)
const hasMany = computed(() => list.value.length > 1)

function go(step: number) {
  const n = list.value.length
  if (!n) return
  active.value = (active.value + step + n) % n
}

watch(list, () => { if (active.value >= list.value.length) active.value = 0 })
</script>

<template>
  <div class="model-gallery">
    <div class="model-gallery__stage" :style="{ aspectRatio: ratio }">
      <button
        v-if="current"
        type="button"
        class="model-gallery__main"
        :aria-label="`Enlarge image ${active + 1} of ${list.length}`"
        @click="zoomed = true"
      >
        <img :src="current.url" :alt="current.alt" class="model-gallery__img">
      </button>
      <div v-else class="model-gallery__empty img-placeholder" aria-hidden="true" />

      <button v-if="hasMany" type="button" class="model-gallery__nav model-gallery__nav--prev" aria-label="Previous image" @click.stop="go(-1)">‹</button>
      <button v-if="hasMany" type="button" class="model-gallery__nav model-gallery__nav--next" aria-label="Next image" @click.stop="go(1)">›</button>
    </div>

    <div v-if="hasMany" class="model-gallery__thumbs" role="tablist" aria-label="Product images">
      <button
        v-for="(img, i) in list"
        :key="img.id || i"
        type="button"
        role="tab"
        :aria-selected="i === active"
        class="model-gallery__thumb"
        :class="{ 'is-active': i === active }"
        @click="active = i"
      >
        <img :src="img.url" :alt="img.alt" loading="lazy">
      </button>
    </div>

    <Teleport to="body">
      <div v-if="zoomed && current" class="model-gallery__zoom" role="dialog" aria-modal="true" @click="zoomed = false">
        <img :src="current.url" :alt="current.alt" class="model-gallery__zoom-img">
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.model-gallery { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }

.model-gallery__stage {
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
}

.model-gallery__main {
  display: block;
  width: 100%;
  height: 100%;
  padding: var(--space-5);
  background: none;
  border: 0;
  cursor: zoom-in;
}

.model-gallery__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.model-gallery__empty { width: 100%; height: 100%; }

.model-gallery__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--color-line);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-primary);
  font-size: 22px;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.model-gallery__nav:hover { background: var(--color-white); }
.model-gallery__nav--prev { left: var(--space-2); }
.model-gallery__nav--next { right: var(--space-2); }

.model-gallery__thumbs {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

.model-gallery__thumb {
  flex: 0 0 130px;
  width: 130px;
  height: 130px;
  padding: 6px;
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.model-gallery__thumb.is-active { border-color: var(--color-primary); }
.model-gallery__thumb img { width: 100%; height: 100%; object-fit: contain; display: block; }

.model-gallery__zoom {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(10, 24, 20, 0.9);
  display: grid;
  place-items: center;
  padding: var(--space-8);
  cursor: zoom-out;
}

.model-gallery__zoom-img { max-width: 92vw; max-height: 90vh; object-fit: contain; }
</style>
