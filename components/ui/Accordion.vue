<script setup lang="ts">
import { ref, useId } from 'vue'

const props = defineProps<{
  title: string
  initialOpen?: boolean
}>()

const isOpen = ref(props.initialOpen ?? false)
const contentId = `accordion-${useId()}`
const triggerId = `trigger-${contentId}`

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="accordion" :class="{ 'accordion--open': isOpen }">
    <button
      :id="triggerId"
      type="button"
      class="accordion__trigger"
      :aria-expanded="isOpen"
      :aria-controls="contentId"
      @click="toggle"
    >
      <span class="accordion__title">{{ title }}</span>
      <svg
        class="accordion__icon"
        width="16"
        height="10"
        viewBox="0 0 12 7"
        fill="none"
        aria-hidden="true"
      >
        <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
    <div
      :id="contentId"
      class="accordion__content"
      :aria-labelledby="triggerId"
      role="region"
    >
      <div class="accordion__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.accordion {
  border-bottom: 1px solid var(--color-line);
}

.accordion__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) 0;
  text-align: left;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-ink);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.accordion__trigger:hover {
  color: var(--color-primary);
}

.accordion__icon {
  flex-shrink: 0;
  color: var(--color-ink-muted);
  transition: transform var(--transition-normal);
}

.accordion--open .accordion__icon {
  transform: rotate(180deg);
}

.accordion__content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--transition-normal);
}

.accordion--open .accordion__content {
  grid-template-rows: 1fr;
}

.accordion__body {
  overflow: hidden;
  padding-bottom: var(--space-5);
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--leading-normal);
}
</style>
