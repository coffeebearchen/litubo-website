<script setup lang="ts">
defineProps<{
  id: string
  label: string
  options: Array<{ value: string; label: string }>
  required?: boolean
  modelValue?: string
  placeholder?: string
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="select-field" :class="{ 'select-field--error': error }">
    <label :for="id" class="select-field__label">
      {{ label }}
      <span v-if="required" class="select-field__required" aria-hidden="true">*</span>
    </label>
    <div class="select-field__wrap">
      <select
        :id="id"
        class="select-field__select"
        :required="required"
        :value="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="placeholder" value="" disabled :selected="!modelValue">{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <svg class="select-field__icon" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
        <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </div>
    <p v-if="error" class="select-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.select-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.select-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ink);
}

.select-field__required {
  color: var(--color-accent);
  margin-left: var(--space-1);
}

.select-field__wrap {
  position: relative;
}

.select-field__select {
  width: 100%;
  padding: var(--space-3) var(--space-10) var(--space-3) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-white);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  appearance: none;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.select-field__select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(47, 107, 58, 0.12);
}

.select-field__icon {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-ink-muted);
}

.select-field--error .select-field__select {
  border-color: #c0392b;
}

.select-field__error {
  font-size: var(--text-xs);
  color: #c0392b;
  font-weight: 500;
}
</style>
