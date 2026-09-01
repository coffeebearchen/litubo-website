<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
}>()

function handleSearch(value: string) {
  emit('search', value)
}
</script>

<template>
  <div class="search-field">
    <label v-if="label" class="search-field__label sr-only">{{ label }}</label>
    <div class="search-field__wrap">
      <svg class="search-field__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <input
        class="search-field__input"
        type="search"
        :placeholder="placeholder"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="handleSearch(($event.target as HTMLInputElement).value)"
      >
    </div>
  </div>
</template>

<style scoped>
.search-field__wrap {
  position: relative;
}

.search-field__icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-ink-muted);
  pointer-events: none;
}

.search-field__input {
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-10);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  appearance: none;
}

.search-field__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(15, 92, 75, 0.12);
}

.search-field__input::placeholder {
  color: var(--color-ink-muted);
}
</style>
